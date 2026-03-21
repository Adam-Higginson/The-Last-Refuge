// ScoutDeathUIComponent.ts — Death notification overlay for destroyed scouts.
// Shows pilot name and brief memorial text when a scout is destroyed.

import './ScoutDeathUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import type { ScoutDestroyedEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

export class ScoutDeathUIComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private destroyedHandler: EventHandler | null = null;
    private overlayEl: HTMLElement | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.overlayEl = document.createElement('div');
        this.overlayEl.id = 'scout-death-overlay';
        document.body.appendChild(this.overlayEl);

        this.destroyedHandler = (event): void => {
            const { casualties, pilotName } = event as ScoutDestroyedEvent;
            const names = casualties.length > 0 ? casualties : [pilotName];
            this.showNotification(names);
        };
        this.eventQueue.on(GameEvents.SCOUT_DESTROYED, this.destroyedHandler);
    }

    private showNotification(casualties: string[]): void {
        if (!this.overlayEl) return;

        const namesText = casualties.map(n => n.toUpperCase()).join(', ');

        const notification = document.createElement('div');
        notification.className = 'scout-death-notification';
        notification.innerHTML = `
            <div class="pilot-name">${namesText}</div>
            <div class="death-text">LOST IN THE LINE OF DUTY</div>
        `;
        this.overlayEl.appendChild(notification);

        // Flash the overlay with cyan-amber vignette
        this.overlayEl.style.boxShadow = 'inset 0 0 80px rgba(64, 200, 200, 0.3)';
        setTimeout(() => {
            if (this.overlayEl) {
                this.overlayEl.style.boxShadow = 'none';
            }
        }, 1000);

        // Remove notification after animation completes
        setTimeout(() => {
            notification.remove();
        }, 4200);
    }

    destroy(): void {
        if (this.eventQueue && this.destroyedHandler) {
            this.eventQueue.off(GameEvents.SCOUT_DESTROYED, this.destroyedHandler);
        }
        this.overlayEl?.remove();
    }
}
