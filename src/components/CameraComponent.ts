// CameraComponent.ts — Camera entity component that maps world coordinates to screen.
// Holds viewport state (canvas dimensions, scale, offset) and provides
// coordinate transform methods. Lives on the 'camera' entity.
// Subscribes to CANVAS_RESIZE to recalculate derived values.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import type { CanvasResizeEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Fixed logical world size — the world is WORLD_SIZE x WORLD_SIZE, centred on (0, 0). */
export const WORLD_SIZE = 1000;

export class CameraComponent extends Component {
    /** Current canvas width in pixels. */
    canvasWidth = 0;
    /** Current canvas height in pixels. */
    canvasHeight = 0;
    /** Fixed world size in logical units. */
    readonly worldSize = WORLD_SIZE;

    // Derived values — recalculated on resize
    /** Uniform scale factor: pixels per world unit. */
    scale = 1;
    /** Screen x offset — canvas centre x in pixels. */
    offsetX = 0;
    /** Screen y offset — canvas centre y in pixels. */
    offsetY = 0;

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
        this.scale = Math.min(width, height) / this.worldSize;
        this.offsetX = width / 2;
        this.offsetY = height / 2;
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
}
