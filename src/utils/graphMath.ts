// graphMath.ts — Pure, testable graph math utilities for the relationship graph.
// Uses seeded PRNG for deterministic layouts.

import { mulberry32 } from './prng';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphNode {
    id: number;
    x: number;
    y: number;
    connectionCount: number;
}

export interface GraphEdge {
    source: number;
    target: number;
}

export interface PositionedNode {
    id: number;
    x: number;
    y: number;
}

export interface ForceOptions {
    iterations: number;
    repulsion: number;
    springStrength: number;
    damping: number;
    width: number;
    height: number;
    seed: number;
}

export interface ViewBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface ViewBoxBounds {
    minZoom: number;
    maxZoom: number;
    worldWidth: number;
    worldHeight: number;
}

// ---------------------------------------------------------------------------
// Force-directed layout
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: ForceOptions = {
    iterations: 100,
    repulsion: 5000,
    springStrength: 0.01,
    damping: 0.9,
    width: 1000,
    height: 1000,
    seed: 42,
};

export function forceLayout(
    nodes: readonly GraphNode[],
    edges: readonly GraphEdge[],
    options?: Partial<ForceOptions>,
): PositionedNode[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const rng = mulberry32(opts.seed);

    const padding = 50;
    const minX = padding;
    const minY = padding;
    const maxX = opts.width - padding;
    const maxY = opts.height - padding;

    // Initialise mutable positions — place nodes in a circle with jitter
    const pos = nodes.map((n, i) => {
        const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
        const cx = opts.width / 2;
        const cy = opts.height / 2;
        const r = Math.min(opts.width, opts.height) * 0.35;
        return {
            id: n.id,
            x: cx + Math.cos(angle) * r + (rng() - 0.5) * 20,
            y: cy + Math.sin(angle) * r + (rng() - 0.5) * 20,
            vx: 0,
            vy: 0,
        };
    });

    // Build adjacency lookup
    const idToIdx = new Map<number, number>();
    for (let i = 0; i < pos.length; i++) {
        idToIdx.set(pos[i].id, i);
    }

    for (let iter = 0; iter < opts.iterations; iter++) {
        // Repulsion between all pairs
        for (let i = 0; i < pos.length; i++) {
            for (let j = i + 1; j < pos.length; j++) {
                let dx = pos[j].x - pos[i].x;
                let dy = pos[j].y - pos[i].y;
                let dist = Math.sqrt(dx * dx + dy * dy);

                // NaN guard: if nodes overlap exactly, nudge with random offset
                if (dist === 0) {
                    dx = (rng() - 0.5) * 2;
                    dy = (rng() - 0.5) * 2;
                    dist = Math.sqrt(dx * dx + dy * dy);
                }

                const force = opts.repulsion / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;

                pos[i].vx -= fx;
                pos[i].vy -= fy;
                pos[j].vx += fx;
                pos[j].vy += fy;
            }
        }

        // Spring attraction along edges
        for (const edge of edges) {
            const si = idToIdx.get(edge.source);
            const ti = idToIdx.get(edge.target);
            if (si === undefined || ti === undefined) continue;

            const dx = pos[ti].x - pos[si].x;
            const dy = pos[ti].y - pos[si].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) continue;

            const force = dist * opts.springStrength;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            pos[si].vx += fx;
            pos[si].vy += fy;
            pos[ti].vx -= fx;
            pos[ti].vy -= fy;
        }

        // Apply velocities with damping and clamp
        for (const p of pos) {
            p.vx *= opts.damping;
            p.vy *= opts.damping;
            p.x += p.vx;
            p.y += p.vy;

            // Clamp to bounds
            p.x = Math.max(minX, Math.min(maxX, p.x));
            p.y = Math.max(minY, Math.min(maxY, p.y));

            // Final NaN guard
            if (!isFinite(p.x)) p.x = opts.width / 2 + (rng() - 0.5) * 100;
            if (!isFinite(p.y)) p.y = opts.height / 2 + (rng() - 0.5) * 100;
        }
    }

    return pos.map(p => ({ id: p.id, x: p.x, y: p.y }));
}

// ---------------------------------------------------------------------------
// Convex hull (Andrew's monotone chain)
// ---------------------------------------------------------------------------

export function computeConvexHull(points: readonly { x: number; y: number }[]): { x: number; y: number }[] {
    if (points.length < 3) return [];

    const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

    const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number =>
        (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    // Lower hull
    const lower: { x: number; y: number }[] = [];
    for (const p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    // Upper hull
    const upper: { x: number; y: number }[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }

    // Remove last point of each half (it's the same as the first of the other)
    lower.pop();
    upper.pop();

    const hull = lower.concat(upper);

    // If all points are collinear, hull will have < 3 unique points
    if (hull.length < 3) return [];

    return hull;
}

// ---------------------------------------------------------------------------
// SVG ViewBox zoom/pan clamping
// ---------------------------------------------------------------------------

export function clampViewBox(
    baseWidth: number,
    baseHeight: number,
    zoom: number,
    panX: number,
    panY: number,
    bounds: ViewBoxBounds,
): ViewBox {
    const clampedZoom = Math.max(bounds.minZoom, Math.min(bounds.maxZoom, zoom));

    const vbWidth = baseWidth / clampedZoom;
    const vbHeight = baseHeight / clampedZoom;

    // Clamp pan so the viewBox doesn't go outside the world bounds
    const maxPanX = bounds.worldWidth - vbWidth;
    const maxPanY = bounds.worldHeight - vbHeight;

    const clampedX = Math.max(0, Math.min(maxPanX, panX));
    const clampedY = Math.max(0, Math.min(maxPanY, panY));

    return {
        x: clampedX,
        y: clampedY,
        width: vbWidth,
        height: vbHeight,
    };
}
