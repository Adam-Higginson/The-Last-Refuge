import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { OrbitSystem } from '../OrbitSystem';
import { OrbitComponent, ORBIT_ANIM_DURATION } from '../../components/OrbitComponent';
import { TransformComponent } from '../../components/TransformComponent';

/** Run enough update ticks to complete an animation at the given dt. */
function completeAnimation(system: OrbitSystem, dt = 1 / 60): void {
    const ticks = Math.ceil(ORBIT_ANIM_DURATION / dt) + 1;
    for (let i = 0; i < ticks; i++) {
        system.update(dt);
    }
}

describe('OrbitSystem', () => {
    let world: World;
    let eventQueue: EventQueue;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
        world = new World();
    });

    it('begins animation on turn:end event', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        expect(orbit.animating).toBe(false);

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        expect(orbit.animating).toBe(true);
        expect(orbit.startAngle).toBe(0);
        expect(orbit.targetAngle).toBeCloseTo(0.15);
    });

    it('reaches target angle after animation completes', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        // Run enough ticks to complete the animation
        completeAnimation(system);

        expect(orbit.angle).toBeCloseTo(0.15);
        expect(orbit.animating).toBe(false);
    });

    it('interpolates angle gradually during animation', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        // After a partial update, angle should be between 0 and 0.15
        system.update(ORBIT_ANIM_DURATION / 2); // half the animation
        expect(orbit.angle).toBeGreaterThan(0);
        expect(orbit.angle).toBeLessThan(0.15);
    });

    it('snaps to target when new turn starts during animation', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        // First turn
        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();
        system.update(ORBIT_ANIM_DURATION / 2); // half-animate

        // Second turn while still animating — should snap first
        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        // Should have snapped to first target and started new animation
        expect(orbit.startAngle).toBeCloseTo(0.15);
        expect(orbit.targetAngle).toBeCloseTo(0.30);
        expect(orbit.animating).toBe(true);
    });

    it('accumulates angle across multiple completed turns', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.3));
        entity.addComponent(new TransformComponent(600, 300));

        // Advance three turns, completing animation between each
        for (let i = 0; i < 3; i++) {
            eventQueue.emit({ type: GameEvents.TURN_END });
            eventQueue.drain();
            completeAnimation(system);
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
        system.update(1 / 60);

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
        system.update(1 / 60);

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

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();
        completeAnimation(system);

        expect(orbit1.angle).toBeCloseTo(0.1);
        expect(orbit2.angle).toBeCloseTo(0.2);
    });

    it('does not advance angle for non-turn events', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        eventQueue.emit({ type: GameEvents.ENTITY_CLICK, entityId: 1 });
        eventQueue.drain();

        expect(orbit.angle).toBe(0);
        expect(orbit.animating).toBe(false);
    });

    it('emits turn:block when animation starts', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        // The turn:end handler emits turn:block — drain to process it
        const blocked: Array<{ type: string; key?: string }> = [];
        eventQueue.on(GameEvents.TURN_BLOCK, (event) => {
            blocked.push(event as { type: string; key?: string });
        });
        eventQueue.drain();

        expect(blocked).toHaveLength(1);
        expect(blocked[0].key).toBe('orbit');
    });

    it('emits turn:unblock when all animations complete', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        // Complete the animation
        completeAnimation(system);

        const unblocked: Array<{ type: string; key?: string }> = [];
        eventQueue.on(GameEvents.TURN_UNBLOCK, (event) => {
            unblocked.push(event as { type: string; key?: string });
        });
        eventQueue.drain();

        expect(unblocked.length).toBeGreaterThan(0);
        expect(unblocked[0].key).toBe('orbit');
    });

    it('unsubscribes from turn:end on destroy', () => {
        const system = new OrbitSystem();
        system.init(world);

        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(400, 300, 200, 0.15));
        entity.addComponent(new TransformComponent(600, 300));

        system.destroy();

        // Events after destroy should not start animation
        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        expect(orbit.angle).toBe(0);
        expect(orbit.animating).toBe(false);
    });
});
