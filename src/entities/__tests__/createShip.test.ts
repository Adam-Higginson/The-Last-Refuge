import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { RenderComponent } from '../../components/RenderComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { MovementComponent } from '../../components/MovementComponent';
import { SelectableComponent } from '../../components/SelectableComponent';
import { createShip } from '../createShip';

describe('createShip', () => {
    beforeEach(() => {
        ServiceLocator.clear();
        ServiceLocator.register('canvas', {
            width: 800,
            height: 600,
        } as unknown as HTMLCanvasElement);
    });

    it('creates an entity named "arkSalvage"', () => {
        const world = new World();
        const entity = createShip(world);
        expect(entity.name).toBe('arkSalvage');
    });

    it('has a TransformComponent with initial position', () => {
        const world = new World();
        const entity = createShip(world);
        const transform = entity.getComponent(TransformComponent);
        expect(transform).not.toBeNull();
        // Positioned offset from centre using orbit-proportional offsets
        // orbitR = Math.min(800,600) * 0.35 = 210; x = 400 + 210*0.9, y = 300 - 210*0.6
        expect(transform?.x).toBe(589);
        expect(transform?.y).toBe(174);
    });

    it('has a MovementComponent with correct budget and speed', () => {
        const world = new World();
        const entity = createShip(world);
        const movement = entity.getComponent(MovementComponent);
        expect(movement).not.toBeNull();
        expect(movement?.budgetMax).toBe(300);
        expect(movement?.speed).toBe(200);
        expect(movement?.budgetRemaining).toBe(300);
        expect(movement?.moving).toBe(false);
    });

    it('has a SelectableComponent with hit radius', () => {
        const world = new World();
        const entity = createShip(world);
        const selectable = entity.getComponent(SelectableComponent);
        expect(selectable).not.toBeNull();
        expect(selectable?.hitRadius).toBe(18);
        expect(selectable?.hovered).toBe(false);
        expect(selectable?.selected).toBe(false);
    });

    it('has a RenderComponent on the world layer', () => {
        const world = new World();
        const entity = createShip(world);
        const render = entity.getComponent(RenderComponent);
        expect(render).not.toBeNull();
        expect(render?.layer).toBe('world');
    });

    it('entity is retrievable from the world by name', () => {
        const world = new World();
        createShip(world);
        const entity = world.getEntityByName('arkSalvage');
        expect(entity).not.toBeNull();
    });
});
