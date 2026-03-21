import { describe, it, expect } from 'vitest';
import { resolveOutcomeTier, getOutcomeForTier, CRISIS_CARDS } from '../crisisCards';
import type { OutcomeTier } from '../crisisCards';

describe('crisisCards', () => {
    describe('resolveOutcomeTier', () => {
        // Tier boundary tests: +5, +4, +1, 0, -1, -3, -4, -7, -8, -9
        const cases: Array<[number, OutcomeTier]> = [
            [10, 'critical_success'],   // well above +5
            [5, 'critical_success'],    // exact boundary
            [4, 'success'],             // just below critical
            [1, 'success'],             // lower bound of success
            [0, 'partial'],             // exact boundary
            [-1, 'partial'],            // within partial range
            [-3, 'partial'],            // lower bound of partial
            [-4, 'failure'],            // exact boundary
            [-7, 'failure'],            // lower bound of failure
            [-8, 'catastrophe'],        // exact boundary
            [-9, 'catastrophe'],        // well below
            [-100, 'catastrophe'],      // extreme negative
        ];

        for (const [margin, expectedTier] of cases) {
            it(`margin ${margin} → ${expectedTier}`, () => {
                expect(resolveOutcomeTier(margin)).toBe(expectedTier);
            });
        }

        it('returns catastrophe for NaN', () => {
            expect(resolveOutcomeTier(NaN)).toBe('catastrophe');
        });

        it('returns catastrophe for Infinity', () => {
            expect(resolveOutcomeTier(Infinity)).toBe('catastrophe');
        });

        it('returns catastrophe for -Infinity', () => {
            expect(resolveOutcomeTier(-Infinity)).toBe('catastrophe');
        });
    });

    describe('getOutcomeForTier', () => {
        it('returns the matching outcome from a card', () => {
            const card = CRISIS_CARDS[0]; // Hunter's Shadow
            const outcome = getOutcomeForTier(card, 'success');
            expect(outcome).toBeDefined();
            expect(outcome?.tier).toBe('success');
        });

        it('returns undefined for a tier not defined on the card', () => {
            const card = { ...CRISIS_CARDS[0], outcomes: [] };
            expect(getOutcomeForTier(card, 'success')).toBeUndefined();
        });
    });

    describe('CRISIS_CARDS', () => {
        it('has at least 2 scout encounter cards', () => {
            const scoutCards = CRISIS_CARDS.filter(c => c.encounterType === 'scout');
            expect(scoutCards.length).toBeGreaterThanOrEqual(2);
        });

        it('every card has all 5 outcome tiers', () => {
            const tiers: OutcomeTier[] = ['critical_success', 'success', 'partial', 'failure', 'catastrophe'];
            for (const card of CRISIS_CARDS) {
                for (const tier of tiers) {
                    const outcome = card.outcomes.find(o => o.tier === tier);
                    expect(outcome, `Card '${card.id}' missing tier '${tier}'`).toBeDefined();
                }
            }
        });

        it('every card has at least one required skill slot', () => {
            for (const card of CRISIS_CARDS) {
                const hasRequired = card.skillSlots.some(s => s.required);
                expect(hasRequired, `Card '${card.id}' has no required slot`).toBe(true);
            }
        });

        it('every card has a unique ID', () => {
            const ids = CRISIS_CARDS.map(c => c.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('every card has a non-empty adaptation tag', () => {
            for (const card of CRISIS_CARDS) {
                expect(card.adaptationTag.length).toBeGreaterThan(0);
            }
        });
    });
});
