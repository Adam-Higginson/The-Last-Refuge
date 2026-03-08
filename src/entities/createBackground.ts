// createBackground.ts — Factory for the space background entity.
// Renders a star field (two layers) and subtle nebula wash onto an
// offscreen canvas that is cached and blitted each frame. The cache
// is regenerated on canvas resize. Star positions use a seeded PRNG
// so the pattern stays stable across resizes.

import { ServiceLocator } from '../core/ServiceLocator';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { mulberry32 } from '../utils/prng';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

const STAR_SEED = 0xDEAD_BEEF;
const DISTANT_STAR_COUNT = 400;
const CLOSE_STAR_COUNT = 60;
const NEBULA_COUNT = 3;

/** Generate the background onto an offscreen canvas. */
function generateBackground(width: number, height: number): HTMLCanvasElement {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return offscreen;

    const rng = mulberry32(STAR_SEED);

    // Fill with near-black space
    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, width, height);

    // --- Distant stars (tiny, dim, many) ---
    for (let i = 0; i < DISTANT_STAR_COUNT; i++) {
        const x = rng() * width;
        const y = rng() * height;
        const radius = 0.3 + rng() * 0.7;
        const alpha = 0.15 + rng() * 0.3;
        // Slight blue tint on some stars
        const blue = rng() > 0.5;
        ctx.fillStyle = blue
            ? `rgba(200, 216, 255, ${alpha})`
            : `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Closer stars (larger, brighter, fewer) ---
    for (let i = 0; i < CLOSE_STAR_COUNT; i++) {
        const x = rng() * width;
        const y = rng() * height;
        const radius = 0.8 + rng() * 1.2;
        const alpha = 0.4 + rng() * 0.4;
        ctx.fillStyle = `rgba(255, 248, 232, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        // 10% chance of a tiny sparkle cross-hair
        if (rng() < 0.1) {
            ctx.strokeStyle = `rgba(255, 248, 232, ${alpha * 0.5})`;
            ctx.lineWidth = 0.5;
            const len = radius + 2;
            ctx.beginPath();
            ctx.moveTo(x - len, y);
            ctx.lineTo(x + len, y);
            ctx.moveTo(x, y - len);
            ctx.lineTo(x, y + len);
            ctx.stroke();
        }
    }

    // --- Nebula wash (very subtle radial gradients) ---
    const nebulaColours = [
        [30, 15, 60],   // deep purple
        [15, 30, 80],   // deep blue
        [40, 20, 70],   // blue-purple
    ];

    for (let i = 0; i < NEBULA_COUNT; i++) {
        const cx = rng() * width;
        const cy = rng() * height;
        const r = Math.min(width, height) * (0.3 + rng() * 0.2);
        const [nr, ng, nb] = nebulaColours[i % nebulaColours.length];
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        gradient.addColorStop(0, `rgba(${nr}, ${ng}, ${nb}, 0.025)`);
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    return offscreen;
}

export function createBackground(world: World): Entity {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

    // Cached offscreen canvas and dimensions for resize detection
    let cache: HTMLCanvasElement = generateBackground(canvas.width, canvas.height);
    let lastWidth = canvas.width;
    let lastHeight = canvas.height;

    const entity = world.createEntity('background');
    entity.addComponent(new TransformComponent(0, 0));
    entity.addComponent(
        new RenderComponent('background', (ctx) => {
            // Regenerate cache if canvas was resized
            if (canvas.width !== lastWidth || canvas.height !== lastHeight) {
                lastWidth = canvas.width;
                lastHeight = canvas.height;
                cache = generateBackground(lastWidth, lastHeight);
            }
            ctx.drawImage(cache, 0, 0);
        }),
    );

    return entity;
}
