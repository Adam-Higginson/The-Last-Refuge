import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { CrewMemberComponent } from '../../components/CrewMemberComponent';
import {
    getCrewAtShip,
    getCrewAtColony,
    getCrewCounts,
    getShipRoleCounts,
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
});
