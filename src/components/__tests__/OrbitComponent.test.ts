import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { OrbitComponent, ORBIT_ANIM_DURATION } from '../OrbitComponent';
import { TransformComponent } from '../TransformComponent';

/** Run enough update ticks to complete an animation at the given dt. */
function completeAnimation(orbit: OrbitComponent, dt = 1 / 60): void {
    const ticks = Math.ceil(ORBIT_ANIM_DURATION / dt) + 1;
    for (let i = 0; i < ticks; i++) {
        orbit.update(dt);
    }
}

describe('OrbitComponent', () => {
    let world: World;
    let eventQueue: EventQueue;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
        world = new World();
    });

    it('begins animation on turn:end event', () => {
        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(0, 0, 350, 0.15));
        entity.addComponent(new TransformComponent(350, 0));
        orbit.init();

        expect(orbit.animating).toBe(false);

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        expect(orbit.animating).toBe(true);
        expect(orbit.startAngle).toBe(0);
        expect(orbit.targetAngle).toBeCloseTo(0.15);
    });

    it('reaches target angle after animation completes', () => {
        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(0, 0, 350, 0.15));
        entity.addComponent(new TransformComponent(350, 0));
        orbit.init();

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        completeAnimation(orbit);

        expect(orbit.angle).toBeCloseTo(0.15);
        expect(orbit.animating).toBe(false);
    });

    it('interpolates angle gradually during animation', () => {
        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(0, 0, 350, 0.15));
        entity.addComponent(new TransformComponent(350, 0));
        orbit.init();

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        // After a partial update, angle should be between 0 and 0.15
        orbit.update(ORBIT_ANIM_DURATION / 2);
        expect(orbit.angle).toBeGreaterThan(0);
        expect(orbit.angle).toBeLessThan(0.15);
    });

    it('snaps to target when new turn starts during animation', () => {
        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(0, 0, 350, 0.15));
        entity.addComponent(new TransformComponent(350, 0));
        orbit.init();

        // First turn
        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();
        orbit.update(ORBIT_ANIM_DURATION / 2);

        // Second turn while still animating — should snap first
        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        expect(orbit.startAngle).toBeCloseTo(0.15);
        expect(orbit.targetAngle).toBeCloseTo(0.30);
        expect(orbit.animating).toBe(true);
    });

    it('accumulates angle across multiple completed turns', () => {
        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(0, 0, 350, 0.3));
        entity.addComponent(new TransformComponent(350, 0));
        orbit.init();

        for (let i = 0; i < 3; i++) {
            eventQueue.emit({ type: GameEvents.TURN_END });
            eventQueue.drain();
            completeAnimation(orbit);
        }

        expect(orbit.angle).toBeCloseTo(0.9);
    });

    it('syncs transform position from orbit parameters on update', () => {
        const entity = world.createEntity('orbiter');
        entity.addComponent(new OrbitComponent(0, 0, 350, 0.15));
        const transform = entity.addComponent(new TransformComponent(0, 0));
        const orbit = entity.getComponent(OrbitComponent);
        orbit?.init();

        orbit?.update(1 / 60);

        // angle=0: position should be (cx + r, cy) = (350, 0)
        expect(transform.x).toBeCloseTo(350);
        expect(transform.y).toBeCloseTo(0);
    });

    it('syncs transform correctly after angle change', () => {
        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(0, 0, 350, 0.15));
        const transform = entity.addComponent(new TransformComponent(0, 0));
        orbit.init();

        // Manually set angle to pi/2
        orbit.angle = Math.PI / 2;
        orbit.update(1 / 60);

        // At pi/2: x = 0 + 350*cos(pi/2) ≈ 0, y = 0 + 350*sin(pi/2) = 350
        expect(transform.x).toBeCloseTo(0);
        expect(transform.y).toBeCloseTo(350);
    });

    it('handles multiple orbiting entities independently', () => {
        const e1 = world.createEntity('inner');
        const orbit1 = e1.addComponent(new OrbitComponent(0, 0, 100, 0.1));
        e1.addComponent(new TransformComponent(0, 0));
        orbit1.init();

        const e2 = world.createEntity('outer');
        const orbit2 = e2.addComponent(new OrbitComponent(0, 0, 350, 0.2));
        e2.addComponent(new TransformComponent(0, 0));
        orbit2.init();

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();
        completeAnimation(orbit1);
        completeAnimation(orbit2);

        expect(orbit1.angle).toBeCloseTo(0.1);
        expect(orbit2.angle).toBeCloseTo(0.2);
    });

    it('does not advance angle for non-turn events', () => {
        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(0, 0, 350, 0.15));
        entity.addComponent(new TransformComponent(350, 0));
        orbit.init();

        eventQueue.emit({ type: GameEvents.ENTITY_CLICK, entityId: 1 });
        eventQueue.drain();

        expect(orbit.angle).toBe(0);
        expect(orbit.animating).toBe(false);
    });

    it('emits turn:block with entity-scoped key when animation starts', () => {
        const entity = world.createEntity('orbiter');
        entity.addComponent(new OrbitComponent(0, 0, 350, 0.15));
        entity.addComponent(new TransformComponent(350, 0));
        const orbit = entity.getComponent(OrbitComponent);
        orbit?.init();

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        const blocked: Array<{ type: string; key?: string }> = [];
        eventQueue.on(GameEvents.TURN_BLOCK, (event) => {
            blocked.push(event as { type: string; key?: string });
        });
        eventQueue.drain();

        expect(blocked).toHaveLength(1);
        expect(blocked[0].key).toBe(`orbit:${entity.id}`);
    });

    it('emits turn:unblock with entity-scoped key when animation completes', () => {
        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(0, 0, 350, 0.15));
        entity.addComponent(new TransformComponent(350, 0));
        orbit.init();

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        completeAnimation(orbit);

        const unblocked: Array<{ type: string; key?: string }> = [];
        eventQueue.on(GameEvents.TURN_UNBLOCK, (event) => {
            unblocked.push(event as { type: string; key?: string });
        });
        eventQueue.drain();

        expect(unblocked.length).toBeGreaterThan(0);
        expect(unblocked[0].key).toBe(`orbit:${entity.id}`);
    });

    it('unsubscribes from turn:end on destroy', () => {
        const entity = world.createEntity('orbiter');
        const orbit = entity.addComponent(new OrbitComponent(0, 0, 350, 0.15));
        entity.addComponent(new TransformComponent(350, 0));
        orbit.init();

        orbit.destroy();

        eventQueue.emit({ type: GameEvents.TURN_END });
        eventQueue.drain();

        expect(orbit.angle).toBe(0);
        expect(orbit.animating).toBe(false);
    });
});
