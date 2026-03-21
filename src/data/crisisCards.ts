// crisisCards.ts — Crisis card definitions and interfaces for the encounter system.
//
// Each crisis card defines a scenario with skill slots, difficulty, and graduated
// outcome tiers. Cards are drawn when an Extiris encounter triggers.

import type { SkillType } from '../utils/combatSkills';
import type { ResourceType } from './resources';

// ---------------------------------------------------------------------------
// Consequence discriminated union
// ---------------------------------------------------------------------------

export type Consequence =
    | { type: 'crew_death'; targetSlot: 'pilot' | 'assigned' | 'random' }
    | { type: 'crew_injury'; durationTurns: number }
    | { type: 'scout_damage'; durationTurns: number }
    | { type: 'morale_change'; amount: number; scope: 'all' | 'assigned' | 'relationships' }
    | { type: 'resource_change'; resource: ResourceType; amount: number }
    | { type: 'extiris_intel'; fragments: number }
    | { type: 'relationship_change'; amount: number; scope: 'assigned_pairs' };

// ---------------------------------------------------------------------------
// Crisis card interfaces
// ---------------------------------------------------------------------------

export type OutcomeTier = 'critical_success' | 'success' | 'partial' | 'failure' | 'catastrophe';

export interface SkillSlot {
    skill: SkillType;
    label: string;
    maxCrew: number;
    required: boolean;
    /** Skill penalty applied by Extiris adaptation. 0 = no penalty. */
    penalty?: number;
}

// ---------------------------------------------------------------------------
// Extiris adaptation system
// ---------------------------------------------------------------------------

export type AdaptationTag =
    | 'sensor_resistance'
    | 'probe_swarms'
    | 'pattern_prediction'
    | 'debris_analysis'
    | 'signal_triangulation';

export const VALID_ADAPTATION_TAGS: AdaptationTag[] = [
    'sensor_resistance', 'probe_swarms', 'pattern_prediction',
    'debris_analysis', 'signal_triangulation',
];

interface AdaptationEffect {
    description: string;
    targetSkill: SkillType | null;
    penalty: number;
    disablesSacrifice?: boolean;
}

export const ADAPTATION_EFFECTS: Record<AdaptationTag, AdaptationEffect> = {
    sensor_resistance:    { description: 'Extiris has hardened sensors', targetSkill: 'engineering', penalty: -2 },
    probe_swarms:         { description: 'Probe swarms deployed', targetSkill: 'piloting', penalty: -1 },
    pattern_prediction:   { description: 'Movement patterns predicted', targetSkill: 'piloting', penalty: -1 },
    debris_analysis:      { description: 'Sacrifice tactic analyzed', targetSkill: null, penalty: 0, disablesSacrifice: true },
    signal_triangulation: { description: 'Comms triangulated', targetSkill: 'leadership', penalty: -2 },
};

/** Deterministic mapping: which adaptation counters which tactic (adaptationTag on crisis cards). */
export const TACTIC_COUNTER_MAP: Record<string, AdaptationTag> = {
    evasion: 'pattern_prediction',
    sensor_jam: 'sensor_resistance',
};

export interface AdaptedCard {
    modifiedCard: CrisisCard;
    sacrificeDisabled: boolean;
}

/**
 * Apply active Extiris adaptations to a crisis card.
 * Returns a cloned card with penalty values set on matching slots,
 * plus a flag indicating whether sacrifice is disabled.
 * Does NOT mutate the original card.
 */
export function applyAdaptations(card: CrisisCard, adaptations: string[]): AdaptedCard {
    let sacrificeDisabled = false;

    const modifiedSlots = card.skillSlots.map(slot => {
        let totalPenalty = 0;
        for (const tag of adaptations) {
            const effect = ADAPTATION_EFFECTS[tag as AdaptationTag];
            if (!effect) continue;

            if (effect.targetSkill === slot.skill) {
                totalPenalty += effect.penalty;
            }
        }

        if (totalPenalty !== 0) {
            return { ...slot, penalty: totalPenalty };
        }
        return { ...slot };
    });

    // Check for sacrifice-disabling adaptations
    for (const tag of adaptations) {
        const effect = ADAPTATION_EFFECTS[tag as AdaptationTag];
        if (effect?.disablesSacrifice) {
            sacrificeDisabled = true;
        }
    }

    return {
        modifiedCard: { ...card, skillSlots: modifiedSlots },
        sacrificeDisabled,
    };
}

export interface CrisisOutcome {
    tier: OutcomeTier;
    /** Inclusive margin range: [min, max]. Use Infinity for unbounded. */
    marginRange: [number, number];
    description: string;
    consequences: Consequence[];
}

export interface CrisisCard {
    id: string;
    title: string;
    description: string;
    difficulty: number;
    skillSlots: SkillSlot[];
    outcomes: CrisisOutcome[];
    encounterType: 'scout' | 'colony' | 'ship';
    /** Tag used by the Extiris adaptation system to track tactic frequency. */
    adaptationTag: string;
}

// ---------------------------------------------------------------------------
// Outcome tier resolution
// ---------------------------------------------------------------------------

/** Margin ranges for each outcome tier. */
const TIER_RANGES: Array<{ tier: OutcomeTier; min: number; max: number }> = [
    { tier: 'critical_success', min: 5, max: Infinity },
    { tier: 'success',          min: 1, max: 4 },
    { tier: 'partial',          min: -3, max: 0 },
    { tier: 'failure',          min: -7, max: -4 },
    { tier: 'catastrophe',      min: -Infinity, max: -8 },
];

/**
 * Resolve margin to an outcome tier.
 * Returns 'catastrophe' for NaN or non-finite values.
 */
export function resolveOutcomeTier(margin: number): OutcomeTier {
    if (!isFinite(margin)) return 'catastrophe';

    for (const range of TIER_RANGES) {
        if (margin >= range.min && margin <= range.max) {
            return range.tier;
        }
    }
    return 'catastrophe';
}

/**
 * Get the outcome definition for a given tier from a crisis card.
 */
export function getOutcomeForTier(card: CrisisCard, tier: OutcomeTier): CrisisOutcome | undefined {
    return card.outcomes.find(o => o.tier === tier);
}

// ---------------------------------------------------------------------------
// Starter crisis deck (2 cards for PR 1)
// ---------------------------------------------------------------------------

export const CRISIS_CARDS: CrisisCard[] = [
    {
        id: 'hunters_shadow',
        title: "HUNTER'S SHADOW",
        description: "The Extiris hunter has locked onto your scout's ion trail. The targeting array is narrowing — seconds remain before a lock is achieved.",
        difficulty: 12,
        skillSlots: [
            { skill: 'piloting', label: 'Evasive maneuvers', maxCrew: 2, required: true },
            { skill: 'engineering', label: 'Jam targeting array', maxCrew: 1, required: false },
        ],
        outcomes: [
            {
                tier: 'critical_success',
                marginRange: [5, Infinity],
                description: 'Clean escape. The scout vanishes from Extiris sensors like a ghost. Your crew works like a well-oiled machine.',
                consequences: [
                    { type: 'morale_change', amount: 5, scope: 'all' },
                    { type: 'relationship_change', amount: 10, scope: 'assigned_pairs' },
                ],
            },
            {
                tier: 'success',
                marginRange: [1, 4],
                description: 'The scout breaks free, but not without cost. Hull damage from a near-miss, and fuel reserves are depleted.',
                consequences: [
                    { type: 'scout_damage', durationTurns: 1 },
                    { type: 'resource_change', resource: 'energy', amount: -5 },
                ],
            },
            {
                tier: 'partial',
                marginRange: [-3, 0],
                description: 'The scout is torn apart by targeting fire. The pilot ejects into the void — alive, but stranded.',
                consequences: [
                    { type: 'scout_damage', durationTurns: 99 }, // effectively destroyed
                    { type: 'morale_change', amount: -10, scope: 'all' },
                    { type: 'extiris_intel', fragments: 1 },
                ],
            },
            {
                tier: 'failure',
                marginRange: [-7, -4],
                description: 'Direct hit. The scout disintegrates. No ejection. No signal. Just silence where a voice used to be.',
                consequences: [
                    { type: 'crew_death', targetSlot: 'pilot' },
                    { type: 'morale_change', amount: -15, scope: 'relationships' },
                ],
            },
            {
                tier: 'catastrophe',
                marginRange: [-Infinity, -8],
                description: 'The Extiris didn\'t just destroy the scout — it traced the comm signal back. Your colony\'s approximate position has been compromised.',
                consequences: [
                    { type: 'crew_death', targetSlot: 'pilot' },
                    { type: 'morale_change', amount: -20, scope: 'all' },
                ],
            },
        ],
        encounterType: 'scout',
        adaptationTag: 'evasion',
    },
    {
        id: 'sensor_sweep',
        title: 'SENSOR SWEEP',
        description: "An Extiris scanning pattern is converging on your scout's position. The electromagnetic net is tightening — your engineer might be able to create a blind spot.",
        difficulty: 10,
        skillSlots: [
            { skill: 'engineering', label: 'Create sensor blind spot', maxCrew: 2, required: true },
            { skill: 'piloting', label: 'Hold position in shadow', maxCrew: 1, required: false },
        ],
        outcomes: [
            {
                tier: 'critical_success',
                marginRange: [5, Infinity],
                description: 'The sensor sweep passes harmlessly overhead. Your crew\'s countermeasures are flawless — the Extiris doesn\'t even know you were there.',
                consequences: [
                    { type: 'morale_change', amount: 5, scope: 'assigned' },
                    { type: 'extiris_intel', fragments: 1 },
                    { type: 'relationship_change', amount: 10, scope: 'assigned_pairs' },
                ],
            },
            {
                tier: 'success',
                marginRange: [1, 4],
                description: 'The blind spot holds, but barely. The scout\'s systems are overloaded from the effort — it needs time to recover.',
                consequences: [
                    { type: 'scout_damage', durationTurns: 1 },
                ],
            },
            {
                tier: 'partial',
                marginRange: [-3, 0],
                description: 'The countermeasures fail. The Extiris detects the scout and opens fire. The pilot punches out just before impact.',
                consequences: [
                    { type: 'scout_damage', durationTurns: 99 },
                    { type: 'crew_injury', durationTurns: 3 },
                    { type: 'morale_change', amount: -8, scope: 'all' },
                    { type: 'extiris_intel', fragments: 1 },
                ],
            },
            {
                tier: 'failure',
                marginRange: [-7, -4],
                description: 'Total countermeasure failure. The Extiris locks on and fires before evasion is possible. The cockpit goes dark.',
                consequences: [
                    { type: 'crew_death', targetSlot: 'pilot' },
                    { type: 'morale_change', amount: -15, scope: 'relationships' },
                ],
            },
            {
                tier: 'catastrophe',
                marginRange: [-Infinity, -8],
                description: 'The countermeasures backfire — they amplified the scout\'s signature instead of hiding it. The Extiris has a clear read on the signal origin.',
                consequences: [
                    { type: 'crew_death', targetSlot: 'pilot' },
                    { type: 'morale_change', amount: -20, scope: 'all' },
                ],
            },
        ],
        encounterType: 'scout',
        adaptationTag: 'sensor_jam',
    },
];
