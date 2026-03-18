// resources.ts — Resource type definitions and starting configuration.

export type ResourceType = 'food' | 'materials' | 'energy';

export const RESOURCE_TYPES: readonly ResourceType[] = ['food', 'materials', 'energy'];

export interface ResourceConfig {
    startingAmount: number;
    startingCap: number;
    icon: string;
    label: string;
    description: string;
}

export const RESOURCE_CONFIGS: Record<ResourceType, ResourceConfig> = {
    food: { startingAmount: 200, startingCap: 300, icon: '\uD83C\uDF4E', label: 'FOOD', description: 'Feeds your population. Each person consumes 0.2 per turn. Produced by Farms and Hydroponics.' },
    materials: { startingAmount: 60, startingCap: 150, icon: '\u26CF', label: 'MAT', description: 'Raw construction resources. Used to build structures. Mined from planets or salvaged.' },
    energy: { startingAmount: 80, startingCap: 200, icon: '\u26A1', label: 'NRG', description: 'Powers structures and the ship. Unpowered buildings stop functioning. Ship reactor provides baseline supply.' },
};

/** Food consumed per person per turn. */
export const FOOD_PER_PERSON = 0.2;

/** Passive energy produced by the ship reactor each turn. */
export const SHIP_REACTOR_ENERGY = 8;
