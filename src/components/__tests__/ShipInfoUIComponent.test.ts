import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
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
    _fireEvent(eventName: string): void;
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
        _fireEvent(eventName: string): void {
            for (const fn of listeners[eventName] ?? []) fn();
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
    let closeBtn: MockElement;
    let manifestBtn: MockElement;
    let overviewSection: MockElement;
    let manifestSection: MockElement;
    let detailSection: MockElement;
    let coloniseBtn: MockElement;
    let coloniseWrapper: MockElement;
    let coloniseTooltip: MockElement;

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
        closeBtn = createMockElement('ship-panel-close');
        manifestBtn = createMockElement('ship-view-manifest-btn');
        overviewSection = createMockElement('ship-overview-section');
        manifestSection = createMockElement('crew-manifest-section');
        detailSection = createMockElement('crew-detail-section');
        coloniseBtn = createMockElement('ship-colonise-btn');
        coloniseWrapper = createMockElement('ship-colonise-wrapper');
        coloniseTooltip = createMockElement('ship-colonise-tooltip');

        elementMap = {
            'ship-info-panel': panel,
            'ship-name-label': nameLabel,
            'ship-rename-row': renameRow,
            'ship-rename-input': renameInput,
            'ship-rename-btn': renameBtn,
            'ship-rename-ok': renameOk,
            'ship-range-fill': rangeFill,
            'ship-range-text': rangeText,
            'ship-panel-close': closeBtn,
            'ship-view-manifest-btn': manifestBtn,
            'ship-overview-section': overviewSection,
            'crew-manifest-section': manifestSection,
            'crew-detail-section': detailSection,
            'ship-colonise-btn': coloniseBtn,
            'ship-colonise-wrapper': coloniseWrapper,
            'ship-colonise-tooltip': coloniseTooltip,
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

    // --- Close button ---

    it('deselects ship when close button is clicked', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);
        expect(info.panelOpen).toBe(true);

        closeBtn.click();
        expect(selectable.selected).toBe(false);
    });

    // --- View state ---

    it('starts with overview as active view', () => {
        const { info } = createShipWithInfoPanel();
        expect(info.activeView).toBe('overview');
        expect(info.selectedCrewEntityId).toBeNull();
    });

    it('switches to manifest view when VIEW MANIFEST is clicked', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        manifestBtn.click();
        expect(info.activeView).toBe('manifest');
    });

    it('adds wide class when activeView is manifest', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);
        expect(panel.classList.contains('wide')).toBe(false);

        info.activeView = 'manifest';
        info.update(1 / 60);
        expect(panel.classList.contains('wide')).toBe(true);
    });

    it('adds wide class when activeView is detail', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.activeView = 'detail';
        info.update(1 / 60);
        expect(panel.classList.contains('wide')).toBe(true);
    });

    it('removes wide class when activeView returns to overview', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.activeView = 'manifest';
        info.update(1 / 60);
        expect(panel.classList.contains('wide')).toBe(true);

        info.activeView = 'overview';
        info.update(1 / 60);
        expect(panel.classList.contains('wide')).toBe(false);
    });

    it('shows overview section when activeView is overview', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        expect(overviewSection.classList.contains('active')).toBe(true);
    });

    it('hides overview section when activeView is manifest', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.activeView = 'manifest';
        info.update(1 / 60);

        expect(overviewSection.classList.contains('active')).toBe(false);
    });

    it('resets activeView and selectedCrewEntityId on panel close', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        info.activeView = 'detail';
        info.selectedCrewEntityId = 42;

        selectable.selected = false;
        info.update(1 / 60);

        expect(info.activeView).toBe('overview');
        expect(info.selectedCrewEntityId).toBeNull();
    });

    // --- Escape key view navigation ---

    it('navigates from detail to manifest on Escape', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        info.activeView = 'detail';
        info.selectedCrewEntityId = 42;

        pressEscape();
        expect(info.activeView).toBe('manifest');
        expect(info.selectedCrewEntityId).toBeNull();
        expect(selectable.selected).toBe(true);
    });

    it('navigates from manifest to overview on Escape', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        info.activeView = 'manifest';

        pressEscape();
        expect(info.activeView).toBe('overview');
        expect(selectable.selected).toBe(true);
    });

    it('deselects ship on Escape from overview', () => {
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

    it('does not update range display when on manifest view', () => {
        const { info, selectable } = createShipWithInfoPanel();
        const movement = info.entity.addComponent(new MovementComponent(300));

        selectable.selected = true;
        info.update(1 / 60);

        // Switch to manifest and change budget
        info.activeView = 'manifest';
        movement.budgetRemaining = 50;
        rangeText.textContent = ''; // reset to confirm it doesn't update
        info.update(1 / 60);

        expect(rangeText.textContent).toBe('');
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

    it('cancels rename on Escape when renaming (does not navigate views)', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        renameBtn.click();
        expect(info.renaming).toBe(true);

        pressEscape();
        expect(info.renaming).toBe(false);
        // Should still be on overview, panel still open
        expect(info.activeView).toBe('overview');
        expect(selectable.selected).toBe(true);
    });

    // --- COLONISE button ---

    it('enables COLONISE button when ship is in range of planet', () => {
        const planet = world.createEntity('newTerra');
        planet.addComponent(new TransformComponent(400, 300)); // same as ship
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        expect(coloniseBtn.classList.contains('disabled')).toBe(false);
    });

    it('disables COLONISE button when ship is out of range', () => {
        const planet = world.createEntity('newTerra');
        planet.addComponent(new TransformComponent(0, 0)); // far from ship at (400, 300)
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        expect(coloniseBtn.classList.contains('disabled')).toBe(true);
    });

    it('disables COLONISE button when no planet exists', () => {
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        expect(coloniseBtn.classList.contains('disabled')).toBe(true);
    });

    it('blocks click when COLONISE is disabled', () => {
        const planet = world.createEntity('newTerra');
        planet.addComponent(new TransformComponent(0, 0)); // out of range
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        const emitSpy = vi.spyOn(eventQueue, 'emit');
        coloniseBtn.click();
        expect(emitSpy).not.toHaveBeenCalled();
    });

    it('shows tooltip on hover when COLONISE is disabled', () => {
        const planet = world.createEntity('newTerra');
        planet.addComponent(new TransformComponent(0, 0)); // out of range
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        coloniseWrapper._fireEvent('mouseenter');
        expect(coloniseTooltip.style.display).toBe('block');

        coloniseWrapper._fireEvent('mouseleave');
        expect(coloniseTooltip.style.display).toBe('none');
    });

    it('does not show tooltip on hover when COLONISE is enabled', () => {
        const planet = world.createEntity('newTerra');
        planet.addComponent(new TransformComponent(400, 300)); // in range
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        coloniseWrapper._fireEvent('mouseenter');
        expect(coloniseTooltip.style.display).not.toBe('block');
    });

    it('emits PLANET_VIEW_ENTER when COLONISE is clicked', () => {
        const planet = world.createEntity('newTerra');
        planet.addComponent(new TransformComponent(400, 300));
        const { info, selectable } = createShipWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        const emitSpy = vi.spyOn(eventQueue, 'emit');
        coloniseBtn.click();

        expect(emitSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: GameEvents.PLANET_VIEW_ENTER,
                entityId: planet.id,
            }),
        );
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
