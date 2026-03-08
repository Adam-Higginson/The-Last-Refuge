import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { ShipInfoUIComponent } from '../ShipInfoUIComponent';
import { TransformComponent } from '../TransformComponent';

// ---------------------------------------------------------------------------
// Minimal DOM mock
// ---------------------------------------------------------------------------

interface MockElement {
    id: string;
    innerHTML: string;
    textContent: string;
    value: string;
    style: Record<string, string>;
    classList: {
        add(c: string): void;
        remove(c: string): void;
        contains(c: string): boolean;
    };
    addEventListener(evt: string, fn: (...args: unknown[]) => void): void;
    removeEventListener(evt: string, fn: (...args: unknown[]) => void): void;
    click(): void;
    focus(): void;
    select(): void;
    _fireKeydown(e: Partial<KeyboardEvent>): void;
}

function createMockElement(id: string): MockElement {
    const classes = new Set<string>();
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    return {
        id,
        innerHTML: '',
        textContent: '',
        value: '',
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
        focus(): void { /* no-op */ },
        select(): void { /* no-op */ },
        _fireKeydown(e: Partial<KeyboardEvent>): void {
            for (const fn of listeners['keydown'] ?? []) fn(e);
        },
    };
}

// ---------------------------------------------------------------------------
// Stub document and window.addEventListener/removeEventListener
// ---------------------------------------------------------------------------

let elementMap: Record<string, MockElement> = {};
const origDocument = globalThis.document;
const origWindow = (globalThis as Record<string, unknown>).window;

let windowKeydownListeners: ((e: Partial<KeyboardEvent>) => void)[] = [];

function installMocks(): void {
    windowKeydownListeners = [];

    (globalThis as Record<string, unknown>).document = {
        getElementById: (id: string): MockElement | null => elementMap[id] ?? null,
    };

    // The component uses `window.addEventListener('keydown', ...)`.
    // In Node, `window` is not defined, so we create a mock.
    const mockWindow = {
        addEventListener: (type: string, listener: unknown): void => {
            if (type === 'keydown') {
                windowKeydownListeners.push(
                    listener as (e: Partial<KeyboardEvent>) => void,
                );
            }
        },
        removeEventListener: (type: string, listener: unknown): void => {
            if (type === 'keydown') {
                const idx = windowKeydownListeners.indexOf(
                    listener as (e: Partial<KeyboardEvent>) => void,
                );
                if (idx !== -1) windowKeydownListeners.splice(idx, 1);
            }
        },
    };
    (globalThis as Record<string, unknown>).window = mockWindow;
}

function restoreMocks(): void {
    (globalThis as Record<string, unknown>).document = origDocument;
    if (origWindow !== undefined) {
        (globalThis as Record<string, unknown>).window = origWindow;
    } else {
        delete (globalThis as Record<string, unknown>).window;
    }
    windowKeydownListeners = [];
}

function pressEscape(): void {
    for (const fn of windowKeydownListeners) {
        fn({ code: 'Escape' });
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ShipInfoUIComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let panel: MockElement;
    let nameLabel: MockElement;
    let renameRow: MockElement;
    let renameInput: MockElement;
    let renameBtn: MockElement;
    let renameOk: MockElement;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        panel = createMockElement('ship-info-panel');
        nameLabel = createMockElement('ship-name-label');
        renameRow = createMockElement('ship-rename-row');
        renameInput = createMockElement('ship-rename-input');
        renameBtn = createMockElement('ship-rename-btn');
        renameOk = createMockElement('ship-rename-ok');

        elementMap = {
            'ship-info-panel': panel,
            'ship-name-label': nameLabel,
            'ship-rename-row': renameRow,
            'ship-rename-input': renameInput,
            'ship-rename-btn': renameBtn,
            'ship-rename-ok': renameOk,
        };

        installMocks();
    });

    afterEach(() => {
        restoreMocks();
        elementMap = {};
    });

    function createShipWithInfoPanel(shipName?: string): ShipInfoUIComponent {
        const entity = world.createEntity('arkSalvage');
        entity.addComponent(new TransformComponent(400, 300));
        const info = shipName
            ? entity.addComponent(new ShipInfoUIComponent(shipName))
            : entity.addComponent(new ShipInfoUIComponent());
        info.init();
        return info;
    }

    // --- Panel open/close ---

    it('opens panel on ENTITY_RIGHT_CLICK matching entity ID', () => {
        const info = createShipWithInfoPanel();
        const entityId = info.entity.id;

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();

        expect(info.panelOpen).toBe(true);
        expect(panel.classList.contains('open')).toBe(true);
    });

    it('ignores ENTITY_RIGHT_CLICK for other entities', () => {
        const info = createShipWithInfoPanel();

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId: 9999,
            entityName: 'other',
        });
        eventQueue.drain();

        expect(info.panelOpen).toBe(false);
        expect(panel.classList.contains('open')).toBe(false);
    });

    it('toggles panel closed on repeated right-click', () => {
        const info = createShipWithInfoPanel();
        const entityId = info.entity.id;

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();
        expect(info.panelOpen).toBe(true);

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();
        expect(info.panelOpen).toBe(false);
        expect(panel.classList.contains('open')).toBe(false);
    });

    it('closes panel on ENTITY_CLICK (left-click elsewhere)', () => {
        const info = createShipWithInfoPanel();
        const entityId = info.entity.id;

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();
        expect(info.panelOpen).toBe(true);

        eventQueue.emit({
            type: GameEvents.ENTITY_CLICK,
            entityId: 5,
            entityName: 'star',
        });
        eventQueue.drain();
        expect(info.panelOpen).toBe(false);
    });

    it('closes panel on Escape key', () => {
        const info = createShipWithInfoPanel();
        const entityId = info.entity.id;

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();
        expect(info.panelOpen).toBe(true);

        pressEscape();
        expect(info.panelOpen).toBe(false);
    });

    // --- Rename ---

    it('enters rename mode when rename button is clicked', () => {
        const info = createShipWithInfoPanel();
        const entityId = info.entity.id;

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();

        renameBtn.click();
        expect(info.renaming).toBe(true);
    });

    it('updates ship name on rename confirm (OK button)', () => {
        const info = createShipWithInfoPanel();
        const entityId = info.entity.id;

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();

        renameBtn.click();
        renameInput.value = "Horizon's Edge";
        renameOk.click();

        expect(info.shipName).toBe("Horizon's Edge");
        expect(info.renaming).toBe(false);
    });

    it('updates ship name on Enter key in rename input', () => {
        const info = createShipWithInfoPanel();
        const entityId = info.entity.id;

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();

        renameBtn.click();
        renameInput.value = 'Dawn Treader';
        renameInput._fireKeydown({ code: 'Enter', preventDefault: (): void => {} });

        expect(info.shipName).toBe('Dawn Treader');
        expect(info.renaming).toBe(false);
    });

    it('cancels rename on Escape without changing name', () => {
        const info = createShipWithInfoPanel('ESV-7 (Unnamed)');
        const entityId = info.entity.id;

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();

        renameBtn.click();
        renameInput.value = 'NewName';
        // Escape on the input itself (stopPropagation prevents window handler)
        renameInput._fireKeydown({
            code: 'Escape',
            preventDefault: (): void => {},
            stopPropagation: (): void => {},
        });

        expect(info.shipName).toBe('ESV-7 (Unnamed)');
        expect(info.renaming).toBe(false);
    });

    it('rejects empty name and keeps previous name', () => {
        const info = createShipWithInfoPanel('ESV-7 (Unnamed)');
        const entityId = info.entity.id;

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();

        renameBtn.click();
        renameInput.value = '   '; // whitespace only
        renameOk.click();

        expect(info.shipName).toBe('ESV-7 (Unnamed)');
        expect(info.renaming).toBe(false);
    });

    it('does not close panel on ENTITY_CLICK while renaming', () => {
        const info = createShipWithInfoPanel();
        const entityId = info.entity.id;

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();

        renameBtn.click();
        expect(info.renaming).toBe(true);

        eventQueue.emit({
            type: GameEvents.ENTITY_CLICK,
            entityId: 5,
            entityName: 'star',
        });
        eventQueue.drain();

        expect(info.panelOpen).toBe(true);
        expect(info.renaming).toBe(true);
    });

    // --- Lifecycle ---

    it('starts with default ship name', () => {
        const info = createShipWithInfoPanel();
        expect(info.shipName).toBe('ESV-7 (Unnamed)');
    });

    it('accepts custom ship name via constructor', () => {
        const info = createShipWithInfoPanel('The Exodus');
        expect(info.shipName).toBe('The Exodus');
    });

    it('unsubscribes from events on destroy', () => {
        const info = createShipWithInfoPanel();
        const entityId = info.entity.id;

        info.destroy();

        eventQueue.emit({
            type: GameEvents.ENTITY_RIGHT_CLICK,
            entityId,
            entityName: 'arkSalvage',
        });
        eventQueue.drain();

        expect(info.panelOpen).toBe(false);
    });

    it('removes window keydown listener on destroy', () => {
        const info = createShipWithInfoPanel();
        expect(windowKeydownListeners).toHaveLength(1);

        info.destroy();
        expect(windowKeydownListeners).toHaveLength(0);
    });
});
