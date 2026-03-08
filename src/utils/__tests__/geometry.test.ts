import { describe, it, expect } from 'vitest';
import { pointInPolygon, polygonCentroid } from '../geometry';

describe('pointInPolygon', () => {
    // Simple square from (0,0) to (10,10)
    const square = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
    ];

    it('returns true for a point inside the polygon', () => {
        expect(pointInPolygon(5, 5, square)).toBe(true);
    });

    it('returns true for a point near the interior', () => {
        expect(pointInPolygon(1, 1, square)).toBe(true);
        expect(pointInPolygon(9, 9, square)).toBe(true);
    });

    it('returns false for a point outside the polygon', () => {
        expect(pointInPolygon(15, 5, square)).toBe(false);
        expect(pointInPolygon(-1, 5, square)).toBe(false);
        expect(pointInPolygon(5, -1, square)).toBe(false);
        expect(pointInPolygon(5, 15, square)).toBe(false);
    });

    it('works with a triangle', () => {
        const triangle = [
            { x: 0, y: 0 },
            { x: 20, y: 0 },
            { x: 10, y: 20 },
        ];
        expect(pointInPolygon(10, 5, triangle)).toBe(true);
        expect(pointInPolygon(0, 20, triangle)).toBe(false);
    });

    it('returns false for an empty vertex list', () => {
        expect(pointInPolygon(5, 5, [])).toBe(false);
    });

    it('returns false for a degenerate polygon (2 vertices)', () => {
        const line = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
        expect(pointInPolygon(5, 5, line)).toBe(false);
    });
});

describe('polygonCentroid', () => {
    it('returns the average of vertices', () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
        ];
        const c = polygonCentroid(square);
        expect(c.x).toBe(5);
        expect(c.y).toBe(5);
    });

    it('works with a triangle', () => {
        const triangle = [
            { x: 0, y: 0 },
            { x: 6, y: 0 },
            { x: 3, y: 9 },
        ];
        const c = polygonCentroid(triangle);
        expect(c.x).toBe(3);
        expect(c.y).toBe(3);
    });

    it('handles a single vertex', () => {
        const c = polygonCentroid([{ x: 7, y: 3 }]);
        expect(c.x).toBe(7);
        expect(c.y).toBe(3);
    });
});
