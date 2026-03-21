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
import { ScoutDataComponent } from './ScoutDataComponent';
import { ENCOUNTER_RADIUS } from '../data/constants';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';

export class EncounterTriggerComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private moveCompleteHandler: EventHandler | null = null;
    private triggered = false;

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

        const dx = extirisTransform.x - scoutTransform.x;
        const dy = extirisTransform.y - scoutTransform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

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
