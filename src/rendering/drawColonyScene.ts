// drawColonyScene.ts — Isometric colony scene renderer.
// Draws biome-specific sky, isometric terrain grid, buildings, colonists.

import { ServiceLocator } from '../core/ServiceLocator';
import { RegionDataComponent } from '../components/RegionDataComponent';
import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { getBuildingType } from '../data/buildings';
import { getCrewAtColony } from '../utils/crewUtils';
import { drawBuilding } from './colonyBuildingSprites';
import {
    gridToScreen,
    drawIsometricTile,
    getSlotGridPositions,
    TILE_WIDTH,
    TILE_HEIGHT,
} from './isometric';
import type { Region } from '../components/RegionDataComponent';
import type { BiomeName } from '../data/biomes';
import type { Entity } from '../core/Entity';
import type { World } from '../core/World';

/** Slot rectangle for hit-testing. */
export interface ColonySlotRect {
    slotIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    occupied: boolean;
}

// --- Biome visual configs ---

interface BiomeVisuals {
    skyTop: string;
    skyBottom: string;
    skyHaze: string;
    groundBase: string;
    groundDark: string;
    groundLight: string;
    horizonFeature: 'mountains' | 'trees' | 'volcanoes' | 'none';
    starTint: string;
    particleColour: string;
    particleType: 'pollen' | 'snow' | 'embers' | 'fireflies';
    dressing: 'grass' | 'ice' | 'ferns' | 'rocks';
}

const BIOME_VISUALS: Partial<Record<BiomeName, BiomeVisuals>> = {
    'Temperate Plains': {
        skyTop: '#4a8ac0', skyBottom: '#c8d8e8', skyHaze: 'rgba(200,220,240,0.3)',
        groundBase: '#4a7a3a', groundDark: '#3a6a2a', groundLight: '#5a8a4a',
        horizonFeature: 'trees', starTint: 'rgba(255, 220, 150, 0.25)',
        particleColour: 'rgba(255,255,200,0.4)', particleType: 'pollen',
        dressing: 'grass',
    },
    'Arctic Wastes': {
        skyTop: '#5a7a90', skyBottom: '#b0c0d0', skyHaze: 'rgba(200,210,220,0.4)',
        groundBase: '#b8c8d8', groundDark: '#a0b0c0', groundLight: '#c8d8e8',
        horizonFeature: 'mountains', starTint: 'rgba(255, 240, 200, 0.15)',
        particleColour: 'rgba(255,255,255,0.6)', particleType: 'snow',
        dressing: 'ice',
    },
    'Dense Jungle': {
        skyTop: '#3a6a5a', skyBottom: '#8aaa7a', skyHaze: 'rgba(100,150,100,0.3)',
        groundBase: '#2a5a2a', groundDark: '#1a4a1a', groundLight: '#3a6a3a',
        horizonFeature: 'trees', starTint: 'rgba(255, 200, 100, 0.2)',
        particleColour: 'rgba(150,255,100,0.3)', particleType: 'fireflies',
        dressing: 'ferns',
    },
    'Volcanic Highlands': {
        skyTop: '#4a2a1a', skyBottom: '#8a5a3a', skyHaze: 'rgba(100,50,20,0.3)',
        groundBase: '#3a2a2a', groundDark: '#2a1a1a', groundLight: '#4a3a2a',
        horizonFeature: 'volcanoes', starTint: 'rgba(255, 150, 50, 0.3)',
        particleColour: 'rgba(255,120,30,0.5)', particleType: 'embers',
        dressing: 'rocks',
    },
};

const DEFAULT_VISUALS: BiomeVisuals = {
    skyTop: '#4a8ac0', skyBottom: '#c8d8e8', skyHaze: 'rgba(200,220,240,0.3)',
    groundBase: '#5a7a4a', groundDark: '#4a6a3a', groundLight: '#6a8a5a',
    horizonFeature: 'none', starTint: 'rgba(255, 220, 150, 0.2)',
    particleColour: 'rgba(255,255,200,0.3)', particleType: 'pollen',
    dressing: 'grass',
};

function getVisuals(biome: BiomeName): BiomeVisuals {
    return BIOME_VISUALS[biome] ?? DEFAULT_VISUALS;
}

// --- Main draw function ---

export function drawColonyScene(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    regionId: number,
): ColonySlotRect[] {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
    const regionData = entity.getComponent(RegionDataComponent);
    if (!regionData) return [];

    const region = regionData.regions.find(r => r.id === regionId);
    if (!region) return [];

    const w = canvas.width;
    const h = canvas.height;
    const t = performance.now();
    const visuals = getVisuals(region.biome);
    const horizonY = h * 0.35;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    drawSky(ctx, w, h, horizonY, visuals, t);
    drawHorizonFeatures(ctx, w, horizonY, visuals, region.id);
    drawNaturalGround(ctx, w, h, horizonY, visuals, region.id);
    drawGroundDressing(ctx, w, h, horizonY, visuals, region.id);
    drawPaths(ctx, w, h, region);
    const slotRects = drawBuildingSlots(ctx, w, h, region, t);
    drawBuildingShadows(ctx, region, slotRects);
    drawColonists(ctx, entity, region, slotRects, t);
    drawAmbientParticles(ctx, w, h, visuals, t);
    drawColonyLabel(ctx, w, region);

    return slotRects;
}

// --- Sky ---

function drawSky(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    visuals: BiomeVisuals,
    t: number,
): void {
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
    grad.addColorStop(0, visuals.skyTop);
    grad.addColorStop(0.7, visuals.skyBottom);
    grad.addColorStop(1, visuals.skyHaze);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, horizonY + 10);

    // Atmospheric haze near horizon
    const hazeGrad = ctx.createLinearGradient(0, horizonY - h * 0.08, 0, horizonY + 10);
    hazeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    hazeGrad.addColorStop(1, visuals.skyHaze);
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, horizonY - h * 0.08, w, h * 0.08 + 10);

    // Star glow
    const starX = w * 0.75;
    const starY = horizonY * 0.55;
    const pulse = 0.8 + 0.2 * Math.sin(t / 3000);
    const r = w * 0.14;
    const starGrad = ctx.createRadialGradient(starX, starY, 0, starX, starY, r);
    starGrad.addColorStop(0, visuals.starTint.replace(/[\d.]+\)$/, `${(0.6 * pulse).toFixed(2)})`));
    starGrad.addColorStop(0.3, visuals.starTint.replace(/[\d.]+\)$/, `${(0.3 * pulse).toFixed(2)})`));
    starGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(starX, starY, r, 0, Math.PI * 2);
    ctx.fill();

    // Drifting clouds
    drawClouds(ctx, w, horizonY, t);
}

function drawClouds(ctx: CanvasRenderingContext2D, w: number, horizonY: number, t: number): void {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

    for (let i = 0; i < 5; i++) {
        const speed = 0.008 + i * 0.003;
        const baseX = ((t * speed + i * w * 0.25) % (w + 200)) - 100;
        const baseY = horizonY * (0.2 + i * 0.12);
        const cloudW = 80 + i * 30;
        const cloudH = 15 + i * 5;

        // Cloud as overlapping ellipses
        ctx.beginPath();
        ctx.ellipse(baseX, baseY, cloudW, cloudH, 0, 0, Math.PI * 2);
        ctx.ellipse(baseX + cloudW * 0.3, baseY - cloudH * 0.3, cloudW * 0.6, cloudH * 0.8, 0, 0, Math.PI * 2);
        ctx.ellipse(baseX - cloudW * 0.2, baseY + cloudH * 0.2, cloudW * 0.5, cloudH * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// --- Rolling hills and horizon features ---

function drawHorizonFeatures(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    visuals: BiomeVisuals,
    seed: number,
): void {
    // Layer 1: Far rolling hills (subtle, hazy)
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = visuals.groundDark;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= w; x += 4) {
        const hillY = horizonY - 15
            - Math.sin(x / 200 + seed * 0.7) * 20
            - Math.sin(x / 80 + seed * 1.3) * 8
            - Math.abs(Math.sin(x / 350 + seed * 0.3)) * 25;
        ctx.lineTo(x, hillY);
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Layer 2: Mid rolling hills (more visible)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = visuals.groundBase;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= w; x += 4) {
        const hillY = horizonY - 5
            - Math.sin(x / 150 + seed * 1.1) * 15
            - Math.sin(x / 60 + seed * 2.1) * 6;
        ctx.lineTo(x, hillY);
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Feature-specific details on top of hills
    if (visuals.horizonFeature === 'mountains' || visuals.horizonFeature === 'volcanoes') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
        for (let i = 0; i < 9; i++) {
            const cx = (i + 0.3) * w / 9 + Math.sin(seed + i * 3.7) * w * 0.03;
            const peakH = horizonY * (0.1 + Math.abs(Math.sin(seed * 1.3 + i * 2.1)) * 0.2);
            const baseW = w / 9 * 1.4;
            ctx.beginPath();
            ctx.moveTo(cx - baseW / 2, horizonY);
            ctx.quadraticCurveTo(cx - baseW * 0.15, horizonY - peakH * 0.7, cx, horizonY - peakH);
            ctx.quadraticCurveTo(cx + baseW * 0.15, horizonY - peakH * 0.7, cx + baseW / 2, horizonY);
            ctx.closePath();
            ctx.fill();
        }
    } else if (visuals.horizonFeature === 'trees') {
        // Dense tree line on the hills
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        for (let i = 0; i < 30; i++) {
            const cx = (i + 0.2) * w / 30 + Math.sin(seed + i * 2.3) * w * 0.01;
            const treeH = 8 + Math.abs(Math.sin(seed + i * 1.7)) * 12;
            const treeW = w / 30 * 0.7;
            ctx.beginPath();
            ctx.arc(cx, horizonY - treeH * 0.5 - 5, treeW / 2, Math.PI, 0);
            ctx.lineTo(cx + treeW / 2, horizonY);
            ctx.lineTo(cx - treeW / 2, horizonY);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// --- Natural ground (no checkerboard) ---

function drawNaturalGround(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    visuals: BiomeVisuals,
    seed: number,
): void {
    const terrainH = h - horizonY;

    // Base gradient from horizon to bottom
    const grad = ctx.createLinearGradient(0, horizonY, 0, h);
    grad.addColorStop(0, visuals.groundLight);
    grad.addColorStop(0.3, visuals.groundBase);
    grad.addColorStop(1, visuals.groundDark);
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY, w, terrainH);

    // Organic noise patches for natural variation
    ctx.save();
    for (let i = 0; i < 20; i++) {
        const patchSeed = seed * 13.7 + i * 7.3;
        const px = (Math.sin(patchSeed) * 0.5 + 0.5) * w;
        const py = horizonY + (Math.sin(patchSeed * 2.1) * 0.5 + 0.5) * terrainH;
        const pr = 30 + Math.abs(Math.sin(patchSeed * 3.7)) * 80;

        const patchGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
        const isLight = i % 3 === 0;
        patchGrad.addColorStop(0, isLight ? visuals.groundLight : visuals.groundDark);
        patchGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = patchGrad;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// --- Ground dressing (grass, rocks, ice, ferns) — dense coverage ---

function drawGroundDressing(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    visuals: BiomeVisuals,
    seed: number,
): void {
    ctx.save();
    const terrainH = h - horizonY;

    // Dense coverage — 150+ elements
    const count = 150;

    for (let i = 0; i < count; i++) {
        const ds = seed * 3.1 + i * 7.13;
        const dx = (Math.sin(ds * 1.1) * 0.5 + 0.5) * w;
        const depthRatio = (Math.sin(ds * 1.7) * 0.5 + 0.5);
        const dy = horizonY + depthRatio * terrainH * 0.85 + terrainH * 0.05;

        // Scale with depth (smaller near horizon, larger at bottom)
        const scale = 0.4 + depthRatio * 0.6;
        // Fade with depth (more transparent near horizon)
        ctx.globalAlpha = 0.2 + depthRatio * 0.4;

        if (visuals.dressing === 'grass') {
            // Grass tufts — multiple blades per tuft
            const bladeCount = 3 + Math.floor(Math.abs(Math.sin(ds * 2.3)) * 4);
            ctx.strokeStyle = i % 3 === 0 ? visuals.groundLight : visuals.groundBase;
            ctx.lineWidth = 0.8 * scale;
            for (let j = 0; j < bladeCount; j++) {
                const gx = dx + (j - bladeCount / 2) * 2.5 * scale;
                const bladeH = (4 + Math.abs(Math.sin(ds + j * 1.3)) * 6) * scale;
                const lean = Math.sin(ds + j * 0.7) * 3 * scale;
                ctx.beginPath();
                ctx.moveTo(gx, dy);
                ctx.quadraticCurveTo(gx + lean * 0.5, dy - bladeH * 0.6, gx + lean, dy - bladeH);
                ctx.stroke();
            }

            // Occasional wildflower
            if (i % 12 === 0) {
                ctx.fillStyle = i % 24 === 0 ? '#e8d040' : '#d060a0';
                ctx.beginPath();
                ctx.arc(dx + Math.sin(ds) * 3, dy - 6 * scale, 1.5 * scale, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (visuals.dressing === 'rocks') {
            // Scattered rocks of varying sizes
            const rockW = (2 + Math.abs(Math.sin(ds * 1.5)) * 6) * scale;
            const rockH = rockW * 0.5;
            ctx.fillStyle = i % 2 === 0 ? visuals.groundLight : '#5a4a3a';
            ctx.beginPath();
            ctx.ellipse(dx, dy, rockW, rockH, Math.sin(ds) * 0.3, 0, Math.PI * 2);
            ctx.fill();
            // Rock highlight
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.beginPath();
            ctx.ellipse(dx - rockW * 0.2, dy - rockH * 0.3, rockW * 0.5, rockH * 0.3, 0, 0, Math.PI * 2);
            ctx.fill();
        } else if (visuals.dressing === 'ice') {
            // Ice crystals and snow patches
            if (i % 3 === 0) {
                // Crystal
                ctx.fillStyle = 'rgba(200, 220, 255, 0.3)';
                const s = 3 * scale;
                ctx.beginPath();
                ctx.moveTo(dx, dy - s);
                ctx.lineTo(dx + s * 0.7, dy);
                ctx.lineTo(dx, dy + s);
                ctx.lineTo(dx - s * 0.7, dy);
                ctx.closePath();
                ctx.fill();
            } else {
                // Snow patch
                ctx.fillStyle = 'rgba(230, 240, 255, 0.2)';
                ctx.beginPath();
                ctx.ellipse(dx, dy, 5 * scale, 2 * scale, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (visuals.dressing === 'ferns') {
            // Dense fern/undergrowth
            ctx.strokeStyle = i % 2 === 0 ? '#2a8a2a' : '#1a6a1a';
            ctx.lineWidth = 0.8 * scale;
            const fernH = (5 + Math.abs(Math.sin(ds)) * 5) * scale;
            // Main stem
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(dx, dy - fernH);
            ctx.stroke();
            // Fronds
            for (let j = 1; j <= 3; j++) {
                const fy = dy - j * fernH * 0.25;
                const fw = (4 - j) * 2 * scale;
                ctx.beginPath();
                ctx.moveTo(dx, fy);
                ctx.lineTo(dx - fw, fy - 2 * scale);
                ctx.moveTo(dx, fy);
                ctx.lineTo(dx + fw, fy - 2 * scale);
                ctx.stroke();
            }
        }
    }
    ctx.restore();
}

// --- Paths between buildings ---

function drawPaths(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    region: Region,
): void {
    if (region.buildings.length < 1) return;

    const horizonY = h * 0.35;
    const centreX = w / 2;
    const centreY = horizonY + (h - horizonY) * 0.35;
    const gridPositions = getSlotGridPositions(region.buildingSlots);

    const occupiedIndices = region.buildings.map(b => b.slotIndex);
    if (occupiedIndices.length === 0) return;

    ctx.save();

    // Draw paths between all occupied buildings (star topology from first building)
    for (let i = 0; i < occupiedIndices.length; i++) {
        for (let j = i + 1; j < occupiedIndices.length; j++) {
            const a = gridPositions[occupiedIndices[i]];
            const b = gridPositions[occupiedIndices[j]];
            if (!a || !b) continue;

            const posA = gridToScreen(a.gridX, a.gridY, centreX, centreY);
            const posB = gridToScreen(b.gridX, b.gridY, centreX, centreY);
            const ay = posA.y + TILE_HEIGHT * 0.3;
            const by = posB.y + TILE_HEIGHT * 0.3;

            // Dirt path — wide, brown, slightly transparent
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = '#6a5a3a';
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(posA.x, ay);
            // Slight curve for natural feel
            const midX = (posA.x + posB.x) / 2 + (posA.y - posB.y) * 0.1;
            const midY = (ay + by) / 2;
            ctx.quadraticCurveTo(midX, midY, posB.x, by);
            ctx.stroke();

            // Lighter worn centre line
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = '#8a7a5a';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(posA.x, ay);
            ctx.quadraticCurveTo(midX, midY, posB.x, by);
            ctx.stroke();
        }
    }

    ctx.restore();
}

// --- Building shadows ---

function drawBuildingShadows(
    ctx: CanvasRenderingContext2D,
    _region: Region,
    slotRects: ColonySlotRect[],
): void {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';

    for (const rect of slotRects) {
        if (!rect.occupied) continue;

        // Shadow as a dark parallelogram offset to the right
        const sx = rect.x + rect.width / 2;
        const sy = rect.y + rect.height * 0.5;
        const shadowW = TILE_WIDTH * 0.5;
        const shadowH = TILE_HEIGHT * 0.3;

        ctx.beginPath();
        ctx.ellipse(sx + 15, sy + 10, shadowW, shadowH, 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// --- Ambient particles ---

function drawAmbientParticles(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    visuals: BiomeVisuals,
    t: number,
): void {
    ctx.save();
    ctx.fillStyle = visuals.particleColour;

    const count = 25;
    for (let i = 0; i < count; i++) {
        const seed = i * 7.13;
        let px: number;
        let py: number;
        let size: number;

        if (visuals.particleType === 'snow') {
            // Falling snow
            px = (Math.sin(seed) * 0.5 + 0.5) * w + Math.sin(t / 3000 + seed) * 20;
            py = ((t / 4000 + seed * 0.3) % 1.2 - 0.1) * h;
            size = 1.5 + Math.sin(seed * 2) * 1;
        } else if (visuals.particleType === 'embers') {
            // Rising embers
            px = (Math.sin(seed * 1.3) * 0.5 + 0.5) * w + Math.sin(t / 1500 + seed) * 30;
            py = h - ((t / 3000 + seed * 0.4) % 1.2) * h;
            size = 1 + Math.sin(seed) * 1;
        } else if (visuals.particleType === 'fireflies') {
            // Glowing fireflies with erratic movement
            px = (Math.sin(seed * 1.7) * 0.5 + 0.5) * w + Math.sin(t / 1000 + seed) * 40;
            py = h * 0.4 + Math.sin(t / 1200 + seed * 2) * h * 0.25;
            size = 1.5 + Math.sin(t / 500 + seed) * 0.5;
            ctx.globalAlpha = 0.3 + Math.sin(t / 400 + seed * 3) * 0.3;
        } else {
            // Floating pollen
            px = (Math.sin(seed) * 0.5 + 0.5) * w + Math.sin(t / 4000 + seed) * 30;
            py = h * 0.3 + Math.sin(t / 3000 + seed * 1.5) * h * 0.2;
            size = 1 + Math.sin(seed * 3) * 0.5;
        }

        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// --- Building slots ---

function drawBuildingSlots(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    region: Region,
    t: number,
): ColonySlotRect[] {
    const slotRects: ColonySlotRect[] = [];
    const totalSlots = region.buildingSlots;
    if (totalSlots === 0) return slotRects;

    const horizonY = h * 0.35;
    const centreX = w / 2;
    const centreY = horizonY + (h - horizonY) * 0.35;

    const gridPositions = getSlotGridPositions(totalSlots);

    for (let i = 0; i < gridPositions.length; i++) {
        const gridPos = gridPositions[i];
        const screenPos = gridToScreen(gridPos.gridX, gridPos.gridY, centreX, centreY);

        const building = region.buildings.find(b => b.slotIndex === i);
        const rect: ColonySlotRect = {
            slotIndex: i,
            x: screenPos.x - TILE_WIDTH / 2,
            y: screenPos.y - TILE_HEIGHT,
            width: TILE_WIDTH,
            height: TILE_HEIGHT * 2,
            occupied: building !== null && building !== undefined,
        };
        slotRects.push(rect);

        if (building) {
            drawBuilding(ctx, building.typeId, screenPos.x, screenPos.y, building.state, t);

            // Building name label
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.8;
            ctx.font = '10px "Share Tech Mono", "Courier New", monospace';
            ctx.textAlign = 'center';
            const bt = getBuildingType(building.typeId);
            ctx.fillText(bt.name.toUpperCase(), screenPos.x, screenPos.y + TILE_HEIGHT * 0.7);

            if (building.state === 'constructing') {
                ctx.fillStyle = '#ffca28';
                ctx.fillText(`(${building.turnsRemaining} TURNS)`, screenPos.x, screenPos.y + TILE_HEIGHT * 0.7 + 12);
            }
            ctx.globalAlpha = 1.0;
        } else {
            // Empty slot — draw faded diamond outline with +
            ctx.save();
            ctx.globalAlpha = 0.15;
            drawIsometricTile(ctx, screenPos.x, screenPos.y, 'rgba(255,255,255,0.1)', '#c0c8d8');

            // Plus marker
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#c0c8d8';
            ctx.fillRect(screenPos.x - 8, screenPos.y - 1.5, 16, 3);
            ctx.fillRect(screenPos.x - 1.5, screenPos.y - 8, 3, 16);
            ctx.restore();
        }
    }

    return slotRects;
}

// --- Colonists ---

function drawColonists(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    region: Region,
    slotRects: ColonySlotRect[],
    t: number,
): void {
    const world = ServiceLocator.get<World>('world');
    const crew = getCrewAtColony(world, entity.id, region.id);
    if (crew.length === 0) return;

    const ROLE_COLOURS: Record<string, string> = {
        Soldier: '#4fa8ff',
        Civilian: '#66bb6a',
        Engineer: '#c0c8d8',
        Medic: '#ef5350',
        Scientist: '#ffca28',
    };

    for (let i = 0; i < crew.length; i++) {
        const crewComp = crew[i].getComponent(CrewMemberComponent);
        if (!crewComp) continue;

        // Wander near occupied buildings
        const occupiedSlots = slotRects.filter(s => s.occupied);
        const targetSlot = occupiedSlots.length > 0
            ? occupiedSlots[i % occupiedSlots.length]
            : slotRects[i % slotRects.length];

        if (!targetSlot) continue;

        const slotCentreX = targetSlot.x + targetSlot.width / 2;
        const slotCentreY = targetSlot.y + targetSlot.height * 0.6;
        const wanderX = Math.sin(t / 2000 + i * 1.7) * TILE_WIDTH * 0.3;
        const wanderY = Math.sin(t / 2500 + i * 2.3) * TILE_HEIGHT * 0.2;
        const dotX = slotCentreX + wanderX;
        const dotY = slotCentreY + wanderY + 15;

        const colour = ROLE_COLOURS[crewComp.role] ?? '#c0c8d8';
        const r = crewComp.isLeader ? 4 : 2.5;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.beginPath();
        ctx.ellipse(dotX, dotY + r, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dot
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(dotX, dotY, r, 0, Math.PI * 2);
        ctx.fill();

        // Leader star
        if (crewComp.isLeader) {
            ctx.fillStyle = '#d4a020';
            ctx.font = '8px "Share Tech Mono"';
            ctx.textAlign = 'center';
            ctx.fillText('★', dotX, dotY - 7);
        }
    }
}

// --- Colony label ---

function drawColonyLabel(ctx: CanvasRenderingContext2D, w: number, region: Region): void {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8;
    ctx.font = '14px "Share Tech Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`COLONY — ${region.biome.toUpperCase()}`, w / 2, 30);
    ctx.globalAlpha = 1.0;
}

// --- Transition drawing ---

export function drawTransitionToColony(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    regionId: number,
    progress: number,
): void {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (progress < 0.4) {
        const phase = progress / 0.4;
        ctx.fillStyle = `rgba(3, 4, 10, ${phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (progress < 0.5) {
        ctx.fillStyle = '#03040a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        const phase = (progress - 0.5) / 0.5;
        ctx.save();
        ctx.globalAlpha = phase;
        drawColonyScene(entity, ctx, regionId);
        ctx.restore();
        ctx.fillStyle = `rgba(3, 4, 10, ${1 - phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

export function drawTransitionFromColony(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    regionId: number,
    progress: number,
): void {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (progress < 0.4) {
        const phase = progress / 0.4;
        ctx.save();
        ctx.globalAlpha = 1 - phase;
        drawColonyScene(entity, ctx, regionId);
        ctx.restore();
        ctx.fillStyle = `rgba(3, 4, 10, ${phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (progress < 0.5) {
        ctx.fillStyle = '#03040a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        const phase = (progress - 0.5) / 0.5;
        ctx.fillStyle = `rgba(3, 4, 10, ${1 - phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}
