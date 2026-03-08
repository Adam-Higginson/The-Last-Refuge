// PlanetInfoUIComponent.ts — Planet info panel that slides in from the right.
// Opens when the planet is selected (left-click), closes on deselection.
// Shows planet name, biome summary, colony status, and a VIEW SURFACE button
// that triggers the transition into planet view mode.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { SelectableComponent } from './SelectableComponent';
import { RegionDataComponent } from './RegionDataComponent';
import { TransformComponent } from './TransformComponent';
import { BIOME_DEFINITIONS } from '../data/biomes';
import { COLONISE_RANGE } from '../data/constants';
import type { EventQueue } from '../core/EventQueue';
import type { World } from '../core/World';

export class PlanetInfoUIComponent extends Component {
    panelOpen = false;

    private panel: HTMLElement | null = null;
    private statusDot: HTMLElement | null = null;
    private statusText: HTMLElement | null = null;
    private biomeSummary: HTMLElement | null = null;
    private surfaceBtn: HTMLElement | null = null;
    private surfaceTooltip: HTMLElement | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

    init(): void {
        this.panel = document.getElementById('planet-info-panel');
        if (!this.panel) return;

        this.buildPanelHTML();

        // Escape: deselect planet (closes panel)
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
                <span class="ship-name">NEW TERRA</span>
            </div>
            <hr class="divider">
            <div class="lore-text">
                A habitable world in the temperate zone.
                The last hope for the souls aboard.
            </div>
            <div class="planet-status" style="margin-top:16px">
                <span class="planet-status-dot" id="planet-status-dot"></span>
                <span id="planet-status-text">UNCOLONISED</span>
            </div>
            <div class="planet-biome-summary" id="planet-biome-summary" style="margin-top:12px; font-size:12px; opacity:0.6; line-height:1.8"></div>
            <div id="planet-surface-wrapper" style="margin-top:16px; position:relative">
                <button class="hud-btn" id="planet-view-surface-btn" type="button">VIEW SURFACE</button>
                <div class="surface-tooltip" id="planet-surface-tooltip" style="display:none">Ship must be closer to descend</div>
            </div>
        `;

        this.statusDot = document.getElementById('planet-status-dot');
        this.statusText = document.getElementById('planet-status-text');
        this.biomeSummary = document.getElementById('planet-biome-summary');

        // Close button
        const closeBtn = document.getElementById('planet-panel-close');
        closeBtn?.addEventListener('click', () => {
            const selectable = this.entity.getComponent(SelectableComponent);
            if (selectable) {
                selectable.selected = false;
            }
        });

        // VIEW SURFACE button — emits PLANET_VIEW_ENTER (guarded by disabled state)
        this.surfaceBtn = document.getElementById('planet-view-surface-btn');
        this.surfaceTooltip = document.getElementById('planet-surface-tooltip');
        this.surfaceBtn?.addEventListener('click', () => {
            if (this.surfaceBtn?.classList.contains('disabled')) return;
            const eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
            eventQueue.emit({
                type: GameEvents.PLANET_VIEW_ENTER,
                entityId: this.entity.id,
            });
        });

        // Tooltip hover on wrapper (wrapper still receives events when button has pointer-events: none)
        const surfaceWrapper = document.getElementById('planet-surface-wrapper');
        surfaceWrapper?.addEventListener('mouseenter', () => {
            if (this.surfaceBtn?.classList.contains('disabled') && this.surfaceTooltip) {
                this.surfaceTooltip.style.display = 'block';
            }
        });
        surfaceWrapper?.addEventListener('mouseleave', () => {
            if (this.surfaceTooltip) {
                this.surfaceTooltip.style.display = 'none';
            }
        });

        // Build initial biome summary
        this.updateContent();
    }

    update(_dt: number): void {
        const selectable = this.entity.getComponent(SelectableComponent);
        const selected = selectable?.selected ?? false;

        // Sync panel visibility with selection state
        if (selected && !this.panelOpen) {
            this.openPanel();
        } else if (!selected && this.panelOpen) {
            this.closePanel();
        }

        // Update dynamic content when panel is open
        if (this.panelOpen) {
            this.updateContent();
            this.updateSurfaceButton();
        }
    }

    private openPanel(): void {
        this.panelOpen = true;
        this.panel?.classList.add('open');
    }

    private closePanel(): void {
        this.panelOpen = false;
        this.panel?.classList.remove('open');
    }

    private updateContent(): void {
        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!regionData) return;

        // Colony status
        const isColonised = regionData.colonised;
        if (this.statusDot) {
            this.statusDot.style.background = isColonised ? '#44cc66' : '#ccaa44';
        }
        if (this.statusText) {
            this.statusText.textContent = isColonised ? 'COLONY ESTABLISHED' : 'UNCOLONISED';
        }

        // Biome summary
        if (this.biomeSummary) {
            const counts: Record<string, number> = {};
            for (const region of regionData.regions) {
                counts[region.biome] = (counts[region.biome] ?? 0) + 1;
            }
            const lines = BIOME_DEFINITIONS
                .filter(b => counts[b.name])
                .map(b => `${counts[b.name]} ${b.name.toUpperCase()}`);
            this.biomeSummary.textContent = lines.join(' / ');
        }
    }

    private updateSurfaceButton(): void {
        if (!this.surfaceBtn) return;

        const world = ServiceLocator.get<World>('world');
        const ship = world.getEntityByName('arkSalvage');
        if (!ship) {
            this.surfaceBtn.classList.add('disabled');
            return;
        }

        const shipTransform = ship.getComponent(TransformComponent);
        const planetTransform = this.entity.getComponent(TransformComponent);
        if (!shipTransform || !planetTransform) {
            this.surfaceBtn.classList.add('disabled');
            return;
        }

        const dx = shipTransform.x - planetTransform.x;
        const dy = shipTransform.y - planetTransform.y;
        const inRange = Math.sqrt(dx * dx + dy * dy) <= COLONISE_RANGE;

        if (inRange) {
            this.surfaceBtn.classList.remove('disabled');
        } else {
            this.surfaceBtn.classList.add('disabled');
        }
    }

    destroy(): void {
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown);
        }
    }
}
