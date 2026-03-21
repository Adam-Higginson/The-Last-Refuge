import { describe, it, expect } from 'vitest';
import { applyAdaptations, ADAPTATION_EFFECTS, VALID_ADAPTATION_TAGS } from '../crisisCards';
import type { CrisisCard } from '../crisisCards';
import { AIService } from '../../services/AIService';

// Minimal card for testing
const makeCard = (slots: Array<{ skill: string; label: string }>): CrisisCard => ({
    id: 'test',
    title: 'TEST',
    description: 'test',
    difficulty: 10,
    skillSlots: slots.map(s => ({ skill: s.skill as 'piloting' | 'combat' | 'engineering' | 'leadership' | 'medical', label: s.label, maxCrew: 1, required: false })),
    outcomes: [],
    encounterType: 'scout',
    adaptationTag: 'evasion',
});

describe('Adaptation System', () => {
    describe('ADAPTATION_EFFECTS', () => {
        it('has entries for all valid tags', () => {
            for (const tag of VALID_ADAPTATION_TAGS) {
                expect(ADAPTATION_EFFECTS[tag]).toBeDefined();
                expect(ADAPTATION_EFFECTS[tag].description).toBeTruthy();
            }
        });

        it('debris_analysis disables sacrifice', () => {
            expect(ADAPTATION_EFFECTS.debris_analysis.disablesSacrifice).toBe(true);
        });

        it('other tags do not disable sacrifice', () => {
            for (const tag of VALID_ADAPTATION_TAGS) {
                if (tag === 'debris_analysis') continue;
                expect(ADAPTATION_EFFECTS[tag].disablesSacrifice).toBeFalsy();
            }
        });
    });

    describe('applyAdaptations', () => {
        it('applies penalty to matching skill slots', () => {
            const card = makeCard([{ skill: 'engineering', label: 'Jam sensors' }]);
            const { modifiedCard } = applyAdaptations(card, ['sensor_resistance']);

            expect(modifiedCard.skillSlots[0].penalty).toBe(-2);
        });

        it('does not apply penalty to non-matching slots', () => {
            const card = makeCard([{ skill: 'combat', label: 'Fight' }]);
            const { modifiedCard } = applyAdaptations(card, ['sensor_resistance']);

            expect(modifiedCard.skillSlots[0].penalty).toBeUndefined();
        });

        it('stacks penalties from multiple adaptations targeting same skill', () => {
            const card = makeCard([{ skill: 'piloting', label: 'Evade' }]);
            const { modifiedCard } = applyAdaptations(card, ['probe_swarms', 'pattern_prediction']);

            // probe_swarms: -1, pattern_prediction: -1 = -2
            expect(modifiedCard.skillSlots[0].penalty).toBe(-2);
        });

        it('sets sacrificeDisabled when debris_analysis is active', () => {
            const card = makeCard([]);
            const { sacrificeDisabled } = applyAdaptations(card, ['debris_analysis']);

            expect(sacrificeDisabled).toBe(true);
        });

        it('does not set sacrificeDisabled without debris_analysis', () => {
            const card = makeCard([]);
            const { sacrificeDisabled } = applyAdaptations(card, ['sensor_resistance']);

            expect(sacrificeDisabled).toBe(false);
        });

        it('does not mutate the original card', () => {
            const card = makeCard([{ skill: 'engineering', label: 'Jam' }]);
            const originalPenalty = card.skillSlots[0].penalty;

            applyAdaptations(card, ['sensor_resistance']);

            expect(card.skillSlots[0].penalty).toBe(originalPenalty);
        });

        it('handles empty adaptations list', () => {
            const card = makeCard([{ skill: 'piloting', label: 'Evade' }]);
            const { modifiedCard, sacrificeDisabled } = applyAdaptations(card, []);

            expect(modifiedCard.skillSlots[0].penalty).toBeUndefined();
            expect(sacrificeDisabled).toBe(false);
        });

        it('handles invalid adaptation tags gracefully', () => {
            const card = makeCard([{ skill: 'piloting', label: 'Evade' }]);
            const { modifiedCard } = applyAdaptations(card, ['invalid_tag', 'also_invalid']);

            expect(modifiedCard.skillSlots[0].penalty).toBeUndefined();
        });
    });

    describe('AIService.deterministicAdaptation', () => {
        const service = new AIService();

        it('returns no adaptations when tactics used fewer than 3 times', () => {
            const history = [
                { tacticUsed: 'evasion' },
                { tacticUsed: 'evasion' },
            ];
            const result = service.deterministicAdaptation(history, []);

            expect(result).toHaveLength(0);
        });

        it('returns pattern_prediction when evasion used 3+ times', () => {
            const history = [
                { tacticUsed: 'evasion' },
                { tacticUsed: 'evasion' },
                { tacticUsed: 'evasion' },
            ];
            const result = service.deterministicAdaptation(history, []);

            expect(result).toContain('pattern_prediction');
        });

        it('returns sensor_resistance when sensor_jam used 3+ times', () => {
            const history = [
                { tacticUsed: 'sensor_jam' },
                { tacticUsed: 'sensor_jam' },
                { tacticUsed: 'sensor_jam' },
            ];
            const result = service.deterministicAdaptation(history, []);

            expect(result).toContain('sensor_resistance');
        });

        it('preserves existing adaptations', () => {
            const history = [
                { tacticUsed: 'evasion' },
                { tacticUsed: 'evasion' },
                { tacticUsed: 'evasion' },
            ];
            const result = service.deterministicAdaptation(history, ['sensor_resistance']);

            expect(result).toContain('sensor_resistance');
            expect(result).toContain('pattern_prediction');
        });

        it('caps at 2 adaptations', () => {
            const history = [
                { tacticUsed: 'evasion' }, { tacticUsed: 'evasion' }, { tacticUsed: 'evasion' },
                { tacticUsed: 'sensor_jam' }, { tacticUsed: 'sensor_jam' }, { tacticUsed: 'sensor_jam' },
            ];
            const result = service.deterministicAdaptation(history, ['debris_analysis']);

            expect(result.length).toBeLessThanOrEqual(2);
        });
    });
});
