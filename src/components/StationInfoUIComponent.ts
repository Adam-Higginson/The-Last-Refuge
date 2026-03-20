// StationInfoUIComponent.ts — Station info panel that slides in from the right.
// Shows when the station is selected. Displays status, repair controls, and actions.
// Follows ScoutInfoUIComponent pattern.

import './StationInfoUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { CameraComponent } from './CameraComponent';
import { SelectableComponent } from './SelectableComponent';
import { StationDataComponent } from './StationDataComponent';
import { StationRepairComponent } from './StationRepairComponent';
import { TransformComponent } from './TransformComponent';
import { VisibilitySourceComponent } from './VisibilitySourceComponent';
import { ResourceComponent } from './ResourceComponent';
import { STATION_FOG_BLIP_RADIUS } from '../data/constants';
import type { World } from '../core/World';

export class StationInfoUIComponent extends Component {
    private panel: HTMLElement | null = null;
    private panelOpen = false;
    private lastRepairState: string | null = null;
    private lastTurnsRemaining = -1;

    init(): void {
        this.panel = document.getElementById('station-info-panel');
    }

    update(_dt: number): void {
        if (!this.panel) return;

        const selectable = this.entity.getComponent(SelectableComponent);
        const stationData = this.entity.getComponent(StationDataComponent);

        if (!selectable || !stationData) return;

        // Only show when selected and discovered
        if (selectable.selected && stationData.discovered) {
            const needsRebuild = !this.panelOpen
                || this.lastRepairState !== stationData.repairState
                || this.lastTurnsRemaining !== stationData.repairTurnsRemaining;

            if (needsRebuild) {
                this.lastRepairState = stationData.repairState;
                this.lastTurnsRemaining = stationData.repairTurnsRemaining;
                this.buildPanel(stationData);
            }

            if (!this.panelOpen) {
                this.panelOpen = true;
                this.panel.classList.add('open');
            }
        } else if (this.panelOpen) {
            this.panelOpen = false;
            this.lastRepairState = null;
            this.panel.classList.remove('open');
        }
    }

    private buildPanel(stationData: StationDataComponent): void {
        if (!this.panel) return;

        let world: World;
        try {
            world = ServiceLocator.get<World>('world');
        } catch {
            return;
        }

        let statusSection = '';
        const statusLabel = stationData.repairState.toUpperCase();

        if (stationData.repairState === 'discovered') {
            // Check proximity and affordability
            const canAfford = this.canAffordRepair(world, stationData);
            const hasNearby = this.hasNearbySource(world);
            const canRepair = canAfford && hasNearby;

            let hint = '';
            if (!hasNearby) {
                hint = 'Move ship or scout closer';
            } else if (!canAfford) {
                hint = `Need ${stationData.repairCost} materials`;
            }

            statusSection = `
                <div class="station-panel-stat">
                    <span>COST</span>
                    <span class="station-panel-stat-value">${stationData.repairCost} Materials</span>
                </div>
                <div class="station-panel-stat">
                    <span>TIME</span>
                    <span class="station-panel-stat-value">${stationData.repairTurnsTotal} turns</span>
                </div>
                <button class="station-repair-btn" id="station-repair-btn" type="button"
                    ${canRepair ? '' : 'disabled'}>BEGIN REPAIRS</button>
                ${hint ? `<div class="station-repair-hint">${hint}</div>` : ''}
            `;
        } else if (stationData.repairState === 'repairing') {
            const done = stationData.repairTurnsTotal - stationData.repairTurnsRemaining;
            const pct = (done / stationData.repairTurnsTotal) * 100;
            statusSection = `
                <div class="station-panel-progress">
                    <div class="station-progress-bar">
                        <div class="station-progress-fill" style="width: ${pct}%"></div>
                    </div>
                    <div class="station-progress-label">${done} / ${stationData.repairTurnsTotal} TURNS</div>
                </div>
            `;
        } else if (stationData.repairState === 'repaired') {
            statusSection = `
                <div class="station-status-operational">&#9673; STATION OPERATIONAL</div>
                <div class="station-sensor-info">Sensor range: ${STATION_FOG_BLIP_RADIUS} wu</div>
            `;
        }

        this.panel.innerHTML = `
            <button class="panel-close-btn" id="station-panel-close" type="button" title="Close">&times;</button>
            <div class="station-panel-name">${stationData.displayName.toUpperCase()}</div>
            <div class="station-panel-subtitle">Abandoned Mining Station</div>
            <hr class="station-panel-divider">
            <div class="station-panel-stat">
                <span>STATUS</span>
                <span class="station-panel-stat-value">${statusLabel}</span>
            </div>
            <hr class="station-panel-divider">
            <div class="station-panel-lore">"A Keth mining relay, gutted but intact. The hull bears scorch marks from an Extiris sweep."</div>
            <hr class="station-panel-divider">
            ${statusSection}
            <button class="hud-btn" id="station-centre-btn" type="button">CENTRE ON STATION</button>
        `;

        this.wireEvents(world);
    }

    private wireEvents(world: World): void {
        if (!this.panel) return;

        this.panel.querySelector('#station-panel-close')?.addEventListener('click', () => {
            const sel = this.entity.getComponent(SelectableComponent);
            if (sel) sel.selected = false;
        });

        this.panel.querySelector('#station-centre-btn')?.addEventListener('click', () => {
            const transform = this.entity.getComponent(TransformComponent);
            const cameraEntity = world.getEntityByName('camera');
            const camera = cameraEntity?.getComponent(CameraComponent);
            if (transform && camera) {
                camera.panTo(transform.x, transform.y);
            }
        });

        this.panel.querySelector('#station-repair-btn')?.addEventListener('click', () => {
            const repair = this.entity.getComponent(StationRepairComponent);
            repair?.startRepair();
        });
    }

    private canAffordRepair(world: World, stationData: StationDataComponent): boolean {
        const gameState = world.getEntityByName('gameState');
        const resources = gameState?.getComponent(ResourceComponent);
        if (!resources) return false;
        return resources.canAfford('materials', stationData.repairCost);
    }

    private hasNearbySource(world: World): boolean {
        const stationTransform = this.entity.getComponent(TransformComponent);
        if (!stationTransform) return false;

        const sources = world.getEntitiesWithComponent(VisibilitySourceComponent);
        for (const sourceEntity of sources) {
            const vis = sourceEntity.getComponent(VisibilitySourceComponent);
            const sourceTransform = sourceEntity.getComponent(TransformComponent);
            if (!vis || !sourceTransform || !vis.active) continue;

            const dx = sourceTransform.x - stationTransform.x;
            const dy = sourceTransform.y - stationTransform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= vis.effectiveDetailRadius) {
                return true;
            }
        }
        return false;
    }

    destroy(): void {
        // Event listeners cleaned up by DOM removal
    }
}
