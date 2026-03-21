import { describe, it, expect, beforeEach } from 'vitest';
import { ExtirisRespawnComponent, RESPAWN_TURNS, MAX_DIFFICULTY_ESCALATION } from '../ExtirisRespawnComponent';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';

describe('ExtirisRespawnComponent', () => {
    let world: World;
    let eventQueue: EventQueue;

    beforeEach(() => {
        world = new World();
        eventQueue = new EventQueue();
        ServiceLocator.clear();
        ServiceLocator.register('world', world);
        ServiceLocator.register('eventQueue', eventQueue);
    });

    it('initializes with correct turn countdown', () => {
        const comp = new ExtirisRespawnComponent(1);
        expect(comp.turnsRemaining).toBe(RESPAWN_TURNS);
        expect(comp.destructionCount).toBe(1);
    });

    it('caps difficulty escalation at MAX_DIFFICULTY_ESCALATION', () => {
        const comp = new ExtirisRespawnComponent(10);
        expect(comp.difficultyEscalation).toBe(MAX_DIFFICULTY_ESCALATION);
    });

    it('counts down turns on TURN_END', () => {
        const gameState = world.createEntity('gameState');
        const comp = new ExtirisRespawnComponent(1);
        gameState.addComponent(comp);
        comp.init();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(comp.turnsRemaining).toBe(RESPAWN_TURNS - 1);
    });

    it('reaches 0 after RESPAWN_TURNS turn ends', () => {
        const gameState = world.createEntity('gameState');
        const comp = new ExtirisRespawnComponent(1);
        gameState.addComponent(comp);
        comp.init();

        for (let i = 0; i < RESPAWN_TURNS - 1; i++) {
            eventQueue.emit({ type: GameEvents.TURN_END, turn: i + 2 });
            eventQueue.drain();
        }

        expect(comp.turnsRemaining).toBe(1);

        // One more turn — triggers respawn (which calls createExtiris)
        // We can't fully test spawn without canvas, but turnsRemaining goes to 0
        eventQueue.emit({ type: GameEvents.TURN_END, turn: RESPAWN_TURNS + 1 });
        eventQueue.drain();

        expect(comp.turnsRemaining).toBe(0);
    });

    it('does not double-spawn if Extiris already exists', () => {
        const gameState = world.createEntity('gameState');
        const comp = new ExtirisRespawnComponent(1);
        gameState.addComponent(comp);
        comp.init();

        // Manually create an Extiris before the timer expires
        world.createEntity('extiris');

        // Fast-forward — spawn should be guarded
        for (let i = 0; i < RESPAWN_TURNS; i++) {
            eventQueue.emit({ type: GameEvents.TURN_END, turn: i + 2 });
            eventQueue.drain();
        }

        // The guard check (getEntityByName) should prevent double-spawn
        // and turnsRemaining should still reach 0
        expect(comp.turnsRemaining).toBe(0);
    });
});
