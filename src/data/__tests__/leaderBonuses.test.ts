import { describe, it, expect } from 'vitest';
import { LEADER_ROLE_BONUSES, LEADER_TRAIT_BONUSES, getLeaderBonusLines } from '../leaderBonuses';

describe('leaderBonuses', () => {
    it('all 6 roles have bonus definitions', () => {
        expect(Object.keys(LEADER_ROLE_BONUSES)).toHaveLength(6);
    });

    it('all role bonuses have at least one effect', () => {
        for (const [role, bonus] of Object.entries(LEADER_ROLE_BONUSES)) {
            expect(bonus.effects.length, `${role} has no effects`).toBeGreaterThan(0);
        }
    });

    it('all trait bonuses have at least one effect', () => {
        for (const [trait, bonus] of Object.entries(LEADER_TRAIT_BONUSES)) {
            if (bonus) {
                expect(bonus.effects.length, `${trait} has no effects`).toBeGreaterThan(0);
            }
        }
    });
});

describe('getLeaderBonusLines', () => {
    it('returns role effects for a Soldier', () => {
        const lines = getLeaderBonusLines('Soldier', ['Quiet', 'Hopeful']);
        expect(lines.some(l => l.text.includes('morale') && l.text.includes('Soldier'))).toBe(true);
    });

    it('includes trait effects when trait has a bonus', () => {
        const lines = getLeaderBonusLines('Civilian', ['Resourceful', 'Hopeful']);
        expect(lines.some(l => l.text.includes('Resourceful'))).toBe(true);
        expect(lines.some(l => l.text.includes('Hopeful'))).toBe(true);
    });

    it('does not include lines for traits without bonuses', () => {
        const lines = getLeaderBonusLines('Soldier', ['Quiet', 'Empathetic']);
        // Quiet and Empathetic have no leader bonuses
        expect(lines.every(l => !l.text.includes('Quiet'))).toBe(true);
        expect(lines.every(l => !l.text.includes('Empathetic'))).toBe(true);
    });

    it('Stubborn produces both positive and negative effects', () => {
        const lines = getLeaderBonusLines('Civilian', ['Stubborn', 'Quiet']);
        const stubbornLines = lines.filter(l => l.text.includes('Stubborn'));
        expect(stubbornLines.length).toBe(2);
        expect(stubbornLines.some(l => l.sentiment === 'positive')).toBe(true);
        expect(stubbornLines.some(l => l.sentiment === 'negative')).toBe(true);
    });

    it('Haunted produces a negative effect', () => {
        const lines = getLeaderBonusLines('Medic', ['Haunted', 'Quiet']);
        const hauntedLines = lines.filter(l => l.text.includes('Haunted'));
        expect(hauntedLines).toHaveLength(1);
        expect(hauntedLines[0].sentiment).toBe('negative');
    });
});
