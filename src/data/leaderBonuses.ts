// leaderBonuses.ts — Static data tables for leader role bonuses and trait bonuses.
// NOTE: These bonuses are currently display-only in the UI. Actual gameplay effects
// (resource modifiers, morale changes) will be applied by LeaderBonusComponent
// when it is implemented in Phase 3 Step 9 (Polish & Balance).

import type { CrewRole, Trait } from '../components/CrewMemberComponent';

export interface BonusEffect {
    text: string;
    sentiment: 'positive' | 'negative' | 'neutral';
}

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
    /** Human-readable description (legacy, use effects for display). */
    description: string;
    /** Individual effects with sentiment for colour-coded display. */
    effects: BonusEffect[];
}

/** Bonuses granted by a leader based on their role. */
export const LEADER_ROLE_BONUSES: Record<CrewRole, LeaderBonus> = {
    Soldier: {
        moraleBonus: 5,
        description: '+5 colony morale',
        effects: [
            { text: '+5 colony morale', sentiment: 'positive' },
        ],
    },
    Engineer: {
        constructionTimeReduction: 0.2,
        materialCostReduction: 0.1,
        description: '-20% construction time, -10% material cost',
        effects: [
            { text: '-20% construction time', sentiment: 'positive' },
            { text: '-10% material cost', sentiment: 'positive' },
        ],
    },
    Medic: {
        moraleBonus: 10,
        description: '+10 colony morale, slower morale decay',
        effects: [
            { text: '+10 colony morale', sentiment: 'positive' },
            { text: 'Slower morale decay', sentiment: 'positive' },
        ],
    },
    Scientist: {
        dataPerTurn: 1,
        description: '+1 Data/turn (future)',
        effects: [
            { text: '+1 Data/turn', sentiment: 'neutral' },
        ],
    },
    Civilian: {
        foodProductionMultiplier: 0.2,
        populationCapBonus: 1,
        description: '+20% food production, +1 population capacity',
        effects: [
            { text: '+20% food production', sentiment: 'positive' },
            { text: '+1 population capacity', sentiment: 'positive' },
        ],
    },
};

/** Bonuses granted by leader traits (only traits with gameplay effects). */
export const LEADER_TRAIT_BONUSES: Partial<Record<Trait, LeaderBonus>> = {
    Resourceful: {
        materialCostReduction: 0.1,
        description: '-10% material cost',
        effects: [
            { text: '-10% material cost', sentiment: 'positive' },
        ],
    },
    Analytical: {
        description: '+10% building efficiency (future)',
        effects: [
            { text: '+10% building efficiency (future)', sentiment: 'neutral' },
        ],
    },
    Hopeful: {
        moraleBonus: 5,
        description: '+5 morale to all colonists',
        effects: [
            { text: '+5 morale to all colonists', sentiment: 'positive' },
        ],
    },
    Stubborn: {
        moraleBonus: -5,
        description: '+10 morale in crisis, -5 morale normally',
        effects: [
            { text: '+10 morale in crisis', sentiment: 'positive' },
            { text: '-5 morale normally', sentiment: 'negative' },
        ],
    },
    Haunted: {
        moraleBonus: -5,
        description: '-5 morale',
        effects: [
            { text: '-5 morale', sentiment: 'negative' },
        ],
    },
    Protective: {
        description: 'Less damage from events (future)',
        effects: [
            { text: 'Less damage from events (future)', sentiment: 'neutral' },
        ],
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

/** Get all bonus effect lines for a crew member if they were leader. */
export function getLeaderBonusLines(role: CrewRole, traits: readonly Trait[]): BonusEffect[] {
    const lines: BonusEffect[] = [];
    const roleBonus = LEADER_ROLE_BONUSES[role];

    for (const effect of roleBonus.effects) {
        lines.push({ text: `${effect.text} (${role})`, sentiment: effect.sentiment });
    }

    for (const trait of traits) {
        const traitBonus = LEADER_TRAIT_BONUSES[trait];
        if (traitBonus) {
            for (const effect of traitBonus.effects) {
                lines.push({ text: `${effect.text} (${trait})`, sentiment: effect.sentiment });
            }
        }
    }

    return lines;
}
