import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { RegionDataComponent } from '../RegionDataComponent';
import { REGION_COUNT } from '../../entities/createPlanet';

describe('RegionDataComponent', () => {
    let world: World;
    let eventQueue: EventQueue;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
        world = new World();
    });

    it('regenerates regions on CANVAS_RESIZE', () => {
        const entity = world.createEntity('planet');
        const regionData = entity.addComponent(new RegionDataComponent());
        regionData.init();

        expect(regionData.regions).toHaveLength(0);

        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 800,
            height: 600,
        });
        eventQueue.drain();

        expect(regionData.regions.length).toBeGreaterThan(0);
    });

    it('region count matches REGION_COUNT', () => {
        const entity = world.createEntity('planet');
        const regionData = entity.addComponent(new RegionDataComponent());
        regionData.init();

        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 800,
            height: 600,
        });
        eventQueue.drain();

        expect(regionData.regions).toHaveLength(REGION_COUNT);
    });

    it('preserves colonisation state on resize', () => {
        const entity = world.createEntity('planet');
        const regionData = entity.addComponent(new RegionDataComponent());
        regionData.init();

        // Generate initial regions
        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 800,
            height: 600,
        });
        eventQueue.drain();

        // Colonise region 0
        regionData.regions[0].colonised = true;
        const colonisedId = regionData.regions[0].id;

        // Resize to regenerate
        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 1024,
            height: 768,
        });
        eventQueue.drain();

        const matchingRegion = regionData.regions.find(r => r.id === colonisedId);
        expect(matchingRegion?.colonised).toBe(true);
    });

    it('unsubscribes on destroy', () => {
        const entity = world.createEntity('planet');
        const regionData = entity.addComponent(new RegionDataComponent());
        regionData.init();
        regionData.destroy();

        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 800,
            height: 600,
        });
        eventQueue.drain();

        // Regions should remain empty
        expect(regionData.regions).toHaveLength(0);
    });
});
