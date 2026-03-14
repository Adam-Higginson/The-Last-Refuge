// ColonyViewTransitionComponent.ts — Drives the fade transition between
// planet surface view and colony scene. Listens for COLONY_VIEW_ENTER/EXIT
// events, animates GameModeComponent.transitionProgress, and toggles UI.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { GameModeComponent } from './GameModeComponent';
import type { EventQueue, GameEvent } from '../core/EventQueue';

/** Colony transition is faster than system-to-planet (less dramatic). */
const COLONY_TRANSITION_DURATION = 1.0;

export class ColonyViewTransitionComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private onEnter: ((e: GameEvent) => void) | null = null;
    private onExit: ((e: GameEvent) => void) | null = null;
    private turnBlocked = false;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.onEnter = (e: GameEvent): void => {
            const gameMode = this.entity.getComponent(GameModeComponent);
            if (!gameMode || gameMode.mode !== 'planet') return;

            const event = e as GameEvent & { entityId: number; regionId: number };
            gameMode.mode = 'transitioning-to-colony';
            gameMode.transitionProgress = 0;
            gameMode.transitionDuration = COLONY_TRANSITION_DURATION;
            gameMode.planetEntityId = event.entityId;
            gameMode.colonyRegionId = event.regionId;

            this.blockTurn();
        };

        this.onExit = (): void => {
            const gameMode = this.entity.getComponent(GameModeComponent);
            if (!gameMode || gameMode.mode !== 'colony') return;

            gameMode.mode = 'transitioning-to-planet-from-colony';
            gameMode.transitionProgress = 0;
            gameMode.transitionDuration = COLONY_TRANSITION_DURATION;

            this.blockTurn();
        };

        this.eventQueue.on(GameEvents.COLONY_VIEW_ENTER, this.onEnter);
        this.eventQueue.on(GameEvents.COLONY_VIEW_EXIT, this.onExit);
    }

    update(dt: number): void {
        const gameMode = this.entity.getComponent(GameModeComponent);
        if (!gameMode) return;

        if (gameMode.mode === 'transitioning-to-colony') {
            gameMode.transitionProgress += dt / gameMode.transitionDuration;

            if (gameMode.transitionProgress >= 1) {
                gameMode.transitionProgress = 1;
                gameMode.mode = 'colony';
                this.unblockTurn();
            }
        } else if (gameMode.mode === 'transitioning-to-planet-from-colony') {
            gameMode.transitionProgress += dt / gameMode.transitionDuration;

            if (gameMode.transitionProgress >= 1) {
                gameMode.transitionProgress = 1;
                gameMode.mode = 'planet';
                gameMode.colonyRegionId = null;
                this.unblockTurn();
            }
        }
    }

    private blockTurn(): void {
        if (!this.turnBlocked && this.eventQueue) {
            this.eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'colonyTransition' });
            this.turnBlocked = true;
        }
    }

    private unblockTurn(): void {
        if (this.turnBlocked && this.eventQueue) {
            this.eventQueue.emit({ type: GameEvents.TURN_UNBLOCK, key: 'colonyTransition' });
            this.turnBlocked = false;
        }
    }

    destroy(): void {
        if (this.eventQueue) {
            if (this.onEnter) this.eventQueue.off(GameEvents.COLONY_VIEW_ENTER, this.onEnter);
            if (this.onExit) this.eventQueue.off(GameEvents.COLONY_VIEW_EXIT, this.onExit);
        }
    }
}
