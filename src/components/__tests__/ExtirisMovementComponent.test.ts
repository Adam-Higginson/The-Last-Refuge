import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { ExtirisMovementComponent } from '../ExtirisMovementComponent';
import { TransformComponent } from '../TransformComponent';

describe('ExtirisMovementComponent', () => {
    let eventQueue: EventQueue;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
    });

    function createExtirisEntity(x = 0, y = 0): {
        movement: ExtirisMovementComponent;
        transform: TransformComponent;
    } {
        const world = new World();
        const entity = world.createEntity('extiris');
        const transform = entity.addComponent(new TransformComponent(x, y));
        const movement = entity.addComponent(new ExtirisMovementComponent());
        return { movement, transform };
    }

    it('does not move when no target is set', () => {
        const { movement, transform } = createExtirisEntity(100, 100);
        movement.update(1);
        expect(transform.x).toBe(100);
        expect(transform.y).toBe(100);
    });

    it('moves toward target after setTarget', () => {
        const { movement, transform } = createExtirisEntity(0, 0);
        movement.setTarget(400, 0);

        movement.update(1); // speed=400, dt=1 → arrives exactly
        expect(transform.x).toBe(400);
        expect(transform.y).toBe(0);
        expect(movement.moving).toBe(false);
    });

    it('lerps position incrementally', () => {
        const { movement, transform } = createExtirisEntity(0, 0);
        movement.setTarget(800, 0);

        movement.update(0.5); // speed=400, dt=0.5 → moves 200
        expect(transform.x).toBeCloseTo(200);
        expect(movement.moving).toBe(true);
    });

    it('emits EXTIRIS_MOVE_COMPLETE on arrival', () => {
        const { movement } = createExtirisEntity(0, 0);
        movement.setTarget(100, 0);

        const completed: unknown[] = [];
        eventQueue.on(GameEvents.EXTIRIS_MOVE_COMPLETE, (e) => completed.push(e));

        movement.update(1); // speed=400 >> distance=100, arrives immediately
        eventQueue.drain();

        expect(completed).toHaveLength(1);
    });

    it('updates facing angle toward target', () => {
        const { movement } = createExtirisEntity(0, 0);
        movement.setTarget(0, 100); // moving straight down

        movement.update(0.1);
        expect(movement.facing).toBeCloseTo(Math.PI / 2);
    });

    it('syncs transform angle from facing', () => {
        const { movement, transform } = createExtirisEntity(0, 0);
        movement.setTarget(100, 100);

        movement.update(0.1);
        expect(transform.angle).toBeCloseTo(movement.facing);
    });

    it('clears target on arrival', () => {
        const { movement } = createExtirisEntity(0, 0);
        movement.setTarget(10, 0);

        movement.update(1);
        expect(movement.targetX).toBeNull();
        expect(movement.targetY).toBeNull();
        expect(movement.moving).toBe(false);
    });
});
