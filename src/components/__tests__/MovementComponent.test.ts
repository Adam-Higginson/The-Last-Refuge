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

    it('emits turn:block with per-entity key when movement starts', () => {
        const { selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();

        // TURN_BLOCK was queued during the RIGHT_CLICK handler — drain again
        const blocked: Array<{ type: string; key?: string }> = [];
        eventQueue.on(GameEvents.TURN_BLOCK, (event) => {
            blocked.push(event as { type: string; key?: string });
        });
        eventQueue.drain();

        expect(blocked).toHaveLength(1);
        expect(blocked[0].key).toMatch(/^movement-/);
    });

    it('emits turn:unblock with per-entity key when movement completes', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300, 10000);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 130, y: 100 });
        eventQueue.drain();

        const unblocked: Array<{ type: string; key?: string }> = [];
        eventQueue.on(GameEvents.TURN_UNBLOCK, (event) => {
            unblocked.push(event as { type: string; key?: string });
        });

        // update() now directly emits TURN_UNBLOCK on arrival (no event round-trip)
        movement.update(1);
        eventQueue.drain();

        expect(unblocked.length).toBeGreaterThan(0);
        expect(unblocked[0].key).toMatch(/^movement-/);
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

    // --- Per-entity blocker key ---

    it('uses per-entity blocker key so two entities do not collide', () => {
        const entity1 = createShipEntity(100, 100, 300);
        const entity2 = createShipEntity(500, 500, 300);
        entity1.selectable.selected = true;
        entity2.selectable.selected = true;

        const blocks: Array<{ type: string; key?: string }> = [];
        eventQueue.on(GameEvents.TURN_BLOCK, (e) => {
            blocks.push(e as { type: string; key?: string });
        });

        // Move entity1
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();
        eventQueue.drain();

        expect(blocks).toHaveLength(2); // both entities respond
        const keys = blocks.map(b => b.key);
        expect(new Set(keys).size).toBe(2); // different keys
    });

    // --- Waypoint queue ---

    it('chains to next waypoint on arrival', () => {
        const { movement, selectable, transform } = createShipEntity(100, 100, 600, 10000);
        selectable.selected = true;

        // Start moving to first target
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();
        expect(movement.moving).toBe(true);

        // Queue a waypoint via ctrl+right-click
        eventQueue.emit({ type: GameEvents.MODIFIER_RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();
        expect(movement.waypointQueue).toHaveLength(1);

        // Arrive at first target — should immediately chain to waypoint
        movement.update(1);

        expect(movement.moving).toBe(true);
        expect(movement.targetX).toBeCloseTo(300);
        expect(movement.targetY).toBeCloseTo(100);
        expect(movement.waypointQueue).toHaveLength(0);

        // Arrive at second target
        movement.update(1);

        expect(movement.moving).toBe(false);
        expect(transform.x).toBeCloseTo(300);
        expect(transform.y).toBeCloseTo(100);
    });

    it('appends waypoints on MODIFIER_RIGHT_CLICK while moving', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300, 200);
        selectable.selected = true;

        // Start moving
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();
        expect(movement.moving).toBe(true);

        // Queue a waypoint
        eventQueue.emit({ type: GameEvents.MODIFIER_RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        expect(movement.waypointQueue).toHaveLength(1);
        expect(movement.waypointQueue[0]).toEqual({ x: 300, y: 100 });
    });

    it('clears waypoint queue on normal right-click', () => {
        const { movement, selectable } = createShipEntity(100, 100, 600, 10000);
        selectable.selected = true;

        // Move and queue a waypoint
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 150, y: 100 });
        eventQueue.drain();
        eventQueue.emit({ type: GameEvents.MODIFIER_RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();
        expect(movement.waypointQueue).toHaveLength(1);

        // Arrive at first target — waypoint chaining happens inline in update()
        movement.update(1);
        eventQueue.drain();

        // Wait for chained waypoint to arrive too
        movement.update(1);
        eventQueue.drain();

        // Normal right-click should clear queue
        eventQueue.emit({ type: GameEvents.RIGHT_CLICK, x: 250, y: 100 });
        eventQueue.drain();

        expect(movement.waypointQueue).toHaveLength(0);
    });

    it('persists waypoints across TURN_END and starts executing them', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Queue a waypoint (ctrl+right-click while idle)
        movement.waypointQueue.push({ x: 200, y: 100 });

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        // Waypoint should have been consumed and movement started
        expect(movement.moving).toBe(true);
        expect(movement.targetX).toBeCloseTo(200);
    });

    it('ctrl+right-click while idle queues without moving', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.MODIFIER_RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();

        expect(movement.waypointQueue).toHaveLength(1);
        expect(movement.moving).toBe(false);
    });

    it('executes queued waypoints on TURN_END', () => {
        const { movement, selectable } = createShipEntity(100, 100, 300);
        selectable.selected = true;

        // Queue a waypoint via ctrl+right-click
        eventQueue.emit({ type: GameEvents.MODIFIER_RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();
        expect(movement.moving).toBe(false);

        // End turn — should start moving toward the waypoint
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(movement.moving).toBe(true);
        expect(movement.targetX).toBeCloseTo(200);
        expect(movement.targetY).toBeCloseTo(100);
    });

    it('waypoints persist across turns when budget exhausted', () => {
        // Budget of 100, two waypoints each 200 apart
        const { movement, selectable } = createShipEntity(100, 100, 100, 10000);
        selectable.selected = true;

        // Queue two far waypoints
        eventQueue.emit({ type: GameEvents.MODIFIER_RIGHT_CLICK, x: 300, y: 100 });
        eventQueue.drain();
        eventQueue.emit({ type: GameEvents.MODIFIER_RIGHT_CLICK, x: 500, y: 100 });
        eventQueue.drain();
        expect(movement.waypointQueue).toHaveLength(2);

        // TURN_END — starts moving toward first waypoint, but budget clamps to 100wu
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(movement.moving).toBe(true);
        expect(movement.budgetRemaining).toBeCloseTo(0);
        // Original waypoint should be re-queued since budget clamped
        expect(movement.waypointQueue.length).toBeGreaterThanOrEqual(1);

        // Arrive at clamped position
        movement.update(1);
        eventQueue.drain();

        // Still have waypoints remaining
        expect(movement.waypointQueue.length).toBeGreaterThanOrEqual(1);

        // Next TURN_END — fresh budget, should resume
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();

        expect(movement.moving).toBe(true);
    });

    it('re-queues original waypoint when budget clamps', () => {
        // Budget 300, waypoint 500wu away
        const { movement, selectable } = createShipEntity(100, 100, 300, 10000);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.MODIFIER_RIGHT_CLICK, x: 600, y: 100 });
        eventQueue.drain();

        // TURN_END triggers execution
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(movement.moving).toBe(true);
        // Target should be clamped to 300wu from start
        expect(movement.targetX).toBeCloseTo(400);
        expect(movement.budgetRemaining).toBeCloseTo(0);
        // Original waypoint (600, 100) should be re-queued
        expect(movement.waypointQueue).toHaveLength(1);
        expect(movement.waypointQueue[0]).toEqual({ x: 600, y: 100 });
    });

    it('TURN_END with empty queue does not start movement', () => {
        const { movement } = createShipEntity(100, 100, 300);

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        expect(movement.moving).toBe(false);
    });

    it('arrival chains multiple close waypoints in one turn', () => {
        // Budget 600, three waypoints each 50wu apart — well within budget
        const { movement, selectable, transform } = createShipEntity(100, 100, 600, 10000);
        selectable.selected = true;

        eventQueue.emit({ type: GameEvents.MODIFIER_RIGHT_CLICK, x: 150, y: 100 });
        eventQueue.drain();
        eventQueue.emit({ type: GameEvents.MODIFIER_RIGHT_CLICK, x: 200, y: 100 });
        eventQueue.drain();
        eventQueue.emit({ type: GameEvents.MODIFIER_RIGHT_CLICK, x: 250, y: 100 });
        eventQueue.drain();

        // TURN_END starts first waypoint
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 2 });
        eventQueue.drain();

        // Update until all arrivals (high speed means instant)
        movement.update(1);
        movement.update(1);
        movement.update(1);

        expect(transform.x).toBeCloseTo(250);
        expect(transform.y).toBeCloseTo(100);
        expect(movement.waypointQueue).toHaveLength(0);
        expect(movement.moving).toBe(false);
    });
});
