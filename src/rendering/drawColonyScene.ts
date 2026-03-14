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
    groundTile: string;
    groundTileAlt: string;
    groundStroke: string;
    horizonFeature: 'mountains' | 'trees' | 'volcanoes' | 'none';
    starTint: string;
}

const BIOME_VISUALS: Partial<Record<BiomeName, BiomeVisuals>> = {
    'Temperate Plains': {
        skyTop: '#4a8ac0', skyBottom: '#c8d8e8',
        groundTile: '#5a8a4a', groundTileAlt: '#4a7a3a',
        groundStroke: 'rgba(0,0,0,0.08)',
        horizonFeature: 'trees', starTint: 'rgba(255, 220, 150, 0.25)',
    },
    'Arctic Wastes': {
        skyTop: '#5a7a90', skyBottom: '#b0c0d0',
        groundTile: '#c0d0e0', groundTileAlt: '#b0c0d0',
        groundStroke: 'rgba(0,0,0,0.05)',
        horizonFeature: 'mountains', starTint: 'rgba(255, 240, 200, 0.15)',
    },
    'Dense Jungle': {
        skyTop: '#3a6a5a', skyBottom: '#8aaa7a',
        groundTile: '#3a6a2a', groundTileAlt: '#2a5a2a',
        groundStroke: 'rgba(0,0,0,0.1)',
        horizonFeature: 'trees', starTint: 'rgba(255, 200, 100, 0.2)',
    },
    'Volcanic Highlands': {
        skyTop: '#4a2a1a', skyBottom: '#8a5a3a',
        groundTile: '#4a3a2a', groundTileAlt: '#3a2a2a',
        groundStroke: 'rgba(255,80,0,0.06)',
        horizonFeature: 'volcanoes', starTint: 'rgba(255, 150, 50, 0.3)',
    },
};

const DEFAULT_VISUALS: BiomeVisuals = {
    skyTop: '#4a8ac0', skyBottom: '#c8d8e8',
    groundTile: '#5a8a4a', groundTileAlt: '#4a7a3a',
    groundStroke: 'rgba(0,0,0,0.08)',
    horizonFeature: 'none', starTint: 'rgba(255, 220, 150, 0.2)',
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

    drawSky(ctx, w, horizonY, visuals, t);
    drawHorizonFeatures(ctx, w, horizonY, visuals, region.id);
    drawIsometricGround(ctx, w, h, horizonY, visuals);
    const slotRects = drawBuildingSlots(ctx, w, h, region, t);
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

    // Star glow
    const starX = w * 0.75;
    const starY = horizonY * 0.6;
    const pulse = 0.8 + 0.2 * Math.sin(t / 3000);
    const starGrad = ctx.createRadialGradient(starX, starY, 0, starX, starY, w * 0.12);
    starGrad.addColorStop(0, visuals.starTint.replace(/[\d.]+\)$/, `${(0.5 * pulse).toFixed(2)})`));
    starGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = starGrad;
    ctx.beginPath();
    ctx.arc(starX, starY, w * 0.12, 0, Math.PI * 2);
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

    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';

    if (visuals.horizonFeature === 'mountains' || visuals.horizonFeature === 'volcanoes') {
        for (let i = 0; i < 7; i++) {
            const cx = (i + 0.5) * w / 7 + Math.sin(seed + i * 3.7) * w * 0.04;
            const peakH = horizonY * (0.12 + Math.abs(Math.sin(seed * 1.3 + i * 2.1)) * 0.18);
            const baseW = w / 7 * 1.3;
            ctx.beginPath();
            ctx.moveTo(cx - baseW / 2, horizonY);
            ctx.lineTo(cx, horizonY - peakH);
            ctx.lineTo(cx + baseW / 2, horizonY);
            ctx.closePath();
            ctx.fill();
        }
    } else if (visuals.horizonFeature === 'trees') {
        for (let i = 0; i < 15; i++) {
            const cx = (i + 0.3) * w / 15 + Math.sin(seed + i * 2.3) * w * 0.02;
            const treeH = horizonY * (0.05 + Math.abs(Math.sin(seed + i * 1.7)) * 0.07);
            const treeW = w / 15 * 0.9;
            ctx.beginPath();
            ctx.arc(cx, horizonY - treeH * 0.3, treeW / 2, Math.PI, 0);
            ctx.lineTo(cx + treeW / 2, horizonY);
            ctx.lineTo(cx - treeW / 2, horizonY);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// --- Isometric ground ---

function drawIsometricGround(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    visuals: BiomeVisuals,
): void {
    // Fill below horizon with base ground colour
    ctx.fillStyle = visuals.groundTile;
    ctx.fillRect(0, horizonY, w, h - horizonY);

    // Draw isometric grid tiles for the colony area
    const centreX = w / 2;
    const centreY = horizonY + (h - horizonY) * 0.35;
    const gridSize = 5;

    for (let gy = -gridSize; gy <= gridSize; gy++) {
        for (let gx = -gridSize; gx <= gridSize; gx++) {
            const pos = gridToScreen(gx, gy, centreX, centreY);
            // Only draw if on screen
            if (pos.x < -TILE_WIDTH || pos.x > w + TILE_WIDTH) continue;
            if (pos.y < horizonY - TILE_HEIGHT || pos.y > h + TILE_HEIGHT) continue;

            const colour = (gx + gy) % 2 === 0 ? visuals.groundTile : visuals.groundTileAlt;
            drawIsometricTile(ctx, pos.x, pos.y, colour, visuals.groundStroke);
        }
    }
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
