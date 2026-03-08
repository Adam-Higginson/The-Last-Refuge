import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { TurnSystem } from '../TurnSystem';
import { OrbitComponent } from '../../components/OrbitComponent';
import { TransformComponent } from '../../components/TransformComponent';

describe('TurnSystem', () => {
    let world: World;
    let eventQueue: EventQueue;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
        world = new World();
    });

    it('starts at turn 1', () => {
        const system = new TurnSystem();
        system.init(world);
        expect(system.currentTurn).toBe(1);
    });

    it('increments turn on turn:advance event', () => {
        const system = new TurnSystem();
        system.init(world);

        eventQueue.emit({ type: 'turn:advance' });
        eventQueue.drain();

        expect(system.currentTurn).toBe(2);
    });

    it('emits turn:end with turn number on turn:advance', () => {
        const system = new TurnSystem();
        system.init(world);

        eventQueue.emit({ type: 'turn:advance' });
        eventQueue.drain();

        const emitted: Array<{ type: string; turn?: number }> = [];
        eventQueue.on('turn:end', (event) => {
            emitted.push(event as { type: string; turn?: number });
        });
        eventQueue.drain();

        expect(emitted).toHaveLength(1);
        expect(emitted[0].turn).toBe(2);
    });

    it('accumulates turns across multiple advances', () => {
        const system = new TurnSystem();
        system.init(world);

        for (let i = 0; i < 5; i++) {
            eventQueue.emit({ type: 'turn:advance' });
            eventQueue.drain();
            // Drain the turn:end that gets emitted
            eventQueue.drain();
        }

        expect(system.currentTurn).toBe(6);
    });

    it('blocks turn advance while orbit animation is playing', () => {
        const system = new TurnSystem();
        system.init(world);

        // Create an entity with an animating orbit
        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));
        orbit.animating = true;

        eventQueue.emit({ type: 'turn:advance' });
        eventQueue.drain();

        // Turn should NOT have advanced
        expect(system.currentTurn).toBe(1);
    });

    it('allows turn advance after orbit animation completes', () => {
        const system = new TurnSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        // Animation is not playing
        orbit.animating = false;

        eventQueue.emit({ type: 'turn:advance' });
        eventQueue.drain();

        expect(system.currentTurn).toBe(2);
    });

    it('does not emit turn:end when blocked', () => {
        const system = new TurnSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));
        orbit.animating = true;

        eventQueue.emit({ type: 'turn:advance' });
        eventQueue.drain();

        const emitted: Array<{ type: string }> = [];
        eventQueue.on('turn:end', (event) => {
            emitted.push(event);
        });
        eventQueue.drain();

        expect(emitted).toHaveLength(0);
    });

    it('unsubscribes from turn:advance on destroy', () => {
        const system = new TurnSystem();
        system.init(world);
        system.destroy();

        eventQueue.emit({ type: 'turn:advance' });
        eventQueue.drain();

        expect(system.currentTurn).toBe(1);
    });

    it('ignores non-turn:advance events', () => {
        const system = new TurnSystem();
        system.init(world);

        eventQueue.emit({ type: 'entity:click', entityId: 1 });
        eventQueue.drain();

        expect(system.currentTurn).toBe(1);
    });
});
