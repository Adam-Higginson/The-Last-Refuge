// narrativeEvents.ts — Narrative event definitions and interfaces.
// Events are selected by NarrativeEventSystem based on category weights,
// conditions, and chain triggers.

import type { ResourceType } from './resources';

export type EventCategory = 'crisis' | 'opportunity' | 'discovery' | 'diplomatic' | 'morale' | 'story';

export interface NarrativeChoice {
    label: string;
    description?: string;
    cost?: { resource: ResourceType; amount: number }[];
    gain?: { resource: ResourceType; amount: number }[];
    outcome: string;
    flag?: string;
    chainEventId?: string;
    chainDelay?: number;
}

export interface NarrativeEventContext {
    turn: number;
    resources: Record<ResourceType, { current: number; cap: number }>;
    flags: ReadonlySet<string>;
}

export interface NarrativeEventDefinition {
    id: string;
    title: string;
    body: string;
    category: EventCategory;
    choices?: NarrativeChoice[];
    condition: (ctx: NarrativeEventContext) => boolean;
    once?: boolean;
}

/** Category weights for deck selection. story=0 means never drawn randomly. */
export const CATEGORY_WEIGHTS: Record<EventCategory, number> = {
    crisis: 30,
    opportunity: 25,
    diplomatic: 20,
    discovery: 15,
    morale: 10,
    story: 0,
};

export const NARRATIVE_EVENTS: NarrativeEventDefinition[] = [
    // --- Event 1: Intro (story, turn 1, continue-only) ---
    {
        id: 'intro_escape',
        title: 'THE LAST REFUGE',
        body: `The fires of Keth-7 fade behind you. Commander Vael's rearguard held just long enough for fifty souls to scramble aboard the ESV-7 — a stolen Extiris slaver ship you barely understand.

The Extiris do not negotiate. They do not communicate. They arrive, and what was yours becomes theirs. Colony after colony has fallen to their silent, methodical advance. Keth-7 was among the last.

But your sensors have found something: an uncharted star system, and a world that might sustain life.

Fifty survivors. One ship. Find a way to endure — and perhaps, one day, to understand what the Extiris truly are.`,
        category: 'story',
        condition: (ctx): boolean => ctx.turn === 1,
        once: true,
    },

    // --- Event 2: Supply Cache (opportunity, turn >= 3) ---
    {
        id: 'supply_cache',
        title: 'SIGNAL DETECTED',
        body: `Sensors detect a faint transponder signal from debris at the system's edge — possibly a derelict vessel. The signal is weak and intermittent, suggesting the wreck has been drifting for years.

Your engineering team estimates a short-range shuttle sortie could reach it, but the trip will burn fuel and put wear on already-strained equipment.`,
        category: 'opportunity',
        choices: [
            {
                label: 'Investigate the signal',
                description: 'Send a shuttle to search the wreck',
                cost: [{ resource: 'materials', amount: 10 }],
                gain: [{ resource: 'food', amount: 30 }],
                outcome: `The shuttle returns laden with vacuum-sealed ration crates — military grade, still edible. Enough to feed the crew for weeks. Among the supplies, your team also recovered a partially intact data core.`,
                flag: 'investigated_cache',
                chainEventId: 'cache_findings',
                chainDelay: 2,
            },
            {
                label: 'Ignore it — conserve resources',
                description: 'The risk is not worth it',
                outcome: `You mark the coordinates and move on. Whatever is out there will have to wait. The crew grumbles, but understands — every gram of material matters now.`,
                flag: 'ignored_cache',
            },
        ],
        condition: (ctx): boolean => ctx.turn >= 3,
        once: true,
    },

    // --- Event 3: Cache Findings (story, chain follow-up) ---
    {
        id: 'cache_findings',
        title: 'WHAT WE FOUND',
        body: `Among the rations, your crew discovered a data core. The ship logs reveal coordinates to a hidden refuelling station — a waypoint used by pre-war traders who plied the outer rim.

The logs are fragmented, but one entry stands out: the station was abandoned after an Extiris sighting in the sector. Whether it's still intact is anyone's guess.

Your navigator marks the coordinates. It may prove useful — if you survive long enough to reach it.`,
        category: 'story',
        // Only fires via chain queue (queued by supply_cache investigate choice).
        // Condition returns false to prevent the story event loop from triggering it early.
        condition: (): boolean => false,
        once: true,
    },
];
