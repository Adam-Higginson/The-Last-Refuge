// RegionDataComponent.ts — Planet surface regions and biome data.
// Attached to the planet entity. Read by the planet view renderer.
// Subscribes to CANVAS_RESIZE to regenerate voronoi regions at new dimensions.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { PlanetDataComponent } from './PlanetDataComponent';
import { generateVoronoi } from '../utils/voronoi';
import { assignBiomes } from '../data/biomes';
import { mulberry32 } from '../utils/prng';
import type { BiomeName, BiomePool } from '../data/biomes';
import type { BuildingInstance } from '../data/buildings';
import type { CanvasResizeEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Voronoi seed — must match the initial generation in createPlanet.ts */
const VORONOI_SEED = 7;

export interface Region {
    id: number;
    biome: BiomeName;
    colour: string;
    canColonise: boolean;
    colonised: boolean;
    isLandingZone: boolean;
    vertices: { x: number; y: number }[];
    buildings: BuildingInstance[];
    buildingSlots: number;
}

export class RegionDataComponent extends Component {
    regions: Region[];
    colonised: boolean;
    readonly regionCount: number;

    private eventQueue: EventQueue | null = null;
    private resizeHandler: EventHandler | null = null;

    constructor(regionCount = 8) {
        super();
        this.regions = [];
        this.colonised = false;
        this.regionCount = regionCount;
    }

    private getBiomePool(): BiomePool {
        const planetData = this.entity.getComponent(PlanetDataComponent);
        return planetData?.config.biomePool ?? 'habitable';
    }

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.resizeHandler = (event): void => {
            const { width, height } = event as CanvasResizeEvent;
            const rng = mulberry32(VORONOI_SEED);
            const cells = generateVoronoi(width, height, this.regionCount, rng);
            const pool = this.getBiomePool();
            const newRegions = assignBiomes(cells, rng, width, height, pool);

            // Preserve colonisation state and buildings from old regions
            for (const newRegion of newRegions) {
                const oldRegion = this.regions.find(r => r.id === newRegion.id);
                if (oldRegion) {
                    if (oldRegion.colonised) newRegion.colonised = true;
                    if (oldRegion.buildings.length > 0) newRegion.buildings = oldRegion.buildings;
                    if (oldRegion.buildingSlots > 0) newRegion.buildingSlots = oldRegion.buildingSlots;
                }
            }

            this.regions = newRegions;
        };

        this.eventQueue.on(GameEvents.CANVAS_RESIZE, this.resizeHandler);
    }

    destroy(): void {
        if (this.eventQueue && this.resizeHandler) {
            this.eventQueue.off(GameEvents.CANVAS_RESIZE, this.resizeHandler);
        }
    }
}
