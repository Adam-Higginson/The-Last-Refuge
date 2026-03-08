// World.ts — Central registry for entities and systems.
// Provides entity creation, lookup, and querying by component type.

import { Entity, ComponentClass } from './Entity';
import { Component } from './Component';
import { System } from './System';

export class World {
    private entities: Map<number, Entity> = new Map();
    private namedEntities: Map<string, Entity> = new Map();
    private systems: System[] = [];
    private nextId = 0;

    // --- Entity management ---

    createEntity(name: string): Entity {
        const entity = new Entity(this.nextId++, name);
        this.entities.set(entity.id, entity);
        this.namedEntities.set(name, entity);
        return entity;
    }

    getEntity(id: number): Entity | null {
        return this.entities.get(id) ?? null;
    }

    getEntityByName(name: string): Entity | null {
        return this.namedEntities.get(name) ?? null;
    }

    /** Return all entities that have a given component type */
    getEntitiesWithComponent<T extends Component>(type: ComponentClass<T>): Entity[] {
        const result: Entity[] = [];
        for (const entity of this.entities.values()) {
            if (entity.hasComponent(type)) {
                result.push(entity);
            }
        }
        return result;
    }

    removeEntity(id: number): void {
        const entity = this.entities.get(id);
        if (entity) {
            this.entities.delete(id);
            this.namedEntities.delete(entity.name);
        }
    }

    allEntities(): IterableIterator<Entity> {
        return this.entities.values();
    }

    // --- System management ---

    addSystem(system: System): void {
        system.init(this);
        this.systems.push(system);
    }

    /** Called by the game loop every fixed-timestep tick */
    update(dt: number): void {
        for (const system of this.systems) {
            system.update(dt);
        }
    }

    /** Called by the game loop every frame with interpolation alpha */
    render(alpha: number): void {
        for (const system of this.systems) {
            system.render(alpha);
        }
    }

    destroy(): void {
        for (const system of this.systems) {
            system.destroy();
        }
        this.systems = [];
        this.entities.clear();
        this.namedEntities.clear();
    }
}
