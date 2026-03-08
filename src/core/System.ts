// System.ts — Base class for all systems.
// Systems contain game logic. They run in explicit order each tick,
// iterating over entities that have the components they care about.

import type { World } from './World';

export abstract class System {
    protected world!: World;

    /** Called once when the system is registered with the world */
    init(world: World): void {
        this.world = world;
    }

    /** Called every fixed-timestep update */
    abstract update(dt: number): void;

    /** Called every frame for rendering. Override if the system draws. */
    render(_alpha: number): void {
        // Default: no rendering. Override in RenderSystem etc.
    }

    /** Called once when the system is removed */
    destroy(): void {
        // Override for cleanup
    }
}
