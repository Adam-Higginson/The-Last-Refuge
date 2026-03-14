// drawColonyScene.ts — Canvas rendering of the colony scene.
// Draws biome-specific sky, terrain, buildings, colonists, and empty slots.

import { ServiceLocator } from '../core/ServiceLocator';
import { RegionDataComponent } from '../components/RegionDataComponent';
import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { getBuildingType } from '../data/buildings';
import { getCrewAtColony } from '../utils/crewUtils';
import { drawBuilding } from './colonyBuildingSprites';
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
    groundBase: string;
    groundVariation: string;
    horizonFeature: 'mountains' | 'trees' | 'volcanoes' | 'none';
    starTint: string;
}

const BIOME_VISUALS: Partial<Record<BiomeName, BiomeVisuals>> = {
    'Temperate Plains': {
        skyTop: '#4a8ac0',
        skyBottom: '#c8d8e8',
        groundBase: '#4a7a3a',
        groundVariation: '#5a8a4a',
        horizonFeature: 'trees',
        starTint: 'rgba(255, 220, 150, 0.25)',
    },
    'Arctic Wastes': {
        skyTop: '#5a7a90',
        skyBottom: '#b0c0d0',
        groundBase: '#c8d8e8',
        groundVariation: '#d8e8f0',
        horizonFeature: 'mountains',
        starTint: 'rgba(255, 240, 200, 0.15)',
    },
    'Dense Jungle': {
        skyTop: '#3a6a5a',
        skyBottom: '#8aaa7a',
        groundBase: '#2a5a2a',
        groundVariation: '#3a6a3a',
        horizonFeature: 'trees',
        starTint: 'rgba(255, 200, 100, 0.2)',
    },
    'Volcanic Highlands': {
        skyTop: '#4a2a1a',
        skyBottom: '#8a5a3a',
        groundBase: '#3a2a2a',
        groundVariation: '#4a3a2a',
        horizonFeature: 'volcanoes',
        starTint: 'rgba(255, 150, 50, 0.3)',
    },
};

const DEFAULT_VISUALS: BiomeVisuals = {
    skyTop: '#4a8ac0',
    skyBottom: '#c8d8e8',
    groundBase: '#5a7a4a',
    groundVariation: '#6a8a5a',
    horizonFeature: 'none',
    starTint: 'rgba(255, 220, 150, 0.2)',
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
    const horizonY = h * 0.4;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    drawSky(ctx, w, horizonY, visuals, t);
    drawHorizonFeatures(ctx, w, horizonY, visuals, region.id);
    drawTerrain(ctx, w, h, horizonY, visuals, t);
    const slotRects = drawBuildingSlots(ctx, w, h, horizonY, region, t);
    drawColonists(ctx, entity, region, slotRects, t);
    drawColonyLabel(ctx, w, region);

    return slotRects;
}

// --- Sky ---

function drawSky(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    visuals: BiomeVisuals,
    t: number,
): void {
    const grad = ctx.createLinearGradient(0, 0, 0, horizonY);
    grad.addColorStop(0, visuals.skyTop);
    grad.addColorStop(1, visuals.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, horizonY);

    // Star glow near horizon
    const starX = w * 0.75;
    const starY = horizonY * 0.7;
    const pulse = 0.8 + 0.2 * Math.sin(t / 3000);
    const starGrad = ctx.createRadialGradient(starX, starY, 0, starX, starY, w * 0.15);
    starGrad.addColorStop(0, visuals.starTint.replace(/[\d.]+\)$/, `${(0.4 * pulse).toFixed(2)})`));
    starGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(starX, starY, w * 0.15, 0, Math.PI * 2);
    ctx.fill();
}

// --- Horizon features ---

function drawHorizonFeatures(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    visuals: BiomeVisuals,
    seed: number,
): void {
    if (visuals.horizonFeature === 'none') return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';

    if (visuals.horizonFeature === 'mountains' || visuals.horizonFeature === 'volcanoes') {
        // Procedural mountain/volcano silhouettes
        const count = 7;
        for (let i = 0; i < count; i++) {
            const cx = (i + 0.5) * w / count + Math.sin(seed + i * 3.7) * w * 0.05;
            const peakH = horizonY * (0.15 + Math.abs(Math.sin(seed * 1.3 + i * 2.1)) * 0.2);
            const baseW = w / count * 1.2;

            ctx.beginPath();
            ctx.moveTo(cx - baseW / 2, horizonY);
            ctx.lineTo(cx, horizonY - peakH);
            ctx.lineTo(cx + baseW / 2, horizonY);
            ctx.closePath();
            ctx.fill();
        }
    } else if (visuals.horizonFeature === 'trees') {
        // Scalloped tree canopy silhouette
        const count = 15;
        for (let i = 0; i < count; i++) {
            const cx = (i + 0.3) * w / count + Math.sin(seed + i * 2.3) * w * 0.02;
            const treeH = horizonY * (0.06 + Math.abs(Math.sin(seed + i * 1.7)) * 0.08);
            const treeW = w / count * 0.8;

            ctx.beginPath();
            ctx.arc(cx, horizonY - treeH * 0.3, treeW / 2, Math.PI, 0);
            ctx.lineTo(cx + treeW / 2, horizonY);
            ctx.lineTo(cx - treeW / 2, horizonY);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// --- Terrain ---

function drawTerrain(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    visuals: BiomeVisuals,
    _t: number,
): void {
    const terrainH = h - horizonY;

    // Base ground fill
    ctx.fillStyle = visuals.groundBase;
    ctx.fillRect(0, horizonY, w, terrainH);

    // Perspective stripes for depth
    const stripeCount = 12;
    for (let i = 0; i < stripeCount; i++) {
        const progress = i / stripeCount;
        const y = horizonY + progress * progress * terrainH; // Quadratic spacing for perspective
        const stripeH = (terrainH / stripeCount) * (1 + progress);

        ctx.fillStyle = i % 2 === 0 ? visuals.groundVariation : visuals.groundBase;
        ctx.globalAlpha = 0.3 + progress * 0.4;
        ctx.fillRect(0, y, w, stripeH);
    }
    ctx.globalAlpha = 1.0;
}

// --- Building slots ---

function drawBuildingSlots(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    region: Region,
    t: number,
): ColonySlotRect[] {
    const slotRects: ColonySlotRect[] = [];
    const totalSlots = region.buildingSlots;
    if (totalSlots === 0) return slotRects;

    // Building dimensions and positioning
    const groundY = horizonY + (h - horizonY) * 0.15;
    const slotW = Math.min(w / (totalSlots + 1.5), 120);
    const slotH = slotW * 1.2;
    const totalWidth = totalSlots * slotW + (totalSlots - 1) * slotW * 0.3;
    const startX = (w - totalWidth) / 2;
    const gap = slotW * 0.3;

    for (let i = 0; i < totalSlots; i++) {
        const sx = startX + i * (slotW + gap);
        const sy = groundY;

        const building = region.buildings.find(b => b.slotIndex === i);
        const rect: ColonySlotRect = {
            slotIndex: i,
            x: sx,
            y: sy,
            width: slotW,
            height: slotH,
            occupied: building !== null && building !== undefined,
        };
        slotRects.push(rect);

        if (building) {
            const bt = getBuildingType(building.typeId);
            drawBuilding(ctx, building.typeId, sx, sy, slotW, slotH, building.state, t);

            // Building name label
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.7;
            ctx.font = '10px "Share Tech Mono", "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(bt.name.toUpperCase(), sx + slotW / 2, sy + slotH + 14);

            if (building.state === 'constructing') {
                ctx.fillStyle = '#ffca28';
                ctx.fillText(`(${building.turnsRemaining} TURNS)`, sx + slotW / 2, sy + slotH + 26);
            }
            ctx.globalAlpha = 1.0;
        } else {
            // Empty slot
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#c0c8d8';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, slotW, slotH);
            ctx.setLineDash([]);

            // Plus marker
            const cx = sx + slotW / 2;
            const cy = sy + slotH / 2;
            ctx.fillStyle = '#c0c8d8';
            ctx.fillRect(cx - 8, cy - 1.5, 16, 3);
            ctx.fillRect(cx - 1.5, cy - 8, 3, 16);
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

    // Distribute colonists near buildings or wandering
    for (let i = 0; i < crew.length; i++) {
        const crewComp = crew[i].getComponent(CrewMemberComponent);
        if (!crewComp) continue;

        // Position: near a building or wandering in the colony area
        let dotX: number;
        let dotY: number;

        if (slotRects.length > 0) {
            // Assign to a slot area (cycle through occupied slots)
            const occupiedSlots = slotRects.filter(s => s.occupied);
            const targetSlot = occupiedSlots.length > 0
                ? occupiedSlots[i % occupiedSlots.length]
                : slotRects[i % slotRects.length];

            // Wander near the building
            const wanderX = Math.sin(t / 2000 + i * 1.7) * targetSlot.width * 0.4;
            const wanderY = Math.sin(t / 2500 + i * 2.3) * 8;
            dotX = targetSlot.x + targetSlot.width / 2 + wanderX;
            dotY = targetSlot.y + targetSlot.height + 20 + wanderY;
        } else {
            dotX = 100 + i * 20;
            dotY = 300;
        }

        const colour = ROLE_COLOURS[crewComp.role] ?? '#c0c8d8';
        const r = crewComp.isLeader ? 4 : 2.5;

        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(dotX, dotY, r, 0, Math.PI * 2);
        ctx.fill();

        // Leader gets a small crown marker
        if (crewComp.isLeader) {
            ctx.fillStyle = '#d4a020';
            ctx.font = '8px "Share Tech Mono"';
            ctx.textAlign = 'center';
            ctx.fillText('★', dotX, dotY - 6);
        }
    }
}

// --- Colony label ---

function drawColonyLabel(
    ctx: CanvasRenderingContext2D,
    w: number,
    region: Region,
): void {
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
        // Fade planet surface to black
        const phase = progress / 0.4;
        ctx.fillStyle = `rgba(3, 4, 10, ${phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (progress < 0.5) {
        ctx.fillStyle = '#03040a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        // Fade in colony scene
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
        // Fade colony scene to black
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
        // Fade back to planet surface handled by the planet surface draw
        const phase = (progress - 0.5) / 0.5;
        ctx.fillStyle = `rgba(3, 4, 10, ${1 - phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}
