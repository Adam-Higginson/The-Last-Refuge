// MovementSystem.ts — Animates entities with MovementComponent toward their target.
// Updates TransformComponent position each tick, subtracts from movement budget.

import { System } from '../core/System';

export class MovementSystem extends System {
    update(_dt: number): void {
        // TODO: iterate entities with MovementComponent + TransformComponent
        // TODO: if moving, lerp position toward target at movement speed
        // TODO: update facing angle
        // TODO: when target reached, set moving = false
    }
}
