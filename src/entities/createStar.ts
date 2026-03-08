// createStar.ts — Factory for the central star entity.
// Renders a warm G-type star with multi-layered glow, animated pulse,
// and faint corona rays. All rendering uses radial gradients with
// additive blending for a natural, non-cartoon glow.

import { ServiceLocator } from '../core/ServiceLocator';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Number of faint radial corona rays */
const RAY_COUNT = 8;

/** Draw the animated star at the given position. */
function drawStar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    _angle: number,
    _scale: number,
    _dt: number,
): void {
    const t = performance.now();

    // Slow, gentle brightness pulse (±4% over ~6 seconds)
    const pulse = 1.0 + 0.04 * Math.sin(t / 3000);

    // --- Corona rays (drawn first, behind the glow) ---
    const rayRotation = t / 60000; // one full rotation per ~6 minutes
    for (let i = 0; i < RAY_COUNT; i++) {
        const angle = (i / RAY_COUNT) * Math.PI * 2 + rayRotation;
        const rayAlpha = 0.03 + 0.02 * Math.sin(t / 2000 + i);
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
    g1.addColorStop(0, `rgba(255, 149, 0, ${(0.015 * pulse).toFixed(4)})`);
    g1.addColorStop(1, 'rgba(255, 149, 0, 0)');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(x, y, 180, 0, Math.PI * 2);
    ctx.fill();

    // Layer 2: outer glow
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, 100);
    g2.addColorStop(0, `rgba(255, 220, 150, ${(0.06 * pulse).toFixed(4)})`);
    g2.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(x, y, 100, 0, Math.PI * 2);
    ctx.fill();

    // Layer 3: mid glow
    const g3 = ctx.createRadialGradient(x, y, 0, x, y, 50);
    g3.addColorStop(0, `rgba(255, 244, 194, ${(0.25 * pulse).toFixed(4)})`);
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
}

export function createStar(world: World): Entity {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

    const entity = world.createEntity('star');
    entity.addComponent(new TransformComponent(
        canvas.width / 2,
        canvas.height / 2,
    ));
    entity.addComponent(new RenderComponent('world', drawStar));

    return entity;
}
