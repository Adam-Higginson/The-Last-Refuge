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

    // --- station_signal_hint ---

    it('station_signal_hint fires on turn >= 3 when station not discovered', () => {
        const hint = NARRATIVE_EVENTS.find(e => e.id === 'station_signal_hint');
        expect(hint).toBeDefined();
        expect(hint?.condition(makeContext({ turn: 2 }))).toBe(false);
        expect(hint?.condition(makeContext({ turn: 3 }))).toBe(true);
        expect(hint?.condition(makeContext({ turn: 10 }))).toBe(true);
    });

    it('station_signal_hint suppressed when station_discovered flag set', () => {
        const hint = NARRATIVE_EVENTS.find(e => e.id === 'station_signal_hint');
        expect(hint?.condition(makeContext({ turn: 5, flags: new Set(['station_discovered']) }))).toBe(false);
    });

    it('station_signal_hint is a story event with no choices', () => {
        const hint = NARRATIVE_EVENTS.find(e => e.id === 'station_signal_hint');
        expect(hint?.category).toBe('story');
        expect(hint?.choices).toBeUndefined();
    });

    // --- station_found ---

    it('station_found requires station_discovered flag', () => {
        const found = NARRATIVE_EVENTS.find(e => e.id === 'station_found');
        expect(found).toBeDefined();
        expect(found?.condition(makeContext({ flags: new Set() }))).toBe(false);
        expect(found?.condition(makeContext({ flags: new Set(['station_discovered']) }))).toBe(true);
    });

    it('station_found is a story event with no choices', () => {
        const found = NARRATIVE_EVENTS.find(e => e.id === 'station_found');
        expect(found?.category).toBe('story');
        expect(found?.choices).toBeUndefined();
    });

    // --- station_online ---

    it('station_online requires station_repaired flag', () => {
        const online = NARRATIVE_EVENTS.find(e => e.id === 'station_online');
        expect(online).toBeDefined();
        expect(online?.condition(makeContext({ flags: new Set() }))).toBe(false);
        expect(online?.condition(makeContext({ flags: new Set(['station_repaired']) }))).toBe(true);
    });

    it('station_online has exactly 1 choice with chainEventId', () => {
        const online = NARRATIVE_EVENTS.find(e => e.id === 'station_online');
        expect(online?.choices).toHaveLength(1);
        expect(online?.choices?.[0].chainEventId).toBe('extiris_arrival');
        expect(online?.choices?.[0].chainDelay).toBe(2);
        expect(online?.choices?.[0].flag).toBe('signal_broadcast');
    });

    // --- extiris_arrival ---

    it('extiris_arrival has condition that always returns false (chain-only)', () => {
        const arrival = NARRATIVE_EVENTS.find(e => e.id === 'extiris_arrival');
        expect(arrival).toBeDefined();
        expect(arrival?.condition(makeContext())).toBe(false);
        expect(arrival?.condition(makeContext({ turn: 100, flags: new Set(['station_repaired', 'signal_broadcast']) }))).toBe(false);
    });

    it('extiris_arrival is a story event', () => {
        const arrival = NARRATIVE_EVENTS.find(e => e.id === 'extiris_arrival');
        expect(arrival?.category).toBe('story');
    });

    // --- engine_diagnostic ---

    it('engine_diagnostic requires station_repaired flag and NOT engine_repaired', () => {
        const diag = NARRATIVE_EVENTS.find(e => e.id === 'engine_diagnostic');
        expect(diag).toBeDefined();
        expect(diag?.condition(makeContext({ flags: new Set() }))).toBe(false);
        expect(diag?.condition(makeContext({ flags: new Set(['station_repaired']) }))).toBe(true);
    });

    it('engine_diagnostic suppressed when engine_repaired flag is set', () => {
        const diag = NARRATIVE_EVENTS.find(e => e.id === 'engine_diagnostic');
        expect(diag?.condition(makeContext({ flags: new Set(['station_repaired', 'engine_repaired']) }))).toBe(false);
    });

    it('engine_diagnostic is a story event with no choices', () => {
        const diag = NARRATIVE_EVENTS.find(e => e.id === 'engine_diagnostic');
        expect(diag?.category).toBe('story');
        expect(diag?.choices).toBeUndefined();
    });

    // --- engines_online ---

    it('engines_online requires engine_repaired flag', () => {
        const online = NARRATIVE_EVENTS.find(e => e.id === 'engines_online');
        expect(online).toBeDefined();
        expect(online?.condition(makeContext({ flags: new Set() }))).toBe(false);
        expect(online?.condition(makeContext({ flags: new Set(['engine_repaired']) }))).toBe(true);
    });

    it('engines_online is a story event with no choices', () => {
        const online = NARRATIVE_EVENTS.find(e => e.id === 'engines_online');
        expect(online?.category).toBe('story');
        expect(online?.choices).toBeUndefined();
    });
});
