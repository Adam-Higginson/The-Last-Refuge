// ColonistMovement.ts — Walking and patrol movement logic for colonists.
// Extracted from ColonistManager.ts for module separation.

import { GameEvents } from '../core/GameEvents';
import type { ColonistActivity, ColonistVisualState } from './ColonistState';
import type { EventQueue } from '../core/EventQueue';

/** Emit state change event. */
export function emitActivityChanged(
    eventQueue: EventQueue,
    entityId: number,
    from: ColonistActivity,
    to: ColonistActivity,
    gridX: number,
    gridY: number,
): void {
    eventQueue.emit({
        type: GameEvents.COLONIST_ACTIVITY_CHANGED,
        entityId,
        from,
        to,
        gridX,
        gridY,
    });
}

/** Emit arrival event. */
export function emitArrived(
    eventQueue: EventQueue,
    entityId: number,
    gridX: number,
    gridY: number,
    buildingSlot?: number,
): void {
    eventQueue.emit({
        type: GameEvents.COLONIST_ARRIVED,
        entityId,
        gridX,
        gridY,
        buildingSlot,
    });
}

/** Advance a walking colonist along their A* path. */
export function updateWalking(
    colonist: ColonistVisualState,
    dt: number,
    eventQueue: EventQueue,
    destinationActivity: ColonistActivity,
): void {
    if (colonist.pathIndex >= colonist.path.length) {
        // Arrived
        const oldActivity = colonist.activity;
        colonist.activity = destinationActivity;
        colonist.path = [];
        colonist.pathIndex = 0;
        emitActivityChanged(eventQueue, colonist.entityId, oldActivity, destinationActivity, colonist.gridX, colonist.gridY);
        emitArrived(eventQueue, colonist.entityId, colonist.gridX, colonist.gridY);
        return;
    }

    const target = colonist.path[colonist.pathIndex];
    const dx = target.gridX - colonist.gridX;
    const dy = target.gridY - colonist.gridY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.05) {
        colonist.gridX = target.gridX;
        colonist.gridY = target.gridY;
        colonist.pathIndex++;
        return;
    }

    const moveAmount = colonist.walkSpeed * dt;
    if (moveAmount >= dist) {
        colonist.gridX = target.gridX;
        colonist.gridY = target.gridY;
        colonist.pathIndex++;
    } else {
        colonist.gridX += (dx / dist) * moveAmount;
        colonist.gridY += (dy / dist) * moveAmount;
    }

    // Update facing direction
    colonist.facingDirection = Math.atan2(dy, dx);
    colonist.walkPhase += dt * 8;
}

/** Update soldier patrol — walk the perimeter loop. */
export function updatePatrol(
    colonist: ColonistVisualState,
    perimeterPath: { gridX: number; gridY: number }[],
    dt: number,
    eventQueue: EventQueue,
): void {
    if (colonist.activity !== 'patrolling') {
        const oldActivity = colonist.activity;
        colonist.activity = 'patrolling';

        // Find closest perimeter point to start
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < perimeterPath.length; i++) {
            const p = perimeterPath[i];
            const dx = p.gridX - colonist.gridX;
            const dy = p.gridY - colonist.gridY;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        colonist.pathIndex = bestIdx;
        emitActivityChanged(eventQueue, colonist.entityId, oldActivity, 'patrolling', colonist.gridX, colonist.gridY);
    }

    const target = perimeterPath[colonist.pathIndex % perimeterPath.length];
    if (!target) return;

    const dx = target.gridX - colonist.gridX;
    const dy = target.gridY - colonist.gridY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.05) {
        colonist.gridX = target.gridX;
        colonist.gridY = target.gridY;
        colonist.pathIndex = (colonist.pathIndex + 1) % perimeterPath.length;
    } else {
        const moveAmount = colonist.walkSpeed * dt;
        if (moveAmount >= dist) {
            colonist.gridX = target.gridX;
            colonist.gridY = target.gridY;
            colonist.pathIndex = (colonist.pathIndex + 1) % perimeterPath.length;
        } else {
            colonist.gridX += (dx / dist) * moveAmount;
            colonist.gridY += (dy / dist) * moveAmount;
        }
    }

    colonist.facingDirection = Math.atan2(dy, dx);
    colonist.walkPhase += dt * 8;
}
