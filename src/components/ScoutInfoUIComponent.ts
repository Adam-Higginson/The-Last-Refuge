// ScoutInfoUIComponent.ts — Scout info panel that slides in from the right.
// Shows when a scout is selected. Displays pilot info, status, and actions.

import './ScoutInfoUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { CameraComponent } from './CameraComponent';
import { MovementComponent } from './MovementComponent';
import { ScoutDataComponent } from './ScoutDataComponent';
import { SelectableComponent } from './SelectableComponent';
import { TransformComponent } from './TransformComponent';
import type { World } from '../core/World';

export class ScoutInfoUIComponent extends Component {
    private panel: HTMLElement | null = null;
    private panelOpen = false;
    private lastScoutEntityId: number | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

    init(): void {
        this.panel = document.getElementById('scout-info-panel');

        // Escape: deselect scout when panel is open
        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Escape' && this.panelOpen) {
                const world = ServiceLocator.get<World>('world');
                const scouts = world.getEntitiesWithComponent(ScoutDataComponent);
                for (const scout of scouts) {
                    const sel = scout.getComponent(SelectableComponent);
                    if (sel?.selected) {
                        sel.selected = false;
                        break;
                    }
                }
            }
        };
        window.addEventListener('keydown', this.onKeyDown);
    }

    update(_dt: number): void {
        if (!this.panel) return;

        // Find selected scout
        const world = ServiceLocator.get<World>('world');
        const scouts = world.getEntitiesWithComponent(ScoutDataComponent);
        let selectedScout = null;

        for (const scout of scouts) {
            const sel = scout.getComponent(SelectableComponent);
            if (sel?.selected) {
                selectedScout = scout;
                break;
            }
        }

        if (selectedScout) {
            const needsRebuild = !this.panelOpen || this.lastScoutEntityId !== selectedScout.id;
            this.lastScoutEntityId = selectedScout.id;

            if (needsRebuild) {
                this.buildPanel(world, selectedScout);
            }

            // Update dynamic stats
            this.updateStats(selectedScout);

            if (!this.panelOpen) {
                this.panelOpen = true;
                this.panel.classList.add('open');
            }
        } else if (this.panelOpen) {
            this.panelOpen = false;
            this.lastScoutEntityId = null;
            this.panel.classList.remove('open');
        }
    }

    private buildPanel(world: World, scout: import('../core/Entity').Entity): void {
        if (!this.panel) return;

        const data = scout.getComponent(ScoutDataComponent);
        const movement = scout.getComponent(MovementComponent);
        if (!data) return;

        this.panel.innerHTML = `
            <button class="panel-close-btn" id="scout-panel-close" type="button" title="Close">&times;</button>
            <div class="scout-panel-name">${data.displayName.toUpperCase()}</div>
            <div class="scout-panel-pilot">Pilot: ${data.pilotName}</div>
            <hr class="scout-panel-divider">
            <div class="scout-panel-stat">
                <span>STATUS</span>
                <span class="scout-panel-stat-value" id="scout-stat-status">${movement?.moving ? 'MOVING' : 'IDLE'}</span>
            </div>
            <div class="scout-panel-stat">
                <span>RANGE</span>
                <span class="scout-panel-stat-value" id="scout-stat-range">${Math.round(movement?.budgetRemaining ?? 0)} / ${Math.round(movement?.budgetMax ?? 0)}</span>
            </div>
            <div class="scout-panel-stat">
                <span>WAYPOINTS</span>
                <span class="scout-panel-stat-value" id="scout-stat-waypoints">${movement?.waypointQueue.length ?? 0}</span>
            </div>
            <hr class="scout-panel-divider">
            <button class="hud-btn" id="scout-centre-btn" type="button">CENTRE ON SCOUT</button>
            <button class="hud-btn" id="scout-clear-waypoints-btn" type="button">CLEAR WAYPOINTS</button>
        `;

        this.wireEvents(world, scout);
    }

    private updateStats(scout: import('../core/Entity').Entity): void {
        const movement = scout.getComponent(MovementComponent);
        if (!movement) return;

        const statusEl = document.getElementById('scout-stat-status');
        const rangeEl = document.getElementById('scout-stat-range');
        const waypointsEl = document.getElementById('scout-stat-waypoints');

        if (statusEl) statusEl.textContent = movement.moving ? 'MOVING' : 'IDLE';
        if (rangeEl) rangeEl.textContent = `${Math.round(movement.budgetRemaining)} / ${Math.round(movement.budgetMax)}`;
        if (waypointsEl) waypointsEl.textContent = String(movement.waypointQueue.length);
    }

    private wireEvents(world: World, scout: import('../core/Entity').Entity): void {
        if (!this.panel) return;

        // Close button
        this.panel.querySelector('#scout-panel-close')?.addEventListener('click', () => {
            const sel = scout.getComponent(SelectableComponent);
            if (sel) sel.selected = false;
        });

        // Centre on scout
        this.panel.querySelector('#scout-centre-btn')?.addEventListener('click', () => {
            const transform = scout.getComponent(TransformComponent);
            const cameraEntity = world.getEntityByName('camera');
            const camera = cameraEntity?.getComponent(CameraComponent);
            if (transform && camera) {
                camera.panTo(transform.x, transform.y);
            }
        });

        // Clear waypoints
        this.panel.querySelector('#scout-clear-waypoints-btn')?.addEventListener('click', () => {
            const movement = scout.getComponent(MovementComponent);
            if (movement) {
                movement.waypointQueue = [];
            }
        });
    }

    destroy(): void {
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown);
            this.onKeyDown = null;
        }
    }
}
