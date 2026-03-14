// TransferScreenComponent.ts — Full-screen crew roster and transfer overlay.
// Shows location cards, multi-select crew list, and transfer action bar.
// Accessible via CREW button in HUD. Lives on the HUD entity.

import './TransferScreenComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { CrewMemberComponent } from './CrewMemberComponent';
import {
    getCrewAtShip,
    getCrewAtColony,
    getCrewCounts,
    getShipRoleCounts,
    getColonyLocations,
    getLocationLabel,
    checkShipMinimums,
} from '../utils/crewUtils';
import type { CrewLocation, CrewRole } from './CrewMemberComponent';
import type { EventQueue } from '../core/EventQueue';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

export class TransferScreenComponent extends Component {
    isOpen = false;

    private container: HTMLElement | null = null;
    private selectedCrewIds = new Set<number>();
    private viewingLocation: CrewLocation = { type: 'ship' };
    private detailCrewId: number | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

    init(): void {
        this.container = document.getElementById('transfer-screen');
    }

    /** Open the transfer screen. */
    open(): void {
        if (!this.container) return;
        this.isOpen = true;
        this.selectedCrewIds.clear();
        this.viewingLocation = { type: 'ship' };
        this.detailCrewId = null;
        this.rebuild();
        this.container.classList.add('open');

        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Escape') {
                if (this.detailCrewId !== null) {
                    this.detailCrewId = null;
                    this.rebuild();
                } else {
                    this.close();
                }
            }
        };
        window.addEventListener('keydown', this.onKeyDown);
    }

    /** Close the transfer screen. */
    close(): void {
        if (!this.container) return;
        this.isOpen = false;
        this.container.classList.remove('open');
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown);
            this.onKeyDown = null;
        }
    }

    /** Full rebuild of the transfer screen HTML. */
    private rebuild(): void {
        if (!this.container) return;
        const world = ServiceLocator.get<World>('world');

        const hasSelection = this.selectedCrewIds.size > 0;
        const viewLabel = getLocationLabel(world, this.viewingLocation);

        this.container.innerHTML = `
            <div class="transfer-header">
                <h1>CREW ROSTER</h1>
                <button class="hud-btn" id="transfer-close">← BACK</button>
            </div>
            <div class="transfer-main">
                <div class="transfer-locations">
                    <div class="locations-title">Locations</div>
                    ${this.buildLocationCards(world)}
                </div>
                <div class="transfer-roster">
                    <div class="roster-header">
                        <div>
                            <span class="roster-title">${viewLabel}</span>
                            <span class="roster-count"> — ${this.getCrewAtViewing(world).length} assigned</span>
                        </div>
                        ${hasSelection ? `<div class="selection-info">${this.selectedCrewIds.size} selected</div>` : ''}
                    </div>
                    <div class="roster-list">
                        ${this.buildCrewRows(world)}
                    </div>
                </div>
                ${this.detailCrewId !== null ? this.buildDetailPanel(world) : ''}
            </div>
            <div class="transfer-bar ${hasSelection ? 'has-selection' : ''}">
                <div class="transfer-info ${hasSelection ? 'active' : ''}">
                    ${hasSelection
                        ? `${this.selectedCrewIds.size} crew selected — tap a destination to transfer`
                        : 'Select crew members to transfer'}
                </div>
                <div class="transfer-actions">
                    ${hasSelection ? '<button class="transfer-btn cancel-btn" id="transfer-clear">CLEAR</button>' : ''}
                </div>
            </div>
        `;

        this.wireEvents(world);
    }

    private buildLocationCards(world: World): string {
        const counts = getCrewCounts(world);
        const shipRoles = getShipRoleCounts(world);
        const minimums = checkShipMinimums(world);
        const colonies = getColonyLocations(world);
        const hasSelection = this.selectedCrewIds.size > 0;

        const isViewingShip = this.viewingLocation.type === 'ship';

        let html = `
            <div class="location-card ${isViewingShip ? 'active' : ''} ${hasSelection && !isViewingShip ? 'transfer-target' : ''}"
                 data-loc="ship">
                <div class="location-name">ESV-7 (SHIP)</div>
                <div class="location-meta">${counts.ship} crew assigned</div>
                <div class="location-roles">
                    <span class="role-badge ${!minimums.engineersOk ? 'warning' : ''}">ENG ${shipRoles.Engineer}</span>
                    <span class="role-badge ${!minimums.soldiersOk ? 'warning' : ''}">SOL ${shipRoles.Soldier}</span>
                    <span class="role-badge">MED ${shipRoles.Medic}</span>
                    <span class="role-badge">SCI ${shipRoles.Scientist}</span>
                    <span class="role-badge">CIV ${shipRoles.Civilian}</span>
                </div>
            </div>
        `;

        for (const colony of colonies) {
            const isViewing = this.viewingLocation.type === 'colony'
                && this.viewingLocation.planetEntityId === colony.planetEntityId
                && this.viewingLocation.regionId === colony.regionId;

            const colonyCrew = getCrewAtColony(world, colony.planetEntityId, colony.regionId);
            const colonyRoles = this.countRoles(colonyCrew);

            html += `
                <div class="location-card ${isViewing ? 'active' : ''} ${hasSelection && !isViewing ? 'transfer-target' : ''}"
                     data-loc="colony" data-planet="${colony.planetEntityId}" data-region="${colony.regionId}">
                    <div class="location-name">${colony.label}</div>
                    <div class="location-meta">${colony.count} crew assigned</div>
                    <div class="location-roles">
                        ${Object.entries(colonyRoles)
                            .filter(([_, v]) => v > 0)
                            .map(([k, v]) => `<span class="role-badge">${k.slice(0, 3).toUpperCase()} ${v}</span>`)
                            .join('')}
                    </div>
                </div>
            `;
        }

        return html;
    }

    private buildCrewRows(world: World): string {
        const crew = this.getCrewAtViewing(world);

        return crew.map(entity => {
            const c = entity.getComponent(CrewMemberComponent);
            if (!c) return '';

            const isSelected = this.selectedCrewIds.has(entity.id);
            const moraleClass = c.morale >= 60 ? 'morale-high' : c.morale >= 30 ? 'morale-mid' : 'morale-low';

            return `
                <div class="crew-row ${isSelected ? 'selected' : ''}" data-crew-id="${entity.id}">
                    <div class="crew-checkbox ${isSelected ? 'checked' : ''}" data-checkbox="${entity.id}">${isSelected ? '✓' : ''}</div>
                    <div class="crew-name" data-detail="${entity.id}">${c.fullName}</div>
                    <div class="crew-role">${c.role}</div>
                    <div class="crew-morale-dot ${moraleClass}"></div>
                    <div class="crew-age">${c.age}</div>
                </div>
            `;
        }).join('');
    }

    private wireEvents(world: World): void {
        if (!this.container) return;

        // Close button
        this.container.querySelector('#transfer-close')?.addEventListener('click', () => {
            this.close();
        });

        // Clear selection
        this.container.querySelector('#transfer-clear')?.addEventListener('click', () => {
            this.selectedCrewIds.clear();
            this.rebuild();
        });

        // Checkbox clicks (toggle selection)
        for (const cb of this.container.querySelectorAll('.crew-checkbox')) {
            cb.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number((cb as HTMLElement).dataset.checkbox);
                if (this.selectedCrewIds.has(id)) {
                    this.selectedCrewIds.delete(id);
                } else {
                    this.selectedCrewIds.add(id);
                }
                this.rebuild();
            });
        }

        // Name clicks (open detail)
        for (const name of this.container.querySelectorAll('.crew-name')) {
            name.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = Number((name as HTMLElement).dataset.detail);
                this.detailCrewId = id;
                this.rebuild();
            });
        }

        // Detail panel close
        this.container.querySelector('#detail-close')?.addEventListener('click', () => {
            this.detailCrewId = null;
            this.rebuild();
        });

        // Relationship clicks — navigate to that person's detail
        for (const rel of this.container.querySelectorAll('.detail-relationship')) {
            rel.addEventListener('click', () => {
                const targetId = Number((rel as HTMLElement).dataset.relTarget);
                if (targetId) {
                    this.detailCrewId = targetId;
                    this.rebuild();
                }
            });
        }

        // Location card clicks
        for (const card of this.container.querySelectorAll('.location-card')) {
            card.addEventListener('click', () => {
                const el = card as HTMLElement;
                const locType = el.dataset.loc;

                if (locType === 'ship') {
                    if (this.selectedCrewIds.size > 0 && this.viewingLocation.type !== 'ship') {
                        this.transferSelected({ type: 'ship' }, world);
                    } else {
                        this.viewingLocation = { type: 'ship' };
                        this.selectedCrewIds.clear();
                        this.rebuild();
                    }
                } else if (locType === 'colony') {
                    const planetId = Number(el.dataset.planet);
                    const regionId = Number(el.dataset.region);
                    const colonyLoc: CrewLocation = { type: 'colony', planetEntityId: planetId, regionId };

                    if (this.selectedCrewIds.size > 0 && !this.isViewingThis(colonyLoc)) {
                        this.transferSelected(colonyLoc, world);
                    } else {
                        this.viewingLocation = colonyLoc;
                        this.selectedCrewIds.clear();
                        this.rebuild();
                    }
                }
            });
        }
    }

    private buildDetailPanel(world: World): string {
        if (this.detailCrewId === null) return '';

        const entity = world.getEntity(this.detailCrewId);
        const c = entity?.getComponent(CrewMemberComponent);
        if (!c) return '';

        const moraleClass = c.morale >= 60 ? 'morale-high' : c.morale >= 30 ? 'morale-mid' : 'morale-low';
        const moraleWidth = Math.max(0, Math.min(100, c.morale));
        const locationLabel = getLocationLabel(world, c.location);

        const relationshipRows = c.relationships.map(r =>
            `<div class="detail-relationship" data-rel-target="${r.targetId}">
                <span class="detail-rel-name">${r.targetName}</span>
                <span class="detail-rel-type">${r.type}</span>
                <div class="detail-rel-desc">${r.description}</div>
            </div>`,
        ).join('');

        return `
            <div class="crew-detail-panel">
                <button class="hud-btn" id="detail-close" type="button">← BACK</button>
                <div class="detail-name">${c.fullName}</div>
                <div class="detail-meta">${c.role} — AGE ${c.age}</div>
                <div class="detail-location">ASSIGNED: ${locationLabel}</div>
                <hr class="divider">
                <div class="detail-section-title">MORALE</div>
                <div class="detail-morale-bar">
                    <div class="detail-morale-fill ${moraleClass}" style="width:${moraleWidth}%"></div>
                </div>
                <div class="detail-morale-value">${c.morale}/100</div>
                <div class="detail-section-title">TRAITS</div>
                <div class="detail-traits">
                    ${c.traits.map(t => `<span class="detail-trait">${t}</span>`).join('')}
                </div>
                ${c.relationships.length > 0 ? `
                    <div class="detail-section-title">RELATIONSHIPS</div>
                    <div class="detail-relationships">${relationshipRows}</div>
                ` : ''}
            </div>
        `;
    }

    private transferSelected(destination: CrewLocation, world: World): void {
        const eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        let count = 0;

        for (const id of this.selectedCrewIds) {
            const entity = world.getEntity(id);
            const crew = entity?.getComponent(CrewMemberComponent);
            if (crew) {
                crew.location = destination;
                count++;
            }
        }

        if (count > 0) {
            eventQueue.emit({ type: GameEvents.CREW_TRANSFERRED, count });
        }

        this.selectedCrewIds.clear();
        this.rebuild();
    }

    private getCrewAtViewing(world: World): Entity[] {
        if (this.viewingLocation.type === 'ship') {
            return getCrewAtShip(world);
        }
        return getCrewAtColony(
            world,
            this.viewingLocation.planetEntityId,
            this.viewingLocation.regionId,
        );
    }

    private isViewingThis(loc: CrewLocation): boolean {
        if (loc.type !== this.viewingLocation.type) return false;
        if (loc.type === 'ship') return true;
        if (this.viewingLocation.type !== 'colony') return false;
        return loc.planetEntityId === this.viewingLocation.planetEntityId
            && loc.regionId === this.viewingLocation.regionId;
    }

    private countRoles(entities: Entity[]): Record<CrewRole, number> {
        const counts: Record<CrewRole, number> = { Engineer: 0, Soldier: 0, Medic: 0, Scientist: 0, Civilian: 0 };
        for (const e of entities) {
            const c = e.getComponent(CrewMemberComponent);
            if (c) counts[c.role]++;
        }
        return counts;
    }

    destroy(): void {
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown);
        }
    }
}
