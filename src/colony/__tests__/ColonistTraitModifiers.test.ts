import { describe, it, expect } from 'vitest';
import { applyTraitScheduleModifier, applyTraitSubActivityModifier } from '../ColonistTraitModifiers';
import type { ScheduleBlock } from '../ColonistSchedule';
import type { SubActivityResult } from '../ColonistSubActivity';
import type { Trait } from '../../components/CrewMemberComponent';

describe('ColonistTraitModifiers', () => {
    describe('applyTraitScheduleModifier', () => {
        const socialBlock: ScheduleBlock = {
            startHour: 17, endHour: 21,
            activity: 'socializing', location: 'social_area',
        };
        const workBlock: ScheduleBlock = {
            startHour: 5, endHour: 12,
            activity: 'working', location: 'workplace',
        };
        const restBlock: ScheduleBlock = {
            startHour: 0, endHour: 5,
            activity: 'resting', location: 'shelter',
        };
        const idleBlock: ScheduleBlock = {
            startHour: 12, endHour: 13,
            activity: 'idle', location: 'social_area',
        };

        it('Quiet trait converts some socializing to idle', () => {
            // Run across many entity IDs — some should convert
            let converted = 0;
            for (let id = 0; id < 100; id++) {
                const result = applyTraitScheduleModifier(socialBlock, ['Quiet', 'Determined'], id, 18);
                if (result.activity === 'idle') converted++;
            }
            // ~30% should convert
            expect(converted).toBeGreaterThan(10);
            expect(converted).toBeLessThan(60);
        });

        it('Reckless trait delays some work starts', () => {
            let delayed = 0;
            for (let id = 0; id < 100; id++) {
                const result = applyTraitScheduleModifier(workBlock, ['Reckless', 'Hopeful'], id, 5.3);
                if (result.activity === 'idle') delayed++;
            }
            // ~10% should delay
            expect(delayed).toBeGreaterThan(0);
            expect(delayed).toBeLessThan(30);
        });

        it('Reckless does not delay mid-shift', () => {
            for (let id = 0; id < 50; id++) {
                const result = applyTraitScheduleModifier(workBlock, ['Reckless', 'Hopeful'], id, 9);
                expect(result.activity).toBe('working');
            }
        });

        it('Hopeful trait converts idle to patrol location', () => {
            const result = applyTraitScheduleModifier(idleBlock, ['Hopeful', 'Determined'], 1, 12.5);
            expect(result.location).toBe('patrol');
        });

        it('Hopeful does not convert shelter idle', () => {
            const shelterIdle: ScheduleBlock = { ...idleBlock, location: 'shelter' };
            const result = applyTraitScheduleModifier(shelterIdle, ['Hopeful', 'Determined'], 1, 12.5);
            expect(result.location).toBe('shelter');
        });

        it('Haunted trait wakes some colonists early', () => {
            let woke = 0;
            for (let id = 0; id < 100; id++) {
                const result = applyTraitScheduleModifier(restBlock, ['Haunted', 'Determined'], id, 4);
                if (result.activity === 'idle') woke++;
            }
            expect(woke).toBeGreaterThan(5);
            expect(woke).toBeLessThan(40);
        });

        it('Haunted does not wake outside early window', () => {
            for (let id = 0; id < 50; id++) {
                const result = applyTraitScheduleModifier(restBlock, ['Haunted', 'Determined'], id, 1);
                expect(result.activity).toBe('resting');
            }
        });

        it('unmatched traits return schedule unchanged', () => {
            const result = applyTraitScheduleModifier(workBlock, ['Analytical', 'Empathetic'], 1, 9);
            expect(result).toEqual(workBlock);
        });

        it('no-op for non-triggering activities', () => {
            const eating: ScheduleBlock = {
                startHour: 12, endHour: 13,
                activity: 'eating', location: 'social_area',
            };
            const result = applyTraitScheduleModifier(eating, ['Quiet', 'Haunted'], 1, 12.5);
            expect(result).toEqual(eating);
        });
    });

    describe('applyTraitSubActivityModifier', () => {
        it('Analytical doubles calibrating duration', () => {
            const input: SubActivityResult = { subActivity: 'calibrating', duration: 5 };
            const result = applyTraitSubActivityModifier(input, ['Analytical', 'Determined']);
            expect(result.subActivity).toBe('calibrating');
            expect(result.duration).toBe(10);
        });

        it('Analytical does not affect non-calibrating', () => {
            const input: SubActivityResult = { subActivity: 'hammering', duration: 5 };
            const result = applyTraitSubActivityModifier(input, ['Analytical', 'Determined']);
            expect(result.duration).toBe(5);
        });

        it('non-Analytical traits do not modify anything', () => {
            const input: SubActivityResult = { subActivity: 'calibrating', duration: 5 };
            const result = applyTraitSubActivityModifier(input, ['Hopeful', 'Quiet']);
            expect(result.duration).toBe(5);
        });

        it('handles all trait combinations without error', () => {
            const allTraits: Trait[] = [
                'Stubborn', 'Empathetic', 'Reckless', 'Analytical',
                'Protective', 'Haunted', 'Resourceful', 'Quiet',
                'Hopeful', 'Grieving', 'Determined',
            ];
            const input: SubActivityResult = { subActivity: 'standing', duration: 4 };
            for (const t1 of allTraits) {
                for (const t2 of allTraits) {
                    if (t1 === t2) continue;
                    const result = applyTraitSubActivityModifier(input, [t1, t2]);
                    expect(result.duration).toBeGreaterThan(0);
                }
            }
        });
    });
});
