// InputSystem.ts — Reads mouse state, detects clicks/hovers on selectable entities.
// Emits events for clicks (left and right) on entities and empty space.

import { System } from '../core/System';

export class InputSystem extends System {
    update(_dt: number): void {
        // TODO: track mouse position
        // TODO: hit-test selectable entities (TransformComponent + SelectableComponent)
        // TODO: emit events: 'entity:click', 'entity:rightclick', 'entity:hover'
        // TODO: update cursor style based on hovered entity
    }
}
