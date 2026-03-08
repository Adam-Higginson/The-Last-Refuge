// CrewManifestUIComponent.ts — Scrollable crew manifest list.
// Lives on the ship entity alongside ShipInfoUIComponent.
// Reads activeView from ShipInfoUIComponent to show/hide itself.
// Queries crew entities from the World to build the list.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { CrewMemberComponent } from './CrewMemberComponent';
import { ShipInfoUIComponent } from './ShipInfoUIComponent';
import type { World } from '../core/World';

/** Role sort order for manifest display. */
const ROLE_ORDER: Record<string, number> = {
    Soldier: 0,
    Engineer: 1,
    Medic: 2,
    Scientist: 3,
    Civilian: 4,
};

export class CrewManifestUIComponent extends Component {
    private section: HTMLElement | null = null;
    private listContainer: HTMLElement | null = null;
    private onRowClick: ((e: Event) => void) | null = null;
    private onBackClick: (() => void) | null = null;
    private backBtn: HTMLElement | null = null;

    init(): void {
        this.section = document.getElementById('crew-manifest-section');
        if (!this.section) return;

        this.buildManifestHTML();
    }

    private buildManifestHTML(): void {
        if (!this.section) return;

        const world = ServiceLocator.get<World>('world');
        const crewEntities = world.getEntitiesWithComponent(CrewMemberComponent);

        // Build sorted crew data
        const crewData: { entityId: number; name: string; role: string; morale: number; age: number }[] = [];
        for (const entity of crewEntities) {
            const crew = entity.getComponent(CrewMemberComponent);
            if (!crew) continue;
            crewData.push({
                entityId: entity.id,
                name: crew.fullName,
                role: crew.role,
                morale: crew.morale,
                age: crew.age,
            });
        }

        // Sort by role then name
        crewData.sort((a, b) => {
            const roleA = ROLE_ORDER[a.role] ?? 99;
            const roleB = ROLE_ORDER[b.role] ?? 99;
            if (roleA !== roleB) return roleA - roleB;
            return a.name.localeCompare(b.name);
        });

        // Build HTML
        const rowsHTML = crewData.map(c => {
            const dotColour = this.getMoraleDotColour(c.morale);
            return `<div class="crew-manifest-row" data-entity-id="${c.entityId}">
                <span class="crew-name">${c.name}</span>
                <span class="crew-role">${c.role}</span>
                <span class="crew-morale-dot" style="background:${dotColour}"></span>
                <span class="crew-age">${c.age}</span>
            </div>`;
        }).join('');

        this.section.innerHTML = `
            <button class="panel-back-btn" id="manifest-back-btn" type="button">&#8592; SHIP</button>
            <div style="font-size:13px; color:#ffffff; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">CREW MANIFEST</div>
            <div style="font-size:11px; opacity:0.5; margin-bottom:12px;">${crewData.length} SOULS ABOARD</div>
            <div class="crew-manifest-header">
                <span class="crew-name">NAME</span>
                <span class="crew-role">ROLE</span>
                <span class="crew-morale-dot"></span>
                <span class="crew-age">AGE</span>
            </div>
            <div class="crew-manifest-list" id="crew-manifest-list">${rowsHTML}</div>
        `;

        this.listContainer = document.getElementById('crew-manifest-list');
        this.backBtn = document.getElementById('manifest-back-btn');

        // Delegated click handler on list
        this.onRowClick = (e: Event): void => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            const row = target.closest('.crew-manifest-row') as HTMLElement | null;
            if (!row) return;
            const entityId = row.dataset.entityId;
            if (!entityId) return;

            const shipInfo = this.entity.getComponent(ShipInfoUIComponent);
            if (shipInfo) {
                shipInfo.activeView = 'detail';
                shipInfo.selectedCrewEntityId = parseInt(entityId, 10);
            }
        };
        this.listContainer?.addEventListener('click', this.onRowClick);

        // Back button
        this.onBackClick = (): void => {
            const shipInfo = this.entity.getComponent(ShipInfoUIComponent);
            if (shipInfo) {
                shipInfo.activeView = 'overview';
            }
        };
        this.backBtn?.addEventListener('click', this.onBackClick);
    }

    update(_dt: number): void {
        const shipInfo = this.entity.getComponent(ShipInfoUIComponent);
        if (!shipInfo || !this.section) return;

        if (shipInfo.activeView === 'manifest') {
            this.section.classList.add('active');
        } else {
            this.section.classList.remove('active');
        }
    }

    private getMoraleDotColour(morale: number): string {
        if (morale >= 60) return '#44cc66';
        if (morale >= 40) return '#ccaa44';
        return '#cc4444';
    }

    destroy(): void {
        if (this.onRowClick && this.listContainer) {
            this.listContainer.removeEventListener('click', this.onRowClick);
        }
        if (this.onBackClick && this.backBtn) {
            this.backBtn.removeEventListener('click', this.onBackClick);
        }
    }
}
