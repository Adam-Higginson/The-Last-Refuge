// voronoi.ts — Simplified Voronoi tessellation via half-plane clipping.
// Generates irregular polygon regions from seed points within a rectangle.

import type { Point } from './geometry';

export interface VoronoiCell {
    seedX: number;
    seedY: number;
    vertices: Point[];
}

/**
 * Generate seed points with minimum-distance rejection sampling.
 * Ensures no two points are closer than `minDist`.
 */
function generateSeeds(
    width: number,
    height: number,
    count: number,
    minDist: number,
    rng: () => number,
    margin: number,
): Point[] {
    const seeds: Point[] = [];
    const maxAttempts = count * 100;
    let attempts = 0;

    while (seeds.length < count && attempts < maxAttempts) {
        attempts++;
        const x = margin + rng() * (width - 2 * margin);
        const y = margin + rng() * (height - 2 * margin);

        let tooClose = false;
        for (const s of seeds) {
            const dx = x - s.x;
            const dy = y - s.y;
            if (dx * dx + dy * dy < minDist * minDist) {
                tooClose = true;
                break;
            }
        }

        if (!tooClose) {
            seeds.push({ x, y });
        }
    }

    return seeds;
}

/**
 * Clip a convex polygon against a half-plane defined by a line.
 * The half-plane keeps all points on the LEFT side of the line from a to b.
 * Uses Sutherland-Hodgman algorithm for a single edge.
 */
function clipPolygonByLine(
    polygon: Point[],
    ax: number,
    ay: number,
    bx: number,
    by: number,
): Point[] {
    if (polygon.length === 0) return [];

    const output: Point[] = [];
    const n = polygon.length;

    for (let i = 0; i < n; i++) {
        const current = polygon[i];
        const next = polygon[(i + 1) % n];

        const currentSide = (bx - ax) * (current.y - ay) - (by - ay) * (current.x - ax);
        const nextSide = (bx - ax) * (next.y - ay) - (by - ay) * (next.x - ax);

        if (currentSide >= 0) {
            output.push(current);
        }

        // Check if edge crosses the line
        if ((currentSide >= 0) !== (nextSide >= 0)) {
            // Compute intersection
            const t = currentSide / (currentSide - nextSide);
            output.push({
                x: current.x + t * (next.x - current.x),
                y: current.y + t * (next.y - current.y),
            });
        }
    }

    return output;
}

/**
 * Generate a Voronoi tessellation within a rectangle.
 *
 * Algorithm: For each seed point, start with the full bounding rectangle
 * and clip it against the perpendicular bisector of every other seed.
 * The result is the Voronoi cell (convex polygon) for that seed.
 *
 * @param width - Rectangle width
 * @param height - Rectangle height
 * @param numCells - Number of Voronoi cells to generate
 * @param rng - Seeded random number generator
 * @returns Array of VoronoiCells with seed coordinates and polygon vertices
 */
export function generateVoronoi(
    width: number,
    height: number,
    numCells: number,
    rng: () => number,
): VoronoiCell[] {
    const minDist = Math.min(width, height) * 0.12;
    const margin = Math.min(width, height) * 0.08;
    const seeds = generateSeeds(width, height, numCells, minDist, rng, margin);

    const cells: VoronoiCell[] = [];

    for (const seed of seeds) {
        // Start with the full bounding rectangle
        let polygon: Point[] = [
            { x: 0, y: 0 },
            { x: width, y: 0 },
            { x: width, y: height },
            { x: 0, y: height },
        ];

        // Clip against each other seed's perpendicular bisector
        for (const other of seeds) {
            if (other === seed) continue;

            // Midpoint between seed and other
            const mx = (seed.x + other.x) / 2;
            const my = (seed.y + other.y) / 2;

            // Direction from seed to other
            const dx = other.x - seed.x;
            const dy = other.y - seed.y;

            // The perpendicular bisector line: we want to keep the side
            // closer to `seed`. The clipPolygonByLine function keeps points
            // on the LEFT side of A→B. We choose A and B so that the seed
            // falls on the left (positive) side of the line.
            const lineAx = mx + dy;
            const lineAy = my - dx;
            const lineBx = mx - dy;
            const lineBy = my + dx;

            polygon = clipPolygonByLine(polygon, lineAx, lineAy, lineBx, lineBy);

            if (polygon.length === 0) break;
        }

        cells.push({
            seedX: seed.x,
            seedY: seed.y,
            vertices: polygon,
        });
    }

    return cells;
}
