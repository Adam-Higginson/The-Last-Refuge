// InputSystem.ts — Reads mouse state, detects clicks/hovers on selectable entities.
// Handles entity selection (left-click) and right-click dispatching.
// Emits events for clicks on entities. Updates cursor style on hover.
// Space key is a keyboard shortcut for turn advancement (alongside the HUD END TURN button).

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { GameModeComponent } from '../components/GameModeComponent';
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
    private pendingRightClick: { x: number; y: number } | null = null;

    // Bound handlers for cleanup
    private onMouseMove!: (e: MouseEvent) => void;
    private onClick!: (e: MouseEvent) => void;
    private onContextMenu!: (e: MouseEvent) => void;
    private onKeyDown!: (e: KeyboardEvent) => void;
    private onTouchStart!: (e: TouchEvent) => void;
    private onTouchMove!: (e: TouchEvent) => void;
    private onTouchEnd!: (e: TouchEvent) => void;

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

        this.onContextMenu = (e: MouseEvent): void => {
            e.preventDefault();
            this.pendingRightClick = { x: e.clientX, y: e.clientY };
        };

        // Keyboard shortcut: Space requests turn advancement
        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
            }
        };

        // Touch handlers — map touch to the same coordinate/flag pipeline
        this.onTouchStart = (e: TouchEvent): void => {
            e.preventDefault();
            const touch = e.touches[0];
            if (touch) {
                this.mouseX = touch.clientX;
                this.mouseY = touch.clientY;
            }
        };

        this.onTouchMove = (e: TouchEvent): void => {
            const touch = e.touches[0];
            if (touch) {
                this.mouseX = touch.clientX;
                this.mouseY = touch.clientY;
            }
        };

        this.onTouchEnd = (e: TouchEvent): void => {
            e.preventDefault();
            this.pendingClick = true;
        };

        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
        this.canvas.addEventListener('contextmenu', this.onContextMenu);
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });
        this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
        window.addEventListener('keydown', this.onKeyDown);
    }

    update(_dt: number): void {
        // Skip entity hover/click processing when not in system map mode.
        // Consume pending inputs so they don't accumulate.
        const gameState = this.world.getEntityByName('gameState');
        const gameMode = gameState?.getComponent(GameModeComponent);
        if (gameMode && gameMode.mode !== 'system') {
            this.pendingClick = false;
            this.pendingRightClick = null;
            return;
        }

        const entities = this.world.getEntitiesWithComponent(SelectableComponent);
        let anythingHovered = false;
        let hoveredCursor = '';
        let clickedEntity = false;

        for (const entity of entities) {
            const selectable = entity.getComponent(SelectableComponent);
            const transform = entity.getComponent(TransformComponent);
            if (!selectable || !transform) continue;

            // Broadcast cursor position so renderers can draw hover previews
            selectable.cursorX = this.mouseX;
            selectable.cursorY = this.mouseY;

            const dx = this.mouseX - transform.x;
            const dy = this.mouseY - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= selectable.hitRadius) {
                selectable.hovered = true;
                anythingHovered = true;
                hoveredCursor = selectable.cursorStyle;

                // Handle left-click: select entity and emit click event
                if (this.pendingClick) {
                    clickedEntity = true;
                    // Select this entity, deselect all others
                    for (const other of entities) {
                        const otherSel = other.getComponent(SelectableComponent);
                        if (otherSel) {
                            otherSel.selected = other === entity;
                        }
                    }
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

        // Deselect all if clicking on empty space
        if (this.pendingClick && !clickedEntity) {
            for (const entity of entities) {
                const selectable = entity.getComponent(SelectableComponent);
                if (selectable) {
                    selectable.selected = false;
                }
            }
        }

        // Dispatch right-click: entity right-click if on an entity, else generic right-click
        if (this.pendingRightClick) {
            let rightClickedEntity = false;
            for (const entity of entities) {
                const selectable = entity.getComponent(SelectableComponent);
                const transform = entity.getComponent(TransformComponent);
                if (!selectable || !transform) continue;

                const rdx = this.pendingRightClick.x - transform.x;
                const rdy = this.pendingRightClick.y - transform.y;
                const rDist = Math.sqrt(rdx * rdx + rdy * rdy);

                if (rDist <= selectable.hitRadius) {
                    rightClickedEntity = true;
                    this.eventQueue.emit({
                        type: GameEvents.ENTITY_RIGHT_CLICK,
                        entityId: entity.id,
                        entityName: entity.name,
                    });
                    break;
                }
            }

            if (!rightClickedEntity) {
                this.eventQueue.emit({
                    type: GameEvents.RIGHT_CLICK,
                    x: this.pendingRightClick.x,
                    y: this.pendingRightClick.y,
                });
            }
            this.pendingRightClick = null;
        }

        // Update cursor
        this.canvas.style.cursor = anythingHovered ? hoveredCursor : 'default';

        // Clear pending click after processing
        this.pendingClick = false;
    }

    destroy(): void {
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        this.canvas.removeEventListener('contextmenu', this.onContextMenu);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
        this.canvas.removeEventListener('touchend', this.onTouchEnd);
        window.removeEventListener('keydown', this.onKeyDown);
    }
}
