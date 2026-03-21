import { describe, it, expect } from 'vitest';
import { getBaseScore, getTraitModifiers, getSkillScore, getRelationshipModifier } from '../combatSkills';
import { CrewMemberComponent } from '../../components/CrewMemberComponent';
import type { SkillType } from '../combatSkills';
import type { CrewRole } from '../../components/CrewMemberComponent';

describe('combatSkills', () => {
    describe('getBaseScore', () => {
        it('returns primary skill score within range for Soldier', () => {
            const score = getBaseScore('Soldier', 'combat', 10);
            expect(score).toBeGreaterThanOrEqual(6);
            expect(score).toBeLessThanOrEqual(8);
        });

        it('returns secondary skill score within range for Soldier', () => {
            const score = getBaseScore('Soldier', 'leadership', 10);
            expect(score).toBeGreaterThanOrEqual(3);
            expect(score).toBeLessThanOrEqual(5);
        });

        it('returns DEFAULT_BASE for unrelated skills', () => {
            expect(getBaseScore('Soldier', 'medical', 0)).toBe(1);
            expect(getBaseScore('Pilot', 'medical', 0)).toBe(1);
            expect(getBaseScore('Engineer', 'medical', 0)).toBe(1);
        });

        it('returns deterministic scores seeded by entity ID', () => {
            const score1 = getBaseScore('Pilot', 'piloting', 42);
            const score2 = getBaseScore('Pilot', 'piloting', 42);
            expect(score1).toBe(score2);
        });

        it('produces variation across entity IDs', () => {
            const scores = new Set<number>();
            for (let id = 0; id < 10; id++) {
                scores.add(getBaseScore('Pilot', 'piloting', id));
            }
            expect(scores.size).toBeGreaterThan(1);
        });

        it('returns correct range for every role/primary combo', () => {
            const rolePrimaries: Array<[CrewRole, SkillType, number, number]> = [
                ['Soldier', 'combat', 6, 8],
                ['Pilot', 'piloting', 6, 8],
                ['Engineer', 'engineering', 6, 8],
                ['Scientist', 'engineering', 5, 7],
                ['Medic', 'medical', 6, 8],
            ];
            for (const [role, skill, min, max] of rolePrimaries) {
                for (let id = 0; id < 20; id++) {
                    const score = getBaseScore(role, skill, id);
                    expect(score).toBeGreaterThanOrEqual(min);
                    expect(score).toBeLessThanOrEqual(max);
                }
            }
        });

        it('Civilian gets one primary skill seeded by entity ID', () => {
            const score = getBaseScore('Civilian', 'piloting', 0);
            // entityId 0 % 5 = 0, skills[0] = 'piloting', so this is primary
            expect(score).toBeGreaterThanOrEqual(3);
            expect(score).toBeLessThanOrEqual(4);
        });

        it('Civilian gets DEFAULT_BASE for non-primary skills', () => {
            // entityId 0 → primary is 'piloting', others should be 1
            expect(getBaseScore('Civilian', 'combat', 0)).toBe(1);
            expect(getBaseScore('Civilian', 'engineering', 0)).toBe(1);
        });
    });

    describe('getTraitModifiers', () => {
        it('returns 0 for traits with no modifier for the skill', () => {
            expect(getTraitModifiers(['Quiet', 'Hopeful'], 'combat')).toBe(0);
        });

        it('returns correct positive modifier', () => {
            expect(getTraitModifiers(['Determined'], 'combat')).toBe(1);
            expect(getTraitModifiers(['Reckless'], 'piloting')).toBe(2);
        });

        it('returns correct negative modifier', () => {
            expect(getTraitModifiers(['Reckless'], 'engineering')).toBe(-1);
            expect(getTraitModifiers(['Haunted'], 'leadership')).toBe(-1);
        });

        it('stacks modifiers from multiple traits', () => {
            // Stubborn: combat +1, Determined: combat +1
            expect(getTraitModifiers(['Stubborn', 'Determined'], 'combat')).toBe(2);
        });

        it('handles mixed positive and negative modifiers', () => {
            // Protective: leadership +1, Stubborn: leadership -1
            expect(getTraitModifiers(['Protective', 'Stubborn'], 'leadership')).toBe(0);
        });

        it('returns 0 for empty traits array', () => {
            expect(getTraitModifiers([], 'combat')).toBe(0);
        });
    });

    describe('getSkillScore', () => {
        it('combines base + traits + leader bonus', () => {
            const crew = new CrewMemberComponent('Test', 30, 'Soldier', 70, ['Determined', 'Quiet'], 'test');
            crew.isLeader = true;
            // Base combat: 6-8 (seeded by entityId 1)
            // Determined: +1 combat
            // Leader bonus: only for leadership
            const score = getSkillScore(crew, 'combat', 1);
            expect(score).toBeGreaterThanOrEqual(7); // min 6 + 1
            expect(score).toBeLessThanOrEqual(9);   // max 8 + 1
        });

        it('applies leader bonus of +3 to leadership skill only', () => {
            const crew = new CrewMemberComponent('Leader', 30, 'Medic', 70, ['Quiet', 'Hopeful'], 'test');
            crew.isLeader = true;
            const leaderScore = getSkillScore(crew, 'leadership', 0);
            crew.isLeader = false;
            const normalScore = getSkillScore(crew, 'leadership', 0);
            expect(leaderScore - normalScore).toBe(3);
        });

        it('returns minimum 0 even with negative modifiers', () => {
            const crew = new CrewMemberComponent('Test', 30, 'Civilian', 70, ['Reckless', 'Haunted'], 'test');
            // Civilian engineering base = 1, Reckless: -1 eng = 0
            const score = getSkillScore(crew, 'engineering', 5);
            expect(score).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getRelationshipModifier', () => {
        it('returns +1 for bond (level >= 70)', () => {
            const crew = new CrewMemberComponent('A', 30, 'Soldier', 70, ['Determined', 'Quiet'], 'test');
            crew.relationships = [{ targetId: 2, targetName: 'B', type: 'Close Bond', level: 75, description: 'friends' }];
            expect(getRelationshipModifier(crew, 2)).toBe(1);
        });

        it('returns -1 for rivalry (level <= 30)', () => {
            const crew = new CrewMemberComponent('A', 30, 'Soldier', 70, ['Determined', 'Quiet'], 'test');
            crew.relationships = [{ targetId: 2, targetName: 'B', type: 'Rival', level: 25, description: 'rivals' }];
            expect(getRelationshipModifier(crew, 2)).toBe(-1);
        });

        it('returns 0 for neutral (31-69)', () => {
            const crew = new CrewMemberComponent('A', 30, 'Soldier', 70, ['Determined', 'Quiet'], 'test');
            crew.relationships = [{ targetId: 2, targetName: 'B', type: 'Close Bond', level: 50, description: 'acquaintances' }];
            expect(getRelationshipModifier(crew, 2)).toBe(0);
        });

        it('returns 0 for no relationship', () => {
            const crew = new CrewMemberComponent('A', 30, 'Soldier', 70, ['Determined', 'Quiet'], 'test');
            crew.relationships = [];
            expect(getRelationshipModifier(crew, 999)).toBe(0);
        });

        it('returns +1 at exact threshold 70', () => {
            const crew = new CrewMemberComponent('A', 30, 'Soldier', 70, ['Determined', 'Quiet'], 'test');
            crew.relationships = [{ targetId: 2, targetName: 'B', type: 'Close Bond', level: 70, description: 'friends' }];
            expect(getRelationshipModifier(crew, 2)).toBe(1);
        });

        it('returns -1 at exact threshold 30', () => {
            const crew = new CrewMemberComponent('A', 30, 'Soldier', 70, ['Determined', 'Quiet'], 'test');
            crew.relationships = [{ targetId: 2, targetName: 'B', type: 'Rival', level: 30, description: 'rivals' }];
            expect(getRelationshipModifier(crew, 2)).toBe(-1);
        });

        it('returns 0 at level 31 (just above rivalry threshold)', () => {
            const crew = new CrewMemberComponent('A', 30, 'Soldier', 70, ['Determined', 'Quiet'], 'test');
            crew.relationships = [{ targetId: 2, targetName: 'B', type: 'Rival', level: 31, description: 'tense' }];
            expect(getRelationshipModifier(crew, 2)).toBe(0);
        });
    });
});
