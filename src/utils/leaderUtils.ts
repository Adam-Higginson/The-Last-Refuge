// leaderUtils.ts — Leader and captain query/mutation helpers.

import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { getCrewAtShip, getCrewAtColony } from './crewUtils';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Get the colony leader at a specific colony, or null. */
export function getColonyLeader(world: World, planetEntityId: number, regionId: number): Entity | null {
    for (const entity of getCrewAtColony(world, planetEntityId, regionId)) {
        const crew = entity.getComponent(CrewMemberComponent);
        if (crew?.isLeader) return entity;
    }
    return null;
}

/** Get the ship captain, or null. */
export function getShipCaptain(world: World): Entity | null {
    for (const entity of getCrewAtShip(world)) {
        const crew = entity.getComponent(CrewMemberComponent);
        if (crew?.isCaptain) return entity;
    }
    return null;
}

/** Appoint a crew member as leader of their colony. Clears any previous leader at that colony. */
export function appointLeader(world: World, crewEntityId: number): boolean {
    const entity = world.getEntity(crewEntityId);
    const crew = entity?.getComponent(CrewMemberComponent);
    if (!crew || crew.location.type !== 'colony') return false;

    // Clear previous leader at this colony
    const prevLeader = getColonyLeader(world, crew.location.planetEntityId, crew.location.regionId);
    if (prevLeader) {
        const prevCrew = prevLeader.getComponent(CrewMemberComponent);
        if (prevCrew) prevCrew.isLeader = false;
    }

    crew.isLeader = true;
    return true;
}

/** Remove a crew member's leader status. */
export function removeLeader(world: World, crewEntityId: number): boolean {
    const entity = world.getEntity(crewEntityId);
    const crew = entity?.getComponent(CrewMemberComponent);
    if (!crew) return false;
    crew.isLeader = false;
    return true;
}

/** Appoint a crew member as ship captain. Clears any previous captain. */
export function appointCaptain(world: World, crewEntityId: number): boolean {
    const entity = world.getEntity(crewEntityId);
    const crew = entity?.getComponent(CrewMemberComponent);
    if (!crew || crew.location.type !== 'ship') return false;

    // Clear previous captain
    const prevCaptain = getShipCaptain(world);
    if (prevCaptain) {
        const prevCrew = prevCaptain.getComponent(CrewMemberComponent);
        if (prevCrew) prevCrew.isCaptain = false;
    }

    crew.isCaptain = true;
    return true;
}

/** Remove a crew member's captain status. */
export function removeCaptain(world: World, crewEntityId: number): boolean {
    const entity = world.getEntity(crewEntityId);
    const crew = entity?.getComponent(CrewMemberComponent);
    if (!crew) return false;
    crew.isCaptain = false;
    return true;
}
