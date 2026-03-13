import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { MovementComponent } from '../MovementComponent';
import { SelectableComponent } from '../SelectableComponent';
import { TransformComponent } from '../TransformComponent';

describe('MovementComponent', () => {
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
        movement.init();
        return { movement, selectable, transform };
    }

    it('sets target and moving on RIGHT_CLICK when entity is selected and in range', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Right-click 200px away (within 300px budget)
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        expect(movement.moving).toBe(true);
        expect(movement.targetX).toBe(300);
        expect(movement.targetY).toBe(100);
    });

    it('clamps move to budget range when distance exceeds budget', () => {
        const { movement, selectable } = createShipEntity(100, 100, 50);
        selectable.selected = true;

        // Right-click 200px away (exceeds 50px budget) — should clamp to 50px
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        expect(movement.moving).toBe(true);
        expect(movement.targetX).toBeCloseTo(150); // 100 + 50px in the x direction
        expect(movement.targetY).toBeCloseTo(100);
        expect(movement.budgetRemaining).toBeCloseTo(0);
    });

    it('subtracts distance from budget on move command', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Move 200px
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        expect(movement.budgetRemaining).toBeCloseTo(100);
    });

    it('ignores RIGHT_CLICK when distance is below minimum threshold', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Right-click within hit radius (distance 2px, below hitRadius+2 threshold)
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 102, y: 100 });
        eventQueue.drain();

        expect(movement.moving).toBe(false);
        expect(movement.budgetRemaining).toBe(300);
    });

    it('ignores RIGHT_CLICK when entity is not selected', () => {
        const { movement } = createShipEntity(100, 100, 300);
        // selectable.selected is false by default

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        expect(movement.moving).toBe(false);
    });

    it('ignores RIGHT_CLICK when already moving', () => {
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
        const { movement, selectable, transform } = createShipEntity(100, 100, 300, 200);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        // After 0.5s at 200px/sec, should move 100px toward target
        movement.update(0.5);

        expect(transform.x).toBeCloseTo(200);
        expect(transform.y).toBeCloseTo(100);
        expect(movement.moving).toBe(true);
    });

    it('snaps to target when close enough', () => {
        const { movement, selectable, transform } = createShipEntity(100, 100, 300, 200);
        selectable.selected = true;

        // Move 30px (above hitRadius+2 minimum), at high effective speed so it arrives in one tick
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 130, y: 100 });
        eventQueue.drain();

        // One tick at 200px/s for 1s — step (200) >= dist (30), should snap
        movement.update(1);

        expect(transform.x).toBeCloseTo(130);
        expect(movement.moving).toBe(false);
        expect(movement.targetX).toBeNull();
    });

    it('emits MOVE_COMPLETE when target reached', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300, 10000);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 130, y: 100 });
        eventQueue.drain();

        // Register handler before update emits the event
        const completed: Array<{ type: string; entityId?: number }> = [];
        eventQueue.on(GameEvents.MOVE_COMPLETE, (event) => {
            completed.push(event as { type: string; entityId?: number });
        });

        // Fast speed, short distance — should arrive quickly
        movement.update(1);
        eventQueue.drain();

        expect(completed).toHaveLength(1);
    });

    it('resets budget on TURN_END', () => {
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
        const { movement, selectable } = createShipEntity(100, 100, 300, 10000);
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

        movement.update(1);
        eventQueue.drain();

        expect(unblocked.length).toBeGreaterThan(0);
        expect(unblocked[0].key).toBe('movement');
    });

    it('does not lerp displayBudget while moving', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Start a move — budget reduced but displayBudget should stay
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();

        const displayBefore = movement.displayBudget;
        movement.update(0.1);

        // displayBudget should NOT have changed while moving
        expect(movement.displayBudget).toBe(displayBefore);
        expect(movement.moving).toBe(true);
    });

    it('lerps displayBudget toward budgetRemaining after arrival', () => {
        const { movement } = createShipEntity(100, 100, 300);

        // Simulate post-arrival state: not moving, but displayBudget mismatched
        movement.budgetRemaining = 100;
        movement.moving = false;

        movement.update(0.1);

        expect(movement.displayBudget).toBeLessThan(300);
        expect(movement.displayBudget).toBeGreaterThan(100);
    });

    it('updates facing angle on move command', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Move directly right (angle 0)
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();

        expect(movement.facing).toBeCloseTo(0);
    });

    it('syncs transform angle from facing', () => {
        const { movement, transform } = createShipEntity(100, 100, 300);
        movement.facing = Math.PI / 4;

        movement.update(1 / 60);

        expect(transform.angle).toBeCloseTo(Math.PI / 4);
    });

    it('sets turnOrigin on first move of a turn', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();

        expect(movement.turnOriginX).toBe(100);
        expect(movement.turnOriginY).toBe(100);
    });

    it('keeps turnOrigin from first move on subsequent moves', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300, 10000);
        selectable.selected = true;

        // First move
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 150, y: 100 });
        eventQueue.drain();
        movement.update(1); // arrive instantly
        eventQueue.drain();

        // Second move from new position (150, 100)
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();

        // turnOrigin should still be the original position
        expect(movement.turnOriginX).toBe(100);
        expect(movement.turnOriginY).toBe(100);
    });

    it('resets turnOrigin on TURN_END', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();
        expect(movement.turnOriginX).toBe(100);

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(movement.turnOriginX).toBeNull();
        expect(movement.turnOriginY).toBeNull();
    });

    it('unsubscribes from events on destroy', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        movement.destroy();

        // Events after destroy should not trigger movement
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();

        expect(movement.moving).toBe(false);
    });

    // Resize tests use a 2x scale: 800x600 → 1600x1200 (dx=400, dy=300)
    // scale = min(1600,1200) / min(800,600) = 2
    // Ship at (200, 150): offset from old centre (400,300) = (-200,-150)
    //   → newX = 800 + (-200*2) = 400, newY = 600 + (-150*2) = 300

    it('scales transform proportionally on CANVAS_RESIZE', () => {
        const { transform } = createShipEntity(200, 150, 300);

        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 1600,
            height: 1200,
            dx: 400,
            dy: 300,
        });
        eventQueue.drain();

        expect(transform.x).toBe(400);
        expect(transform.y).toBe(300);
    });

    it('scales movement targets proportionally on CANVAS_RESIZE', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Start a move — target at (300, 100)
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        expect(movement.targetX).toBe(300);
        expect(movement.targetY).toBe(100);

        // 2x resize: target offset from old centre (400,300) = (-100,-200) → new = 800+(-200), 600+(-400) = (600, 200)
        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 1600,
            height: 1200,
            dx: 400,
            dy: 300,
        });
        eventQueue.drain();

        expect(movement.targetX).toBe(600);
        expect(movement.targetY).toBe(200);
    });

    it('scales turnOrigin proportionally on CANVAS_RESIZE', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Start a move to set turnOrigin (at ship's initial position 100,100)
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();

        expect(movement.turnOriginX).toBe(100);
        expect(movement.turnOriginY).toBe(100);

        // 2x resize: turnOrigin offset from old centre (400,300) = (-300,-200) → new = 800+(-600), 600+(-400) = (200, 200)
        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 1600,
            height: 1200,
            dx: 400,
            dy: 300,
        });
        eventQueue.drain();

        expect(movement.turnOriginX).toBe(200);
        expect(movement.turnOriginY).toBe(200);
    });

    it('does not shift null targets on CANVAS_RESIZE', () => {
        const { movement } = createShipEntity(100, 100, 300);

        expect(movement.targetX).toBeNull();
        expect(movement.turnOriginX).toBeNull();

        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 1600,
            height: 1200,
            dx: 400,
            dy: 300,
        });
        eventQueue.drain();

        expect(movement.targetX).toBeNull();
        expect(movement.targetY).toBeNull();
        expect(movement.turnOriginX).toBeNull();
        expect(movement.turnOriginY).toBeNull();
    });

    it('unsubscribes resize handler on destroy', () => {
        const { movement, transform } = createShipEntity(200, 150, 300);
        movement.destroy();

        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 1600,
            height: 1200,
            dx: 400,
            dy: 300,
        });
        eventQueue.drain();

        // Transform should remain unchanged
        expect(transform.x).toBe(200);
        expect(transform.y).toBe(150);
    });
});
