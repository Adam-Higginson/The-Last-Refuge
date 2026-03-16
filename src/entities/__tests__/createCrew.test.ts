import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { CrewMemberComponent } from '../../components/CrewMemberComponent';
import type { CrewRole } from '../../components/CrewMemberComponent';
import { createCrew } from '../createCrew';

describe('createCrew', () => {
    let world: World;

    beforeEach(() => {
        ServiceLocator.clear();
        world = new World();
        const eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);
    });

    function getAllCrew(): CrewMemberComponent[] {
        return world.getEntitiesWithComponent(CrewMemberComponent)
            .map(e => e.getComponent(CrewMemberComponent))
            .filter((c): c is CrewMemberComponent => c !== null);
    }

    // --- Count ---

    it('generates exactly 50 crew members', () => {
        createCrew(world);
        expect(getAllCrew()).toHaveLength(50);
    });

    // --- Role distribution ---

    it('has correct role distribution', () => {
        createCrew(world);
        const crew = getAllCrew();

        const counts: Record<CrewRole, number> = {
            Engineer: 0, Soldier: 0, Medic: 0, Scientist: 0, Civilian: 0,
        };
        for (const c of crew) {
            counts[c.role]++;
        }

        expect(counts.Engineer).toBe(10);
        expect(counts.Soldier).toBe(8);
        expect(counts.Medic).toBe(5);
        expect(counts.Scientist).toBe(5);
        expect(counts.Civilian).toBe(22);
    });

    // --- Age range ---

    it('all ages are between 18 and 65', () => {
        createCrew(world);
        for (const c of getAllCrew()) {
            expect(c.age).toBeGreaterThanOrEqual(18);
            expect(c.age).toBeLessThanOrEqual(65);
        }
    });

    // --- Morale range ---

    it('all morale values are between 40 and 70', () => {
        createCrew(world);
        for (const c of getAllCrew()) {
            expect(c.morale).toBeGreaterThanOrEqual(40);
            expect(c.morale).toBeLessThanOrEqual(70);
        }
    });

    // --- Traits ---

    it('each crew member has exactly 2 traits', () => {
        createCrew(world);
        for (const c of getAllCrew()) {
            expect(c.traits).toHaveLength(2);
        }
    });

    it('no crew member has duplicate traits', () => {
        createCrew(world);
        for (const c of getAllCrew()) {
            expect(c.traits[0]).not.toBe(c.traits[1]);
        }
    });

    // --- Names ---

    it('all names are unique', () => {
        createCrew(world);
        const names = getAllCrew().map(c => c.fullName);
        const unique = new Set(names);
        expect(unique.size).toBe(names.length);
    });

    // --- Pre-seeded characters ---

    it('contains Mira Chen with correct properties', () => {
        createCrew(world);
        const mira = getAllCrew().find(c => c.fullName === 'Mira Chen');
        expect(mira).toBeDefined();
        expect(mira?.age).toBe(22);
        expect(mira?.role).toBe('Soldier');
        expect(mira?.traits).toEqual(['Determined', 'Reckless']);
    });

    it('contains Dr. Yael Chen with correct properties', () => {
        createCrew(world);
        const yael = getAllCrew().find(c => c.fullName === 'Dr. Yael Chen');
        expect(yael).toBeDefined();
        expect(yael?.age).toBe(51);
        expect(yael?.role).toBe('Medic');
        expect(yael?.traits).toEqual(['Protective', 'Analytical']);
    });

    it('contains Commander Soren Vael with correct properties', () => {
        createCrew(world);
        const soren = getAllCrew().find(c => c.fullName === 'Commander Soren Vael');
        expect(soren).toBeDefined();
        expect(soren?.age).toBe(38);
        expect(soren?.role).toBe('Soldier');
        expect(soren?.traits).toEqual(['Stubborn', 'Resourceful']);
    });

    it('contains Lt. Desta Morrow with correct properties', () => {
        createCrew(world);
        const desta = getAllCrew().find(c => c.fullName === 'Lt. Desta Morrow');
        expect(desta).toBeDefined();
        expect(desta?.age).toBe(29);
        expect(desta?.role).toBe('Soldier');
        expect(desta?.traits).toEqual(['Haunted', 'Empathetic']);
    });

    // --- Pre-seeded relationships ---

    it('Mira and Yael have a Close Bond relationship', () => {
        createCrew(world);
        const mira = getAllCrew().find(c => c.fullName === 'Mira Chen');
        const yaelRel = mira?.relationships.find(r => r.targetName === 'Dr. Yael Chen');
        expect(yaelRel).toBeDefined();
        expect(yaelRel?.type).toBe('Close Bond');
    });

    it('Soren is Mentor/Protege with Mira', () => {
        createCrew(world);
        const soren = getAllCrew().find(c => c.fullName === 'Commander Soren Vael');
        const miraRel = soren?.relationships.find(r => r.targetName === 'Mira Chen');
        expect(miraRel).toBeDefined();
        expect(miraRel?.type).toBe('Mentor/Protege');
    });

    it('Desta and Soren have a Romantic relationship', () => {
        createCrew(world);
        const desta = getAllCrew().find(c => c.fullName === 'Lt. Desta Morrow');
        const sorenRel = desta?.relationships.find(
            r => r.targetName === 'Commander Soren Vael',
        );
        expect(sorenRel).toBeDefined();
        expect(sorenRel?.type).toBe('Romantic');
    });

    // --- Relationships: no orphans ---

    it('every crew member has at least 1 relationship', () => {
        createCrew(world);
        for (const c of getAllCrew()) {
            expect(c.relationships.length).toBeGreaterThanOrEqual(1);
        }
    });

    it('all relationships reference valid crew members', () => {
        createCrew(world);
        const entities = world.getEntitiesWithComponent(CrewMemberComponent);
        const idSet = new Set(entities.map(e => e.id));

        for (const c of getAllCrew()) {
            for (const rel of c.relationships) {
                expect(idSet.has(rel.targetId)).toBe(true);
            }
        }
    });

    it('all relationships are bidirectional', () => {
        createCrew(world);
        const entities = world.getEntitiesWithComponent(CrewMemberComponent);

        for (const entity of entities) {
            const crew = entity.getComponent(CrewMemberComponent);
            if (!crew) continue;

            for (const rel of crew.relationships) {
                const target = entities.find(e => e.id === rel.targetId);
                const targetCrew = target?.getComponent(CrewMemberComponent);
                const backRef = targetCrew?.relationships.find(
                    r => r.targetId === entity.id,
                );
                expect(backRef).toBeDefined();
            }
        }
    });

    // --- Relationship levels ---

    it('all relationships have level between 0 and 100', () => {
        createCrew(world);
        for (const c of getAllCrew()) {
            for (const rel of c.relationships) {
                expect(rel.level).toBeGreaterThanOrEqual(0);
                expect(rel.level).toBeLessThanOrEqual(100);
            }
        }
    });

    it('captain has at least 30 relationships', () => {
        createCrew(world);
        const soren = getAllCrew().find(c => c.fullName === 'Commander Soren Vael');
        expect(soren?.relationships.length).toBeGreaterThanOrEqual(30);
    });

    it('civilians have fewer connections on average than non-civilians', () => {
        createCrew(world);
        const crew = getAllCrew();

        const civilians = crew.filter(c => c.role === 'Civilian');
        const nonCivilians = crew.filter(c => c.role !== 'Civilian');

        const civAvg = civilians.reduce((sum, c) => sum + c.relationships.length, 0) / civilians.length;
        const nonCivAvg = nonCivilians.reduce((sum, c) => sum + c.relationships.length, 0) / nonCivilians.length;

        expect(civAvg).toBeLessThan(nonCivAvg);
    });

    // --- Captain ---

    it('Commander Soren Vael is the ship captain', () => {
        createCrew(world);
        const soren = getAllCrew().find(c => c.fullName === 'Commander Soren Vael');
        expect(soren?.isCaptain).toBe(true);
    });

    it('only one crew member is captain', () => {
        createCrew(world);
        const captains = getAllCrew().filter(c => c.isCaptain);
        expect(captains).toHaveLength(1);
    });

    it('no crew start as leaders', () => {
        createCrew(world);
        const leaders = getAllCrew().filter(c => c.isLeader);
        expect(leaders).toHaveLength(0);
    });

    // --- Determinism ---

    it('produces identical output across multiple calls', () => {
        createCrew(world);
        const crew1 = getAllCrew().map(c => ({
            name: c.fullName, age: c.age, role: c.role,
            morale: c.morale, traits: [...c.traits],
        }));

        // Create a fresh world and regenerate
        ServiceLocator.clear();
        const world2 = new World();
        ServiceLocator.register('eventQueue', new EventQueue());
        ServiceLocator.register('world', world2);

        createCrew(world2);
        const crew2 = world2.getEntitiesWithComponent(CrewMemberComponent)
            .map(e => e.getComponent(CrewMemberComponent))
            .filter((c): c is CrewMemberComponent => c !== null)
            .map(c => ({
                name: c.fullName, age: c.age, role: c.role,
                morale: c.morale, traits: [...c.traits],
            }));

        expect(crew1).toEqual(crew2);
    });
});
