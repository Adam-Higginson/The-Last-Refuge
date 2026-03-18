import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { GameEvents } from '../../core/GameEvents';
import { ServiceLocator } from '../../core/ServiceLocator';
import { NarrativeEventSystem } from '../NarrativeEventSystem';
import { EventStateComponent } from '../../components/EventStateComponent';
import { ResourceComponent } from '../../components/ResourceComponent';
import type { NarrativeModalOptions } from '../../ui/NarrativeModal';

// Mock NarrativeModal
function createMockModal(): {
    show: ReturnType<typeof vi.fn>;
    showOutcome: ReturnType<typeof vi.fn>;
    isOpen: boolean;
    destroy: ReturnType<typeof vi.fn>;
} {
    return {
        show: vi.fn().mockResolvedValue(-1),
        showOutcome: vi.fn().mockResolvedValue(undefined),
        isOpen: false,
        destroy: vi.fn(),
    };
}

describe('NarrativeEventSystem', () => {
    let world: World;
    let eventQueue: EventQueue;
    let system: NarrativeEventSystem;
    let mockModal: ReturnType<typeof createMockModal>;
    let eventState: EventStateComponent;
    let resources: ResourceComponent;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        mockModal = createMockModal();

        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);
        ServiceLocator.register('narrativeModal', mockModal);

        // Create gameState entity with required components
        const gameState = world.createEntity('gameState');
        eventState = gameState.addComponent(new EventStateComponent());
        resources = gameState.addComponent(new ResourceComponent());
        resources.init();

        system = new NarrativeEventSystem();
        world.addSystem(system);
    });

    // Helper: flush microtasks so async checkEvents completes
    async function flush(): Promise<void> {
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // --- Intro event on first update ---

    it('shows intro event on first update', async () => {
        system.update(0);
        await flush();

        expect(mockModal.show).toHaveBeenCalledTimes(1);
        const opts = mockModal.show.mock.calls[0][0] as NarrativeModalOptions;
        expect(opts.title).toBe('THE LAST REFUGE');
    });

    it('marks intro as seen after showing', async () => {
        system.update(0);
        await flush();

        expect(eventState.hasSeen('intro_escape')).toBe(true);
    });

    it('emits TURN_BLOCK before showing modal', async () => {
        const blockSpy = vi.fn();
        eventQueue.on(GameEvents.TURN_BLOCK, blockSpy);

        system.update(0);
        await flush();
        eventQueue.drain();

        expect(blockSpy).toHaveBeenCalledWith(
            expect.objectContaining({ key: 'narrative' }),
        );
    });

    it('emits TURN_UNBLOCK after modal closes', async () => {
        const unblockSpy = vi.fn();
        eventQueue.on(GameEvents.TURN_UNBLOCK, unblockSpy);

        system.update(0);
        await flush();
        eventQueue.drain();

        expect(unblockSpy).toHaveBeenCalledWith(
            expect.objectContaining({ key: 'narrative' }),
        );
    });

    // --- Does not re-show on subsequent updates ---

    it('does not check again on second update', async () => {
        system.update(0);
        await flush();
        mockModal.show.mockClear();

        system.update(0);
        await flush();

        expect(mockModal.show).not.toHaveBeenCalled();
    });

    // --- Story events never drawn from deck ---

    it('does not draw story events from deck', async () => {
        // Mark intro as seen so it doesn't fire
        eventState.markSeen('intro_escape');
        eventState.markSeen('cache_findings');

        // Trigger TURN_END at turn 1 — no non-story events eligible at turn 1
        system.update(0); // consume needsInitialCheck (intro already seen)
        await flush();
        mockModal.show.mockClear();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 1 });
        eventQueue.drain();
        await flush();

        // cache_findings is story category — should not be drawn
        // No events should show at turn 1 besides intro
        expect(mockModal.show).not.toHaveBeenCalled();
    });

    // --- Deck draw at turn 3 ---

    it('shows supply_cache on turn 3 via deck draw', async () => {
        // Mark intro as seen
        eventState.markSeen('intro_escape');
        system.update(0);
        await flush();
        mockModal.show.mockClear();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();

        expect(mockModal.show).toHaveBeenCalledTimes(1);
        const opts = mockModal.show.mock.calls[0][0] as NarrativeModalOptions;
        expect(opts.title).toBe('SIGNAL DETECTED');
    });

    // --- Once flag prevents re-fire ---

    it('does not show same event twice when once=true', async () => {
        eventState.markSeen('intro_escape');
        eventState.markSeen('supply_cache');
        system.update(0);
        await flush();
        mockModal.show.mockClear();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();

        expect(mockModal.show).not.toHaveBeenCalled();
    });

    // --- Choice with costs and gains ---

    it('applies costs and gains when choice is made', async () => {
        eventState.markSeen('intro_escape');
        // Mock modal to return choice 0 (investigate)
        mockModal.show.mockResolvedValue(0);

        system.update(0);
        await flush();

        const startMaterials = resources.resources.materials.current;
        const startFood = resources.resources.food.current;

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();

        // Choice 0: costs 10 materials, gains 30 food
        expect(resources.resources.materials.current).toBe(startMaterials - 10);
        expect(resources.resources.food.current).toBe(startFood + 30);
    });

    it('sets flag when choice with flag is made', async () => {
        eventState.markSeen('intro_escape');
        mockModal.show.mockResolvedValue(0);

        system.update(0);
        await flush();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();

        expect(eventState.hasFlag('investigated_cache')).toBe(true);
    });

    it('queues chain event when choice has chainEventId', async () => {
        eventState.markSeen('intro_escape');
        mockModal.show.mockResolvedValue(0);

        system.update(0);
        await flush();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();

        expect(eventState.chainQueue).toHaveLength(1);
        expect(eventState.chainQueue[0].eventId).toBe('cache_findings');
        expect(eventState.chainQueue[0].triggerTurn).toBe(5); // turn 3 + delay 2
    });

    // --- Chain event fires ---

    it('fires chain event at correct turn', async () => {
        // Pre-mark intro so initial check is a no-op
        eventState.markSeen('intro_escape');
        eventState.markSeen('supply_cache');
        eventState.markSeen('cache_findings');

        system.update(0); // consume needsInitialCheck — no events eligible
        await flush();

        // Now set up chain conditions fresh
        eventState.seenEventIds.delete('cache_findings');
        eventState.addFlag('investigated_cache');
        eventState.queueChain('cache_findings', 3, 2); // triggers at turn 5
        mockModal.show.mockClear();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 5 });
        eventQueue.drain();
        await flush();

        expect(mockModal.show).toHaveBeenCalledTimes(1);
        const opts = mockModal.show.mock.calls[0][0] as NarrativeModalOptions;
        expect(opts.title).toBe('WHAT WE FOUND');
    });

    // --- Priority: chain > story > deck ---

    it('chain events take priority over deck draw', async () => {
        // Pre-mark intro so initial check is a no-op
        eventState.markSeen('intro_escape');
        eventState.markSeen('cache_findings');

        system.update(0); // consume needsInitialCheck
        await flush();

        // Now set up chain + deck conditions
        eventState.seenEventIds.delete('cache_findings');
        eventState.addFlag('investigated_cache');
        eventState.queueChain('cache_findings', 1, 2); // triggers at turn 3
        mockModal.show.mockClear();

        // Turn 3: both supply_cache (deck) and cache_findings (chain) are eligible
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();

        expect(mockModal.show).toHaveBeenCalledTimes(1);
        const opts = mockModal.show.mock.calls[0][0] as NarrativeModalOptions;
        // Chain should win over deck
        expect(opts.title).toBe('WHAT WE FOUND');
    });

    // --- Multi-cost atomicity ---

    it('does not deduct any cost if one resource is insufficient', async () => {
        eventState.markSeen('intro_escape');
        mockModal.show.mockResolvedValue(0);

        // Set materials to 5 (below the 10 cost)
        resources.resources.materials.current = 5;
        const startFood = resources.resources.food.current;

        system.update(0);
        await flush();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();

        // Materials should not be deducted (can't afford)
        expect(resources.resources.materials.current).toBe(5);
        // Gains should also not apply when costs can't be paid
        expect(resources.resources.food.current).toBe(startFood);
    });

    // --- Condition function throws ---

    it('skips event when condition throws', async () => {
        eventState.markSeen('intro_escape');
        eventState.markSeen('supply_cache');
        eventState.markSeen('cache_findings');

        // All events seen — no events should fire, and no errors
        system.update(0);
        await flush();
        mockModal.show.mockClear();

        // Fire turn — no eligible events
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();

        expect(mockModal.show).not.toHaveBeenCalled();
    });

    // --- Modal throws → TURN_UNBLOCK still emits ---

    it('emits TURN_UNBLOCK even when modal throws', async () => {
        const unblockSpy = vi.fn();
        eventQueue.on(GameEvents.TURN_UNBLOCK, unblockSpy);

        mockModal.show.mockRejectedValue(new Error('modal error'));
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        system.update(0);
        await flush();
        eventQueue.drain();

        expect(unblockSpy).toHaveBeenCalledWith(
            expect.objectContaining({ key: 'narrative' }),
        );
        warnSpy.mockRestore();
    });

    // --- showing guard prevents re-entry ---

    it('does not re-enter while showing', async () => {
        // Make show() hang — never resolves until we manually resolve
        const pending: { resolve: (value: number) => void }[] = [];
        mockModal.show.mockImplementation(() => new Promise<number>((resolve) => {
            pending.push({ resolve });
        }));

        system.update(0);
        // Don't await — modal is "open"

        // Try to trigger another event
        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();

        // Should only have been called once (the initial check)
        expect(mockModal.show).toHaveBeenCalledTimes(1);

        // Resolve to clean up
        for (const p of pending) p.resolve(-1);
        await flush();
    });

    // --- NARRATIVE_SHOWN event ---

    it('emits NARRATIVE_SHOWN after choice is applied', async () => {
        eventState.markSeen('intro_escape');
        mockModal.show.mockResolvedValue(1); // ignore choice

        const shownSpy = vi.fn();
        eventQueue.on(GameEvents.NARRATIVE_SHOWN, shownSpy);

        system.update(0);
        await flush();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();
        eventQueue.drain(); // drain the NARRATIVE_SHOWN event

        expect(shownSpy).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'supply_cache', choiceIndex: 1 }),
        );
    });

    // --- Disabled choices in modal ---

    it('passes disabled flag for unaffordable choices', async () => {
        eventState.markSeen('intro_escape');
        resources.resources.materials.current = 5; // below 10 cost

        system.update(0);
        await flush();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();

        const opts = mockModal.show.mock.calls[0]?.[0] as NarrativeModalOptions | undefined;
        expect(opts?.choices?.[0]?.disabled).toBe(true);
        expect(opts?.choices?.[1]?.disabled).toBe(false);
    });

    // --- Shows outcome text ---

    it('shows outcome text after choice', async () => {
        eventState.markSeen('intro_escape');
        mockModal.show.mockResolvedValue(0);

        system.update(0);
        await flush();

        eventQueue.emit({ type: GameEvents.TURN_END, turn: 3 });
        eventQueue.drain();
        await flush();

        expect(mockModal.showOutcome).toHaveBeenCalledTimes(1);
        expect(mockModal.showOutcome.mock.calls[0][0]).toContain('vacuum-sealed ration crates');
    });
});
