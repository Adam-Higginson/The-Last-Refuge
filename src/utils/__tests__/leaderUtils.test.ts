import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { CrewMemberComponent } from '../../components/CrewMemberComponent';
import {
    getColonyLeader,
    getShipCaptain,
    appointLeader,
    removeLeader,
    appointCaptain,
    removeCaptain,
} from '../leaderUtils';

function addCrew(
    world: World,
    name: string,
    role: 'Engineer' | 'Soldier' | 'Medic' | 'Scientist' | 'Civilian',
    location: 'ship' | { planetEntityId: number; regionId: number } = 'ship',
): { entity: ReturnType<World['createEntity']>; crew: CrewMemberComponent } {
    const entity = world.createEntity(name);
    const crew = entity.addComponent(
        new CrewMemberComponent(name, 30, role, 50, ['Quiet', 'Hopeful'], 'Test backstory'),
    );
    if (location !== 'ship') {
        crew.location = { type: 'colony', ...location };
    }
    return { entity, crew };
}

describe('leaderUtils', () => {
    let world: World;

    beforeEach(() => {
        ServiceLocator.clear();
        world = new World();
        ServiceLocator.register('world', world);
    });

    // --- getColonyLeader ---

    it('getColonyLeader returns null when no leader', () => {
        addCrew(world, 'a', 'Civilian', { planetEntityId: 10, regionId: 1 });
        expect(getColonyLeader(world, 10, 1)).toBeNull();
    });

    it('getColonyLeader returns the leader entity', () => {
        const { entity, crew } = addCrew(world, 'a', 'Civilian', { planetEntityId: 10, regionId: 1 });
        crew.isLeader = true;
        expect(getColonyLeader(world, 10, 1)).toBe(entity);
    });

    // --- getShipCaptain ---

    it('getShipCaptain returns null when no captain', () => {
        addCrew(world, 'a', 'Soldier');
        expect(getShipCaptain(world)).toBeNull();
    });

    it('getShipCaptain returns the captain entity', () => {
        const { entity, crew } = addCrew(world, 'a', 'Soldier');
        crew.isCaptain = true;
        expect(getShipCaptain(world)).toBe(entity);
    });

    // --- appointLeader ---

    it('appointLeader sets isLeader on the crew member', () => {
        const { entity, crew } = addCrew(world, 'a', 'Civilian', { planetEntityId: 10, regionId: 1 });
        appointLeader(world, entity.id);
        expect(crew.isLeader).toBe(true);
    });

    it('appointLeader clears previous leader at same colony', () => {
        const { entity: a, crew: crewA } = addCrew(world, 'a', 'Civilian', { planetEntityId: 10, regionId: 1 });
        const { entity: b, crew: crewB } = addCrew(world, 'b', 'Soldier', { planetEntityId: 10, regionId: 1 });

        appointLeader(world, a.id);
        expect(crewA.isLeader).toBe(true);

        appointLeader(world, b.id);
        expect(crewA.isLeader).toBe(false);
        expect(crewB.isLeader).toBe(true);
    });

    it('appointLeader does not affect leaders at other colonies', () => {
        const { entity: a, crew: crewA } = addCrew(world, 'a', 'Civilian', { planetEntityId: 10, regionId: 1 });
        const { entity: b } = addCrew(world, 'b', 'Soldier', { planetEntityId: 10, regionId: 2 });

        appointLeader(world, a.id);
        appointLeader(world, b.id);
        expect(crewA.isLeader).toBe(true); // still leader of region 1
    });

    it('appointLeader returns false for ship crew', () => {
        const { entity } = addCrew(world, 'a', 'Civilian');
        expect(appointLeader(world, entity.id)).toBe(false);
    });

    // --- removeLeader ---

    it('removeLeader clears isLeader', () => {
        const { entity, crew } = addCrew(world, 'a', 'Civilian', { planetEntityId: 10, regionId: 1 });
        crew.isLeader = true;
        removeLeader(world, entity.id);
        expect(crew.isLeader).toBe(false);
    });

    // --- appointCaptain ---

    it('appointCaptain sets isCaptain', () => {
        const { entity, crew } = addCrew(world, 'a', 'Soldier');
        appointCaptain(world, entity.id);
        expect(crew.isCaptain).toBe(true);
    });

    it('appointCaptain clears previous captain', () => {
        const { entity: a, crew: crewA } = addCrew(world, 'a', 'Soldier');
        const { entity: b, crew: crewB } = addCrew(world, 'b', 'Engineer');

        appointCaptain(world, a.id);
        appointCaptain(world, b.id);
        expect(crewA.isCaptain).toBe(false);
        expect(crewB.isCaptain).toBe(true);
    });

    it('appointCaptain returns false for colony crew', () => {
        const { entity } = addCrew(world, 'a', 'Soldier', { planetEntityId: 10, regionId: 1 });
        expect(appointCaptain(world, entity.id)).toBe(false);
    });

    // --- removeCaptain ---

    it('removeCaptain clears isCaptain', () => {
        const { entity, crew } = addCrew(world, 'a', 'Soldier');
        crew.isCaptain = true;
        removeCaptain(world, entity.id);
        expect(crew.isCaptain).toBe(false);
    });
});
