// colonyBuildingSprites.ts — Isometric building draw functions for colony scene.
// Buildings react to time of day: lights at dusk/night, inactive visuals at night.

import { TILE_WIDTH, TILE_HEIGHT, drawIsometricBox } from './isometric';
import { getDayNightState } from './colonyDayNight';
import type { DayNightState } from './colonyDayNight';
import type { BuildingId } from '../data/buildings';

type BuildingState = 'constructing' | 'active' | 'idle' | 'disabled';

const HW = TILE_WIDTH / 2;
const HH = TILE_HEIGHT / 2;

/** Draw a building by type ID at the given isometric screen position. */
export function drawBuilding(
    ctx: CanvasRenderingContext2D,
    buildingId: BuildingId,
    x: number,
    y: number,
    state: BuildingState,
    t: number,
    gameHour?: number,
    emergencyIntensity?: number,
): void {
    if (state === 'constructing') {
        drawConstructionScaffolding(ctx, x, y, t);
        return;
    }

    const dayNight = getDayNightState(gameHour ?? 10);

    ctx.save();
    if (state === 'idle' || state === 'disabled') ctx.globalAlpha = 0.4;
    const drawFn = BUILDING_DRAW_FUNCTIONS[buildingId];
    if (drawFn) drawFn(ctx, x, y, t, dayNight);
    drawMakeshiftOverlay(ctx, buildingId, x, y);
    ctx.restore();

    // Draw building lights at dusk/night
    if (dayNight.ambientLight < 0.5 && state === 'active') {
        drawBuildingLights(ctx, buildingId, x, y, t, dayNight, emergencyIntensity ?? 0);
    }
}

function drawConstructionScaffolding(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    const pulse = 0.3 + 0.1 * Math.sin(t / 500);

    ctx.save();
    ctx.globalAlpha = pulse;

    // Wireframe box
    const h = 30;
    ctx.strokeStyle = '#c0c8d8';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // Top face outline
    ctx.beginPath();
    ctx.moveTo(x, y - HH - h);
    ctx.lineTo(x + HW * 0.7, y - h);
    ctx.lineTo(x, y + HH * 0.7 - h);
    ctx.lineTo(x - HW * 0.7, y - h);
    ctx.closePath();
    ctx.stroke();

    // Vertical edges
    ctx.beginPath();
    ctx.moveTo(x - HW * 0.7, y - h);
    ctx.lineTo(x - HW * 0.7, y);
    ctx.moveTo(x + HW * 0.7, y - h);
    ctx.lineTo(x + HW * 0.7, y);
    ctx.moveTo(x, y + HH * 0.7 - h);
    ctx.lineTo(x, y + HH * 0.7);
    ctx.stroke();

    ctx.setLineDash([]);

    // Scaffolding cross
    ctx.strokeStyle = '#a08040';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - HW * 0.5, y);
    ctx.lineTo(x + HW * 0.5, y - h);
    ctx.moveTo(x + HW * 0.5, y);
    ctx.lineTo(x - HW * 0.5, y - h);
    ctx.stroke();

    ctx.restore();
}

// --- Shelter: dome hab-module ---
function drawShelter(ctx: CanvasRenderingContext2D, x: number, y: number, _t: number, _dn: DayNightState): void {
    // Base
    drawIsometricBox(ctx, x, y, 20, '#a0a0b0', '#6a6a7a', '#505060');

    // Dome
    ctx.fillStyle = '#9a9aaa';
    ctx.beginPath();
    ctx.ellipse(x, y - 28, HW * 0.5, 18, 0, Math.PI, 0);
    ctx.fill();

    // Door
    ctx.fillStyle = '#4a4a5a';
    ctx.fillRect(x - 5, y - 12, 10, 12);
}

// --- Farm: crop fields ---
function drawFarm(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, _dn: DayNightState): void {
    // Tilled soil base (flat isometric tile)
    drawIsometricBox(ctx, x, y, 4, '#70944a', '#4a6a2a', '#3a5420');

    // Crop rows with sway
    const sway = Math.sin(t / 1500) * 2;
    ctx.fillStyle = '#7aaa4a';
    for (let i = -2; i <= 2; i++) {
        const cx = x + i * 10 + sway;
        const cy = y - 8 + Math.abs(i) * 2;
        ctx.fillRect(cx - 2, cy - 12, 4, 10);
    }

    // Fence posts
    ctx.fillStyle = '#6a5a4a';
    ctx.fillRect(x - HW * 0.5, y - 2, 3, 8);
    ctx.fillRect(x + HW * 0.5 - 3, y - 2, 3, 8);
}

// --- Solar Array: tilted panels ---
function drawSolarArray(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, _dn: DayNightState): void {
    // Support poles
    ctx.fillStyle = '#6a6a7a';
    ctx.fillRect(x - 15, y - 8, 2, 16);
    ctx.fillRect(x + 13, y - 8, 2, 16);

    // Panels (tilted isometric)
    ctx.fillStyle = '#2a4a8a';
    ctx.beginPath();
    ctx.moveTo(x - HW * 0.6, y - 30);
    ctx.lineTo(x + HW * 0.6, y - 20);
    ctx.lineTo(x + HW * 0.6, y - 12);
    ctx.lineTo(x - HW * 0.6, y - 22);
    ctx.closePath();
    ctx.fill();

    // Panel grid lines
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.3)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
        const px = x - HW * 0.6 + i * HW * 0.3;
        ctx.beginPath();
        ctx.moveTo(px, y - 30 + i * 2.5);
        ctx.lineTo(px, y - 22 + i * 2.5);
        ctx.stroke();
    }

    // Glint
    const glint = Math.sin(t / 2000);
    if (glint > 0.7) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(glint - 0.7) * 3})`;
        ctx.beginPath();
        ctx.arc(x + 5, y - 22, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- Storage Depot: blocky warehouse ---
function drawStorageDepot(ctx: CanvasRenderingContext2D, x: number, y: number, _t: number, _dn: DayNightState): void {
    drawIsometricBox(ctx, x, y, 28, '#707080', '#4a4a5a', '#38384a');

    // Horizontal seam lines on left face
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
        const sy = y - 28 + i * 10;
        ctx.beginPath();
        ctx.moveTo(x - HW, sy + HH * (i / 3));
        ctx.lineTo(x, sy + HH + HH * (i / 3));
        ctx.stroke();
    }

    // Loading door on right face
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath();
    ctx.moveTo(x + 5, y + HH * 0.3);
    ctx.lineTo(x + HW * 0.6, y - 5);
    ctx.lineTo(x + HW * 0.6, y + 8);
    ctx.lineTo(x + 5, y + HH * 0.3 + 13);
    ctx.closePath();
    ctx.fill();
}

// --- Workshop: industrial with chimney and smoke ---
function drawWorkshop(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dn: DayNightState): void {
    drawIsometricBox(ctx, x, y, 24, '#806a5a', '#5a4a3a', '#44362a');

    // Chimney
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(x + HW * 0.2, y - 44, 8, 20);

    // Smoke particles (only during day — workshop inactive at night)
    if (dn.phase !== 'night') {
        for (let i = 0; i < 4; i++) {
            const smokeY = y - 50 - i * 10 + Math.sin(t / 600 + i) * 3;
            const smokeX = x + HW * 0.2 + 4 + Math.sin(t / 900 + i * 2) * 5;
            const r = 2 + i * 1.5;
            const alpha = 0.25 - i * 0.05;
            ctx.fillStyle = `rgba(150, 150, 150, ${alpha})`;
            ctx.beginPath();
            ctx.arc(smokeX, smokeY, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Orange window glow (intensifies at night)
    const glowAlpha = dn.phase === 'night' ? 0.9 : dn.phase === 'dusk' ? 0.7 : 0.4;
    ctx.fillStyle = `rgba(255, 160, 40, ${glowAlpha})`;
    ctx.beginPath();
    ctx.moveTo(x - HW * 0.3, y - 8);
    ctx.lineTo(x - HW * 0.1, y - 14);
    ctx.lineTo(x - HW * 0.1, y - 6);
    ctx.lineTo(x - HW * 0.3, y);
    ctx.closePath();
    ctx.fill();
}

// --- Med Bay: white with red cross ---
function drawMedBay(ctx: CanvasRenderingContext2D, x: number, y: number, _t: number, _dn: DayNightState): void {
    drawIsometricBox(ctx, x, y, 22, '#e8e8f0', '#b8b8c0', '#9898a8');

    // Red cross on top face
    ctx.fillStyle = '#cc3333';
    ctx.fillRect(x - 3, y - HH - 22 - 2, 6, 14);
    ctx.fillRect(x - 8, y - HH - 22 + 3, 16, 4);
}

// --- Barracks: fortified ---
function drawBarracks(ctx: CanvasRenderingContext2D, x: number, y: number, _t: number, _dn: DayNightState): void {
    drawIsometricBox(ctx, x, y, 20, '#6a7e6a', '#4a5a4a', '#384838');

    // Crenellations on top
    const crenH = 6;
    ctx.fillStyle = '#4a5a4a';
    for (let i = -1; i <= 1; i++) {
        ctx.fillRect(x + i * 16 - 4, y - HH - 20 - crenH, 8, crenH);
    }

    // Slit windows on left face
    ctx.fillStyle = '#2a3a2a';
    ctx.fillRect(x - HW * 0.4, y - 10, 3, 8);
    ctx.fillRect(x - HW * 0.2, y - 12, 3, 8);
}

// --- Hydroponics Bay: greenhouse dome ---
function drawHydroponicsBay(ctx: CanvasRenderingContext2D, x: number, y: number, _t: number, _dn: DayNightState): void {
    // Base
    drawIsometricBox(ctx, x, y, 8, '#7a8e7a', '#5a6a5a', '#485848');

    // Glass dome
    ctx.fillStyle = 'rgba(100, 220, 130, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y - 16, HW * 0.55, 24, 0, Math.PI, 0);
    ctx.fill();

    // Dome outline
    ctx.strokeStyle = 'rgba(150, 220, 170, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y - 16, HW * 0.55, 24, 0, Math.PI, 0);
    ctx.stroke();

    // Internal grid
    ctx.strokeStyle = 'rgba(150, 220, 170, 0.15)';
    ctx.lineWidth = 0.5;
    for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * 12, y - 38);
        ctx.lineTo(x + i * 12, y - 16);
        ctx.stroke();
    }

    // Green glow
    const glow = ctx.createRadialGradient(x, y - 20, 0, x, y - 20, HW * 0.4);
    glow.addColorStop(0, 'rgba(100, 220, 130, 0.15)');
    glow.addColorStop(1, 'rgba(100, 220, 130, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - 20, HW * 0.4, 0, Math.PI * 2);
    ctx.fill();
}

// --- Makeshift survival-camp overlays (salvaged hull plating, tarps, patchwork) ---

function drawMakeshiftOverlay(
    ctx: CanvasRenderingContext2D,
    buildingId: BuildingId,
    x: number,
    y: number,
): void {
    ctx.save();

    // --- Common overlays for all buildings ---

    // Patchwork seam lines (irregular thin lines suggesting welded-together panels)
    ctx.strokeStyle = 'rgba(80, 70, 60, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x - HW * 0.3, y - 18);
    ctx.lineTo(x + HW * 0.15, y - 10);
    ctx.moveTo(x - HW * 0.1, y - 25);
    ctx.lineTo(x + HW * 0.25, y - 15);
    ctx.moveTo(x - HW * 0.4, y - 5);
    ctx.lineTo(x - HW * 0.05, y - 2);
    ctx.stroke();

    // Repurposed hull plating patch (small metallic rectangle on one side)
    ctx.fillStyle = '#7a7a80';
    ctx.globalAlpha = 0.15;
    ctx.fillRect(x + HW * 0.15, y - 20, 8, 6);
    ctx.globalAlpha = 1;

    // --- Per-building-type details ---

    if (buildingId === 'shelter') {
        // Tarp triangle draped over the roof
        ctx.fillStyle = '#5a5040';
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.moveTo(x - HW * 0.35, y - 32);
        ctx.lineTo(x + HW * 0.1, y - 38);
        ctx.lineTo(x - HW * 0.05, y - 24);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

    } else if (buildingId === 'farm') {
        // Rough fence posts at edges
        ctx.strokeStyle = 'rgba(90, 70, 50, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - HW * 0.6, y + 2);
        ctx.lineTo(x - HW * 0.6, y - 8);
        ctx.moveTo(x + HW * 0.6, y + 2);
        ctx.lineTo(x + HW * 0.6, y - 8);
        ctx.moveTo(x - HW * 0.6, y - 4);
        ctx.lineTo(x + HW * 0.6, y - 4);
        ctx.stroke();

    } else if (buildingId === 'workshop') {
        // Scorch marks near chimney area
        ctx.fillStyle = 'rgba(30, 20, 10, 0.15)';
        ctx.beginPath();
        ctx.ellipse(x + HW * 0.25, y - 30, 7, 4, 0.3, 0, Math.PI * 2);
        ctx.fill();

    } else if (buildingId === 'storage_depot') {
        // Stenciled "SUPPLIES" text
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '5px monospace';
        ctx.fillText('SUPPLIES', x - HW * 0.35, y + 2);
        ctx.globalAlpha = 1;

    } else if (buildingId === 'med_bay') {
        // Red cross patch (small + made of two thin rects)
        ctx.fillStyle = 'rgba(180, 50, 50, 0.2)';
        ctx.fillRect(x + HW * 0.2 - 1, y - 14, 3, 8);
        ctx.fillRect(x + HW * 0.2 - 3, y - 11, 7, 3);

    } else if (buildingId === 'barracks') {
        // Reinforcement struts along edges
        ctx.strokeStyle = 'rgba(40, 40, 40, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - HW * 0.5, y - 20);
        ctx.lineTo(x - HW * 0.5, y + 4);
        ctx.moveTo(x + HW * 0.5, y - 20);
        ctx.lineTo(x + HW * 0.5, y + 4);
        ctx.stroke();

    } else if (buildingId === 'solar_array') {
        // Tape / repair marks across panels
        ctx.strokeStyle = 'rgba(180, 170, 140, 0.2)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - HW * 0.3, y - 28);
        ctx.lineTo(x + HW * 0.1, y - 16);
        ctx.moveTo(x, y - 27);
        ctx.lineTo(x + HW * 0.4, y - 17);
        ctx.stroke();

    } else if (buildingId === 'hydroponics_bay') {
        // Condensation drips (thin vertical lines with blue tint)
        ctx.strokeStyle = 'rgba(120, 180, 220, 0.15)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x - 8, y - 30);
        ctx.lineTo(x - 8, y - 18);
        ctx.moveTo(x + 3, y - 34);
        ctx.lineTo(x + 3, y - 20);
        ctx.moveTo(x + 10, y - 28);
        ctx.lineTo(x + 10, y - 17);
        ctx.stroke();
    }

    ctx.restore();
}

// --- Building lights (drawn after the building, visible at dusk/night) ---

function drawBuildingLights(
    ctx: CanvasRenderingContext2D,
    buildingId: BuildingId,
    x: number,
    y: number,
    t: number,
    dayNight: DayNightState,
    emergencyIntensity: number,
): void {
    const lightIntensity = Math.max(0, 1 - dayNight.ambientLight * 2);
    if (lightIntensity <= 0) return;

    // During emergency, lights flicker erratically — irregular on/off pattern
    if (emergencyIntensity > 0) {
        // Use multiple overlapping sine waves at different frequencies for irregular flicker
        const hash = buildingId.length * 13 + x * 7 + y * 3;
        const erratic = Math.sin(t / 120 + hash) * Math.sin(t / 73 + hash * 2.3) * Math.sin(t / 47 + hash * 0.7);
        // erratic ranges roughly -1 to 1; during emergency, lights cut out when erratic < threshold
        const cutThreshold = -0.3 + emergencyIntensity * 0.6; // at full emergency, cuts out more often
        if (erratic < cutThreshold) return; // light is "off" this frame
    }

    ctx.save();
    ctx.globalAlpha = lightIntensity;

    if (buildingId === 'shelter') {
        // Warm amber glow pool from door/windows — emotional anchor at night
        const flicker = 0.85 + 0.15 * Math.sin(t / 300 + Math.sin(t / 700) * 2);
        const glowR = 40 * flicker;
        const glow = ctx.createRadialGradient(x, y + 5, 0, x, y + 5, glowR);
        glow.addColorStop(0, `rgba(255, 180, 80, ${(0.4 * flicker).toFixed(2)})`);
        glow.addColorStop(0.4, `rgba(255, 140, 50, ${(0.15 * flicker).toFixed(2)})`);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y + 5, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Window glow intensifies
        ctx.fillStyle = `rgba(255, 200, 100, ${(0.7 * flicker).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x - 12, y - 26, 5, 0, Math.PI * 2);
        ctx.arc(x + 12, y - 26, 5, 0, Math.PI * 2);
        ctx.fill();

        // Door light spill
        ctx.fillStyle = `rgba(255, 180, 80, ${(0.5 * flicker).toFixed(2)})`;
        ctx.fillRect(x - 6, y - 12, 12, 14);

    } else if (buildingId === 'workshop') {
        // Furnace glow from window (orange-red)
        const furnaceFlicker = 0.7 + 0.3 * Math.sin(t / 200 + Math.sin(t / 500) * 3);
        ctx.fillStyle = `rgba(255, 100, 30, ${(0.5 * furnaceFlicker).toFixed(2)})`;
        const glow = ctx.createRadialGradient(x - HW * 0.2, y - 8, 0, x - HW * 0.2, y - 8, 20);
        glow.addColorStop(0, `rgba(255, 120, 40, ${(0.4 * furnaceFlicker).toFixed(2)})`);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x - HW * 0.2, y - 8, 20, 0, Math.PI * 2);
        ctx.fill();

    } else if (buildingId === 'med_bay') {
        // Cool white light from cross
        ctx.fillStyle = 'rgba(200, 220, 255, 0.3)';
        const glow = ctx.createRadialGradient(x, y - HH - 15, 0, x, y - HH - 15, 25);
        glow.addColorStop(0, 'rgba(200, 220, 255, 0.25)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y - HH - 15, 25, 0, Math.PI * 2);
        ctx.fill();

    } else if (buildingId === 'barracks') {
        // Dim red watch light
        const blink = Math.sin(t / 1500) > 0.8 ? 0.6 : 0.2;
        ctx.fillStyle = `rgba(255, 50, 50, ${blink})`;
        ctx.beginPath();
        ctx.arc(x, y - 28, 2, 0, Math.PI * 2);
        ctx.fill();

    } else if (buildingId === 'hydroponics_bay') {
        // Green grow-light glow
        const glow = ctx.createRadialGradient(x, y - 20, 0, x, y - 20, 30);
        glow.addColorStop(0, 'rgba(100, 220, 130, 0.2)');
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y - 20, 30, 0, Math.PI * 2);
        ctx.fill();
    }

    // Generic small light for any building without specific lighting
    if (!['shelter', 'workshop', 'med_bay', 'barracks', 'hydroponics_bay'].includes(buildingId)) {
        const blink = 0.4 + 0.3 * Math.sin(t / 800 + x);
        ctx.fillStyle = `rgba(255, 200, 100, ${blink})`;
        ctx.beginPath();
        ctx.arc(x, y - 15, 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

const BUILDING_DRAW_FUNCTIONS: Record<BuildingId, (ctx: CanvasRenderingContext2D, x: number, y: number, t: number, dn: DayNightState) => void> = {
    shelter: drawShelter,
    farm: drawFarm,
    solar_array: drawSolarArray,
    storage_depot: drawStorageDepot,
    workshop: drawWorkshop,
    med_bay: drawMedBay,
    barracks: drawBarracks,
    hydroponics_bay: drawHydroponicsBay,
};
