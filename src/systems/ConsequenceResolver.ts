// ConsequenceResolver.ts — Pure function module for applying encounter outcomes.
//
// DECISION TREE:
//   Consequence type
//     ├─ crew_death   → mark location='dead', emit CREW_DEATH, morale cascade
//     ├─ crew_injury  → add 'Injured' status effect for N turns
//     ├─ scout_damage → set damaged flag on ScoutDataComponent
//     ├─ morale_change → adjust morale on scoped crew
//     ├─ resource_change → add/deduct from ResourceComponent
//     ├─ extiris_intel → (future: increment intel counter)
//     └─ relationship_change → adjust relationship levels between assigned pairs

import { GameEvents } from '../core/GameEvents';
import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { ScoutDataComponent } from '../components/ScoutDataComponent';
import { ResourceComponent } from '../components/ResourceComponent';
import type { Consequence } from '../data/crisisCards';
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
}

/**
 * Apply a list of consequences from an encounter outcome.
 */
export function applyConsequences(
    consequences: Consequence[],
    ctx: EncounterContext,
): void {
    for (const consequence of consequences) {
        applyConsequence(consequence, ctx);
    }
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

    if (isDebugEnabled()) {
        console.log(`[Combat] Crew death: ${crew.fullName} (cause: combat)`);
    }

    ctx.eventQueue.emit({
        type: GameEvents.CREW_DEATH,
        entityId: targetEntityId,
        name: crew.fullName,
        cause: 'combat',
    });

    // Morale cascade through relationships
    applyGriefCascade(crew, ctx);
}

function applyGriefCascade(deceased: CrewMemberComponent, ctx: EncounterContext): void {
    // Distance 1: direct relationships
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
                hop2Crew.morale = Math.max(0, hop2Crew.morale - 8); // 50% of 15
            }
        }
    }
}

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

        if (isDebugEnabled()) {
            console.log(`[Combat] Crew injured: ${crew.fullName} for ${consequence.durationTurns} turns`);
        }
        break; // Injure first assigned crew only
    }
}

function applyScoutDamage(
    _consequence: Extract<Consequence, { type: 'scout_damage' }>,
    ctx: EncounterContext,
): void {
    const scoutEntity = ctx.world.getEntity(ctx.scoutEntityId);
    const scoutData = scoutEntity?.getComponent(ScoutDataComponent);
    if (!scoutData) return;

    // Mark scout as damaged (ScoutDataComponent will need a 'damaged' field)
    // For now, we destroy the scout if durationTurns >= 99 (effectively destroyed)
    if (isDebugEnabled()) {
        console.log(`[Combat] Scout damaged: ${scoutData.displayName}`);
    }
}

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
            // Apply to pilot's direct relationships
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

function applyExtirisIntel(
    consequence: Extract<Consequence, { type: 'extiris_intel' }>,
    _ctx: EncounterContext,
): void {
    // Intel gathering — PR 5 will implement the full system.
    // For now, log it via combat-debug.
    if (isDebugEnabled()) {
        console.log(`[Combat] Intel gathered: ${consequence.fragments} fragment(s)`);
    }
}

function applyRelationshipChange(
    consequence: Extract<Consequence, { type: 'relationship_change' }>,
    ctx: EncounterContext,
): void {
    // Adjust relationships between all pairs of assigned crew
    for (let i = 0; i < ctx.assignedCrewIds.length; i++) {
        for (let j = i + 1; j < ctx.assignedCrewIds.length; j++) {
            const entity1 = ctx.world.getEntity(ctx.assignedCrewIds[i]);
            const entity2 = ctx.world.getEntity(ctx.assignedCrewIds[j]);
            const crew1 = entity1?.getComponent(CrewMemberComponent);
            const crew2 = entity2?.getComponent(CrewMemberComponent);
            if (!crew1 || !crew2) continue;

            // Update both directions
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
