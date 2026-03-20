// EventSummaryOverlay.ts — Turn summary overlay shown after turn resolution
// in colony view. Registered as a service via ServiceLocator.
// Shows system-level events the player would miss while in colony view.

import './EventSummaryOverlay.css';

export interface TurnSummaryEvent {
    text: string;
    critical: boolean;
}

export class EventSummaryOverlay {
    private backdrop: HTMLElement | null = null;
    private dismissTimer: ReturnType<typeof setTimeout> | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private isOpen = false;

    show(turnNumber: number, events: TurnSummaryEvent[]): void {
        // If already open, dismiss previous immediately
        if (this.isOpen) {
            this.dismissImmediate();
        }

        this.ensureDOM();
        this.render(turnNumber, events);
        this.isOpen = true;

        // Force a reflow before adding 'open' so the CSS transition fires
        if (this.backdrop) {
            void this.backdrop.offsetHeight;
            this.backdrop.classList.add('open');
        }

        // Keyboard dismiss
        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Escape') {
                e.stopPropagation();
                this.dismiss();
            }
        };
        window.addEventListener('keydown', this.onKeyDown, true);

        // Auto-dismiss timer
        const hasCritical = events.some(ev => ev.critical);
        const noEvents = events.length === 0;
        let timeout = 5000;
        if (noEvents) {
            timeout = 2000;
        } else if (hasCritical) {
            // No auto-dismiss for critical events
            timeout = 0;
        }

        if (timeout > 0) {
            this.dismissTimer = setTimeout(() => {
                this.dismiss();
            }, timeout);
        }
    }

    destroy(): void {
        this.dismissImmediate();
    }

    private dismiss(): void {
        this.clearTimer();
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown, true);
            this.onKeyDown = null;
        }

        if (this.backdrop) {
            this.backdrop.classList.add('fading-out');
            this.backdrop.classList.remove('open');

            // Remove after fade-out transition completes
            const el = this.backdrop;
            setTimeout(() => {
                el.remove();
            }, 300);
            this.backdrop = null;
        }
        this.isOpen = false;
    }

    private dismissImmediate(): void {
        this.clearTimer();
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown, true);
            this.onKeyDown = null;
        }
        if (this.backdrop) {
            this.backdrop.remove();
            this.backdrop = null;
        }
        this.isOpen = false;
    }

    private clearTimer(): void {
        if (this.dismissTimer !== null) {
            clearTimeout(this.dismissTimer);
            this.dismissTimer = null;
        }
    }

    private ensureDOM(): void {
        if (this.backdrop && document.body.contains(this.backdrop)) return;

        this.backdrop = document.createElement('div');
        this.backdrop.className = 'event-summary-backdrop';
        document.body.appendChild(this.backdrop);

        // Click anywhere to dismiss
        this.backdrop.addEventListener('click', () => {
            this.dismiss();
        });
    }

    private render(turnNumber: number, events: TurnSummaryEvent[]): void {
        if (!this.backdrop) return;

        if (events.length === 0) {
            this.backdrop.innerHTML = `
                <div class="event-summary-box">
                    <div class="event-summary-quiet">TURN ${turnNumber} COMPLETE &mdash; All quiet.</div>
                </div>
            `;
            return;
        }

        const listItems = events.map(ev => {
            const cls = ev.critical ? ' class="critical"' : '';
            return `<li${cls}>${this.escapeHtml(ev.text)}</li>`;
        }).join('');

        this.backdrop.innerHTML = `
            <div class="event-summary-box">
                <div class="event-summary-header">TURN ${turnNumber} COMPLETE</div>
                <ul class="event-summary-list">${listItems}</ul>
            </div>
        `;
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
