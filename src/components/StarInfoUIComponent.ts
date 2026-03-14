// StarInfoUIComponent.ts — Star info panel that slides in from the right.
// Opens when the star is selected (left-click), closes on deselection.
// Shows star name, lore, and classification. Reuses #planet-info-panel.

import './PlanetInfoUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { SelectableComponent } from './SelectableComponent';
import { TransformComponent } from './TransformComponent';
import { CameraComponent } from './CameraComponent';
import type { World } from '../core/World';

/** Star display name. */
const STAR_NAME = 'Solace';

/** Star lore text. */
const STAR_LORE = 'A warm G-type star. The crew named it Solace — a beacon of hope in an unfamiliar sky. Its light sustains New Terra and warms the inner worlds.';

/** Star classification. */
const STAR_TYPE = 'G-Type Main Sequence Star';

export class StarInfoUIComponent extends Component {
    panelOpen = false;

    private panel: HTMLElement | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

    init(): void {
        this.panel = document.getElementById('planet-info-panel');
        if (!this.panel) return;

        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Escape' && this.panelOpen) {
                const selectable = this.entity.getComponent(SelectableComponent);
                if (selectable) {
                    selectable.selected = false;
                }
            }
        };

        window.addEventListener('keydown', this.onKeyDown);
    }

    private buildPanelHTML(): void {
        if (!this.panel) return;

        this.panel.innerHTML = `
            <button class="panel-close-btn" id="planet-panel-close" type="button" title="Close">&times;</button>
            <div class="ship-name-row">
                <span class="ship-name">${STAR_NAME.toUpperCase()}</span>
            </div>
            <hr class="divider">
            <div class="lore-text">
                ${STAR_LORE}
            </div>
            <div class="planet-stats">
                <div>TYPE: ${STAR_TYPE.toUpperCase()}</div>
                <div>Surface temp 5,800K. Luminosity 1.0 solar.</div>
            </div>
            <div style="margin-top:16px">
                <button class="hud-btn" id="star-centre-btn" type="button">CENTRE ON SOLACE</button>
            </div>
        `;

        const closeBtn = document.getElementById('planet-panel-close');
        closeBtn?.addEventListener('click', () => {
            const selectable = this.entity.getComponent(SelectableComponent);
            if (selectable) {
                selectable.selected = false;
            }
        });

        // CENTRE button — pan camera to star
        const centreBtn = document.getElementById('star-centre-btn');
        centreBtn?.addEventListener('click', () => {
            const world = ServiceLocator.get<World>('world');
            const starTransform = this.entity.getComponent(TransformComponent);
            const cameraEntity = world.getEntityByName('camera');
            const camera = cameraEntity?.getComponent(CameraComponent);
            if (starTransform && camera) {
                camera.panTo(starTransform.x, starTransform.y);
            }
        });
    }

    update(_dt: number): void {
        const selectable = this.entity.getComponent(SelectableComponent);
        const selected = selectable?.selected ?? false;

        if (selected && !this.panelOpen) {
            this.panelOpen = true;
            this.buildPanelHTML();
            this.panel?.classList.add('open');
        } else if (!selected && this.panelOpen) {
            this.panelOpen = false;
            this.panel?.classList.remove('open');
        }
    }

    destroy(): void {
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown);
        }
    }
}
