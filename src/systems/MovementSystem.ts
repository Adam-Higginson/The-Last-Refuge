// MovementSystem.ts — Animates entities with MovementComponent toward their target.
// Listens for RIGHT_CLICK to initiate movement on selected entities.
// Listens for TURN_END to reset movement budgets.
// Updates TransformComponent position each tick, syncs facing angle.
// Blocks turn advancement while movement is in progress.

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { MovementComponent } from '../components/MovementComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import { TransformComponent } from '../components/TransformComponent';
import type { RightClickEvent } from '../core/GameEvents';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Speed at which displayBudget lerps toward budgetRemaining (units/sec) */
const DISPLAY_BUDGET_SPEED = 600;

export class MovementSystem extends System {
    private eventQueue!: EventQueue;
    private rightClickHandler!: EventHandler;
    private turnEndHandler!: EventHandler;

    init(world: World): void {
        super.init(world);
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.rightClickHandler = (event): void => {
            const { x, y } = event as RightClickEvent;
            this.handleRightClick(x, y);
        };

        this.turnEndHandler = (): void => {
            const entities = this.world.getEntitiesWithComponent(MovementComponent);
            for (const entity of entities) {
                const movement = entity.getComponent(MovementComponent);
                if (!movement) continue;
                movement.budgetRemaining = movement.budgetMax;
                movement.displayBudget = movement.budgetMax;
                movement.turnOriginX = null;
                movement.turnOriginY = null;
            }
        };

        this.eventQueue.on(GameEvents.RIGHT_CLICK, this.rightClickHandler);
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
    }

    private handleRightClick(targetX: number, targetY: number): void {
        const entities = this.world.getEntitiesWithComponent(MovementComponent);

        for (const entity of entities) {
            const movement = entity.getComponent(MovementComponent);
            const selectable = entity.getComponent(SelectableComponent);
            const transform = entity.getComponent(TransformComponent);
            if (!movement || !selectable || !transform) continue;

            // Only respond to right-clicks on selected entities
            if (!selectable.selected) continue;

            // Ignore if already moving
            if (movement.moving) continue;

            // Validate distance fits budget and is outside the entity's hit area
            const dx = targetX - transform.x;
            const dy = targetY - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = selectable.hitRadius + 2;

            if (dist < minDist || dist > movement.budgetRemaining) continue;

            // Record turn origin on first move of the turn
            if (movement.turnOriginX === null || movement.turnOriginY === null) {
                movement.turnOriginX = transform.x;
                movement.turnOriginY = transform.y;
            }

            // Initiate movement
            movement.targetX = targetX;
            movement.targetY = targetY;
            movement.moving = true;
            movement.budgetRemaining -= dist;
            movement.facing = Math.atan2(dy, dx);

            // Block turn advancement while moving
            this.eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'movement' });
        }
    }

    update(dt: number): void {
        const entities = this.world.getEntitiesWithComponent(MovementComponent);

        for (const entity of entities) {
            const movement = entity.getComponent(MovementComponent);
            const transform = entity.getComponent(TransformComponent);
            if (!movement || !transform) continue;

            // Animate displayBudget toward budgetRemaining (only after arrival)
            if (!movement.moving && movement.displayBudget !== movement.budgetRemaining) {
                const diff = movement.budgetRemaining - movement.displayBudget;
                const step = DISPLAY_BUDGET_SPEED * dt;
                if (Math.abs(diff) <= step) {
                    movement.displayBudget = movement.budgetRemaining;
                } else {
                    movement.displayBudget += Math.sign(diff) * step;
                }
            }

            // Animate movement toward target
            if (movement.moving && movement.targetX !== null && movement.targetY !== null) {
                const dx = movement.targetX - transform.x;
                const dy = movement.targetY - transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const step = movement.speed * dt;

                if (dist < 1 || step >= dist) {
                    // Snap to target
                    transform.x = movement.targetX;
                    transform.y = movement.targetY;
                    movement.moving = false;
                    movement.targetX = null;
                    movement.targetY = null;

                    this.eventQueue.emit({
                        type: GameEvents.MOVE_COMPLETE,
                        entityId: entity.id,
                    });
                    this.eventQueue.emit({
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
            transform.angle = movement.facing;
        }
    }

    destroy(): void {
        this.eventQueue.off(GameEvents.RIGHT_CLICK, this.rightClickHandler);
        this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
    }
}
