// ColonySidebarUIComponent.ts — Colony info sidebar for colony view mode.
// Shows colony name, biome, population, resources, buildings, and action buttons.
// Desktop: right panel (300px). Mobile: bottom sheet.
// DOM structure is built once in init(); update() patches text content only.

import './ColonySidebarUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { GameModeComponent } from './GameModeComponent';
import { RegionDataComponent } from './RegionDataComponent';
import { PlanetDataComponent } from './PlanetDataComponent';
import { ResourceComponent } from './ResourceComponent';
import { TransferScreenComponent } from './TransferScreenComponent';
import { getBuildingType } from '../data/buildings';
import { getCrewAtColony } from '../utils/crewUtils';
import type { ResourceDeficitEvent, TurnBlockEvent, TurnUnblockEvent, TurnEndEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { World } from '../core/World';
import type { ResourceType } from '../data/resources';

export class ColonySidebarUIComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private world: World | null = null;
    private panel: HTMLElement | null = null;
    private isOpen = false;

    // Persistent DOM refs — wired once in init, never destroyed by innerHTML
    private nameEl: HTMLElement | null = null;
    private biomeEl: HTMLElement | null = null;
    private popEl: HTMLElement | null = null;
    private foodEl: HTMLElement | null = null;
    private energyEl: HTMLElement | null = null;
    private matEl: HTMLElement | null = null;
    private buildingsTitleEl: HTMLElement | null = null;
    private buildingsListEl: HTMLElement | null = null;
    private activeRegionId: number | null = null;
    private deficitHandler: EventHandler | null = null;
    private turnEndHandler: EventHandler | null = null;
    private turnBlockHandler: EventHandler | null = null;
    private turnUnblockHandler: EventHandler | null = null;
    private endTurnBtn: HTMLButtonElement | null = null;
    private onEndTurnClick: (() => void) | null = null;
    private blockers = new Set<string>();
    private currentTurn = 1;
    /** Resources currently in deficit this turn. */
    private deficitResources: Set<ResourceType> = new Set();

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        this.world = ServiceLocator.get<World>('world');
        this.panel = document.getElementById('colony-sidebar');
        if (!this.panel) return;

        // Build static DOM once — wrapped in a container so crew detail can toggle it
        this.panel.innerHTML = `
            <div id="colony-sidebar-info">
                <button class="colony-sidebar-btn colony-sidebar-btn--end-turn" id="colony-sidebar-end-turn">END TURN 1</button>
                <div class="colony-sidebar-name" data-ref="name"></div>
                <div class="colony-sidebar-biome" data-ref="biome"></div>
                <hr class="colony-sidebar-divider">
                <div class="colony-sidebar-stat">
                    <span class="colony-sidebar-stat-label">Population</span>
                    <span class="colony-sidebar-stat-value" data-ref="pop"></span>
                </div>
                <div class="colony-sidebar-stat">
                    <span class="colony-sidebar-stat-label">Food</span>
                    <span data-ref="food"></span>
                </div>
                <div class="colony-sidebar-stat">
                    <span class="colony-sidebar-stat-label">Energy</span>
                    <span data-ref="energy"></span>
                </div>
                <div class="colony-sidebar-stat">
                    <span class="colony-sidebar-stat-label">Materials</span>
                    <span data-ref="mat"></span>
                </div>
                <hr class="colony-sidebar-divider">
                <div class="colony-sidebar-section-title" data-ref="buildings-title">Buildings</div>
                <div data-ref="buildings-list"></div>
                <hr class="colony-sidebar-divider">
                <button class="colony-sidebar-btn" id="colony-sidebar-roster">CREW ROSTER</button>
                <button class="colony-sidebar-btn colony-sidebar-btn--back" id="colony-sidebar-back">&#8592; PLANET SURFACE</button>
            </div>
        `;

        this.nameEl = this.panel.querySelector('[data-ref="name"]');
        this.biomeEl = this.panel.querySelector('[data-ref="biome"]');
        this.popEl = this.panel.querySelector('[data-ref="pop"]');
        this.foodEl = this.panel.querySelector('[data-ref="food"]');
        this.energyEl = this.panel.querySelector('[data-ref="energy"]');
        this.matEl = this.panel.querySelector('[data-ref="mat"]');
        this.buildingsTitleEl = this.panel.querySelector('[data-ref="buildings-title"]');
        this.buildingsListEl = this.panel.querySelector('[data-ref="buildings-list"]');

        // Wire buttons once — they persist across updates
        this.panel.querySelector('#colony-sidebar-roster')?.addEventListener('click', () => {
            if (this.activeRegionId !== null) {
                this.openRoster(this.activeRegionId);
            }
        });

        this.panel.querySelector('#colony-sidebar-back')?.addEventListener('click', () => {
            this.eventQueue?.emit({ type: GameEvents.COLONY_VIEW_EXIT });
        });

        // End Turn button
        this.endTurnBtn = this.panel.querySelector('#colony-sidebar-end-turn') as HTMLButtonElement | null;
        this.onEndTurnClick = (): void => {
            if (this.blockers.size > 0) return;
            this.eventQueue?.emit({ type: GameEvents.TURN_ADVANCE, skipAnimations: true });
            if (this.endTurnBtn) {
                this.endTurnBtn.disabled = true;
                this.endTurnBtn.textContent = 'RESOLVING...';
            }
        };
        this.endTurnBtn?.addEventListener('click', this.onEndTurnClick);

        // Track blockers for End Turn button state
        this.turnBlockHandler = (event): void => {
            const { key } = event as TurnBlockEvent;
            if (key) this.blockers.add(key);
        };
        this.turnUnblockHandler = (event): void => {
            const { key } = event as TurnUnblockEvent;
            if (key) this.blockers.delete(key);
        };
        this.eventQueue.on(GameEvents.TURN_BLOCK, this.turnBlockHandler);
        this.eventQueue.on(GameEvents.TURN_UNBLOCK, this.turnUnblockHandler);

        // Subscribe to deficit events
        this.deficitHandler = (event): void => {
            const e = event as ResourceDeficitEvent;
            this.deficitResources.add(e.resource as ResourceType);
        };
        this.eventQueue.on(GameEvents.RESOURCE_DEFICIT, this.deficitHandler);

        this.turnEndHandler = (event): void => {
            const { turn } = event as TurnEndEvent;
            this.currentTurn = turn;
            this.deficitResources.clear();
            if (this.endTurnBtn) {
                this.endTurnBtn.disabled = false;
                this.endTurnBtn.textContent = `END TURN ${this.currentTurn}`;
            }
        };
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
    }

    update(_dt: number): void {
        if (!this.world || !this.panel) return;

        const gameState = this.world.getEntityByName('gameState');
        const gameMode = gameState?.getComponent(GameModeComponent);

        if (!gameMode || gameMode.mode !== 'colony' || gameMode.planetEntityId !== this.entity.id) {
            if (this.isOpen) {
                this.panel.classList.remove('open');
                this.isOpen = false;
                this.activeRegionId = null;
            }
            return;
        }

        const regionId = gameMode.colonyRegionId;
        if (regionId === null) return;
        this.activeRegionId = regionId;

        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!regionData) return;

        const region = regionData.regions.find(r => r.id === regionId);
        if (!region) return;

        const resources = gameState?.getComponent(ResourceComponent);
        const crew = getCrewAtColony(this.world, this.entity.id, regionId);
        const planetData = this.entity.getComponent(PlanetDataComponent);

        const colonyName = planetData ? `${planetData.config.displayName} Colony` : 'Colony';

        // Patch text content — no innerHTML, no DOM destruction
        if (this.nameEl) this.nameEl.textContent = colonyName;
        if (this.biomeEl) this.biomeEl.textContent = region.biome;
        if (this.popEl) this.popEl.textContent = String(crew.length);

        const foodRate = resources ? resources.getNetRate('food') : 0;
        const energyRate = resources ? resources.getNetRate('energy') : 0;
        const matRate = resources ? resources.getNetRate('materials') : 0;

        this.updateRate(this.foodEl, foodRate, 'food');
        this.updateRate(this.energyEl, energyRate, 'energy');
        this.updateRate(this.matEl, matRate, 'materials');

        if (this.buildingsTitleEl) {
            this.buildingsTitleEl.textContent = `Buildings (${region.buildings.length}/${region.buildingSlots})`;
        }

        // Buildings list — rebuild only this small section
        if (this.buildingsListEl) {
            if (region.buildings.length === 0) {
                this.buildingsListEl.innerHTML = '<div style="opacity:0.3;font-size:11px">No buildings</div>';
            } else {
                this.buildingsListEl.innerHTML = region.buildings.map(b => {
                    const bt = getBuildingType(b.typeId);
                    const statusClass = b.state === 'active' ? 'active' : 'constructing';
                    const statusLabel = b.state === 'constructing'
                        ? `${b.turnsRemaining}T`
                        : b.state.toUpperCase();
                    return `<div class="colony-sidebar-building">
                        <span>${bt.name}</span>
                        <span class="colony-sidebar-building-status--${statusClass}">${statusLabel}</span>
                    </div>`;
                }).join('');
            }
        }

        // Update End Turn button state based on blockers
        if (this.endTurnBtn && !this.endTurnBtn.textContent?.startsWith('RESOLVING')) {
            this.endTurnBtn.disabled = this.blockers.size > 0;
        }

        if (!this.isOpen) {
            this.panel.classList.add('open');
            this.isOpen = true;
        }
    }

    private updateRate(el: HTMLElement | null, rate: number, resource?: ResourceType): void {
        if (!el) return;
        const inDeficit = resource ? this.deficitResources.has(resource) : false;
        const prefix = inDeficit ? '\u26A0 ' : '';
        const sign = rate >= 0 ? '+' : '';
        el.textContent = `${prefix}${sign}${rate.toFixed(1)}`;
        el.className = 'colony-sidebar-stat-value';
        if (inDeficit) {
            el.classList.add('deficit-warning');
        } else if (rate > 0) {
            el.classList.add('positive');
        } else if (rate < 0) {
            el.classList.add('negative');
        }
    }

    private openRoster(regionId: number): void {
        if (!this.world) return;
        const hud = this.world.getEntityByName('hud');
        const transferScreen = hud?.getComponent(TransferScreenComponent);
        if (transferScreen && !transferScreen.isOpen) {
            transferScreen.open({
                type: 'colony',
                planetEntityId: this.entity.id,
                regionId,
            });
        }
    }

    destroy(): void {
        if (this.endTurnBtn && this.onEndTurnClick) {
            this.endTurnBtn.removeEventListener('click', this.onEndTurnClick);
        }
        if (this.eventQueue && this.deficitHandler) {
            this.eventQueue.off(GameEvents.RESOURCE_DEFICIT, this.deficitHandler);
        }
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
        if (this.eventQueue && this.turnBlockHandler) {
            this.eventQueue.off(GameEvents.TURN_BLOCK, this.turnBlockHandler);
        }
        if (this.eventQueue && this.turnUnblockHandler) {
            this.eventQueue.off(GameEvents.TURN_UNBLOCK, this.turnUnblockHandler);
        }
        if (this.panel) {
            this.panel.classList.remove('open');
            this.panel.innerHTML = '';
        }
    }
}
