import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { RenderComponent } from '../../components/RenderComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { MovementComponent } from '../../components/MovementComponent';
import { SelectableComponent } from '../../components/SelectableComponent';
import { OrbitComponent } from '../../components/OrbitComponent';
import { EngineStateComponent } from '../../components/EngineStateComponent';
import { EngineRepairComponent } from '../../components/EngineRepairComponent';
import { createShip } from '../createShip';
import { SHIP_ORBIT_RADIUS, SHIP_ORBIT_SPEED, SHIP_START_ANGLE } from '../../data/constants';

/** Create a minimal world with a New Terra entity at the given position. */
function setupWorld(ntX = 500, ntY = 600): { world: World; newTerra: ReturnType<World['createEntity']> } {
    const world = new World();
    const eventQueue = new EventQueue();
    ServiceLocator.register('eventQueue', eventQueue);
    ServiceLocator.register('world', world);
    const newTerra = world.createEntity('newTerra');
    newTerra.addComponent(new TransformComponent(ntX, ntY));
    return { world, newTerra };
}

describe('createShip', () => {
    beforeEach(() => {
        ServiceLocator.clear();
    });

    it('creates an entity named "arkSalvage"', () => {
        const { world } = setupWorld();
        const entity = createShip(world);
        expect(entity.name).toBe('arkSalvage');
    });

    it('has a TransformComponent positioned near New Terra orbit', () => {
        const ntX = 500;
        const ntY = 600;
        const { world } = setupWorld(ntX, ntY);
        const entity = createShip(world);
        const transform = entity.getComponent(TransformComponent);
        expect(transform).not.toBeNull();
        // Ship starts at SHIP_ORBIT_RADIUS from New Terra
        const expectedX = ntX + SHIP_ORBIT_RADIUS * Math.cos(SHIP_START_ANGLE);
        const expectedY = ntY + SHIP_ORBIT_RADIUS * Math.sin(SHIP_START_ANGLE);
        expect(transform?.x).toBeCloseTo(expectedX, 5);
        expect(transform?.y).toBeCloseTo(expectedY, 5);
    });

    it('initial position is within SHIP_ORBIT_RADIUS of New Terra', () => {
        const ntX = 500;
        const ntY = 600;
        const { world } = setupWorld(ntX, ntY);
        const entity = createShip(world);
        const transform = entity.getComponent(TransformComponent);
        expect(transform).not.toBeNull();
        const dx = (transform?.x ?? 0) - ntX;
        const dy = (transform?.y ?? 0) - ntY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeCloseTo(SHIP_ORBIT_RADIUS, 5);
    });

    it('has a MovementComponent with correct budget and speed', () => {
        const { world } = setupWorld();
        const entity = createShip(world);
        const movement = entity.getComponent(MovementComponent);
        expect(movement).not.toBeNull();
        expect(movement?.budgetMax).toBe(800);
        expect(movement?.speed).toBe(500);
        expect(movement?.budgetRemaining).toBe(800);
        expect(movement?.moving).toBe(false);
    });

    it('has a SelectableComponent with hit radius', () => {
        const { world } = setupWorld();
        const entity = createShip(world);
        const selectable = entity.getComponent(SelectableComponent);
        expect(selectable).not.toBeNull();
        expect(selectable?.hitRadius).toBe(72);
        expect(selectable?.hovered).toBe(false);
        expect(selectable?.selected).toBe(false);
    });

    it('has a RenderComponent on the world layer', () => {
        const { world } = setupWorld();
        const entity = createShip(world);
        const render = entity.getComponent(RenderComponent);
        expect(render).not.toBeNull();
        expect(render?.layer).toBe('world');
    });

    it('entity is retrievable from the world by name', () => {
        const { world } = setupWorld();
        createShip(world);
        const entity = world.getEntityByName('arkSalvage');
        expect(entity).not.toBeNull();
    });

    it('has OrbitComponent with parentEntityId pointing to newTerra', () => {
        const { world, newTerra } = setupWorld();
        const entity = createShip(world);
        const orbit = entity.getComponent(OrbitComponent);
        expect(orbit).not.toBeNull();
        expect(orbit?.parentEntityId).toBe(newTerra.id);
        expect(orbit?.radius).toBe(SHIP_ORBIT_RADIUS);
        expect(orbit?.speed).toBe(SHIP_ORBIT_SPEED);
        expect(orbit?.angle).toBe(SHIP_START_ANGLE);
    });

    it('has EngineStateComponent with default offline state', () => {
        const { world } = setupWorld();
        const entity = createShip(world);
        const engineState = entity.getComponent(EngineStateComponent);
        expect(engineState).not.toBeNull();
        expect(engineState?.engineState).toBe('offline');
    });

    it('has EngineRepairComponent', () => {
        const { world } = setupWorld();
        const entity = createShip(world);
        const engineRepair = entity.getComponent(EngineRepairComponent);
        expect(engineRepair).not.toBeNull();
    });
});
