// MinimapComponent.ts — Minimap overlay showing the full system at a glance.
// Lives on the 'minimap' entity. Renders on the HUD layer (screen-space).
// Shows planet dots, ship position, viewport rectangle, and fog state.
// Supports click-to-navigate via hit testing.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { GameModeComponent } from './GameModeComponent';
import { FogOfWarComponent, TileVisibility } from './FogOfWarComponent';
import { TransformComponent } from './TransformComponent';
import { RenderComponent } from './RenderComponent';
import { WORLD_SIZE } from './CameraComponent';
import { FOG_GRID_SIZE } from '../data/constants';
import type { CanvasResizeEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { World } from '../core/World';

/** Minimap size in pixels (desktop). */
const MINIMAP_SIZE = 160;

/** Minimap size on narrow viewports. */
const MINIMAP_SMALL_SIZE = 120;

/** Narrow viewport threshold. */
const NARROW_WIDTH = 500;

/** Margin from canvas edge. */
const MINIMAP_MARGIN = 12;

/** Extra offset from bottom to avoid HUD bar overlap. */
const MINIMAP_BOTTOM_OFFSET = 48;

/** World extent mapped into the minimap (matches camera pan clamp). */
const WORLD_EXTENT = WORLD_SIZE * 0.8;

/** Fog cell colours by visibility state. */
const FOG_COLOURS: Record<number, string> = {
    [TileVisibility.Hidden]: 'rgba(0, 0, 0, 0)',
    [TileVisibility.Revealed]: 'rgba(40, 50, 70, 1)',
    [TileVisibility.Active]: 'rgba(70, 90, 130, 1)',
};

export class MinimapComponent extends Component {
    /** Top-left screen x of the minimap. */
    screenX = 0;
    /** Top-left screen y of the minimap. */
    screenY = 0;
    /** Current size in pixels. */
    size = MINIMAP_SIZE;

    /** Offscreen canvas for the fog grid texture (1px per cell). */
    fogCanvas: HTMLCanvasElement | null = null;
    private fogCtx: CanvasRenderingContext2D | null = null;

    /** Track ship position to know when to refresh fog canvas. */
    private lastFogShipX = NaN;
    private lastFogShipY = NaN;

    private eventQueue: EventQueue | null = null;
    private resizeHandler: EventHandler | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

        // Create offscreen fog canvas (deferred from constructor for test environments)
        if (typeof document !== 'undefined') {
            this.fogCanvas = document.createElement('canvas');
            this.fogCanvas.width = FOG_GRID_SIZE;
            this.fogCanvas.height = FOG_GRID_SIZE;
            this.fogCtx = this.fogCanvas.getContext('2d');
        }

        this.recalculatePosition(canvas.width, canvas.height);

        this.resizeHandler = (event): void => {
            const { width, height } = event as CanvasResizeEvent;
            this.recalculatePosition(width, height);
        };
        this.eventQueue.on(GameEvents.CANVAS_RESIZE, this.resizeHandler);
    }

    update(_dt: number): void {
        // Hide minimap outside system view
        const gameMode = this.entity.getComponent(GameModeComponent);
        const render = this.entity.getComponent(RenderComponent);

        if (gameMode && gameMode.mode !== 'system') {
            if (render) render.visible = false;
            return;
        }
        if (render) render.visible = true;

        // Refresh fog canvas when ship has moved
        this.refreshFogIfNeeded();
    }

    /** Convert world coordinates to minimap screen coordinates. */
    worldToMinimap(wx: number, wy: number): { x: number; y: number } {
        return {
            x: this.screenX + ((wx + WORLD_EXTENT) / (2 * WORLD_EXTENT)) * this.size,
            y: this.screenY + ((wy + WORLD_EXTENT) / (2 * WORLD_EXTENT)) * this.size,
        };
    }

    /** Convert minimap screen coordinates to world coordinates. */
    minimapToWorld(mx: number, my: number): { x: number; y: number } {
        return {
            x: ((mx - this.screenX) / this.size) * (2 * WORLD_EXTENT) - WORLD_EXTENT,
            y: ((my - this.screenY) / this.size) * (2 * WORLD_EXTENT) - WORLD_EXTENT,
        };
    }

    /** Returns true if the screen coordinate is inside the minimap rectangle. */
    hitTest(sx: number, sy: number): boolean {
        return (
            sx >= this.screenX &&
            sx <= this.screenX + this.size &&
            sy >= this.screenY &&
            sy <= this.screenY + this.size
        );
    }

    destroy(): void {
        if (this.eventQueue && this.resizeHandler) {
            this.eventQueue.off(GameEvents.CANVAS_RESIZE, this.resizeHandler);
        }
    }

    private recalculatePosition(canvasWidth: number, canvasHeight: number): void {
        this.size = canvasWidth < NARROW_WIDTH ? MINIMAP_SMALL_SIZE : MINIMAP_SIZE;
        this.screenX = canvasWidth - this.size - MINIMAP_MARGIN;
        this.screenY = canvasHeight - this.size - MINIMAP_MARGIN - MINIMAP_BOTTOM_OFFSET;
    }

    private refreshFogIfNeeded(): void {
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const fog = gameState?.getComponent(FogOfWarComponent);
        if (!fog || !this.fogCtx) return;

        const ship = world.getEntityByName('arkSalvage');
        const shipTransform = ship?.getComponent(TransformComponent);
        if (!shipTransform) return;

        // Only refresh when ship has moved significantly
        const dx = shipTransform.x - this.lastFogShipX;
        const dy = shipTransform.y - this.lastFogShipY;
        const halfCell = fog.cellSize / 2;
        if (dx * dx + dy * dy < halfCell * halfCell) return;

        this.lastFogShipX = shipTransform.x;
        this.lastFogShipY = shipTransform.y;

        this.renderFogCanvas(fog);
    }

    private renderFogCanvas(fog: FogOfWarComponent): void {
        const fc = this.fogCtx;
        if (!fc) return;

        fc.clearRect(0, 0, FOG_GRID_SIZE, FOG_GRID_SIZE);

        for (let row = 0; row < FOG_GRID_SIZE; row++) {
            for (let col = 0; col < FOG_GRID_SIZE; col++) {
                const vis = fog.getCellVisibility(col, row);
                if (vis === TileVisibility.Hidden) continue;
                fc.fillStyle = FOG_COLOURS[vis];
                fc.fillRect(col, row, 1, 1);
            }
        }
    }
}
