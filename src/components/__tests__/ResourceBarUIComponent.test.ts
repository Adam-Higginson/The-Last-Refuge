// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { GameEvents } from '../../core/GameEvents';
import { ServiceLocator } from '../../core/ServiceLocator';
import { ResourceComponent } from '../ResourceComponent';
import { ResourceBarUIComponent } from '../ResourceBarUIComponent';

describe('ResourceBarUIComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let res: ResourceComponent;
    let bar: ResourceBarUIComponent;
    let barEl: HTMLElement;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        const gameState = world.createEntity('gameState');
        res = gameState.addComponent(new ResourceComponent());
        res.init();

        // Create the HUD resource bar DOM element
        barEl = document.createElement('div');
        barEl.id = 'hud-resource-bar';
        document.body.appendChild(barEl);

        const hud = world.createEntity('hud');
        bar = hud.addComponent(new ResourceBarUIComponent());
        bar.init();
    });

    afterEach(() => {
        bar.destroy();
        barEl.remove();
    });

    // --- Trend arrows ---

    it('shows neutral trend arrow on first update', () => {
        bar.update(0);
        const trendEl = document.getElementById('resource-trend-food');
        expect(trendEl?.textContent).toBe('\u2192');
        expect(trendEl?.classList.contains('resource-trend--neutral')).toBe(true);
    });

    it('shows up arrow when rate improves', () => {
        // First snapshot: rate is negative
        bar.update(0);
        // Snapshot previous rates (simulating RESOURCES_UPDATED)
        bar.previousNetRate.food = -10;

        // Now add a farm modifier so rate improves
        res.addModifier({ id: 'farm', resource: 'food', amount: 15, source: 'Farm' });
        bar.update(0);

        const trendEl = document.getElementById('resource-trend-food');
        expect(trendEl?.textContent).toBe('\u2191');
        expect(trendEl?.classList.contains('resource-trend--up')).toBe(true);
    });

    it('shows down arrow when rate worsens', () => {
        // Snapshot a positive previous rate
        bar.previousNetRate.food = 10;

        // Current rate is negative (no modifiers, no crew = 0, which is < 10)
        bar.update(0);

        const trendEl = document.getElementById('resource-trend-food');
        expect(trendEl?.textContent).toBe('\u2193');
        expect(trendEl?.classList.contains('resource-trend--down')).toBe(true);
    });

    it('shows neutral arrow when rate unchanged', () => {
        bar.previousNetRate.food = 0;
        bar.update(0);

        const trendEl = document.getElementById('resource-trend-food');
        expect(trendEl?.textContent).toBe('\u2192');
        expect(trendEl?.classList.contains('resource-trend--neutral')).toBe(true);
    });

    // --- Building completion flash ---

    it('adds build-flash class on farm completion', () => {
        bar.update(0);

        eventQueue.emit({ type: GameEvents.BUILDING_COMPLETED, buildingId: 'farm' });
        eventQueue.drain();

        const itemEl = document.getElementById('resource-item-food');
        expect(itemEl?.classList.contains('build-flash')).toBe(true);
    });

    it('does not flash on shelter completion (no resource production)', () => {
        bar.update(0);

        eventQueue.emit({ type: GameEvents.BUILDING_COMPLETED, buildingId: 'shelter' });
        eventQueue.drain();

        const foodItem = document.getElementById('resource-item-food');
        const matItem = document.getElementById('resource-item-materials');
        const energyItem = document.getElementById('resource-item-energy');
        expect(foodItem?.classList.contains('build-flash')).toBe(false);
        expect(matItem?.classList.contains('build-flash')).toBe(false);
        expect(energyItem?.classList.contains('build-flash')).toBe(false);
    });
});
