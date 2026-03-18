// createScout.ts — Factory for scout ship entities.
// Renders a swept-wing human fighter silhouette with cyan colour scheme.
// Scouts are faster but smaller than the ESV-7, with reduced fog reveal.

import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { MovementComponent } from '../components/MovementComponent';
import { MoveConfirmComponent } from '../components/MoveConfirmComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import { VisibilitySourceComponent } from '../components/VisibilitySourceComponent';
import { ScoutDataComponent } from '../components/ScoutDataComponent';
import { ScoutDestructionComponent } from '../components/ScoutDestructionComponent';
import { CameraComponent } from '../components/CameraComponent';
import { ServiceLocator } from '../core/ServiceLocator';
import { drawMovementRangeDisc } from '../utils/drawMovementRangeDisc';
import {
    SCOUT_MOVEMENT_BUDGET,
    SCOUT_GLIDE_SPEED,
    SCOUT_HIT_RADIUS,
    SCOUT_HULL_LENGTH,
    SCOUT_HULL_WIDTH,
    SCOUT_FOG_DETAIL_RADIUS,
    SCOUT_FOG_BLIP_RADIUS,
    SCOUT_TRAIL_LENGTH,
} from '../data/constants';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Cyan colour for scout ships. */
const SCOUT_COLOUR = '#40c8c8';

/** Draw the movement trail — fading cyan dotted line through recent positions. */
function drawTrail(
    ctx: CanvasRenderingContext2D,
    scoutData: ScoutDataComponent,
    currentX: number,
    currentY: number,
): void {
    const positions = scoutData.trailPositions;
    if (positions.length === 0) return;

    ctx.save();
    ctx.setLineDash([8, 12]);
    ctx.lineWidth = 2;

    for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const nextPos = i < positions.length - 1 ? positions[i + 1] : { x: currentX, y: currentY };

        const alpha = 0.08 + (i / positions.length) * 0.15;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(nextPos.x, nextPos.y);
        ctx.strokeStyle = `rgba(64, 200, 200, ${alpha.toFixed(3)})`;
        ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
}

/** Draw the scout ship. */
function drawScout(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
): void {
    const t = performance.now();
    const selectable = entity.getComponent(SelectableComponent);
    const movement = entity.getComponent(MovementComponent);
    const scoutData = entity.getComponent(ScoutDataComponent);
    const hovered = selectable?.hovered ?? false;
    const selected = selectable?.selected ?? false;

    // --- Movement trail ---
    if (scoutData) {
        drawTrail(ctx, scoutData, x, y);
    }

    // --- Dotted line to target while moving ---
    if (movement && movement.moving && movement.targetX !== null && movement.targetY !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([16, 12]);
        ctx.moveTo(x, y);
        ctx.lineTo(movement.targetX, movement.targetY);
        ctx.strokeStyle = 'rgba(64, 200, 200, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.setLineDash([]);

        // Target marker — small cross
        const tx = movement.targetX;
        const ty = movement.targetY;
        const cs = 14;
        ctx.beginPath();
        ctx.moveTo(tx - cs, ty - cs);
        ctx.lineTo(tx + cs, ty + cs);
        ctx.moveTo(tx + cs, ty - cs);
        ctx.lineTo(tx - cs, ty + cs);
        ctx.strokeStyle = 'rgba(64, 200, 200, 0.6)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.restore();
    }

    // --- Waypoint queue markers ---
    if (movement && movement.waypointQueue.length > 0) {
        ctx.save();
        ctx.setLineDash([8, 10]);
        ctx.lineWidth = 2;
        let prevX = movement.targetX ?? x;
        let prevY = movement.targetY ?? y;
        for (const wp of movement.waypointQueue) {
            ctx.beginPath();
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(wp.x, wp.y);
            ctx.strokeStyle = 'rgba(64, 200, 200, 0.2)';
            ctx.stroke();

            // Small diamond at each waypoint
            ctx.beginPath();
            ctx.moveTo(wp.x, wp.y - 8);
            ctx.lineTo(wp.x + 8, wp.y);
            ctx.lineTo(wp.x, wp.y + 8);
            ctx.lineTo(wp.x - 8, wp.y);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(64, 200, 200, 0.35)';
            ctx.lineWidth = 2;
            ctx.stroke();

            prevX = wp.x;
            prevY = wp.y;
        }
        ctx.setLineDash([]);
        ctx.restore();
    }

    // --- Cursor preview line (selected, idle) ---
    if (selected && selectable && movement && !movement.moving && movement.budgetRemaining > 0) {
        const mcx = selectable.cursorX;
        const mcy = selectable.cursorY;
        const pdx = mcx - x;
        const pdy = mcy - y;
        const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
        const minDist = (selectable.hitRadius) + 8;

        if (pDist >= minDist) {
            let endX = mcx;
            let endY = mcy;
            if (pDist > movement.budgetRemaining) {
                const scale = movement.budgetRemaining / pDist;
                endX = x + pdx * scale;
                endY = y + pdy * scale;
            }

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([16, 12]);
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = 'rgba(64, 200, 200, 0.25)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.setLineDash([]);

            const cs = 14;
            ctx.beginPath();
            ctx.moveTo(endX - cs, endY - cs);
            ctx.lineTo(endX + cs, endY + cs);
            ctx.moveTo(endX + cs, endY - cs);
            ctx.lineTo(endX - cs, endY + cs);
            ctx.strokeStyle = 'rgba(64, 200, 200, 0.4)';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.restore();
        }
    }

    // --- Pending move marker (tap-to-confirm on mobile) ---
    const moveConfirm = entity.getComponent(MoveConfirmComponent);
    if (selected && movement && !movement.moving && moveConfirm) {
        moveConfirm.renderMarker(ctx, x, y, movement.budgetRemaining);
    }

    // --- Movement range disc ---
    if (selected && movement) {
        drawMovementRangeDisc(ctx, x, y, movement.displayBudget, movement.budgetMax);
    }

    // --- Scan radius visualisation (only when selected, not moving) ---
    if (selected && !movement?.moving) {
        const world = ServiceLocator.get<World>('world');
        const cameraEntity = world.getEntityByName('camera');
        const camera = cameraEntity?.getComponent(CameraComponent);
        const s = camera ? 1 / camera.scale : 1;

        ctx.beginPath();
        ctx.arc(x, y, SCOUT_FOG_DETAIL_RADIUS, 0, Math.PI * 2);
        ctx.setLineDash([12 * s, 8 * s]);
        ctx.strokeStyle = 'rgba(64, 200, 200, 0.15)';
        ctx.lineWidth = 2 * s;
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(x, y, SCOUT_FOG_BLIP_RADIUS, 0, Math.PI * 2);
        ctx.setLineDash([16 * s, 12 * s]);
        ctx.strokeStyle = 'rgba(64, 200, 200, 0.08)';
        ctx.lineWidth = 1.5 * s;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // --- Hover highlight ring (cyan) ---
    if (hovered) {
        ctx.beginPath();
        ctx.arc(x, y, SCOUT_HIT_RADIUS + 16, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(64, 200, 200, 0.5)';
        ctx.lineWidth = 5;
        ctx.stroke();

        const hoverGlow = ctx.createRadialGradient(
            x, y, SCOUT_HIT_RADIUS,
            x, y, SCOUT_HIT_RADIUS + 40,
        );
        hoverGlow.addColorStop(0, 'rgba(64, 200, 200, 0.15)');
        hoverGlow.addColorStop(1, 'rgba(64, 200, 200, 0)');
        ctx.fillStyle = hoverGlow;
        ctx.beginPath();
        ctx.arc(x, y, SCOUT_HIT_RADIUS + 40, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Selection ring (cyan, solid) ---
    if (selected && !hovered) {
        ctx.beginPath();
        ctx.arc(x, y, SCOUT_HIT_RADIUS + 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(64, 200, 200, 0.4)';
        ctx.lineWidth = 4;
        ctx.stroke();

        const selGlow = ctx.createRadialGradient(
            x, y, SCOUT_HIT_RADIUS,
            x, y, SCOUT_HIT_RADIUS + 36,
        );
        selGlow.addColorStop(0, 'rgba(64, 200, 200, 0.1)');
        selGlow.addColorStop(1, 'rgba(64, 200, 200, 0)');
        ctx.fillStyle = selGlow;
        ctx.beginPath();
        ctx.arc(x, y, SCOUT_HIT_RADIUS + 36, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const HL = SCOUT_HULL_LENGTH;
    const HW = SCOUT_HULL_WIDTH;

    // --- Twin engine glows (at the rear) ---
    const enginePulse = 0.7 + 0.3 * Math.sin(t / 250);
    for (const side of [-1, 1]) {
        const ey = side * HW * 0.4;
        const engineGlow = ctx.createRadialGradient(
            -HL - 4, ey, 0,
            -HL - 4, ey, 24,
        );
        engineGlow.addColorStop(0, `rgba(64, 200, 200, ${(0.6 * enginePulse).toFixed(3)})`);
        engineGlow.addColorStop(0.5, `rgba(40, 160, 180, ${(0.2 * enginePulse).toFixed(3)})`);
        engineGlow.addColorStop(1, 'rgba(40, 160, 180, 0)');
        ctx.fillStyle = engineGlow;
        ctx.beginPath();
        ctx.arc(-HL - 4, ey, 24, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Hull (swept-wing fighter silhouette) ---
    ctx.beginPath();
    ctx.moveTo(HL, 0);                           // nose tip
    ctx.lineTo(HL * 0.4, -HW * 0.3);            // upper forward
    ctx.lineTo(-HL * 0.1, -HW * 0.5);           // upper mid
    ctx.lineTo(-HL * 0.6, -HW);                  // upper wing tip
    ctx.lineTo(-HL, -HW * 0.5);                  // rear upper
    ctx.lineTo(-HL * 0.7, -HW * 0.2);           // rear notch upper
    ctx.lineTo(-HL * 0.7, HW * 0.2);            // rear notch lower
    ctx.lineTo(-HL, HW * 0.5);                   // rear lower
    ctx.lineTo(-HL * 0.6, HW);                   // lower wing tip
    ctx.lineTo(-HL * 0.1, HW * 0.5);            // lower mid
    ctx.lineTo(HL * 0.4, HW * 0.3);             // lower forward
    ctx.closePath();

    // Hull gradient: teal-cyan
    const hullGrad = ctx.createLinearGradient(
        -HL, -HW,
        HL * 0.5, HW,
    );
    hullGrad.addColorStop(0, '#1a3a3a');
    hullGrad.addColorStop(0.4, '#2a5a5a');
    hullGrad.addColorStop(0.7, '#245050');
    hullGrad.addColorStop(1, '#102828');
    ctx.fillStyle = hullGrad;
    ctx.fill();

    // Hull outline — cyan
    ctx.strokeStyle = `${SCOUT_COLOUR}66`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // --- Cockpit canopy (bright cyan dot at the nose) ---
    const cockpitGlow = ctx.createRadialGradient(
        HL * 0.55, 0, 0,
        HL * 0.55, 0, 8,
    );
    cockpitGlow.addColorStop(0, 'rgba(120, 230, 230, 0.8)');
    cockpitGlow.addColorStop(1, 'rgba(120, 230, 230, 0)');
    ctx.fillStyle = cockpitGlow;
    ctx.beginPath();
    ctx.arc(HL * 0.55, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Small canopy circle
    ctx.beginPath();
    ctx.arc(HL * 0.55, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180, 255, 255, 0.9)';
    ctx.fill();

    // --- Wingtip running lights (blinking red/green) ---
    const blink = Math.sin(t / 500) > 0 ? 1 : 0.2;
    // Green on starboard (right/lower in standard orientation)
    ctx.beginPath();
    ctx.arc(-HL * 0.6, HW, 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(50, 255, 50, ${blink.toFixed(2)})`;
    ctx.fill();
    // Red on port (left/upper)
    ctx.beginPath();
    ctx.arc(-HL * 0.6, -HW, 2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 50, 50, ${blink.toFixed(2)})`;
    ctx.fill();

    ctx.restore();
}

/** Update trail positions when the scout moves. */
function updateTrail(scoutData: ScoutDataComponent, x: number, y: number): void {
    const trail = scoutData.trailPositions;
    const last = trail.length > 0 ? trail[trail.length - 1] : null;

    // Only add if position changed significantly
    if (!last || Math.abs(x - last.x) > 10 || Math.abs(y - last.y) > 10) {
        trail.push({ x, y });
        if (trail.length > SCOUT_TRAIL_LENGTH) {
            trail.shift();
        }
    }
}

export function createScout(
    world: World,
    name: string,
    displayName: string,
    pilotEntityId: number,
    pilotName: string,
    x: number,
    y: number,
): Entity {
    const entity = world.createEntity(name);

    entity.addComponent(new TransformComponent(x, y));
    entity.addComponent(new MovementComponent(SCOUT_MOVEMENT_BUDGET, SCOUT_GLIDE_SPEED));
    entity.addComponent(new SelectableComponent(SCOUT_HIT_RADIUS));
    entity.addComponent(new MoveConfirmComponent());
    entity.addComponent(new VisibilitySourceComponent(SCOUT_FOG_DETAIL_RADIUS, SCOUT_FOG_BLIP_RADIUS, true));

    const scoutData = new ScoutDataComponent(displayName, pilotEntityId, pilotName);
    entity.addComponent(scoutData);
    entity.addComponent(new ScoutDestructionComponent());

    entity.addComponent(new RenderComponent('world', (ctx, ex, ey, angle) => {
        updateTrail(scoutData, ex, ey);
        drawScout(entity, ctx, ex, ey, angle);
    }));

    return entity;
}
