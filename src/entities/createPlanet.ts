// createPlanet.ts — Factory for the New Terra planet entity.
// Renders a blue-green habitable world with atmospheric glow, cloud wisps,
// and shadow on the side facing away from the star. Shows a highlight ring
// when hovered. Orbit is turn-based — position advances on 'turn:end' events.

import { ServiceLocator } from '../core/ServiceLocator';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { OrbitComponent } from '../components/OrbitComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Planet body radius in pixels */
const PLANET_RADIUS = 12;

/** Hit radius for hover/click detection (slightly larger than visual) */
const HIT_RADIUS = 20;

/** Orbit speed in radians per turn (~8.6° per turn, full orbit in ~42 turns) */
const ORBIT_SPEED = 0.15;

/** Calculate the orbit radius as 35% of the smaller canvas dimension */
export function getOrbitRadius(canvas: HTMLCanvasElement): number {
    return Math.min(canvas.width, canvas.height) * 0.35;
}

/** Draw New Terra at the given position. Entity is captured via closure. */
function drawPlanet(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const t = performance.now();
    const r = PLANET_RADIUS;

    // Check hover state via the captured entity reference
    const selectable = entity.getComponent(SelectableComponent);
    const hovered = selectable?.hovered ?? false;

    // --- Hover highlight ring ---
    if (hovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(79, 168, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Soft outer glow
        const glowGrad = ctx.createRadialGradient(x, y, r + 4, x, y, r + 16);
        glowGrad.addColorStop(0, 'rgba(79, 168, 255, 0.15)');
        glowGrad.addColorStop(1, 'rgba(79, 168, 255, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, r + 16, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Atmospheric glow (star-facing side) ---
    // The star is at canvas centre; compute angle from planet to star
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
    const starX = canvas.width / 2;
    const starY = canvas.height / 2;
    const angleToStar = Math.atan2(starY - y, starX - x);

    // Atmospheric limb glow on the star-facing side
    const glowX = x + Math.cos(angleToStar) * (r * 0.3);
    const glowY = y + Math.sin(angleToStar) * (r * 0.3);
    const atmosGrad = ctx.createRadialGradient(glowX, glowY, r * 0.5, x, y, r + 6);
    atmosGrad.addColorStop(0, 'rgba(120, 200, 255, 0.15)');
    atmosGrad.addColorStop(1, 'rgba(120, 200, 255, 0)');
    ctx.fillStyle = atmosGrad;
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.fill();

    // --- Planet body ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    // Base gradient: blue-green
    const bodyGrad = ctx.createRadialGradient(
        x - r * 0.3, y - r * 0.3, r * 0.1,
        x, y, r,
    );
    bodyGrad.addColorStop(0, '#5ab88c');  // lighter green
    bodyGrad.addColorStop(0.5, '#3a8a6a'); // mid green
    bodyGrad.addColorStop(1, '#2a6a8a');   // blue edge
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    // --- Cloud wisps (slowly rotating for visual life) ---
    const cloudRotation = t / 15000; // slow rotation
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';

    for (let i = 0; i < 3; i++) {
        const baseAngle = cloudRotation + (i * Math.PI * 2) / 3;
        const cloudY = y - r * 0.4 + i * r * 0.4;
        ctx.beginPath();
        ctx.arc(
            x + Math.cos(baseAngle) * r * 0.2,
            cloudY,
            r * 0.6,
            baseAngle - 0.5,
            baseAngle + 0.5,
        );
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // --- Shadow (side away from star) ---
    const shadowX = x - Math.cos(angleToStar) * r * 0.5;
    const shadowY = y - Math.sin(angleToStar) * r * 0.5;
    const shadowGrad = ctx.createRadialGradient(
        shadowX, shadowY, r * 0.2,
        shadowX, shadowY, r * 1.2,
    );
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    ctx.restore(); // end clip
}

export function createPlanet(world: World): Entity {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const orbitRadius = getOrbitRadius(canvas);

    const entity = world.createEntity('newTerra');

    // Initial position: angle 0 → right side of orbit
    entity.addComponent(new TransformComponent(
        cx + orbitRadius,
        cy,
    ));
    entity.addComponent(new OrbitComponent(cx, cy, orbitRadius, ORBIT_SPEED));
    entity.addComponent(new SelectableComponent(HIT_RADIUS));
    entity.addComponent(new RenderComponent('world', (ctx, x, y) => {
        drawPlanet(entity, ctx, x, y);
    }));

    return entity;
}
