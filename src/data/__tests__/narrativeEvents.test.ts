import { describe, it, expect } from 'vitest';
import { NARRATIVE_EVENTS, CATEGORY_WEIGHTS } from '../narrativeEvents';
import type { NarrativeEventContext } from '../narrativeEvents';

function makeContext(overrides: Partial<NarrativeEventContext> = {}): NarrativeEventContext {
    return {
        turn: 1,
        resources: {
            food: { current: 200, cap: 300 },
            materials: { current: 60, cap: 150 },
            energy: { current: 80, cap: 200 },
        },
        flags: new Set(),
        ...overrides,
    };
}

describe('narrativeEvents', () => {
    it('all events have unique IDs', () => {
        const ids = NARRATIVE_EVENTS.map(e => e.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('all events have valid categories', () => {
        const validCategories = Object.keys(CATEGORY_WEIGHTS);
        for (const event of NARRATIVE_EVENTS) {
            expect(validCategories).toContain(event.category);
        }
    });

    it('story category has weight 0', () => {
        expect(CATEGORY_WEIGHTS.story).toBe(0);
    });

    // --- intro_escape ---

    it('intro_escape fires on turn 1', () => {
        const intro = NARRATIVE_EVENTS.find(e => e.id === 'intro_escape');
        expect(intro).toBeDefined();
        expect(intro?.condition(makeContext({ turn: 1 }))).toBe(true);
    });

    it('intro_escape does NOT fire on turn 2', () => {
        const intro = NARRATIVE_EVENTS.find(e => e.id === 'intro_escape');
        expect(intro?.condition(makeContext({ turn: 2 }))).toBe(false);
    });

    it('intro_escape is a story event with no choices', () => {
        const intro = NARRATIVE_EVENTS.find(e => e.id === 'intro_escape');
        expect(intro?.category).toBe('story');
        expect(intro?.choices).toBeUndefined();
    });

    // --- supply_cache ---

    it('supply_cache fires on turn >= 3', () => {
        const cache = NARRATIVE_EVENTS.find(e => e.id === 'supply_cache');
        expect(cache?.condition(makeContext({ turn: 2 }))).toBe(false);
        expect(cache?.condition(makeContext({ turn: 3 }))).toBe(true);
        expect(cache?.condition(makeContext({ turn: 10 }))).toBe(true);
    });

    it('supply_cache has 2 choices', () => {
        const cache = NARRATIVE_EVENTS.find(e => e.id === 'supply_cache');
        expect(cache?.choices).toHaveLength(2);
    });

    it('supply_cache investigate choice chains to cache_findings', () => {
        const cache = NARRATIVE_EVENTS.find(e => e.id === 'supply_cache');
        const investigate = cache?.choices?.[0];
        expect(investigate?.chainEventId).toBe('cache_findings');
        expect(investigate?.chainDelay).toBe(2);
        expect(investigate?.flag).toBe('investigated_cache');
    });

    it('supply_cache ignore choice sets flag', () => {
        const cache = NARRATIVE_EVENTS.find(e => e.id === 'supply_cache');
        const ignore = cache?.choices?.[1];
        expect(ignore?.flag).toBe('ignored_cache');
        expect(ignore?.chainEventId).toBeUndefined();
    });

    // --- cache_findings ---

    it('cache_findings condition returns false (fires only via chain queue)', () => {
        const findings = NARRATIVE_EVENTS.find(e => e.id === 'cache_findings');
        expect(findings?.condition(makeContext({ flags: new Set() }))).toBe(false);
        expect(findings?.condition(makeContext({ flags: new Set(['investigated_cache']) }))).toBe(false);
    });

    it('cache_findings is a story event', () => {
        const findings = NARRATIVE_EVENTS.find(e => e.id === 'cache_findings');
        expect(findings?.category).toBe('story');
    });
});
