// detailPanelBuilder.ts — Shared HTML builder for crew detail panels.
// Used by both TransferScreenComponent (roster detail) and
// RelationshipGraphComponent (graph detail sidebar).

import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { getRelationshipColour } from './colourUtils';
import { getLocationLabel } from './crewUtils';
import { getLeaderBonusLines } from '../data/leaderBonuses';
import { FOOD_PER_PERSON } from '../data/resources';
import {
    getColonyLeader,
    getShipCaptain,
    appointLeader,
    appointCaptain,
} from './leaderUtils';
import { GameEvents } from '../core/GameEvents';
import { ServiceLocator } from '../core/ServiceLocator';
import type { EventQueue } from '../core/EventQueue';
import type { World } from '../core/World';

export interface DetailPanelOptions {
    showAppoint: boolean;
    showViewInGraph: boolean;
}

export interface DetailPanelCallbacks {
    onNavigate: (entityId: number) => void;
    onAppoint: () => void;
    onViewInGraph?: (entityId: number) => void;
}

/** Build the HTML for a crew detail panel. */
export function buildCrewDetail(world: World, entityId: number, options: DetailPanelOptions): string {
    const entity = world.getEntity(entityId);
    const c = entity?.getComponent(CrewMemberComponent);
    if (!c || !entity) return '';

    const moraleClass = c.morale >= 60 ? 'morale-high' : c.morale >= 30 ? 'morale-mid' : 'morale-low';
    const moraleWidth = Math.max(0, Math.min(100, c.morale));
    const locationLabel = getLocationLabel(world, c.location);

    // Contributions
    const contributions = [`-${FOOD_PER_PERSON} food/turn`];

    // Leader/captain bonuses
    const bonusLines = getLeaderBonusLines(c.role, c.traits);

    const renderBonusLines = (prefix: string): string =>
        bonusLines.map(line => {
            const cls = line.sentiment === 'negative' ? 'negative' : line.sentiment === 'positive' ? 'active' : 'potential';
            return `<div class="detail-bonus ${cls}">${prefix} ${line.text}</div>`;
        }).join('');

    let leaderSection: string;
    if (c.isLeader) {
        leaderSection = `
            <div class="detail-section-title">LEADER BONUSES (ACTIVE)</div>
            <div class="detail-bonus-list">${renderBonusLines('\u2713')}</div>
        `;
    } else if (c.isCaptain) {
        leaderSection = `
            <div class="detail-section-title">CAPTAIN BONUSES (ACTIVE)</div>
            <div class="detail-bonus-list">${renderBonusLines('\u2713')}</div>
        `;
    } else {
        const appointLabel = c.location.type === 'ship' ? 'CAPTAIN' : 'LEADER';
        leaderSection = options.showAppoint ? `
            <div class="detail-section-title">IF APPOINTED AS ${appointLabel}</div>
            <div class="detail-bonus-list">${renderBonusLines('\u2192')}</div>
            <button class="hud-btn detail-appoint-btn" data-entity-id="${entityId}" type="button" style="margin-top:8px">
                APPOINT AS ${appointLabel}
            </button>
        ` : `
            <div class="detail-section-title">IF APPOINTED AS ${appointLabel}</div>
            <div class="detail-bonus-list">${renderBonusLines('\u2192')}</div>
        `;
    }

    // Relationships with cross-location badges
    const relationshipRows = c.relationships.map(r => {
        const levelColour = getRelationshipColour(r.level);

        // Cross-location badge: show where target is if different from this crew member
        let crossLocBadge = '';
        const targetEntity = world.getEntity(r.targetId);
        const targetCrew = targetEntity?.getComponent(CrewMemberComponent);
        if (targetCrew) {
            const sameLocation = c.location.type === targetCrew.location.type
                && (c.location.type === 'ship'
                    || (c.location.type === 'colony' && targetCrew.location.type === 'colony'
                        && c.location.planetEntityId === targetCrew.location.planetEntityId
                        && c.location.regionId === targetCrew.location.regionId));
            if (!sameLocation) {
                crossLocBadge = `<span class="detail-rel-location">[${getLocationLabel(world, targetCrew.location)}]</span>`;
            }
        }

        return `<div class="detail-relationship" data-rel-target="${r.targetId}">
            <span class="detail-rel-name">${r.targetName}</span>
            <span class="detail-rel-type">${r.type}</span>
            <span style="font-size:10px; color:${levelColour}; margin-left:4px;">${r.level}</span>
            ${crossLocBadge}
            <div class="detail-rel-desc">${r.description}</div>
        </div>`;
    }).join('');

    const viewInGraphBtn = options.showViewInGraph
        ? `<button class="hud-btn detail-view-in-graph-btn" data-entity-id="${entityId}" type="button" style="margin-top:12px">VIEW IN GRAPH</button>`
        : '';

    return `
        <div class="detail-name">
            ${c.fullName}
            ${c.isLeader ? '<span class="badge badge--leader">LEADER</span>' : ''}
            ${c.isCaptain ? '<span class="badge badge--captain">CAPTAIN</span>' : ''}
        </div>
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
        ${c.backstory ? `
            <div class="detail-section-title">BACKSTORY</div>
            <div class="detail-backstory">${c.backstory}</div>
        ` : ''}
        <div class="detail-section-title">CONTRIBUTIONS</div>
        <div class="detail-bonus-list">
            ${contributions.map(d => `<div class="detail-bonus negative">${d}</div>`).join('')}
        </div>
        ${leaderSection}
        ${c.relationships.length > 0 ? `
            <div class="detail-section-title">RELATIONSHIPS</div>
            <div class="detail-relationships">${relationshipRows}</div>
        ` : ''}
        ${viewInGraphBtn}
    `;
}

/** Wire event handlers on a rendered detail panel. */
export function wireDetailEvents(
    container: HTMLElement,
    world: World,
    callbacks: DetailPanelCallbacks,
): void {
    // Relationship clicks — navigate to that person's detail
    for (const rel of container.querySelectorAll('.detail-relationship')) {
        rel.addEventListener('click', () => {
            const targetId = Number((rel as HTMLElement).dataset.relTarget);
            if (targetId) {
                callbacks.onNavigate(targetId);
            }
        });
    }

    // Appoint button
    const appointBtn = container.querySelector('.detail-appoint-btn') as HTMLElement | null;
    appointBtn?.addEventListener('click', () => {
        const crewEntityId = Number(appointBtn.dataset.entityId);
        if (!crewEntityId) return;

        const crewEntity = world.getEntity(crewEntityId);
        const crew = crewEntity?.getComponent(CrewMemberComponent);
        if (!crew) return;

        const isShip = crew.location.type === 'ship';
        const roleLabel = isShip ? 'Captain' : 'Colony Leader';
        const newBonuses = getLeaderBonusLines(crew.role, crew.traits);

        const msgLines: string[] = [];
        msgLines.push(`APPOINT ${crew.fullName.toUpperCase()} AS ${roleLabel.toUpperCase()}?`);
        msgLines.push('');

        let currentHolder: CrewMemberComponent | null = null;
        if (isShip) {
            const cap = getShipCaptain(world);
            currentHolder = cap?.getComponent(CrewMemberComponent) ?? null;
        } else if (crew.location.type === 'colony') {
            const lead = getColonyLeader(world, crew.location.planetEntityId, crew.location.regionId);
            currentHolder = lead?.getComponent(CrewMemberComponent) ?? null;
        }

        if (currentHolder) {
            msgLines.push(`Replaces: ${currentHolder.fullName}`);
            msgLines.push('');
            const oldBonuses = getLeaderBonusLines(currentHolder.role, currentHolder.traits);
            for (const b of oldBonuses) {
                msgLines.push(`  \u2717 Loses: ${b.text}`);
            }
            msgLines.push('');
        }

        for (const b of newBonuses) {
            msgLines.push(`  \u2713 Gains: ${b.text}`);
        }

        const proceed = confirm(msgLines.join('\n'));
        if (!proceed) return;

        const eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        if (isShip) {
            appointCaptain(world, crewEntityId);
            eventQueue.emit({ type: GameEvents.CAPTAIN_APPOINTED });
        } else {
            appointLeader(world, crewEntityId);
            eventQueue.emit({ type: GameEvents.LEADER_APPOINTED });
        }
        callbacks.onAppoint();
    });

    // View in Graph button
    for (const btn of container.querySelectorAll('.detail-view-in-graph-btn')) {
        btn.addEventListener('click', () => {
            const eid = Number((btn as HTMLElement).dataset.entityId);
            if (eid && callbacks.onViewInGraph) {
                callbacks.onViewInGraph(eid);
            }
        });
    }
}
