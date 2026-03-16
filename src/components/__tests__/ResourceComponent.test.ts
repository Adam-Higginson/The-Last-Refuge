import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { GameEvents } from '../../core/GameEvents';
import { ServiceLocator } from '../../core/ServiceLocator';
import { ResourceComponent } from '../ResourceComponent';
import { CrewMemberComponent } from '../CrewMemberComponent';
import { RESOURCE_CONFIGS, SHIP_REACTOR_ENERGY, FOOD_PER_PERSON } from '../../data/resources';

describe('ResourceComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let res: ResourceComponent;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        const gameState = world.createEntity('gameState');
        res = gameState.addComponent(new ResourceComponent());
        res.init();
    });

    // --- Starting values ---

    it('starts with correct resource amounts', () => {
        expect(res.resources.food.current).toBe(RESOURCE_CONFIGS.food.startingAmount);
        expect(res.resources.materials.current).toBe(RESOURCE_CONFIGS.materials.startingAmount);
        expect(res.resources.energy.current).toBe(RESOURCE_CONFIGS.energy.startingAmount);
    });

    it('starts with correct storage caps', () => {
        expect(res.resources.food.cap).toBe(RESOURCE_CONFIGS.food.startingCap);
        expect(res.resources.materials.cap).toBe(RESOURCE_CONFIGS.materials.startingCap);
        expect(res.resources.energy.cap).toBe(RESOURCE_CONFIGS.energy.startingCap);
    });

    // --- Modifiers ---

    it('addModifier and removeModifier work', () => {
        res.addModifier({ id: 'test:farm', resource: 'food', amount: 8, source: 'Farm' });
        expect(res.getModifiers('food')).toHaveLength(1);

        res.removeModifier('test:farm');
        expect(res.getModifiers('food')).toHaveLength(0);
    });

    it('getModifierRate sums modifiers for a resource', () => {
        res.addModifier({ id: 'a', resource: 'food', amount: 8, source: 'Farm A' });
        res.addModifier({ id: 'b', resource: 'food', amount: 5, source: 'Farm B' });
        res.addModifier({ id: 'c', resource: 'energy', amount: -3, source: 'Building' });

        expect(res.getModifierRate('food')).toBe(13);
        expect(res.getModifierRate('energy')).toBe(SHIP_REACTOR_ENERGY - 3);
        expect(res.getModifierRate('materials')).toBe(0);
    });

    it('getNetRate includes population food consumption', () => {
        // Create 10 crew
        for (let i = 0; i < 10; i++) {
            const crew = world.createEntity(`crew${i}`);
            crew.addComponent(new CrewMemberComponent(
                `Person ${i}`, 30, 'Civilian', 50, ['Quiet', 'Hopeful'], 'Test backstory',
            ));
        }

        const netFood = res.getNetRate('food');
        // No food modifiers, minus population consumption
        expect(netFood).toBe(-10 * FOOD_PER_PERSON);
    });

    it('ship reactor provides baseline energy', () => {
        expect(res.getModifierRate('energy')).toBe(SHIP_REACTOR_ENERGY);
    });

    // --- Turn resolution ---

    it('applies production and consumption on TURN_END', () => {
        res.addModifier({ id: 'farm', resource: 'food', amount: 8, source: 'Farm' });
        const startFood = res.resources.food.current;

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        // Net = +8 (farm) - 0 (no crew) = +8
        expect(res.resources.food.current).toBe(startFood + 8);
    });

    it('applies energy production from ship reactor on TURN_END', () => {
        const startEnergy = res.resources.energy.current;

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(res.resources.energy.current).toBe(startEnergy + SHIP_REACTOR_ENERGY);
    });

    it('records lastNetChange after turn resolution', () => {
        res.addModifier({ id: 'farm', resource: 'food', amount: 8, source: 'Farm' });

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(res.lastNetChange.food).toBe(8);
        expect(res.lastNetChange.energy).toBe(SHIP_REACTOR_ENERGY);
        expect(res.lastNetChange.materials).toBe(0);
    });

    // --- Deficits ---

    it('clamps to 0 and emits RESOURCE_DEFICIT when food goes negative', () => {
        res.resources.food.current = 2;
        // Create 10 crew — will consume 10 food, deficit of 8
        for (let i = 0; i < 10; i++) {
            const crew = world.createEntity(`crew${i}`);
            crew.addComponent(new CrewMemberComponent(
                `Person ${i}`, 30, 'Civilian', 50, ['Quiet', 'Hopeful'], 'Test backstory',
            ));
        }

        const deficitSpy = vi.fn();
        eventQueue.on(GameEvents.RESOURCE_DEFICIT, deficitSpy);

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain(); // processes TURN_END, queues RESOURCE_DEFICIT
        eventQueue.drain(); // processes RESOURCE_DEFICIT

        expect(res.resources.food.current).toBe(0);
        expect(deficitSpy).toHaveBeenCalledWith(
            expect.objectContaining({ resource: 'food', deficit: 8 }),
        );
    });

    // --- Cap overflow ---

    it('clamps to cap when production exceeds storage', () => {
        res.resources.materials.current = 145;
        res.addModifier({ id: 'mine', resource: 'materials', amount: 20, source: 'Mine' });

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(res.resources.materials.current).toBe(RESOURCE_CONFIGS.materials.startingCap);
    });

    // --- canAfford / deduct ---

    it('canAfford returns true when sufficient', () => {
        expect(res.canAfford('materials', 50)).toBe(true);
    });

    it('canAfford returns false when insufficient', () => {
        expect(res.canAfford('materials', 999)).toBe(false);
    });

    it('deduct reduces resource and returns true', () => {
        expect(res.deduct('materials', 20)).toBe(true);
        expect(res.resources.materials.current).toBe(30);
    });

    it('deduct returns false and does not reduce when insufficient', () => {
        expect(res.deduct('materials', 999)).toBe(false);
        expect(res.resources.materials.current).toBe(RESOURCE_CONFIGS.materials.startingAmount);
    });

    // --- Lifecycle ---

    it('unsubscribes on destroy', () => {
        res.destroy();

        const startFood = res.resources.food.current;
        res.addModifier({ id: 'farm', resource: 'food', amount: 100, source: 'Farm' });
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        // Should not have changed since handler was removed
        expect(res.resources.food.current).toBe(startFood);
    });

    // --- RESOURCES_UPDATED event ---

    it('emits RESOURCES_UPDATED after turn resolution', () => {
        const updatedSpy = vi.fn();
        eventQueue.on(GameEvents.RESOURCES_UPDATED, updatedSpy);

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain(); // processes TURN_END, queues RESOURCES_UPDATED
        eventQueue.drain(); // processes RESOURCES_UPDATED

        expect(updatedSpy).toHaveBeenCalledTimes(1);
    });
});
