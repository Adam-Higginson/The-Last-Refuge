// CameraComponent.ts — Camera entity component that maps world coordinates to screen.
// Holds viewport state (canvas dimensions, scale, offset) and provides
// coordinate transform methods. Supports zoom (smooth interpolation toward
// a target level, anchored on a screen point) and pan (world-space offset).
// Lives on the 'camera' entity.
// Subscribes to CANVAS_RESIZE to recalculate derived values.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import type { CanvasResizeEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Fixed logical world size — the world is WORLD_SIZE x WORLD_SIZE, centred on (0, 0). */
export const WORLD_SIZE = 10_000;

/** Minimum zoom multiplier — shows the full system. */
export const MIN_ZOOM = 0.5;

/** Maximum zoom multiplier — fine detail. */
export const MAX_ZOOM = 10.0;

/** Default zoom — close-up framing the inner system. */
export const DEFAULT_ZOOM = 5.0;

/** Exponential smoothing time constant for zoom interpolation (seconds). */
const ZOOM_SMOOTHING = 0.06;

export class CameraComponent extends Component {
    /** Current canvas width in pixels. */
    canvasWidth = 0;
    /** Current canvas height in pixels. */
    canvasHeight = 0;
    /** Fixed world size in logical units. */
    readonly worldSize = WORLD_SIZE;

    // Derived values — recalculated via recalculate()
    /** Uniform scale factor: pixels per world unit (incorporates zoom). */
    scale = 1;
    /** Screen x offset in pixels (incorporates pan). */
    offsetX = 0;
    /** Screen y offset in pixels (incorporates pan). */
    offsetY = 0;

    /** Pixels per world unit at zoom 1.0. */
    private baseScale = 1;

    /** Current zoom multiplier (interpolated toward targetZoomLevel). */
    zoomLevel = DEFAULT_ZOOM;
    /** Target zoom level for smooth interpolation. */
    targetZoomLevel = DEFAULT_ZOOM;
    /** World-space x of the camera centre (pan offset from origin). */
    panX = 0;
    /** World-space y of the camera centre (pan offset from origin). */
    panY = 0;

    // Zoom animation anchor — the world point that stays fixed on screen during zoom
    private zoomAnchorWorldX = 0;
    private zoomAnchorWorldY = 0;
    private zoomAnchorScreenX = 0;
    private zoomAnchorScreenY = 0;
    private isZoomAnimating = false;

    private eventQueue: EventQueue | null = null;
    private resizeHandler: EventHandler | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

        // Set initial dimensions
        this.resize(canvas.width, canvas.height);

        // Subscribe to future resize events
        this.resizeHandler = (event): void => {
            const { width, height } = event as CanvasResizeEvent;
            this.resize(width, height);
        };
        this.eventQueue.on(GameEvents.CANVAS_RESIZE, this.resizeHandler);
    }

    /** Update canvas dimensions and recalculate derived values. */
    resize(width: number, height: number): void {
        this.canvasWidth = width;
        this.canvasHeight = height;
        this.recalculate();
    }

    /** Smooth zoom interpolation — called each tick by ComponentSystem. */
    update(dt: number): void {
        const diff = this.targetZoomLevel - this.zoomLevel;
        if (Math.abs(diff) < 0.001) {
            if (this.isZoomAnimating) {
                this.zoomLevel = this.targetZoomLevel;
                this.isZoomAnimating = false;
                this.recalculate();
            }
            return;
        }

        // Exponential interpolation
        const factor = 1 - Math.exp(-dt / ZOOM_SMOOTHING);
        this.zoomLevel += diff * factor;

        // Recompute pan so the anchor point stays fixed on screen
        if (this.isZoomAnimating) {
            const newScale = this.baseScale * this.zoomLevel;
            this.panX = this.zoomAnchorWorldX - (this.zoomAnchorScreenX - this.canvasWidth / 2) / newScale;
            this.panY = this.zoomAnchorWorldY - (this.zoomAnchorScreenY - this.canvasHeight / 2) / newScale;
        }

        this.recalculate();
        this.clampPan();
    }

    /** Request a zoom change centred on the given screen point. */
    zoom(delta: number, screenX: number, screenY: number): void {
        // Store the world point under the cursor before zoom
        const worldBefore = this.screenToWorld(screenX, screenY);
        this.zoomAnchorWorldX = worldBefore.x;
        this.zoomAnchorWorldY = worldBefore.y;
        this.zoomAnchorScreenX = screenX;
        this.zoomAnchorScreenY = screenY;
        this.isZoomAnimating = true;

        // Apply zoom delta with clamping
        this.targetZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.targetZoomLevel * delta));
    }

    /** Pan the camera by a world-space delta. */
    pan(worldDx: number, worldDy: number): void {
        this.panX += worldDx;
        this.panY += worldDy;
        // Clear zoom anchor so panning during zoom animation doesn't fight
        this.isZoomAnimating = false;
        this.clampPan();
        this.recalculate();
    }

    /**
     * Apply the camera transform to a 2D context.
     * After calling this, drawing at world coordinates (x, y) will appear
     * at the correct screen position.
     */
    applyTransform(ctx: CanvasRenderingContext2D): void {
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);
    }

    /** Convert world coordinates to screen (pixel) coordinates. */
    worldToScreen(wx: number, wy: number): { x: number; y: number } {
        return {
            x: wx * this.scale + this.offsetX,
            y: wy * this.scale + this.offsetY,
        };
    }

    /** Convert screen (pixel) coordinates to world coordinates. */
    screenToWorld(sx: number, sy: number): { x: number; y: number } {
        return {
            x: (sx - this.offsetX) / this.scale,
            y: (sy - this.offsetY) / this.scale,
        };
    }

    /** Convert a world-space distance to screen-space pixels. */
    worldToScreenDist(d: number): number {
        return d * this.scale;
    }

    destroy(): void {
        if (this.eventQueue && this.resizeHandler) {
            this.eventQueue.off(GameEvents.CANVAS_RESIZE, this.resizeHandler);
        }
    }

    /** Recalculate all derived values from canvas dimensions, zoom, and pan. */
    private recalculate(): void {
        this.baseScale = Math.min(this.canvasWidth, this.canvasHeight) / this.worldSize;
        this.scale = this.baseScale * this.zoomLevel;
        this.offsetX = this.canvasWidth / 2 - this.panX * this.scale;
        this.offsetY = this.canvasHeight / 2 - this.panY * this.scale;
    }

    /** Soft-clamp pan so the star (world origin) remains reachable. */
    private clampPan(): void {
        const maxPan = this.worldSize * 0.4;
        this.panX = Math.max(-maxPan, Math.min(maxPan, this.panX));
        this.panY = Math.max(-maxPan, Math.min(maxPan, this.panY));
        this.recalculate();
    }
}
