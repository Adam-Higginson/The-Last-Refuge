// InputSystem.ts — Reads mouse state, detects clicks/hovers on selectable entities.
// Emits events for clicks on entities. Updates cursor style on hover.
// Includes a temporary debug key (Space) to request turn advancement until the HUD is built.

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { SelectableComponent } from '../components/SelectableComponent';
import { TransformComponent } from '../components/TransformComponent';
import type { World } from '../core/World';
import type { EventQueue } from '../core/EventQueue';

export class InputSystem extends System {
    private canvas!: HTMLCanvasElement;
    private eventQueue!: EventQueue;
    private mouseX = 0;
    private mouseY = 0;
    private pendingClick = false;

    // Bound handlers for cleanup
    private onMouseMove!: (e: MouseEvent) => void;
    private onClick!: (e: MouseEvent) => void;
    private onKeyDown!: (e: KeyboardEvent) => void;

    init(world: World): void {
        super.init(world);
        this.canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.onMouseMove = (e: MouseEvent): void => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        };

        this.onClick = (_e: MouseEvent): void => {
            this.pendingClick = true;
        };

        // Temporary debug key: Space requests turn advancement
        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
            }
        };

        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
        window.addEventListener('keydown', this.onKeyDown);
    }

    update(_dt: number): void {
        const entities = this.world.getEntitiesWithComponent(SelectableComponent);
        let anythingHovered = false;
        let hoveredCursor = '';

        for (const entity of entities) {
            const selectable = entity.getComponent(SelectableComponent);
            const transform = entity.getComponent(TransformComponent);
            if (!selectable || !transform) continue;

            const dx = this.mouseX - transform.x;
            const dy = this.mouseY - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= selectable.hitRadius) {
                selectable.hovered = true;
                anythingHovered = true;
                hoveredCursor = selectable.cursorStyle;

                // Emit click event if there was a pending click
                if (this.pendingClick) {
                    this.eventQueue.emit({
                        type: GameEvents.ENTITY_CLICK,
                        entityId: entity.id,
                        entityName: entity.name,
                    });
                }
            } else {
                selectable.hovered = false;
            }
        }

        // Update cursor
        this.canvas.style.cursor = anythingHovered ? hoveredCursor : 'default';

        // Clear pending click after processing
        this.pendingClick = false;
    }

    destroy(): void {
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        window.removeEventListener('keydown', this.onKeyDown);
    }
}
