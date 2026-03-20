// createStation.ts — Factory for the abandoned Keth mining relay station.
// Orbits at Dust's radius, offset ~1.2 radians ahead. Renders in amber/gold
// palette with fog-aware visibility (hidden/blip/active states).

import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { OrbitComponent } from '../components/OrbitComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import { StationDataComponent } from '../components/StationDataComponent';
import { StationDiscoveryComponent } from '../components/StationDiscoveryComponent';
import { StationRepairComponent } from '../components/StationRepairComponent';
import { StationInfoUIComponent } from '../components/StationInfoUIComponent';
import { getEntityFogZone } from '../components/FogOfWarComponent';
import {
    STATION_ORBIT_RADIUS,
    STATION_ORBIT_SPEED,
    STATION_START_ANGLE,
    STATION_HIT_RADIUS,
} from '../data/constants';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Hexagonal hull radius (world units). */
const HULL_RADIUS = 50;

/** Number of debris particles. */
const DEBRIS_COUNT = 4;

/** Seeded debris positions (angle, distance from centre). */
const DEBRIS_OFFSETS = [
    { angle: 0.5, dist: 65, size: 3 },
    { angle: 1.8, dist: 72, size: 2 },
    { angle: 3.2, dist: 60, size: 4 },
    { angle: 4.9, dist: 68, size: 2.5 },
];

/** Draw the station as a pulsing amber blip (blip zone). */
function drawBlip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const t = performance.now();
    const pulse = 0.6 + 0.4 * Math.sin(t / 900);
    const radius = 5 + 3 * pulse;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(212, 160, 64, ${(0.5 + 0.4 * pulse).toFixed(3)})`;
    ctx.fill();

    // Glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.5);
    glow.addColorStop(0, `rgba(212, 160, 64, ${(0.15 * pulse).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(212, 160, 64, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
    ctx.fill();
}

/** Draw a hexagonal hull outline. */
function drawHexHull(
    ctx: CanvasRenderingContext2D,
    r: number,
): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const px = r * Math.cos(angle);
        const py = r * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

/** Get hex vertex position. */
function hexVertex(r: number, index: number): { x: number; y: number } {
    const angle = (Math.PI / 3) * index - Math.PI / 6;
    return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}

/** Draw discovered (damaged) station. */
function drawDiscovered(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
): void {
    ctx.save();
    ctx.translate(x, y);

    // Debris particles orbiting slowly
    for (let i = 0; i < DEBRIS_COUNT; i++) {
        const d = DEBRIS_OFFSETS[i];
        const orbAngle = d.angle + t / 8000;
        const dx = d.dist * Math.cos(orbAngle);
        const dy = d.dist * Math.sin(orbAngle);
        ctx.fillStyle = 'rgba(120, 110, 100, 0.5)';
        ctx.beginPath();
        ctx.arc(dx, dy, d.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Hull — dark amber hexagonal platform
    drawHexHull(ctx, HULL_RADIUS);
    const hullGrad = ctx.createLinearGradient(-HULL_RADIUS, -HULL_RADIUS, HULL_RADIUS, HULL_RADIUS);
    hullGrad.addColorStop(0, '#6a4a20');
    hullGrad.addColorStop(1, '#3a2810');
    ctx.fillStyle = hullGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 120, 40, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Damaged struts — 2 lines extending from hull with gaps
    ctx.strokeStyle = 'rgba(100, 80, 40, 0.4)';
    ctx.lineWidth = 2;
    const v0 = hexVertex(HULL_RADIUS, 0);
    ctx.beginPath();
    ctx.moveTo(v0.x, v0.y);
    ctx.lineTo(v0.x + 20, v0.y + 12);
    ctx.stroke();
    const v3 = hexVertex(HULL_RADIUS, 3);
    ctx.beginPath();
    ctx.moveTo(v3.x, v3.y);
    ctx.lineTo(v3.x - 18, v3.y - 10);
    ctx.stroke();

    // Flickering amber lights at 3 vertices
    for (const vi of [1, 3, 5]) {
        const v = hexVertex(HULL_RADIUS * 0.85, vi);
        const flicker = 0.3 + 0.7 * Math.sin(t / (400 + vi * 100) + vi * 2);
        ctx.fillStyle = `rgba(210, 160, 60, ${(flicker * 0.6).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(v.x, v.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/** Draw repairing station — adds amber progress arc. */
function drawRepairing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
    stationData: StationDataComponent,
): void {
    drawDiscovered(ctx, x, y, t);

    ctx.save();
    ctx.translate(x, y);

    // Progress arc
    const progress = (stationData.repairTurnsTotal - stationData.repairTurnsRemaining) / stationData.repairTurnsTotal;
    const endAngle = -Math.PI / 2 + progress * Math.PI * 2;

    ctx.beginPath();
    ctx.arc(0, 0, HULL_RADIUS + 8, -Math.PI / 2, endAngle);
    ctx.strokeStyle = '#d4a040';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Sparkle at arc endpoint
    const sparkX = (HULL_RADIUS + 8) * Math.cos(endAngle);
    const sparkY = (HULL_RADIUS + 8) * Math.sin(endAngle);
    const sparkPulse = 0.5 + 0.5 * Math.sin(t / 200);
    ctx.fillStyle = `rgba(255, 220, 100, ${(0.6 + 0.4 * sparkPulse).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, 4 + 2 * sparkPulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/** Draw repaired station — bright, operational. */
function drawRepaired(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
): void {
    ctx.save();
    ctx.translate(x, y);

    // Hull — brighter amber
    drawHexHull(ctx, HULL_RADIUS);
    const hullGrad = ctx.createLinearGradient(-HULL_RADIUS, -HULL_RADIUS, HULL_RADIUS, HULL_RADIUS);
    hullGrad.addColorStop(0, '#8a6a30');
    hullGrad.addColorStop(1, '#5a3a18');
    ctx.fillStyle = hullGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 160, 60, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // All 6 vertex lights steady
    for (let vi = 0; vi < 6; vi++) {
        const v = hexVertex(HULL_RADIUS * 0.85, vi);
        ctx.fillStyle = 'rgba(210, 160, 60, 0.7)';
        ctx.beginPath();
        ctx.arc(v.x, v.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Signal pulse ring — expanding outward every 3s
    const cycleTime = 3000;
    const phase = (t % cycleTime) / cycleTime;
    const ringRadius = HULL_RADIUS + phase * 80;
    const ringAlpha = 0.3 * (1 - phase);
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(212, 160, 64, ${ringAlpha.toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
}

/** Top-level draw function, dispatches based on fog zone and repair state. */
function drawStation(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const zone = getEntityFogZone(x, y);
    if (zone === 'hidden') return;

    const stationData = entity.getComponent(StationDataComponent);

    if (zone === 'blip') {
        // Only draw blip if discovered (otherwise hidden in fog)
        if (stationData?.discovered) {
            drawBlip(ctx, x, y);
        }
        return;
    }

    // Active zone
    if (!stationData) return;
    const t = performance.now();

    switch (stationData.repairState) {
        case 'undiscovered':
        case 'discovered':
            drawDiscovered(ctx, x, y, t);
            break;
        case 'repairing':
            drawRepairing(ctx, x, y, t, stationData);
            break;
        case 'repaired':
            drawRepaired(ctx, x, y, t);
            break;
    }
}

export function createStation(world: World): Entity {
    const entity = world.createEntity('kethRelay');

    // Initial position on orbit
    const startX = STATION_ORBIT_RADIUS * Math.cos(STATION_START_ANGLE);
    const startY = STATION_ORBIT_RADIUS * Math.sin(STATION_START_ANGLE);

    entity.addComponent(new TransformComponent(startX, startY));
    const orbit = new OrbitComponent(0, 0, STATION_ORBIT_RADIUS, STATION_ORBIT_SPEED);
    orbit.angle = STATION_START_ANGLE;
    entity.addComponent(orbit);
    entity.addComponent(new SelectableComponent(STATION_HIT_RADIUS));
    entity.addComponent(new StationDataComponent());
    entity.addComponent(new StationDiscoveryComponent());
    entity.addComponent(new StationRepairComponent());
    entity.addComponent(new StationInfoUIComponent());
    entity.addComponent(new RenderComponent('world', (ctx, x, y) => {
        drawStation(entity, ctx, x, y);
    }));

    return entity;
}
