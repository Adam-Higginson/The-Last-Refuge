// Entity.ts — An entity is a numeric ID + debug name + bag of components.
// Two communication channels:
//   - entity.getComponent(Type) for sibling component access
//   - entity.emit(event) for cross-entity communication via the event queue

import { Component } from './Component';
import { GameEvent } from './EventQueue';
import { ServiceLocator } from './ServiceLocator';

export type ComponentClass<T extends Component> = new (...args: unknown[]) => T;

export class Entity {
    readonly id: number;
    readonly name: string;
    private components: Map<Function, Component> = new Map();

    constructor(id: number, name: string) {
        this.id = id;
        this.name = name;
    }

    addComponent<T extends Component>(component: T): T {
        component.entity = this;
        this.components.set(component.constructor, component);
        return component;
    }

    getComponent<T extends Component>(type: ComponentClass<T>): T | null {
        return (this.components.get(type) as T) ?? null;
    }

    hasComponent<T extends Component>(type: ComponentClass<T>): boolean {
        return this.components.has(type);
    }

    removeComponent<T extends Component>(type: ComponentClass<T>): void {
        this.components.delete(type);
    }

    /** Emit an event onto the global event queue */
    emit(event: GameEvent): void {
        const queue = ServiceLocator.get<import('./EventQueue').EventQueue>('eventQueue');
        queue.emit(event);
    }

    /** Iterator over all components on this entity */
    allComponents(): IterableIterator<Component> {
        return this.components.values();
    }
}
