// EventSummaryComponent.ts — Collects system-level events during turn resolution
// and shows an overlay summary when a turn completes while in colony view.
// Lives on the 'gameState' entity.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import type { EventQueue, GameEvent } from '../core/EventQueue';
import type { EventSummaryOverlay, TurnSummaryEvent } from '../ui/EventSummaryOverlay';
import type { TurnEndEvent, BuildingCompletedEvent, ScoutDestroyedEvent, ResourceDeficitEvent } from '../core/GameEvents';
import { GameModeComponent } from './GameModeComponent';
import { BUILDING_TYPES } from '../data/buildings';
import type { BuildingId } from '../data/buildings';

export class EventSummaryComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private pendingEvents: TurnSummaryEvent[] = [];
    private collecting = false;

    // Bound handlers for cleanup
    private handleTurnAdvance: ((e: GameEvent) => void) | null = null;
    private handleTurnEnd: ((e: GameEvent) => void) | null = null;
    private handleBuildingCompleted: ((e: GameEvent) => void) | null = null;
    private handleScoutDestroyed: ((e: GameEvent) => void) | null = null;
    private handleExtirisDetectedPlayer: ((e: GameEvent) => void) | null = null;
    private handleExtirisDetectedScout: ((e: GameEvent) => void) | null = null;
    private handleResourceDeficit: ((e: GameEvent) => void) | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.handleTurnAdvance = (): void => {
            this.pendingEvents = [];
            this.collecting = true;
        };

        this.handleTurnEnd = (e: GameEvent): void => {
            if (!this.collecting) return;
            this.collecting = false;

            // Only show overlay when in colony mode
            const gameMode = this.getGameMode();
            if (!gameMode || gameMode.mode !== 'colony') {
                this.pendingEvents = [];
                return;
            }

            const turnEvent = e as TurnEndEvent;
            const overlay = ServiceLocator.get<EventSummaryOverlay>('eventSummaryOverlay');
            overlay.show(turnEvent.turn, this.pendingEvents);
            this.pendingEvents = [];
        };

        this.handleBuildingCompleted = (e: GameEvent): void => {
            if (!this.collecting) return;
            const buildingId = (e as BuildingCompletedEvent).buildingId;
            const bt = BUILDING_TYPES[buildingId as BuildingId];
            const name = bt ? bt.name : buildingId;
            this.pendingEvents.push({
                text: `${name} completed construction`,
                critical: false,
            });
        };

        this.handleScoutDestroyed = (e: GameEvent): void => {
            if (!this.collecting) return;
            const { casualties, pilotName } = e as ScoutDestroyedEvent;
            const names = casualties.length > 0 ? casualties.join(', ') : pilotName;
            this.pendingEvents.push({
                text: `\u26A0 Scout destroyed — ${names} KIA!`,
                critical: true,
            });
        };

        this.handleExtirisDetectedPlayer = (): void => {
            if (!this.collecting) return;
            this.pendingEvents.push({
                text: '\u26A0 EXTIRIS DETECTED',
                critical: true,
            });
        };

        this.handleExtirisDetectedScout = (): void => {
            if (!this.collecting) return;
            this.pendingEvents.push({
                text: '\u26A0 Scout detected by Extiris',
                critical: true,
            });
        };

        this.handleResourceDeficit = (e: GameEvent): void => {
            if (!this.collecting) return;
            const resource = (e as ResourceDeficitEvent).resource;
            this.pendingEvents.push({
                text: `\u26A0 ${resource} in deficit`,
                critical: true,
            });
        };

        this.eventQueue.on(GameEvents.TURN_ADVANCE, this.handleTurnAdvance);
        this.eventQueue.on(GameEvents.TURN_END, this.handleTurnEnd);
        this.eventQueue.on(GameEvents.BUILDING_COMPLETED, this.handleBuildingCompleted);
        this.eventQueue.on(GameEvents.SCOUT_DESTROYED, this.handleScoutDestroyed);
        this.eventQueue.on(GameEvents.EXTIRIS_DETECTED_PLAYER, this.handleExtirisDetectedPlayer);
        this.eventQueue.on(GameEvents.EXTIRIS_DETECTED_SCOUT, this.handleExtirisDetectedScout);
        this.eventQueue.on(GameEvents.RESOURCE_DEFICIT, this.handleResourceDeficit);
    }

    destroy(): void {
        if (this.eventQueue) {
            if (this.handleTurnAdvance) this.eventQueue.off(GameEvents.TURN_ADVANCE, this.handleTurnAdvance);
            if (this.handleTurnEnd) this.eventQueue.off(GameEvents.TURN_END, this.handleTurnEnd);
            if (this.handleBuildingCompleted) this.eventQueue.off(GameEvents.BUILDING_COMPLETED, this.handleBuildingCompleted);
            if (this.handleScoutDestroyed) this.eventQueue.off(GameEvents.SCOUT_DESTROYED, this.handleScoutDestroyed);
            if (this.handleExtirisDetectedPlayer) this.eventQueue.off(GameEvents.EXTIRIS_DETECTED_PLAYER, this.handleExtirisDetectedPlayer);
            if (this.handleExtirisDetectedScout) this.eventQueue.off(GameEvents.EXTIRIS_DETECTED_SCOUT, this.handleExtirisDetectedScout);
            if (this.handleResourceDeficit) this.eventQueue.off(GameEvents.RESOURCE_DEFICIT, this.handleResourceDeficit);
        }
    }

    private getGameMode(): GameModeComponent | null {
        // GameModeComponent lives on the same entity (gameState)
        return this.entity.getComponent(GameModeComponent);
    }
}
