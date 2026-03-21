// colonyGridRenderer.ts — Grid/path/debug rendering and hit-testing for colony view.
// Colonist figure rendering has been extracted to colonyColonistRenderer.ts.

import { gridToScreen, TILE_WIDTH, drawIsometricTile } from './isometric';
import { COLONY_GRID_SIZE } from '../colony/ColonyGrid';
import type { ColonyGrid } from '../colony/ColonyGrid';
import type { ColonistVisualState } from '../colony/ColonistState';
import type { ColonySlotRect } from './drawColonyScene';
import type { HitTestItem } from './RenderQueue';

// Re-export colonist rendering from the extracted module
export { drawColonistFigures, drawFigure, drawFireflies } from './colonyColonistRenderer';

/** Draw subtle isometric diamond outlines for the occupied area. */
export function drawGridTiles(
    ctx: CanvasRenderingContext2D,
    grid: ColonyGrid,
    centreX: number,
    centreY: number,
): void {
    ctx.save();
    ctx.globalAlpha = 0.03;

    for (let gy = 0; gy < COLONY_GRID_SIZE; gy++) {
        for (let gx = 0; gx < COLONY_GRID_SIZE; gx++) {
            const cell = grid.getCell(gx, gy);
            if (!cell) continue;

            // Only draw tiles that are not empty (building, path, door)
            if (cell.type === 'empty') continue;

            const screen = gridToScreen(gx, gy, centreX, centreY);
            drawIsometricTile(ctx, screen.x, screen.y, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.12)');
        }
    }

    ctx.restore();
}

/** Draw dirt-coloured isometric tiles for path cells. */
export function drawPathTiles(
    ctx: CanvasRenderingContext2D,
    grid: ColonyGrid,
    centreX: number,
    centreY: number,
): void {
    ctx.save();

    for (let gy = 0; gy < COLONY_GRID_SIZE; gy++) {
        for (let gx = 0; gx < COLONY_GRID_SIZE; gx++) {
            const cell = grid.getCell(gx, gy);
            if (!cell) continue;

            if (cell.type === 'path' || cell.type === 'door') {
                const screen = gridToScreen(gx, gy, centreX, centreY);
                ctx.globalAlpha = 0.12;
                drawIsometricTile(ctx, screen.x, screen.y, 'rgba(90, 80, 60, 0.4)');
                // Subtle dirt texture line
                ctx.globalAlpha = 0.06;
                drawIsometricTile(ctx, screen.x, screen.y, 'rgba(70, 60, 45, 0.3)', 'rgba(110, 95, 65, 0.2)');
            }
        }
    }

    ctx.restore();
}

/** Colonist screen position — cached for input hit-testing. */
export interface ColonistScreenPos {
    entityId: number;
    screenX: number;
    screenY: number;
}

/** Draw warm glow at building base when a colonist is working inside. */
export function drawBuildingGlow(
    ctx: CanvasRenderingContext2D,
    colonists: ColonistVisualState[],
    slotRects: ColonySlotRect[],
): void {
    // Collect building slots with working colonists assigned
    const workingSlots = new Set<number>();
    for (const c of colonists) {
        if (c.activity === 'working' && c.assignedBuildingSlot !== null) {
            workingSlots.add(c.assignedBuildingSlot);
        }
    }

    if (workingSlots.size === 0) return;

    ctx.save();
    for (const rect of slotRects) {
        if (!rect.occupied || !workingSlots.has(rect.slotIndex)) continue;
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height * 0.6;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, TILE_WIDTH * 0.4);
        grad.addColorStop(0, 'rgba(255, 200, 100, 0.08)');
        grad.addColorStop(1, 'rgba(255, 200, 100, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, TILE_WIDTH * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/** Draw debug overlay — coloured cell outlines when G key is active. */
export function drawDebugOverlay(
    ctx: CanvasRenderingContext2D,
    grid: ColonyGrid,
    centreX: number,
    centreY: number,
): void {
    ctx.save();
    ctx.globalAlpha = 0.4;

    const CELL_COLOURS: Record<string, string> = {
        empty: 'rgba(100, 100, 100, 0.2)',
        building: 'rgba(255, 100, 100, 0.3)',
        path: 'rgba(200, 180, 100, 0.4)',
        door: 'rgba(100, 200, 255, 0.5)',
    };

    for (let gy = 0; gy < COLONY_GRID_SIZE; gy++) {
        for (let gx = 0; gx < COLONY_GRID_SIZE; gx++) {
            const cell = grid.getCell(gx, gy);
            if (!cell) continue;

            const screen = gridToScreen(gx, gy, centreX, centreY);
            const colour = CELL_COLOURS[cell.type] ?? CELL_COLOURS.empty;
            drawIsometricTile(ctx, screen.x, screen.y, colour, '#ffffff');
        }
    }

    ctx.restore();
}

/** Hit-test result from resolveHitTarget. */
export interface HitResult {
    kind: 'building' | 'colonist' | 'empty-slot';
    entityId?: number;
    slotIndex?: number;
}

/**
 * Depth-aware hit-testing with nearest-centre tiebreak for overlapping slots.
 *
 * Iterate highest-depth-first so frontmost entities win (building occludes colonist
 * behind it). When multiple items at the SAME depth have overlapping hitRects,
 * the one whose centre is closest to the click wins. This prevents isometric
 * hitRect overlap from stealing clicks intended for adjacent empty slots.
 */
export function resolveHitTarget(
    items: readonly HitTestItem[],
    clickX: number,
    clickY: number,
): HitResult | null {
    // Collect all hits with their distance-to-centre
    const hits: Array<{ item: HitTestItem; distSq: number }> = [];

    for (const item of items) {
        if (item.kind === 'prop') continue;

        if (item.hitRadius) {
            const dx = clickX - item.screenX;
            const dy = clickY - item.screenY;
            if (dx * dx + dy * dy <= item.hitRadius * item.hitRadius) {
                hits.push({ item, distSq: dx * dx + dy * dy });
            }
        } else if (item.hitRect) {
            const r = item.hitRect;
            if (clickX >= r.x && clickX <= r.x + r.width &&
                clickY >= r.y && clickY <= r.y + r.height) {
                const cx = r.x + r.width / 2;
                const cy = r.y + r.height / 2;
                const distSq = (clickX - cx) * (clickX - cx) + (clickY - cy) * (clickY - cy);
                hits.push({ item, distSq });
            }
        }
    }

    if (hits.length === 0) return null;

    // Sort: empty-slot vs empty-slot → nearest centre wins (prevent isometric
    // hitRect overlap from stealing clicks between adjacent slots).
    // Everything else → highest depth wins (occlusion: frontmost entity wins).
    hits.sort((a, b) => {
        const bothEmptySlots = a.item.kind === 'empty-slot' && b.item.kind === 'empty-slot';
        if (bothEmptySlots) return a.distSq - b.distSq;
        return b.item.depth - a.item.depth;
    });

    const winner = hits[0].item;
    return { kind: winner.kind as HitResult['kind'], entityId: winner.entityId, slotIndex: winner.slotIndex };
}
