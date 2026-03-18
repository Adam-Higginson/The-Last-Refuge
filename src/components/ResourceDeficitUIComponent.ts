// ResourceDeficitUIComponent.ts — Red vignette overlay when resources hit 0.
// Shows resource-specific alert text on RESOURCE_DEFICIT events.
// Fades out after a turn with no deficit.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import type { ResourceDeficitEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

const DEFICIT_MESSAGES: Record<string, string> = {
    food: 'FOOD SUPPLIES CRITICAL',
    energy: 'ENERGY GRID FAILURE',
    materials: 'MATERIAL RESERVES DEPLETED',
};

export class ResourceDeficitUIComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private deficitHandler: EventHandler | null = null;
    private turnEndHandler: EventHandler | null = null;

    private overlayEl: HTMLElement | null = null;
    private alertTextEl: HTMLElement | null = null;

    /** Whether any deficit fired this turn. Reset on TURN_END. */
    private deficitThisTurn = false;
    /** Fade timer for hiding the overlay. */
    private fadeTimer = 0;

    init(): void {
        if (!ServiceLocator.has('world')) return;
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        // Red vignette overlay
        this.overlayEl = document.createElement('div');
        this.overlayEl.id = 'resource-deficit-overlay';
        this.overlayEl.style.cssText = `
            position: fixed; inset: 0; pointer-events: none; z-index: 99;
            box-shadow: inset 0 0 100px rgba(200, 30, 30, 0);
            transition: box-shadow 0.4s ease;
        `;
        document.body.appendChild(this.overlayEl);

        // Alert text
        this.alertTextEl = document.createElement('div');
        this.alertTextEl.id = 'resource-deficit-text';
        this.alertTextEl.style.cssText = `
            position: fixed; top: 45%; left: 50%; transform: translate(-50%, -50%);
            color: #dd3333; font-family: monospace; font-size: 28px; font-weight: bold;
            letter-spacing: 6px; text-transform: uppercase;
            opacity: 0; pointer-events: none; z-index: 100;
            text-shadow: 0 0 16px rgba(200,30,30,0.5), 0 0 32px rgba(200,30,30,0.25);
        `;
        document.body.appendChild(this.alertTextEl);

        this.deficitHandler = (event): void => {
            const e = event as ResourceDeficitEvent;
            this.showAlert(e.resource);
        };
        this.eventQueue.on(GameEvents.RESOURCE_DEFICIT, this.deficitHandler);

        this.turnEndHandler = (): void => {
            if (!this.deficitThisTurn) {
                this.hideAlert();
            }
            this.deficitThisTurn = false;
        };
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
    }

    private showAlert(resource: string): void {
        this.deficitThisTurn = true;
        this.fadeTimer = 3.0;

        const message = DEFICIT_MESSAGES[resource] ?? 'RESOURCE CRITICAL';

        if (this.overlayEl) {
            this.overlayEl.style.boxShadow = 'inset 0 0 100px rgba(200, 30, 30, 0.45)';
        }
        if (this.alertTextEl) {
            this.alertTextEl.textContent = message;
            this.alertTextEl.style.opacity = '1';
        }
    }

    private hideAlert(): void {
        if (this.overlayEl) {
            this.overlayEl.style.boxShadow = 'inset 0 0 100px rgba(200, 30, 30, 0)';
        }
        if (this.alertTextEl) {
            this.alertTextEl.style.opacity = '0';
        }
    }

    update(dt: number): void {
        if (this.fadeTimer > 0) {
            this.fadeTimer -= dt;
            if (this.fadeTimer <= 0) {
                this.hideAlert();
            }
        }
    }

    destroy(): void {
        if (this.eventQueue && this.deficitHandler) {
            this.eventQueue.off(GameEvents.RESOURCE_DEFICIT, this.deficitHandler);
        }
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
        this.overlayEl?.remove();
        this.alertTextEl?.remove();
    }
}
