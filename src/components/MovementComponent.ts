// MovementComponent.ts — Ship movement with budget, targeting, and animation.
// Listens for RIGHT_CLICK to initiate movement when the entity is selected.
// Listens for TURN_END to reset movement budget.
// Animates position toward target each tick, syncs facing angle.
// Blocks turn advancement while movement is in progress.
// All positions are in world coordinates — no resize handling needed.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { SelectableComponent } from './SelectableComponent';
import { TransformComponent } from './TransformComponent';
import { EngineStateComponent } from './EngineStateComponent';
import { animateMovement } from '../utils/animateMovement';
import type { RightClickEvent, ModifierRightClickEvent, TurnEndEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Speed at which displayBudget lerps toward budgetRemaining (units/sec) */
const DISPLAY_BUDGET_SPEED = 600;

export class MovementComponent extends Component {
    budgetMax: number;         // max movement distance per turn (world units)
    budgetRemaining: number;   // remaining this turn
    targetX: number | null;    // where the entity is gliding toward (world coords)
    targetY: number | null;
    speed: number;             // glide speed in world units/second
    moving: boolean;
    facing: number;            // visual facing angle in radians
    displayBudget: number;     // animated budget radius for range circle visualization
    turnOriginX: number | null; // position at start of first move this turn
    turnOriginY: number | null;
    waypointQueue: Array<{ x: number; y: number }>; // queued waypoints (ctrl+right-click)

    private eventQueue: EventQueue | null = null;
    private rightClickHandler: EventHandler | null = null;
    private modifierRightClickHandler: EventHandler | null = null;
    private turnEndHandler: EventHandler | null = null;
    private aiPhaseStartHandler: EventHandler | null = null;
    private aiPhaseEndHandler: EventHandler | null = null;
    private aiPhaseActive = false;

    constructor(budgetMax: number, speed = 200) {
        super();
        this.budgetMax = budgetMax;
        this.budgetRemaining = budgetMax;
        this.targetX = null;
        this.targetY = null;
        this.speed = speed;
        this.moving = false;
        this.facing = 0;
        this.displayBudget = budgetMax;
        this.turnOriginX = null;
        this.turnOriginY = null;
        this.waypointQueue = [];
    }

    /** Per-entity blocker key to avoid collision between multiple MovementComponents. */
    private get blockerKey(): string {
        return `movement-${this.entity.id}`;
    }

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.rightClickHandler = (event): void => {
            const { x, y } = event as RightClickEvent;
            this.handleRightClick(x, y);
        };

        this.modifierRightClickHandler = (event): void => {
            const { x, y } = event as ModifierRightClickEvent;
            this.handleModifierRightClick(x, y);
        };

        this.turnEndHandler = (event): void => {
            const { skipAnimations } = event as TurnEndEvent;

            // If skipAnimations and currently moving, teleport to destination
            if (skipAnimations && this.moving && this.targetX !== null && this.targetY !== null) {
                const transform = this.entity.getComponent(TransformComponent);
                if (transform) {
                    transform.x = this.targetX;
                    transform.y = this.targetY;
                }
                this.moving = false;
                this.targetX = null;
                this.targetY = null;
                this.waypointQueue = [];
                this.entity.emit({ type: GameEvents.MOVE_COMPLETE, entityId: this.entity.id });
                this.entity.emit({ type: GameEvents.TURN_UNBLOCK, key: this.blockerKey });
            }

            this.budgetRemaining = this.budgetMax;
            this.displayBudget = this.budgetMax;
            this.turnOriginX = null;
            this.turnOriginY = null;

            // Start executing queued waypoints with fresh budget
            if (!this.moving && this.waypointQueue.length > 0) {
                const transform = this.entity.getComponent(TransformComponent);
                if (transform) {
                    this.executeNextWaypoint(transform);
                }
            }
        };

        this.aiPhaseStartHandler = (): void => {
            this.aiPhaseActive = true;
        };
        this.aiPhaseEndHandler = (): void => {
            this.aiPhaseActive = false;
        };

        this.eventQueue.on(GameEvents.RIGHT_CLICK, this.rightClickHandler);
        this.eventQueue.on(GameEvents.MODIFIER_RIGHT_CLICK, this.modifierRightClickHandler);
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
        this.eventQueue.on(GameEvents.AI_PHASE_START, this.aiPhaseStartHandler);
        this.eventQueue.on(GameEvents.AI_PHASE_END, this.aiPhaseEndHandler);
    }

    private handleRightClick(targetX: number, targetY: number): void {
        // Suppress input during AI phase
        if (this.aiPhaseActive) return;

        // Block movement when engines are offline
        const engineState = this.entity.getComponent(EngineStateComponent);
        if (engineState && engineState.engineState !== 'online') return;

        const selectable = this.entity.getComponent(SelectableComponent);
        const transform = this.entity.getComponent(TransformComponent);
        if (!selectable || !transform) return;

        // Only respond to right-clicks when selected
        if (!selectable.selected) return;

        // Ignore if already moving
        if (this.moving) return;

        // Clear any queued waypoints on normal right-click
        this.waypointQueue = [];

        this.beginMoveTo(targetX, targetY, transform, selectable);
    }

    /** Append a waypoint to the queue (ctrl+right-click). Always queues, never starts immediately. */
    private handleModifierRightClick(targetX: number, targetY: number): void {
        if (this.aiPhaseActive) return;

        // Block movement when engines are offline
        const engineState = this.entity.getComponent(EngineStateComponent);
        if (engineState && engineState.engineState !== 'online') return;

        const selectable = this.entity.getComponent(SelectableComponent);
        if (!selectable?.selected) return;

        // Always append — never start moving immediately
        this.waypointQueue.push({ x: targetX, y: targetY });
    }

    /** Pop the next waypoint and begin moving toward it.
     *  If budget clamps the move short of the original target, re-queue it. */
    private executeNextWaypoint(transform: TransformComponent): void {
        if (this.waypointQueue.length === 0) return;
        const selectable = this.entity.getComponent(SelectableComponent);
        if (!selectable) return;

        const next = this.waypointQueue.shift();
        if (!next) return;

        this.beginMoveTo(next.x, next.y, transform, selectable);

        // If budget was fully consumed and target was clamped, re-queue original
        if (this.budgetRemaining <= 0 &&
            (this.targetX !== next.x || this.targetY !== next.y)) {
            this.waypointQueue.unshift({ x: next.x, y: next.y });
        }
    }

    /** Start movement toward a target point. */
    private beginMoveTo(
        targetX: number,
        targetY: number,
        transform: TransformComponent,
        selectable: SelectableComponent,
    ): void {
        // Block movement when engines are offline
        const engineState = this.entity.getComponent(EngineStateComponent);
        if (engineState && engineState.engineState !== 'online') return;

        // Validate distance is outside the entity's hit area
        let dx = targetX - transform.x;
        let dy = targetY - transform.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = selectable.hitRadius + 2;

        if (dist < minDist) return;

        // Clamp to budget range if click is beyond it
        let clampedX = targetX;
        let clampedY = targetY;
        if (dist > this.budgetRemaining) {
            const scale = this.budgetRemaining / dist;
            clampedX = transform.x + dx * scale;
            clampedY = transform.y + dy * scale;
            dx = clampedX - transform.x;
            dy = clampedY - transform.y;
            dist = this.budgetRemaining;
        }

        // Record turn origin on first move of the turn
        if (this.turnOriginX === null || this.turnOriginY === null) {
            this.turnOriginX = transform.x;
            this.turnOriginY = transform.y;
        }

        // Initiate movement
        this.targetX = clampedX;
        this.targetY = clampedY;
        this.moving = true;
        this.budgetRemaining -= dist;
        this.facing = Math.atan2(dy, dx);

        // Block turn advancement while moving
        this.entity.emit({ type: GameEvents.TURN_BLOCK, key: this.blockerKey });
    }

    update(dt: number): void {
        const transform = this.entity.getComponent(TransformComponent);
        if (!transform) return;

        // Animate displayBudget toward budgetRemaining (only after arrival)
        if (!this.moving && this.displayBudget !== this.budgetRemaining) {
            const diff = this.budgetRemaining - this.displayBudget;
            const step = DISPLAY_BUDGET_SPEED * dt;
            if (Math.abs(diff) <= step) {
                this.displayBudget = this.budgetRemaining;
            } else {
                this.displayBudget += Math.sign(diff) * step;
            }
        }

        // Animate movement toward target
        if (this.moving && this.targetX !== null && this.targetY !== null) {
            const result = animateMovement({
                x: transform.x,
                y: transform.y,
                targetX: this.targetX,
                targetY: this.targetY,
                speed: this.speed,
            }, dt);

            transform.x = result.x;
            transform.y = result.y;

            if (result.arrived) {
                this.moving = false;
                this.targetX = null;
                this.targetY = null;

                // Chain to next waypoint if available
                if (this.waypointQueue.length > 0 && this.budgetRemaining > 0) {
                    this.executeNextWaypoint(transform);
                }

                // Always emit MOVE_COMPLETE (other systems listen: FleetSidebar, etc.)
                this.entity.emit({
                    type: GameEvents.MOVE_COMPLETE,
                    entityId: this.entity.id,
                });

                // Unblock turn only if not continuing to another waypoint
                if (!this.moving) {
                    this.entity.emit({
                        type: GameEvents.TURN_UNBLOCK,
                        key: this.blockerKey,
                    });
                }
            }
        }

        // Sync transform angle from facing
        transform.angle = this.facing;
    }

    destroy(): void {
        if (this.eventQueue && this.rightClickHandler) {
            this.eventQueue.off(GameEvents.RIGHT_CLICK, this.rightClickHandler);
        }
        if (this.eventQueue && this.modifierRightClickHandler) {
            this.eventQueue.off(GameEvents.MODIFIER_RIGHT_CLICK, this.modifierRightClickHandler);
        }
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
        if (this.eventQueue && this.aiPhaseStartHandler) {
            this.eventQueue.off(GameEvents.AI_PHASE_START, this.aiPhaseStartHandler);
        }
        if (this.eventQueue && this.aiPhaseEndHandler) {
            this.eventQueue.off(GameEvents.AI_PHASE_END, this.aiPhaseEndHandler);
        }
    }
}
