import { describe, it, expect } from 'vitest';
import { Entity } from '../Entity';
import { Component } from '../Component';

class PositionComponent extends Component {
    constructor(public x: number, public y: number) {
        super();
    }
}

class HealthComponent extends Component {
    constructor(public hp: number) {
        super();
    }
}

describe('Entity', () => {
    it('stores id and debug name', () => {
        const entity = new Entity(42, 'test-ship');
        expect(entity.id).toBe(42);
        expect(entity.name).toBe('test-ship');
    });

    it('adds and retrieves a component by type', () => {
        const entity = new Entity(0, 'e');
        entity.addComponent(new PositionComponent(10, 20));

        const pos = entity.getComponent(PositionComponent);
        expect(pos).not.toBeNull();
        expect(pos!.x).toBe(10);
        expect(pos!.y).toBe(20);
    });

    it('sets back-reference on added component', () => {
        const entity = new Entity(0, 'e');
        const comp = new PositionComponent(0, 0);
        entity.addComponent(comp);

        expect(comp.entity).toBe(entity);
    });

    it('returns null for missing component', () => {
        const entity = new Entity(0, 'e');
        expect(entity.getComponent(PositionComponent)).toBeNull();
    });

    it('checks component existence with hasComponent', () => {
        const entity = new Entity(0, 'e');
        expect(entity.hasComponent(PositionComponent)).toBe(false);

        entity.addComponent(new PositionComponent(0, 0));
        expect(entity.hasComponent(PositionComponent)).toBe(true);
    });

    it('removes a component by type', () => {
        const entity = new Entity(0, 'e');
        entity.addComponent(new PositionComponent(0, 0));
        entity.removeComponent(PositionComponent);

        expect(entity.hasComponent(PositionComponent)).toBe(false);
        expect(entity.getComponent(PositionComponent)).toBeNull();
    });

    it('handles multiple different component types', () => {
        const entity = new Entity(0, 'e');
        entity.addComponent(new PositionComponent(5, 10));
        entity.addComponent(new HealthComponent(100));

        expect(entity.getComponent(PositionComponent)!.x).toBe(5);
        expect(entity.getComponent(HealthComponent)!.hp).toBe(100);
    });

    it('iterates all components', () => {
        const entity = new Entity(0, 'e');
        entity.addComponent(new PositionComponent(0, 0));
        entity.addComponent(new HealthComponent(50));

        const components = [...entity.allComponents()];
        expect(components).toHaveLength(2);
    });
});
