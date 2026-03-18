// drawMovementRangeDisc.ts — Shared movement range disc rendering.
// Used by both the ship and scout draw functions.

/**
 * Interpolate ring colour from green (full budget) to red (empty budget).
 * Returns an `rgba(r, g, b, <alpha>)` string at the given alpha.
 */
export function budgetColour(ratio: number, alpha: number): string {
    const r = Math.round(255 * (1 - ratio) + 80 * ratio);
    const g = Math.round(60 * (1 - ratio) + 220 * ratio);
    const b = Math.round(40 * (1 - ratio) + 80 * ratio);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

/** Minimum radius before the disc is hidden (avoids visual noise from tiny circles). */
const MIN_RANGE_RADIUS = 12;

/**
 * Draw a movement range disc with gradient fill, edge ring, and glow bloom.
 * Colour transitions green → amber → red as budget depletes.
 */
export function drawMovementRangeDisc(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    displayBudget: number,
    budgetMax: number,
): void {
    if (displayBudget <= MIN_RANGE_RADIUS) return;

    const r = displayBudget;
    const ratio = budgetMax > 0 ? displayBudget / budgetMax : 0;

    // Gradient fill (always centred on the entity)
    const rangeGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    rangeGrad.addColorStop(0, budgetColour(ratio, 0.18));
    rangeGrad.addColorStop(0.6, budgetColour(ratio, 0.10));
    rangeGrad.addColorStop(0.9, budgetColour(ratio, 0.05));
    rangeGrad.addColorStop(1, budgetColour(ratio, 0));
    ctx.fillStyle = rangeGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Solid edge ring
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = budgetColour(ratio, 0.45);
    ctx.lineWidth = 6;
    ctx.stroke();

    // Soft glow bloom on the edge (only when radius is large enough)
    if (r > 32) {
        const edgeGlow = ctx.createRadialGradient(x, y, r - 32, x, y, r + 32);
        edgeGlow.addColorStop(0, budgetColour(ratio, 0));
        edgeGlow.addColorStop(0.5, budgetColour(ratio, 0.10));
        edgeGlow.addColorStop(1, budgetColour(ratio, 0));
        ctx.fillStyle = edgeGlow;
        ctx.beginPath();
        ctx.arc(x, y, r + 32, 0, Math.PI * 2);
        ctx.fill();
    }
}
