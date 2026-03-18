// FogOfWarComponent.ts — Fog of war grid tracking visibility state.
// Lives on the gameState entity. Tracks which cells have been revealed
// by any VisibilitySourceComponent in the world (ship, colonies, etc.).
//
// Visibility flow:
//
//   VisibilitySourceComponent    TransformComponent
//   (detailRadius, blipRadius,   (x, y)
//    effectiveRadii, active)          |
//          |                          |
//          v                          v
//   +----------------------------------------------+
//   | FogOfWarComponent.update()                    |
//   |  1. Animate: interpolate effective            |
//   |     radii toward configured values            |
//   |  2. Demote: active cells -> revealed          |
//   |  3. Promote: for each active source,          |
//   |     revealCellsInRadius(pos, radius)          |
//   +----------------------------------------------+
//          |
//          v
//   getEntityFogZone(wx, wy)
//   -> checks distance to ALL active sources
//   -> returns best zone (active > blip > hidden)

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { GameModeComponent } from './GameModeComponent';
import { TransformComponent } from './TransformComponent';
import { VisibilitySourceComponent } from './VisibilitySourceComponent';
import { CrewMemberComponent } from './CrewMemberComponent';
import { ScoutDataComponent } from './ScoutDataComponent';
import {
    FOG_GRID_SIZE,
    FOG_CELL_SIZE,
    FOG_REVEAL_DURATION,
} from '../data/constants';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';

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

    /** Flat visibility grid: gridSize * gridSize entries. */
    readonly grid: Uint8Array;

    /** Set of cell indices currently marked Active (for efficient demotion). */
    private activeCells = new Set<number>();

    /** Set of cell indices marked Revealed (for efficient rendering). */
    readonly revealedCells = new Set<number>();

    /** Last known positions of entities (for stale rendering when revealed). */
    private readonly lastKnownPositions = new Map<number, { x: number; y: number }>();

    /** Position cache per visibility source entity (for skip-if-unchanged optimisation). */
    private sourcePositionCache = new Map<number, { x: number; y: number }>();

    private eventQueue: EventQueue | null = null;
    private crewTransferredHandler: EventHandler | null = null;

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

    /**
     * Returns which zone a point falls in relative to all active visibility sources.
     * Returns the best (most visible) zone across all sources.
     */
    getEntityZone(wx: number, wy: number): EntityZone {
        const world = ServiceLocator.get<World>('world');
        const sources = world.getEntitiesWithComponent(VisibilitySourceComponent);

        let bestZone: EntityZone = 'hidden';

        for (const sourceEntity of sources) {
            const vis = sourceEntity.getComponent(VisibilitySourceComponent);
            const transform = sourceEntity.getComponent(TransformComponent);
            if (!vis?.active || !transform) continue;

            const dx = wx - transform.x;
            const dy = wy - transform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= vis.effectiveDetailRadius) return 'active'; // best possible — short circuit
            if (dist <= vis.effectiveBlipRadius && bestZone === 'hidden') {
                bestZone = 'blip';
            }
        }

        return bestZone;
    }

    /** Whether an entity at (wx,wy) can be clicked/hovered. */
    isInteractable(wx: number, wy: number): boolean {
        return this.getEntityZone(wx, wy) === 'active';
    }

    /** Record an entity's position as its last known location (for stale rendering). */
    recordPosition(entityId: number, x: number, y: number): void {
        const existing = this.lastKnownPositions.get(entityId);
        if (existing) {
            existing.x = x;
            existing.y = y;
        } else {
            this.lastKnownPositions.set(entityId, { x, y });
        }
    }

    /** Get the last known position of an entity (stale position for revealed planets). */
    getLastKnownPosition(entityId: number): { x: number; y: number } | undefined {
        return this.lastKnownPositions.get(entityId);
    }

    /** Reveal cells within radius around a centre point, marking them Active. */
    private revealCellsInRadius(cx: number, cy: number, radius: number): void {
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
                    this.revealedCells.delete(idx);
                }
            }
        }
    }

    /** Pre-reveal cells around a position (called on init or externally). */
    revealAround(cx: number, cy: number, radius: number): void {
        this.revealCellsInRadius(cx, cy, radius);
    }

    init(): void {
        // Pre-reveal around all visibility sources
        const world = ServiceLocator.get<World>('world');
        const sources = world.getEntitiesWithComponent(VisibilitySourceComponent);
        for (const sourceEntity of sources) {
            const vis = sourceEntity.getComponent(VisibilitySourceComponent);
            const transform = sourceEntity.getComponent(TransformComponent);
            if (!vis?.active || !transform) continue;
            this.revealCellsInRadius(transform.x, transform.y, vis.effectiveBlipRadius);
        }

        // Listen for crew transfers to activate/deactivate colony sources
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        this.crewTransferredHandler = (): void => {
            this.updateColonySources();
        };
        this.eventQueue.on(GameEvents.CREW_TRANSFERRED, this.crewTransferredHandler);
    }

    /** Check all non-ship visibility sources and activate/deactivate based on crew presence. */
    private updateColonySources(): void {
        const world = ServiceLocator.get<World>('world');
        const ship = world.getEntityByName('arkSalvage');
        const sources = world.getEntitiesWithComponent(VisibilitySourceComponent);
        const crewEntities = world.getEntitiesWithComponent(CrewMemberComponent);

        for (const sourceEntity of sources) {
            if (sourceEntity === ship) continue; // ship is always active
            if (sourceEntity.hasComponent(ScoutDataComponent)) continue; // scouts manage their own visibility

            const vis = sourceEntity.getComponent(VisibilitySourceComponent);
            if (!vis) continue;

            const hasCrew = crewEntities.some(e => {
                const c = e.getComponent(CrewMemberComponent);
                return c?.location.type === 'colony' && c.location.planetEntityId === sourceEntity.id;
            });

            if (!hasCrew && vis.active) {
                vis.active = false;
            } else if (hasCrew && !vis.active) {
                vis.active = true;
                // Restart reveal animation
                vis.effectiveDetailRadius = 0;
                vis.effectiveBlipRadius = 0;
            }
        }
    }

    update(dt: number): void {
        // Skip fog updates during planet view
        const gameMode = this.entity.getComponent(GameModeComponent);
        if (gameMode && gameMode.mode !== 'system') return;

        const world = ServiceLocator.get<World>('world');
        const sources = world.getEntitiesWithComponent(VisibilitySourceComponent);

        // Animate effective radii for all sources
        for (const sourceEntity of sources) {
            const vis = sourceEntity.getComponent(VisibilitySourceComponent);
            if (!vis?.active) continue;

            if (vis.effectiveDetailRadius < vis.detailRadius) {
                vis.effectiveDetailRadius = Math.min(
                    vis.detailRadius,
                    vis.effectiveDetailRadius + (vis.detailRadius / FOG_REVEAL_DURATION) * dt,
                );
            }
            if (vis.effectiveBlipRadius < vis.blipRadius) {
                vis.effectiveBlipRadius = Math.min(
                    vis.blipRadius,
                    vis.effectiveBlipRadius + (vis.blipRadius / FOG_REVEAL_DURATION) * dt,
                );
            }
        }

        // Check if any source has moved (within half a cell)
        const halfCell = this.cellSize / 2;
        const halfCellSq = halfCell * halfCell;
        let anyMoved = false;
        const currentSourceIds = new Set<number>();

        for (const sourceEntity of sources) {
            const vis = sourceEntity.getComponent(VisibilitySourceComponent);
            const transform = sourceEntity.getComponent(TransformComponent);
            if (!vis?.active || !transform) continue;

            const id = sourceEntity.id;
            currentSourceIds.add(id);
            const cached = this.sourcePositionCache.get(id);

            if (!cached) {
                this.sourcePositionCache.set(id, { x: transform.x, y: transform.y });
                anyMoved = true;
            } else {
                const dx = transform.x - cached.x;
                const dy = transform.y - cached.y;
                if (dx * dx + dy * dy >= halfCellSq) {
                    cached.x = transform.x;
                    cached.y = transform.y;
                    anyMoved = true;
                }
            }
        }

        // Clean up cache entries for removed sources
        for (const cachedId of this.sourcePositionCache.keys()) {
            if (!currentSourceIds.has(cachedId)) {
                this.sourcePositionCache.delete(cachedId);
                anyMoved = true;
            }
        }

        if (!anyMoved) return;

        // Pass 1: Demote all currently active cells to revealed
        for (const idx of this.activeCells) {
            this.grid[idx] = TileVisibility.Revealed;
            this.revealedCells.add(idx);
        }
        this.activeCells.clear();

        // Pass 2: Promote cells within each source's effective blip radius
        for (const sourceEntity of sources) {
            const vis = sourceEntity.getComponent(VisibilitySourceComponent);
            const transform = sourceEntity.getComponent(TransformComponent);
            if (!vis?.active || !transform) continue;

            this.revealCellsInRadius(transform.x, transform.y, vis.effectiveBlipRadius);
        }
    }

    destroy(): void {
        if (this.eventQueue && this.crewTransferredHandler) {
            this.eventQueue.off(GameEvents.CREW_TRANSFERRED, this.crewTransferredHandler);
        }
    }
}

/**
 * Standalone fog zone lookup — resolves visibility sources + fog from ServiceLocator.
 * Returns 'active' if no fog or world service exists (graceful degradation).
 */
export function getEntityFogZone(wx: number, wy: number): EntityZone {
    // Debug cheat: treat everything as active (fully visible)
    try {
        if (localStorage.getItem('debug-no-fog') === 'true') return 'active';
    } catch { /* ignore */ }

    let world: World;
    try {
        world = ServiceLocator.get<World>('world');
    } catch {
        return 'active';
    }

    const gameState = world.getEntityByName('gameState');
    const fog = gameState?.getComponent(FogOfWarComponent);
    if (!fog) return 'active';

    return fog.getEntityZone(wx, wy);
}
