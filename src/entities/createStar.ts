// createStar.ts — Factory for the central star entity.
// Renders a warm G-type star with multi-layered glow, animated pulse,
// and faint corona rays. Selectable for resource management.
// All rendering uses radial gradients with additive blending
// for a natural, non-cartoon glow.

import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Number of faint radial corona rays */
const RAY_COUNT = 8;

/** Hit radius for hover/click detection (covers the bright inner glow) */
const HIT_RADIUS = 25;

/** Draw the animated star at the given position. Entity captured via closure. */
function drawStar(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const t = performance.now();

    // Check hover state via the captured entity reference
    const selectable = entity.getComponent(SelectableComponent);
    const hovered = selectable?.hovered ?? false;

    // Brightness pulse (±15% over ~4 seconds) — visible but not jarring
    const pulse = 1.0 + 0.15 * Math.sin(t / 2000);

    // --- Corona rays (drawn first, behind the glow) ---
    const rayRotation = t / 30000; // one full rotation per ~3 minutes
    for (let i = 0; i < RAY_COUNT; i++) {
        const angle = (i / RAY_COUNT) * Math.PI * 2 + rayRotation;
        const rayAlpha = 0.04 + 0.03 * Math.sin(t / 1500 + i);
        ctx.beginPath();
        ctx.moveTo(
            x + Math.cos(angle) * 15,
            y + Math.sin(angle) * 15,
        );
        ctx.lineTo(
            x + Math.cos(angle) * 130,
            y + Math.sin(angle) * 130,
        );
        ctx.strokeStyle = `rgba(255, 240, 200, ${rayAlpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    // --- Glow layers (additive blending) ---
    ctx.globalCompositeOperation = 'lighter';

    // Layer 1: outermost corona wash
    const g1 = ctx.createRadialGradient(x, y, 0, x, y, 180);
    g1.addColorStop(0, `rgba(255, 149, 0, ${(0.025 * pulse).toFixed(4)})`);
    g1.addColorStop(1, 'rgba(255, 149, 0, 0)');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(x, y, 180, 0, Math.PI * 2);
    ctx.fill();

    // Layer 2: outer glow
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, 100);
    g2.addColorStop(0, `rgba(255, 220, 150, ${(0.10 * pulse).toFixed(4)})`);
    g2.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(x, y, 100, 0, Math.PI * 2);
    ctx.fill();

    // Layer 3: mid glow
    const g3 = ctx.createRadialGradient(x, y, 0, x, y, 50);
    g3.addColorStop(0, `rgba(255, 244, 194, ${(0.30 * pulse).toFixed(4)})`);
    g3.addColorStop(1, 'rgba(255, 220, 150, 0)');
    ctx.fillStyle = g3;
    ctx.beginPath();
    ctx.arc(x, y, 50, 0, Math.PI * 2);
    ctx.fill();

    // Layer 4: inner glow
    const g4 = ctx.createRadialGradient(x, y, 0, x, y, 25);
    g4.addColorStop(0, 'rgba(255, 254, 245, 0.9)');
    g4.addColorStop(1, 'rgba(255, 244, 194, 0.1)');
    ctx.fillStyle = g4;
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI * 2);
    ctx.fill();

    // Reset composite operation before drawing the solid core
    ctx.globalCompositeOperation = 'source-over';

    // Layer 5: solid core
    const g5 = ctx.createRadialGradient(x, y, 0, x, y, 10);
    g5.addColorStop(0, '#fffef5');
    g5.addColorStop(1, '#fff4c2');
    ctx.fillStyle = g5;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();

    // --- Hover highlight ring (warm amber to match the star) ---
    if (hovered) {
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Soft outer glow
        const hoverGlow = ctx.createRadialGradient(x, y, 25, x, y, 45);
        hoverGlow.addColorStop(0, 'rgba(255, 220, 120, 0.15)');
        hoverGlow.addColorStop(1, 'rgba(255, 220, 120, 0)');
        ctx.fillStyle = hoverGlow;
        ctx.beginPath();
        ctx.arc(x, y, 45, 0, Math.PI * 2);
        ctx.fill();
    }
}

export function createStar(world: World): Entity {
    const entity = world.createEntity('star');

    // Star is at world origin (0, 0) — camera maps this to canvas centre
    entity.addComponent(new TransformComponent(0, 0));
    entity.addComponent(new SelectableComponent(HIT_RADIUS));
    entity.addComponent(new RenderComponent('world', (ctx, x, y) => {
        drawStar(entity, ctx, x, y);
    }));

    return entity;
}
