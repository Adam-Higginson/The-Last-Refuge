// ConsequenceResolver.ts — Pure function module for applying encounter outcomes.
//
// DECISION TREE:
//   Consequence type
//     ├─ crew_death   → mark dead, emit CREW_DEATH, grief cascade, last words, memorial chain
//     ├─ crew_injury  → add 'Injured' status + set injuryTurnsRemaining
//     ├─ scout_damage → set damaged flag + damagedTurnsRemaining on ScoutDataComponent
//     ├─ morale_change → adjust morale on scoped crew
//     ├─ resource_change → add/deduct from ResourceComponent
//     ├─ extiris_intel → (future: increment intel counter)
//     └─ relationship_change → adjust relationship levels between assigned pairs
//
// POST-RESOLUTION:
//   - Combat log entry added to all surviving assigned crew
//   - Combat experience: encountersSurvived++, 15% chance of Traumatized trait
//   - Injury/scout damage ticks down each turn via processEndOfTurn()

import { GameEvents } from '../core/GameEvents';
import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { ScoutDataComponent } from '../components/ScoutDataComponent';
import { ResourceComponent } from '../components/ResourceComponent';
import { IntelComponent } from '../components/IntelComponent';
import { EventStateComponent } from '../components/EventStateComponent';
import type { Consequence, OutcomeTier } from '../data/crisisCards';
import type { World } from '../core/World';
import type { EventQueue } from '../core/EventQueue';

function isDebugEnabled(): boolean {
    try {
        return localStorage.getItem('combat-debug') === 'true';
    } catch {
        return false;
    }
}

export interface EncounterContext {
    world: World;
    eventQueue: EventQueue;
    scoutEntityId: number;
    pilotEntityId: number;
    /** Entity IDs of all crew assigned to slots (excluding sacrifice). */
    assignedCrewIds: number[];
    /** Current game turn number. */
    turn: number;
    /** The crisis card title for combat log entries. */
    cardTitle: string;
    /** The resolved outcome tier. */
    tier: OutcomeTier;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Apply a list of consequences from an encounter outcome,
 * then run post-resolution effects (combat log, experience, last words).
 */
export function applyConsequences(
    consequences: Consequence[],
    ctx: EncounterContext,
): void {
    for (const consequence of consequences) {
        applyConsequence(consequence, ctx);
    }

    // Post-resolution: combat log + experience for surviving assigned crew
    applyCombatExperience(ctx);
    addCombatLogEntries(ctx);
}

function applyConsequence(consequence: Consequence, ctx: EncounterContext): void {
    switch (consequence.type) {
        case 'crew_death':
            applyCrewDeath(consequence, ctx);
            break;
        case 'crew_injury':
            applyCrewInjury(consequence, ctx);
            break;
        case 'scout_damage':
            applyScoutDamage(consequence, ctx);
            break;
        case 'morale_change':
            applyMoraleChange(consequence, ctx);
            break;
        case 'resource_change':
            applyResourceChange(consequence, ctx);
            break;
        case 'extiris_intel':
            applyExtirisIntel(consequence, ctx);
            break;
        case 'relationship_change':
            applyRelationshipChange(consequence, ctx);
            break;
    }
}

// ---------------------------------------------------------------------------
// Crew death + grief cascade + last words + memorial
// ---------------------------------------------------------------------------

function applyCrewDeath(
    consequence: Extract<Consequence, { type: 'crew_death' }>,
    ctx: EncounterContext,
): void {
    let targetEntityId: number | null = null;

    switch (consequence.targetSlot) {
        case 'pilot':
            targetEntityId = ctx.pilotEntityId;
            break;
        case 'assigned':
            targetEntityId = ctx.assignedCrewIds[0] ?? null;
            break;
        case 'random':
            targetEntityId = ctx.assignedCrewIds.length > 0
                ? ctx.assignedCrewIds[Math.floor(Math.random() * ctx.assignedCrewIds.length)]
                : ctx.pilotEntityId;
            break;
    }

    if (targetEntityId === null) return;

    const entity = ctx.world.getEntity(targetEntityId);
    const crew = entity?.getComponent(CrewMemberComponent);
    if (!crew || crew.location.type === 'dead') return;

    crew.location = { type: 'dead' };

    // Generate last words based on traits and relationships
    const lastWords = generateLastWords(crew, ctx);

    if (isDebugEnabled()) {
        console.log(`[Combat] Crew death: ${crew.fullName} (cause: combat)`);
        if (lastWords) console.log(`[Combat] Last words: ${lastWords}`);
    }

    ctx.eventQueue.emit({
        type: GameEvents.CREW_DEATH,
        entityId: targetEntityId,
        name: crew.fullName,
        cause: 'combat',
    });

    // Morale cascade through relationships
    applyGriefCascade(crew, ctx);

    // Queue memorial narrative event (fires 1 turn later)
    queueMemorialEvent(crew, lastWords, ctx);
}

function applyGriefCascade(deceased: CrewMemberComponent, ctx: EncounterContext): void {
    for (const rel of deceased.relationships) {
        const targetEntity = ctx.world.getEntity(rel.targetId);
        const targetCrew = targetEntity?.getComponent(CrewMemberComponent);
        if (!targetCrew || targetCrew.location.type === 'dead') continue;

        if (rel.level >= 40) {
            targetCrew.morale = Math.max(0, targetCrew.morale - 15);
        }
        if (rel.level >= 70) {
            if (!targetCrew.statusEffects.includes('Traumatized')) {
                targetCrew.statusEffects.push('Traumatized');
            }
        }

        // Distance 2: friends of friends (50% impact)
        for (const hopRel of targetCrew.relationships) {
            if (hopRel.targetId === deceased.entity.id) continue;
            const hop2Entity = ctx.world.getEntity(hopRel.targetId);
            const hop2Crew = hop2Entity?.getComponent(CrewMemberComponent);
            if (!hop2Crew || hop2Crew.location.type === 'dead') continue;

            if (hopRel.level >= 40) {
                hop2Crew.morale = Math.max(0, hop2Crew.morale - 8);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Last words — trait/relationship templates for catastrophe deaths
// ---------------------------------------------------------------------------

const LAST_WORDS_TEMPLATES: Array<{
    condition: (crew: CrewMemberComponent, ctx: EncounterContext) => boolean;
    template: (crew: CrewMemberComponent, ctx: EncounterContext) => string;
}> = [
    {
        // Protective + has close bond
        condition: (crew) => crew.traits.includes('Protective') && crew.relationships.some(r => r.level >= 70),
        template: (crew) => {
            const closeBond = crew.relationships.find(r => r.level >= 70);
            return `${crew.fullName}'s last transmission: "Tell ${closeBond?.targetName ?? 'them'}... I kept my promise."`;
        },
    },
    {
        // Haunted — been carrying this weight
        condition: (crew) => crew.traits.includes('Haunted'),
        template: (crew) => `${crew.fullName} flew into the hunter's path without hesitation. They'd been ready for a long time.`,
    },
    {
        // Determined — went down fighting
        condition: (crew) => crew.traits.includes('Determined'),
        template: (crew) => `${crew.fullName}'s final act was to keep transmitting — coordinates, sensor data, anything useful. The signal cut mid-word.`,
    },
    {
        // Empathetic + has relationships
        condition: (crew) => crew.traits.includes('Empathetic') && crew.relationships.length > 0,
        template: (crew) => {
            const closest = crew.relationships.reduce((a, b) => a.level > b.level ? a : b);
            return `${closest.targetName} heard the static where ${crew.fullName}'s voice used to be.`;
        },
    },
    {
        // Reckless — went out on their own terms
        condition: (crew) => crew.traits.includes('Reckless'),
        template: (crew) => `${crew.fullName} pushed the throttle past redline. The cockpit recorder caught one word: "Faster."`,
    },
    {
        // Quiet — silence
        condition: (crew) => crew.traits.includes('Quiet'),
        template: (crew) => `${crew.fullName} said nothing at the end. The silence was louder than any scream.`,
    },
    {
        // Hopeful — believed to the last
        condition: (crew) => crew.traits.includes('Hopeful'),
        template: (crew) => `${crew.fullName}'s last words: "It's okay. We're going to make it. All of us." The channel went dark.`,
    },
    {
        // Has captain relationship
        condition: (crew, ctx) => {
            const allCrew = ctx.world.getEntitiesWithComponent(CrewMemberComponent);
            return allCrew.some(e => {
                const c = e.getComponent(CrewMemberComponent);
                return c?.isCaptain && crew.relationships.some(r => r.targetId === e.id && r.level >= 50);
            });
        },
        template: (crew) => `Commander Vael stared at the empty frequency. ${crew.fullName} was gone. Another name for the list.`,
    },
    {
        // Veteran (3+ encounters)
        condition: (crew) => crew.encountersSurvived >= 3,
        template: (crew) => `${crew.fullName} had survived ${crew.encountersSurvived} encounters. Everyone thought they were invincible. They weren't.`,
    },
    {
        // Default — generic but still personal
        condition: () => true,
        template: (crew) => `The cockpit went dark. ${crew.fullName} — age ${crew.age}, ${crew.role.toLowerCase()} — did not make it home.`,
    },
];

function generateLastWords(crew: CrewMemberComponent, ctx: EncounterContext): string {
    for (const entry of LAST_WORDS_TEMPLATES) {
        if (entry.condition(crew, ctx)) {
            return entry.template(crew, ctx);
        }
    }
    return '';
}

function queueMemorialEvent(crew: CrewMemberComponent, lastWords: string, ctx: EncounterContext): void {
    const gameState = ctx.world.getEntityByName('gameState');
    const eventState = gameState?.getComponent(EventStateComponent);
    if (!eventState) return;

    // Set a flag so the memorial event condition can find the deceased's name
    eventState.addFlag(`memorial_pending:${crew.fullName}`);
    if (lastWords) {
        eventState.addFlag(`last_words:${crew.fullName}:${lastWords}`);
    }

    // Queue the memorial chain event for 1 turn later
    eventState.queueChain('crew_memorial', ctx.turn, 1);
}

// ---------------------------------------------------------------------------
// Crew injury (temporary skill penalty)
// ---------------------------------------------------------------------------

function applyCrewInjury(
    consequence: Extract<Consequence, { type: 'crew_injury' }>,
    ctx: EncounterContext,
): void {
    for (const crewId of ctx.assignedCrewIds) {
        const entity = ctx.world.getEntity(crewId);
        const crew = entity?.getComponent(CrewMemberComponent);
        if (!crew || crew.location.type === 'dead') continue;

        if (!crew.statusEffects.includes('Injured')) {
            crew.statusEffects.push('Injured');
        }
        crew.injuryTurnsRemaining = consequence.durationTurns;

        if (isDebugEnabled()) {
            console.log(`[Combat] Crew injured: ${crew.fullName} for ${consequence.durationTurns} turns`);
        }
        break; // Injure first assigned crew only
    }
}

// ---------------------------------------------------------------------------
// Scout damage
// ---------------------------------------------------------------------------

function applyScoutDamage(
    consequence: Extract<Consequence, { type: 'scout_damage' }>,
    ctx: EncounterContext,
): void {
    const scoutEntity = ctx.world.getEntity(ctx.scoutEntityId);
    const scoutData = scoutEntity?.getComponent(ScoutDataComponent);
    if (!scoutData) return;

    scoutData.damaged = true;
    scoutData.damagedTurnsRemaining = consequence.durationTurns;

    if (isDebugEnabled()) {
        console.log(`[Combat] Scout damaged: ${scoutData.displayName} for ${consequence.durationTurns} turns`);
    }
}

// ---------------------------------------------------------------------------
// Morale change
// ---------------------------------------------------------------------------

function applyMoraleChange(
    consequence: Extract<Consequence, { type: 'morale_change' }>,
    ctx: EncounterContext,
): void {
    const allEntities = ctx.world.getEntitiesWithComponent(CrewMemberComponent);

    switch (consequence.scope) {
        case 'all':
            for (const entity of allEntities) {
                const crew = entity.getComponent(CrewMemberComponent);
                if (!crew || crew.location.type === 'dead') continue;
                crew.morale = Math.max(0, Math.min(100, crew.morale + consequence.amount));
            }
            break;
        case 'assigned':
            for (const crewId of ctx.assignedCrewIds) {
                const entity = ctx.world.getEntity(crewId);
                const crew = entity?.getComponent(CrewMemberComponent);
                if (!crew || crew.location.type === 'dead') continue;
                crew.morale = Math.max(0, Math.min(100, crew.morale + consequence.amount));
            }
            break;
        case 'relationships': {
            const pilotEntity = ctx.world.getEntity(ctx.pilotEntityId);
            const pilot = pilotEntity?.getComponent(CrewMemberComponent);
            if (!pilot) break;
            for (const rel of pilot.relationships) {
                const relEntity = ctx.world.getEntity(rel.targetId);
                const relCrew = relEntity?.getComponent(CrewMemberComponent);
                if (!relCrew || relCrew.location.type === 'dead') continue;
                relCrew.morale = Math.max(0, Math.min(100, relCrew.morale + consequence.amount));
            }
            break;
        }
    }
}

// ---------------------------------------------------------------------------
// Resource change
// ---------------------------------------------------------------------------

function applyResourceChange(
    consequence: Extract<Consequence, { type: 'resource_change' }>,
    ctx: EncounterContext,
): void {
    const gameState = ctx.world.getEntityByName('gameState');
    const resources = gameState?.getComponent(ResourceComponent);
    if (!resources) return;

    if (consequence.amount > 0) {
        resources.add(consequence.resource, consequence.amount);
    } else {
        resources.deduct(consequence.resource, Math.abs(consequence.amount));
    }
}

// ---------------------------------------------------------------------------
// Extiris intel gathering
// ---------------------------------------------------------------------------

function applyExtirisIntel(
    consequence: Extract<Consequence, { type: 'extiris_intel' }>,
    ctx: EncounterContext,
): void {
    const gameState = ctx.world.getEntityByName('gameState');
    const intel = gameState?.getComponent(IntelComponent);
    if (intel) {
        intel.fragments += consequence.fragments;
        ctx.eventQueue.emit({
            type: GameEvents.INTEL_GATHERED,
            fragments: consequence.fragments,
        });
    }

    if (isDebugEnabled()) {
        console.log(`[Combat] Intel gathered: ${consequence.fragments} fragment(s) (total: ${intel?.fragments ?? '?'})`);
    }
}

// ---------------------------------------------------------------------------
// Relationship change
// ---------------------------------------------------------------------------

function applyRelationshipChange(
    consequence: Extract<Consequence, { type: 'relationship_change' }>,
    ctx: EncounterContext,
): void {
    for (let i = 0; i < ctx.assignedCrewIds.length; i++) {
        for (let j = i + 1; j < ctx.assignedCrewIds.length; j++) {
            const entity1 = ctx.world.getEntity(ctx.assignedCrewIds[i]);
            const entity2 = ctx.world.getEntity(ctx.assignedCrewIds[j]);
            const crew1 = entity1?.getComponent(CrewMemberComponent);
            const crew2 = entity2?.getComponent(CrewMemberComponent);
            if (!crew1 || !crew2) continue;

            const rel1 = crew1.relationships.find(r => r.targetId === ctx.assignedCrewIds[j]);
            const rel2 = crew2.relationships.find(r => r.targetId === ctx.assignedCrewIds[i]);

            if (rel1) {
                rel1.level = Math.max(0, Math.min(100, rel1.level + consequence.amount));
            }
            if (rel2) {
                rel2.level = Math.max(0, Math.min(100, rel2.level + consequence.amount));
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Combat experience (post-resolution)
// ---------------------------------------------------------------------------

const TRAUMA_CHANCE = 0.15;
const MAX_EXPERIENCE_BONUS = 3;

function applyCombatExperience(ctx: EncounterContext): void {
    for (const crewId of ctx.assignedCrewIds) {
        const entity = ctx.world.getEntity(crewId);
        const crew = entity?.getComponent(CrewMemberComponent);
        if (!crew || crew.location.type === 'dead') continue;

        crew.encountersSurvived++;

        // 15% chance of gaining Traumatized trait per encounter survived
        if (Math.random() < TRAUMA_CHANCE) {
            if (!crew.statusEffects.includes('Traumatized')) {
                crew.statusEffects.push('Traumatized');
                if (isDebugEnabled()) {
                    console.log(`[Combat] ${crew.fullName} gained Traumatized from combat stress`);
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Combat log entries (post-resolution)
// ---------------------------------------------------------------------------

const TIER_VERBS: Record<OutcomeTier, string> = {
    critical_success: 'flawlessly escaped',
    success: 'escaped with minor damage from',
    partial: 'barely survived',
    failure: 'was lost during',
    catastrophe: 'was destroyed in',
};

function addCombatLogEntries(ctx: EncounterContext): void {
    const verb = TIER_VERBS[ctx.tier] ?? 'encountered';

    for (const crewId of ctx.assignedCrewIds) {
        const entity = ctx.world.getEntity(crewId);
        const crew = entity?.getComponent(CrewMemberComponent);
        if (!crew || crew.location.type === 'dead') continue;

        const entry = `Turn ${ctx.turn}: ${crew.fullName} ${verb} ${ctx.cardTitle}.`;
        crew.combatLog.push({ turn: ctx.turn, text: entry });
    }
}

// ---------------------------------------------------------------------------
// End-of-turn processing (injury recovery, scout repair)
// ---------------------------------------------------------------------------

/**
 * Called by EncounterSystem on TURN_END to tick down injury and scout damage timers.
 * Medical crew on the ship reduce injury recovery by 1 turn per medic.
 */
export function processEndOfTurn(world: World): void {
    // Tick down crew injuries
    const medicCount = countMedicsOnShip(world);

    for (const entity of world.getEntitiesWithComponent(CrewMemberComponent)) {
        const crew = entity.getComponent(CrewMemberComponent);
        if (!crew || crew.location.type === 'dead') continue;

        if (crew.injuryTurnsRemaining > 0) {
            // Medics speed up recovery: 1 extra turn per medic
            const recovery = 1 + medicCount;
            crew.injuryTurnsRemaining = Math.max(0, crew.injuryTurnsRemaining - recovery);

            if (crew.injuryTurnsRemaining <= 0) {
                // Remove Injured status effect
                const idx = crew.statusEffects.indexOf('Injured');
                if (idx >= 0) crew.statusEffects.splice(idx, 1);

                if (isDebugEnabled()) {
                    console.log(`[Combat] ${crew.fullName} recovered from injury`);
                }
            }
        }
    }

    // Tick down scout damage
    for (const entity of world.getEntitiesWithComponent(ScoutDataComponent)) {
        const scoutData = entity.getComponent(ScoutDataComponent);
        if (!scoutData || !scoutData.damaged) continue;

        scoutData.damagedTurnsRemaining = Math.max(0, scoutData.damagedTurnsRemaining - 1);

        if (scoutData.damagedTurnsRemaining <= 0) {
            scoutData.damaged = false;

            if (isDebugEnabled()) {
                console.log(`[Combat] ${scoutData.displayName} repaired`);
            }
        }
    }
}

function countMedicsOnShip(world: World): number {
    let count = 0;
    for (const entity of world.getEntitiesWithComponent(CrewMemberComponent)) {
        const crew = entity.getComponent(CrewMemberComponent);
        if (!crew) continue;
        if (crew.location.type === 'ship' && crew.role === 'Medic') {
            count++;
        }
    }
    return count;
}

// ---------------------------------------------------------------------------
// Exports for combat skill system (injury penalty)
// ---------------------------------------------------------------------------

/** Skill penalty applied when a crew member has the 'Injured' status effect. */
export const INJURY_SKILL_PENALTY = -2;

/** Max experience bonus (encounters survived) that adds to skill scores. */
export { MAX_EXPERIENCE_BONUS };
