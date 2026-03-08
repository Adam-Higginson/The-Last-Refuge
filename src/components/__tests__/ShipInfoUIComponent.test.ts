import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { ShipInfoUIComponent } from '../ShipInfoUIComponent';
import { TransformComponent } from '../TransformComponent';
import { SelectableComponent } from '../SelectableComponent';
import { MovementComponent } from '../MovementComponent';

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
    let rangeFill: MockElement;
    let rangeText: MockElement;

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
        rangeFill = createMockElement('ship-range-fill');
        rangeText = createMockElement('ship-range-text');

        elementMap = {
            'ship-info-panel': panel,
            'ship-name-label': nameLabel,
            'ship-rename-row': renameRow,
            'ship-rename-input': renameInput,
            'ship-rename-btn': renameBtn,
            'ship-rename-ok': renameOk,
            'ship-range-fill': rangeFill,
            'ship-range-text': rangeText,
        };

        installMocks();
    });

    afterEach(() => {
        restoreMocks();
        elementMap = {};
    });

    function createShipWithInfoPanel(shipName?: string): {
        info: ShipInfoUIComponent;
        selectable: SelectableComponent;
    } {
        const entity = world.createEntity('arkSalvage');
        entity.addComponent(new TransformComponent(400, 300));
        const selectable = entity.addComponent(new SelectableComponent(18));
        const info = shipName
            ? entity.addComponent(new ShipInfoUIComponent(shipName))
            : entity.addComponent(new ShipInfoUIComponent());
        info.init();
        return { info, selectable };
    }

    // --- Panel open/close via selection ---

    it('opens panel when ship is selected', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        expect(info.panelOpen).toBe(true);
        expect(panel.classList.contains('open')).toBe(true);
    });

    it('closes panel when ship is deselected', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);
        expect(info.panelOpen).toBe(true);

        selectable.selected = false;
        info.update(1 / 60);
        expect(info.panelOpen).toBe(false);
        expect(panel.classList.contains('open')).toBe(false);
    });

    it('does not open panel if no SelectableComponent', () => {
        const entity = world.createEntity('arkSalvage');
        entity.addComponent(new TransformComponent(400, 300));
        const info = entity.addComponent(new ShipInfoUIComponent());
        info.init();

        info.update(1 / 60);
        expect(info.panelOpen).toBe(false);
    });

    it('deselects ship on Escape key (closes panel on next update)', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);
        expect(info.panelOpen).toBe(true);

        pressEscape();
        expect(selectable.selected).toBe(false);

        info.update(1 / 60);
        expect(info.panelOpen).toBe(false);
    });

    // --- Range display ---

    it('updates range display from MovementComponent when panel is open', () => {
        const { info, selectable } = createShipWithInfoPanel();
        const movement = info.entity.addComponent(new MovementComponent(300));

        selectable.selected = true;
        info.update(1 / 60);

        movement.budgetRemaining = 150;
        info.update(1 / 60);

        expect(rangeText.textContent).toBe('150 / 300');
    });

    it('shows green colour for budget ratio above 0.5', () => {
        const { info, selectable } = createShipWithInfoPanel();
        info.entity.addComponent(new MovementComponent(300));

        selectable.selected = true;
        info.update(1 / 60);

        expect(rangeFill.style.background).toBe('#44cc66');
    });

    it('shows amber colour for budget ratio between 0.25 and 0.5', () => {
        const { info, selectable } = createShipWithInfoPanel();
        const movement = info.entity.addComponent(new MovementComponent(300));

        selectable.selected = true;
        movement.budgetRemaining = 120;
        info.update(1 / 60);

        expect(rangeFill.style.background).toBe('#ccaa44');
    });

    it('shows red colour for budget ratio at or below 0.25', () => {
        const { info, selectable } = createShipWithInfoPanel();
        const movement = info.entity.addComponent(new MovementComponent(300));

        selectable.selected = true;
        movement.budgetRemaining = 60;
        info.update(1 / 60);

        expect(rangeFill.style.background).toBe('#cc4444');
    });

    it('handles missing MovementComponent gracefully', () => {
        const { info, selectable } = createShipWithInfoPanel();
        // No MovementComponent added

        selectable.selected = true;
        info.update(1 / 60);

        expect(info.panelOpen).toBe(true);
        // No crash, range display just doesn't update
    });

    // --- Rename ---

    it('enters rename mode when rename button is clicked', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        renameBtn.click();
        expect(info.renaming).toBe(true);
    });

    it('updates ship name on rename confirm (OK button)', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        renameBtn.click();
        renameInput.value = "Horizon's Edge";
        renameOk.click();

        expect(info.shipName).toBe("Horizon's Edge");
        expect(info.renaming).toBe(false);
    });

    it('updates ship name on Enter key in rename input', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        renameBtn.click();
        renameInput.value = 'Dawn Treader';
        renameInput._fireKeydown({ code: 'Enter', preventDefault: (): void => {} });

        expect(info.shipName).toBe('Dawn Treader');
        expect(info.renaming).toBe(false);
    });

    it('cancels rename on Escape in input without changing name', () => {
        const { info, selectable } = createShipWithInfoPanel('ESV-7 (Unnamed)');
        selectable.selected = true;
        info.update(1 / 60);

        renameBtn.click();
        renameInput.value = 'NewName';
        renameInput._fireKeydown({
            code: 'Escape',
            preventDefault: (): void => {},
            stopPropagation: (): void => {},
        });

        expect(info.shipName).toBe('ESV-7 (Unnamed)');
        expect(info.renaming).toBe(false);
        expect(info.panelOpen).toBe(true);
        expect(selectable.selected).toBe(true);
    });

    it('rejects empty name and keeps previous name', () => {
        const { info, selectable } = createShipWithInfoPanel('ESV-7 (Unnamed)');
        selectable.selected = true;
        info.update(1 / 60);

        renameBtn.click();
        renameInput.value = '   '; // whitespace only
        renameOk.click();

        expect(info.shipName).toBe('ESV-7 (Unnamed)');
        expect(info.renaming).toBe(false);
    });

    it('cancels rename when ship is deselected', () => {
        const { info, selectable } = createShipWithInfoPanel('ESV-7 (Unnamed)');
        selectable.selected = true;
        info.update(1 / 60);

        renameBtn.click();
        renameInput.value = 'NewName';
        expect(info.renaming).toBe(true);

        selectable.selected = false;
        info.update(1 / 60);

        expect(info.panelOpen).toBe(false);
        expect(info.renaming).toBe(false);
        expect(info.shipName).toBe('ESV-7 (Unnamed)');
    });

    // --- Lifecycle ---

    it('starts with default ship name', () => {
        const { info } = createShipWithInfoPanel();
        expect(info.shipName).toBe('ESV-7 (Unnamed)');
    });

    it('accepts custom ship name via constructor', () => {
        const { info } = createShipWithInfoPanel('The Exodus');
        expect(info.shipName).toBe('The Exodus');
    });

    it('removes window keydown listener on destroy', () => {
        const { info } = createShipWithInfoPanel();
        expect(windowKeydownListeners).toHaveLength(1);

        info.destroy();
        expect(windowKeydownListeners).toHaveLength(0);
    });
});
