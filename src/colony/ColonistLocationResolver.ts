// ColonistLocationResolver.ts — Location resolution and spatial spreading for colonists.
// Extracted from ColonistManager.ts for module separation.

import type { ColonySimulationComponent } from '../components/ColonySimulationComponent';
import type { ColonyGrid } from './ColonyGrid';
import type { CrewRole } from '../components/CrewMemberComponent';
import type { BuildingInstance } from '../data/buildings';

export interface ResolvedLocation {
    gridX: number;
    gridY: number;
    buildingSlot: number | null;
    buildingTypeId: string | null;
}

/**
 * Spread colonists to nearby walkable cells around a target, avoiding pixel-stacking.
 * Returns a deterministic cell based on entityId so each colonist gets a unique spot.
 */
export function spreadAroundCell(
    grid: ColonyGrid, targetX: number, targetY: number, entityId: number,
): { gridX: number; gridY: number } {
    const walkable: { gridX: number; gridY: number }[] = [];
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > 2) continue; // Manhattan distance <= 2
            const gx = targetX + dx;
            const gy = targetY + dy;
            const cell = grid.getCell(gx, gy);
            if (cell && (cell.type === 'empty' || cell.type === 'path' || cell.type === 'door')) {
                walkable.push({ gridX: gx, gridY: gy });
            }
        }
    }
    if (walkable.length === 0) return { gridX: targetX, gridY: targetY };
    return walkable[entityId % walkable.length];
}

const ROLE_BUILDINGS: Record<string, string[]> = {
    Civilian: ['farm', 'hydroponics_bay'],
    Engineer: ['solar_array', 'workshop', 'hydroponics_bay'],
    Medic: ['med_bay'],
    Scientist: ['workshop'],
    Soldier: ['barracks'],
};

/** Resolve a schedule location to a grid cell. */
export function resolveLocation(
    sim: ColonySimulationComponent,
    location: string,
    role: CrewRole,
    buildings: BuildingInstance[],
    entityId: number,
): ResolvedLocation | null {
    if (location === 'social_area') {
        if (!sim.campfireCell) return null;
        const spread = spreadAroundCell(sim.grid, sim.campfireCell.gridX, sim.campfireCell.gridY, entityId);
        return { ...spread, buildingSlot: null, buildingTypeId: null };
    }

    if (location === 'shelter') {
        const shelterDoor = sim.grid.getDoors().find(d => d.slotIndex === 0);
        if (shelterDoor) {
            const spread = spreadAroundCell(sim.grid, shelterDoor.gridX, shelterDoor.gridY, entityId);
            return { gridX: spread.gridX, gridY: spread.gridY, buildingSlot: 0, buildingTypeId: 'shelter' };
        }
        if (!sim.campfireCell) return null;
        const spread = spreadAroundCell(sim.grid, sim.campfireCell.gridX, sim.campfireCell.gridY, entityId);
        return { ...spread, buildingSlot: null, buildingTypeId: null };
    }

    if (location === 'patrol') {
        // Soldiers use perimeter path — handled separately
        return null;
    }

    if (location === 'workplace') {
        const roleBuildings = buildings.filter(b =>
            ROLE_BUILDINGS[role]?.includes(b.typeId) && b.state === 'active',
        );

        if (roleBuildings.length > 0) {
            // Round-robin by entity ID
            const building = roleBuildings[entityId % roleBuildings.length];

            // Spread around building door for variety (door is always on a walkable cell)
            const door = sim.grid.getDoors().find(d => d.slotIndex === building.slotIndex);
            if (door) {
                const spread = spreadAroundCell(sim.grid, door.gridX, door.gridY, entityId);
                return { ...spread, buildingSlot: building.slotIndex, buildingTypeId: building.typeId };
            }

            // Fallback: building center (round to integer grid coords)
            const center = sim.grid.getBuildingCenter(building.slotIndex);
            if (center) return { gridX: Math.round(center.gridX), gridY: Math.round(center.gridY), buildingSlot: building.slotIndex, buildingTypeId: building.typeId };
        }

        // No building for this role — go to campfire
        if (!sim.campfireCell) return null;
        const fallback = spreadAroundCell(sim.grid, sim.campfireCell.gridX, sim.campfireCell.gridY, entityId);
        return { ...fallback, buildingSlot: null, buildingTypeId: null };
    }

    return null;
}
