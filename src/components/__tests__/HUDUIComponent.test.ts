import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { HUDUIComponent } from '../HUDUIComponent';
import { DateUIComponent } from '../DateUIComponent';

// ---------------------------------------------------------------------------
// Minimal DOM mock — just enough for the component's init()/update()/destroy()
// ---------------------------------------------------------------------------

interface MockElement {
    id: string;
    innerHTML: string;
    textContent: string;
    style: Record<string, string>;
    classList: {
        add(c: string): void;
        remove(c: string): void;
        contains(c: string): boolean;
    };
    addEventListener(evt: string, fn: (...args: unknown[]) => void): void;
    removeEventListener(evt: string, fn: (...args: unknown[]) => void): void;
    /** Simulate a click by firing all registered 'click' listeners. */
    click(): void;
}

function createMockElement(id: string): MockElement {
    const classes = new Set<string>();
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    return {
        id,
        innerHTML: '',
        textContent: '',
        style: {},
        classList: {
            add(c: string): void { classes.add(c); },
            remove(c: string): void { classes.delete(c); },
            contains(c: string): boolean { return classes.has(c); },
        },
        addEventListener(evt: string, fn: (...args: unknown[]) => void): void {
            (listeners[evt] ??= []).push(fn);
        },
        removeEventListener(evt: string, fn: (...args: unknown[]) => void): void {
            const list = listeners[evt];
            if (!list) return;
            const idx = list.indexOf(fn);
            if (idx !== -1) list.splice(idx, 1);
        },
        click(): void {
            for (const fn of listeners['click'] ?? []) fn();
        },
    };
}

// ---------------------------------------------------------------------------
// Stub `document` on globalThis so the component can call getElementById.
// ---------------------------------------------------------------------------

let elementMap: Record<string, MockElement> = {};
const origDocument = globalThis.document;

function installDocumentMock(): void {
    (globalThis as Record<string, unknown>).document = {
        getElementById: (id: string): MockElement | null => elementMap[id] ?? null,
    };
}

function restoreDocument(): void {
    (globalThis as Record<string, unknown>).document = origDocument;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HUDUIComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let hudContainer: MockElement;
    let dateEl: MockElement;
    let endTurnBtn: MockElement;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        hudContainer = createMockElement('hud-bottom');
        dateEl = createMockElement('hud-date');
        endTurnBtn = createMockElement('hud-end-turn');

        elementMap = {
            'hud-bottom': hudContainer,
            'hud-date': dateEl,
            'hud-end-turn': endTurnBtn,
        };
        installDocumentMock();
    });

    afterEach(() => {
        restoreDocument();
        elementMap = {};
    });

    function createHUDEntity(): { hud: HUDUIComponent; date: DateUIComponent } {
        const entity = world.createEntity('hud');
        const date = entity.addComponent(new DateUIComponent());
        const hud = entity.addComponent(new HUDUIComponent());
        date.init();
        hud.init();
        return { hud, date };
    }

    it('shows HUD container on init by adding "visible" class', () => {
        createHUDEntity();
        expect(hudContainer.classList.contains('visible')).toBe(true);
    });

    it('emits TURN_ADVANCE when END TURN button is clicked with no blockers', () => {
        createHUDEntity();

        const events: Array<{ type: string }> = [];
        eventQueue.on(GameEvents.TURN_ADVANCE, (e) => events.push(e as { type: string }));

        endTurnBtn.click();
        eventQueue.drain();

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe(GameEvents.TURN_ADVANCE);
    });

    it('does not emit TURN_ADVANCE when blockers are active', () => {
        createHUDEntity();

        eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'orbit:1' });
        eventQueue.drain();

        const events: Array<{ type: string }> = [];
        eventQueue.on(GameEvents.TURN_ADVANCE, (e) => events.push(e as { type: string }));

        endTurnBtn.click();
        eventQueue.drain();

        expect(events).toHaveLength(0);
    });

    it('re-enables button when all blockers are cleared', () => {
        const { hud } = createHUDEntity();

        eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'orbit:1' });
        eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'movement' });
        eventQueue.drain();

        eventQueue.emit({ type: GameEvents.TURN_UNBLOCK, key: 'orbit:1' });
        eventQueue.drain();
        hud.update(1 / 60);
        expect(endTurnBtn.classList.contains('disabled')).toBe(true);

        eventQueue.emit({ type: GameEvents.TURN_UNBLOCK, key: 'movement' });
        eventQueue.drain();
        hud.update(1 / 60);
        expect(endTurnBtn.classList.contains('disabled')).toBe(false);
    });

    it('updates date display from DateUIComponent on update', () => {
        const { hud, date } = createHUDEntity();

        date.advanceDays(9);
        hud.update(1 / 60);

        expect(dateEl.textContent).toBe('JAN 10, 2700');
    });

    it('unsubscribes from events on destroy', () => {
        const { hud } = createHUDEntity();

        hud.destroy();

        // After destroy, blockers should not accumulate
        eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: 'orbit:1' });
        eventQueue.drain();

        // The click handler was removed from the button, so no TURN_ADVANCE emitted
        const events: Array<{ type: string }> = [];
        eventQueue.on(GameEvents.TURN_ADVANCE, (e) => events.push(e as { type: string }));
        endTurnBtn.click();
        eventQueue.drain();

        expect(events).toHaveLength(0);
    });
});
