import { describe, it, expect, vi } from 'vitest';
import { World } from '../World';
import { System } from '../System';
import { Component } from '../Component';

class TagComponent extends Component {
    constructor(public tag: string) {
        super();
    }
}

class StubSystem extends System {
    updateCalls: number[] = [];
    renderCalls: number[] = [];

    update(dt: number): void {
        this.updateCalls.push(dt);
    }

    render(alpha: number): void {
        this.renderCalls.push(alpha);
    }
}

describe('World', () => {
    it('creates entities with incrementing IDs', () => {
        const world = new World();
        const a = world.createEntity('alpha');
        const b = world.createEntity('beta');

        expect(a.id).toBe(0);
        expect(b.id).toBe(1);
    });

    it('retrieves entity by ID', () => {
        const world = new World();
        const entity = world.createEntity('ship');

        expect(world.getEntity(entity.id)).toBe(entity);
    });

    it('retrieves entity by name', () => {
        const world = new World();
        const entity = world.createEntity('ship');

        expect(world.getEntityByName('ship')).toBe(entity);
    });

    it('returns null for unknown entity', () => {
        const world = new World();

        expect(world.getEntity(999)).toBeNull();
        expect(world.getEntityByName('nope')).toBeNull();
    });

    it('removes entity by ID', () => {
        const world = new World();
        const entity = world.createEntity('ship');
        world.removeEntity(entity.id);

        expect(world.getEntity(entity.id)).toBeNull();
        expect(world.getEntityByName('ship')).toBeNull();
    });

    it('queries entities by component type', () => {
        const world = new World();
        const a = world.createEntity('a');
        const b = world.createEntity('b');
        const c = world.createEntity('c');

        a.addComponent(new TagComponent('yes'));
        c.addComponent(new TagComponent('also'));

        const results = world.getEntitiesWithComponent(TagComponent);
        expect(results).toHaveLength(2);
        expect(results).toContain(a);
        expect(results).toContain(c);
        expect(results).not.toContain(b);
    });

    it('calls system init with world reference', () => {
        const world = new World();
        const system = new StubSystem();
        const initSpy = vi.spyOn(system, 'init');

        world.addSystem(system);

        expect(initSpy).toHaveBeenCalledWith(world);
    });

    it('calls update on systems in order', () => {
        const world = new World();
        const order: string[] = [];

        class FirstSystem extends System {
            update(): void { order.push('first'); }
        }
        class SecondSystem extends System {
            update(): void { order.push('second'); }
        }

        world.addSystem(new FirstSystem());
        world.addSystem(new SecondSystem());
        world.update(0.016);

        expect(order).toEqual(['first', 'second']);
    });

    it('calls render on systems with alpha', () => {
        const world = new World();
        const system = new StubSystem();
        world.addSystem(system);

        world.render(0.5);

        expect(system.renderCalls).toEqual([0.5]);
    });

    it('iterates all entities', () => {
        const world = new World();
        world.createEntity('a');
        world.createEntity('b');

        const entities = [...world.allEntities()];
        expect(entities).toHaveLength(2);
    });
});
