// geometry.ts — Geometric utilities for region hit-testing.

export interface Point {
    x: number;
    y: number;
}

/**
 * Ray-casting point-in-polygon test.
 * Returns true if the point (px, py) lies inside the polygon defined
 * by the given vertices. Edges are considered inside.
 */
export function pointInPolygon(px: number, py: number, vertices: Point[]): boolean {
    const n = vertices.length;
    let inside = false;

    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = vertices[i].x;
        const yi = vertices[i].y;
        const xj = vertices[j].x;
        const yj = vertices[j].y;

        if ((yi > py) !== (yj > py) &&
            px < (xj - xi) * (py - yi) / (yj - yi) + xi) {
            inside = !inside;
        }
    }

    return inside;
}

/**
 * Compute the centroid of a polygon.
 */
export function polygonCentroid(vertices: Point[]): Point {
    let cx = 0;
    let cy = 0;
    for (const v of vertices) {
        cx += v.x;
        cy += v.y;
    }
    return { x: cx / vertices.length, y: cy / vertices.length };
}
