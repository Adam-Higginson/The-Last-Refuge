// ColonyCrewDetailComponent.ts — Crew detail panel for colony view.
// Shows selected colonist's name, role, current activity, morale, traits,
// and relationships inside the colony sidebar.
// Lives on the planet entity.

import './CrewDetailUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { CrewMemberComponent } from './CrewMemberComponent';
import { ColonySceneStateComponent } from './ColonySceneStateComponent';
import { ColonySimulationComponent } from './ColonySimulationComponent';
import { GameModeComponent } from './GameModeComponent';
import type { ColonistActivity } from '../colony/ColonistState';
import type { World } from '../core/World';

const ACTIVITY_LABELS: Record<ColonistActivity, string> = {
    idle: 'IDLE',
    walking: 'WALKING',
    working: 'WORKING',
    socializing: 'SOCIALIZING',
    resting: 'RESTING',
    eating: 'EATING',
    patrolling: 'PATROLLING',
};

const ACTIVITY_COLOURS: Record<ColonistActivity, string> = {
    idle: '#888888',
    walking: '#aaaaaa',
    working: '#c0c8d8',
    socializing: '#66bb6a',
    resting: '#8888cc',
    eating: '#d4b896',
    patrolling: '#4fa8ff',
};

export class ColonyCrewDetailComponent extends Component {
    private panel: HTMLElement | null = null;
    private detailEl: HTMLElement | null = null;
    private lastRenderedEntityId: number | null = null;
    private lastRenderedActivity: ColonistActivity | null = null;
    private onDetailClick: ((e: Event) => void) | null = null;

    init(): void {
        this.panel = document.getElementById('colony-sidebar');
        if (!this.panel) return;

        // Create a container for crew detail that sits inside the sidebar
        this.detailEl = document.createElement('div');
        this.detailEl.id = 'colony-crew-detail';
        this.detailEl.style.display = 'none';
        this.panel.appendChild(this.detailEl);

        // Close button handler
        this.onDetailClick = (e: Event): void => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (target.classList.contains('colony-crew-close')) {
                const state = this.entity.getComponent(ColonySceneStateComponent);
                if (state) state.selectedColonistId = null;
            }
        };
        this.detailEl.addEventListener('click', this.onDetailClick);
    }

    update(_dt: number): void {
        if (!this.detailEl) return;

        // Only active in colony mode
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const gameMode = gameState?.getComponent(GameModeComponent);
        if (!gameMode || gameMode.mode !== 'colony') {
            this.detailEl.style.display = 'none';
            this.lastRenderedEntityId = null;
            return;
        }

        const state = this.entity.getComponent(ColonySceneStateComponent);
        if (!state || state.selectedColonistId === null) {
            this.detailEl.style.display = 'none';
            this.lastRenderedEntityId = null;
            return;
        }

        const entityId = state.selectedColonistId;
        const sim = this.entity.getComponent(ColonySimulationComponent);
        const colonistState = sim?.colonistStates.get(entityId);
        const currentActivity = colonistState?.activity ?? 'idle';

        // Only rebuild if entity or activity changed
        if (this.lastRenderedEntityId === entityId && this.lastRenderedActivity === currentActivity) {
            return;
        }

        this.renderDetail(entityId, currentActivity);
        this.lastRenderedEntityId = entityId;
        this.lastRenderedActivity = currentActivity;
        this.detailEl.style.display = 'block';
    }

    private renderDetail(entityId: number, activity: ColonistActivity): void {
        if (!this.detailEl) return;

        const world = ServiceLocator.get<World>('world');
        const entity = world.getEntity(entityId);
        const crew = entity?.getComponent(CrewMemberComponent);

        if (!crew) {
            this.detailEl.textContent = '';
            const msg = document.createElement('div');
            msg.style.opacity = '0.5';
            msg.textContent = 'Colonist not found.';
            this.detailEl.appendChild(msg);
            return;
        }

        // Build DOM safely — textContent for all data values
        this.detailEl.textContent = '';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'colony-crew-close';
        closeBtn.type = 'button';
        closeBtn.innerHTML = '&times;';
        this.detailEl.appendChild(closeBtn);

        const nameEl = document.createElement('div');
        nameEl.className = 'crew-detail-name';
        nameEl.textContent = crew.fullName;
        this.detailEl.appendChild(nameEl);

        const metaEl = document.createElement('div');
        metaEl.className = 'crew-detail-meta';
        metaEl.textContent = `AGE ${crew.age} \u00B7 ${crew.role.toUpperCase()}`;
        this.detailEl.appendChild(metaEl);

        // Activity badge
        const activityDiv = document.createElement('div');
        activityDiv.className = 'colony-crew-activity';
        const badge = document.createElement('span');
        badge.className = 'colony-activity-badge';
        badge.style.background = ACTIVITY_COLOURS[activity];
        badge.textContent = ACTIVITY_LABELS[activity];
        activityDiv.appendChild(badge);
        this.detailEl.appendChild(activityDiv);

        // Traits
        const traitsDiv = document.createElement('div');
        traitsDiv.className = 'crew-detail-traits';
        for (const trait of crew.traits) {
            const tag = document.createElement('span');
            tag.className = 'crew-trait-tag';
            tag.textContent = trait;
            traitsDiv.appendChild(tag);
        }
        this.detailEl.appendChild(traitsDiv);

        // Morale
        const moraleSection = document.createElement('div');
        moraleSection.className = 'crew-morale-section';
        const moraleLabel = document.createElement('span');
        moraleLabel.className = 'crew-morale-label';
        moraleLabel.textContent = 'MORALE';
        moraleSection.appendChild(moraleLabel);
        const moraleValue = document.createElement('span');
        moraleValue.className = 'crew-morale-value';
        moraleValue.textContent = `${crew.morale} / 100`;
        moraleSection.appendChild(moraleValue);
        const moraleBar = document.createElement('div');
        moraleBar.className = 'crew-morale-bar';
        const moraleFill = document.createElement('div');
        moraleFill.className = 'crew-morale-fill';
        moraleFill.style.width = `${crew.morale}%`;
        moraleFill.style.background = this.getMoraleColour(crew.morale);
        moraleBar.appendChild(moraleFill);
        moraleSection.appendChild(moraleBar);
        this.detailEl.appendChild(moraleSection);

        // Relationships
        const relSection = document.createElement('div');
        relSection.className = 'crew-relationships-section';
        const relHeader = document.createElement('div');
        relHeader.className = 'crew-relationships-header';
        relHeader.textContent = 'RELATIONSHIPS';
        relSection.appendChild(relHeader);

        if (crew.relationships.length > 0) {
            for (const rel of crew.relationships) {
                const row = document.createElement('div');
                row.className = 'crew-relationship-row';
                const relName = document.createElement('span');
                relName.className = 'rel-name';
                relName.textContent = rel.targetName;
                row.appendChild(relName);
                const relType = document.createElement('span');
                relType.className = 'rel-type';
                relType.textContent = rel.type;
                row.appendChild(relType);
                const relDesc = document.createElement('div');
                relDesc.className = 'rel-desc';
                relDesc.textContent = rel.description;
                row.appendChild(relDesc);
                relSection.appendChild(row);
            }
        } else {
            const noRels = document.createElement('div');
            noRels.style.opacity = '0.4';
            noRels.style.fontSize = '11px';
            noRels.textContent = 'No known relationships.';
            relSection.appendChild(noRels);
        }

        this.detailEl.appendChild(relSection);
    }

    private getMoraleColour(morale: number): string {
        if (morale >= 60) return '#44cc66';
        if (morale >= 40) return '#ccaa44';
        return '#cc4444';
    }

    destroy(): void {
        if (this.onDetailClick && this.detailEl) {
            this.detailEl.removeEventListener('click', this.onDetailClick);
        }
        if (this.detailEl && this.detailEl.parentNode) {
            this.detailEl.parentNode.removeChild(this.detailEl);
        }
    }
}
