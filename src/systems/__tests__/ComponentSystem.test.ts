import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { Component } from '../../core/Component';
import { ComponentSystem } from '../ComponentSystem';

/** A test component with lifecycle methods */
class LifecycleComponent extends Component {
    initCalled = false;
    updateCalls: number[] = [];
    destroyCalled = false;

    init(): void {
        this.initCalled = true;
    }

    update(dt: number): void {
        this.updateCalls.push(dt);
    }

    destroy(): void {
        this.destroyCalled = true;
    }
}

/** A pure data component with no lifecycle methods */
class DataOnlyComponent extends Component {
    value = 42;
}

describe('ComponentSystem', () => {
    let world: World;

    beforeEach(() => {
        world = new World();
    });

    it('calls init() once on first encounter', () => {
        const system = new ComponentSystem();
        system.init(world);

        const entity = world.createEntity('test');
        const comp = entity.addComponent(new LifecycleComponent());

        system.update(1 / 60);
        system.update(1 / 60);

        expect(comp.initCalled).toBe(true);
        expect(comp.updateCalls).toHaveLength(2);
    });

    it('calls update(dt) every tick', () => {
        const system = new ComponentSystem();
        system.init(world);

        const entity = world.createEntity('test');
        const comp = entity.addComponent(new LifecycleComponent());

        system.update(0.016);
        system.update(0.032);
        system.update(0.048);

        expect(comp.updateCalls).toEqual([0.016, 0.032, 0.048]);
    });

    it('calls destroy() when a component is removed', () => {
        const system = new ComponentSystem();
        system.init(world);

        const entity = world.createEntity('test');
        const comp = entity.addComponent(new LifecycleComponent());

        // First tick — init + update
        system.update(1 / 60);
        expect(comp.initCalled).toBe(true);
        expect(comp.destroyCalled).toBe(false);

        // Remove the component
        entity.removeComponent(LifecycleComponent);

        // Second tick — should detect removal and call destroy
        system.update(1 / 60);
        expect(comp.destroyCalled).toBe(true);
    });

    it('calls destroy() when an entity is removed from the world', () => {
        const system = new ComponentSystem();
        system.init(world);

        const entity = world.createEntity('test');
        const comp = entity.addComponent(new LifecycleComponent());

        system.update(1 / 60);
        expect(comp.destroyCalled).toBe(false);

        // Remove entity from world
        world.removeEntity(entity.id);

        system.update(1 / 60);
        expect(comp.destroyCalled).toBe(true);
    });

    it('skips data-only components without lifecycle methods', () => {
        const system = new ComponentSystem();
        system.init(world);

        const entity = world.createEntity('test');
        const dataComp = entity.addComponent(new DataOnlyComponent());

        // Should not throw
        system.update(1 / 60);
        system.update(1 / 60);

        expect(dataComp.value).toBe(42);
    });

    it('handles mixed lifecycle and data-only components on same entity', () => {
        const system = new ComponentSystem();
        system.init(world);

        const entity = world.createEntity('test');
        const lifecycle = entity.addComponent(new LifecycleComponent());
        entity.addComponent(new DataOnlyComponent());

        system.update(1 / 60);

        expect(lifecycle.initCalled).toBe(true);
        expect(lifecycle.updateCalls).toHaveLength(1);
    });

    it('calls destroy on all tracked components when system is destroyed', () => {
        const system = new ComponentSystem();
        system.init(world);

        const entity1 = world.createEntity('a');
        const comp1 = entity1.addComponent(new LifecycleComponent());
        const entity2 = world.createEntity('b');
        const comp2 = entity2.addComponent(new LifecycleComponent());

        system.update(1 / 60);

        system.destroy();

        expect(comp1.destroyCalled).toBe(true);
        expect(comp2.destroyCalled).toBe(true);
    });

    it('re-initializes a new component added after a previous one was removed', () => {
        const system = new ComponentSystem();
        system.init(world);

        const entity = world.createEntity('test');
        const comp1 = entity.addComponent(new LifecycleComponent());

        system.update(1 / 60);
        entity.removeComponent(LifecycleComponent);
        system.update(1 / 60);
        expect(comp1.destroyCalled).toBe(true);

        // Add a new component of the same type
        const comp2 = entity.addComponent(new LifecycleComponent());
        system.update(1 / 60);

        expect(comp2.initCalled).toBe(true);
        expect(comp2.updateCalls).toHaveLength(1);
    });

    it('handles entities added mid-tick cycle', () => {
        const system = new ComponentSystem();
        system.init(world);

        // First tick with no entities
        system.update(1 / 60);

        // Add entity between ticks
        const entity = world.createEntity('late');
        const comp = entity.addComponent(new LifecycleComponent());

        system.update(1 / 60);

        expect(comp.initCalled).toBe(true);
        expect(comp.updateCalls).toHaveLength(1);
    });
});
