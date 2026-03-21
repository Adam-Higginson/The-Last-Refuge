import { describe, it, expect } from 'vitest';
import { ParticlePool } from '../ParticlePool';

describe('ParticlePool', () => {
    it('pre-allocates all particles as inactive', () => {
        const pool = new ParticlePool(10);
        expect(pool.particles).toHaveLength(10);
        expect(pool.activeCount).toBe(0);
        for (const p of pool.particles) {
            expect(p.active).toBe(false);
        }
    });

    it('spawn activates the first inactive particle', () => {
        const pool = new ParticlePool(5);
        pool.spawn({ x: 10, y: 20, color: '#f00', size: 3 });

        expect(pool.activeCount).toBe(1);
        const p = pool.particles[0];
        expect(p.active).toBe(true);
        expect(p.x).toBe(10);
        expect(p.y).toBe(20);
        expect(p.color).toBe('#f00');
        expect(p.size).toBe(3);
    });

    it('spawn uses defaults for unspecified fields', () => {
        const pool = new ParticlePool(3);
        pool.spawn({ x: 5, y: 10 });

        const p = pool.particles[0];
        expect(p.vx).toBe(0);
        expect(p.vy).toBe(-20);
        expect(p.life).toBe(1);
        expect(p.maxLife).toBe(2);
        expect(p.alpha).toBe(0.2);
        expect(p.color).toBe('#999');
    });

    it('spawn fills subsequent slots', () => {
        const pool = new ParticlePool(3);
        pool.spawn({ x: 1, y: 1 });
        pool.spawn({ x: 2, y: 2 });
        pool.spawn({ x: 3, y: 3 });

        expect(pool.activeCount).toBe(3);
        expect(pool.particles[0].x).toBe(1);
        expect(pool.particles[1].x).toBe(2);
        expect(pool.particles[2].x).toBe(3);
    });

    it('pool exhaustion silently drops new spawns', () => {
        const pool = new ParticlePool(2);
        pool.spawn({ x: 1, y: 1 });
        pool.spawn({ x: 2, y: 2 });
        // Pool full — this should not throw
        pool.spawn({ x: 3, y: 3 });

        expect(pool.activeCount).toBe(2);
        // No particle has x=3
        expect(pool.particles.every(p => p.x !== 3)).toBe(true);
    });

    it('update advances position by velocity + wind', () => {
        const pool = new ParticlePool(1);
        pool.spawn({ x: 100, y: 200, vx: 10, vy: -20, maxLife: 2, life: 1 });

        pool.update(0.5, 5, -2); // dt=0.5s, windX=5, windY=-2

        const p = pool.particles[0];
        // x = 100 + (10 + 5) * 0.5 = 107.5
        expect(p.x).toBeCloseTo(107.5);
        // y = 200 + (-20 + -2) * 0.5 = 189
        expect(p.y).toBeCloseTo(189);
    });

    it('update decreases life and deactivates when expired', () => {
        const pool = new ParticlePool(1);
        pool.spawn({ x: 0, y: 0, life: 1, maxLife: 1 });

        expect(pool.activeCount).toBe(1);

        // After 0.5s, life should be 0.5
        pool.update(0.5, 0, 0);
        expect(pool.particles[0].life).toBeCloseTo(0.5);
        expect(pool.particles[0].active).toBe(true);

        // After another 0.6s, life should be <= 0
        pool.update(0.6, 0, 0);
        expect(pool.particles[0].active).toBe(false);
    });

    it('deactivated particles can be reused by spawn', () => {
        const pool = new ParticlePool(1);
        pool.spawn({ x: 10, y: 10, life: 1, maxLife: 0.5 });

        // Expire the particle
        pool.update(1, 0, 0);
        expect(pool.activeCount).toBe(0);

        // Spawn into the now-free slot
        pool.spawn({ x: 50, y: 50 });
        expect(pool.activeCount).toBe(1);
        expect(pool.particles[0].x).toBe(50);
    });

    it('update with zero wind does not drift', () => {
        const pool = new ParticlePool(1);
        pool.spawn({ x: 0, y: 0, vx: 0, vy: 0, life: 1, maxLife: 10 });

        pool.update(1, 0, 0);

        expect(pool.particles[0].x).toBe(0);
        expect(pool.particles[0].y).toBe(0);
    });

    it('draw does not throw with no active particles', () => {
        const pool = new ParticlePool(5);
        // Minimal canvas mock
        const ctx = {
            save: (): void => { /* noop */ },
            restore: (): void => { /* noop */ },
            beginPath: (): void => { /* noop */ },
            arc: (): void => { /* noop */ },
            fill: (): void => { /* noop */ },
            globalAlpha: 1,
            fillStyle: '',
        } as unknown as CanvasRenderingContext2D;

        expect(() => pool.draw(ctx)).not.toThrow();
    });
});
