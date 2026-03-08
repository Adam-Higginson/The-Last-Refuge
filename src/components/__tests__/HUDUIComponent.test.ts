import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { HUDUIComponent } from '../HUDUIComponent';
import { DateUIComponent } from '../DateUIComponent';
import { MovementComponent } from '../MovementComponent';
import { TransformComponent } from '../TransformComponent';
import { SelectableComponent } from '../SelectableComponent';

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
    let budgetFill: MockElement;
    let budgetText: MockElement;
    let endTurnBtn: MockElement;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        hudContainer = createMockElement('hud-bottom');
        dateEl = createMockElement('hud-date');
        budgetFill = createMockElement('hud-budget-fill');
        budgetText = createMockElement('hud-budget-text');
        endTurnBtn = createMockElement('hud-end-turn');

        elementMap = {
            'hud-bottom': hudContainer,
            'hud-date': dateEl,
            'hud-budget-fill': budgetFill,
            'hud-budget-text': budgetText,
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

    function createShipEntity(budget = 300): MovementComponent {
        const entity = world.createEntity('arkSalvage');
        entity.addComponent(new TransformComponent(100, 100));
        entity.addComponent(new SelectableComponent(18));
        const movement = entity.addComponent(new MovementComponent(budget));
        movement.init();
        return movement;
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

    it('updates budget display from ship MovementComponent on update', () => {
        const { hud } = createHUDEntity();
        const movement = createShipEntity(300);

        movement.budgetRemaining = 150;
        hud.update(1 / 60);

        expect(budgetText.textContent).toBe('150 / 300');
    });

    it('returns green colour for budget ratio above 0.5', () => {
        const { hud } = createHUDEntity();
        createShipEntity(300);

        hud.update(1 / 60);
        expect(budgetFill.style.background).toBe('#44cc66');
    });

    it('returns amber colour for budget ratio between 0.25 and 0.5', () => {
        const { hud } = createHUDEntity();
        const movement = createShipEntity(300);

        movement.budgetRemaining = 120; // ratio = 0.4
        hud.update(1 / 60);
        expect(budgetFill.style.background).toBe('#ccaa44');
    });

    it('returns red colour for budget ratio at or below 0.25', () => {
        const { hud } = createHUDEntity();
        const movement = createShipEntity(300);

        movement.budgetRemaining = 60; // ratio = 0.2
        hud.update(1 / 60);
        expect(budgetFill.style.background).toBe('#cc4444');
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
