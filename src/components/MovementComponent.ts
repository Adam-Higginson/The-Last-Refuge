// MovementComponent.ts — Ship movement with budget, targeting, and animation.
// Listens for RIGHT_CLICK to initiate movement when the entity is selected.
// Listens for TURN_END to reset movement budget.
// Animates position toward target each tick, syncs facing angle.
// Blocks turn advancement while movement is in progress.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { SelectableComponent } from './SelectableComponent';
import { TransformComponent } from './TransformComponent';
import type { RightClickEvent, CanvasResizeEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Speed at which displayBudget lerps toward budgetRemaining (units/sec) */
const DISPLAY_BUDGET_SPEED = 600;

export class MovementComponent extends Component {
    budgetMax: number;         // max movement distance per turn (px)
    budgetRemaining: number;   // remaining this turn
    targetX: number | null;    // where the ship is gliding toward
    targetY: number | null;
    speed: number;             // glide speed in px/second
    moving: boolean;
    facing: number;            // visual facing angle in radians
    displayBudget: number;     // animated budget radius for range circle visualization
    turnOriginX: number | null; // position at start of first move this turn
    turnOriginY: number | null;

    private eventQueue: EventQueue | null = null;
    private rightClickHandler: EventHandler | null = null;
    private turnEndHandler: EventHandler | null = null;
    private resizeHandler: EventHandler | null = null;

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
    }

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.rightClickHandler = (event): void => {
            const { x, y } = event as RightClickEvent;
            this.handleRightClick(x, y);
        };

        this.turnEndHandler = (): void => {
            this.budgetRemaining = this.budgetMax;
            this.displayBudget = this.budgetMax;
            this.turnOriginX = null;
            this.turnOriginY = null;
        };

        this.resizeHandler = (event): void => {
            const { width, height, dx, dy } = event as CanvasResizeEvent;

            // Derive old dimensions from new dimensions and centre delta
            const oldW = width - 2 * dx;
            const oldH = height - 2 * dy;
            const oldCx = oldW / 2;
            const oldCy = oldH / 2;
            const newCx = width / 2;
            const newCy = height / 2;

            // Scale factor: keep ship at the same proportional distance from
            // centre relative to the orbit radius (which is min(w,h) * 0.35).
            const scale = Math.min(width, height) / Math.min(oldW, oldH);

            const scalePoint = (x: number, y: number): { x: number; y: number } => ({
                x: newCx + (x - oldCx) * scale,
                y: newCy + (y - oldCy) * scale,
            });

            const transform = this.entity.getComponent(TransformComponent);
            if (transform) {
                const scaled = scalePoint(transform.x, transform.y);
                transform.x = scaled.x;
                transform.y = scaled.y;
                // Clamp to canvas bounds so the ship stays visible after resize
                const margin = 30;
                transform.x = Math.max(margin, Math.min(width - margin, transform.x));
                transform.y = Math.max(margin, Math.min(height - margin, transform.y));
            }
            if (this.turnOriginX !== null && this.turnOriginY !== null) {
                const scaled = scalePoint(this.turnOriginX, this.turnOriginY);
                this.turnOriginX = scaled.x;
                this.turnOriginY = scaled.y;
            }
            if (this.targetX !== null && this.targetY !== null) {
                const scaled = scalePoint(this.targetX, this.targetY);
                this.targetX = scaled.x;
                this.targetY = scaled.y;
            }
        };

        this.eventQueue.on(GameEvents.RIGHT_CLICK, this.rightClickHandler);
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
        this.eventQueue.on(GameEvents.CANVAS_RESIZE, this.resizeHandler);
    }

    private handleRightClick(targetX: number, targetY: number): void {
        const selectable = this.entity.getComponent(SelectableComponent);
        const transform = this.entity.getComponent(TransformComponent);
        if (!selectable || !transform) return;

        // Only respond to right-clicks when selected
        if (!selectable.selected) return;

        // Ignore if already moving
        if (this.moving) return;

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
        this.entity.emit({ type: GameEvents.TURN_BLOCK, key: 'movement' });
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
            const dx = this.targetX - transform.x;
            const dy = this.targetY - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const step = this.speed * dt;

            if (dist < 1 || step >= dist) {
                // Snap to target
                transform.x = this.targetX;
                transform.y = this.targetY;
                this.moving = false;
                this.targetX = null;
                this.targetY = null;

                this.entity.emit({
                    type: GameEvents.MOVE_COMPLETE,
                    entityId: this.entity.id,
                });
                this.entity.emit({
                    type: GameEvents.TURN_UNBLOCK,
                    key: 'movement',
                });
            } else {
                // Move toward target
                const ratio = step / dist;
                transform.x += dx * ratio;
                transform.y += dy * ratio;
            }
        }

        // Sync transform angle from facing
        transform.angle = this.facing;
    }

    destroy(): void {
        if (this.eventQueue && this.rightClickHandler) {
            this.eventQueue.off(GameEvents.RIGHT_CLICK, this.rightClickHandler);
        }
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
        if (this.eventQueue && this.resizeHandler) {
            this.eventQueue.off(GameEvents.CANVAS_RESIZE, this.resizeHandler);
        }
    }
}
