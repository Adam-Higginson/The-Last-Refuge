// leaderBonuses.ts — Static data tables for leader role bonuses and trait bonuses.

import type { CrewRole, Trait } from '../components/CrewMemberComponent';

export interface LeaderBonus {
    /** Flat morale bonus for colonists at this location. */
    moraleBonus?: number;
    /** Multiplier for food production (e.g. 0.2 = +20%). */
    foodProductionMultiplier?: number;
    /** Multiplier reduction for material costs (e.g. 0.1 = -10%). */
    materialCostReduction?: number;
    /** Multiplier reduction for construction time (e.g. 0.2 = -20%). */
    constructionTimeReduction?: number;
    /** Data generated per turn (Phase 4 hook). */
    dataPerTurn?: number;
    /** Extra population capacity. */
    populationCapBonus?: number;
    /** Human-readable description. */
    description: string;
}

/** Bonuses granted by a leader based on their role. */
export const LEADER_ROLE_BONUSES: Record<CrewRole, LeaderBonus> = {
    Soldier: {
        moraleBonus: 5,
        description: '+5 colony morale',
    },
    Engineer: {
        constructionTimeReduction: 0.2,
        materialCostReduction: 0.1,
        description: '-20% construction time, -10% material cost',
    },
    Medic: {
        moraleBonus: 10,
        description: '+10 colony morale, slower morale decay',
    },
    Scientist: {
        dataPerTurn: 1,
        description: '+1 Data/turn (future)',
    },
    Civilian: {
        foodProductionMultiplier: 0.2,
        populationCapBonus: 1,
        description: '+20% food production, +1 population capacity',
    },
};

/** Bonuses granted by leader traits (only traits with gameplay effects). */
export const LEADER_TRAIT_BONUSES: Partial<Record<Trait, LeaderBonus>> = {
    Resourceful: {
        materialCostReduction: 0.1,
        description: '-10% material cost',
    },
    Analytical: {
        description: '+10% building efficiency',
    },
    Hopeful: {
        moraleBonus: 5,
        description: '+5 morale to all colonists',
    },
    Stubborn: {
        moraleBonus: -5,
        description: '+10 morale in crisis, -5 morale normally',
    },
    Haunted: {
        moraleBonus: -5,
        description: '-5 morale',
    },
    Protective: {
        description: 'Colony takes less damage from events',
    },
};

/** Ship role descriptions (what each role contributes on the ship). */
export const SHIP_ROLE_DESCRIPTIONS: Record<CrewRole, string> = {
    Engineer: 'Maintains ship systems. Min 3 required.',
    Soldier: 'Bridge crew / security. Min 2 required.',
    Medic: 'Treats injuries across all locations.',
    Scientist: 'No ship function yet.',
    Civilian: 'Passenger. No ship function.',
};

/** Colony role descriptions (what each role contributes in a colony). */
export const COLONY_ROLE_DESCRIPTIONS: Record<CrewRole, string> = {
    Engineer: 'Speeds construction. Operates Workshops.',
    Soldier: 'Garrison and defence.',
    Medic: 'Colony health. 1 per 15 colonists recommended.',
    Scientist: 'No colony function yet.',
    Civilian: 'Operates Farms and basic buildings.',
};

export interface BonusLine {
    text: string;
    sentiment: 'positive' | 'negative' | 'neutral';
}

/** Get all bonus lines for a crew member if they were leader. */
export function getLeaderBonusLines(role: CrewRole, traits: readonly Trait[]): BonusLine[] {
    const lines: BonusLine[] = [];
    const roleBonus = LEADER_ROLE_BONUSES[role];

    // Parse role bonus description into sentiment-tagged lines
    for (const part of roleBonus.description.split(', ')) {
        lines.push({
            text: `${part} (${role})`,
            sentiment: part.startsWith('-') ? 'negative' : 'positive',
        });
    }

    for (const trait of traits) {
        const traitBonus = LEADER_TRAIT_BONUSES[trait];
        if (traitBonus) {
            // Split compound descriptions (e.g. Stubborn) into separate lines
            for (const part of traitBonus.description.split(', ')) {
                lines.push({
                    text: `${part} (${trait})`,
                    sentiment: part.startsWith('-') ? 'negative' : part.startsWith('+') ? 'positive' : 'neutral',
                });
            }
        }
    }

    return lines;
}
