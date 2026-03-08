import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { RenderComponent } from '../../components/RenderComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { createStar } from '../createStar';

describe('createStar', () => {
    beforeEach(() => {
        ServiceLocator.clear();
        ServiceLocator.register('canvas', {
            width: 800,
            height: 600,
        } as unknown as HTMLCanvasElement);
    });

    it('creates an entity named "star"', () => {
        const world = new World();
        const entity = createStar(world);
        expect(entity.name).toBe('star');
    });

    it('entity is retrievable from the world by name', () => {
        const world = new World();
        createStar(world);
        const entity = world.getEntityByName('star');
        expect(entity).not.toBeNull();
    });

    it('has a RenderComponent on the world layer', () => {
        const world = new World();
        const entity = createStar(world);
        const render = entity.getComponent(RenderComponent);
        expect(render).not.toBeNull();
        expect(render?.layer).toBe('world');
    });

    it('has a TransformComponent at the canvas centre', () => {
        const world = new World();
        const entity = createStar(world);
        const transform = entity.getComponent(TransformComponent);
        expect(transform).not.toBeNull();
        expect(transform?.x).toBe(400);
        expect(transform?.y).toBe(300);
    });

    it('uses canvas dimensions for initial position', () => {
        ServiceLocator.clear();
        ServiceLocator.register('canvas', {
            width: 1920,
            height: 1080,
        } as unknown as HTMLCanvasElement);

        const world = new World();
        const entity = createStar(world);
        const transform = entity.getComponent(TransformComponent);
        expect(transform?.x).toBe(960);
        expect(transform?.y).toBe(540);
    });
});
