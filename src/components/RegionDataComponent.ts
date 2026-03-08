// RegionDataComponent.ts — Planet surface regions and biome data.
// Attached to the planet entity. Read by the planet view renderer.
// Subscribes to CANVAS_RESIZE to regenerate voronoi regions at new dimensions.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { REGION_COUNT } from '../entities/createPlanet';
import { generateVoronoi } from '../utils/voronoi';
import { assignBiomes } from '../data/biomes';
import { mulberry32 } from '../utils/prng';
import type { CanvasResizeEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Voronoi seed — must match the initial generation in createPlanet.ts */
const VORONOI_SEED = 7;

export interface Region {
    id: number;
    biome: 'Temperate Plains' | 'Arctic Wastes' | 'Dense Jungle' | 'Volcanic Highlands' | 'Ocean';
    colour: string;
    canColonise: boolean;
    colonised: boolean;
    isLandingZone: boolean;
    vertices: { x: number; y: number }[];
}

export class RegionDataComponent extends Component {
    regions: Region[];
    colonised: boolean;

    private eventQueue: EventQueue | null = null;
    private resizeHandler: EventHandler | null = null;

    constructor() {
        super();
        this.regions = [];
        this.colonised = false;
    }

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.resizeHandler = (event): void => {
            const { width, height } = event as CanvasResizeEvent;
            const rng = mulberry32(VORONOI_SEED);
            const cells = generateVoronoi(width, height, REGION_COUNT, rng);
            const newRegions = assignBiomes(cells, rng, width, height);

            // Preserve colonisation state from old regions
            for (const newRegion of newRegions) {
                const oldRegion = this.regions.find(r => r.id === newRegion.id);
                if (oldRegion && oldRegion.colonised) {
                    newRegion.colonised = true;
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
