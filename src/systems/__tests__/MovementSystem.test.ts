import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { MovementSystem } from '../MovementSystem';
import { MovementComponent } from '../../components/MovementComponent';
import { SelectableComponent } from '../../components/SelectableComponent';
import { TransformComponent } from '../../components/TransformComponent';

describe('MovementSystem', () => {
    let world: World;
    let eventQueue: EventQueue;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
        world = new World();
    });

    /** Create a ship-like entity with all required components */
    function createShipEntity(
        x = 100, y = 100, budget = 300, speed = 200,
    ): { movement: MovementComponent; selectable: SelectableComponent; transform: TransformComponent } {
        const entity = world.createEntity('ship');
        const transform = entity.addComponent(new TransformComponent(x, y));
        const movement = entity.addComponent(new MovementComponent(budget, speed));
        const selectable = entity.addComponent(new SelectableComponent(18));
        return { movement, selectable, transform };
    }

    it('sets target and moving on RIGHT_CLICK when entity is selected and in range', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Right-click 200px away (within 300px budget)
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        expect(movement.moving).toBe(true);
        expect(movement.targetX).toBe(300);
        expect(movement.targetY).toBe(100);
    });

    it('rejects move when distance exceeds budget', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement, selectable } = createShipEntity(100, 100, 50);
        selectable.selected = true;

        // Right-click 200px away (exceeds 50px budget)
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        expect(movement.moving).toBe(false);
        expect(movement.targetX).toBeNull();
    });

    it('subtracts distance from budget on move command', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Move 200px
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        expect(movement.budgetRemaining).toBeCloseTo(100);
    });

    it('ignores RIGHT_CLICK when distance is below minimum threshold', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Right-click within hit radius (distance 2px, below hitRadius+2 threshold)
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 102, y: 100 });
        eventQueue.drain();

        expect(movement.moving).toBe(false);
        expect(movement.budgetRemaining).toBe(300);
    });

    it('ignores RIGHT_CLICK when no entity is selected', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement } = createShipEntity(100, 100, 300);
        // selectable.selected is false by default

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        expect(movement.moving).toBe(false);
    });

    it('ignores RIGHT_CLICK when already moving', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // First move
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();
        expect(movement.moving).toBe(true);

        // Second move while still moving — should be ignored
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 250, y: 100 });
        eventQueue.drain();

        expect(movement.targetX).toBe(200);
    });

    it('lerps position toward target each tick', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement, selectable, transform } = createShipEntity(100, 100, 300, 200);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        // After 0.5s at 200px/sec, should move 100px toward target
        system.update(0.5);

        expect(transform.x).toBeCloseTo(200);
        expect(transform.y).toBeCloseTo(100);
        expect(movement.moving).toBe(true);
    });

    it('snaps to target when close enough', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement, selectable, transform } = createShipEntity(100, 100, 300, 200);
        selectable.selected = true;

        // Move 30px (above hitRadius+2 minimum), at high effective speed so it arrives in one tick
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 130, y: 100 });
        eventQueue.drain();

        // One tick at 200px/s for 1s — step (200) >= dist (30), should snap
        system.update(1);

        expect(transform.x).toBeCloseTo(130);
        expect(movement.moving).toBe(false);
        expect(movement.targetX).toBeNull();
    });

    it('emits MOVE_COMPLETE when target reached', () => {
        const system = new MovementSystem();
        system.init(world);

        const { selectable } = createShipEntity(100, 100, 300, 10000);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 130, y: 100 });
        eventQueue.drain();

        // Register handler before update emits the event
        const completed: Array<{ type: string; entityId?: number }> = [];
        eventQueue.on(GameEvents.MOVE_COMPLETE, (event) => {
            completed.push(event as { type: string; entityId?: number });
        });

        // Fast speed, short distance — should arrive quickly
        system.update(1);
        eventQueue.drain();

        expect(completed).toHaveLength(1);
    });

    it('resets budget on TURN_END', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Spend some budget
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();
        expect(movement.budgetRemaining).toBeCloseTo(200);

        // End turn
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(movement.budgetRemaining).toBe(300);
        expect(movement.displayBudget).toBe(300);
    });

    it('emits turn:block when movement starts', () => {
        const system = new MovementSystem();
        system.init(world);

        const { selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();

        const blocked: Array<{ type: string; key?: string }> = [];
        eventQueue.on(GameEvents.TURN_BLOCK, (event) => {
            blocked.push(event as { type: string; key?: string });
        });
        eventQueue.drain();

        expect(blocked).toHaveLength(1);
        expect(blocked[0].key).toBe('movement');
    });

    it('emits turn:unblock when movement completes', () => {
        const system = new MovementSystem();
        system.init(world);

        const { selectable } = createShipEntity(100, 100, 300, 10000);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 130, y: 100 });
        eventQueue.drain();
        // Drain the turn:block event
        eventQueue.drain();

        // Register handler before update emits the event
        const unblocked: Array<{ type: string; key?: string }> = [];
        eventQueue.on(GameEvents.TURN_UNBLOCK, (event) => {
            unblocked.push(event as { type: string; key?: string });
        });

        system.update(1);
        eventQueue.drain();

        expect(unblocked.length).toBeGreaterThan(0);
        expect(unblocked[0].key).toBe('movement');
    });

    it('lerps displayBudget toward budgetRemaining each tick', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement } = createShipEntity(100, 100, 300);

        // Manually set budget lower to trigger display animation
        movement.budgetRemaining = 100;

        // After a small dt, displayBudget should move toward 100 but not reach it
        system.update(0.1);

        expect(movement.displayBudget).toBeLessThan(300);
        expect(movement.displayBudget).toBeGreaterThan(100);
    });

    it('updates facing angle on move command', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Move directly right (angle 0)
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();

        expect(movement.facing).toBeCloseTo(0);
    });

    it('syncs transform angle from facing', () => {
        const system = new MovementSystem();
        system.init(world);

        const { movement, transform } = createShipEntity(100, 100, 300);
        movement.facing = Math.PI / 4;

        system.update(1 / 60);

        expect(transform.angle).toBeCloseTo(Math.PI / 4);
    });

    it('unsubscribes from events on destroy', () => {
        const system = new MovementSystem();
        system.init(world);

        const { selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        system.destroy();

        // Events after destroy should not trigger movement
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();

        const entities = world.getEntitiesWithComponent(MovementComponent);
        const movement = entities[0].getComponent(MovementComponent);
        expect(movement?.moving).toBe(false);
    });
});
