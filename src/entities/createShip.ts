// createShip.ts — Factory for the Ark Salvage ship entity.
// Renders an angular alien hull with engine glow, movement range disc,
// and hover highlight. Ship rotates to face its direction of travel.
// Movement range shown as a gradient disc with edge ring when selected,
// smoothly shrinking as budget is spent. Colour shifts green → red.

import { ServiceLocator } from '../core/ServiceLocator';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { MovementComponent } from '../components/MovementComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Movement budget in pixels per turn */
const MOVEMENT_BUDGET = 300;

/** Glide speed in pixels per second */
const GLIDE_SPEED = 200;

/** Hit radius for hover/click detection */
const HIT_RADIUS = 18;

/** Hull half-length (tip to centre) */
const HULL_LENGTH = 14;

/** Hull half-width at the widest point */
const HULL_WIDTH = 8;

/**
 * Interpolate ring colour from green (full budget) to red (empty budget).
 * Returns an `rgba(r, g, b, <alpha>)` string at the given alpha.
 */
function budgetColour(ratio: number, alpha: number): string {
    // ratio 1 = full budget (green), 0 = empty (red), 0.5 = amber
    const r = Math.round(255 * (1 - ratio) + 80 * ratio);
    const g = Math.round(60 * (1 - ratio) + 220 * ratio);
    const b = Math.round(40 * (1 - ratio) + 80 * ratio);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

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
    const hovered = selectable?.hovered ?? false;
    const selected = selectable?.selected ?? false;

    // --- Dotted line to target while moving ---
    if (movement && movement.moving && movement.targetX !== null && movement.targetY !== null) {
        ctx.save();
        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.moveTo(x, y);
        ctx.lineTo(movement.targetX, movement.targetY);
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // Target marker — small cross at destination
        const tx = movement.targetX;
        const ty = movement.targetY;
        const cs = 5; // cross half-size
        ctx.beginPath();
        ctx.moveTo(tx - cs, ty - cs);
        ctx.lineTo(tx + cs, ty + cs);
        ctx.moveTo(tx + cs, ty - cs);
        ctx.lineTo(tx - cs, ty + cs);
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    // --- Movement range disc (anchored to turn origin, visible when selected) ---
    // Colour transitions green → amber → red as budget depletes
    if (selected && movement && movement.displayBudget > 0) {
        const r = movement.displayBudget;
        const ratio = movement.budgetMax > 0
            ? movement.displayBudget / movement.budgetMax
            : 0;

        // Gradient fill (always centred on the ship)
        const rangeGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
        rangeGrad.addColorStop(0, budgetColour(ratio, 0.18));
        rangeGrad.addColorStop(0.6, budgetColour(ratio, 0.10));
        rangeGrad.addColorStop(0.9, budgetColour(ratio, 0.05));
        rangeGrad.addColorStop(1, budgetColour(ratio, 0));
        ctx.fillStyle = rangeGrad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Solid edge ring
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = budgetColour(ratio, 0.45);
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Soft glow bloom on the edge
        const edgeGlow = ctx.createRadialGradient(x, y, r - 8, x, y, r + 8);
        edgeGlow.addColorStop(0, budgetColour(ratio, 0));
        edgeGlow.addColorStop(0.5, budgetColour(ratio, 0.10));
        edgeGlow.addColorStop(1, budgetColour(ratio, 0));
        ctx.fillStyle = edgeGlow;
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Hover highlight ring (warm amber) ---
    if (hovered) {
        ctx.beginPath();
        ctx.arc(x, y, HIT_RADIUS + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const hoverGlow = ctx.createRadialGradient(
            x, y, HIT_RADIUS,
            x, y, HIT_RADIUS + 14,
        );
        hoverGlow.addColorStop(0, 'rgba(255, 220, 120, 0.15)');
        hoverGlow.addColorStop(1, 'rgba(255, 220, 120, 0)');
        ctx.fillStyle = hoverGlow;
        ctx.beginPath();
        ctx.arc(x, y, HIT_RADIUS + 14, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Selection ring (warm amber, solid — shown when selected but not hovered) ---
    if (selected && !hovered) {
        ctx.beginPath();
        ctx.arc(x, y, HIT_RADIUS + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const selGlow = ctx.createRadialGradient(
            x, y, HIT_RADIUS,
            x, y, HIT_RADIUS + 12,
        );
        selGlow.addColorStop(0, 'rgba(255, 220, 120, 0.1)');
        selGlow.addColorStop(1, 'rgba(255, 220, 120, 0)');
        ctx.fillStyle = selGlow;
        ctx.beginPath();
        ctx.arc(x, y, HIT_RADIUS + 12, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // --- Engine glow (at the rear of the ship) ---
    const enginePulse = 0.7 + 0.3 * Math.sin(t / 300);
    const engineGlow = ctx.createRadialGradient(
        -HULL_LENGTH - 2, 0, 0,
        -HULL_LENGTH - 2, 0, 12,
    );
    engineGlow.addColorStop(0, `rgba(255, 160, 40, ${(0.6 * enginePulse).toFixed(3)})`);
    engineGlow.addColorStop(0.5, `rgba(255, 100, 20, ${(0.2 * enginePulse).toFixed(3)})`);
    engineGlow.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = engineGlow;
    ctx.beginPath();
    ctx.arc(-HULL_LENGTH - 2, 0, 12, 0, Math.PI * 2);
    ctx.fill();

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
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // --- Cockpit detail (small bright spot near the nose) ---
    const cockpitGlow = ctx.createRadialGradient(
        HULL_LENGTH * 0.5, 0, 0,
        HULL_LENGTH * 0.5, 0, 3,
    );
    cockpitGlow.addColorStop(0, 'rgba(150, 200, 255, 0.6)');
    cockpitGlow.addColorStop(1, 'rgba(150, 200, 255, 0)');
    ctx.fillStyle = cockpitGlow;
    ctx.beginPath();
    ctx.arc(HULL_LENGTH * 0.5, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

export function createShip(world: World): Entity {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const entity = world.createEntity('arkSalvage');

    // Start near the upper-right area of the canvas, away from the planet
    entity.addComponent(new TransformComponent(cx + 250, cy - 150));
    entity.addComponent(new MovementComponent(MOVEMENT_BUDGET, GLIDE_SPEED));
    entity.addComponent(new SelectableComponent(HIT_RADIUS));
    entity.addComponent(new RenderComponent('world', (ctx, x, y, angle) => {
        drawShip(entity, ctx, x, y, angle);
    }));

    return entity;
}
