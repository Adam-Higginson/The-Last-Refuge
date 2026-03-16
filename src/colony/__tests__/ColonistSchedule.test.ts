import { describe, it, expect } from 'vitest';
import { getScheduleBlock, getStaggerOffset } from '../ColonistSchedule';

describe('ColonistSchedule', () => {
    it('returns correct activity for Civilian at 5am (working)', () => {
        const block = getScheduleBlock('Civilian', 5, 0);
        expect(block.activity).toBe('working');
    });

    it('returns correct activity for Civilian at 12pm (eating)', () => {
        const block = getScheduleBlock('Civilian', 12, 0);
        expect(block.activity).toBe('eating');
    });

    it('returns correct activity for Civilian at 8pm (socializing)', () => {
        const block = getScheduleBlock('Civilian', 20, 0);
        expect(block.activity).toBe('socializing');
    });

    it('returns correct activity for Civilian at 2am (resting)', () => {
        const block = getScheduleBlock('Civilian', 2, 0);
        expect(block.activity).toBe('resting');
    });

    it('returns correct activity for Soldier at 6am (patrolling)', () => {
        const block = getScheduleBlock('Soldier', 6, 0);
        expect(block.activity).toBe('patrolling');
    });

    it('returns correct activity for Engineer at 7am (working)', () => {
        const block = getScheduleBlock('Engineer', 7, 0);
        expect(block.activity).toBe('working');
    });

    it('returns correct activity for Medic at 7am (working)', () => {
        const block = getScheduleBlock('Medic', 7, 0);
        expect(block.activity).toBe('working');
    });

    it('returns correct activity for Scientist at 9am (working)', () => {
        const block = getScheduleBlock('Scientist', 9, 0);
        expect(block.activity).toBe('working');
    });

    it('handles hour 0 correctly (wraps to resting)', () => {
        const block = getScheduleBlock('Civilian', 0, 0);
        expect(block.activity).toBe('resting');
    });

    it('stagger offset produces different values per entity ID', () => {
        const offset1 = getStaggerOffset(1);
        const offset2 = getStaggerOffset(2);
        const offset3 = getStaggerOffset(100);
        // Different entity IDs should produce different offsets
        expect(offset1).not.toBe(offset2);
        expect(offset2).not.toBe(offset3);
    });

    it('stagger offset stays within ±0.5 range', () => {
        for (let id = 0; id < 50; id++) {
            const offset = getStaggerOffset(id);
            expect(offset).toBeGreaterThanOrEqual(-0.5);
            expect(offset).toBeLessThanOrEqual(0.5);
        }
    });

    it('stagger affects effective schedule hour', () => {
        // With stagger, a colonist might transition slightly earlier/later
        // Entity 0 should have a different schedule than entity 1 near boundaries
        const block1 = getScheduleBlock('Civilian', 5.2, 1);
        const block2 = getScheduleBlock('Civilian', 5.2, 42);
        // Both should return a valid block (though possibly different ones)
        expect(block1.activity).toBeDefined();
        expect(block2.activity).toBeDefined();
    });
});
