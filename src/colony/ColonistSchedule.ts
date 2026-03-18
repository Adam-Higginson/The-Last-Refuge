// ColonistSchedule.ts — Role-based daily schedules for colonists.
// Each role has a sequence of activities throughout the day.

import type { CrewRole } from '../components/CrewMemberComponent';
import type { ColonistActivity } from './ColonistState';

export type ScheduleLocation = 'workplace' | 'shelter' | 'social_area' | 'patrol';

export interface ScheduleBlock {
    startHour: number;
    endHour: number;
    activity: ColonistActivity;
    location: ScheduleLocation;
}

const CIVILIAN_SCHEDULE: ScheduleBlock[] = [
    { startHour: 0, endHour: 5, activity: 'resting', location: 'shelter' },
    { startHour: 5, endHour: 12, activity: 'working', location: 'workplace' },
    { startHour: 12, endHour: 13, activity: 'eating', location: 'social_area' },
    { startHour: 13, endHour: 17, activity: 'working', location: 'workplace' },
    { startHour: 17, endHour: 21, activity: 'socializing', location: 'social_area' },
    { startHour: 21, endHour: 24, activity: 'resting', location: 'shelter' },
];

const ENGINEER_SCHEDULE: ScheduleBlock[] = [
    { startHour: 0, endHour: 7, activity: 'resting', location: 'shelter' },
    { startHour: 7, endHour: 12, activity: 'working', location: 'workplace' },
    { startHour: 12, endHour: 13, activity: 'eating', location: 'social_area' },
    { startHour: 13, endHour: 18, activity: 'working', location: 'workplace' },
    { startHour: 18, endHour: 22, activity: 'socializing', location: 'social_area' },
    { startHour: 22, endHour: 24, activity: 'resting', location: 'shelter' },
];

const SOLDIER_SCHEDULE: ScheduleBlock[] = [
    { startHour: 0, endHour: 6, activity: 'resting', location: 'shelter' },
    { startHour: 6, endHour: 12, activity: 'patrolling', location: 'patrol' },
    { startHour: 12, endHour: 13, activity: 'eating', location: 'social_area' },
    { startHour: 13, endHour: 17, activity: 'patrolling', location: 'patrol' },
    { startHour: 17, endHour: 21, activity: 'socializing', location: 'social_area' },
    { startHour: 21, endHour: 24, activity: 'resting', location: 'shelter' },
];

const MEDIC_SCHEDULE: ScheduleBlock[] = [
    { startHour: 0, endHour: 7, activity: 'resting', location: 'shelter' },
    { startHour: 7, endHour: 12, activity: 'working', location: 'workplace' },
    { startHour: 12, endHour: 13, activity: 'eating', location: 'social_area' },
    { startHour: 13, endHour: 17, activity: 'working', location: 'workplace' },
    { startHour: 17, endHour: 22, activity: 'socializing', location: 'social_area' },
    { startHour: 22, endHour: 24, activity: 'resting', location: 'shelter' },
];

const SCIENTIST_SCHEDULE: ScheduleBlock[] = [
    { startHour: 0, endHour: 9, activity: 'resting', location: 'shelter' },
    { startHour: 9, endHour: 13, activity: 'working', location: 'workplace' },
    { startHour: 13, endHour: 14, activity: 'eating', location: 'social_area' },
    { startHour: 14, endHour: 20, activity: 'working', location: 'workplace' },
    { startHour: 20, endHour: 23, activity: 'socializing', location: 'social_area' },
    { startHour: 23, endHour: 24, activity: 'resting', location: 'shelter' },
];

const SCHEDULES: Record<CrewRole, ScheduleBlock[]> = {
    Civilian: CIVILIAN_SCHEDULE,
    Engineer: ENGINEER_SCHEDULE,
    Soldier: SOLDIER_SCHEDULE,
    Medic: MEDIC_SCHEDULE,
    Scientist: SCIENTIST_SCHEDULE,
    Pilot: SOLDIER_SCHEDULE,
};

/** Get stagger offset for a colonist (±0.5 hours, seeded by entity ID). */
export function getStaggerOffset(entityId: number): number {
    return (Math.sin(entityId * 7.13 + 3.7) * 0.5);
}

/** Get the current schedule block for a role at a given hour. */
export function getScheduleBlock(role: CrewRole, hour: number, entityId: number): ScheduleBlock {
    const schedule = SCHEDULES[role];
    const stagger = getStaggerOffset(entityId);
    const effectiveHour = ((hour - stagger) % 24 + 24) % 24;

    for (const block of schedule) {
        if (effectiveHour >= block.startHour && effectiveHour < block.endHour) {
            return block;
        }
    }

    // Fallback: resting at shelter (should not happen with complete schedules)
    return { startHour: 0, endHour: 24, activity: 'resting', location: 'shelter' };
}
