// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { GameEvents } from '../../core/GameEvents';
import { ServiceLocator } from '../../core/ServiceLocator';
import { ResourceDeficitUIComponent } from '../ResourceDeficitUIComponent';

describe('ResourceDeficitUIComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let comp: ResourceDeficitUIComponent;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        const hud = world.createEntity('hud');
        comp = hud.addComponent(new ResourceDeficitUIComponent());
        comp.init();
    });

    afterEach(() => {
        comp.destroy();
    });

    it('shows alert on RESOURCE_DEFICIT event', () => {
        const overlay = document.getElementById('resource-deficit-overlay');
        const text = document.getElementById('resource-deficit-text');

        eventQueue.emit({ type: GameEvents.RESOURCE_DEFICIT, resource: 'food', deficit: 8 });
        eventQueue.drain();

        expect(overlay?.style.boxShadow).toContain('rgba(200, 30, 30, 0.45)');
        expect(text?.style.opacity).toBe('1');
    });

    it('shows correct text for food deficit', () => {
        eventQueue.emit({ type: GameEvents.RESOURCE_DEFICIT, resource: 'food', deficit: 5 });
        eventQueue.drain();

        const text = document.getElementById('resource-deficit-text');
        expect(text?.textContent).toBe('FOOD SUPPLIES CRITICAL');
    });

    it('shows correct text for energy deficit', () => {
        eventQueue.emit({ type: GameEvents.RESOURCE_DEFICIT, resource: 'energy', deficit: 3 });
        eventQueue.drain();

        const text = document.getElementById('resource-deficit-text');
        expect(text?.textContent).toBe('ENERGY GRID FAILURE');
    });

    it('hides alert after turn with no deficit', () => {
        // Trigger deficit
        eventQueue.emit({ type: GameEvents.RESOURCE_DEFICIT, resource: 'food', deficit: 5 });
        eventQueue.drain();

        // End turn with no new deficit
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        // Next turn — no deficit fired, so TURN_END should hide
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();

        const overlay = document.getElementById('resource-deficit-overlay');
        expect(overlay?.style.boxShadow).toContain('rgba(200, 30, 30, 0)');
    });

    it('unsubscribes on destroy', () => {
        comp.destroy();

        const text = document.getElementById('resource-deficit-text');
        // Should not exist after destroy
        expect(text).toBeNull();

        // Emitting after destroy should not error
        eventQueue.emit({ type: GameEvents.RESOURCE_DEFICIT, resource: 'food', deficit: 5 });
        eventQueue.drain();
    });
});
