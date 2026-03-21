// combatSkills.ts — Pure functions for combat skill calculation.
//
// DATA FLOW:
//   CrewMemberComponent (role + traits + entityId)
//     └─▶ getBaseScore(role, skill, entityId)  ← deterministic seeding within range
//         └─▶ + getTraitModifiers(traits, skill)  ← personality trait bonuses
//             └─▶ = getSkillScore(crew, skill, entityId)  ← final score
//
//   Two crew in same crisis
//     └─▶ getRelationshipModifier(crew1, crew2)  ← bond (+1) / rivalry (-1) / neutral (0)

import type { CrewMemberComponent, CrewRole, PersonalityTrait } from '../components/CrewMemberComponent';

export type SkillType = 'piloting' | 'combat' | 'engineering' | 'leadership' | 'medical';

// --- Base score ranges per role ---

interface SkillRange {
    min: number;
    max: number;
}

const ROLE_SKILLS: Record<CrewRole, Partial<Record<SkillType, SkillRange>>> = {
    Soldier:   { combat: { min: 6, max: 8 }, leadership: { min: 3, max: 5 } },
    Pilot:     { piloting: { min: 6, max: 8 }, combat: { min: 3, max: 5 } },
    Engineer:  { engineering: { min: 6, max: 8 }, piloting: { min: 2, max: 4 } },
    Scientist: { engineering: { min: 5, max: 7 }, medical: { min: 4, max: 6 } },
    Medic:     { medical: { min: 6, max: 8 }, leadership: { min: 3, max: 5 } },
    Civilian:  {},  // civilians get a flat base, seeded per entity
};

/** Default base score for skills not listed in a role's primary/secondary. */
const DEFAULT_BASE = 1;

/** Civilian primary skill score range. */
const CIVILIAN_RANGE: SkillRange = { min: 3, max: 4 };

// --- Trait modifiers ---

const TRAIT_SKILL_MODIFIERS: Partial<Record<PersonalityTrait, Partial<Record<SkillType, number>>>> = {
    Determined:  { combat: 1 },
    Protective:  { combat: 1, leadership: 1 },
    Empathetic:  { medical: 1, leadership: 1 },
    Reckless:    { piloting: 2, engineering: -1 },
    Analytical:  { engineering: 1 },
    Resourceful: { engineering: 1, piloting: 1 },
    Haunted:     { leadership: -1, combat: 1 },
    Stubborn:    { combat: 1, leadership: -1 },
};

// --- Relationship thresholds ---

const BOND_THRESHOLD = 70;
const RIVALRY_THRESHOLD = 30;

// --- Public API ---

/**
 * Get the base skill score for a role, seeded by entity ID for deterministic variation.
 * Returns a value within the role's range for that skill, or DEFAULT_BASE if the role
 * has no affinity for that skill.
 */
export function getBaseScore(role: CrewRole, skill: SkillType, entityId: number): number {
    if (role === 'Civilian') {
        // Civilians get one "best" skill seeded by entity ID
        const skills: SkillType[] = ['piloting', 'combat', 'engineering', 'leadership', 'medical'];
        const primaryIndex = entityId % skills.length;
        if (skills[primaryIndex] === skill) {
            return CIVILIAN_RANGE.min + (entityId % (CIVILIAN_RANGE.max - CIVILIAN_RANGE.min + 1));
        }
        return DEFAULT_BASE;
    }

    const range = ROLE_SKILLS[role][skill];
    if (!range) return DEFAULT_BASE;

    return range.min + (entityId % (range.max - range.min + 1));
}

/**
 * Get the total trait modifier for a specific skill from a list of personality traits.
 */
export function getTraitModifiers(traits: readonly PersonalityTrait[], skill: SkillType): number {
    let modifier = 0;
    for (const trait of traits) {
        const mods = TRAIT_SKILL_MODIFIERS[trait];
        if (mods && mods[skill] !== undefined) {
            modifier += mods[skill];
        }
    }
    return modifier;
}

/** Skill penalty when crew has 'Injured' status effect. */
const INJURY_PENALTY = -2;

/** Max experience bonus from encounters survived. */
const MAX_EXP_BONUS = 3;

/**
 * Get the final skill score for a crew member.
 * Score = base (role + entity seed) + trait modifiers + leader bonus
 *         + experience bonus - injury penalty.
 * Minimum score is 0.
 */
export function getSkillScore(
    crew: CrewMemberComponent,
    skill: SkillType,
    entityId: number,
): number {
    const base = getBaseScore(crew.role, skill, entityId);
    const traitMod = getTraitModifiers(crew.traits, skill);
    const leaderMod = crew.isLeader && skill === 'leadership' ? 3 : 0;
    const injuryMod = crew.statusEffects.includes('Injured') ? INJURY_PENALTY : 0;
    const expBonus = Math.min(crew.encountersSurvived, MAX_EXP_BONUS);

    return Math.max(0, base + traitMod + leaderMod + injuryMod + expBonus);
}

/**
 * Get the relationship modifier when two crew are assigned to the same crisis.
 * Bond (level >= 70): +1 each. Rivalry (level <= 30): -1 each. Neutral: 0.
 * Returns 0 if no relationship exists between them.
 */
export function getRelationshipModifier(
    crew1: CrewMemberComponent,
    crew2EntityId: number,
): number {
    const rel = crew1.relationships.find(r => r.targetId === crew2EntityId);
    if (!rel) return 0;

    if (rel.level >= BOND_THRESHOLD) return 1;
    if (rel.level <= RIVALRY_THRESHOLD) return -1;
    return 0;
}
