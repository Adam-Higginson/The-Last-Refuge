// isometric.ts — Isometric projection utilities for the colony scene.

/** Tile dimensions for the isometric grid. */
export const TILE_WIDTH = 120;
export const TILE_HEIGHT = 60;

/** Convert grid coordinates to screen coordinates. */
export function gridToScreen(
    gridX: number,
    gridY: number,
    centreX: number,
    centreY: number,
): { x: number; y: number } {
    return {
        x: (gridX - gridY) * TILE_WIDTH / 2 + centreX,
        y: (gridX + gridY) * TILE_HEIGHT / 2 + centreY,
    };
}

/** Convert screen coordinates to grid coordinates (for hit testing). */
export function screenToGrid(
    screenX: number,
    screenY: number,
    centreX: number,
    centreY: number,
): { gridX: number; gridY: number } {
    const relX = screenX - centreX;
    const relY = screenY - centreY;
    return {
        gridX: Math.floor((relX / (TILE_WIDTH / 2) + relY / (TILE_HEIGHT / 2)) / 2),
        gridY: Math.floor((relY / (TILE_HEIGHT / 2) - relX / (TILE_WIDTH / 2)) / 2),
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

/** Grid layout for building slots (3 columns x 2 rows for up to 6 slots). */
export function getSlotGridPositions(totalSlots: number): { gridX: number; gridY: number }[] {
    const positions: { gridX: number; gridY: number }[] = [];
    const cols = Math.min(totalSlots, 3);
    const rows = Math.ceil(totalSlots / cols);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (positions.length >= totalSlots) break;
            positions.push({ gridX: c, gridY: r });
        }
    }
    return positions;
}
