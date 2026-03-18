// ResourceBarUIComponent.ts — Top HUD bar displaying resource amounts and rates.
// Lives on the HUD entity. Reads ResourceComponent from the gameState entity.
// Includes icon pulse on negative rate, trend arrows, and building completion flash.

import './ResourceBarUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { ResourceComponent } from './ResourceComponent';
import { RESOURCE_TYPES, RESOURCE_CONFIGS, FOOD_PER_PERSON } from '../data/resources';
import { BUILDING_TYPES } from '../data/buildings';
import type { BuildingCompletedEvent } from '../core/GameEvents';
import type { ResourceType } from '../data/resources';
import type { BuildingId } from '../data/buildings';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { World } from '../core/World';

export class ResourceBarUIComponent extends Component {
    private container: HTMLElement | null = null;
    private eventQueue: EventQueue | null = null;
    private resourcesUpdatedHandler: EventHandler | null = null;
    private buildingCompletedHandler: EventHandler | null = null;
    private valueEls: Record<ResourceType, HTMLElement | null> = {
        food: null,
        materials: null,
        energy: null,
    };
    private rateEls: Record<ResourceType, HTMLElement | null> = {
        food: null,
        materials: null,
        energy: null,
    };
    private iconEls: Record<ResourceType, HTMLElement | null> = {
        food: null,
        materials: null,
        energy: null,
    };
    private trendEls: Record<ResourceType, HTMLElement | null> = {
        food: null,
        materials: null,
        energy: null,
    };

    /** Previous net rates for trend arrow comparison. */
    previousNetRate: Record<ResourceType, number> = {
        food: 0,
        materials: 0,
        energy: 0,
    };

    /** Active flash timers per resource. */
    private flashTimers: Record<ResourceType, number> = {
        food: 0,
        materials: 0,
        energy: 0,
    };

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        this.container = document.getElementById('hud-resource-bar');
        if (!this.container) return;

        const colourClasses: Record<ResourceType, string> = {
            food: 'food',
            materials: 'materials',
            energy: 'energy',
        };

        this.container.innerHTML = RESOURCE_TYPES.map(type => {
            const config = RESOURCE_CONFIGS[type];
            const cls = colourClasses[type];
            return `
                <div class="resource-item" id="resource-item-${type}">
                    <span class="resource-icon resource-icon--${cls}" id="resource-icon-${type}">${config.icon}</span>
                    <span class="resource-label">${config.label}</span>
                    <span class="resource-value" id="resource-val-${type}">0</span>
                    <span class="resource-cap" id="resource-cap-${type}">/ 0</span>
                    <span class="resource-rate resource-rate--zero" id="resource-rate-${type}">+0</span>
                    <span class="resource-trend" id="resource-trend-${type}"></span>
                    <div class="resource-tooltip" id="resource-tooltip-${type}">${config.description}</div>
                </div>
            `;
        }).join('');

        for (const type of RESOURCE_TYPES) {
            this.valueEls[type] = document.getElementById(`resource-val-${type}`);
            this.rateEls[type] = document.getElementById(`resource-rate-${type}`);
            this.iconEls[type] = document.getElementById(`resource-icon-${type}`);
            this.trendEls[type] = document.getElementById(`resource-trend-${type}`);
        }

        // Subscribe to RESOURCES_UPDATED to snapshot rates for trend comparison
        this.resourcesUpdatedHandler = (): void => {
            this.snapshotRates();
        };
        this.eventQueue.on(GameEvents.RESOURCES_UPDATED, this.resourcesUpdatedHandler);

        // Subscribe to BUILDING_COMPLETED for green flash
        this.buildingCompletedHandler = (event): void => {
            const e = event as BuildingCompletedEvent;
            this.onBuildingCompleted(e.buildingId as BuildingId);
        };
        this.eventQueue.on(GameEvents.BUILDING_COMPLETED, this.buildingCompletedHandler);
    }

    update(_dt: number): void {
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const res = gameState?.getComponent(ResourceComponent);
        if (!res) return;

        for (const type of RESOURCE_TYPES) {
            const state = res.resources[type];
            const net = res.getNetRate(type);

            const valEl = this.valueEls[type];
            if (valEl) {
                valEl.textContent = `${Math.floor(state.current)}`;
            }

            const capEl = document.getElementById(`resource-cap-${type}`);
            if (capEl) {
                capEl.textContent = `/ ${state.cap}`;
            }

            const rateEl = this.rateEls[type];
            if (rateEl) {
                const sign = net >= 0 ? '+' : '';
                rateEl.textContent = `${sign}${Math.round(net)}`;
                rateEl.className = 'resource-rate';
                if (net > 0) rateEl.classList.add('resource-rate--positive');
                else if (net < 0) rateEl.classList.add('resource-rate--negative');
                else rateEl.classList.add('resource-rate--zero');
            }

            // Icon pulse when net rate negative
            const iconEl = this.iconEls[type];
            if (iconEl) {
                if (net < 0) {
                    iconEl.classList.add('pulse-warning');
                } else {
                    iconEl.classList.remove('pulse-warning');
                }
            }

            // Trend arrow
            const trendEl = this.trendEls[type];
            if (trendEl) {
                const prev = this.previousNetRate[type];
                const rounded = Math.round(net);
                const roundedPrev = Math.round(prev);
                if (rounded > roundedPrev) {
                    trendEl.textContent = '\u2191';
                    trendEl.className = 'resource-trend resource-trend--up';
                } else if (rounded < roundedPrev) {
                    trendEl.textContent = '\u2193';
                    trendEl.className = 'resource-trend resource-trend--down';
                } else {
                    trendEl.textContent = '\u2192';
                    trendEl.className = 'resource-trend resource-trend--neutral';
                }
            }

            // Update flash timers
            if (this.flashTimers[type] > 0) {
                this.flashTimers[type] -= _dt;
                const itemEl = document.getElementById(`resource-item-${type}`);
                if (this.flashTimers[type] <= 0 && itemEl) {
                    itemEl.classList.remove('build-flash');
                }
            }

            // Update breakdown tooltip
            const tooltipEl = document.getElementById(`resource-tooltip-${type}`);
            if (tooltipEl) {
                const modifiers = res.getModifiers(type);
                const lines: string[] = [];
                for (const m of modifiers) {
                    const mSign = m.amount >= 0 ? '+' : '';
                    lines.push(`${m.source}: ${mSign}${m.amount}`);
                    if (m.multiplier) {
                        lines.push(`  (${m.multiplier > 0 ? '+' : ''}${Math.round(m.multiplier * 100)}% multiplier)`);
                    }
                }
                if (type === 'food') {
                    const popCount = res.getPopulationCount();
                    lines.push(`Population (${popCount}): -${popCount * FOOD_PER_PERSON}`);
                }
                const multiplier = res.getMultiplier(type);
                if (multiplier !== 0) {
                    lines.push(`Total multiplier: ${multiplier > 0 ? '+' : ''}${Math.round(multiplier * 100)}%`);
                }
                lines.push(`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
                const netSign = net >= 0 ? '+' : '';
                lines.push(`NET: ${netSign}${Math.round(net)}/turn`);
                tooltipEl.textContent = lines.join('\n');
            }
        }
    }

    /** Snapshot current rates as previous for next trend comparison. */
    private snapshotRates(): void {
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const res = gameState?.getComponent(ResourceComponent);
        if (!res) return;

        for (const type of RESOURCE_TYPES) {
            this.previousNetRate[type] = res.getNetRate(type);
        }
    }

    /** Flash the resource bar green when a building with resource production completes. */
    private onBuildingCompleted(buildingId: BuildingId): void {
        const buildingType = BUILDING_TYPES[buildingId];
        if (!buildingType) return;

        for (const effect of buildingType.effects) {
            if (effect.type === 'production' && effect.resource) {
                const itemEl = document.getElementById(`resource-item-${effect.resource}`);
                if (itemEl) {
                    itemEl.classList.add('build-flash');
                    this.flashTimers[effect.resource] = 1.0;
                }
            }
        }
    }

    destroy(): void {
        if (this.eventQueue && this.resourcesUpdatedHandler) {
            this.eventQueue.off(GameEvents.RESOURCES_UPDATED, this.resourcesUpdatedHandler);
        }
        if (this.eventQueue && this.buildingCompletedHandler) {
            this.eventQueue.off(GameEvents.BUILDING_COMPLETED, this.buildingCompletedHandler);
        }
    }
}
