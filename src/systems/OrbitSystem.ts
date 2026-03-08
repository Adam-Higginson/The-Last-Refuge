// OrbitSystem.ts — Advances entities with OrbitComponent along their orbital path.
// Updates TransformComponent position based on current orbit angle.

import { System } from '../core/System';

export class OrbitSystem extends System {
    update(_dt: number): void {
        // TODO: iterate entities with OrbitComponent + TransformComponent
        // TODO: advance orbit angle by speed * dt
        // TODO: set transform x/y from orbit centre + radius * cos/sin(angle)
    }
}
