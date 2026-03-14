// ResourceComponent.ts — Tracks global resources (Food, Materials, Energy).
// Lives on the gameState entity. Resolves production/consumption on TURN_END.
// Buildings register modifiers to affect resource rates.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { CrewMemberComponent } from './CrewMemberComponent';
import {
    RESOURCE_TYPES,
    RESOURCE_CONFIGS,
    FOOD_PER_PERSON,
    SHIP_REACTOR_ENERGY,
} from '../data/resources';
import type { ResourceType } from '../data/resources';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { World } from '../core/World';

export interface ResourceState {
    current: number;
    cap: number;
}

export interface ResourceModifier {
    /** Unique identifier (e.g. 'building:farm:42'). */
    id: string;
    /** Which resource this affects. */
    resource: ResourceType;
    /** Amount per turn (positive = production, negative = consumption). */
    amount: number;
    /** Percentage multiplier applied after flat amounts (e.g. 0.2 = +20%). Optional. */
    multiplier?: number;
    /** Human-readable source label for tooltips. */
    source: string;
}

export class ResourceComponent extends Component {
    /** Current resource amounts and storage caps. */
    readonly resources: Record<ResourceType, ResourceState>;

    /** Registered production/consumption modifiers (from buildings, etc). */
    private readonly modifiers: ResourceModifier[] = [];

    /** Net change from last turn resolution, for HUD display. */
    readonly lastNetChange: Record<ResourceType, number> = {
        food: 0,
        materials: 0,
        energy: 0,
    };

    private eventQueue: EventQueue | null = null;
    private turnEndHandler: EventHandler | null = null;

    constructor() {
        super();
        this.resources = {
            food: { current: RESOURCE_CONFIGS.food.startingAmount, cap: RESOURCE_CONFIGS.food.startingCap },
            materials: { current: RESOURCE_CONFIGS.materials.startingAmount, cap: RESOURCE_CONFIGS.materials.startingCap },
            energy: { current: RESOURCE_CONFIGS.energy.startingAmount, cap: RESOURCE_CONFIGS.energy.startingCap },
        };
    }

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        // Ship reactor provides baseline energy
        this.addModifier({
            id: 'ship:reactor',
            resource: 'energy',
            amount: SHIP_REACTOR_ENERGY,
            source: 'Ship Reactor',
        });

        this.turnEndHandler = (): void => {
            this.resolveTurn();
        };
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
    }

    /** Register a production/consumption modifier. */
    addModifier(modifier: ResourceModifier): void {
        this.modifiers.push(modifier);
    }

    /** Remove a modifier by ID. */
    removeModifier(id: string): void {
        const idx = this.modifiers.findIndex(m => m.id === id);
        if (idx !== -1) this.modifiers.splice(idx, 1);
    }

    /** Get all modifiers for a given resource. */
    getModifiers(resource: ResourceType): readonly ResourceModifier[] {
        return this.modifiers.filter(m => m.resource === resource);
    }

    /** Get the net rate from flat modifiers only (excludes multipliers and population). */
    getModifierRate(resource: ResourceType): number {
        let sum = 0;
        for (const m of this.modifiers) {
            if (m.resource === resource) sum += m.amount;
        }
        return sum;
    }

    /** Get the total multiplier for a resource (sum of all modifier multipliers). */
    getMultiplier(resource: ResourceType): number {
        let total = 0;
        for (const m of this.modifiers) {
            if (m.resource === resource && m.multiplier) {
                total += m.multiplier;
            }
        }
        return total;
    }

    /** Get the total net rate including multipliers and dynamic population consumption. */
    getNetRate(resource: ResourceType): number {
        // Split modifiers into production (positive) and consumption (negative)
        let production = 0;
        let consumption = 0;
        for (const m of this.modifiers) {
            if (m.resource === resource) {
                if (m.amount > 0) production += m.amount;
                else consumption += m.amount;
            }
        }

        // Apply percentage multipliers to production only
        const multiplier = this.getMultiplier(resource);
        if (multiplier !== 0) {
            production += production * multiplier;
        }

        let rate = production + consumption;
        if (resource === 'food') {
            rate -= this.getPopulationCount() * FOOD_PER_PERSON;
        }
        return rate;
    }

    /** Check if the player can afford a cost. */
    canAfford(resource: ResourceType, amount: number): boolean {
        return this.resources[resource].current >= amount;
    }

    /** Deduct resources (e.g. for construction). Returns false if insufficient. */
    deduct(resource: ResourceType, amount: number): boolean {
        if (!this.canAfford(resource, amount)) return false;
        this.resources[resource].current -= amount;
        return true;
    }

    destroy(): void {
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
    }

    private resolveTurn(): void {
        for (const type of RESOURCE_TYPES) {
            const net = this.getNetRate(type);
            this.lastNetChange[type] = net;
            this.resources[type].current += net;

            // Deficit check
            if (this.resources[type].current < 0) {
                const deficit = -this.resources[type].current;
                this.resources[type].current = 0;
                this.eventQueue?.emit({
                    type: GameEvents.RESOURCE_DEFICIT,
                    resource: type,
                    deficit,
                });
            }

            // Cap overflow
            if (this.resources[type].current > this.resources[type].cap) {
                this.resources[type].current = this.resources[type].cap;
            }
        }

        this.eventQueue?.emit({ type: GameEvents.RESOURCES_UPDATED });
    }

    getPopulationCount(): number {
        if (!ServiceLocator.has('world')) return 0;
        const world = ServiceLocator.get<World>('world');
        return world.getEntitiesWithComponent(CrewMemberComponent).length;
    }
}
