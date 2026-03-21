// EncounterTriggerComponent.ts — Per-scout proximity detection for Extiris encounters.
// Listens for EXTIRIS_MOVE_COMPLETE (event-driven, not per-frame), then checks
// distance between this scout and the Extiris. If within ENCOUNTER_RADIUS,
// emits ENCOUNTER_TRIGGERED for the EncounterSystem to handle.
//
// Replaces the instant-kill behavior of ScoutDestructionComponent with a
// choice-driven encounter system.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { TransformComponent } from './TransformComponent';
import { ExtirisMovementComponent } from './ExtirisMovementComponent';
import { ScoutDataComponent } from './ScoutDataComponent';
import { ENCOUNTER_RADIUS } from '../data/constants';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';

export class EncounterTriggerComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private moveCompleteHandler: EventHandler | null = null;
    private triggered = false;
    private lastExtirisX: number | null = null;
    private lastExtirisY: number | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.moveCompleteHandler = (): void => {
            this.checkProximity();
        };

        this.eventQueue.on(GameEvents.EXTIRIS_MOVE_COMPLETE, this.moveCompleteHandler);
    }

    private checkProximity(): void {
        // Don't trigger again if already triggered this encounter
        if (this.triggered) return;

        let world: World;
        try {
            world = ServiceLocator.get<World>('world');
        } catch {
            return;
        }

        const extiris = world.getEntityByName('extiris');
        if (!extiris) return;

        const extirisTransform = extiris.getComponent(TransformComponent);
        const scoutTransform = this.entity.getComponent(TransformComponent);
        if (!extirisTransform || !scoutTransform) return;

        // Check final position distance
        const dx = extirisTransform.x - scoutTransform.x;
        const dy = extirisTransform.y - scoutTransform.y;
        let dist = Math.sqrt(dx * dx + dy * dy);

        // Also check if the Extiris passed through the encounter radius
        // during its movement (closest point on the movement segment).
        const movement = extiris.getComponent(ExtirisMovementComponent);
        if (dist > ENCOUNTER_RADIUS && movement && this.lastExtirisX !== null && this.lastExtirisY !== null) {
            dist = this.closestPointOnSegment(
                this.lastExtirisX, this.lastExtirisY,
                extirisTransform.x, extirisTransform.y,
                scoutTransform.x, scoutTransform.y,
            );
        }

        // Record position for next turn's path check
        this.lastExtirisX = extirisTransform.x;
        this.lastExtirisY = extirisTransform.y;

        if (dist > ENCOUNTER_RADIUS) return;

        const scoutData = this.entity.getComponent(ScoutDataComponent);
        if (!scoutData) return;

        this.triggered = true;

        if (this.eventQueue) {
            this.eventQueue.emit({
                type: GameEvents.ENCOUNTER_TRIGGERED,
                scoutEntityId: this.entity.id,
                pilotEntityId: scoutData.pilotEntityId,
                scoutName: scoutData.displayName,
            });
        }
    }

    /** Closest distance from point (px,py) to line segment (ax,ay)→(bx,by). */
    private closestPointOnSegment(
        ax: number, ay: number, bx: number, by: number,
        px: number, py: number,
    ): number {
        const abx = bx - ax;
        const aby = by - ay;
        const lenSq = abx * abx + aby * aby;
        if (lenSq === 0) return Math.sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));

        const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
        const closestX = ax + t * abx;
        const closestY = ay + t * aby;
        return Math.sqrt((px - closestX) * (px - closestX) + (py - closestY) * (py - closestY));
    }

    /** Reset trigger flag — called after encounter resolves to allow future encounters. */
    resetTrigger(): void {
        this.triggered = false;
    }

    destroy(): void {
        if (this.eventQueue && this.moveCompleteHandler) {
            this.eventQueue.off(GameEvents.EXTIRIS_MOVE_COMPLETE, this.moveCompleteHandler);
        }
    }
}
