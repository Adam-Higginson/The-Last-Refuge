// createPlanet.ts — Factory for the New Terra planet entity.
// Renders a blue-green habitable world with atmospheric glow, cloud wisps,
// and shadow on the side facing away from the star. Shows a highlight ring
// when hovered. Draws a faint orbit ring centred on the star.
// Orbit is turn-based — position advances on 'turn:end' events.

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

    // --- Orbit ring (dashed circle centred on the star) ---
    const orbit = entity.getComponent(OrbitComponent);
    if (orbit) {
        ctx.beginPath();
        ctx.arc(orbit.centreX, orbit.centreY, orbit.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(90, 140, 220, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 8]);
        ctx.stroke();
        ctx.setLineDash([]); // reset dash
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

    // Base ocean: blue-green gradient
    const bodyGrad = ctx.createRadialGradient(
        x - r * 0.3, y - r * 0.3, r * 0.1,
        x, y, r,
    );
    bodyGrad.addColorStop(0, '#4aa8a0');  // lighter teal
    bodyGrad.addColorStop(0.5, '#2a7a6a'); // mid green
    bodyGrad.addColorStop(1, '#1a5a7a');   // blue edge
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    // --- Spinning surface features (continents + clouds) ---
    // Horizontal scroll simulates planet rotation (~20s per revolution)
    const spin = (t / 20000) * r * 2; // scroll offset in px
    const wrap = r * 4; // wrap period (two planet diameters)

    // Draw 4 continent-like patches that scroll across the face
    ctx.globalAlpha = 0.4;
    const landColours = ['#4a9a5a', '#3a8a4a', '#5aaa6a', '#3a7a3a'];
    const landPatches = [
        { xOff: 0.0, yOff: -0.3, w: 0.5, h: 0.35 },
        { xOff: 1.2, yOff: 0.1, w: 0.7, h: 0.3 },
        { xOff: 2.4, yOff: -0.15, w: 0.4, h: 0.5 },
        { xOff: 3.2, yOff: 0.35, w: 0.55, h: 0.25 },
    ];
    for (let i = 0; i < landPatches.length; i++) {
        const p = landPatches[i];
        // Compute scrolling x position, wrapping around
        const rawX = (p.xOff * r + spin) % wrap - r;
        ctx.fillStyle = landColours[i];
        ctx.beginPath();
        ctx.ellipse(
            x + rawX,
            y + p.yOff * r,
            p.w * r,
            p.h * r,
            0, 0, Math.PI * 2,
        );
        ctx.fill();
    }

    // --- Cloud bands (scroll slightly faster than surface) ---
    const cloudSpin = (t / 16000) * r * 2;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    const cloudBands = [
        { xOff: 0.5, yOff: -0.35, w: 0.8, h: 0.12 },
        { xOff: 2.0, yOff: 0.25, w: 0.6, h: 0.1 },
        { xOff: 3.5, yOff: -0.05, w: 0.9, h: 0.08 },
    ];
    for (const c of cloudBands) {
        const rawX = (c.xOff * r + cloudSpin) % wrap - r;
        ctx.beginPath();
        ctx.ellipse(
            x + rawX,
            y + c.yOff * r,
            c.w * r,
            c.h * r,
            0, 0, Math.PI * 2,
        );
        ctx.fill();
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
