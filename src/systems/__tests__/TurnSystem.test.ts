import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { TurnSystem } from '../TurnSystem';

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

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        expect(system.currentTurn).toBe(2);
    });

    it('emits turn:end with turn number on turn:advance', () => {
        const system = new TurnSystem();
        system.init(world);

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        const emitted: Array<{ type: string; turn?: number }> = [];
        eventQueue.on(GameEvents.TURN_END, (event) => {
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
            eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
            eventQueue.drain();
            // Drain the turn:end that gets emitted
            eventQueue.drain();
        }

        expect(system.currentTurn).toBe(6);
    });

    it('blocks turn advance when a blocker is active', () => {
        const system = new TurnSystem();
        system.init(world);

        // Another system blocks turn advancement
        eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'orbit' });
        eventQueue.drain();

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        expect(system.currentTurn).toBe(1);
    });

    it('allows turn advance after blocker is removed', () => {
        const system = new TurnSystem();
        system.init(world);

        // Block then unblock
        eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'orbit' });
        eventQueue.drain();
        eventQueue.emit({ type: GameEvents.TURN_UNBLOCK, key: 'orbit' });
        eventQueue.drain();

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        expect(system.currentTurn).toBe(2);
    });

    it('does not emit turn:end when blocked', () => {
        const system = new TurnSystem();
        system.init(world);

        eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'orbit' });
        eventQueue.drain();

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        const emitted: Array<{ type: string }> = [];
        eventQueue.on(GameEvents.TURN_END, (event) => {
            emitted.push(event);
        });
        eventQueue.drain();

        expect(emitted).toHaveLength(0);
    });

    it('supports multiple independent blockers', () => {
        const system = new TurnSystem();
        system.init(world);

        eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'orbit' });
        eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'combat' });
        eventQueue.drain();

        // Remove one blocker — still blocked by the other
        eventQueue.emit({ type: GameEvents.TURN_UNBLOCK, key: 'orbit' });
        eventQueue.drain();

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();
        expect(system.currentTurn).toBe(1);

        // Remove the second blocker — now unblocked
        eventQueue.emit({ type: GameEvents.TURN_UNBLOCK, key: 'combat' });
        eventQueue.drain();

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();
        expect(system.currentTurn).toBe(2);
    });

    it('unsubscribes from all events on destroy', () => {
        const system = new TurnSystem();
        system.init(world);
        system.destroy();

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        expect(system.currentTurn).toBe(1);
    });

    it('ignores non-turn events', () => {
        const system = new TurnSystem();
        system.init(world);

        eventQueue.emit({ type: GameEvents.ENTITY_CLICK, entityId: 1 });
        eventQueue.drain();

        expect(system.currentTurn).toBe(1);
    });
});
