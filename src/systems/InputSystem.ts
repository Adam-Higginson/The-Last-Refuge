// InputSystem.ts — Reads mouse/touch state, detects clicks/hovers on selectable entities.
// Handles entity selection (left-click), right-click dispatching, camera zoom (scroll wheel /
// pinch), and camera pan (left-click drag, single-finger touch drag).
// Emits events for clicks on entities. Updates cursor style on hover.
// Space key is a keyboard shortcut for turn advancement (alongside the HUD END TURN button).
// All hit-testing and emitted coordinates are in world space — InputSystem converts
// screen (pixel) coordinates to world coordinates via CameraComponent.

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { CameraComponent, MIN_ZOOM, MAX_ZOOM } from '../components/CameraComponent';
import { GameModeComponent } from '../components/GameModeComponent';
import { FogOfWarComponent } from '../components/FogOfWarComponent';
import { MinimapComponent } from '../components/MinimapComponent';
import { MoveConfirmComponent } from '../components/MoveConfirmComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import { TransformComponent } from '../components/TransformComponent';
import type { World } from '../core/World';
import type { EventQueue } from '../core/EventQueue';

/** Minimum drag distance (screen pixels) before a drag is recognised as a pan. */
const PAN_THRESHOLD = 5;

/** Scroll-wheel zoom factor per step. */
const WHEEL_ZOOM_FACTOR = 1.15;

export class InputSystem extends System {
    private canvas!: HTMLCanvasElement;
    private eventQueue!: EventQueue;
    private mouseX = 0;
    private mouseY = 0;
    private pendingClick = false;
    private pendingClickIsTouch = false;
    private pendingRightClick: { x: number; y: number } | null = null;

    // Pan state (mouse)
    private panButton: number | null = null;
    private panStartX = 0;
    private panStartY = 0;
    private lastPanX = 0;
    private lastPanY = 0;
    private panMoved = false;
    private isPanning = false;

    // Touch pan state
    private touchOnMinimap = false;
    private isTouchPanning = false;
    private touchStartX = 0;
    private touchStartY = 0;
    private lastTouchX = 0;
    private lastTouchY = 0;
    private touchMoved = false;

    // Pinch zoom state
    private isPinching = false;
    private pinchStartDist = 0;
    private pinchStartZoom = 0;

    // Bound handlers for cleanup
    private onMouseMove!: (e: MouseEvent) => void;
    private onMouseDown!: (e: MouseEvent) => void;
    private onMouseUp!: (e: MouseEvent) => void;
    private onClick!: (e: MouseEvent) => void;
    private onContextMenu!: (e: MouseEvent) => void;
    private onWheel!: (e: WheelEvent) => void;
    private onKeyDown!: (e: KeyboardEvent) => void;
    private onTouchStart!: (e: TouchEvent) => void;
    private onTouchMove!: (e: TouchEvent) => void;
    private onTouchEnd!: (e: TouchEvent) => void;

    init(world: World): void {
        super.init(world);
        this.canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        // --- Mouse handlers ---

        this.onMouseMove = (e: MouseEvent): void => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;

            // Handle pan dragging
            if (this.panButton !== null) {
                const dx = e.clientX - this.panStartX;
                const dy = e.clientY - this.panStartY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist >= PAN_THRESHOLD) {
                    this.panMoved = true;
                    this.isPanning = true;

                    const camera = this.getCamera();
                    if (camera) {
                        const worldDx = -(e.clientX - this.lastPanX) / camera.scale;
                        const worldDy = -(e.clientY - this.lastPanY) / camera.scale;
                        camera.pan(worldDx, worldDy);
                    }

                    this.lastPanX = e.clientX;
                    this.lastPanY = e.clientY;
                }
            }
        };

        this.onMouseDown = (e: MouseEvent): void => {
            if (e.button === 0) {
                // Suppress pan if click starts on the minimap
                const minimapEntity = this.world.getEntityByName('minimap');
                const minimapComp = minimapEntity?.getComponent(MinimapComponent);
                if (minimapComp && minimapComp.hitTest(e.clientX, e.clientY)) return;

                // Left button — potential pan start (or click if no drag)
                this.panButton = 0;
                this.panStartX = e.clientX;
                this.panStartY = e.clientY;
                this.lastPanX = e.clientX;
                this.lastPanY = e.clientY;
                this.panMoved = false;
                this.isPanning = false;
            }
        };

        this.onMouseUp = (e: MouseEvent): void => {
            if (e.button === 0 && this.panButton === 0) {
                this.panButton = null;
                this.isPanning = false;
                // panMoved is NOT reset here — it's consumed by the onClick
                // handler (which fires after mouseup) to suppress click after drag.
            }
        };

        this.onClick = (_e: MouseEvent): void => {
            // Suppress click if the user was panning (dragged past threshold)
            if (!this.panMoved) {
                this.pendingClick = true;
                this.pendingClickIsTouch = false;
            }
            this.panMoved = false;
        };

        this.onContextMenu = (e: MouseEvent): void => {
            e.preventDefault();
            this.pendingRightClick = { x: e.clientX, y: e.clientY };
        };

        this.onWheel = (e: WheelEvent): void => {
            e.preventDefault();
            const camera = this.getCamera();
            if (!camera) return;

            const zoomFactor = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
            camera.zoom(zoomFactor, e.clientX, e.clientY);
        };

        // Keyboard shortcut: Space requests turn advancement
        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
            }
        };

        // --- Touch handlers ---

        this.onTouchStart = (e: TouchEvent): void => {
            if (e.touches.length === 2) {
                // Pinch start
                e.preventDefault();
                this.isPinching = true;
                this.isTouchPanning = false;
                this.touchMoved = true; // suppress tap on pinch
                const t0 = e.touches[0];
                const t1 = e.touches[1];
                this.pinchStartDist = Math.sqrt(
                    (t1.clientX - t0.clientX) ** 2 + (t1.clientY - t0.clientY) ** 2,
                );
                const camera = this.getCamera();
                this.pinchStartZoom = camera?.targetZoomLevel ?? 1;
            } else if (e.touches.length === 1) {
                // Single touch start — potential pan or tap
                e.preventDefault();
                const touch = e.touches[0];
                this.mouseX = touch.clientX;
                this.mouseY = touch.clientY;
                this.touchStartX = touch.clientX;
                this.touchStartY = touch.clientY;
                this.lastTouchX = touch.clientX;
                this.lastTouchY = touch.clientY;
                this.touchMoved = false;
                this.isTouchPanning = false;

                // Suppress touch panning if starting on the minimap
                const mmEntity = this.world.getEntityByName('minimap');
                const mmComp = mmEntity?.getComponent(MinimapComponent);
                this.touchOnMinimap = mmComp?.hitTest(touch.clientX, touch.clientY) ?? false;
            }
        };

        this.onTouchMove = (e: TouchEvent): void => {
            if (this.isPinching && e.touches.length >= 2) {
                e.preventDefault();
                const t0 = e.touches[0];
                const t1 = e.touches[1];
                const dist = Math.sqrt(
                    (t1.clientX - t0.clientX) ** 2 + (t1.clientY - t0.clientY) ** 2,
                );
                const camera = this.getCamera();
                if (camera && this.pinchStartDist > 0) {
                    const ratio = dist / this.pinchStartDist;
                    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.pinchStartZoom * ratio));
                    // Set both zoom and target directly for real-time pinch feel
                    camera.zoomLevel = newZoom;
                    camera.targetZoomLevel = newZoom;
                    // Trigger recalculation via resize to same size
                    camera.resize(camera.canvasWidth, camera.canvasHeight);
                }
            } else if (e.touches.length === 1 && !this.isPinching) {
                const touch = e.touches[0];
                this.mouseX = touch.clientX;
                this.mouseY = touch.clientY;

                const dx = touch.clientX - this.touchStartX;
                const dy = touch.clientY - this.touchStartY;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist >= PAN_THRESHOLD && !this.touchOnMinimap) {
                    this.touchMoved = true;
                    this.isTouchPanning = true;

                    const camera = this.getCamera();
                    if (camera) {
                        const worldDx = -(touch.clientX - this.lastTouchX) / camera.scale;
                        const worldDy = -(touch.clientY - this.lastTouchY) / camera.scale;
                        camera.pan(worldDx, worldDy);
                    }

                    this.lastTouchX = touch.clientX;
                    this.lastTouchY = touch.clientY;
                }
            }
        };

        this.onTouchEnd = (e: TouchEvent): void => {
            if (this.isPinching) {
                if (e.touches.length < 2) {
                    this.isPinching = false;
                }
                e.preventDefault();
                return;
            }

            if (!this.touchMoved) {
                // Tap — treat as click
                e.preventDefault();
                this.pendingClick = true;
                this.pendingClickIsTouch = true;
            }

            this.isTouchPanning = false;
            this.touchMoved = false;
        };

        // --- Register event listeners ---

        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('mouseup', this.onMouseUp);
        this.canvas.addEventListener('click', this.onClick);
        this.canvas.addEventListener('contextmenu', this.onContextMenu);
        this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
        window.addEventListener('keydown', this.onKeyDown);
    }

    /** Get the CameraComponent from the camera entity, or null if not found. */
    private getCamera(): CameraComponent | null {
        const cameraEntity = this.world.getEntityByName('camera');
        return cameraEntity?.getComponent(CameraComponent) ?? null;
    }

    /** Convert screen coordinates to world coordinates via CameraComponent.
     *  Falls back to identity (raw screen coords) if no camera entity exists. */
    private screenToWorld(sx: number, sy: number): { x: number; y: number } {
        const camera = this.getCamera();
        if (camera) {
            return camera.screenToWorld(sx, sy);
        }
        return { x: sx, y: sy };
    }

    update(_dt: number): void {
        // Minimap click-to-navigate (intercept before other processing)
        if (this.pendingClick) {
            const minimapEntity = this.world.getEntityByName('minimap');
            const minimapComp = minimapEntity?.getComponent(MinimapComponent);
            if (minimapComp && minimapComp.hitTest(this.mouseX, this.mouseY)) {
                const worldPos = minimapComp.minimapToWorld(this.mouseX, this.mouseY);
                const camera = this.getCamera();
                if (camera) {
                    camera.panTo(worldPos.x, worldPos.y);
                }
                this.pendingClick = false;
            }
        }

        // Skip entity hover/click processing when not in system map mode.
        // Consume pending inputs so they don't accumulate.
        const gameState = this.world.getEntityByName('gameState');
        const gameMode = gameState?.getComponent(GameModeComponent);
        if (gameMode && gameMode.mode !== 'system') {
            this.pendingClick = false;
            this.pendingRightClick = null;
            return;
        }

        // Convert raw screen-space mouse position to world coordinates
        const worldMouse = this.screenToWorld(this.mouseX, this.mouseY);

        const entities = this.world.getEntitiesWithComponent(SelectableComponent);
        let anythingHovered = false;
        let hoveredCursor = '';
        let clickedEntity = false;

        // Fog of war interaction gating
        const fogComp = gameState?.getComponent(FogOfWarComponent) ?? null;
        const ship = this.world.getEntityByName('arkSalvage');
        const shipTransform = ship?.getComponent(TransformComponent) ?? null;

        for (const entity of entities) {
            const selectable = entity.getComponent(SelectableComponent);
            const transform = entity.getComponent(TransformComponent);
            if (!selectable || !transform) continue;

            // Ship is always interactable; other entities need fog check
            if (entity.name !== 'arkSalvage' && fogComp && shipTransform) {
                if (!fogComp.isInteractable(transform.x, transform.y, shipTransform.x, shipTransform.y)) {
                    selectable.hovered = false;
                    continue;
                }
            }

            // Broadcast cursor position in world coords so renderers can draw hover previews
            selectable.cursorX = worldMouse.x;
            selectable.cursorY = worldMouse.y;

            const dx = worldMouse.x - transform.x;
            const dy = worldMouse.y - transform.y;
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

        // Empty space click handling
        if (this.pendingClick && !clickedEntity) {
            const ship = this.world.getEntityByName('arkSalvage');
            const shipSel = ship?.getComponent(SelectableComponent);
            const moveConfirm = ship?.getComponent(MoveConfirmComponent);

            if (shipSel?.selected && moveConfirm && this.pendingClickIsTouch) {
                // Touch: two-tap confirm via MoveConfirmComponent
                moveConfirm.handleTap(worldMouse.x, worldMouse.y);
            } else {
                // Desktop left-click on empty space: deselect all
                for (const entity of entities) {
                    const selectable = entity.getComponent(SelectableComponent);
                    if (selectable) {
                        selectable.selected = false;
                    }
                }
                moveConfirm?.clear();
            }
        }

        // Dispatch right-click: entity right-click if on an entity, else generic right-click
        if (this.pendingRightClick) {
            const worldClick = this.screenToWorld(
                this.pendingRightClick.x,
                this.pendingRightClick.y,
            );
            let rightClickedEntity = false;
            for (const entity of entities) {
                const selectable = entity.getComponent(SelectableComponent);
                const transform = entity.getComponent(TransformComponent);
                if (!selectable || !transform) continue;

                // Fog gating for right-click too
                if (entity.name !== 'arkSalvage' && fogComp && shipTransform) {
                    if (!fogComp.isInteractable(transform.x, transform.y, shipTransform.x, shipTransform.y)) {
                        continue;
                    }
                }

                const rdx = worldClick.x - transform.x;
                const rdy = worldClick.y - transform.y;
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
                    x: worldClick.x,
                    y: worldClick.y,
                });
            }
            this.pendingRightClick = null;
        }

        // Update cursor
        if (this.isPanning || this.isTouchPanning) {
            this.canvas.style.cursor = 'grabbing';
        } else if (anythingHovered) {
            this.canvas.style.cursor = hoveredCursor;
        } else {
            this.canvas.style.cursor = 'default';
        }

        // Clear pending click after processing
        this.pendingClick = false;
    }

    destroy(): void {
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('click', this.onClick);
        this.canvas.removeEventListener('contextmenu', this.onContextMenu);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
        this.canvas.removeEventListener('touchend', this.onTouchEnd);
        window.removeEventListener('keydown', this.onKeyDown);
    }
}
