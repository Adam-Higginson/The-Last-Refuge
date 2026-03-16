import { describe, it, expect } from 'vitest';
import { forceLayout, computeConvexHull, clampViewBox } from '../graphMath';

describe('forceLayout', () => {
    it('two connected nodes converge', () => {
        const nodes = [
            { id: 1, x: 0, y: 0, connectionCount: 1 },
            { id: 2, x: 1000, y: 1000, connectionCount: 1 },
        ];
        const edges = [{ source: 1, target: 2 }];

        const result = forceLayout(nodes, edges, { iterations: 50, width: 1000, height: 1000, seed: 42 });
        const d = Math.sqrt((result[0].x - result[1].x) ** 2 + (result[0].y - result[1].y) ** 2);

        // Connected nodes should be closer than the initial ~1414px diagonal
        expect(d).toBeLessThan(1200);
    });

    it('two unconnected nodes repel', () => {
        const nodes = [
            { id: 1, x: 500, y: 500, connectionCount: 0 },
            { id: 2, x: 510, y: 510, connectionCount: 0 },
        ];
        const edges: { source: number; target: number }[] = [];

        const result = forceLayout(nodes, edges, { iterations: 50, width: 1000, height: 1000, seed: 42 });
        const d = Math.sqrt((result[0].x - result[1].x) ** 2 + (result[0].y - result[1].y) ** 2);

        // Unconnected nodes should spread apart
        expect(d).toBeGreaterThan(50);
    });

    it('all nodes no edges spread evenly via repulsion', () => {
        const nodes = Array.from({ length: 5 }, (_, i) => ({
            id: i, x: 500, y: 500, connectionCount: 0,
        }));
        const edges: { source: number; target: number }[] = [];

        const result = forceLayout(nodes, edges, { iterations: 80, width: 1000, height: 1000, seed: 42 });

        // All nodes should be at unique-ish positions (not stacked)
        for (let i = 0; i < result.length; i++) {
            for (let j = i + 1; j < result.length; j++) {
                const d = Math.sqrt((result[i].x - result[j].x) ** 2 + (result[i].y - result[j].y) ** 2);
                expect(d).toBeGreaterThan(10);
            }
        }
    });

    it('NaN guard produces finite coordinates', () => {
        // All nodes at exactly the same position — would cause distance=0
        const nodes = [
            { id: 1, x: 500, y: 500, connectionCount: 0 },
            { id: 2, x: 500, y: 500, connectionCount: 0 },
        ];
        const edges: { source: number; target: number }[] = [];

        const result = forceLayout(nodes, edges, { iterations: 10, seed: 42 });
        for (const node of result) {
            expect(isFinite(node.x)).toBe(true);
            expect(isFinite(node.y)).toBe(true);
        }
    });

    it('bounds clamping works', () => {
        const nodes = [
            { id: 1, x: -9999, y: -9999, connectionCount: 0 },
            { id: 2, x: 9999, y: 9999, connectionCount: 0 },
        ];
        const edges: { source: number; target: number }[] = [];

        const result = forceLayout(nodes, edges, { iterations: 10, width: 800, height: 600, seed: 42 });
        for (const node of result) {
            expect(node.x).toBeGreaterThanOrEqual(0);
            expect(node.x).toBeLessThanOrEqual(800);
            expect(node.y).toBeGreaterThanOrEqual(0);
            expect(node.y).toBeLessThanOrEqual(600);
        }
    });

    it('is deterministic with same seed', () => {
        const nodes = [
            { id: 1, x: 100, y: 100, connectionCount: 1 },
            { id: 2, x: 900, y: 900, connectionCount: 1 },
            { id: 3, x: 500, y: 200, connectionCount: 2 },
        ];
        const edges = [{ source: 1, target: 2 }, { source: 2, target: 3 }];

        const result1 = forceLayout(nodes, edges, { seed: 123 });
        const result2 = forceLayout(nodes, edges, { seed: 123 });

        expect(result1).toEqual(result2);
    });
});

describe('computeConvexHull', () => {
    it('returns a hull for a triangle', () => {
        const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
        const hull = computeConvexHull(points);
        expect(hull).toHaveLength(3);
    });

    it('returns a hull for a square with interior point', () => {
        const points = [
            { x: 0, y: 0 }, { x: 10, y: 0 },
            { x: 10, y: 10 }, { x: 0, y: 10 },
            { x: 5, y: 5 }, // interior
        ];
        const hull = computeConvexHull(points);
        expect(hull).toHaveLength(4);
    });

    it('returns empty for collinear points', () => {
        const points = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }];
        const hull = computeConvexHull(points);
        expect(hull).toHaveLength(0);
    });

    it('returns empty for fewer than 3 points', () => {
        expect(computeConvexHull([])).toHaveLength(0);
        expect(computeConvexHull([{ x: 0, y: 0 }])).toHaveLength(0);
        expect(computeConvexHull([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toHaveLength(0);
    });
});

describe('clampViewBox', () => {
    const bounds = { minZoom: 0.5, maxZoom: 3, worldWidth: 1000, worldHeight: 1000 };

    it('clamps zoom to min', () => {
        const vb = clampViewBox(1000, 1000, 0.1, 0, 0, bounds);
        // zoom clamped to 0.5 → vbWidth = 1000/0.5 = 2000
        expect(vb.width).toBe(2000);
    });

    it('clamps zoom to max', () => {
        const vb = clampViewBox(1000, 1000, 10, 0, 0, bounds);
        // zoom clamped to 3 → vbWidth = 1000/3 ≈ 333.33
        expect(vb.width).toBeCloseTo(333.33, 1);
    });

    it('clamps pan to bounds', () => {
        const vb = clampViewBox(500, 500, 1, -100, -100, bounds);
        expect(vb.x).toBe(0);
        expect(vb.y).toBe(0);
    });

    it('clamps pan max to keep viewBox inside world', () => {
        const vb = clampViewBox(500, 500, 1, 9999, 9999, bounds);
        // vbWidth = 500, so maxPanX = 1000 - 500 = 500
        expect(vb.x).toBe(500);
        expect(vb.y).toBe(500);
    });
});
