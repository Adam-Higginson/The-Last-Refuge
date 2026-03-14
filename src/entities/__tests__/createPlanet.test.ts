import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { RenderComponent } from '../../components/RenderComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { OrbitComponent } from '../../components/OrbitComponent';
import { SelectableComponent } from '../../components/SelectableComponent';
import { createPlanet, ORBIT_RADIUS } from '../createPlanet';

describe('createPlanet', () => {
    beforeEach(() => {
        ServiceLocator.clear();
        ServiceLocator.register('canvas', {
            width: 800,
            height: 600,
        } as unknown as HTMLCanvasElement);
    });

    it('creates an entity named "newTerra"', () => {
        const world = new World();
        const entity = createPlanet(world);
        expect(entity.name).toBe('newTerra');
    });

    it('entity is retrievable from the world by name', () => {
        const world = new World();
        createPlanet(world);
        const entity = world.getEntityByName('newTerra');
        expect(entity).not.toBeNull();
    });

    it('has a RenderComponent on the world layer', () => {
        const world = new World();
        const entity = createPlanet(world);
        const render = entity.getComponent(RenderComponent);
        expect(render).not.toBeNull();
        expect(render?.layer).toBe('world');
    });

    it('has a TransformComponent at initial orbit position in world coords', () => {
        const world = new World();
        const entity = createPlanet(world);
        const transform = entity.getComponent(TransformComponent);
        expect(transform).not.toBeNull();

        // Initial angle=0: position at (ORBIT_RADIUS, 0) in world space
        expect(transform?.x).toBe(ORBIT_RADIUS);
        expect(transform?.y).toBe(0);
    });

    it('has an OrbitComponent with fixed world-space parameters', () => {
        const world = new World();
        const entity = createPlanet(world);
        const orbit = entity.getComponent(OrbitComponent);
        expect(orbit).not.toBeNull();
        expect(orbit?.centreX).toBe(0);
        expect(orbit?.centreY).toBe(0);
        expect(orbit?.radius).toBe(ORBIT_RADIUS);
        expect(orbit?.speed).toBe(0.07);
        expect(orbit?.angle).toBe(0);
    });

    it('has a SelectableComponent with hit radius', () => {
        const world = new World();
        const entity = createPlanet(world);
        const selectable = entity.getComponent(SelectableComponent);
        expect(selectable).not.toBeNull();
        expect(selectable?.hitRadius).toBe(160);
        expect(selectable?.hovered).toBe(false);
    });

    it('orbit parameters are independent of canvas size', () => {
        ServiceLocator.clear();
        ServiceLocator.register('canvas', {
            width: 1920,
            height: 1080,
        } as unknown as HTMLCanvasElement);

        const world = new World();
        const entity = createPlanet(world);
        const orbit = entity.getComponent(OrbitComponent);

        // World coordinates are fixed — same regardless of canvas dimensions
        expect(orbit?.radius).toBe(ORBIT_RADIUS);
        expect(orbit?.centreX).toBe(0);
        expect(orbit?.centreY).toBe(0);
    });
});

describe('ORBIT_RADIUS', () => {
    it('is 1500 world units', () => {
        expect(ORBIT_RADIUS).toBe(1500);
    });
});
