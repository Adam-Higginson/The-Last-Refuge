import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { CentredComponent } from '../CentredComponent';
import { TransformComponent } from '../TransformComponent';

describe('CentredComponent', () => {
    let world: World;
    let eventQueue: EventQueue;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
        world = new World();
    });

    it('centres transform on CANVAS_RESIZE', () => {
        const entity = world.createEntity('star');
        const transform = entity.addComponent(new TransformComponent(400, 300));
        const centred = entity.addComponent(new CentredComponent());
        centred.init();

        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 1200,
            height: 800,
            dx: 200,
            dy: 100,
        });
        eventQueue.drain();

        expect(transform.x).toBe(600);
        expect(transform.y).toBe(400);
    });

    it('handles resize when transform is missing', () => {
        const entity = world.createEntity('orphan');
        const centred = entity.addComponent(new CentredComponent());
        centred.init();

        // Should not throw
        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 1200,
            height: 800,
            dx: 200,
            dy: 100,
        });
        eventQueue.drain();
    });

    it('unsubscribes on destroy', () => {
        const entity = world.createEntity('star');
        const transform = entity.addComponent(new TransformComponent(400, 300));
        const centred = entity.addComponent(new CentredComponent());
        centred.init();
        centred.destroy();

        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 1200,
            height: 800,
            dx: 200,
            dy: 100,
        });
        eventQueue.drain();

        // Transform should remain unchanged
        expect(transform.x).toBe(400);
        expect(transform.y).toBe(300);
    });
});
