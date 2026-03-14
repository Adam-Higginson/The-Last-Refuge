import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { RenderComponent } from '../../components/RenderComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { SelectableComponent } from '../../components/SelectableComponent';
import { createStar } from '../createStar';

describe('createStar', () => {
    beforeEach(() => {
        ServiceLocator.clear();
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

    it('has a TransformComponent at world origin (0, 0)', () => {
        const world = new World();
        const entity = createStar(world);
        const transform = entity.getComponent(TransformComponent);
        expect(transform).not.toBeNull();
        expect(transform?.x).toBe(0);
        expect(transform?.y).toBe(0);
    });

    it('has a SelectableComponent with hit radius', () => {
        const world = new World();
        const entity = createStar(world);
        const selectable = entity.getComponent(SelectableComponent);
        expect(selectable).not.toBeNull();
        expect(selectable?.hitRadius).toBe(300);
        expect(selectable?.hovered).toBe(false);
    });
});
