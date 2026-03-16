// colonyProps.ts — Contextual settlement props and micro-details.
// Draws small objects near buildings based on building type,
// plus scattered ambient details that make the colony feel lived-in.

import { getBuildingType } from '../data/buildings';
import { getDayNightState } from './colonyDayNight';
import type { Region } from '../components/RegionDataComponent';
import type { ColonySlotRect } from './drawColonyScene';

// =========================================================================
// Building-adjacent contextual props
// =========================================================================

/** Draw contextual props near each occupied building. */
export function drawSettlementProps(
    ctx: CanvasRenderingContext2D,
    region: Region,
    slotRects: ColonySlotRect[],
    t: number,
    gameHour = 10,
): void {
    const dayNight = getDayNightState(gameHour);
    const isNight = dayNight.ambientLight < 0.3;

    for (const rect of slotRects) {
        if (!rect.occupied) continue;

        const building = region.buildings.find(b => b.slotIndex === rect.slotIndex);
        if (!building || building.state !== 'active') continue;

        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height * 0.55;
        const seed = rect.slotIndex * 17.3 + region.id * 7.1;

        const bt = getBuildingType(building.typeId);

        switch (building.typeId) {
            case 'storage_depot':
                drawCrates(ctx, cx + 25, cy + 8, seed);
                drawBarrel(ctx, cx - 28, cy + 5, seed + 3);
                break;
            case 'workshop':
                drawToolRack(ctx, cx + 22, cy + 3, seed);
                drawAnvil(ctx, cx - 20, cy + 10, seed + 1);
                break;
            case 'shelter':
                drawCampfire(ctx, cx - 45, cy + 25, t, isNight);
                drawSupplyCrate(ctx, cx + 40, cy + 15, seed);
                break;
            case 'farm':
                drawWaterTrough(ctx, cx + 30, cy + 5, seed);
                break;
            case 'med_bay':
                drawSupplyCrate(ctx, cx + 24, cy + 8, seed);
                break;
            case 'barracks':
                drawFlagPole(ctx, cx - 22, cy - 5, t);
                break;
            case 'solar_array':
                drawControlBox(ctx, cx + 20, cy + 10, seed);
                break;
            case 'hydroponics_bay':
                drawWaterTank(ctx, cx - 25, cy + 8, seed);
                break;
            default:
                break;
        }

        // Generic lantern near every building (visible at night)
        if (isNight && bt.id !== 'shelter') {
            drawLantern(ctx, cx + Math.sin(seed) * 15, cy + 15, t);
        }
    }
}

// =========================================================================
// Scattered micro-details (between buildings)
// =========================================================================

/** Draw ambient micro-details near occupied buildings (not scattered randomly). */
export function drawMicroDetails(
    ctx: CanvasRenderingContext2D,
    _w: number,
    _h: number,
    region: Region,
    t: number,
    slotRects?: ColonySlotRect[],
    gameHour = 10,
): void {
    if (!slotRects || region.buildings.length === 0) return;

    const dayNight = getDayNightState(gameHour);
    const isNight = dayNight.ambientLight < 0.3;
    const seed = region.id * 31.7;
    const occupiedSlots = slotRects.filter(s => s.occupied);
    if (occupiedSlots.length === 0) return;

    ctx.save();

    // Place barrels and signposts near non-shelter buildings
    const nonShelterSlots = occupiedSlots.filter(s => s.slotIndex !== 0);
    for (let i = 0; i < Math.min(nonShelterSlots.length, 3); i++) {
        const slot = nonShelterSlots[i];
        const cx = slot.x + slot.width / 2;
        const cy = slot.y + slot.height * 0.6;
        const ds = seed + i * 23.1;
        const offsetX = 50 + Math.sin(ds * 1.2) * 15;
        const offsetY = 20 + Math.sin(ds * 1.8) * 8;

        drawBarrel(ctx, cx + offsetX, cy + offsetY, ds);

        if (i === 0) {
            drawSignpost(ctx, cx - offsetX - 10, cy + offsetY + 5, ds + 50);
        }
    }

    // Campfire ring — between non-shelter buildings, or offset from shelter
    if (nonShelterSlots.length >= 1) {
        const slot = nonShelterSlots[0];
        const shelter = occupiedSlots.find(s => s.slotIndex === 0);
        if (shelter) {
            // Midpoint between shelter and first other building, offset downward
            const cfx = (shelter.x + shelter.width / 2 + slot.x + slot.width / 2) / 2;
            const cfy = Math.max(shelter.y, slot.y) + 60;
            drawCampfireRing(ctx, cfx, cfy, t, isNight);
        } else {
            const cfx = slot.x + slot.width / 2 + 50;
            const cfy = slot.y + slot.height * 0.6 + 30;
            drawCampfireRing(ctx, cfx, cfy, t, isNight);
        }
    } else if (occupiedSlots.length > 0) {
        const slot = occupiedSlots[0];
        const cfx = slot.x + slot.width / 2 + 60;
        const cfy = slot.y + slot.height * 0.6 + 30;
        drawCampfireRing(ctx, cfx, cfy, t, isNight);
    }

    ctx.restore();
}

// =========================================================================
// Individual prop draw functions
// =========================================================================

function drawCrates(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
    ctx.save();
    ctx.globalAlpha = 0.85;

    // Stack of 2-3 crates
    const count = 2 + Math.floor(Math.abs(Math.sin(seed)) * 2);
    for (let i = 0; i < count; i++) {
        const cx = x + i * 5 - count * 2;
        const cy = y - i * 6;
        const s = 6 + Math.sin(seed + i) * 2;
        ctx.fillStyle = i % 2 === 0 ? '#6a5a3a' : '#5a4a2a';
        ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
        // Cross brace
        ctx.beginPath();
        ctx.moveTo(cx - s, cy - s);
        ctx.lineTo(cx + s, cy + s);
        ctx.moveTo(cx + s, cy - s);
        ctx.lineTo(cx - s, cy + s);
        ctx.stroke();
    }
    ctx.restore();
}

function drawBarrel(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
    ctx.save();
    ctx.globalAlpha = 0.8;
    const tilt = Math.sin(seed) * 0.1;

    ctx.fillStyle = '#5a4a30';
    ctx.beginPath();
    ctx.ellipse(x, y - 5, 7, 9, tilt, 0, Math.PI * 2);
    ctx.fill();
    // Outline
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Top
    ctx.fillStyle = '#6a5a40';
    ctx.beginPath();
    ctx.ellipse(x, y - 13, 6, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Band
    ctx.strokeStyle = 'rgba(80,70,50,0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(x, y - 5, 7.5, 2.5, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
}

function drawToolRack(ctx: CanvasRenderingContext2D, x: number, y: number, _seed: number): void {
    ctx.save();
    ctx.globalAlpha = 0.6;

    // Vertical post
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(x - 1, y - 15, 2, 18);

    // Cross bar
    ctx.fillRect(x - 8, y - 14, 16, 2);

    // Tools hanging
    ctx.strokeStyle = '#8a8a9a';
    ctx.lineWidth = 1;
    // Hammer
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 12);
    ctx.lineTo(x - 5, y - 6);
    ctx.stroke();
    ctx.fillStyle = '#6a6a7a';
    ctx.fillRect(x - 7, y - 6, 4, 3);

    // Wrench
    ctx.beginPath();
    ctx.moveTo(x + 4, y - 12);
    ctx.lineTo(x + 4, y - 5);
    ctx.stroke();

    ctx.restore();
}

function drawAnvil(ctx: CanvasRenderingContext2D, x: number, y: number, _seed: number): void {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#4a4a5a';
    // Base
    ctx.fillRect(x - 5, y - 2, 10, 4);
    // Top
    ctx.fillRect(x - 6, y - 5, 12, 3);
    // Horn
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 4);
    ctx.lineTo(x + 10, y - 3);
    ctx.lineTo(x + 6, y - 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawCampfire(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
    isNight: boolean,
): void {
    ctx.save();

    // Small log pile
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#3a2a18';
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.3);
    ctx.fillRect(-4, -1, 8, 2);
    ctx.restore();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.4);
    ctx.fillRect(-4, -1, 8, 2);
    ctx.restore();

    // Stone ring
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#5a5a5a';
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const rx = x + Math.cos(angle) * 5;
        const ry = y + Math.sin(angle) * 2.5;
        ctx.beginPath();
        ctx.arc(rx, ry, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Flame — two layers
    const flicker1 = 0.6 + 0.4 * Math.sin(t / 150 + Math.sin(t / 400) * 2);
    const flicker2 = 0.5 + 0.5 * Math.sin(t / 200 + 1);
    const intensity = isNight ? 0.9 : 0.4;

    // Outer flame (orange)
    ctx.globalAlpha = intensity * flicker1;
    ctx.fillStyle = 'rgba(255, 140, 30, 0.7)';
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y);
    ctx.quadraticCurveTo(x - 1, y - 6 * flicker2, x, y - 7 * flicker2);
    ctx.quadraticCurveTo(x + 1, y - 6 * flicker2, x + 2.5, y);
    ctx.closePath();
    ctx.fill();

    // Inner flame (yellow)
    ctx.globalAlpha = intensity * flicker2 * 0.8;
    ctx.fillStyle = 'rgba(255, 220, 80, 0.6)';
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y);
    ctx.quadraticCurveTo(x, y - 4 * flicker1, x + 1.5, y);
    ctx.closePath();
    ctx.fill();

    // Warm amber glow pool
    const glowR = isNight ? 18 : 10;
    const glowAlpha = isNight ? 0.12 * flicker1 : 0.04 * flicker1;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    glow.addColorStop(0, `rgba(255, 160, 60, ${glowAlpha.toFixed(3)})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawSupplyCrate(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
    ctx.save();
    ctx.globalAlpha = 0.6;
    const s = 6;
    ctx.fillStyle = '#5a5a4a';
    ctx.fillRect(x - s, y - s, s * 2, s * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - s, y - s, s * 2, s * 2);
    // Lid mark
    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.lineTo(x + s, y);
    ctx.stroke();

    // Leaning against building — slight tilt
    if (Math.sin(seed) > 0) {
        ctx.fillStyle = '#4a4a3a';
        ctx.fillRect(x - s - 3, y - s + 2, s, s * 1.5);
    }
    ctx.restore();
}

function drawWaterTrough(ctx: CanvasRenderingContext2D, x: number, y: number, _seed: number): void {
    ctx.save();
    ctx.globalAlpha = 0.5;
    // Trough body
    ctx.fillStyle = '#5a5040';
    ctx.fillRect(x - 10, y - 3, 20, 6);
    // Water inside
    ctx.fillStyle = 'rgba(80, 130, 180, 0.4)';
    ctx.fillRect(x - 8, y - 1, 16, 3);
    // Legs
    ctx.fillStyle = '#4a4030';
    ctx.fillRect(x - 9, y + 3, 2, 4);
    ctx.fillRect(x + 7, y + 3, 2, 4);
    ctx.restore();
}

function drawFlagPole(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    ctx.save();
    ctx.globalAlpha = 0.6;
    // Pole
    ctx.fillStyle = '#6a6a7a';
    ctx.fillRect(x - 1, y - 25, 2, 28);
    // Flag with wave
    const wave = Math.sin(t / 800) * 3;
    ctx.fillStyle = '#4a6a9a';
    ctx.beginPath();
    ctx.moveTo(x + 1, y - 24);
    ctx.quadraticCurveTo(x + 10 + wave, y - 22, x + 12, y - 18 + wave);
    ctx.lineTo(x + 1, y - 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawControlBox(ctx: CanvasRenderingContext2D, x: number, y: number, _seed: number): void {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#5a5a6a';
    ctx.fillRect(x - 4, y - 6, 8, 8);
    // Screen
    ctx.fillStyle = 'rgba(100, 200, 150, 0.3)';
    ctx.fillRect(x - 2, y - 4, 4, 3);
    // Blinking LED
    const blink = Math.sin(performance.now() / 500) > 0.5 ? 0.8 : 0.2;
    ctx.fillStyle = `rgba(100, 255, 100, ${blink})`;
    ctx.beginPath();
    ctx.arc(x, y, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawWaterTank(ctx: CanvasRenderingContext2D, x: number, y: number, _seed: number): void {
    ctx.save();
    ctx.globalAlpha = 0.5;
    // Tank body
    ctx.fillStyle = '#5a6a5a';
    ctx.beginPath();
    ctx.ellipse(x, y - 5, 6, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Top cap
    ctx.fillStyle = '#6a7a6a';
    ctx.beginPath();
    ctx.ellipse(x, y - 12, 5, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pipe
    ctx.strokeStyle = '#4a5a4a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 3);
    ctx.lineTo(x + 12, y - 3);
    ctx.lineTo(x + 12, y + 3);
    ctx.stroke();
    ctx.restore();
}

function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
    ctx.save();
    const flicker = 0.6 + 0.4 * Math.sin(t / 200 + x);

    // Post
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x - 0.5, y - 8, 1, 10);

    // Lantern glow
    ctx.globalAlpha = flicker * 0.4;
    const glow = ctx.createRadialGradient(x, y - 8, 0, x, y - 8, 12);
    glow.addColorStop(0, 'rgba(255, 200, 100, 0.6)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y - 8, 12, 0, Math.PI * 2);
    ctx.fill();

    // Lantern body
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = `rgba(255, 200, 100, ${(0.5 + flicker * 0.3).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y - 8, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawSignpost(ctx: CanvasRenderingContext2D, x: number, y: number, _seed: number): void {
    ctx.save();
    ctx.globalAlpha = 0.5;
    // Post
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(x - 1, y - 12, 2, 14);
    // Sign board
    ctx.fillStyle = '#6a5a4a';
    ctx.fillRect(x + 1, y - 11, 10, 5);
    // Text mark (just a line)
    ctx.strokeStyle = 'rgba(200,200,200,0.3)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 3, y - 9);
    ctx.lineTo(x + 9, y - 9);
    ctx.stroke();
    ctx.restore();
}

function drawCampfireRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
    isNight: boolean,
): void {
    ctx.save();

    // Larger stone ring
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#5a5a5a';
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const rx = x + Math.cos(angle) * 10;
        const ry = y + Math.sin(angle) * 4;
        ctx.beginPath();
        ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Log seats (2)
    ctx.fillStyle = '#4a3a2a';
    ctx.save();
    ctx.translate(x - 14, y + 2);
    ctx.rotate(-0.3);
    ctx.fillRect(-6, -1.5, 12, 3);
    ctx.restore();
    ctx.save();
    ctx.translate(x + 13, y + 1);
    ctx.rotate(0.2);
    ctx.fillRect(-5, -1.5, 10, 3);
    ctx.restore();

    // Fire
    const flicker = 0.5 + 0.5 * Math.sin(t / 120 + Math.sin(t / 300) * 3);
    const intensity = isNight ? 0.9 : 0.3;

    ctx.globalAlpha = intensity;
    ctx.fillStyle = `rgba(255, 130, 30, ${(0.7 * flicker).toFixed(2)})`;
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 1);
    ctx.quadraticCurveTo(x, y - 7 * flicker, x + 2, y + 1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = `rgba(255, 200, 50, ${(0.4 * flicker).toFixed(2)})`;
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y);
    ctx.quadraticCurveTo(x + 0.5, y - 4 * flicker, x + 1.5, y);
    ctx.closePath();
    ctx.fill();

    // Warm light pool at night
    if (isNight) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 35);
        glow.addColorStop(0, `rgba(255, 130, 50, ${(0.12 * flicker).toFixed(2)})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 35, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}
