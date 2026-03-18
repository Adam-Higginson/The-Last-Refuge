// ColonistThoughts.ts — Context-aware thought bubble resolver for colonists.
// Generates short thought strings based on activity, morale, traits, and time of day.
// Only resolved for the selected colonist, every 8-12 seconds.

import { seededRandom } from './ColonistSubActivity';
import type { ColonistVisualState } from './ColonistState';
import type { CrewMemberComponent } from '../components/CrewMemberComponent';

const WORK_THOUGHTS = [
    'Almost done...',
    'Focus...',
    'One more load.',
    'Keep going.',
    'This is coming together.',
];

const IDLE_THOUGHTS = [
    'Nice breeze...',
    'What a view.',
    'Could use a nap.',
    'Wonder what\'s for dinner.',
    'Hmm...',
];

const SOCIAL_THOUGHTS = [
    'Good times.',
    'Ha! Classic.',
    'Missed this.',
    'Need more nights like this.',
    'So good to laugh.',
];

const EAT_THOUGHTS = [
    'Not bad, actually.',
    'Could use seasoning.',
    'Reminds me of home.',
    'Fuel up.',
];

const REST_THOUGHTS = [
    'Zzz...',
    'Five more minutes...',
    'Tomorrow will be better.',
];

const LOW_MORALE_THOUGHTS = [
    'How long can this last?',
    'I miss Earth.',
    'What\'s the point?',
    'So tired of this.',
    'Will it ever get better?',
];

const HIGH_MORALE_THOUGHTS = [
    'We can do this!',
    'Feels like home.',
    'This colony is something.',
    'Proud of what we built.',
];

const TRAIT_THOUGHTS: Record<string, string[]> = {
    Hopeful: ['Tomorrow will be brighter.', 'I believe in us.'],
    Haunted: ['Can\'t shake the dreams.', 'The memories won\'t fade.'],
    Analytical: ['The data supports this.', 'Interesting pattern...'],
    Quiet: ['...', 'Peaceful.'],
    Reckless: ['Rules are suggestions.', 'Let\'s shake things up.'],
    Determined: ['Won\'t stop now.', 'Eyes on the goal.'],
    Grieving: ['I still miss them.', 'One day at a time.'],
    Empathetic: ['They look like they need a friend.', 'I should check on them.'],
    Protective: ['Stay alert.', 'I\'ll keep them safe.'],
    Stubborn: ['My way works.', 'Not changing my mind.'],
    Resourceful: ['I can make this work.', 'There\'s always a way.'],
};

const NIGHT_THOUGHTS = [
    'Stars look different here.',
    'The sky is so clear.',
    'Quiet night.',
];

const MORNING_THOUGHTS = [
    'New day, new start.',
    'Rise and shine.',
    'Morning already?',
];

/**
 * Resolve a context-aware thought for a colonist.
 * Returns null if no thought should be shown.
 */
export function resolveThought(
    colonist: ColonistVisualState,
    crew: CrewMemberComponent,
    gameHour: number,
): string | null {
    const salt = Math.floor(Date.now() / 1000);
    const roll = seededRandom(colonist.entityId, salt);

    // 30% chance of morale-driven thought
    if (roll < 0.3) {
        if (crew.morale < 25) {
            return pickFrom(LOW_MORALE_THOUGHTS, colonist.entityId, salt + 1);
        }
        if (crew.morale > 80) {
            return pickFrom(HIGH_MORALE_THOUGHTS, colonist.entityId, salt + 2);
        }
    }

    // 20% chance of trait-driven thought
    if (roll < 0.5) {
        for (const trait of crew.traits) {
            const thoughts = TRAIT_THOUGHTS[trait];
            if (thoughts) {
                return pickFrom(thoughts, colonist.entityId, salt + 3);
            }
        }
    }

    // 15% chance of time-of-day thought
    if (roll < 0.65) {
        if (gameHour >= 21 || gameHour < 3) {
            return pickFrom(NIGHT_THOUGHTS, colonist.entityId, salt + 4);
        }
        if (gameHour >= 5 && gameHour < 7) {
            return pickFrom(MORNING_THOUGHTS, colonist.entityId, salt + 5);
        }
    }

    // Activity-driven thought
    switch (colonist.activity) {
        case 'working':
            return pickFrom(WORK_THOUGHTS, colonist.entityId, salt + 6);
        case 'idle':
            return pickFrom(IDLE_THOUGHTS, colonist.entityId, salt + 7);
        case 'socializing':
            return pickFrom(SOCIAL_THOUGHTS, colonist.entityId, salt + 8);
        case 'eating':
            return pickFrom(EAT_THOUGHTS, colonist.entityId, salt + 9);
        case 'resting':
            return pickFrom(REST_THOUGHTS, colonist.entityId, salt + 10);
        default:
            return null;
    }
}

function pickFrom(items: string[], entityId: number, salt: number): string {
    const idx = Math.floor(seededRandom(entityId, salt) * items.length) % items.length;
    return items[idx];
}
