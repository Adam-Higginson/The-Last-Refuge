// PlanetInfoUIComponent.ts — Planet info panel that slides in from the right.
// Opens when the planet is selected (left-click), closes on deselection.
// Shows planet name, biome summary, colony status, and a VIEW SURFACE button
// that triggers the transition into planet view mode.

import './PlanetInfoUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { SelectableComponent } from './SelectableComponent';
import { RegionDataComponent } from './RegionDataComponent';
import { PlanetDataComponent } from './PlanetDataComponent';
import { TransformComponent } from './TransformComponent';
import { CameraComponent } from './CameraComponent';
import { getBiomePool } from '../data/biomes';
import type { EventQueue } from '../core/EventQueue';
import type { World } from '../core/World';

export class PlanetInfoUIComponent extends Component {
    panelOpen = false;

    private panel: HTMLElement | null = null;
    private statusDot: HTMLElement | null = null;
    private statusText: HTMLElement | null = null;
    private biomeSummary: HTMLElement | null = null;
    private surfaceBtn: HTMLElement | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

    init(): void {
        this.panel = document.getElementById('planet-info-panel');
        if (!this.panel) return;

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

        const planetData = this.entity.getComponent(PlanetDataComponent);
        const config = planetData?.config;
        const displayName = config?.displayName ?? 'UNKNOWN';
        const loreText = config?.lore ?? 'An uncharted world.';
        const isRocky = config?.type === 'rocky';
        const typeLabel = isRocky ? 'Rocky World' : 'Gas Giant';
        const surfaceConditions = config?.surfaceConditions ?? '';
        const atmosphericComposition = config?.atmosphericComposition ?? '';

        this.panel.innerHTML = `
            <button class="panel-close-btn" id="planet-panel-close" type="button" title="Close">&times;</button>
            <div class="ship-name-row">
                <span class="ship-name">${displayName.toUpperCase()}</span>
            </div>
            <hr class="divider">
            <div class="lore-text">
                ${loreText}
            </div>
            <div class="planet-stats">
                <div>TYPE: ${typeLabel.toUpperCase()}</div>
                ${surfaceConditions ? `<div>${surfaceConditions}</div>` : ''}
                ${atmosphericComposition ? `<div>ATMOSPHERE: ${atmosphericComposition}</div>` : ''}
            </div>
            ${isRocky ? `
            <div class="planet-status" style="margin-top:16px">
                <span class="planet-status-dot" id="planet-status-dot"></span>
                <span id="planet-status-text">UNCOLONISED</span>
            </div>
            <div class="planet-biome-summary" id="planet-biome-summary" style="margin-top:12px; font-size:12px; opacity:0.6; line-height:1.8"></div>
            ` : ''}
            <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px">
                <button class="hud-btn" id="planet-view-surface-btn" type="button">${isRocky ? 'VIEW SURFACE' : 'VIEW ATMOSPHERE'}</button>
                <button class="hud-btn" id="planet-centre-btn" type="button">CENTRE ON ${displayName.toUpperCase()}</button>
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

        // VIEW SURFACE button — emits PLANET_VIEW_ENTER (always enabled)
        this.surfaceBtn = document.getElementById('planet-view-surface-btn');
        this.surfaceBtn?.addEventListener('click', () => {
            const eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
            eventQueue.emit({
                type: GameEvents.PLANET_VIEW_ENTER,
                entityId: this.entity.id,
            });
        });

        // CENTRE button — pan camera to this planet
        const centreBtn = document.getElementById('planet-centre-btn');
        centreBtn?.addEventListener('click', () => {
            const world = ServiceLocator.get<World>('world');
            const planetTransform = this.entity.getComponent(TransformComponent);
            const cameraEntity = world.getEntityByName('camera');
            const camera = cameraEntity?.getComponent(CameraComponent);
            if (planetTransform && camera) {
                camera.panTo(planetTransform.x, planetTransform.y);
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
        }
    }

    private openPanel(): void {
        this.panelOpen = true;
        this.buildPanelHTML();
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

        // Biome summary — use planet-specific biome pool
        if (this.biomeSummary) {
            const planetData = this.entity.getComponent(PlanetDataComponent);
            const pool = planetData?.config.biomePool ?? 'habitable';
            const poolDefs = getBiomePool(pool);

            const counts: Record<string, number> = {};
            for (const region of regionData.regions) {
                counts[region.biome] = (counts[region.biome] ?? 0) + 1;
            }
            const lines = poolDefs
                .filter(b => counts[b.name])
                .map(b => `${counts[b.name]} ${b.name.toUpperCase()}`);
            this.biomeSummary.textContent = lines.join(' / ');
        }
    }

    destroy(): void {
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown);
        }
    }
}
