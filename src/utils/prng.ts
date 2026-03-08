// prng.ts — Seeded pseudo-random number generator (mulberry32).
// Produces deterministic sequences for reproducible procedural generation
// (e.g. star field positions stay consistent across canvas resizes).

/** Returns a function that yields the next pseudo-random number in [0, 1). */
export function mulberry32(seed: number): () => number {
    let s = seed | 0;
    return (): number => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
