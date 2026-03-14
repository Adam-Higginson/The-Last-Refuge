// FogOfWarComponent.ts — Fog of war grid tracking visibility state.
// Lives on the gameState entity. Tracks which cells have been revealed
// by the ship's scan radii. Updated each frame by its own lifecycle.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameModeComponent } from './GameModeComponent';
import { TransformComponent } from './TransformComponent';
import {
    FOG_GRID_SIZE,
    FOG_CELL_SIZE,
    FOG_DETAIL_RADIUS,
    FOG_BLIP_RADIUS,
} from '../data/constants';
import type { World } from '../core/World';

export const TileVisibility = {
    Hidden: 0,
    Revealed: 1,
    Active: 2,
} as const;

export type TileVisibility = (typeof TileVisibility)[keyof typeof TileVisibility];

export type EntityZone = 'active' | 'blip' | 'hidden';

const HALF_WORLD = (FOG_GRID_SIZE * FOG_CELL_SIZE) / 2;

export class FogOfWarComponent extends Component {
    readonly gridSize = FOG_GRID_SIZE;
    readonly cellSize = FOG_CELL_SIZE;
    readonly detailRadius = FOG_DETAIL_RADIUS;
    readonly blipRadius = FOG_BLIP_RADIUS;

    /** Flat visibility grid: gridSize * gridSize entries. */
    readonly grid: Uint8Array;

    /** Set of cell indices currently marked Active (for efficient demotion). */
    private activeCells = new Set<number>();

    /** Set of cell indices marked Revealed (for efficient rendering). */
    readonly revealedCells = new Set<number>();

    /** Last known positions of entities (for stale rendering when revealed). */
    private readonly lastKnownPositions = new Map<number, { x: number; y: number }>();

    /** Last ship position used for fog update (skip if unchanged). */
    private lastShipX = NaN;
    private lastShipY = NaN;

    constructor() {
        super();
        this.grid = new Uint8Array(FOG_GRID_SIZE * FOG_GRID_SIZE);
    }

    /** Convert world coordinates to grid cell indices. */
    worldToCell(wx: number, wy: number): { col: number; row: number } {
        const col = Math.floor((wx + HALF_WORLD) / this.cellSize);
        const row = Math.floor((wy + HALF_WORLD) / this.cellSize);
        return {
            col: Math.max(0, Math.min(this.gridSize - 1, col)),
            row: Math.max(0, Math.min(this.gridSize - 1, row)),
        };
    }

    /** Get the world-space centre of a grid cell. */
    cellToWorld(col: number, row: number): { x: number; y: number } {
        return {
            x: col * this.cellSize + this.cellSize / 2 - HALF_WORLD,
            y: row * this.cellSize + this.cellSize / 2 - HALF_WORLD,
        };
    }

    getCellVisibility(col: number, row: number): TileVisibility {
        return this.grid[row * this.gridSize + col] as TileVisibility;
    }

    setCellVisibility(col: number, row: number, state: TileVisibility): void {
        this.grid[row * this.gridSize + col] = state;
    }

    getVisibilityAtWorld(wx: number, wy: number): TileVisibility {
        const { col, row } = this.worldToCell(wx, wy);
        return this.getCellVisibility(col, row);
    }

    /** Returns which zone an entity falls in relative to the ship. */
    getEntityZone(wx: number, wy: number, shipX: number, shipY: number): EntityZone {
        const dx = wx - shipX;
        const dy = wy - shipY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.detailRadius) return 'active';
        if (dist <= this.blipRadius) return 'blip';
        return 'hidden';
    }

    /** Whether an entity at (wx,wy) can be clicked/hovered. */
    isInteractable(wx: number, wy: number, shipX: number, shipY: number): boolean {
        return this.getEntityZone(wx, wy, shipX, shipY) === 'active';
    }

    /** Record an entity's position as its last known location (for stale rendering). */
    recordPosition(entityId: number, x: number, y: number): void {
        this.lastKnownPositions.set(entityId, { x, y });
    }

    /** Get the last known position of an entity (stale position for revealed planets). */
    getLastKnownPosition(entityId: number): { x: number; y: number } | undefined {
        return this.lastKnownPositions.get(entityId);
    }

    /** Pre-reveal cells around a position (called on init). */
    revealAround(cx: number, cy: number, radius: number): void {
        const cellRadius = Math.ceil(radius / this.cellSize);
        const centre = this.worldToCell(cx, cy);
        const radiusSq = radius * radius;

        for (let dr = -cellRadius; dr <= cellRadius; dr++) {
            for (let dc = -cellRadius; dc <= cellRadius; dc++) {
                const col = centre.col + dc;
                const row = centre.row + dr;
                if (col < 0 || col >= this.gridSize || row < 0 || row >= this.gridSize) continue;

                const worldPos = this.cellToWorld(col, row);
                const dx = worldPos.x - cx;
                const dy = worldPos.y - cy;
                if (dx * dx + dy * dy <= radiusSq) {
                    const idx = row * this.gridSize + col;
                    this.grid[idx] = TileVisibility.Active;
                    this.activeCells.add(idx);
                }
            }
        }
    }

    init(): void {
        // Pre-reveal around the ship's starting position
        const world = ServiceLocator.get<World>('world');
        const ship = world.getEntityByName('arkSalvage');
        const shipTransform = ship?.getComponent(TransformComponent);
        if (shipTransform) {
            this.revealAround(shipTransform.x, shipTransform.y, this.blipRadius);
        }
    }

    update(_dt: number): void {
        // Skip fog updates during planet view
        const gameMode = this.entity.getComponent(GameModeComponent);
        if (gameMode && gameMode.mode !== 'system') return;

        const world = ServiceLocator.get<World>('world');
        const ship = world.getEntityByName('arkSalvage');
        const shipTransform = ship?.getComponent(TransformComponent);
        if (!shipTransform) return;

        const shipX = shipTransform.x;
        const shipY = shipTransform.y;

        // Skip update if ship hasn't moved (within half a cell)
        const movedDx = shipX - this.lastShipX;
        const movedDy = shipY - this.lastShipY;
        const halfCell = this.cellSize / 2;
        if (movedDx * movedDx + movedDy * movedDy < halfCell * halfCell) return;
        this.lastShipX = shipX;
        this.lastShipY = shipY;

        // Pass 1: Demote all currently active cells to revealed
        for (const idx of this.activeCells) {
            this.grid[idx] = TileVisibility.Revealed;
            this.revealedCells.add(idx);
        }
        this.activeCells.clear();

        // Pass 2: Promote cells within blip radius to active
        const cellRadius = Math.ceil(this.blipRadius / this.cellSize);
        const centre = this.worldToCell(shipX, shipY);
        const blipRadiusSq = this.blipRadius * this.blipRadius;

        for (let dr = -cellRadius; dr <= cellRadius; dr++) {
            for (let dc = -cellRadius; dc <= cellRadius; dc++) {
                const col = centre.col + dc;
                const row = centre.row + dr;
                if (col < 0 || col >= this.gridSize || row < 0 || row >= this.gridSize) continue;

                const worldPos = this.cellToWorld(col, row);
                const dx = worldPos.x - shipX;
                const dy = worldPos.y - shipY;
                if (dx * dx + dy * dy <= blipRadiusSq) {
                    const idx = row * this.gridSize + col;
                    this.grid[idx] = TileVisibility.Active;
                    this.activeCells.add(idx);
                    this.revealedCells.delete(idx);
                }
            }
        }
    }
}

/**
 * Standalone fog zone lookup — resolves ship + fog from ServiceLocator.
 * Returns 'active' if no fog or world service exists (graceful degradation).
 */
export function getEntityFogZone(wx: number, wy: number): EntityZone {
    let world: World;
    try {
        world = ServiceLocator.get<World>('world');
    } catch {
        return 'active';
    }

    const gameState = world.getEntityByName('gameState');
    const fog = gameState?.getComponent(FogOfWarComponent);
    if (!fog) return 'active';

    const ship = world.getEntityByName('arkSalvage');
    const shipTransform = ship?.getComponent(TransformComponent);
    if (!shipTransform) return 'hidden';

    return fog.getEntityZone(wx, wy, shipTransform.x, shipTransform.y);
}
