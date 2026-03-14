// colonyBuildingSprites.ts — Individual building draw functions for colony scene.
// Each function draws a specific building type at the given position and size.

import type { BuildingId } from '../data/buildings';

type BuildingState = 'constructing' | 'active' | 'idle' | 'disabled';

/** Draw a building by type ID. */
export function drawBuilding(
    ctx: CanvasRenderingContext2D,
    buildingId: BuildingId,
    x: number,
    y: number,
    w: number,
    h: number,
    state: BuildingState,
    t: number,
): void {
    if (state === 'constructing') {
        drawConstructionScaffolding(ctx, x, y, w, h);
        return;
    }

    const drawFn = BUILDING_DRAW_FUNCTIONS[buildingId];
    if (drawFn) {
        ctx.save();
        if (state === 'idle' || state === 'disabled') ctx.globalAlpha = 0.4;
        drawFn(ctx, x, y, w, h, t);
        ctx.restore();
    }
}

function drawConstructionScaffolding(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#c0c8d8';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Cross scaffolding
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    ctx.moveTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

// --- Individual building draw functions ---

function drawShelter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _t: number): void {
    // Dome/hab-module
    ctx.fillStyle = '#8a8a9a';
    ctx.fillRect(x + w * 0.1, y + h * 0.4, w * 0.8, h * 0.6);

    // Dome top
    ctx.fillStyle = '#9a9aaa';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.4, w * 0.4, h * 0.35, 0, Math.PI, 0);
    ctx.fill();

    // Door
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(x + w * 0.4, y + h * 0.65, w * 0.2, h * 0.35);

    // Window glow
    ctx.fillStyle = 'rgba(150, 200, 255, 0.4)';
    ctx.fillRect(x + w * 0.2, y + h * 0.5, w * 0.15, h * 0.12);
    ctx.fillRect(x + w * 0.65, y + h * 0.5, w * 0.15, h * 0.12);
}

function drawFarm(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number): void {
    // Field base
    ctx.fillStyle = '#5a7a3a';
    ctx.fillRect(x, y + h * 0.2, w, h * 0.8);

    // Crop rows with subtle sway
    const sway = Math.sin(t / 1500) * 2;
    ctx.fillStyle = '#6a9a4a';
    for (let i = 0; i < 5; i++) {
        const rowY = y + h * 0.3 + i * h * 0.14;
        ctx.fillRect(x + 4 + sway, rowY, w - 8, h * 0.06);
    }

    // Fence posts
    ctx.fillStyle = '#6a5a4a';
    ctx.fillRect(x, y + h * 0.15, 3, h * 0.85);
    ctx.fillRect(x + w - 3, y + h * 0.15, 3, h * 0.85);
}

function drawSolarArray(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number): void {
    // Support poles
    ctx.fillStyle = '#6a6a7a';
    ctx.fillRect(x + w * 0.25, y + h * 0.5, 3, h * 0.5);
    ctx.fillRect(x + w * 0.75 - 3, y + h * 0.5, 3, h * 0.5);

    // Panels (tilted)
    ctx.fillStyle = '#2a3a6a';
    ctx.save();
    ctx.translate(x + w / 2, y + h * 0.35);
    ctx.beginPath();
    ctx.moveTo(-w * 0.4, 0);
    ctx.lineTo(-w * 0.35, -h * 0.3);
    ctx.lineTo(w * 0.35, -h * 0.3);
    ctx.lineTo(w * 0.4, 0);
    ctx.closePath();
    ctx.fill();

    // Panel glint
    const glint = Math.sin(t / 2000);
    if (glint > 0.8) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(glint - 0.8) * 5})`;
        ctx.fillRect(-w * 0.1, -h * 0.2, w * 0.2, h * 0.1);
    }
    ctx.restore();
}

function drawStorageDepot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _t: number): void {
    // Main body
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(x + w * 0.05, y + h * 0.3, w * 0.9, h * 0.7);

    // Roof
    ctx.fillStyle = '#4a4a5a';
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.3);
    ctx.lineTo(x + w / 2, y + h * 0.1);
    ctx.lineTo(x + w, y + h * 0.3);
    ctx.closePath();
    ctx.fill();

    // Horizontal seams
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
        const seam = y + h * 0.3 + i * h * 0.2;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.05, seam);
        ctx.lineTo(x + w * 0.95, seam);
        ctx.stroke();
    }

    // Door
    ctx.fillStyle = '#3a3a4a';
    ctx.fillRect(x + w * 0.35, y + h * 0.6, w * 0.3, h * 0.4);
}

function drawWorkshop(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number): void {
    // Main body
    ctx.fillStyle = '#6a5a4a';
    ctx.fillRect(x + w * 0.05, y + h * 0.35, w * 0.8, h * 0.65);

    // Roof
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(x, y + h * 0.25, w * 0.85, h * 0.12);

    // Chimney
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(x + w * 0.7, y + h * 0.05, w * 0.12, h * 0.3);

    // Smoke particles
    ctx.fillStyle = 'rgba(150, 150, 150, 0.3)';
    for (let i = 0; i < 3; i++) {
        const smokeY = y - h * 0.1 - i * h * 0.12 + Math.sin(t / 800 + i) * 4;
        const smokeX = x + w * 0.76 + Math.sin(t / 1200 + i * 2) * 6;
        const r = 3 + i * 2;
        ctx.beginPath();
        ctx.arc(smokeX, smokeY, r, 0, Math.PI * 2);
        ctx.fill();
    }

    // Window glow
    ctx.fillStyle = 'rgba(255, 160, 40, 0.5)';
    ctx.fillRect(x + w * 0.15, y + h * 0.5, w * 0.2, h * 0.15);
}

function drawMedBay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _t: number): void {
    // Main body
    ctx.fillStyle = '#d0d0d8';
    ctx.fillRect(x + w * 0.1, y + h * 0.3, w * 0.8, h * 0.7);

    // Flat roof
    ctx.fillStyle = '#e0e0e8';
    ctx.fillRect(x + w * 0.05, y + h * 0.25, w * 0.9, h * 0.08);

    // Red cross
    ctx.fillStyle = '#cc3333';
    const cx = x + w / 2;
    const cy = y + h * 0.55;
    ctx.fillRect(cx - w * 0.05, cy - h * 0.12, w * 0.1, h * 0.24);
    ctx.fillRect(cx - w * 0.15, cy - h * 0.04, w * 0.3, h * 0.08);
}

function drawBarracks(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _t: number): void {
    // Main body (fortified)
    ctx.fillStyle = '#5a6a5a';
    ctx.fillRect(x + w * 0.05, y + h * 0.3, w * 0.9, h * 0.7);

    // Crenellation
    ctx.fillStyle = '#4a5a4a';
    for (let i = 0; i < 4; i++) {
        const cx = x + w * 0.1 + i * w * 0.25;
        ctx.fillRect(cx, y + h * 0.2, w * 0.12, h * 0.12);
    }

    // Dark slit windows
    ctx.fillStyle = '#2a3a2a';
    ctx.fillRect(x + w * 0.25, y + h * 0.5, w * 0.06, h * 0.2);
    ctx.fillRect(x + w * 0.5, y + h * 0.5, w * 0.06, h * 0.2);
    ctx.fillRect(x + w * 0.7, y + h * 0.5, w * 0.06, h * 0.2);
}

function drawHydroponicsBay(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _t: number): void {
    // Greenhouse dome
    ctx.fillStyle = 'rgba(100, 200, 130, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.5, w * 0.45, h * 0.45, 0, Math.PI, 0);
    ctx.fill();

    // Base
    ctx.fillStyle = '#6a7a6a';
    ctx.fillRect(x + w * 0.05, y + h * 0.5, w * 0.9, h * 0.5);

    // Dome outline
    ctx.strokeStyle = 'rgba(150, 220, 170, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.5, w * 0.45, h * 0.45, 0, Math.PI, 0);
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = 'rgba(150, 220, 170, 0.2)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
        const gx = x + w * 0.1 + i * w * 0.2;
        ctx.beginPath();
        ctx.moveTo(gx, y + h * 0.15);
        ctx.lineTo(gx, y + h * 0.5);
        ctx.stroke();
    }

    // Green glow inside
    ctx.fillStyle = 'rgba(100, 220, 130, 0.15)';
    ctx.fillRect(x + w * 0.15, y + h * 0.55, w * 0.7, h * 0.35);
}

const BUILDING_DRAW_FUNCTIONS: Record<BuildingId, (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number) => void> = {
    shelter: drawShelter,
    farm: drawFarm,
    solar_array: drawSolarArray,
    storage_depot: drawStorageDepot,
    workshop: drawWorkshop,
    med_bay: drawMedBay,
    barracks: drawBarracks,
    hydroponics_bay: drawHydroponicsBay,
};
