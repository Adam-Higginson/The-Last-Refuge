// createStar.ts — Factory for the central star entity.
// Renders a warm G-type star with multi-layered glow, animated pulse,
// and faint corona rays. Selectable for resource management.
// All rendering uses radial gradients with additive blending
// for a natural, non-cartoon glow.

import { ServiceLocator } from '../core/ServiceLocator';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import { CameraComponent } from '../components/CameraComponent';
import { StarInfoUIComponent } from '../components/StarInfoUIComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Number of faint radial corona rays */
const RAY_COUNT = 8;

/** Hit radius for hover/click detection (covers the bright inner glow) */
const HIT_RADIUS = 300;

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
            x + Math.cos(angle) * 180,
            y + Math.sin(angle) * 180,
        );
        ctx.lineTo(
            x + Math.cos(angle) * 1560,
            y + Math.sin(angle) * 1560,
        );
        ctx.strokeStyle = `rgba(255, 240, 200, ${rayAlpha})`;
        ctx.lineWidth = 6;
        ctx.stroke();
    }

    // --- Glow layers (additive blending) ---
    ctx.globalCompositeOperation = 'lighter';

    // Layer 1: outermost corona wash
    const g1 = ctx.createRadialGradient(x, y, 0, x, y, 2160);
    g1.addColorStop(0, `rgba(255, 149, 0, ${(0.025 * pulse).toFixed(4)})`);
    g1.addColorStop(1, 'rgba(255, 149, 0, 0)');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(x, y, 2160, 0, Math.PI * 2);
    ctx.fill();

    // Layer 2: outer glow
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, 1200);
    g2.addColorStop(0, `rgba(255, 220, 150, ${(0.10 * pulse).toFixed(4)})`);
    g2.addColorStop(1, 'rgba(255, 200, 100, 0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(x, y, 1200, 0, Math.PI * 2);
    ctx.fill();

    // Layer 3: mid glow
    const g3 = ctx.createRadialGradient(x, y, 0, x, y, 600);
    g3.addColorStop(0, `rgba(255, 244, 194, ${(0.30 * pulse).toFixed(4)})`);
    g3.addColorStop(1, 'rgba(255, 220, 150, 0)');
    ctx.fillStyle = g3;
    ctx.beginPath();
    ctx.arc(x, y, 600, 0, Math.PI * 2);
    ctx.fill();

    // Layer 4: inner glow
    const g4 = ctx.createRadialGradient(x, y, 0, x, y, 300);
    g4.addColorStop(0, 'rgba(255, 254, 245, 0.9)');
    g4.addColorStop(1, 'rgba(255, 244, 194, 0.1)');
    ctx.fillStyle = g4;
    ctx.beginPath();
    ctx.arc(x, y, 300, 0, Math.PI * 2);
    ctx.fill();

    // Reset composite operation before drawing the solid core
    ctx.globalCompositeOperation = 'source-over';

    // Layer 5: solid core
    const g5 = ctx.createRadialGradient(x, y, 0, x, y, 120);
    g5.addColorStop(0, '#fffef5');
    g5.addColorStop(1, '#fff4c2');
    ctx.fillStyle = g5;
    ctx.beginPath();
    ctx.arc(x, y, 120, 0, Math.PI * 2);
    ctx.fill();

    // --- Hover highlight ring (warm amber to match the star) ---
    if (hovered) {
        ctx.beginPath();
        ctx.arc(x, y, 360, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 220, 120, 0.5)';
        ctx.lineWidth = 10;
        ctx.stroke();

        // Soft outer glow
        const hoverGlow = ctx.createRadialGradient(x, y, 300, x, y, 540);
        hoverGlow.addColorStop(0, 'rgba(255, 220, 120, 0.15)');
        hoverGlow.addColorStop(1, 'rgba(255, 220, 120, 0)');
        ctx.fillStyle = hoverGlow;
        ctx.beginPath();
        ctx.arc(x, y, 540, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Name label ---
    const world = ServiceLocator.get<World>('world');
    const cameraEntity = world.getEntityByName('camera');
    const camera = cameraEntity?.getComponent(CameraComponent);
    const fontSize = camera ? 14 / camera.scale : 14;

    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#ffe8a0';
    ctx.font = `${fontSize}px "Share Tech Mono", "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('SOLACE', x, y + 120 + fontSize * 1.5);
    ctx.restore();
}

export function createStar(world: World): Entity {
    const entity = world.createEntity('star');

    // Star is at world origin (0, 0) — camera maps this to canvas centre
    entity.addComponent(new TransformComponent(0, 0));
    entity.addComponent(new SelectableComponent(HIT_RADIUS));
    entity.addComponent(new RenderComponent('world', (ctx, x, y) => {
        drawStar(entity, ctx, x, y);
    }));
    entity.addComponent(new StarInfoUIComponent());

    return entity;
}
