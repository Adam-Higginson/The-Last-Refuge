// isometric.ts — Isometric projection utilities for the colony scene.

/** Visual tile dimensions (building sprite size). */
export const TILE_WIDTH = 120;
export const TILE_HEIGHT = 60;

/** Grid spacing — how far apart slots are placed. */
export const GRID_SPACING = 160;

/** Camera zoom scale applied to the entire ground scene. */
export const COLONY_ZOOM = 3.0;

/** Convert grid coordinates to screen coordinates (uses GRID_SPACING for position). */
export function gridToScreen(
    gridX: number,
    gridY: number,
    centreX: number,
    centreY: number,
): { x: number; y: number } {
    const spacingH = GRID_SPACING / 2;
    const spacingV = GRID_SPACING / 4;
    return {
        x: (gridX - gridY) * spacingH + centreX,
        y: (gridX + gridY) * spacingV + centreY,
    };
}

/** Convert screen coordinates to grid coordinates (for hit testing). */
export function screenToGrid(
    screenX: number,
    screenY: number,
    centreX: number,
    centreY: number,
): { gridX: number; gridY: number } {
    const spacingH = GRID_SPACING / 2;
    const spacingV = GRID_SPACING / 4;
    const relX = screenX - centreX;
    const relY = screenY - centreY;
    return {
        gridX: Math.floor((relX / spacingH + relY / spacingV) / 2),
        gridY: Math.floor((relY / spacingV - relX / spacingH) / 2),
    };
}

/** Draw a diamond-shaped ground tile at the given screen position. */
export function drawIsometricTile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    fillStyle: string,
    strokeStyle?: string,
): void {
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    ctx.beginPath();
    ctx.moveTo(x, y - hh);       // top
    ctx.lineTo(x + hw, y);       // right
    ctx.lineTo(x, y + hh);       // bottom
    ctx.lineTo(x - hw, y);       // left
    ctx.closePath();

    ctx.fillStyle = fillStyle;
    ctx.fill();

    if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }
}

/** Draw an isometric box (building base shape) with top, left, and right faces. */
export function drawIsometricBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    height: number,
    topColour: string,
    leftColour: string,
    rightColour: string,
): void {
    const hw = TILE_WIDTH / 2;
    const hh = TILE_HEIGHT / 2;

    // Top face
    ctx.beginPath();
    ctx.moveTo(x, y - hh - height);
    ctx.lineTo(x + hw, y - height);
    ctx.lineTo(x, y + hh - height);
    ctx.lineTo(x - hw, y - height);
    ctx.closePath();
    ctx.fillStyle = topColour;
    ctx.fill();

    // Left face
    ctx.beginPath();
    ctx.moveTo(x - hw, y - height);
    ctx.lineTo(x, y + hh - height);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x - hw, y);
    ctx.closePath();
    ctx.fillStyle = leftColour;
    ctx.fill();

    // Right face
    ctx.beginPath();
    ctx.moveTo(x + hw, y - height);
    ctx.lineTo(x, y + hh - height);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x + hw, y);
    ctx.closePath();
    ctx.fillStyle = rightColour;
    ctx.fill();
}

/**
 * Organic building slot positions — spread out with minimum spacing,
 * weighted toward edges, with random offsets for natural feel.
 * Uses a deterministic seed so positions are stable across frames.
 */
export function getSlotGridPositions(totalSlots: number): { gridX: number; gridY: number }[] {
    if (totalSlots === 0) return [];

    // Pre-computed organic positions for up to 6 slots
    // Spread across a wider area with natural spacing
    // Organic layout — COLONY_ZOOM scales everything uniformly
    const LAYOUTS: Record<number, { gridX: number; gridY: number }[]> = {
        1: [{ gridX: 0, gridY: 0 }],
        2: [{ gridX: -0.8, gridY: 0 }, { gridX: 0.8, gridY: 0 }],
        3: [{ gridX: -0.8, gridY: -0.2 }, { gridX: 0.8, gridY: 0 }, { gridX: 0, gridY: 0.8 }],
        4: [
            { gridX: -0.9, gridY: -0.2 }, { gridX: 0.7, gridY: -0.4 },
            { gridX: -0.4, gridY: 0.6 }, { gridX: 1.0, gridY: 0.5 },
        ],
        5: [
            { gridX: -1.0, gridY: -0.4 }, { gridX: 0.6, gridY: -0.6 },
            { gridX: -0.2, gridY: 0.2 },
            { gridX: -0.8, gridY: 0.8 }, { gridX: 0.9, gridY: 0.6 },
        ],
        6: [
            { gridX: -1.1, gridY: -0.4 }, { gridX: 0.4, gridY: -0.7 },
            { gridX: -0.3, gridY: 0.15 }, { gridX: 1.1, gridY: 0 },
            { gridX: -0.8, gridY: 0.85 }, { gridX: 0.8, gridY: 0.8 },
        ],
    };

    const layout = LAYOUTS[Math.min(totalSlots, 6)] ?? LAYOUTS[6];

    // Add small deterministic offsets for organic feel
    return layout.slice(0, totalSlots).map((pos, i) => ({
        gridX: pos.gridX + Math.sin(i * 3.7) * 0.15,
        gridY: pos.gridY + Math.sin(i * 2.3 + 1) * 0.1,
    }));
}
