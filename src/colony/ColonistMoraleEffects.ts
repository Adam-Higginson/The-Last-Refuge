// ColonistMoraleEffects.ts — Turn-based morale resolution and work efficiency.
// Called on TURN_END to update colonist morale based on relationships, traits, and proximity.

import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { getCrewAtColony } from '../utils/crewUtils';
import type { World } from '../core/World';

/** Maximum morale change per turn. */
const MAX_DELTA_PER_TURN = 5;

/**
 * Resolve morale changes for all colonists at a given colony region.
 * Called once per TURN_END.
 */
export function resolveTurnMorale(
    world: World,
    planetEntityId: number,
    regionId: number,
): void {
    const crewEntities = getCrewAtColony(world, planetEntityId, regionId);
    const crewMap = new Map<number, CrewMemberComponent>();

    for (const entity of crewEntities) {
        const crew = entity.getComponent(CrewMemberComponent);
        if (crew) crewMap.set(entity.id, crew);
    }

    const colonistIds = new Set(crewMap.keys());

    for (const [_entityId, crew] of crewMap) {
        let delta = 0;

        // Relationship proximity effects
        for (const rel of crew.relationships) {
            if (!colonistIds.has(rel.targetId)) continue; // not at this colony

            switch (rel.type) {
                case 'Close Bond':
                    delta += 1;
                    break;
                case 'Romantic':
                    delta += 2;
                    break;
                case 'Mentor/Protege':
                    delta += 1;
                    break;
                case 'Rival':
                    delta -= 1.5;
                    break;
                case 'Estranged':
                    delta -= 1;
                    break;
            }
        }

        // Isolation: no friends/partners at colony
        const hasFriendHere = crew.relationships.some(
            r => colonistIds.has(r.targetId) && (r.type === 'Close Bond' || r.type === 'Romantic'),
        );
        if (!hasFriendHere && crewMap.size > 1) {
            delta -= 1;
        }

        // Trait bonuses
        for (const trait of crew.traits) {
            switch (trait) {
                case 'Hopeful': delta += 0.5; break;
                case 'Haunted': delta -= 0.5; break;
                case 'Determined': delta += 0.3; break;
                case 'Grieving': delta -= 0.3; break;
                default: break;
            }
        }

        // Cap delta
        delta = Math.max(-MAX_DELTA_PER_TURN, Math.min(MAX_DELTA_PER_TURN, delta));

        // Apply and clamp
        crew.morale = Math.max(0, Math.min(100, crew.morale + delta));
    }
}

/**
 * Get the average work efficiency for colonists at a colony region.
 * Returns 0.5–1.0 based on average morale of workers.
 */
export function getWorkEfficiency(
    world: World,
    planetEntityId: number,
    regionId: number,
): number {
    const crewEntities = getCrewAtColony(world, planetEntityId, regionId);
    if (crewEntities.length === 0) return 1.0;

    let totalMorale = 0;
    let count = 0;
    for (const entity of crewEntities) {
        const crew = entity.getComponent(CrewMemberComponent);
        if (crew) {
            totalMorale += crew.morale;
            count++;
        }
    }

    if (count === 0) return 1.0;
    const avgMorale = totalMorale / count;
    return 0.5 + (avgMorale / 100) * 0.5;
}
