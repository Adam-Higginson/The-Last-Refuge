// RenderSystem.ts — Draws all entities with RenderComponent to the canvas.
// Sorts by render layer, passes transform data to each entity's draw function.
// Also draws the HUD (turn counter, movement bar, end turn button).

import { System } from '../core/System';

export class RenderSystem extends System {
    update(_dt: number): void {
        // RenderSystem does its work in render(), not update()
    }

    render(_alpha: number): void {
        // TODO: clear canvas
        // TODO: draw star field background
        // TODO: collect all RenderComponent entities, sort by layer
        // TODO: for each, read TransformComponent and call draw()
        // TODO: draw HUD overlay (turn number, movement budget, end turn button)
    }
}
