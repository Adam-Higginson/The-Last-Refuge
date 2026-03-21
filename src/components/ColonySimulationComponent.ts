// ColonySimulationComponent.ts — Owns colony grid, path network, and colonist states.
// Lives on the planet entity alongside ColonySceneStateComponent.
// Simulation runs in update(dt) — proper ECS lifecycle.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { ColonyGrid } from '../colony/ColonyGrid';
import { generatePathNetwork } from '../colony/ColonyPathNetwork';
import { initColonists, updateColonists } from '../colony/ColonistManager';
import { resolveTurnMorale, getWorkEfficiency } from '../colony/ColonistMoraleEffects';
import { ResourceComponent } from './ResourceComponent';
import { CrewMemberComponent } from './CrewMemberComponent';
import { ColonySceneStateComponent } from './ColonySceneStateComponent';
import { AdaptiveQualityComponent } from './AdaptiveQualityComponent';
import { RegionDataComponent } from './RegionDataComponent';
import { getCrewAtColony } from '../utils/crewUtils';
import type { ColonistVisualState } from '../colony/ColonistState';
import type { BuildingCompletedEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { World } from '../core/World';

export class ColonySimulationComponent extends Component {
    grid: ColonyGrid = new ColonyGrid();
    colonistStates: Map<number, ColonistVisualState> = new Map();
    campfireCell: { gridX: number; gridY: number } | null = null;
    perimeterPath: { gridX: number; gridY: number }[] = [];
    occupiedPositions: Set<string> = new Set();
    debugGridVisible = false;

    private eventQueue: EventQueue | null = null;
    private buildingHandler: EventHandler | null = null;
    private celebrationHandler: EventHandler | null = null;
    private turnEndHandler: EventHandler | null = null;
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

        // Celebration: when a building completes, nearby colonists celebrate briefly
        this.celebrationHandler = (event): void => {
            if (!this.initialized || this.activeRegionId === null) return;
            const completedEvent = event as BuildingCompletedEvent;
            const regionData = this.entity.getComponent(RegionDataComponent);
            if (!regionData) return;
            const region = regionData.regions.find(r => r.id === this.activeRegionId);
            if (!region) return;

            // Find the building instance that just completed
            const building = region.buildings.find(
                b => b.typeId === completedEvent.buildingId && b.state === 'active',
            );
            if (!building) return;

            const center = this.grid.getBuildingCenter(building.slotIndex);
            if (!center) return;

            // Mark colonists within Manhattan distance 2 as celebrating
            for (const [_id, colonist] of this.colonistStates) {
                if (colonist.sheltered) continue;
                const dx = Math.abs(Math.round(colonist.gridX) - center.gridX);
                const dy = Math.abs(Math.round(colonist.gridY) - center.gridY);
                if (dx + dy <= 2) {
                    colonist.celebrating = true;
                    colonist.celebrateTimer = 1.5;
                }
            }
        };
        this.eventQueue.on(GameEvents.BUILDING_COMPLETED, this.celebrationHandler);

        // TURN_END: resolve morale + apply work efficiency modifier
        this.turnEndHandler = (): void => {
            if (!this.initialized || this.activeRegionId === null) return;
            const world = ServiceLocator.get<World>('world');
            resolveTurnMorale(world, this.entity.id, this.activeRegionId);

            const efficiency = getWorkEfficiency(world, this.entity.id, this.activeRegionId);
            const gameState = world.getEntityByName('gameState');
            const resources = gameState?.getComponent(ResourceComponent);
            if (resources) {
                const mult = efficiency - 1; // e.g. -0.2 at 60% morale
                const types: ('food' | 'materials' | 'energy')[] = ['food', 'materials', 'energy'];
                for (const res of types) {
                    const modId = `colony:efficiency:${this.activeRegionId}:${res}`;
                    resources.removeModifier(modId);
                    resources.addModifier({
                        id: modId,
                        resource: res,
                        amount: 0,
                        multiplier: mult,
                        source: 'Colony Morale',
                    });
                }
            }
        };
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);

        // Debug key G to toggle grid overlay
        window.addEventListener('keydown', this.onKeyDown);
    }

    private onKeyDown = (e: KeyboardEvent): void => {
        if (e.code === 'KeyG' && !e.ctrlKey && !e.metaKey) {
            this.debugGridVisible = !this.debugGridVisible;
        }
        // Q key: toggle adaptive quality debug overlay
        if (e.code === 'KeyQ' && !e.ctrlKey && !e.metaKey) {
            const quality = this.entity.getComponent(AdaptiveQualityComponent);
            if (quality) {
                quality.debugVisible = !quality.debugVisible;
            }
        }
        // E key: toggle emergency mode for visual testing
        if (e.code === 'KeyE' && !e.ctrlKey && !e.metaKey) {
            const state = this.entity.getComponent(ColonySceneStateComponent);
            if (state) {
                state.emergencyDebugOverride = true;
                state.emergencyActive = !state.emergencyActive;
                console.log(`[DEBUG] Emergency mode: ${state.emergencyActive ? 'ON' : 'OFF'}`);
            }
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

        const world = ServiceLocator.get<World>('world');
        updateColonists(this, dt, gameHour, weather, this.eventQueue, region.buildings, world, sceneState.emergencyIntensity);
    }

    destroy(): void {
        if (this.eventQueue && this.buildingHandler) {
            this.eventQueue.off(GameEvents.BUILDING_STARTED, this.buildingHandler);
            this.eventQueue.off(GameEvents.BUILDING_COMPLETED, this.buildingHandler);
            this.eventQueue.off(GameEvents.BUILDING_DEMOLISHED, this.buildingHandler);
        }
        if (this.eventQueue && this.celebrationHandler) {
            this.eventQueue.off(GameEvents.BUILDING_COMPLETED, this.celebrationHandler);
        }
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
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
