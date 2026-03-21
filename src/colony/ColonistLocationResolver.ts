// ColonistLocationResolver.ts — Location resolution and spatial spreading for colonists.
// Extracted from ColonistManager.ts for module separation.
// Phase B: relationship-aware spreading (friends cluster, rivals separate).

import { CrewMemberComponent } from '../components/CrewMemberComponent';
import type { ColonySimulationComponent } from '../components/ColonySimulationComponent';
import type { ColonyGrid } from './ColonyGrid';
import type { CrewRole } from '../components/CrewMemberComponent';
import type { BuildingInstance } from '../data/buildings';
import type { World } from '../core/World';

export interface ResolvedLocation {
    gridX: number;
    gridY: number;
    buildingSlot: number | null;
    buildingTypeId: string | null;
}

/**
 * Spread colonists to nearby walkable cells around a target, avoiding pixel-stacking.
 * Returns a deterministic cell based on entityId so each colonist gets a unique spot.
 * When occupiedPositions is provided, filters out already-occupied cells first.
 */
export function spreadAroundCell(
    grid: ColonyGrid, targetX: number, targetY: number, entityId: number,
    occupiedPositions?: Set<string>,
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

    // Filter out occupied cells when tracking is enabled
    if (occupiedPositions) {
        const available = walkable.filter(c => !occupiedPositions.has(`${c.gridX},${c.gridY}`));
        if (available.length > 0) {
            return available[entityId % available.length];
        }
        // All cells occupied — fall back to deterministic pick
    }

    return walkable[entityId % walkable.length];
}

/**
 * Relationship-aware spreading: bias cell selection toward friends/partners,
 * away from rivals. Returns a cell near `targetX/Y` that accounts for relationships.
 */
function spreadWithRelationships(
    grid: ColonyGrid,
    targetX: number, targetY: number,
    entityId: number,
    sim: ColonySimulationComponent,
    world: World,
    occupiedPositions?: Set<string>,
): { gridX: number; gridY: number } {
    const walkable: { gridX: number; gridY: number }[] = [];
    for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > 2) continue;
            const gx = targetX + dx;
            const gy = targetY + dy;
            const cell = grid.getCell(gx, gy);
            if (cell && (cell.type === 'empty' || cell.type === 'path' || cell.type === 'door')) {
                walkable.push({ gridX: gx, gridY: gy });
            }
        }
    }
    if (walkable.length === 0) return { gridX: targetX, gridY: targetY };

    // Filter out occupied cells when tracking is enabled
    const candidates = occupiedPositions
        ? walkable.filter(c => !occupiedPositions.has(`${c.gridX},${c.gridY}`))
        : walkable;
    // Use filtered candidates if any are available, otherwise fall back to all walkable
    const pool = candidates.length > 0 ? candidates : walkable;

    const entity = world.getEntity(entityId);
    const crew = entity?.getComponent(CrewMemberComponent);
    if (!crew || crew.relationships.length === 0) {
        return pool[entityId % pool.length];
    }

    // Score each cell based on proximity to friends/partners and distance from rivals
    const scores = pool.map(cell => {
        let score = 0;
        for (const rel of crew.relationships) {
            const other = sim.colonistStates.get(rel.targetId);
            if (!other) continue;
            const dist = Math.abs(cell.gridX - other.gridX) + Math.abs(cell.gridY - other.gridY);
            if (rel.type === 'Romantic' || rel.type === 'Close Bond') {
                // Prefer closer to friends/partners
                score -= dist * 2;
            } else if (rel.type === 'Mentor/Protege') {
                score -= dist;
            } else if (rel.type === 'Rival' || rel.type === 'Estranged') {
                // Prefer farther from rivals
                score += dist * 1.5;
            }
        }
        return score;
    });

    // Pick the highest-scoring cell (deterministic tiebreak by entityId)
    let bestIdx = 0;
    let bestScore = scores[0];
    for (let i = 1; i < scores.length; i++) {
        if (scores[i] > bestScore || (scores[i] === bestScore && (i % (entityId + 1)) < (bestIdx % (entityId + 1)))) {
            bestScore = scores[i];
            bestIdx = i;
        }
    }
    return pool[bestIdx];
}

/**
 * Empathetic trait: find the cell adjacent to the lowest-morale colonist at the social area.
 */
function findLowestMoraleNeighbor(
    sim: ColonySimulationComponent,
    entityId: number,
    world: World,
): { gridX: number; gridY: number } | null {
    let lowestMorale = Infinity;
    let lowestState: { gridX: number; gridY: number } | null = null;

    for (const [id, state] of sim.colonistStates) {
        if (id === entityId) continue;
        if (state.activity !== 'socializing' && state.activity !== 'idle') continue;
        const entity = world.getEntity(id);
        const crew = entity?.getComponent(CrewMemberComponent);
        if (!crew) continue;
        if (crew.morale < lowestMorale) {
            lowestMorale = crew.morale;
            lowestState = { gridX: state.gridX, gridY: state.gridY };
        }
    }

    if (!lowestState) return null;
    // Spread to a guaranteed-walkable cell adjacent to the lowest-morale colonist
    return spreadAroundCell(sim.grid, lowestState.gridX, lowestState.gridY, entityId);
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
    world?: World,
    occupiedPositions?: Set<string>,
): ResolvedLocation | null {
    if (location === 'social_area') {
        if (!sim.campfireCell) return null;

        // Empathetic trait: seek lowest-morale colonist
        if (world) {
            const entity = world.getEntity(entityId);
            const crew = entity?.getComponent(CrewMemberComponent);
            if (crew && crew.traits.includes('Empathetic')) {
                const target = findLowestMoraleNeighbor(sim, entityId, world);
                if (target) {
                    const cell = sim.grid.getCell(target.gridX, target.gridY);
                    if (cell && (cell.type === 'empty' || cell.type === 'path' || cell.type === 'door')) {
                        return { ...target, buildingSlot: null, buildingTypeId: null };
                    }
                }
            }
        }

        // Relationship-aware spreading at social area
        if (world) {
            const spread = spreadWithRelationships(sim.grid, sim.campfireCell.gridX, sim.campfireCell.gridY, entityId, sim, world, occupiedPositions);
            return { ...spread, buildingSlot: null, buildingTypeId: null };
        }

        const spread = spreadAroundCell(sim.grid, sim.campfireCell.gridX, sim.campfireCell.gridY, entityId, occupiedPositions);
        return { ...spread, buildingSlot: null, buildingTypeId: null };
    }

    if (location === 'shelter') {
        const shelterDoor = sim.grid.getDoors().find(d => d.slotIndex === 0);
        if (shelterDoor) {
            const spread = spreadAroundCell(sim.grid, shelterDoor.gridX, shelterDoor.gridY, entityId, occupiedPositions);
            return { gridX: spread.gridX, gridY: spread.gridY, buildingSlot: 0, buildingTypeId: 'shelter' };
        }
        if (!sim.campfireCell) return null;
        const spread = spreadAroundCell(sim.grid, sim.campfireCell.gridX, sim.campfireCell.gridY, entityId, occupiedPositions);
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
                // Mentor/protege: spread protege near mentor if they share a building
                if (world) {
                    const spread = spreadWithRelationships(sim.grid, door.gridX, door.gridY, entityId, sim, world, occupiedPositions);
                    return { ...spread, buildingSlot: building.slotIndex, buildingTypeId: building.typeId };
                }
                const spread = spreadAroundCell(sim.grid, door.gridX, door.gridY, entityId, occupiedPositions);
                return { ...spread, buildingSlot: building.slotIndex, buildingTypeId: building.typeId };
            }

            // Fallback: building center (round to integer grid coords)
            const center = sim.grid.getBuildingCenter(building.slotIndex);
            if (center) return { gridX: Math.round(center.gridX), gridY: Math.round(center.gridY), buildingSlot: building.slotIndex, buildingTypeId: building.typeId };
        }

        // No building for this role — go to campfire
        if (!sim.campfireCell) return null;
        const fallback = spreadAroundCell(sim.grid, sim.campfireCell.gridX, sim.campfireCell.gridY, entityId, occupiedPositions);
        return { ...fallback, buildingSlot: null, buildingTypeId: null };
    }

    return null;
}
