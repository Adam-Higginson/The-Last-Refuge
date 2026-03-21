// buildingVisuals.ts — Data-driven config for building-associated prop placement.
// Props are placed at grid offsets relative to the building's grid position,
// preferring the "door side" (bottom-right in isometric = front face).

export interface BuildingPropPlacement {
    /** Matches an existing draw function name: 'crates', 'barrel', 'toolRack', etc. */
    type: string;
    /** Grid offset from building top-left corner (in cell units). */
    gridOffsetX: number;
    gridOffsetY: number;
    /** Added to the deterministic seed for visual variation. */
    seedOffset: number;
}

export interface BuildingPropConfig {
    /** Props placed relative to the building's grid position. */
    props: BuildingPropPlacement[];
}

export const BUILDING_PROP_CONFIG: Record<string, BuildingPropConfig> = {
    shelter: {
        props: [
            { type: 'supplyCrate', gridOffsetX: 2, gridOffsetY: 1, seedOffset: 0 },
        ],
    },
    storage_depot: {
        props: [
            { type: 'crates', gridOffsetX: -1, gridOffsetY: 0, seedOffset: 0 },
            { type: 'barrel', gridOffsetX: 2, gridOffsetY: 1, seedOffset: 3 },
        ],
    },
    workshop: {
        props: [
            { type: 'toolRack', gridOffsetX: -1, gridOffsetY: 0, seedOffset: 0 },
            { type: 'anvil', gridOffsetX: 2, gridOffsetY: 1, seedOffset: 1 },
        ],
    },
    farm: {
        props: [
            { type: 'waterTrough', gridOffsetX: 3, gridOffsetY: 1, seedOffset: 0 },
        ],
    },
    med_bay: {
        props: [
            { type: 'supplyCrate', gridOffsetX: 2, gridOffsetY: 0, seedOffset: 0 },
        ],
    },
    barracks: {
        props: [
            { type: 'flagPole', gridOffsetX: -1, gridOffsetY: 0, seedOffset: 0 },
        ],
    },
    solar_array: {
        props: [
            { type: 'controlBox', gridOffsetX: 2, gridOffsetY: 1, seedOffset: 0 },
        ],
    },
    hydroponics_bay: {
        props: [
            { type: 'waterTank', gridOffsetX: -1, gridOffsetY: 1, seedOffset: 0 },
        ],
    },
};
