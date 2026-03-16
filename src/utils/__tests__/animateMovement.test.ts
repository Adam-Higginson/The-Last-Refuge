import { describe, it, expect } from 'vitest';
import { animateMovement } from '../animateMovement';

describe('animateMovement', () => {
    it('moves toward target proportionally to dt and speed', () => {
        const result = animateMovement({
            x: 0, y: 0,
            targetX: 200, targetY: 0,
            speed: 100,
        }, 1.0);

        expect(result.x).toBeCloseTo(100);
        expect(result.y).toBeCloseTo(0);
        expect(result.arrived).toBe(false);
    });

    it('snaps to target when step exceeds remaining distance', () => {
        const result = animateMovement({
            x: 0, y: 0,
            targetX: 50, targetY: 0,
            speed: 200,
        }, 1.0);

        expect(result.x).toBe(50);
        expect(result.y).toBe(0);
        expect(result.arrived).toBe(true);
    });

    it('snaps when distance is less than 1', () => {
        const result = animateMovement({
            x: 99.5, y: 0,
            targetX: 100, targetY: 0,
            speed: 10,
        }, 0.001);

        expect(result.x).toBe(100);
        expect(result.y).toBe(0);
        expect(result.arrived).toBe(true);
    });

    it('returns correct facing angle', () => {
        // Moving right → angle 0
        const right = animateMovement({
            x: 0, y: 0, targetX: 100, targetY: 0, speed: 50,
        }, 1.0);
        expect(right.facing).toBeCloseTo(0);

        // Moving down → angle PI/2
        const down = animateMovement({
            x: 0, y: 0, targetX: 0, targetY: 100, speed: 50,
        }, 1.0);
        expect(down.facing).toBeCloseTo(Math.PI / 2);
    });

    it('handles diagonal movement correctly', () => {
        const result = animateMovement({
            x: 0, y: 0,
            targetX: 100, targetY: 100,
            speed: Math.SQRT2 * 50,
        }, 1.0);

        expect(result.x).toBeCloseTo(50);
        expect(result.y).toBeCloseTo(50);
        expect(result.arrived).toBe(false);
    });
});
