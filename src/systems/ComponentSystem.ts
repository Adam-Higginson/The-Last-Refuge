// ComponentSystem.ts — Drives optional lifecycle methods on Components.
// Iterates all entities each tick, calling init() on first encounter,
// update(dt) each tick, and destroy() when a component is removed.
// This enables entity-specific behaviour without dedicated Systems.

import { System } from '../core/System';
import type { Component } from '../core/Component';
import type { World } from '../core/World';

export class ComponentSystem extends System {
    /** Components that have had init() called */
    private initialized = new Set<Component>();

    /** All components seen last tick — used to detect removals */
    private tracked = new Set<Component>();

    init(world: World): void {
        super.init(world);
    }

    update(dt: number): void {
        const currentComponents = new Set<Component>();

        for (const entity of this.world.allEntities()) {
            for (const component of entity.allComponents()) {
                currentComponents.add(component);

                // First encounter: call init()
                if (!this.initialized.has(component)) {
                    this.initialized.add(component);
                    if (component.init) {
                        component.init();
                    }
                }

                // Every tick: call update()
                if (component.update) {
                    component.update(dt);
                }
            }
        }

        // Detect removed components: in tracked but not in current
        for (const component of this.tracked) {
            if (!currentComponents.has(component)) {
                if (component.destroy) {
                    component.destroy();
                }
                this.initialized.delete(component);
            }
        }

        this.tracked = currentComponents;
    }

    destroy(): void {
        // Destroy all tracked components on system shutdown
        for (const component of this.tracked) {
            if (component.destroy) {
                component.destroy();
            }
        }
        this.tracked.clear();
        this.initialized.clear();
    }
}
