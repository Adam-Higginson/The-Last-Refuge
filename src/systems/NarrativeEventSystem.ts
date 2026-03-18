// NarrativeEventSystem.ts — Selects and presents narrative events each turn.
// Priority: chain queue > story events > weighted deck draw.
// One event fires per turn, max. Shows NarrativeModal and applies outcomes.

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { EventStateComponent } from '../components/EventStateComponent';
import { ResourceComponent } from '../components/ResourceComponent';
import {
    NARRATIVE_EVENTS,
    CATEGORY_WEIGHTS,
} from '../data/narrativeEvents';
import type {
    NarrativeEventDefinition,
    NarrativeEventContext,
    EventCategory,
} from '../data/narrativeEvents';
import type { TurnEndEvent } from '../core/GameEvents';
import type { ResourceType } from '../data/resources';
import type { NarrativeModal, NarrativeModalChoice } from '../ui/NarrativeModal';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';

export class NarrativeEventSystem extends System {
    private eventQueue!: EventQueue;
    private narrativeModal!: NarrativeModal;
    private turnEndHandler!: EventHandler;
    private needsInitialCheck = true;
    private showing = false;

    init(world: World): void {
        super.init(world);
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        this.narrativeModal = ServiceLocator.get<NarrativeModal>('narrativeModal');

        this.turnEndHandler = (event): void => {
            const turn = (event as TurnEndEvent).turn;
            void this.checkEvents(turn);
        };
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
    }

    update(_dt: number): void {
        if (this.needsInitialCheck) {
            this.needsInitialCheck = false;
            void this.checkEvents(1);
        }
    }

    destroy(): void {
        this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
    }

    private async checkEvents(turn: number): Promise<void> {
        if (this.showing) return;

        const event = this.selectEvent(turn);
        if (!event) return;

        this.showing = true;
        try {
            const choiceIndex = await this.showEvent(event, turn);
            if (choiceIndex >= 0 && event.choices && event.choices[choiceIndex]) {
                await this.applyOutcome(event, choiceIndex, turn);
            }
        } catch (err) {
            console.warn('NarrativeEventSystem: error during event', event.id, err);
        } finally {
            this.eventQueue.emit({ type: GameEvents.TURN_UNBLOCK, key: 'narrative' });
            this.showing = false;
        }
    }

    private selectEvent(turn: number): NarrativeEventDefinition | null {
        const state = this.getEventState();
        if (!state) return null;

        const ctx = this.buildContext(turn, state);

        // 1. Check chain queue
        const chains = state.getTriggeredChains(turn);
        for (const chain of chains) {
            const def = NARRATIVE_EVENTS.find(e => e.id === chain.eventId);
            if (!def) {
                console.warn(`NarrativeEventSystem: chain event '${chain.eventId}' not found`);
                continue;
            }
            if (def.once !== false && state.hasSeen(def.id)) continue;
            try {
                if (def.condition(ctx)) return def;
            } catch (err) {
                console.warn(`NarrativeEventSystem: condition error for '${def.id}'`, err);
            }
        }

        // 2. Check story events (weight-0, condition-based only)
        for (const def of NARRATIVE_EVENTS) {
            if (def.category !== 'story') continue;
            if (def.once !== false && state.hasSeen(def.id)) continue;
            try {
                if (def.condition(ctx)) return def;
            } catch (err) {
                console.warn(`NarrativeEventSystem: condition error for '${def.id}'`, err);
            }
        }

        // 3. Deck draw (weighted random from eligible non-story events)
        return this.drawFromDeck(ctx, state);
    }

    private drawFromDeck(ctx: NarrativeEventContext, state: EventStateComponent): NarrativeEventDefinition | null {
        // Filter eligible non-story events
        const eligible: NarrativeEventDefinition[] = [];
        for (const def of NARRATIVE_EVENTS) {
            if (def.category === 'story') continue;
            if (def.once !== false && state.hasSeen(def.id)) continue;
            try {
                if (def.condition(ctx)) eligible.push(def);
            } catch (err) {
                console.warn(`NarrativeEventSystem: condition error for '${def.id}'`, err);
            }
        }

        if (eligible.length === 0) return null;

        // Group by category and compute weights
        const byCategory = new Map<EventCategory, NarrativeEventDefinition[]>();
        for (const def of eligible) {
            const list = byCategory.get(def.category);
            if (list) list.push(def);
            else byCategory.set(def.category, [def]);
        }

        // Weighted random pick of category
        let totalWeight = 0;
        const categories: EventCategory[] = [];
        const weights: number[] = [];
        for (const [cat, _defs] of byCategory) {
            const w = CATEGORY_WEIGHTS[cat];
            if (w <= 0) continue;
            categories.push(cat);
            weights.push(w);
            totalWeight += w;
        }

        if (totalWeight === 0) return null;

        let roll = Math.random() * totalWeight;
        let pickedCategory: EventCategory = categories[0];
        for (let i = 0; i < categories.length; i++) {
            roll -= weights[i];
            if (roll <= 0) {
                pickedCategory = categories[i];
                break;
            }
        }

        // Random pick within category
        const pool = byCategory.get(pickedCategory);
        if (!pool || pool.length === 0) return null;
        return pool[Math.floor(Math.random() * pool.length)];
    }

    private async showEvent(event: NarrativeEventDefinition, _turn: number): Promise<number> {
        const state = this.getEventState();
        if (state) state.markSeen(event.id);

        const resources = this.getResources();

        // Build choice UI data
        const choices: NarrativeModalChoice[] | undefined = event.choices?.map(c => {
            const canAfford = !c.cost || c.cost.every(
                cost => resources ? resources.canAfford(cost.resource, cost.amount) : false
            );
            const costText = c.cost?.map(
                cost => `-${cost.amount} ${cost.resource.charAt(0).toUpperCase() + cost.resource.slice(1)}`
            ).join(', ');
            const gainText = c.gain?.map(
                gain => `+${gain.amount} ${gain.resource.charAt(0).toUpperCase() + gain.resource.slice(1)}`
            ).join(', ');

            return {
                label: c.label,
                description: c.description,
                costText,
                gainText,
                disabled: !canAfford,
            };
        });

        this.eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'narrative' });

        const choiceIndex = await this.narrativeModal.show({
            title: event.title,
            body: event.body,
            choices,
        });

        return choiceIndex;
    }

    private async applyOutcome(event: NarrativeEventDefinition, choiceIndex: number, turn: number): Promise<void> {
        const choice = event.choices?.[choiceIndex];
        if (!choice) return;

        const resources = this.getResources();
        const state = this.getEventState();

        // Multi-cost atomicity: verify ALL costs before ANY deduct
        if (choice.cost && resources) {
            const allAffordable = choice.cost.every(c => resources.canAfford(c.resource, c.amount));
            if (allAffordable) {
                for (const c of choice.cost) {
                    resources.deduct(c.resource, c.amount);
                }
            }
        }

        // Apply gains
        if (choice.gain && resources) {
            for (const g of choice.gain) {
                resources.add(g.resource, g.amount);
            }
        }

        // Set flags
        if (choice.flag && state) {
            state.addFlag(choice.flag);
        }

        // Queue chains
        if (choice.chainEventId && state) {
            state.queueChain(choice.chainEventId, turn, choice.chainDelay ?? 2);
        }

        // Show outcome text
        if (choice.outcome) {
            await this.narrativeModal.showOutcome(choice.outcome);
        }

        // Emit event
        this.eventQueue.emit({
            type: GameEvents.NARRATIVE_SHOWN,
            id: event.id,
            choiceIndex,
        });
    }

    private getEventState(): EventStateComponent | null {
        const gameState = this.world.getEntityByName('gameState');
        return gameState?.getComponent(EventStateComponent) ?? null;
    }

    private getResources(): ResourceComponent | null {
        const gameState = this.world.getEntityByName('gameState');
        return gameState?.getComponent(ResourceComponent) ?? null;
    }

    private buildContext(turn: number, state: EventStateComponent): NarrativeEventContext {
        const resources = this.getResources();
        const resourceData: Record<ResourceType, { current: number; cap: number }> = {
            food: { current: 0, cap: 0 },
            materials: { current: 0, cap: 0 },
            energy: { current: 0, cap: 0 },
        };
        if (resources) {
            for (const key of ['food', 'materials', 'energy'] as ResourceType[]) {
                resourceData[key] = {
                    current: resources.resources[key].current,
                    cap: resources.resources[key].cap,
                };
            }
        }
        return { turn, resources: resourceData, flags: state.flags };
    }
}
