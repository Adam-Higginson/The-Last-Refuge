import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { RenderComponent } from '../../components/RenderComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { MovementComponent } from '../../components/MovementComponent';
import { SelectableComponent } from '../../components/SelectableComponent';
import { createShip } from '../createShip';
import { getPlanetConfig } from '../../data/planets';

const newTerraConfig = getPlanetConfig('newTerra');
const ORBIT_RADIUS = newTerraConfig?.orbitRadius ?? 1500;
const START_ANGLE = newTerraConfig?.startAngle ?? 3.8;

describe('createShip', () => {
    beforeEach(() => {
        ServiceLocator.clear();
    });

    it('creates an entity named "arkSalvage"', () => {
        const world = new World();
        const entity = createShip(world);
        expect(entity.name).toBe('arkSalvage');
    });

    it('has a TransformComponent with world-space initial position', () => {
        const world = new World();
        const entity = createShip(world);
        const transform = entity.getComponent(TransformComponent);
        expect(transform).not.toBeNull();
        // Positioned next to New Terra's starting position
        expect(transform?.x).toBe(ORBIT_RADIUS * Math.cos(START_ANGLE) + 150);
        expect(transform?.y).toBe(ORBIT_RADIUS * Math.sin(START_ANGLE) + 150);
    });

    it('has a MovementComponent with correct budget and speed', () => {
        const world = new World();
        const entity = createShip(world);
        const movement = entity.getComponent(MovementComponent);
        expect(movement).not.toBeNull();
        expect(movement?.budgetMax).toBe(800);
        expect(movement?.speed).toBe(500);
        expect(movement?.budgetRemaining).toBe(800);
        expect(movement?.moving).toBe(false);
    });

    it('has a SelectableComponent with hit radius', () => {
        const world = new World();
        const entity = createShip(world);
        const selectable = entity.getComponent(SelectableComponent);
        expect(selectable).not.toBeNull();
        expect(selectable?.hitRadius).toBe(72);
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
