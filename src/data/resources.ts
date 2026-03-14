// resources.ts — Resource type definitions and starting configuration.

export type ResourceType = 'food' | 'materials' | 'energy';

export const RESOURCE_TYPES: readonly ResourceType[] = ['food', 'materials', 'energy'];

export interface ResourceConfig {
    startingAmount: number;
    startingCap: number;
    icon: string;
    label: string;
}

export const RESOURCE_CONFIGS: Record<ResourceType, ResourceConfig> = {
    food: { startingAmount: 100, startingCap: 200, icon: '\u25C6', label: 'FOOD' },
    materials: { startingAmount: 50, startingCap: 150, icon: '\u26CF', label: 'MAT' },
    energy: { startingAmount: 80, startingCap: 200, icon: '\u26A1', label: 'NRG' },
};

/** Food consumed per person per turn. */
export const FOOD_PER_PERSON = 1;

/** Passive energy produced by the ship reactor each turn. */
export const SHIP_REACTOR_ENERGY = 5;
