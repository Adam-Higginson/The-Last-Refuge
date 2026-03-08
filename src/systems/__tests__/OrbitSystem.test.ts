import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { OrbitSystem } from '../OrbitSystem';
import { OrbitComponent } from '../../components/OrbitComponent';
import { TransformComponent } from '../../components/TransformComponent';

describe('OrbitSystem', () => {
    let world: World;
    let eventQueue: EventQueue;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
        world = new World();
    });

    it('advances orbit angle on turn:end event', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        expect(orbit.angle).toBe(0);

        // Emit and drain a turn:end event
        eventQueue.emit({ type: 'turn:end' });
        eventQueue.drain();

        expect(orbit.angle).toBeCloseTo(0.15);
    });

    it('advances angle by speed each turn', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.3));
        entity.addComponent(new TransformComponent(600, 300));

        // Advance three turns
        for (let i = 0; i < 3; i++) {
            eventQueue.emit({ type: 'turn:end' });
            eventQueue.drain();
        }

        expect(orbit.angle).toBeCloseTo(0.9);
    });

    it('syncs transform position from orbit parameters on update', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        const transform = entity.addComponent(new TransformComponent(0, 0));

        // update() should sync transform from orbit
        system.update(16);

        // angle=0: position should be (cx + r, cy) = (600, 300)
        expect(transform.x).toBeCloseTo(600);
        expect(transform.y).toBeCloseTo(300);
    });

    it('syncs transform correctly after angle change', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        const transform = entity.addComponent(new TransformComponent(0, 0));

        // Manually set angle to pi/2 (90 degrees — top of orbit if y-down)
        orbit.angle = Math.PI / 2;
        system.update(16);

        // At pi/2: x = cx + r*cos(pi/2) = 400, y = cy + r*sin(pi/2) = 500
        expect(transform.x).toBeCloseTo(400);
        expect(transform.y).toBeCloseTo(500);
    });

    it('handles multiple orbiting entities', () => {
        const system = new OrbitSystem();
        system.init(world);

        const e1 = world.createEntity('inner');
        const orbit1 = e1.addComponent(new OrbitComponent(400, 300, 100, 0.1));
        e1.addComponent(new TransformComponent(0, 0));

        const e2 = world.createEntity('outer');
        const orbit2 = e2.addComponent(new OrbitComponent(400, 300, 200, 0.2));
        e2.addComponent(new TransformComponent(0, 0));

        eventQueue.emit({ type: 'turn:end' });
        eventQueue.drain();

        expect(orbit1.angle).toBeCloseTo(0.1);
        expect(orbit2.angle).toBeCloseTo(0.2);
    });

    it('does not advance angle for non-turn events', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        eventQueue.emit({ type: 'entity:click', entityId: 1 });
        eventQueue.drain();

        expect(orbit.angle).toBe(0);
    });

    it('unsubscribes from turn:end on destroy', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        system.destroy();

        // Events after destroy should not advance the orbit
        eventQueue.emit({ type: 'turn:end' });
        eventQueue.drain();

        expect(orbit.angle).toBe(0);
    });
});
