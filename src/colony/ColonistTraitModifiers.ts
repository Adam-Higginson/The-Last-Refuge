// ColonistTraitModifiers.ts — Trait-driven schedule and sub-activity modifiers.
// Traits influence colonist behavior by altering schedule blocks and sub-activity outcomes.

import { seededRandom } from './ColonistSubActivity';
import type { ScheduleBlock } from './ColonistSchedule';
import type { SubActivityResult } from './ColonistSubActivity';
import type { PersonalityTrait } from '../components/CrewMemberComponent';

/**
 * Apply trait-based modifications to a schedule block.
 * Called after getScheduleBlock() to adjust behavior per-colonist.
 */
export function applyTraitScheduleModifier(
    schedule: ScheduleBlock,
    traits: PersonalityTrait[],
    entityId: number,
    gameHour: number,
): ScheduleBlock {
    for (const trait of traits) {
        switch (trait) {
            case 'Quiet':
                // 30% chance: socializing → idle alone
                if (schedule.activity === 'socializing') {
                    const roll = seededRandom(entityId, Math.floor(gameHour) * 13 + 7);
                    if (roll < 0.3) {
                        return { ...schedule, activity: 'idle', location: 'social_area' };
                    }
                }
                break;

            case 'Reckless':
                // 10% chance: delay work start by treating first work hour as idle
                if (schedule.activity === 'working') {
                    const hoursIntoBlock = gameHour - schedule.startHour;
                    if (hoursIntoBlock < 1) {
                        const roll = seededRandom(entityId, Math.floor(gameHour) * 17 + 3);
                        if (roll < 0.1) {
                            return { ...schedule, activity: 'idle', location: 'social_area' };
                        }
                    }
                }
                break;

            case 'Hopeful':
                // During idle, walk to perimeter (scenic spot)
                if (schedule.activity === 'idle' && schedule.location !== 'shelter') {
                    return { ...schedule, location: 'patrol' as ScheduleBlock['location'] };
                }
                break;

            case 'Haunted':
                // 20% chance: wake early (before hour 5), wander
                if (schedule.activity === 'resting' && gameHour >= 3 && gameHour < 5) {
                    const roll = seededRandom(entityId, Math.floor(gameHour) * 23 + 11);
                    if (roll < 0.2) {
                        return { ...schedule, activity: 'idle', location: 'social_area' };
                    }
                }
                break;

            // Analytical, Empathetic — handled at sub-activity / location level
            default:
                break;
        }
    }
    return schedule;
}

/**
 * Apply trait-based modifications to a sub-activity result.
 * Called after resolving sub-activity to adjust durations/types.
 */
export function applyTraitSubActivityModifier(
    result: SubActivityResult,
    traits: PersonalityTrait[],
): SubActivityResult {
    for (const trait of traits) {
        if (trait === 'Analytical' && result.subActivity === 'calibrating') {
            // Double calibrating duration for Analytical colonists
            return { ...result, duration: result.duration * 2 };
        }
    }
    return result;
}
