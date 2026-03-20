// createStation.ts — Factory for the abandoned Keth mining relay station.
// Orbits Dust as a moon (satellite orbit via OrbitComponent.parentEntityId).
// Cruciform shape: central hub + 4 solar panel arms. Renders in amber/gold
// palette with fog-aware visibility (hidden/blip/active states).

import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { OrbitComponent } from '../components/OrbitComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import { StationDataComponent } from '../components/StationDataComponent';
import { StationDiscoveryComponent } from '../components/StationDiscoveryComponent';
import { StationRepairComponent } from '../components/StationRepairComponent';
import { StationInfoUIComponent } from '../components/StationInfoUIComponent';
import { EventStateComponent } from '../components/EventStateComponent';
import { getEntityFogZone } from '../components/FogOfWarComponent';
import { ServiceLocator } from '../core/ServiceLocator';
import {
    STATION_ORBIT_RADIUS,
    STATION_ORBIT_SPEED,
    STATION_START_ANGLE,
    STATION_HIT_RADIUS,
} from '../data/constants';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

// ─── Cruciform station geometry ─────────────────────────────────────
//         │
//    ═════╪═════   solar panel arms (armLength × armWidth)
//         │
//         ●        central hub (hubRadius circle)
//         │
//    ═════╪═════
//         │

/** Central hub circle radius (world units). */
const HUB_RADIUS = 8;

/** Solar panel arm length from hub edge outward (world units). */
const ARM_LENGTH = 18;

/** Solar panel arm width (world units). */
const ARM_WIDTH = 5;

/** Overall bounding radius used for progress arc etc. */
const HULL_RADIUS = HUB_RADIUS + ARM_LENGTH; // 26

/** Number of debris particles. */
const DEBRIS_COUNT = 4;

/** Seeded debris positions (angle, distance from centre) — scaled for smaller station. */
const DEBRIS_OFFSETS = [
    { angle: 0.5, dist: 34, size: 2 },
    { angle: 1.8, dist: 38, size: 1.5 },
    { angle: 3.2, dist: 32, size: 2.5 },
    { angle: 4.9, dist: 36, size: 1.5 },
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

/** Draw a single solar panel arm as a filled rectangle at the given angle. */
function drawArm(
    ctx: CanvasRenderingContext2D,
    angle: number,
    hubR: number,
    length: number,
    width: number,
): void {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const startDist = hubR;
    const endDist = hubR + length;
    // Perpendicular offset for width
    const hw = width / 2;
    const px = -sin * hw;
    const py = cos * hw;

    ctx.beginPath();
    ctx.moveTo(cos * startDist + px, sin * startDist + py);
    ctx.lineTo(cos * endDist + px, sin * endDist + py);
    ctx.lineTo(cos * endDist - px, sin * endDist - py);
    ctx.lineTo(cos * startDist - px, sin * startDist - py);
    ctx.closePath();
}

/** Arm angles: up, right, down, left (0, π/2, π, 3π/2). */
const ARM_ANGLES = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];

/** Draw discovered (damaged) station — 2 of 4 arms intact. */
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

    // Central hub — dark amber circle
    const hubGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, HUB_RADIUS);
    hubGrad.addColorStop(0, '#6a4a20');
    hubGrad.addColorStop(1, '#3a2810');
    ctx.beginPath();
    ctx.arc(0, 0, HUB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(160, 120, 40, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Intact arms (up + left only — right + down are broken)
    for (const ai of [0, 3]) {
        drawArm(ctx, ARM_ANGLES[ai], HUB_RADIUS, ARM_LENGTH, ARM_WIDTH);
        ctx.fillStyle = '#4a3418';
        ctx.fill();
        ctx.strokeStyle = 'rgba(160, 120, 40, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Broken arm stubs (right + down — half-length, ragged)
    for (const ai of [1, 2]) {
        drawArm(ctx, ARM_ANGLES[ai], HUB_RADIUS, ARM_LENGTH * 0.4, ARM_WIDTH);
        ctx.fillStyle = 'rgba(60, 40, 20, 0.5)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(100, 80, 40, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Flickering amber lights at tips of intact arms
    for (const ai of [0, 3]) {
        const angle = ARM_ANGLES[ai];
        const tipDist = HUB_RADIUS + ARM_LENGTH;
        const lx = Math.cos(angle) * tipDist;
        const ly = Math.sin(angle) * tipDist;
        const flicker = 0.3 + 0.7 * Math.sin(t / (400 + ai * 100) + ai * 2);
        ctx.fillStyle = `rgba(210, 160, 60, ${(flicker * 0.6).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
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

/** Draw repaired station — bright, operational, all 4 arms intact. */
function drawRepaired(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    t: number,
): void {
    ctx.save();
    ctx.translate(x, y);

    // Central hub — brighter amber
    const hubGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, HUB_RADIUS);
    hubGrad.addColorStop(0, '#8a6a30');
    hubGrad.addColorStop(1, '#5a3a18');
    ctx.beginPath();
    ctx.arc(0, 0, HUB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(200, 160, 60, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // All 4 arms intact
    for (let ai = 0; ai < 4; ai++) {
        drawArm(ctx, ARM_ANGLES[ai], HUB_RADIUS, ARM_LENGTH, ARM_WIDTH);
        ctx.fillStyle = '#5a3a18';
        ctx.fill();
        ctx.strokeStyle = 'rgba(200, 160, 60, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // Steady amber lights at all 4 arm tips
    for (let ai = 0; ai < 4; ai++) {
        const angle = ARM_ANGLES[ai];
        const tipDist = HUB_RADIUS + ARM_LENGTH;
        const lx = Math.cos(angle) * tipDist;
        const ly = Math.sin(angle) * tipDist;
        ctx.fillStyle = 'rgba(210, 160, 60, 0.7)';
        ctx.beginPath();
        ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Signal pulse ring — expanding outward every 3s
    const cycleTime = 3000;
    const phase = (t % cycleTime) / cycleTime;
    const ringRadius = HULL_RADIUS + phase * 50;
    const ringAlpha = 0.3 * (1 - phase);
    ctx.beginPath();
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(212, 160, 64, ${ringAlpha.toFixed(3)})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
}

/** Draw a teal radar beacon — pulsing rings + central dot. Ignores fog. */
function drawSignalBeacon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const t = performance.now();

    ctx.save();

    // Two concentric expanding rings at staggered phases
    ctx.setLineDash([8, 12]);
    ctx.lineWidth = 3;
    for (const offset of [0, 2000]) {
        const phase = ((t + offset) % 4000) / 4000;
        const radius = phase * 200;
        const alpha = 0.8 * (1 - phase);
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(80, 200, 180, ${alpha.toFixed(3)})`;
        ctx.stroke();
    }
    ctx.setLineDash([]);

    // Central dot with gentle pulse
    const pulse = 0.6 + 0.4 * Math.sin(t / 800);
    const dotRadius = 5;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, dotRadius * 3);
    glow.addColorStop(0, `rgba(80, 200, 180, ${(0.9 * pulse).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(80, 200, 180, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, dotRadius * 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(140, 230, 210, ${(1.0 * pulse).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/** Top-level draw function, dispatches based on fog zone and repair state. */
function drawStation(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const stationData = entity.getComponent(StationDataComponent);
    const selectable = entity.getComponent(SelectableComponent);

    // Hover glow (amber, matches station palette — only when discovered)
    if (selectable?.hovered && stationData?.discovered) {
        ctx.beginPath();
        ctx.arc(x, y, HULL_RADIUS + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(212, 160, 64, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const glowGrad = ctx.createRadialGradient(x, y, HULL_RADIUS + 2, x, y, HULL_RADIUS + 14);
        glowGrad.addColorStop(0, 'rgba(212, 160, 64, 0.15)');
        glowGrad.addColorStop(1, 'rgba(212, 160, 64, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, HULL_RADIUS + 14, 0, Math.PI * 2);
        ctx.fill();
    }

    // Signal beacon — draws before fog check (sensor data, not visual contact)
    try {
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const eventState = gameState?.getComponent(EventStateComponent);
        if (eventState?.hasSeen('station_signal_hint') && !stationData?.discovered) {
            drawSignalBeacon(ctx, x, y);
            return;
        }
    } catch {
        // Graceful no-draw if services unavailable
    }

    const zone = getEntityFogZone(x, y);
    if (zone === 'hidden') return;

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

    // Look up Dust planet to orbit as a moon
    const dust = world.getEntityByName('dust');
    if (!dust) {
        console.warn('createStation: Dust entity not found — station will orbit origin');
    }
    const dustTransform = dust?.getComponent(TransformComponent);
    const cx = dustTransform?.x ?? 0;
    const cy = dustTransform?.y ?? 0;

    // Initial position relative to Dust
    const startX = cx + STATION_ORBIT_RADIUS * Math.cos(STATION_START_ANGLE);
    const startY = cy + STATION_ORBIT_RADIUS * Math.sin(STATION_START_ANGLE);

    entity.addComponent(new TransformComponent(startX, startY));
    const orbit = new OrbitComponent(cx, cy, STATION_ORBIT_RADIUS, STATION_ORBIT_SPEED);
    orbit.angle = STATION_START_ANGLE;
    if (dust) {
        orbit.parentEntityId = dust.id;
    }
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
