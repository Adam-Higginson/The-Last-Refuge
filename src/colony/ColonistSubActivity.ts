// ColonistSubActivity.ts — Sub-activity resolver for colony colonists.
// Determines which micro-animation a colonist performs within their main activity.
// Uses seeded selection for deterministic-but-varied choices per entity.

import type {
    SubActivity,
    WorkSubActivity,
    IdleSubActivity,
    SocializingSubActivity,
    EatingSubActivity,
} from './ColonistState';
import type { CrewRole } from '../components/CrewMemberComponent';

export interface SubActivityResult {
    subActivity: SubActivity;
    duration: number; // seconds
}

/** Deterministic choice from an array based on entityId and a salt value. */
export function seededChoice<T>(entityId: number, items: T[], salt: number): T {
    const hash = Math.abs(Math.sin(entityId * 127.1 + salt * 311.7) * 43758.5453) % 1;
    const index = Math.floor(hash * items.length) % items.length;
    return items[index];
}

/** Deterministic float in [0, 1) based on entityId and salt. */
export function seededRandom(entityId: number, salt: number): number {
    return Math.abs(Math.sin(entityId * 127.1 + salt * 311.7) * 43758.5453) % 1;
}

/** Building type to relevant work sub-activities. */
const BUILDING_WORK_ACTIVITIES: Record<string, WorkSubActivity[]> = {
    farm: ['watering', 'harvesting', 'carrying'],
    hydroponics_bay: ['watering', 'calibrating', 'carrying'],
    workshop: ['hammering', 'calibrating', 'carrying'],
    solar_array: ['calibrating', 'hammering'],
    med_bay: ['checking_patient', 'calibrating'],
    barracks: ['hammering', 'carrying'],
    storage_depot: ['carrying', 'hammering'],
};

/** Role-based fallback work sub-activities when building type is unknown. */
const ROLE_WORK_FALLBACK: Record<CrewRole, WorkSubActivity[]> = {
    Civilian: ['carrying', 'watering', 'harvesting'],
    Engineer: ['hammering', 'calibrating', 'carrying'],
    Medic: ['checking_patient', 'calibrating'],
    Scientist: ['calibrating', 'checking_patient'],
    Soldier: ['hammering', 'carrying'],
    Pilot: ['calibrating', 'carrying'],
};

/** Resolve a work sub-activity based on role and building type. */
export function resolveWorkSubActivity(
    role: CrewRole,
    buildingTypeId: string | null,
    entityId: number,
    elapsed: number,
): SubActivityResult {
    const salt = Math.floor(elapsed / 5); // cycle every ~5s of elapsed
    const activities = (buildingTypeId && BUILDING_WORK_ACTIVITIES[buildingTypeId])
        ? BUILDING_WORK_ACTIVITIES[buildingTypeId]
        : ROLE_WORK_FALLBACK[role];

    const subActivity = seededChoice(entityId, activities, salt);
    const duration = 3 + seededRandom(entityId, salt + 99) * 5; // 3-8 seconds
    return { subActivity, duration };
}

/** Resolve an idle sub-activity with weighted distribution. */
export function resolveIdleSubActivity(
    entityId: number,
    elapsed: number,
    morale?: number,
): SubActivityResult {
    const salt = Math.floor(elapsed / 4);
    const roll = seededRandom(entityId, salt);

    let subActivity: IdleSubActivity;
    if (morale !== undefined && morale < 30) {
        // Low morale: sitting 50%, standing 30%, looking_around 20%
        if (roll < 0.5) subActivity = 'sitting';
        else if (roll < 0.8) subActivity = 'standing';
        else subActivity = 'looking_around';
    } else {
        // Normal: standing 60%, looking_around 20%, stretching 10%, sitting 10%
        if (roll < 0.6) subActivity = 'standing';
        else if (roll < 0.8) subActivity = 'looking_around';
        else if (roll < 0.9) subActivity = 'stretching';
        else subActivity = 'sitting';
    }

    const duration = 3 + seededRandom(entityId, salt + 77) * 5;
    return { subActivity, duration };
}

/** Resolve a socializing sub-activity based on how many others are nearby. */
export function resolveSocializingSubActivity(
    entityId: number,
    elapsed: number,
    nearbyCount: number,
    morale?: number,
): SubActivityResult {
    const salt = Math.floor(elapsed / 5);

    let subActivity: SocializingSubActivity;
    if (morale !== undefined && morale < 40) {
        // Low morale: 40% sit alone, rest normal
        const roll = seededRandom(entityId, salt + 200);
        if (roll < 0.4) {
            subActivity = 'sitting_together';
        } else if (nearbyCount <= 1) {
            subActivity = 'sitting_together';
        } else {
            const groupOptions: SocializingSubActivity[] = ['chatting', 'laughing', 'gesturing'];
            subActivity = seededChoice(entityId, groupOptions, salt);
        }
    } else if (nearbyCount <= 1) {
        subActivity = 'sitting_together';
    } else {
        const groupOptions: SocializingSubActivity[] = ['chatting', 'laughing', 'gesturing'];
        subActivity = seededChoice(entityId, groupOptions, salt);
    }

    const duration = 4 + seededRandom(entityId, salt + 55) * 4; // 4-8 seconds
    return { subActivity, duration };
}

/** Resolve an eating sub-activity. */
export function resolveEatingSubActivity(
    entityId: number,
): SubActivityResult {
    const roll = seededRandom(entityId, 42);

    // sitting_eating 80%, eating_standing 20%
    const subActivity: EatingSubActivity = roll < 0.8 ? 'sitting_eating' : 'eating_standing';
    const duration = 5 + seededRandom(entityId, 43) * 3; // 5-8 seconds
    return { subActivity, duration };
}
