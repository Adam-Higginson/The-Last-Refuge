// CrewDetailUIComponent.ts — Individual crew member detail panel.
// Lives on the ship entity alongside ShipInfoUIComponent.
// Reads activeView and selectedCrewEntityId from ShipInfoUIComponent
// to decide when to show and which crew member to display.

import './CrewDetailUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { CrewMemberComponent } from './CrewMemberComponent';
import { ShipInfoUIComponent } from './ShipInfoUIComponent';
import { RelationshipGraphComponent } from './RelationshipGraphComponent';
import { getRelationshipColour } from '../utils/colourUtils';
import type { World } from '../core/World';

export class CrewDetailUIComponent extends Component {
    private section: HTMLElement | null = null;
    private lastRenderedEntityId: number | null = null;

    private onSectionClick: ((e: Event) => void) | null = null;

    init(): void {
        this.section = document.getElementById('crew-detail-section');
        if (!this.section) return;

        // Delegated click handler for back button and relationship names
        this.onSectionClick = (e: Event): void => {
            const target = e.target as HTMLElement | null;
            if (!target) return;

            // Back button
            if (target.id === 'detail-back-btn' || target.closest('#detail-back-btn')) {
                const shipInfo = this.entity.getComponent(ShipInfoUIComponent);
                if (shipInfo) {
                    shipInfo.activeView = 'manifest';
                    shipInfo.selectedCrewEntityId = null;
                }
                return;
            }

            // "View in Graph" link click
            const graphLink = target.closest('.rel-graph-link') as HTMLElement | null;
            if (graphLink) {
                const focusId = graphLink.dataset.focusId;
                if (focusId) {
                    const world = ServiceLocator.get<World>('world');
                    const hud = world.getEntityByName('hud');
                    const graph = hud?.getComponent(RelationshipGraphComponent);
                    if (graph) {
                        graph.open(parseInt(focusId, 10));
                    }
                }
                return;
            }

            // Relationship name click — navigate to that crew member
            const relName = target.closest('.rel-name') as HTMLElement | null;
            if (relName) {
                const entityId = relName.dataset.entityId;
                if (entityId) {
                    const shipInfo = this.entity.getComponent(ShipInfoUIComponent);
                    if (shipInfo) {
                        shipInfo.selectedCrewEntityId = parseInt(entityId, 10);
                    }
                }
            }
        };
        this.section.addEventListener('click', this.onSectionClick);
    }

    update(_dt: number): void {
        const shipInfo = this.entity.getComponent(ShipInfoUIComponent);
        if (!shipInfo || !this.section) return;

        if (shipInfo.activeView === 'detail' && shipInfo.selectedCrewEntityId !== null) {
            this.section.classList.add('active');

            // Only rebuild if selected entity changed
            if (this.lastRenderedEntityId !== shipInfo.selectedCrewEntityId) {
                this.renderCrewDetail(shipInfo.selectedCrewEntityId);
                this.lastRenderedEntityId = shipInfo.selectedCrewEntityId;
            }
        } else {
            this.section.classList.remove('active');
            if (shipInfo.activeView !== 'detail') {
                this.lastRenderedEntityId = null;
            }
        }
    }

    private renderCrewDetail(entityId: number): void {
        if (!this.section) return;

        const world = ServiceLocator.get<World>('world');
        const entity = world.getEntity(entityId);
        if (!entity) {
            this.section.innerHTML = '<div style="opacity:0.5">Crew member not found.</div>';
            return;
        }

        const crew = entity.getComponent(CrewMemberComponent);
        if (!crew) {
            this.section.innerHTML = '<div style="opacity:0.5">Crew member not found.</div>';
            return;
        }

        const traitsHTML = crew.traits
            .map(t => `<span class="crew-trait-tag">${t}</span>`)
            .join('');

        const moraleColour = this.getMoraleColour(crew.morale);
        const moraleWidth = crew.morale; // morale is 0-100 scale

        const relationshipsHTML = crew.relationships.length > 0
            ? crew.relationships.map(rel => {
                const levelColour = getRelationshipColour(rel.level);
                return `<div class="crew-relationship-row">
                    <div class="rel-header">
                        <span class="rel-name" data-entity-id="${rel.targetId}">${rel.targetName}</span>
                        <span class="rel-type">${rel.type}</span>
                        <span class="rel-level-value" style="color:${levelColour}">${rel.level}</span>
                    </div>
                    <div class="rel-level-bar">
                        <div class="rel-level-fill" style="width:${rel.level}%; background:${levelColour};"></div>
                    </div>
                    <div class="rel-desc">${rel.description}</div>
                    <span class="rel-graph-link" data-focus-id="${entityId}">View in Graph</span>
                </div>`;
            }).join('')
            : '<div style="opacity:0.4; font-size:11px;">No known relationships.</div>';

        this.section.innerHTML = `
            <button class="panel-back-btn" id="detail-back-btn" type="button">&#8592; MANIFEST</button>
            <div class="crew-detail-name">${crew.fullName}</div>
            <div class="crew-detail-meta">AGE ${crew.age} &middot; ${crew.role.toUpperCase()}</div>
            <div class="crew-detail-traits">${traitsHTML}</div>
            <div class="crew-morale-section">
                <span class="crew-morale-label">MORALE</span>
                <span class="crew-morale-value">${crew.morale} / 100</span>
                <div class="crew-morale-bar">
                    <div class="crew-morale-fill" style="width:${moraleWidth}%; background:${moraleColour};"></div>
                </div>
            </div>
            <div class="crew-relationships-section">
                <div class="crew-relationships-header">RELATIONSHIPS</div>
                ${relationshipsHTML}
            </div>
        `;
    }

    private getMoraleColour(morale: number): string {
        if (morale >= 60) return '#44cc66';
        if (morale >= 40) return '#ccaa44';
        return '#cc4444';
    }

    destroy(): void {
        if (this.onSectionClick && this.section) {
            this.section.removeEventListener('click', this.onSectionClick);
        }
    }
}
