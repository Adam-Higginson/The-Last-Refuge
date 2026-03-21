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

Fifty survivors. One ship. Find a way to endure — and perhaps, one day, to understand what the Extiris truly are.

The emergency hyperjump tore through the drive core. Your engines are offline — the ESV-7 isn't going anywhere until they're repaired. Your scouts are your only eyes out here.`,
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

    // --- Event 4: Faint Signal hint (story, turn >= 3, suppressed if discovered) ---
    {
        id: 'station_signal_hint',
        title: 'FAINT SIGNAL',
        body: `Long-range sensors have picked up a faint automated signal from somewhere in Dust's orbital zone. It's weak — an old transponder, repeating on a loop. Could be debris. Could be something worth finding.

Your navigator marks the bearing — **ahead of Dust in its orbit**. A scout could reach it.`,
        category: 'story',
        condition: (ctx): boolean => ctx.turn >= 3 && !ctx.flags.has('station_discovered'),
        once: true,
    },

    // --- Event 5: Station discovered (story, flag-gated) ---
    {
        id: 'station_found',
        title: 'KETH MINING RELAY',
        body: `Your scout's sensors illuminate a structure drifting in Dust's orbit — a Keth mining relay, gutted but intact. The hull bears scorch marks from an Extiris sweep, but the core systems might still function.

If you could repair it, this relay could extend your sensor range... and perhaps more.`,
        category: 'story',
        condition: (ctx): boolean => ctx.flags.has('station_discovered'),
        once: true,
    },

    // --- Event 6: Station repaired (story, flag-gated, chains to Extiris) ---
    {
        id: 'station_online',
        title: 'THE SIGNAL',
        body: `The relay's systems flicker to life. Power flows through conduits that haven't carried current in years. Navigation beacons. Sensor arrays. Communication relays.

Then your engineer's face goes pale. The relay has already broadcast — an automated distress signal, transmitted on a frequency you recognise. An Extiris frequency.

Whatever heard it... now knows you're here.`,
        category: 'story',
        condition: (ctx): boolean => ctx.flags.has('station_repaired'),
        once: true,
        choices: [
            {
                label: 'Acknowledged',
                outcome: 'Commander Vael stares at the sensor readout for a long moment. "We knew this was a risk. Now we prepare." The crew begins fortifying what they can.',
                flag: 'signal_broadcast',
                chainEventId: 'extiris_arrival',
                chainDelay: 2,
            },
        ],
    },

    // --- Event 7: Extiris arrival (chain-only, spawns the Extiris) ---
    {
        id: 'extiris_arrival',
        title: 'THE HUNTER',
        body: `Something has answered the signal.

Long-range sensors detect a single vessel entering the system from deep space — moving with the cold precision of an Extiris hunter. It does not hail. It does not slow.

It is searching.`,
        category: 'story',
        condition: (): boolean => false,
        once: true,
    },

    // --- Event 8: Engine diagnostic (story, flag-gated) ---
    {
        id: 'engine_diagnostic',
        title: 'DRIVE CORE ANALYSIS',
        body: `The Keth relay's diagnostic systems have completed a full scan of the ESV-7's drive core. The damage from your emergency hyperjump is extensive — but not irreparable.

Your chief engineer reports a repair path: with enough materials and time, the engines can be brought back online. It won't be quick, and it won't be cheap.

But it means freedom.`,
        category: 'story',
        condition: (ctx): boolean => ctx.flags.has('station_repaired') && !ctx.flags.has('engine_repaired'),
        once: true,
    },

    // --- Event 9: Engines online (story, flag-gated) ---
    {
        id: 'engines_online',
        title: 'ENGINES ONLINE',
        body: `The drive core hums to life — a deep, resonant vibration that travels through every bulkhead of the ESV-7. Lights flicker, then hold steady. The navigation console illuminates for the first time since the jump.

Commander Vael places a hand on the helm. "We're mobile again. For the first time since we stole this ship... we can choose where we go."

The stars are no longer a cage. They're a map.`,
        category: 'story',
        condition: (ctx): boolean => ctx.flags.has('engine_repaired'),
        once: true,
    },
];
