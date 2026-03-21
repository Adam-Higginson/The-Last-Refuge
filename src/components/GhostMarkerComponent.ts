// GhostMarkerComponent.ts — Faint memorial marker at the location where a scout was destroyed.
// Renders as a small X with the pilot's name, fading over 10 turns.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

const FADE_TURNS = 10;

export class GhostMarkerComponent extends Component {
    pilotName: string;
    turnsRemaining: number;

    private eventQueue: EventQueue | null = null;
    private turnEndHandler: EventHandler | null = null;

    constructor(pilotName: string) {
        super();
        this.pilotName = pilotName;
        this.turnsRemaining = FADE_TURNS;
    }

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        this.turnEndHandler = (): void => {
            this.turnsRemaining--;
            if (this.turnsRemaining <= 0) {
                try {
                    const world = ServiceLocator.get<import('../core/World').World>('world');
                    world.removeEntity(this.entity.id);
                } catch {
                    // Graceful
                }
            }
        };
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
    }

    destroy(): void {
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
    }
}

export { FADE_TURNS };
