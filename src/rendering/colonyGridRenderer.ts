// colonyGridRenderer.ts — Grid/path/colonist/debug rendering for colony view.
// Extracted from drawColonyScene.ts to keep it manageable.

import { gridToScreen, TILE_WIDTH, drawIsometricTile } from './isometric';
import { COLONY_GRID_SIZE } from '../colony/ColonyGrid';
import type { ColonyGrid } from '../colony/ColonyGrid';
import type { ColonistVisualState } from '../colony/ColonistState';
import type { ColonySlotRect } from './drawColonyScene';

// Grid cell spacing — how the 10x10 grid maps to screen via gridToScreen.
// We use the same gridToScreen function but with smaller integer coords.

/** Draw subtle isometric diamond outlines for the occupied area. */
export function drawGridTiles(
    ctx: CanvasRenderingContext2D,
    grid: ColonyGrid,
    centreX: number,
    centreY: number,
): void {
    ctx.save();
    ctx.globalAlpha = 0.06;

    for (let gy = 0; gy < COLONY_GRID_SIZE; gy++) {
        for (let gx = 0; gx < COLONY_GRID_SIZE; gx++) {
            const cell = grid.getCell(gx, gy);
            if (!cell) continue;

            // Only draw tiles that are not empty (building, path, door)
            if (cell.type === 'empty') continue;

            const screen = gridToScreen(gx, gy, centreX, centreY);
            drawIsometricTile(ctx, screen.x, screen.y, 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.3)');
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
                ctx.globalAlpha = 0.35;
                drawIsometricTile(ctx, screen.x, screen.y, 'rgba(120, 100, 70, 0.5)');
                // Subtle dirt texture line
                ctx.globalAlpha = 0.15;
                drawIsometricTile(ctx, screen.x, screen.y, 'rgba(90, 75, 50, 0.3)', 'rgba(140, 120, 80, 0.4)');
            }
        }
    }

    ctx.restore();
}

/** Draw colonist figures. Reads ColonistVisualState[], calls drawFigure() with positional params. */
export function drawColonistFigures(
    ctx: CanvasRenderingContext2D,
    colonists: ColonistVisualState[],
    centreX: number,
    centreY: number,
    t: number,
): void {
    for (const colonist of colonists) {
        const screen = gridToScreen(colonist.gridX, colonist.gridY, centreX, centreY);
        const isWalking = colonist.activity === 'walking' || colonist.activity === 'patrolling';
        drawFigure(ctx, screen.x, screen.y, colonist, t, isWalking);
    }
}

/** Colonist figure scale — larger for visibility on isometric grid. */
const FIGURE_SCALE = 1.8;

/** Draw a single colonist figure at screen coordinates. */
function drawFigure(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colonist: ColonistVisualState,
    t: number,
    isWalking: boolean,
): void {
    const s = FIGURE_SCALE;

    // Idle bob when stationary
    const bob = isWalking ? 0 : Math.sin(t / 600 + colonist.walkPhase) * 1 * s;

    // Walk animation — legs alternate
    const legSwing = isWalking ? Math.sin(colonist.walkPhase) * 2.5 * s : 0;

    ctx.save();

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * s, 3 * s, 1 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs — skin-toned
    ctx.strokeStyle = colonist.skinTone;
    ctx.lineWidth = 1.2 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 1 * s, y - 3 * s + bob);
    ctx.lineTo(x - 1 * s - legSwing * 0.5, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 1 * s, y - 3 * s + bob);
    ctx.lineTo(x + 1 * s + legSwing * 0.5, y);
    ctx.stroke();

    // Body — role-coloured clothing
    ctx.fillStyle = colonist.colour;
    ctx.beginPath();
    ctx.ellipse(x, y - 5 * s + bob, 2.5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Arms — skin-toned with swing
    const armSwing = isWalking ? Math.sin(colonist.walkPhase + Math.PI) * 2 * s : 0;
    ctx.strokeStyle = colonist.skinTone;
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(x - 2 * s, y - 6 * s + bob);
    ctx.lineTo(x - 3.5 * s - armSwing * 0.3, y - 3 * s + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 2 * s, y - 6 * s + bob);
    ctx.lineTo(x + 3.5 * s + armSwing * 0.3, y - 3 * s + bob);
    ctx.stroke();

    // Head — skin tone
    ctx.fillStyle = colonist.skinTone;
    ctx.beginPath();
    ctx.arc(x, y - 9.5 * s + bob, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = colonist.hairColour;
    ctx.beginPath();
    ctx.arc(x, y - 10 * s + bob, 2 * s, Math.PI * 0.85, Math.PI * 0.15, true);
    ctx.fill();

    // Name label
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(5 * s)}px "Share Tech Mono", "Courier New", monospace`;
    ctx.textAlign = 'center';
    const firstName = colonist.name.split(' ')[0];
    ctx.fillText(firstName, x, y - 14 * s + bob);
    ctx.globalAlpha = 1;

    // Leader star
    if (colonist.isLeader) {
        ctx.fillStyle = '#d4a020';
        ctx.font = `${Math.round(6 * s)}px "Share Tech Mono"`;
        ctx.textAlign = 'center';
        ctx.fillText('\u2605', x, y - 17 * s + bob);
    }

    ctx.restore();
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
