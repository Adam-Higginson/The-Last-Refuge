import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { TransformComponent } from '../../components/TransformComponent';
import { OrbitComponent } from '../../components/OrbitComponent';
import { StationDataComponent } from '../../components/StationDataComponent';
import { SelectableComponent } from '../../components/SelectableComponent';
import { RenderComponent } from '../../components/RenderComponent';
import { createStation } from '../createStation';
import {
    STATION_ORBIT_RADIUS,
    STATION_ORBIT_SPEED,
    STATION_HIT_RADIUS,
} from '../../data/constants';

describe('createStation', () => {
    let world: World;

    beforeEach(() => {
        ServiceLocator.clear();
        const eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
        world = new World();
        ServiceLocator.register('world', world);

        // Create Dust planet entity (station orbits it)
        const dust = world.createEntity('dust');
        dust.addComponent(new TransformComponent(3600, 0));
    });

    it('creates an entity named "kethRelay"', () => {
        const entity = createStation(world);
        expect(entity.name).toBe('kethRelay');
    });

    it('has core components', () => {
        const entity = createStation(world);
        expect(entity.getComponent(TransformComponent)).not.toBeNull();
        expect(entity.getComponent(OrbitComponent)).not.toBeNull();
        expect(entity.getComponent(SelectableComponent)).not.toBeNull();
        expect(entity.getComponent(StationDataComponent)).not.toBeNull();
        expect(entity.getComponent(RenderComponent)).not.toBeNull();
    });

    it('orbits Dust via parentEntityId', () => {
        const dust = world.getEntityByName('dust');
        const entity = createStation(world);
        const orbit = entity.getComponent(OrbitComponent);

        expect(orbit).not.toBeNull();
        expect(orbit?.parentEntityId).toBe(dust?.id);
    });

    it('has correct orbit parameters for moon-like orbit', () => {
        const entity = createStation(world);
        const orbit = entity.getComponent(OrbitComponent);

        expect(orbit?.radius).toBe(STATION_ORBIT_RADIUS);
        expect(orbit?.speed).toBe(STATION_ORBIT_SPEED);
    });

    it('initial position is near Dust (within orbit radius)', () => {
        const dust = world.getEntityByName('dust');
        const dustTransform = dust?.getComponent(TransformComponent);
        const entity = createStation(world);
        const transform = entity.getComponent(TransformComponent);

        expect(transform).not.toBeNull();
        expect(dustTransform).not.toBeNull();

        const dx = (transform?.x ?? 0) - (dustTransform?.x ?? 0);
        const dy = (transform?.y ?? 0) - (dustTransform?.y ?? 0);
        const dist = Math.sqrt(dx * dx + dy * dy);

        expect(dist).toBeCloseTo(STATION_ORBIT_RADIUS, 0);
    });

    it('has correct hit radius for click detection', () => {
        const entity = createStation(world);
        const selectable = entity.getComponent(SelectableComponent);

        expect(selectable?.hitRadius).toBe(STATION_HIT_RADIUS);
    });
});
