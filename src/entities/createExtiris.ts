// createExtiris.ts — Factory for the Extiris hunter ship entity.
// Renders a dark angular silhouette with crimson sensor glow, scanner sweep,
// and patrol trail. Visibility respects fog of war zones.

import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { ExtirisAIComponent } from '../components/ExtirisAIComponent';
import { ExtirisMovementComponent } from '../components/ExtirisMovementComponent';
import { FogOfWarComponent, getEntityFogZone } from '../components/FogOfWarComponent';
import { ServiceLocator } from '../core/ServiceLocator';
import { EXTIRIS_SPAWN_RADIUS, EXTIRIS_SENSOR_RADIUS } from '../data/constants';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Hull dimensions (world units) */
const HULL_LENGTH = 48;
const HULL_WIDTH = 28;

/** Draw the Extiris as a pulsing red blip (blip zone). */
function drawBlip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const t = performance.now();
    const pulse = 0.5 + 0.5 * Math.sin(t / 400);
    const radius = 6 + 4 * pulse;

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200, 30, 30, ${(0.6 + 0.4 * pulse).toFixed(3)})`;
    ctx.fill();

    // Glow
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
    glow.addColorStop(0, `rgba(200, 30, 30, ${(0.2 * pulse).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(200, 30, 30, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
    ctx.fill();
}

/** Draw the scanner sweep — rotating crimson cone. */
function drawScannerSweep(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const t = performance.now();
    const sweepAngle = (t / 2000) * Math.PI * 2; // Full rotation every 2s
    const arcWidth = Math.PI / 2; // 90° arc

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, EXTIRIS_SENSOR_RADIUS * 0.4, sweepAngle - arcWidth / 2, sweepAngle + arcWidth / 2);
    ctx.closePath();

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, EXTIRIS_SENSOR_RADIUS * 0.4);
    gradient.addColorStop(0, 'rgba(180, 20, 20, 0.08)');
    gradient.addColorStop(0.7, 'rgba(180, 20, 20, 0.03)');
    gradient.addColorStop(1, 'rgba(180, 20, 20, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
}

/** Draw patrol trail — faint red dotted lines between recent positions. */
function drawPatrolTrail(
    ctx: CanvasRenderingContext2D,
    ai: ExtirisAIComponent,
    currentX: number,
    currentY: number,
): void {
    const positions = ai.memory.visitedPositions;
    if (positions.length === 0) return;

    // Only show last 5 positions
    const recent = positions.slice(-5);

    ctx.save();
    ctx.setLineDash([8, 12]);
    ctx.lineWidth = 2;

    for (let i = 0; i < recent.length; i++) {
        const pos = recent[i];
        const nextPos = i < recent.length - 1 ? recent[i + 1] : { x: currentX, y: currentY };

        // Only render segments in visible fog zones
        const zone = getEntityFogZone(pos.x, pos.y);
        if (zone === 'hidden') continue;

        const alpha = 0.1 + (i / recent.length) * 0.15;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(nextPos.x, nextPos.y);
        ctx.strokeStyle = `rgba(180, 30, 30, ${alpha.toFixed(3)})`;
        ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
}

/** Draw the full Extiris ship (active zone). */
function drawFullShip(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    entity: Entity,
): void {
    const t = performance.now();
    const ai = entity.getComponent(ExtirisAIComponent);

    // Patrol trail
    if (ai) {
        drawPatrolTrail(ctx, ai, x, y);
    }

    // Scanner sweep
    drawScannerSweep(ctx, x, y);

    // Sensor radius — faint crimson circle
    ctx.beginPath();
    ctx.arc(x, y, EXTIRIS_SENSOR_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(140, 20, 20, 0.06)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Engine trail — cold blue-white
    const enginePulse = 0.6 + 0.4 * Math.sin(t / 250);
    const engineGlow = ctx.createRadialGradient(
        -HULL_LENGTH - 6, 0, 0,
        -HULL_LENGTH - 6, 0, 40,
    );
    engineGlow.addColorStop(0, `rgba(120, 160, 255, ${(0.5 * enginePulse).toFixed(3)})`);
    engineGlow.addColorStop(0.5, `rgba(80, 120, 200, ${(0.15 * enginePulse).toFixed(3)})`);
    engineGlow.addColorStop(1, 'rgba(80, 120, 200, 0)');
    ctx.fillStyle = engineGlow;
    ctx.beginPath();
    ctx.arc(-HULL_LENGTH - 6, 0, 40, 0, Math.PI * 2);
    ctx.fill();

    // Hull — 8-vertex elongated insectoid polygon (deep purple/black)
    ctx.beginPath();
    ctx.moveTo(HULL_LENGTH, 0);                            // nose
    ctx.lineTo(HULL_LENGTH * 0.5, -HULL_WIDTH * 0.35);    // upper forward
    ctx.lineTo(HULL_LENGTH * 0.1, -HULL_WIDTH * 0.7);     // upper mid spine
    ctx.lineTo(-HULL_LENGTH * 0.5, -HULL_WIDTH);           // upper wing tip
    ctx.lineTo(-HULL_LENGTH, -HULL_WIDTH * 0.3);           // rear upper
    ctx.lineTo(-HULL_LENGTH, HULL_WIDTH * 0.3);            // rear lower
    ctx.lineTo(-HULL_LENGTH * 0.5, HULL_WIDTH);            // lower wing tip
    ctx.lineTo(HULL_LENGTH * 0.1, HULL_WIDTH * 0.7);      // lower mid spine
    ctx.lineTo(HULL_LENGTH * 0.5, HULL_WIDTH * 0.35);     // lower forward
    ctx.closePath();

    // Hull gradient: deep purple-black
    const hullGrad = ctx.createLinearGradient(
        -HULL_LENGTH, -HULL_WIDTH,
        HULL_LENGTH * 0.5, HULL_WIDTH,
    );
    hullGrad.addColorStop(0, '#1a0a20');
    hullGrad.addColorStop(0.4, '#2d1038');
    hullGrad.addColorStop(0.7, '#200d28');
    hullGrad.addColorStop(1, '#0d0510');
    ctx.fillStyle = hullGrad;
    ctx.fill();

    // Hull outline — faint crimson
    ctx.strokeStyle = 'rgba(160, 30, 40, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eye — menacing red glow near nose
    const eyePulse = 0.5 + 0.5 * Math.sin(t / 600);
    const eyeGlow = ctx.createRadialGradient(
        HULL_LENGTH * 0.4, 0, 0,
        HULL_LENGTH * 0.4, 0, 14,
    );
    eyeGlow.addColorStop(0, `rgba(220, 30, 30, ${(0.7 * eyePulse).toFixed(3)})`);
    eyeGlow.addColorStop(1, 'rgba(220, 30, 30, 0)');
    ctx.fillStyle = eyeGlow;
    ctx.beginPath();
    ctx.arc(HULL_LENGTH * 0.4, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/** Draw ghost marker at last known position when Extiris is hidden. */
function drawGhostMarker(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
): void {
    try {
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const fog = gameState?.getComponent(FogOfWarComponent);
        if (!fog) return;

        const lastKnown = fog.getLastKnownPosition(entity.id);
        if (!lastKnown) return;

        // Determine ghost age from AI memory
        const ai = entity.getComponent(ExtirisAIComponent);
        const turnsSinceLastVisible = ai ? ai.memory.visitedPositions.length : 0;
        const fadeAlpha = Math.max(0, 0.3 - turnsSinceLastVisible * 0.06);
        if (fadeAlpha <= 0) return;

        const { x, y } = lastKnown;
        const t = performance.now();
        const pulse = 0.7 + 0.3 * Math.sin(t / 800);

        // Faint red silhouette
        ctx.save();
        ctx.globalAlpha = fadeAlpha * pulse;
        ctx.translate(x, y);

        ctx.beginPath();
        ctx.moveTo(HULL_LENGTH, 0);
        ctx.lineTo(HULL_LENGTH * 0.5, -HULL_WIDTH * 0.35);
        ctx.lineTo(HULL_LENGTH * 0.1, -HULL_WIDTH * 0.7);
        ctx.lineTo(-HULL_LENGTH * 0.5, -HULL_WIDTH);
        ctx.lineTo(-HULL_LENGTH, -HULL_WIDTH * 0.3);
        ctx.lineTo(-HULL_LENGTH, HULL_WIDTH * 0.3);
        ctx.lineTo(-HULL_LENGTH * 0.5, HULL_WIDTH);
        ctx.lineTo(HULL_LENGTH * 0.1, HULL_WIDTH * 0.7);
        ctx.lineTo(HULL_LENGTH * 0.5, HULL_WIDTH * 0.35);
        ctx.closePath();
        ctx.fillStyle = 'rgba(160, 20, 20, 0.5)';
        ctx.fill();

        ctx.restore();
    } catch {
        // Graceful degradation
    }
}

/** Record Extiris position in fog of war for ghost marker tracking. */
function recordFogPosition(entity: Entity, x: number, y: number): void {
    try {
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const fog = gameState?.getComponent(FogOfWarComponent);
        fog?.recordPosition(entity.id, x, y);
    } catch {
        // Graceful degradation
    }
}

/** Top-level draw function for the Extiris entity. */
function drawExtiris(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
): void {
    const zone = getEntityFogZone(x, y);

    if (zone === 'hidden') {
        // Draw ghost at last known position
        drawGhostMarker(entity, ctx);
        return;
    }

    // Record position for ghost marker when visible
    recordFogPosition(entity, x, y);

    if (zone === 'blip') {
        drawBlip(ctx, x, y);
        return;
    }

    // Active zone — full render
    drawFullShip(ctx, x, y, angle, entity);
}

export function createExtiris(world: World): Entity {
    const entity = world.createEntity('extiris');

    // Spawn at random angle on the outer ring
    const spawnAngle = Math.random() * Math.PI * 2;
    entity.addComponent(new TransformComponent(
        EXTIRIS_SPAWN_RADIUS * Math.cos(spawnAngle),
        EXTIRIS_SPAWN_RADIUS * Math.sin(spawnAngle),
    ));
    entity.addComponent(new ExtirisAIComponent());
    entity.addComponent(new ExtirisMovementComponent());
    entity.addComponent(new RenderComponent('world', (ctx, x, y, angle) => {
        drawExtiris(entity, ctx, x, y, angle);
    }));

    return entity;
}
