// createShip.ts — Factory for the Ark Salvage ship entity.
// Renders an angular alien hull with engine glow, movement range disc,
// and hover highlight. Ship rotates to face its direction of travel.
// Movement range shown as a gradient disc with edge ring when selected,
// smoothly shrinking as budget is spent. Colour shifts green → red.

import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { MovementComponent } from '../components/MovementComponent';
import { MoveConfirmComponent } from '../components/MoveConfirmComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import { ShipInfoUIComponent } from '../components/ShipInfoUIComponent';
import { VisibilitySourceComponent } from '../components/VisibilitySourceComponent';
import { CameraComponent } from '../components/CameraComponent';
import { OrbitComponent } from '../components/OrbitComponent';
import { EngineStateComponent } from '../components/EngineStateComponent';
import { EngineRepairComponent } from '../components/EngineRepairComponent';
import { ServiceLocator } from '../core/ServiceLocator';
import { drawMovementRangeDisc } from '../utils/drawMovementRangeDisc';
import { FOG_DETAIL_RADIUS, FOG_BLIP_RADIUS, SHIP_ORBIT_RADIUS, SHIP_ORBIT_SPEED, SHIP_START_ANGLE } from '../data/constants';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Movement budget in world units per turn */
const MOVEMENT_BUDGET = 800;

/** Glide speed in world units per second */
const GLIDE_SPEED = 500;

/** Hit radius for hover/click detection */
const HIT_RADIUS = 72;

/** Hull half-length (tip to centre) */
const HULL_LENGTH = 56;

/** Hull half-width at the widest point */
const HULL_WIDTH = 32;

/** Draw the ship hull, engine glow, range circle, and hover highlight. */
function drawShip(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
): void {
    const t = performance.now();
    const selectable = entity.getComponent(SelectableComponent);
    const movement = entity.getComponent(MovementComponent);
    const engineState = entity.getComponent(EngineStateComponent);
    const engineStatus = engineState?.engineState ?? 'online'; // default online for backwards compat
    const hovered = selectable?.hovered ?? false;
    const selected = selectable?.selected ?? false;

    // --- Dotted line to target while moving ---
    if (movement && movement.moving && movement.targetX !== null && movement.targetY !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([24, 16]);
        ctx.moveTo(x, y);
        ctx.lineTo(movement.targetX, movement.targetY);
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.4)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.setLineDash([]);

        // Target marker — small cross at destination
        const tx = movement.targetX;
        const ty = movement.targetY;
        const cs = 20; // cross half-size
        ctx.beginPath();
        ctx.moveTo(tx - cs, ty - cs);
        ctx.lineTo(tx + cs, ty + cs);
        ctx.moveTo(tx + cs, ty - cs);
        ctx.lineTo(tx - cs, ty + cs);
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.6)';
        ctx.lineWidth = 6;
        ctx.stroke();
        ctx.restore();
    }

    // --- Cursor preview line (selected, idle, clamped to budget range) ---
    if (selected && selectable && movement && !movement.moving && movement.budgetRemaining > 0) {
        const mcx = selectable.cursorX;
        const mcy = selectable.cursorY;
        const pdx = mcx - x;
        const pdy = mcy - y;
        const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
        const minDist = (selectable.hitRadius ?? 0) + 8;

        if (pDist >= minDist) {
            // Clamp endpoint to budget radius if cursor is beyond range
            let endX = mcx;
            let endY = mcy;
            if (pDist > movement.budgetRemaining) {
                const scale = movement.budgetRemaining / pDist;
                endX = x + pdx * scale;
                endY = y + pdy * scale;
            }

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([24, 16]);
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = 'rgba(255, 220, 120, 0.25)';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.setLineDash([]);

            // Cross at clamped endpoint
            const cs = 20;
            ctx.beginPath();
            ctx.moveTo(endX - cs, endY - cs);
            ctx.lineTo(endX + cs, endY + cs);
            ctx.moveTo(endX + cs, endY - cs);
            ctx.lineTo(endX - cs, endY + cs);
            ctx.strokeStyle = 'rgba(255, 220, 120, 0.4)';
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.restore();
        }
    }

    // --- Planned waypoint route (queued via ctrl+right-click) ---
    if (movement && movement.waypointQueue.length > 0) {
        ctx.save();
        ctx.setLineDash([16, 12]);
        ctx.lineWidth = 3;
        let prevX = movement.targetX ?? x;
        let prevY = movement.targetY ?? y;
        for (const wp of movement.waypointQueue) {
            ctx.beginPath();
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(wp.x, wp.y);
            ctx.strokeStyle = 'rgba(255, 220, 120, 0.25)';
            ctx.stroke();

            // Diamond marker at each waypoint
            ctx.beginPath();
            ctx.moveTo(wp.x, wp.y - 10);
            ctx.lineTo(wp.x + 10, wp.y);
            ctx.lineTo(wp.x, wp.y + 10);
            ctx.lineTo(wp.x - 10, wp.y);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(255, 220, 120, 0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();

            prevX = wp.x;
            prevY = wp.y;
        }
        ctx.setLineDash([]);
        ctx.restore();
    }

    // --- Pending move marker (tap-to-confirm on mobile) ---
    const moveConfirm = entity.getComponent(MoveConfirmComponent);
    if (selected && movement && !movement.moving && moveConfirm) {
        moveConfirm.renderMarker(ctx, x, y, movement.budgetRemaining);
    }

    // --- Movement range disc (visible when selected, engines online) ---
    if (selected && movement && engineStatus === 'online') {
        drawMovementRangeDisc(ctx, x, y, movement.displayBudget, movement.budgetMax);
    }

    // --- Scan radius visualisation (only when selected, not moving) ---
    if (selected && !movement?.moving) {
        // Scale line widths and dash lengths for consistent screen-space appearance
        const world = ServiceLocator.get<World>('world');
        const cameraEntity = world.getEntityByName('camera');
        const camera = cameraEntity?.getComponent(CameraComponent);
        const s = camera ? 1 / camera.scale : 1;

        // Detail radius — inner scan zone
        ctx.beginPath();
        ctx.arc(x, y, FOG_DETAIL_RADIUS, 0, Math.PI * 2);
        ctx.setLineDash([12 * s, 8 * s]);
        ctx.strokeStyle = 'rgba(79, 168, 255, 0.15)';
        ctx.lineWidth = 2 * s;
        ctx.stroke();
        ctx.setLineDash([]);

        // Blip radius — outer scan zone
        ctx.beginPath();
        ctx.arc(x, y, FOG_BLIP_RADIUS, 0, Math.PI * 2);
        ctx.setLineDash([16 * s, 12 * s]);
        ctx.strokeStyle = 'rgba(79, 168, 255, 0.08)';
        ctx.lineWidth = 1.5 * s;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // --- Hover highlight ring (warm amber) ---
    if (hovered) {
        ctx.beginPath();
        ctx.arc(x, y, HIT_RADIUS + 24, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.5)';
        ctx.lineWidth = 8;
        ctx.stroke();

        const hoverGlow = ctx.createRadialGradient(
            x, y, HIT_RADIUS,
            x, y, HIT_RADIUS + 56,
        );
        hoverGlow.addColorStop(0, 'rgba(255, 220, 120, 0.15)');
        hoverGlow.addColorStop(1, 'rgba(255, 220, 120, 0)');
        ctx.fillStyle = hoverGlow;
        ctx.beginPath();
        ctx.arc(x, y, HIT_RADIUS + 56, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Selection ring (warm amber, solid — shown when selected but not hovered) ---
    if (selected && !hovered) {
        ctx.beginPath();
        ctx.arc(x, y, HIT_RADIUS + 16, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.4)';
        ctx.lineWidth = 6;
        ctx.stroke();

        const selGlow = ctx.createRadialGradient(
            x, y, HIT_RADIUS,
            x, y, HIT_RADIUS + 48,
        );
        selGlow.addColorStop(0, 'rgba(255, 220, 120, 0.1)');
        selGlow.addColorStop(1, 'rgba(255, 220, 120, 0)');
        ctx.fillStyle = selGlow;
        ctx.beginPath();
        ctx.arc(x, y, HIT_RADIUS + 48, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // --- Engine glow (at the rear of the ship) ---
    if (engineStatus === 'offline') {
        // Faint smoke when engines are offline
        const smokeGlow = ctx.createRadialGradient(
            -HULL_LENGTH - 8, 0, 0,
            -HULL_LENGTH - 8, 0, 32,
        );
        smokeGlow.addColorStop(0, 'rgba(80, 60, 40, 0.15)');
        smokeGlow.addColorStop(1, 'rgba(80, 60, 40, 0)');
        ctx.fillStyle = smokeGlow;
        ctx.beginPath();
        ctx.arc(-HULL_LENGTH - 8, 0, 32, 0, Math.PI * 2);
        ctx.fill();
    } else if (engineStatus === 'repairing') {
        // Flickering engine glow — faster pulse, lower alpha
        const enginePulse = 0.5 + 0.5 * Math.sin(t / 150);
        const engineGlow = ctx.createRadialGradient(
            -HULL_LENGTH - 8, 0, 0,
            -HULL_LENGTH - 8, 0, 48,
        );
        engineGlow.addColorStop(0, `rgba(255, 160, 40, ${(0.3 + 0.2 * enginePulse).toFixed(3)})`);
        engineGlow.addColorStop(0.5, `rgba(255, 100, 20, ${(0.1 * enginePulse).toFixed(3)})`);
        engineGlow.addColorStop(1, 'rgba(255, 80, 0, 0)');
        ctx.fillStyle = engineGlow;
        ctx.beginPath();
        ctx.arc(-HULL_LENGTH - 8, 0, 48, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Full engine glow when online
        const enginePulse = 0.7 + 0.3 * Math.sin(t / 300);
        const engineGlow = ctx.createRadialGradient(
            -HULL_LENGTH - 8, 0, 0,
            -HULL_LENGTH - 8, 0, 48,
        );
        engineGlow.addColorStop(0, `rgba(255, 160, 40, ${(0.6 * enginePulse).toFixed(3)})`);
        engineGlow.addColorStop(0.5, `rgba(255, 100, 20, ${(0.2 * enginePulse).toFixed(3)})`);
        engineGlow.addColorStop(1, 'rgba(255, 80, 0, 0)');
        ctx.fillStyle = engineGlow;
        ctx.beginPath();
        ctx.arc(-HULL_LENGTH - 8, 0, 48, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Hull (angular alien silhouette) ---
    // 6-vertex asymmetric polygon for an alien feel
    ctx.beginPath();
    ctx.moveTo(HULL_LENGTH, 0);                          // nose tip
    ctx.lineTo(HULL_LENGTH * 0.3, -HULL_WIDTH * 0.6);   // upper forward
    ctx.lineTo(-HULL_LENGTH * 0.4, -HULL_WIDTH);        // upper wing
    ctx.lineTo(-HULL_LENGTH, -HULL_WIDTH * 0.4);        // rear upper
    ctx.lineTo(-HULL_LENGTH, HULL_WIDTH * 0.4);         // rear lower
    ctx.lineTo(-HULL_LENGTH * 0.4, HULL_WIDTH);         // lower wing
    ctx.lineTo(HULL_LENGTH * 0.3, HULL_WIDTH * 0.6);    // lower forward
    ctx.closePath();

    // Hull gradient: silver-grey with darker edges
    const hullGrad = ctx.createLinearGradient(
        -HULL_LENGTH, -HULL_WIDTH,
        HULL_LENGTH * 0.5, HULL_WIDTH,
    );
    hullGrad.addColorStop(0, '#7a7a8a');
    hullGrad.addColorStop(0.4, '#b0b0c0');
    hullGrad.addColorStop(0.7, '#a0a0b0');
    hullGrad.addColorStop(1, '#606070');
    ctx.fillStyle = hullGrad;
    ctx.fill();

    // Subtle hull outline
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // --- Cockpit detail (small bright spot near the nose) ---
    const cockpitGlow = ctx.createRadialGradient(
        HULL_LENGTH * 0.5, 0, 0,
        HULL_LENGTH * 0.5, 0, 12,
    );
    cockpitGlow.addColorStop(0, 'rgba(150, 200, 255, 0.6)');
    cockpitGlow.addColorStop(1, 'rgba(150, 200, 255, 0)');
    ctx.fillStyle = cockpitGlow;
    ctx.beginPath();
    ctx.arc(HULL_LENGTH * 0.5, 0, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // --- Repair progress arc (when engines are being repaired) ---
    if (engineStatus === 'repairing' && engineState) {
        // Progress arc around ship
        const progress = (engineState.repairTurnsTotal - engineState.repairTurnsRemaining) / engineState.repairTurnsTotal;
        const endAngle = -Math.PI / 2 + progress * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(x, y, HIT_RADIUS + 8, -Math.PI / 2, endAngle);
        ctx.strokeStyle = '#d4a040';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Sparkle at endpoint
        const sparkX = x + (HIT_RADIUS + 8) * Math.cos(endAngle);
        const sparkY = y + (HIT_RADIUS + 8) * Math.sin(endAngle);
        const sparkPulse = 0.5 + 0.5 * Math.sin(t / 200);
        ctx.fillStyle = `rgba(255, 220, 100, ${(0.6 + 0.4 * sparkPulse).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 4 + 2 * sparkPulse, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function createShip(world: World): Entity {
    const entity = world.createEntity('arkSalvage');

    // Look up New Terra for orbit-relative positioning
    const newTerra = world.getEntityByName('newTerra');
    if (!newTerra) {
        console.warn('createShip: newTerra entity not found — ship orbit will use origin');
    }
    const newTerraTransform = newTerra?.getComponent(TransformComponent);
    const cx = newTerraTransform?.x ?? 0;
    const cy = newTerraTransform?.y ?? 0;

    // Start in orbit around New Terra
    entity.addComponent(new TransformComponent(
        cx + SHIP_ORBIT_RADIUS * Math.cos(SHIP_START_ANGLE),
        cy + SHIP_ORBIT_RADIUS * Math.sin(SHIP_START_ANGLE),
    ));
    entity.addComponent(new MovementComponent(MOVEMENT_BUDGET, GLIDE_SPEED));
    entity.addComponent(new SelectableComponent(HIT_RADIUS));
    entity.addComponent(new RenderComponent('world', (ctx, x, y, a) => {
        drawShip(entity, ctx, x, y, a);
    }));
    entity.addComponent(new MoveConfirmComponent());
    entity.addComponent(new ShipInfoUIComponent());
    entity.addComponent(new VisibilitySourceComponent(FOG_DETAIL_RADIUS, FOG_BLIP_RADIUS, true));

    // Orbit constraint — ship is locked orbiting New Terra until engines are repaired
    const orbit = new OrbitComponent(cx, cy, SHIP_ORBIT_RADIUS, SHIP_ORBIT_SPEED);
    orbit.angle = SHIP_START_ANGLE;
    if (newTerra) {
        orbit.parentEntityId = newTerra.id;
    }
    entity.addComponent(orbit);

    // Engine state and repair lifecycle
    entity.addComponent(new EngineStateComponent());
    entity.addComponent(new EngineRepairComponent());

    return entity;
}
