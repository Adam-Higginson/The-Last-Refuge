// FleetSidebarComponent.ts — Collapsible fleet management sidebar.
// Shows ship + scout cards on the left side of the screen.
// Collapsed state: thin strip with status dots. Expanded: full cards with actions.

import './FleetSidebarComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { CameraComponent } from './CameraComponent';
import { GameModeComponent } from './GameModeComponent';
import { MovementComponent } from './MovementComponent';
import { ScoutDataComponent } from './ScoutDataComponent';
import { SelectableComponent } from './SelectableComponent';
import { TransformComponent } from './TransformComponent';
import { getCrewCounts } from '../utils/crewUtils';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';

export class FleetSidebarComponent extends Component {
    private container: HTMLElement | null = null;
    private expanded = false;
    private eventQueue: EventQueue | null = null;
    private scoutDestroyedHandler: EventHandler | null = null;
    private dirty = true;

    init(): void {
        this.container = document.getElementById('fleet-sidebar');
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.scoutDestroyedHandler = (): void => {
            this.dirty = true;
        };
        this.eventQueue.on(GameEvents.SCOUT_DESTROYED, this.scoutDestroyedHandler);
    }

    update(_dt: number): void {
        if (!this.container) return;

        // Only show in system mode
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const gameMode = gameState?.getComponent(GameModeComponent);
        if (gameMode && gameMode.mode !== 'system') {
            this.container.style.display = 'none';
            return;
        }
        this.container.style.display = '';

        // Rebuild when dirty (scout destroyed, expanded/collapsed)
        if (this.dirty) {
            this.rebuild(world);
            this.dirty = false;
        }
    }

    private rebuild(world: World): void {
        if (!this.container) return;

        if (this.expanded) {
            this.container.className = 'expanded';
            this.container.innerHTML = this.buildExpanded(world);
        } else {
            this.container.className = 'collapsed';
            this.container.innerHTML = this.buildCollapsed(world);
        }

        this.wireEvents(world);
    }

    private buildCollapsed(world: World): string {
        const scouts = world.getEntitiesWithComponent(ScoutDataComponent);
        let html = '<div class="fleet-strip">';
        html += '<div class="fleet-dot ship-dot" data-fleet-select="arkSalvage" title="ESV-7"></div>';
        for (const scout of scouts) {
            const data = scout.getComponent(ScoutDataComponent);
            html += `<div class="fleet-dot scout-dot" data-fleet-select="${scout.name}" title="${data?.displayName ?? scout.name}"></div>`;
        }
        html += '<button class="fleet-expand-btn" data-fleet-toggle type="button">&#9654;</button>';
        html += '</div>';
        return html;
    }

    private buildExpanded(world: World): string {
        const counts = getCrewCounts(world);
        const scouts = world.getEntitiesWithComponent(ScoutDataComponent);
        const ship = world.getEntityByName('arkSalvage');
        const shipMovement = ship?.getComponent(MovementComponent);

        let html = '<div class="fleet-cards">';

        // Ship card
        html += `
            <div class="fleet-card ship-card" data-fleet-select="arkSalvage">
                <div class="fleet-card-name">ESV-7</div>
                <div class="fleet-card-meta">${counts.ship} souls aboard</div>
                <div class="fleet-card-status ${shipMovement?.moving ? 'moving' : 'active'}">${shipMovement?.moving ? 'MOVING' : 'IDLE'}</div>
            </div>
        `;

        // Scout cards
        for (const scout of scouts) {
            const data = scout.getComponent(ScoutDataComponent);
            const movement = scout.getComponent(MovementComponent);
            const isMoving = movement?.moving ?? false;
            const status = isMoving ? 'MOVING' : 'IDLE';
            const statusClass = isMoving ? 'moving' : 'active';

            html += `
                <div class="fleet-card scout-card" data-fleet-select="${scout.name}">
                    <div class="fleet-card-name">${data?.displayName ?? scout.name}</div>
                    <div class="fleet-card-meta">${data?.pilotName ?? 'No pilot'}</div>
                    <div class="fleet-card-status ${statusClass}">${status}</div>
                    <button class="fleet-card-btn" data-fleet-return="${scout.name}" type="button">RETURN</button>
                </div>
            `;
        }

        // Recall all button
        if (scouts.length > 0) {
            html += '<button class="fleet-recall-btn" data-fleet-recall-all type="button">RECALL ALL</button>';
        }

        html += '<button class="fleet-collapse-btn" data-fleet-toggle type="button">&#9664; COLLAPSE</button>';
        html += '</div>';
        return html;
    }

    private wireEvents(world: World): void {
        if (!this.container) return;

        // Toggle expand/collapse
        for (const btn of this.container.querySelectorAll('[data-fleet-toggle]')) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.expanded = !this.expanded;
                this.dirty = true;
            });
        }

        // Select + centre on entity
        for (const el of this.container.querySelectorAll('[data-fleet-select]')) {
            el.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).hasAttribute('data-fleet-return')) return;
                if ((e.target as HTMLElement).hasAttribute('data-fleet-toggle')) return;
                const entityName = (el as HTMLElement).dataset.fleetSelect;
                if (!entityName) return;
                this.selectAndCentre(world, entityName);
            });
        }

        // Return to ship
        for (const btn of this.container.querySelectorAll('[data-fleet-return]')) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const scoutName = (btn as HTMLElement).dataset.fleetReturn;
                if (scoutName) this.returnScoutToShip(world, scoutName);
            });
        }

        // Recall all
        this.container.querySelector('[data-fleet-recall-all]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.recallAll(world);
        });
    }

    private selectAndCentre(world: World, entityName: string): void {
        const entity = world.getEntityByName(entityName);
        if (!entity) return;

        // Select this entity, deselect all others
        const selectables = world.getEntitiesWithComponent(SelectableComponent);
        for (const other of selectables) {
            const sel = other.getComponent(SelectableComponent);
            if (sel) sel.selected = other === entity;
        }

        // Centre camera
        const transform = entity.getComponent(TransformComponent);
        const cameraEntity = world.getEntityByName('camera');
        const camera = cameraEntity?.getComponent(CameraComponent);
        if (transform && camera) {
            camera.panTo(transform.x, transform.y);
        }

        this.eventQueue?.emit({
            type: GameEvents.ENTITY_CLICK,
            entityId: entity.id,
            entityName: entity.name,
        });
    }

    private returnScoutToShip(world: World, scoutName: string): void {
        const scout = world.getEntityByName(scoutName);
        const ship = world.getEntityByName('arkSalvage');
        if (!scout || !ship) return;

        const shipTransform = ship.getComponent(TransformComponent);
        if (!shipTransform) return;

        this.issueScoutMove(world, scout, shipTransform.x, shipTransform.y);
    }

    private recallAll(world: World): void {
        const ship = world.getEntityByName('arkSalvage');
        const shipTransform = ship?.getComponent(TransformComponent);
        if (!shipTransform) return;

        const scouts = world.getEntitiesWithComponent(ScoutDataComponent);
        for (const scout of scouts) {
            this.issueScoutMove(world, scout, shipTransform.x, shipTransform.y);
        }
    }

    /** Select a scout and emit a targeted RIGHT_CLICK, draining between each
     *  so the MovementComponent processes the move before selection changes. */
    private issueScoutMove(
        world: World,
        scout: import('../core/Entity').Entity,
        x: number,
        y: number,
    ): void {
        // Select just this scout
        const selectables = world.getEntitiesWithComponent(SelectableComponent);
        for (const other of selectables) {
            const sel = other.getComponent(SelectableComponent);
            if (sel) sel.selected = other === scout;
        }

        // Emit and immediately drain so MovementComponent picks it up
        // before the next scout's selection overwrites this one
        this.eventQueue?.emit({
            type: GameEvents.RIGHT_CLICK,
            x,
            y,
        });
        const eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        eventQueue.drain();
    }

    destroy(): void {
        if (this.eventQueue && this.scoutDestroyedHandler) {
            this.eventQueue.off(GameEvents.SCOUT_DESTROYED, this.scoutDestroyedHandler);
        }
    }
}
