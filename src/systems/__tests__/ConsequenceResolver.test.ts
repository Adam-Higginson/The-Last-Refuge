import { describe, it, expect, beforeEach } from 'vitest';
import { applyConsequences, processEndOfTurn } from '../ConsequenceResolver';
import { CrewMemberComponent } from '../../components/CrewMemberComponent';
import { ScoutDataComponent } from '../../components/ScoutDataComponent';
import { EventStateComponent } from '../../components/EventStateComponent';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import type { OutcomeTier } from '../../data/crisisCards';
import type { EncounterContext } from '../ConsequenceResolver';

function makeCtx(world: World, overrides: Partial<EncounterContext> = {}): EncounterContext {
    return {
        world,
        eventQueue: new EventQueue(),
        scoutEntityId: 1,
        pilotEntityId: 10,
        assignedCrewIds: [10],
        turn: 5,
        cardTitle: 'TEST CRISIS',
        tier: 'success' as OutcomeTier,
        ...overrides,
    };
}

function addCrew(world: World, name: string, _entityId?: number): { entity: ReturnType<World['createEntity']>; crew: CrewMemberComponent } {
    const entity = world.createEntity(name);
    const crew = new CrewMemberComponent(name, 30, 'Soldier', 70, ['Determined', 'Quiet'], 'test');
    crew.location = { type: 'ship' };
    entity.addComponent(crew);
    return { entity, crew };
}

describe('ConsequenceResolver', () => {
    let world: World;

    beforeEach(() => {
        world = new World();
        ServiceLocator.clear();
        ServiceLocator.register('world', world);
    });

    describe('crew_death', () => {
        it('marks crew as dead', () => {
            const { entity, crew } = addCrew(world, 'Pilot');
            const ctx = makeCtx(world, { pilotEntityId: entity.id, assignedCrewIds: [entity.id] });

            applyConsequences([{ type: 'crew_death', targetSlot: 'pilot' }], ctx);

            expect(crew.location.type).toBe('dead');
        });

        it('emits CREW_DEATH event', () => {
            const { entity } = addCrew(world, 'Pilot');
            const ctx = makeCtx(world, { pilotEntityId: entity.id, assignedCrewIds: [entity.id] });

            let emitted = false;
            ctx.eventQueue.on('crew:death', () => { emitted = true; });
            applyConsequences([{ type: 'crew_death', targetSlot: 'pilot' }], ctx);
            ctx.eventQueue.drain();

            expect(emitted).toBe(true);
        });

        it('skips already dead crew', () => {
            const { entity, crew } = addCrew(world, 'Pilot');
            crew.location = { type: 'dead' };
            const ctx = makeCtx(world, { pilotEntityId: entity.id, assignedCrewIds: [entity.id] });

            let emitted = false;
            ctx.eventQueue.on('crew:death', () => { emitted = true; });
            applyConsequences([{ type: 'crew_death', targetSlot: 'pilot' }], ctx);
            ctx.eventQueue.drain();

            expect(emitted).toBe(false);
        });

        it('applies grief cascade to related crew', () => {
            const { entity: pilot, crew: pilotCrew } = addCrew(world, 'Pilot');
            const { entity: friend, crew: friendCrew } = addCrew(world, 'Friend');

            pilotCrew.relationships = [{
                targetId: friend.id,
                targetName: 'Friend',
                type: 'Close Bond',
                level: 80,
                description: 'close friends',
            }];

            const ctx = makeCtx(world, {
                pilotEntityId: pilot.id,
                assignedCrewIds: [pilot.id],
            });

            applyConsequences([{ type: 'crew_death', targetSlot: 'pilot' }], ctx);

            expect(friendCrew.morale).toBe(55); // 70 - 15
            expect(friendCrew.statusEffects).toContain('Traumatized');
        });

        it('applies 2-hop grief cascade at 50% impact', () => {
            const { entity: pilot, crew: pilotCrew } = addCrew(world, 'Pilot');
            const { entity: friend, crew: friendCrew } = addCrew(world, 'Friend');
            const { entity: friendOfFriend, crew: fofCrew } = addCrew(world, 'FoF');

            pilotCrew.relationships = [{
                targetId: friend.id, targetName: 'Friend',
                type: 'Close Bond', level: 80, description: '',
            }];
            friendCrew.relationships = [{
                targetId: pilot.id, targetName: 'Pilot',
                type: 'Close Bond', level: 80, description: '',
            }, {
                targetId: friendOfFriend.id, targetName: 'FoF',
                type: 'Close Bond', level: 50, description: '',
            }];

            const ctx = makeCtx(world, {
                pilotEntityId: pilot.id,
                assignedCrewIds: [pilot.id],
            });

            applyConsequences([{ type: 'crew_death', targetSlot: 'pilot' }], ctx);

            expect(fofCrew.morale).toBe(62); // 70 - 8
        });

        it('queues memorial event chain', () => {
            const { entity: pilot } = addCrew(world, 'Pilot');
            const gameState = world.createEntity('gameState');
            const eventState = new EventStateComponent();
            gameState.addComponent(eventState);

            const ctx = makeCtx(world, {
                pilotEntityId: pilot.id,
                assignedCrewIds: [pilot.id],
            });

            applyConsequences([{ type: 'crew_death', targetSlot: 'pilot' }], ctx);

            expect(eventState.hasFlag('memorial_pending:Pilot')).toBe(true);
        });
    });

    describe('crew_injury', () => {
        it('adds Injured status effect', () => {
            const { entity, crew } = addCrew(world, 'Soldier');
            const ctx = makeCtx(world, { assignedCrewIds: [entity.id] });

            applyConsequences([{ type: 'crew_injury', durationTurns: 3 }], ctx);

            expect(crew.statusEffects).toContain('Injured');
            expect(crew.injuryTurnsRemaining).toBe(3);
        });

        it('does not stack Injured status', () => {
            const { entity, crew } = addCrew(world, 'Soldier');
            crew.statusEffects.push('Injured');
            crew.injuryTurnsRemaining = 2;
            const ctx = makeCtx(world, { assignedCrewIds: [entity.id] });

            applyConsequences([{ type: 'crew_injury', durationTurns: 3 }], ctx);

            expect(crew.statusEffects.filter(s => s === 'Injured')).toHaveLength(1);
            expect(crew.injuryTurnsRemaining).toBe(3); // Refreshes duration
        });
    });

    describe('scout_damage', () => {
        it('sets damaged flag and duration', () => {
            const scoutEntity = world.createEntity('scout');
            const scoutData = new ScoutDataComponent('Scout Alpha', 10, 'Kira');
            scoutEntity.addComponent(scoutData);

            const ctx = makeCtx(world, { scoutEntityId: scoutEntity.id });

            applyConsequences([{ type: 'scout_damage', durationTurns: 2 }], ctx);

            expect(scoutData.damaged).toBe(true);
            expect(scoutData.damagedTurnsRemaining).toBe(2);
        });
    });

    describe('morale_change', () => {
        it('applies to all living crew (scope: all)', () => {
            const { crew: crew1 } = addCrew(world, 'A');
            const { crew: crew2 } = addCrew(world, 'B');
            const { crew: deadCrew } = addCrew(world, 'Dead');
            deadCrew.location = { type: 'dead' };

            const ctx = makeCtx(world);

            applyConsequences([{ type: 'morale_change', amount: -10, scope: 'all' }], ctx);

            expect(crew1.morale).toBe(60);
            expect(crew2.morale).toBe(60);
            expect(deadCrew.morale).toBe(70); // Not affected
        });

        it('clamps morale between 0 and 100', () => {
            const { crew } = addCrew(world, 'Low');
            crew.morale = 5;
            const ctx = makeCtx(world);

            applyConsequences([{ type: 'morale_change', amount: -20, scope: 'all' }], ctx);
            expect(crew.morale).toBe(0);
        });
    });

    describe('combat experience', () => {
        it('increments encountersSurvived for surviving assigned crew', () => {
            const { entity, crew } = addCrew(world, 'Veteran');
            const ctx = makeCtx(world, { assignedCrewIds: [entity.id] });

            applyConsequences([], ctx);

            expect(crew.encountersSurvived).toBe(1);
        });

        it('does not increment for dead crew', () => {
            const { entity, crew } = addCrew(world, 'DeadCrew');
            crew.location = { type: 'dead' };
            const ctx = makeCtx(world, { assignedCrewIds: [entity.id] });

            applyConsequences([], ctx);

            expect(crew.encountersSurvived).toBe(0);
        });
    });

    describe('combat log', () => {
        it('adds combat log entry to surviving crew', () => {
            const { entity, crew } = addCrew(world, 'Logger');
            const ctx = makeCtx(world, {
                assignedCrewIds: [entity.id],
                turn: 12,
                cardTitle: 'SENSOR SWEEP',
                tier: 'success',
            });

            applyConsequences([], ctx);

            expect(crew.combatLog).toHaveLength(1);
            expect(crew.combatLog[0].turn).toBe(12);
            expect(crew.combatLog[0].text).toContain('SENSOR SWEEP');
            expect(crew.combatLog[0].text).toContain('escaped');
        });
    });

    describe('processEndOfTurn', () => {
        it('ticks down injury turns', () => {
            const { crew } = addCrew(world, 'Injured');
            crew.statusEffects.push('Injured');
            crew.injuryTurnsRemaining = 2;

            processEndOfTurn(world);

            expect(crew.injuryTurnsRemaining).toBe(1);
            expect(crew.statusEffects).toContain('Injured');
        });

        it('removes Injured status when timer reaches 0', () => {
            const { crew } = addCrew(world, 'Healing');
            crew.statusEffects.push('Injured');
            crew.injuryTurnsRemaining = 1;

            processEndOfTurn(world);

            expect(crew.injuryTurnsRemaining).toBe(0);
            expect(crew.statusEffects).not.toContain('Injured');
        });

        it('medics speed up recovery', () => {
            const { crew: injured } = addCrew(world, 'Injured');
            injured.statusEffects.push('Injured');
            injured.injuryTurnsRemaining = 3;

            const { crew: medic } = addCrew(world, 'Medic');
            medic.role = 'Medic';

            processEndOfTurn(world);

            // 1 base + 1 medic = 2 turns recovered
            expect(injured.injuryTurnsRemaining).toBe(1);
        });

        it('ticks down scout damage', () => {
            const scoutEntity = world.createEntity('scout');
            const scoutData = new ScoutDataComponent('Scout', 10, 'Pilot');
            scoutData.damaged = true;
            scoutData.damagedTurnsRemaining = 2;
            scoutEntity.addComponent(scoutData);

            processEndOfTurn(world);

            expect(scoutData.damagedTurnsRemaining).toBe(1);
            expect(scoutData.damaged).toBe(true);
        });

        it('repairs scout when timer reaches 0', () => {
            const scoutEntity = world.createEntity('scout');
            const scoutData = new ScoutDataComponent('Scout', 10, 'Pilot');
            scoutData.damaged = true;
            scoutData.damagedTurnsRemaining = 1;
            scoutEntity.addComponent(scoutData);

            processEndOfTurn(world);

            expect(scoutData.damagedTurnsRemaining).toBe(0);
            expect(scoutData.damaged).toBe(false);
        });
    });
});
