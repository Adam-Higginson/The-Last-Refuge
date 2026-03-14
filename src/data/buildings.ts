// buildings.ts — Static building type definitions for habitable planet colonies.

import type { CrewRole } from '../components/CrewMemberComponent';
import type { HabitableBiomeName } from './biomes';
import type { ResourceType } from './resources';

export type BuildingId =
    | 'shelter' | 'farm' | 'solar_array' | 'storage_depot'
    | 'workshop' | 'med_bay' | 'barracks' | 'hydroponics_bay';

export type BuildingTier = 1 | 2;

export interface WorkerRequirement {
    role: CrewRole;
    count: number;
}

export interface BuildingEffect {
    type: 'production' | 'consumption' | 'storage_cap' | 'housing' | 'morale' | 'military_housing';
    resource?: ResourceType;
    amount: number;
}

export interface BuildingType {
    id: BuildingId;
    name: string;
    tier: BuildingTier;
    materialCost: number;
    buildTime: number;
    energyPerTurn: number;
    workers: WorkerRequirement | null;
    effects: BuildingEffect[];
    description: string;
}

export const BUILDING_TYPES: Record<BuildingId, BuildingType> = {
    shelter: {
        id: 'shelter',
        name: 'Shelter',
        tier: 1,
        materialCost: 10,
        buildTime: 1,
        energyPerTurn: 0,
        workers: null,
        effects: [
            { type: 'housing', amount: 10 },
        ],
        description: 'Houses 10 colonists. Required for population.',
    },
    farm: {
        id: 'farm',
        name: 'Farm',
        tier: 1,
        materialCost: 15,
        buildTime: 2,
        energyPerTurn: 1,
        workers: { role: 'Civilian', count: 2 },
        effects: [
            { type: 'production', resource: 'food', amount: 8 },
        ],
        description: 'Produces 8 Food/turn. Requires 2 Civilians.',
    },
    solar_array: {
        id: 'solar_array',
        name: 'Solar Array',
        tier: 1,
        materialCost: 20,
        buildTime: 2,
        energyPerTurn: 0,
        workers: { role: 'Engineer', count: 1 },
        effects: [
            { type: 'production', resource: 'energy', amount: 10 },
        ],
        description: 'Produces 10 Energy/turn. Requires 1 Engineer.',
    },
    storage_depot: {
        id: 'storage_depot',
        name: 'Storage Depot',
        tier: 1,
        materialCost: 20,
        buildTime: 2,
        energyPerTurn: 1,
        workers: null,
        effects: [
            { type: 'storage_cap', resource: 'food', amount: 100 },
            { type: 'storage_cap', resource: 'materials', amount: 100 },
            { type: 'storage_cap', resource: 'energy', amount: 100 },
        ],
        description: '+100 to all resource storage caps.',
    },
    workshop: {
        id: 'workshop',
        name: 'Workshop',
        tier: 2,
        materialCost: 25,
        buildTime: 3,
        energyPerTurn: 3,
        workers: { role: 'Engineer', count: 2 },
        effects: [
            { type: 'production', resource: 'materials', amount: 6 },
        ],
        description: 'Produces 6 Materials/turn. Requires 2 Engineers.',
    },
    med_bay: {
        id: 'med_bay',
        name: 'Med Bay',
        tier: 2,
        materialCost: 30,
        buildTime: 3,
        energyPerTurn: 2,
        workers: { role: 'Medic', count: 1 },
        effects: [
            { type: 'morale', amount: 15 },
        ],
        description: '+15 colony morale. Requires 1 Medic.',
    },
    barracks: {
        id: 'barracks',
        name: 'Barracks',
        tier: 2,
        materialCost: 20,
        buildTime: 2,
        energyPerTurn: 2,
        workers: null,
        effects: [
            { type: 'military_housing', amount: 5 },
        ],
        description: 'Houses 5 Soldiers. Enables garrison.',
    },
    hydroponics_bay: {
        id: 'hydroponics_bay',
        name: 'Hydroponics Bay',
        tier: 2,
        materialCost: 35,
        buildTime: 3,
        energyPerTurn: 4,
        workers: { role: 'Engineer', count: 1 },
        effects: [
            { type: 'production', resource: 'food', amount: 12 },
        ],
        description: 'Produces 12 Food/turn. Energy-hungry. Requires 1 Engineer.',
    },
};

/** Get a building type by ID. */
export function getBuildingType(id: BuildingId): BuildingType {
    return BUILDING_TYPES[id];
}

/** Get available buildings for a given colony count (for tier gating). */
export function getAvailableBuildings(colonyCount: number): BuildingType[] {
    return Object.values(BUILDING_TYPES).filter(b => {
        if (b.tier === 1) return true;
        if (b.tier === 2) return colonyCount >= 1;
        return false;
    });
}

/** Building instance stored on a Region. */
export interface BuildingInstance {
    typeId: BuildingId;
    slotIndex: number;
    state: 'constructing' | 'active' | 'idle' | 'disabled';
    turnsRemaining: number;
    modifierIds: string[];
}

/** Default building slots by biome type. */
export const BUILDING_SLOTS_BY_BIOME: Record<HabitableBiomeName, number> = {
    'Temperate Plains': 6,
    'Arctic Wastes': 4,
    'Dense Jungle': 5,
    'Volcanic Highlands': 4,
    'Ocean': 0,
};

/** Default building slots for unknown biomes. */
export const DEFAULT_BUILDING_SLOTS = 5;
