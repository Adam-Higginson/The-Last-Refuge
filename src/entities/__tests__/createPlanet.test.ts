import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { RenderComponent } from '../../components/RenderComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { OrbitComponent } from '../../components/OrbitComponent';
import { SelectableComponent } from '../../components/SelectableComponent';
import { createPlanet, getOrbitRadius } from '../createPlanet';

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

    it('has a TransformComponent at initial orbit position', () => {
        const world = new World();
        const entity = createPlanet(world);
        const transform = entity.getComponent(TransformComponent);
        expect(transform).not.toBeNull();

        // Initial angle=0: position at (cx + orbitRadius, cy)
        // canvas 800x600: cx=400, cy=300, orbitRadius = 600*0.35 = 210
        expect(transform?.x).toBe(400 + 210);
        expect(transform?.y).toBe(300);
    });

    it('has an OrbitComponent with correct parameters', () => {
        const world = new World();
        const entity = createPlanet(world);
        const orbit = entity.getComponent(OrbitComponent);
        expect(orbit).not.toBeNull();
        expect(orbit?.centreX).toBe(400);
        expect(orbit?.centreY).toBe(300);
        expect(orbit?.radius).toBe(210); // min(800,600) * 0.35
        expect(orbit?.speed).toBe(0.15);
        expect(orbit?.angle).toBe(0);
    });

    it('has a SelectableComponent with hit radius', () => {
        const world = new World();
        const entity = createPlanet(world);
        const selectable = entity.getComponent(SelectableComponent);
        expect(selectable).not.toBeNull();
        expect(selectable?.hitRadius).toBe(20);
        expect(selectable?.hovered).toBe(false);
    });

    it('uses canvas dimensions for orbit radius', () => {
        ServiceLocator.clear();
        ServiceLocator.register('canvas', {
            width: 1920,
            height: 1080,
        } as unknown as HTMLCanvasElement);

        const world = new World();
        const entity = createPlanet(world);
        const orbit = entity.getComponent(OrbitComponent);

        // min(1920, 1080) * 0.35 = 378
        expect(orbit?.radius).toBe(1080 * 0.35);
        expect(orbit?.centreX).toBe(960);
        expect(orbit?.centreY).toBe(540);
    });
});

describe('getOrbitRadius', () => {
    it('returns 35% of the smaller dimension', () => {
        const canvas = { width: 800, height: 600 } as HTMLCanvasElement;
        expect(getOrbitRadius(canvas)).toBe(210); // 600 * 0.35
    });

    it('uses width when width is smaller', () => {
        const canvas = { width: 400, height: 600 } as HTMLCanvasElement;
        expect(getOrbitRadius(canvas)).toBe(140); // 400 * 0.35
    });
});
