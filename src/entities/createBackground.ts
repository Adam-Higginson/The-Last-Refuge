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
const TWINKLE_COUNT = 30;

/** Data for a star that twinkles each frame. */
interface TwinkleStar {
    /** Normalised x position (0-1), multiplied by canvas width at draw time */
    nx: number;
    /** Normalised y position (0-1) */
    ny: number;
    /** Base radius in pixels */
    radius: number;
    /** Base alpha (0-1) */
    alpha: number;
    /** Unique phase offset so stars don't all pulse in sync */
    phase: number;
    /** Twinkle speed multiplier */
    speed: number;
    /** RGB colour string e.g. "200, 216, 255" */
    colour: string;
}

/** Generate the static background onto an offscreen canvas. */
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
    // Skip the first TWINKLE_COUNT — those are drawn live each frame
    for (let i = 0; i < CLOSE_STAR_COUNT; i++) {
        const x = rng() * width;
        const y = rng() * height;
        const radius = 0.8 + rng() * 1.2;
        const alpha = 0.4 + rng() * 0.4;
        // Consume the sparkle RNG call to keep the sequence aligned
        const _sparkle = rng();

        // The first TWINKLE_COUNT stars are drawn live — skip them in the cache
        if (i < TWINKLE_COUNT) continue;

        ctx.fillStyle = `rgba(255, 248, 232, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (_sparkle < 0.1) {
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

/** Generate twinkle star data from the same PRNG sequence as the cache. */
function generateTwinkleStars(): TwinkleStar[] {
    const rng = mulberry32(STAR_SEED);

    // Consume the distant star RNG calls to stay in sync
    for (let i = 0; i < DISTANT_STAR_COUNT; i++) {
        rng(); rng(); rng(); rng(); rng(); // x, y, radius, alpha, blue
    }

    // The first TWINKLE_COUNT closer stars become twinkle stars
    const stars: TwinkleStar[] = [];
    for (let i = 0; i < TWINKLE_COUNT; i++) {
        const nx = rng();
        const ny = rng();
        const radius = 0.8 + rng() * 1.2;
        const alpha = 0.4 + rng() * 0.4;
        rng(); // consume sparkle call

        stars.push({
            nx,
            ny,
            radius,
            alpha,
            phase: i * 2.3,              // spread phases so they don't sync
            speed: 800 + i * 120,        // each star twinkles at a slightly different rate
            colour: '255, 248, 232',
        });
    }

    return stars;
}

export function createBackground(world: World): Entity {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

    // Cached offscreen canvas and dimensions for resize detection
    let cache: HTMLCanvasElement = generateBackground(canvas.width, canvas.height);
    let lastWidth = canvas.width;
    let lastHeight = canvas.height;

    // Twinkle stars are drawn live each frame on top of the cached background
    const twinkleStars = generateTwinkleStars();

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

            // Blit the static background
            ctx.drawImage(cache, 0, 0);

            // Draw twinkling stars on top
            const t = performance.now();
            for (const star of twinkleStars) {
                const x = star.nx * canvas.width;
                const y = star.ny * canvas.height;

                // Oscillate alpha between ~30% and ~100% of base alpha
                const twinkle = 0.65 + 0.35 * Math.sin(t / star.speed + star.phase);
                const alpha = star.alpha * twinkle;

                // Draw the star dot
                ctx.fillStyle = `rgba(${star.colour}, ${alpha.toFixed(3)})`;
                ctx.beginPath();
                ctx.arc(x, y, star.radius, 0, Math.PI * 2);
                ctx.fill();

                // Faint glow halo on the brightest phase
                if (twinkle > 0.85) {
                    const glowAlpha = (twinkle - 0.85) * 2.0 * star.alpha;
                    ctx.fillStyle = `rgba(${star.colour}, ${glowAlpha.toFixed(3)})`;
                    ctx.beginPath();
                    ctx.arc(x, y, star.radius * 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }),
    );

    return entity;
}
