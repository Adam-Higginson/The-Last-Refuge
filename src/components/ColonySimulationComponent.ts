// ColonySimulationComponent.ts — Owns colony grid, path network, and colonist states.
// Lives on the planet entity alongside ColonySceneStateComponent.
// Simulation runs in update(dt) — proper ECS lifecycle.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { ColonyGrid } from '../colony/ColonyGrid';
import { generatePathNetwork } from '../colony/ColonyPathNetwork';
import { initColonists, updateColonists, addColonist } from '../colony/ColonistManager';
import { CrewMemberComponent } from './CrewMemberComponent';
import { ColonySceneStateComponent } from './ColonySceneStateComponent';
import { RegionDataComponent } from './RegionDataComponent';
import { getCrewAtColony } from '../utils/crewUtils';
import type { CrewTransferredEvent } from '../core/GameEvents';
import type { ColonistVisualState } from '../colony/ColonistState';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { World } from '../core/World';

export class ColonySimulationComponent extends Component {
    grid: ColonyGrid = new ColonyGrid();
    colonistStates: Map<number, ColonistVisualState> = new Map();
    campfireCell: { gridX: number; gridY: number } | null = null;
    perimeterPath: { gridX: number; gridY: number }[] = [];
    debugGridVisible = false;

    private eventQueue: EventQueue | null = null;
    private buildingHandler: EventHandler | null = null;
    private crewTransferHandler: EventHandler | null = null;
    private initialized = false;
    private activeRegionId: number | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        // Listen for building changes to rebuild grid
        this.buildingHandler = (): void => {
            this.rebuildGrid();
        };
        this.eventQueue.on(GameEvents.BUILDING_STARTED, this.buildingHandler);
        this.eventQueue.on(GameEvents.BUILDING_COMPLETED, this.buildingHandler);
        this.eventQueue.on(GameEvents.BUILDING_DEMOLISHED, this.buildingHandler);

        // Listen for crew transfers to refresh colonist visuals
        this.crewTransferHandler = (event): void => {
            if (!this.initialized) return;
            const e = event as CrewTransferredEvent;
            // Check if this transfer involves our colony
            const matchesDest = e.destination?.type === 'colony'
                && e.destination.planetEntityId === this.entity.id
                && e.destination.regionId === this.activeRegionId;
            const matchesSource = e.source?.type === 'colony'
                && e.source.planetEntityId === this.entity.id
                && e.source.regionId === this.activeRegionId;
            // If either field is set, require a match; if neither is set, blanket refresh
            if ((e.destination || e.source) && !matchesDest && !matchesSource) return;
            this.refreshColonists();
        };
        this.eventQueue.on(GameEvents.CREW_TRANSFERRED, this.crewTransferHandler);

        // Debug key G to toggle grid overlay
        window.addEventListener('keydown', this.onKeyDown);
    }

    private onKeyDown = (e: KeyboardEvent): void => {
        if (e.code === 'KeyG' && !e.ctrlKey && !e.metaKey) {
            this.debugGridVisible = !this.debugGridVisible;
        }
    };

    /** Build or rebuild the grid for the active colony region. */
    rebuildGrid(): void {
        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!regionData || this.activeRegionId === null) return;

        const region = regionData.regions.find(r => r.id === this.activeRegionId);
        if (!region) return;

        this.grid.buildFromRegion(region);
        const network = generatePathNetwork(this.grid);
        this.campfireCell = network.campfireCell;
        this.perimeterPath = network.perimeterPath;
    }

    /** Initialise simulation for a specific region. Called when entering colony view. */
    initForRegion(regionId: number): void {
        this.activeRegionId = regionId;
        this.rebuildGrid();

        const world = ServiceLocator.get<World>('world');
        const crew = getCrewAtColony(world, this.entity.id, regionId);
        const crewData = crew.map(e => {
            const c = e.getComponent(CrewMemberComponent);
            return {
                id: e.id,
                role: c?.role ?? 'Civilian' as const,
                isLeader: c?.isLeader ?? false,
                name: c?.fullName ?? 'Unknown',
            };
        });

        initColonists(this, crewData);
        this.initialized = true;
    }

    /** Refresh colonist visual states after crew transfers. */
    refreshColonists(): void {
        if (this.activeRegionId === null) return;

        const world = ServiceLocator.get<World>('world');
        const crew = getCrewAtColony(world, this.entity.id, this.activeRegionId);
        const currentCrewIds = new Set(crew.map(e => e.id));

        // Remove colonists no longer at this colony
        for (const id of this.colonistStates.keys()) {
            if (!currentCrewIds.has(id)) {
                this.colonistStates.delete(id);
            }
        }

        // Add newly arrived colonists
        for (const e of crew) {
            if (!this.colonistStates.has(e.id)) {
                const c = e.getComponent(CrewMemberComponent);
                addColonist(this, {
                    id: e.id,
                    role: c?.role ?? 'Civilian' as const,
                    isLeader: c?.isLeader ?? false,
                    name: c?.fullName ?? 'Unknown',
                });
            }
        }
    }

    update(dt: number): void {
        if (!this.initialized || !this.eventQueue) return;

        const sceneState = this.entity.getComponent(ColonySceneStateComponent);
        if (!sceneState) return;

        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!regionData || this.activeRegionId === null) return;

        const region = regionData.regions.find(r => r.id === this.activeRegionId);
        if (!region) return;

        const gameHour = sceneState.gameHour;
        const weather = sceneState.currentWeather;

        updateColonists(this, dt, gameHour, weather, this.eventQueue, region.buildings);
    }

    destroy(): void {
        if (this.eventQueue && this.buildingHandler) {
            this.eventQueue.off(GameEvents.BUILDING_STARTED, this.buildingHandler);
            this.eventQueue.off(GameEvents.BUILDING_COMPLETED, this.buildingHandler);
            this.eventQueue.off(GameEvents.BUILDING_DEMOLISHED, this.buildingHandler);
        }
        if (this.eventQueue && this.crewTransferHandler) {
            this.eventQueue.off(GameEvents.CREW_TRANSFERRED, this.crewTransferHandler);
        }
        window.removeEventListener('keydown', this.onKeyDown);
        this.colonistStates.clear();
        this.initialized = false;
    }

    /** Whether the simulation is active. */
    get isActive(): boolean {
        return this.initialized;
    }

    /** Get the active region ID. */
    get regionId(): number | null {
        return this.activeRegionId;
    }
}
