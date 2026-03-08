import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../prng';

describe('mulberry32', () => {
    it('produces values in [0, 1)', () => {
        const rng = mulberry32(42);
        for (let i = 0; i < 1000; i++) {
            const val = rng();
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThan(1);
        }
    });

    it('produces a deterministic sequence for the same seed', () => {
        const rng1 = mulberry32(42);
        const rng2 = mulberry32(42);
        for (let i = 0; i < 100; i++) {
            expect(rng1()).toBe(rng2());
        }
    });

    it('produces different sequences for different seeds', () => {
        const rng1 = mulberry32(42);
        const rng2 = mulberry32(99);
        // Very unlikely that even the first value matches
        const seq1 = Array.from({ length: 10 }, () => rng1());
        const seq2 = Array.from({ length: 10 }, () => rng2());
        expect(seq1).not.toEqual(seq2);
    });

    it('produces varied output (not all the same value)', () => {
        const rng = mulberry32(42);
        const values = new Set(Array.from({ length: 100 }, () => rng()));
        // 100 values should all be unique (or very nearly)
        expect(values.size).toBeGreaterThan(90);
    });
});
