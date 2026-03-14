// crewUtils.ts — Crew location query helpers.

import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { SHIP_MIN_SOLDIERS, SHIP_MIN_ENGINEERS } from '../data/constants';
import type { CrewRole, CrewLocation } from '../components/CrewMemberComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Get all crew entities at a given location type. */
export function getCrewAtShip(world: World): Entity[] {
    return world.getEntitiesWithComponent(CrewMemberComponent).filter(e => {
        const crew = e.getComponent(CrewMemberComponent);
        return crew?.location.type === 'ship';
    });
}

/** Get all crew entities at a specific colony. */
export function getCrewAtColony(world: World, planetEntityId: number, regionId: number): Entity[] {
    return world.getEntitiesWithComponent(CrewMemberComponent).filter(e => {
        const crew = e.getComponent(CrewMemberComponent);
        if (!crew || crew.location.type !== 'colony') return false;
        return crew.location.planetEntityId === planetEntityId && crew.location.regionId === regionId;
    });
}

/** Count crew by location. */
export function getCrewCounts(world: World): { ship: number; colony: number; total: number } {
    let ship = 0;
    let colony = 0;
    for (const entity of world.getEntitiesWithComponent(CrewMemberComponent)) {
        const crew = entity.getComponent(CrewMemberComponent);
        if (!crew) continue;
        if (crew.location.type === 'ship') ship++;
        else colony++;
    }
    return { ship, colony, total: ship + colony };
}

/** Count roles among crew at the ship. */
export function getShipRoleCounts(world: World): Record<CrewRole, number> {
    const counts: Record<CrewRole, number> = {
        Engineer: 0,
        Soldier: 0,
        Medic: 0,
        Scientist: 0,
        Civilian: 0,
    };
    for (const entity of getCrewAtShip(world)) {
        const crew = entity.getComponent(CrewMemberComponent);
        if (crew) counts[crew.role]++;
    }
    return counts;
}

/** Check if ship meets minimum crew requirements. */
export function checkShipMinimums(world: World): {
    soldiers: number;
    engineers: number;
    soldiersOk: boolean;
    engineersOk: boolean;
} {
    const roles = getShipRoleCounts(world);
    return {
        soldiers: roles.Soldier,
        engineers: roles.Engineer,
        soldiersOk: roles.Soldier >= SHIP_MIN_SOLDIERS,
        engineersOk: roles.Engineer >= SHIP_MIN_ENGINEERS,
    };
}

/** Get all unique colony locations that have crew assigned. */
export function getColonyLocations(world: World): { planetEntityId: number; regionId: number; count: number; label: string }[] {
    const colonies = new Map<string, { planetEntityId: number; regionId: number; count: number }>();

    for (const entity of world.getEntitiesWithComponent(CrewMemberComponent)) {
        const crew = entity.getComponent(CrewMemberComponent);
        if (!crew || crew.location.type !== 'colony') continue;

        const key = `${crew.location.planetEntityId}:${crew.location.regionId}`;
        const existing = colonies.get(key);
        if (existing) {
            existing.count++;
        } else {
            colonies.set(key, {
                planetEntityId: crew.location.planetEntityId,
                regionId: crew.location.regionId,
                count: 1,
            });
        }
    }

    return [...colonies.values()].map(c => ({
        ...c,
        label: getColonyLabel(world, c.planetEntityId, c.regionId),
    }));
}

/** Get a human-readable label for a colony location. */
export function getColonyLabel(world: World, planetEntityId: number, regionId: number): string {
    const planet = world.getEntity(planetEntityId);
    const planetName = planet?.name ?? 'Unknown';
    return `${planetName.toUpperCase()} — REGION ${regionId}`;
}

/** Get a human-readable label for any crew location. */
export function getLocationLabel(world: World, location: CrewLocation): string {
    if (location.type === 'ship') return 'ESV-7 (SHIP)';
    return getColonyLabel(world, location.planetEntityId, location.regionId);
}
