// ColonyBuildingComponent.ts — Manages colony buildings on a planet entity.
// Progresses construction on TURN_END, registers resource modifiers for
// active buildings, and handles staffing calculations.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { RegionDataComponent } from './RegionDataComponent';
import { ResourceComponent } from './ResourceComponent';
import { CrewMemberComponent } from './CrewMemberComponent';
import { getBuildingType, BUILDING_TYPES } from '../data/buildings';
import { getCrewAtColony } from '../utils/crewUtils';
import type { BuildingInstance, BuildingId } from '../data/buildings';
import type { CrewRole } from './CrewMemberComponent';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { World } from '../core/World';

export class ColonyBuildingComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private turnEndHandler: EventHandler | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.turnEndHandler = (): void => {
            this.processTurn();
        };
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
    }

    /** Start construction of a building in a region. Returns true if successful. */
    startConstruction(regionId: number, buildingId: BuildingId): boolean {
        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!regionData) return false;

        const region = regionData.regions.find(r => r.id === regionId);
        if (!region || !region.colonised) return false;

        // Check for available slots
        if (region.buildings.length >= region.buildingSlots) return false;

        // Check affordability
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const resources = gameState?.getComponent(ResourceComponent);
        if (!resources) return false;

        const buildingType = getBuildingType(buildingId);
        if (!resources.canAfford('materials', buildingType.materialCost)) return false;

        // Deduct cost
        resources.deduct('materials', buildingType.materialCost);

        // Create building instance
        const slotIndex = region.buildings.length;
        const building: BuildingInstance = {
            typeId: buildingId,
            slotIndex,
            state: 'constructing',
            turnsRemaining: buildingType.buildTime,
            modifierIds: [],
        };

        region.buildings.push(building);
        this.eventQueue?.emit({ type: GameEvents.BUILDING_STARTED });

        return true;
    }

    /** Demolish a building in a region. Removes resource modifiers. */
    demolish(regionId: number, slotIndex: number): boolean {
        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!regionData) return false;

        const region = regionData.regions.find(r => r.id === regionId);
        if (!region) return false;

        const buildingIdx = region.buildings.findIndex(b => b.slotIndex === slotIndex);
        if (buildingIdx === -1) return false;

        const building = region.buildings[buildingIdx];

        // Remove resource modifiers
        this.removeModifiers(building);

        region.buildings.splice(buildingIdx, 1);
        this.eventQueue?.emit({ type: GameEvents.BUILDING_DEMOLISHED });

        return true;
    }

    destroy(): void {
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
    }

    private processTurn(): void {
        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!regionData) return;

        const world = ServiceLocator.get<World>('world');

        for (const region of regionData.regions) {
            if (!region.colonised) continue;

            for (const building of region.buildings) {
                if (building.state === 'constructing') {
                    building.turnsRemaining--;
                    if (building.turnsRemaining <= 0) {
                        building.turnsRemaining = 0;
                        building.state = 'active';
                        this.activateBuilding(building, region.id, world);
                        this.eventQueue?.emit({ type: GameEvents.BUILDING_COMPLETED });
                    }
                }

                // Recalculate staffing for active buildings each turn
                if (building.state === 'active') {
                    this.updateStaffing(building, region.id, world);
                }
            }
        }
    }

    private activateBuilding(building: BuildingInstance, regionId: number, world: World): void {
        const buildingType = getBuildingType(building.typeId);
        const gameState = world.getEntityByName('gameState');
        const resources = gameState?.getComponent(ResourceComponent);
        if (!resources) return;

        const planetId = this.entity.id;
        const baseId = `building:${building.typeId}:${planetId}:${regionId}:${building.slotIndex}`;

        // Register production modifiers
        for (const effect of buildingType.effects) {
            if (effect.type === 'production' && effect.resource) {
                const modId = `${baseId}:${effect.resource}`;
                resources.addModifier({
                    id: modId,
                    resource: effect.resource,
                    amount: effect.amount,
                    source: `${buildingType.name} (Region ${regionId})`,
                });
                building.modifierIds.push(modId);
            }
            if (effect.type === 'storage_cap' && effect.resource) {
                resources.resources[effect.resource].cap += effect.amount;
            }
        }

        // Register energy consumption
        if (buildingType.energyPerTurn > 0) {
            const energyModId = `${baseId}:energy:consumption`;
            resources.addModifier({
                id: energyModId,
                resource: 'energy',
                amount: -buildingType.energyPerTurn,
                source: `${buildingType.name} (Region ${regionId})`,
            });
            building.modifierIds.push(energyModId);
        }
    }

    private removeModifiers(building: BuildingInstance): void {
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const resources = gameState?.getComponent(ResourceComponent);
        if (!resources) return;

        for (const modId of building.modifierIds) {
            resources.removeModifier(modId);
        }

        // Reverse storage cap increases
        const buildingType = getBuildingType(building.typeId);
        for (const effect of buildingType.effects) {
            if (effect.type === 'storage_cap' && effect.resource) {
                resources.resources[effect.resource].cap -= effect.amount;
            }
        }

        building.modifierIds = [];
    }

    private updateStaffing(building: BuildingInstance, regionId: number, world: World): void {
        const buildingType = getBuildingType(building.typeId);
        if (!buildingType.workers) return; // No workers needed

        const gameState = world.getEntityByName('gameState');
        const resources = gameState?.getComponent(ResourceComponent);
        if (!resources) return;

        // Count available workers of the required role at this colony (excluding leaders)
        const colonyCrew = getCrewAtColony(world, this.entity.id, regionId);
        const requiredRole = buildingType.workers.role;
        const available = colonyCrew.filter(e => {
            const c = e.getComponent(CrewMemberComponent);
            return c && c.role === requiredRole && !c.isLeader;
        }).length;

        // Total required for all buildings of this role at this colony
        let totalRequired = 0;
        const region = this.entity.getComponent(RegionDataComponent)?.regions.find(r => r.id === regionId);
        if (region) {
            for (const b of region.buildings) {
                if (b.state !== 'active') continue;
                const bt = BUILDING_TYPES[b.typeId];
                if (bt.workers?.role === requiredRole) {
                    totalRequired += bt.workers.count;
                }
            }
        }

        // Staffing ratio
        const ratio = totalRequired > 0 ? Math.min(1, available / totalRequired) : 1;

        // Update production modifiers based on staffing ratio
        const planetId = this.entity.id;
        const baseId = `building:${building.typeId}:${planetId}:${regionId}:${building.slotIndex}`;

        for (const effect of buildingType.effects) {
            if (effect.type === 'production' && effect.resource) {
                const modId = `${baseId}:${effect.resource}`;
                // Update the modifier amount scaled by staffing ratio
                const existingMod = resources.getModifiers(effect.resource).find(m => m.id === modId);
                if (existingMod) {
                    // Cast away readonly to update amount (modifiers are owned by ResourceComponent)
                    (existingMod as { amount: number }).amount = Math.round(effect.amount * ratio);
                }
            }
        }
    }

    /** Get the staffing ratio for a specific role at a colony region. */
    getStaffingRatio(regionId: number, role: CrewRole): number {
        const world = ServiceLocator.get<World>('world');
        const colonyCrew = getCrewAtColony(world, this.entity.id, regionId);
        const available = colonyCrew.filter(e => {
            const c = e.getComponent(CrewMemberComponent);
            return c && c.role === role && !c.isLeader;
        }).length;

        const region = this.entity.getComponent(RegionDataComponent)?.regions.find(r => r.id === regionId);
        let totalRequired = 0;
        if (region) {
            for (const b of region.buildings) {
                if (b.state !== 'active') continue;
                const bt = BUILDING_TYPES[b.typeId];
                if (bt.workers?.role === role) {
                    totalRequired += bt.workers.count;
                }
            }
        }

        return totalRequired > 0 ? Math.min(1, available / totalRequired) : 1;
    }
}
