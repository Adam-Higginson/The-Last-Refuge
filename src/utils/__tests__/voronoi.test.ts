import { describe, it, expect } from 'vitest';
import { generateVoronoi } from '../voronoi';
import { mulberry32 } from '../prng';

describe('generateVoronoi', () => {
    const width = 400;
    const height = 300;
    const numCells = 8;

    it('returns the requested number of cells', () => {
        const rng = mulberry32(42);
        const cells = generateVoronoi(width, height, numCells, rng);
        expect(cells).toHaveLength(numCells);
    });

    it('each cell has a seed point and non-empty polygon', () => {
        const rng = mulberry32(42);
        const cells = generateVoronoi(width, height, numCells, rng);

        for (const cell of cells) {
            expect(cell.seedX).toBeGreaterThanOrEqual(0);
            expect(cell.seedX).toBeLessThanOrEqual(width);
            expect(cell.seedY).toBeGreaterThanOrEqual(0);
            expect(cell.seedY).toBeLessThanOrEqual(height);
            expect(cell.vertices.length).toBeGreaterThanOrEqual(3);
        }
    });

    it('produces deterministic output for same seed', () => {
        const rng1 = mulberry32(99);
        const cells1 = generateVoronoi(width, height, numCells, rng1);

        const rng2 = mulberry32(99);
        const cells2 = generateVoronoi(width, height, numCells, rng2);

        expect(cells1).toEqual(cells2);
    });

    it('produces different output for different seeds', () => {
        const rng1 = mulberry32(1);
        const cells1 = generateVoronoi(width, height, numCells, rng1);

        const rng2 = mulberry32(2);
        const cells2 = generateVoronoi(width, height, numCells, rng2);

        // At least one seed point should differ
        const same = cells1.every(
            (c, i) => c.seedX === cells2[i].seedX && c.seedY === cells2[i].seedY,
        );
        expect(same).toBe(false);
    });

    it('polygon vertices are finite numbers', () => {
        const rng = mulberry32(42);
        const cells = generateVoronoi(width, height, numCells, rng);

        for (const cell of cells) {
            for (const v of cell.vertices) {
                expect(Number.isFinite(v.x)).toBe(true);
                expect(Number.isFinite(v.y)).toBe(true);
            }
        }
    });

    it('works with a small number of cells', () => {
        const rng = mulberry32(10);
        const cells = generateVoronoi(200, 200, 3, rng);
        expect(cells).toHaveLength(3);
        for (const cell of cells) {
            expect(cell.vertices.length).toBeGreaterThanOrEqual(3);
        }
    });
});
