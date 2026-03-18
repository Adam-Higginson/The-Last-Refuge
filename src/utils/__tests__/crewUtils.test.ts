import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { CrewMemberComponent } from '../../components/CrewMemberComponent';
import {
    getCrewAtShip,
    getCrewAtColony,
    getCrewAtScout,
    getCrewCounts,
    getShipRoleCounts,
    getScoutLocations,
    checkShipMinimums,
    getColonyLocations,
    getLocationLabel,
} from '../crewUtils';

function addCrew(
    world: World,
    name: string,
    role: 'Engineer' | 'Soldier' | 'Medic' | 'Scientist' | 'Civilian',
    location: 'ship' | { planetEntityId: number; regionId: number } = 'ship',
): void {
    const entity = world.createEntity(name);
    const crew = entity.addComponent(
        new CrewMemberComponent(name, 30, role, 50, ['Quiet', 'Hopeful'], 'Test backstory'),
    );
    if (location !== 'ship') {
        crew.location = { type: 'colony', ...location };
    }
}

describe('crewUtils', () => {
    let world: World;

    beforeEach(() => {
        ServiceLocator.clear();
        world = new World();
        ServiceLocator.register('world', world);
    });

    it('getCrewAtShip returns only ship crew', () => {
        addCrew(world, 'a', 'Soldier');
        addCrew(world, 'b', 'Civilian', { planetEntityId: 10, regionId: 1 });
        addCrew(world, 'c', 'Engineer');

        expect(getCrewAtShip(world)).toHaveLength(2);
    });

    it('getCrewAtColony returns only matching colony crew', () => {
        addCrew(world, 'a', 'Civilian', { planetEntityId: 10, regionId: 1 });
        addCrew(world, 'b', 'Civilian', { planetEntityId: 10, regionId: 2 });
        addCrew(world, 'c', 'Civilian', { planetEntityId: 10, regionId: 1 });

        expect(getCrewAtColony(world, 10, 1)).toHaveLength(2);
        expect(getCrewAtColony(world, 10, 2)).toHaveLength(1);
    });

    it('getCrewCounts returns correct split', () => {
        addCrew(world, 'a', 'Soldier');
        addCrew(world, 'b', 'Civilian', { planetEntityId: 10, regionId: 1 });
        addCrew(world, 'c', 'Engineer');

        const counts = getCrewCounts(world);
        expect(counts.ship).toBe(2);
        expect(counts.colony).toBe(1);
        expect(counts.total).toBe(3);
    });

    it('getShipRoleCounts counts roles on ship only', () => {
        addCrew(world, 'a', 'Soldier');
        addCrew(world, 'b', 'Soldier');
        addCrew(world, 'c', 'Engineer');
        addCrew(world, 'd', 'Soldier', { planetEntityId: 10, regionId: 1 });

        const roles = getShipRoleCounts(world);
        expect(roles.Soldier).toBe(2);
        expect(roles.Engineer).toBe(1);
        expect(roles.Civilian).toBe(0);
    });

    it('checkShipMinimums reports correct status', () => {
        addCrew(world, 'a', 'Soldier');
        addCrew(world, 'b', 'Engineer');
        addCrew(world, 'c', 'Engineer');
        addCrew(world, 'd', 'Engineer');

        const check = checkShipMinimums(world);
        expect(check.soldiers).toBe(1);
        expect(check.soldiersOk).toBe(false);
        expect(check.engineers).toBe(3);
        expect(check.engineersOk).toBe(true);
    });

    it('getColonyLocations returns unique colonies with counts', () => {
        addCrew(world, 'a', 'Civilian', { planetEntityId: 10, regionId: 1 });
        addCrew(world, 'b', 'Civilian', { planetEntityId: 10, regionId: 1 });
        addCrew(world, 'c', 'Civilian', { planetEntityId: 10, regionId: 2 });

        const colonies = getColonyLocations(world);
        expect(colonies).toHaveLength(2);

        const colony1 = colonies.find(c => c.regionId === 1);
        expect(colony1?.count).toBe(2);
    });

    it('getLocationLabel returns ship label', () => {
        expect(getLocationLabel(world, { type: 'ship' })).toBe('ESV-7 (SHIP)');
    });

    it('getLocationLabel returns colony label with planet name', () => {
        const planet = world.createEntity('newTerra');
        const label = getLocationLabel(world, {
            type: 'colony',
            planetEntityId: planet.id,
            regionId: 3,
        });
        expect(label).toContain('NEWTERRA');
        expect(label).toContain('REGION 3');
    });

    // --- Scout utilities ---

    it('getCrewAtScout returns pilot for given scout entity', () => {
        const scoutEntity = world.createEntity('scoutAlpha');
        const entity = world.createEntity('pilot');
        const crew = entity.addComponent(new CrewMemberComponent(
            'Lt. Kira Yossef', 33, 'Pilot', 58, ['Determined', 'Protective'],
            'Test backstory',
        ));
        crew.location = { type: 'scout', scoutEntityId: scoutEntity.id };

        const result = getCrewAtScout(world, scoutEntity.id);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(entity.id);
    });

    it('getScoutLocations returns all scout locations with crew counts', () => {
        const scout1 = world.createEntity('scoutAlpha');
        const scout2 = world.createEntity('scoutBeta');

        const pilot1 = world.createEntity('p1');
        const c1 = pilot1.addComponent(new CrewMemberComponent(
            'Pilot 1', 30, 'Pilot', 55, ['Quiet', 'Analytical'], 'bg',
        ));
        c1.location = { type: 'scout', scoutEntityId: scout1.id };

        const pilot2 = world.createEntity('p2');
        const c2 = pilot2.addComponent(new CrewMemberComponent(
            'Pilot 2', 25, 'Pilot', 50, ['Reckless', 'Hopeful'], 'bg',
        ));
        c2.location = { type: 'scout', scoutEntityId: scout2.id };

        const locations = getScoutLocations(world);
        expect(locations).toHaveLength(2);
    });

    it('getCrewCounts excludes dead crew from total', () => {
        addCrew(world, 'alive', 'Soldier');
        const deadEntity = world.createEntity('dead');
        const dead = deadEntity.addComponent(new CrewMemberComponent(
            'Dead Person', 40, 'Soldier', 50, ['Haunted', 'Quiet'], 'bg',
        ));
        dead.location = { type: 'dead' };

        const counts = getCrewCounts(world);
        expect(counts.ship).toBe(1);
        expect(counts.dead).toBe(1);
        expect(counts.total).toBe(1); // dead not in total
    });

    it('getLocationLabel returns DECEASED for dead location', () => {
        const label = getLocationLabel(world, { type: 'dead' });
        expect(label).toBe('DECEASED');
    });
});
