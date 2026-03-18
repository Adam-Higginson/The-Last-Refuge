import { describe, it, expect, beforeEach } from 'vitest';
import { EventStateComponent } from '../EventStateComponent';

describe('EventStateComponent', () => {
    let state: EventStateComponent;

    beforeEach(() => {
        state = new EventStateComponent();
    });

    // --- Flags ---

    it('addFlag and hasFlag work', () => {
        expect(state.hasFlag('test')).toBe(false);
        state.addFlag('test');
        expect(state.hasFlag('test')).toBe(true);
    });

    it('flags set is exposed as readonly', () => {
        state.addFlag('a');
        state.addFlag('b');
        expect(state.flags.size).toBe(2);
        expect(state.flags.has('a')).toBe(true);
        expect(state.flags.has('b')).toBe(true);
    });

    // --- Seen events ---

    it('markSeen and hasSeen work', () => {
        expect(state.hasSeen('intro')).toBe(false);
        state.markSeen('intro');
        expect(state.hasSeen('intro')).toBe(true);
    });

    it('seenEventIds tracks multiple events', () => {
        state.markSeen('a');
        state.markSeen('b');
        expect(state.seenEventIds.size).toBe(2);
    });

    // --- Chain queue ---

    it('queueChain adds entry with correct trigger turn', () => {
        state.queueChain('follow_up', 5, 3);
        expect(state.chainQueue).toHaveLength(1);
        expect(state.chainQueue[0]).toEqual({
            eventId: 'follow_up',
            triggerTurn: 8,
        });
    });

    it('getTriggeredChains returns and removes matching entries', () => {
        state.queueChain('a', 3, 2); // triggers at turn 5
        state.queueChain('b', 3, 5); // triggers at turn 8
        state.queueChain('c', 1, 4); // triggers at turn 5

        const triggered = state.getTriggeredChains(5);
        expect(triggered).toHaveLength(2);
        expect(triggered.map(t => t.eventId).sort()).toEqual(['a', 'c']);

        // Queue should only have the untriggered entry
        expect(state.chainQueue).toHaveLength(1);
        expect(state.chainQueue[0].eventId).toBe('b');
    });

    it('getTriggeredChains returns empty array when nothing matches', () => {
        state.queueChain('a', 3, 5);
        const triggered = state.getTriggeredChains(2);
        expect(triggered).toHaveLength(0);
        expect(state.chainQueue).toHaveLength(1);
    });

    it('getTriggeredChains includes entries with triggerTurn <= current turn', () => {
        state.queueChain('late', 1, 2); // triggers at turn 3
        const triggered = state.getTriggeredChains(5); // turn 5 > turn 3
        expect(triggered).toHaveLength(1);
        expect(triggered[0].eventId).toBe('late');
    });
});
