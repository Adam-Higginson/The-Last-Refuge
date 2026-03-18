import { describe, it, expect } from 'vitest';
import {
    resolveWorkSubActivity,
    resolveIdleSubActivity,
    resolveSocializingSubActivity,
    resolveEatingSubActivity,
    seededChoice,
} from '../ColonistSubActivity';
import type { CrewRole } from '../../components/CrewMemberComponent';

describe('ColonistSubActivity', () => {
    describe('seededChoice', () => {
        it('returns deterministic result for same inputs', () => {
            const items = ['a', 'b', 'c', 'd'];
            const result1 = seededChoice(42, items, 7);
            const result2 = seededChoice(42, items, 7);
            expect(result1).toBe(result2);
        });

        it('returns different results for different entity IDs', () => {
            const items = ['a', 'b', 'c', 'd', 'e', 'f'];
            const results = new Set<string>();
            for (let id = 0; id < 20; id++) {
                results.add(seededChoice(id, items, 0));
            }
            // Should produce at least 2 different results across 20 IDs
            expect(results.size).toBeGreaterThan(1);
        });

        it('returns different results for different salts', () => {
            const items = ['a', 'b', 'c', 'd', 'e', 'f'];
            const results = new Set<string>();
            for (let salt = 0; salt < 20; salt++) {
                results.add(seededChoice(1, items, salt));
            }
            expect(results.size).toBeGreaterThan(1);
        });
    });

    describe('resolveWorkSubActivity', () => {
        const WORK_SUB_ACTIVITIES = ['hammering', 'carrying', 'watering', 'harvesting', 'checking_patient', 'calibrating'];

        it('returns valid sub-activity for each role/building combo', () => {
            const cases: [CrewRole, string][] = [
                ['Civilian', 'farm'],
                ['Engineer', 'workshop'],
                ['Medic', 'med_bay'],
                ['Scientist', 'workshop'],
                ['Soldier', 'barracks'],
                ['Engineer', 'solar_array'],
                ['Civilian', 'hydroponics_bay'],
            ];

            for (const [role, building] of cases) {
                const result = resolveWorkSubActivity(role, building, 1, 0);
                expect(WORK_SUB_ACTIVITIES).toContain(result.subActivity);
            }
        });

        it('returns valid sub-activity when building type is null', () => {
            const result = resolveWorkSubActivity('Civilian', null, 1, 0);
            expect(WORK_SUB_ACTIVITIES).toContain(result.subActivity);
        });

        it('returns duration in range [3, 8]', () => {
            for (let i = 0; i < 50; i++) {
                const result = resolveWorkSubActivity('Engineer', 'workshop', i, i * 5);
                expect(result.duration).toBeGreaterThanOrEqual(3);
                expect(result.duration).toBeLessThanOrEqual(8);
            }
        });

        it('produces varied results across entity IDs', () => {
            const results = new Set<string>();
            for (let id = 0; id < 30; id++) {
                results.add(resolveWorkSubActivity('Engineer', 'workshop', id, 0).subActivity);
            }
            expect(results.size).toBeGreaterThan(1);
        });
    });

    describe('resolveIdleSubActivity', () => {
        const IDLE_SUB_ACTIVITIES = ['standing', 'stretching', 'sitting', 'looking_around'];

        it('returns valid idle sub-activity', () => {
            for (let i = 0; i < 30; i++) {
                const result = resolveIdleSubActivity(i, i * 4);
                expect(IDLE_SUB_ACTIVITIES).toContain(result.subActivity);
            }
        });

        it('returns duration in range [3, 8]', () => {
            for (let i = 0; i < 50; i++) {
                const result = resolveIdleSubActivity(i, i * 4);
                expect(result.duration).toBeGreaterThanOrEqual(3);
                expect(result.duration).toBeLessThanOrEqual(8);
            }
        });

        it('standing is the most common result (60% weight)', () => {
            let standingCount = 0;
            const total = 100;
            for (let i = 0; i < total; i++) {
                const result = resolveIdleSubActivity(i, i);
                if (result.subActivity === 'standing') standingCount++;
            }
            // Should be roughly 60% ± wide margin for seeded PRNG
            expect(standingCount).toBeGreaterThan(30);
        });
    });

    describe('resolveSocializingSubActivity', () => {
        const SOCIAL_SUB_ACTIVITIES = ['chatting', 'laughing', 'gesturing', 'sitting_together'];

        it('returns sitting_together when alone', () => {
            const result = resolveSocializingSubActivity(1, 0, 0);
            expect(result.subActivity).toBe('sitting_together');
        });

        it('returns sitting_together with just one nearby', () => {
            const result = resolveSocializingSubActivity(1, 0, 1);
            expect(result.subActivity).toBe('sitting_together');
        });

        it('returns group activity when multiple nearby', () => {
            const results = new Set<string>();
            for (let i = 0; i < 30; i++) {
                const result = resolveSocializingSubActivity(i, i * 5, 5);
                results.add(result.subActivity);
                expect(SOCIAL_SUB_ACTIVITIES).toContain(result.subActivity);
            }
            // With 5 nearby, should get chatting/laughing/gesturing (not sitting_together)
            expect(results.has('sitting_together')).toBe(false);
        });

        it('returns duration in range [4, 8]', () => {
            for (let i = 0; i < 50; i++) {
                const result = resolveSocializingSubActivity(i, i * 5, 3);
                expect(result.duration).toBeGreaterThanOrEqual(4);
                expect(result.duration).toBeLessThanOrEqual(8);
            }
        });
    });

    describe('resolveEatingSubActivity', () => {
        it('returns sitting_eating or eating_standing', () => {
            const results = new Set<string>();
            for (let i = 0; i < 30; i++) {
                const result = resolveEatingSubActivity(i);
                results.add(result.subActivity);
                expect(['sitting_eating', 'eating_standing']).toContain(result.subActivity);
            }
            // Should produce both variants across 30 entity IDs
            expect(results.size).toBe(2);
        });

        it('returns duration in range [5, 8]', () => {
            for (let i = 0; i < 50; i++) {
                const result = resolveEatingSubActivity(i);
                expect(result.duration).toBeGreaterThanOrEqual(5);
                expect(result.duration).toBeLessThanOrEqual(8);
            }
        });
    });
});
