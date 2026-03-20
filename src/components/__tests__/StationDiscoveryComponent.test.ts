import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { TransformComponent } from '../TransformComponent';
import { VisibilitySourceComponent } from '../VisibilitySourceComponent';
import { StationDataComponent } from '../StationDataComponent';
import { StationDiscoveryComponent } from '../StationDiscoveryComponent';
import { EventStateComponent } from '../EventStateComponent';
import { CameraComponent } from '../CameraComponent';

describe('StationDiscoveryComponent', () => {
    let world: World;
    let eventQueue: EventQueue;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        // GameState with EventStateComponent
        const gameState = world.createEntity('gameState');
        gameState.addComponent(new EventStateComponent());

        // Camera entity
        const camera = world.createEntity('camera');
        camera.addComponent(new CameraComponent());
    });

    function createStation(x: number, y: number): {
        entity: import('../../core/Entity').Entity;
        data: StationDataComponent;
        discovery: StationDiscoveryComponent;
    } {
        const entity = world.createEntity('kethRelay');
        entity.addComponent(new TransformComponent(x, y));
        const data = entity.addComponent(new StationDataComponent());
        const discovery = entity.addComponent(new StationDiscoveryComponent());
        return { entity, data, discovery };
    }

    function createVisibilitySource(
        name: string, x: number, y: number, detailRadius: number, blipRadius: number,
    ): import('../../core/Entity').Entity {
        const entity = world.createEntity(name);
        entity.addComponent(new TransformComponent(x, y));
        entity.addComponent(new VisibilitySourceComponent(detailRadius, blipRadius, true));
        return entity;
    }

    it('station starts undiscovered', () => {
        const { data } = createStation(1000, 0);
        expect(data.discovered).toBe(false);
        expect(data.repairState).toBe('undiscovered');
    });

    it('no discovery when sources are out of range', () => {
        const { data, discovery } = createStation(1000, 0);
        // Source far away — blip radius 600 doesn't reach station at 1000
        createVisibilitySource('ship', 0, 0, 300, 600);

        discovery.update(0.016);

        expect(data.discovered).toBe(false);
    });

    it('discovers station when source blip radius covers station position', () => {
        const { data, discovery } = createStation(500, 0);
        // Source at origin with blipRadius 600 — station at 500 is within range
        createVisibilitySource('ship', 0, 0, 300, 600);

        discovery.update(0.016);

        expect(data.discovered).toBe(true);
        expect(data.repairState).toBe('discovered');
    });

    it('sets station_discovered flag on EventStateComponent', () => {
        const { discovery } = createStation(500, 0);
        createVisibilitySource('ship', 0, 0, 300, 600);

        discovery.update(0.016);

        const gameState = world.getEntityByName('gameState');
        const eventState = gameState?.getComponent(EventStateComponent);
        expect(eventState?.hasFlag('station_discovered')).toBe(true);
    });

    it('emits STATION_DISCOVERED event', () => {
        const { discovery } = createStation(500, 0);
        createVisibilitySource('ship', 0, 0, 300, 600);

        const events: unknown[] = [];
        eventQueue.on(GameEvents.STATION_DISCOVERED, (e) => events.push(e));

        discovery.update(0.016);
        eventQueue.drain();

        expect(events).toHaveLength(1);
    });

    it('only fires once — subsequent updates are no-ops', () => {
        const { data, discovery } = createStation(500, 0);
        createVisibilitySource('ship', 0, 0, 300, 600);

        const events: unknown[] = [];
        eventQueue.on(GameEvents.STATION_DISCOVERED, (e) => events.push(e));

        discovery.update(0.016);
        eventQueue.drain();
        discovery.update(0.016);
        eventQueue.drain();
        discovery.update(0.016);
        eventQueue.drain();

        expect(events).toHaveLength(1);
        expect(data.discovered).toBe(true);
    });

    it('works with scout visibility source', () => {
        const { data, discovery } = createStation(200, 0);
        createVisibilitySource('scoutAlpha', 0, 0, 300, 600);

        discovery.update(0.016);

        expect(data.discovered).toBe(true);
    });

    it('works with colony visibility source', () => {
        const { data, discovery } = createStation(350, 0);
        createVisibilitySource('colony', 0, 0, 400, 600);

        discovery.update(0.016);

        expect(data.discovered).toBe(true);
    });

    it('ignores inactive visibility sources', () => {
        const { data, discovery } = createStation(500, 0);
        const source = createVisibilitySource('ship', 0, 0, 300, 600);
        const vis = source.getComponent(VisibilitySourceComponent);
        if (vis) vis.active = false;

        discovery.update(0.016);

        expect(data.discovered).toBe(false);
    });
});
