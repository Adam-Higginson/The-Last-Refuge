import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { PlanetInfoUIComponent } from '../PlanetInfoUIComponent';
import { SelectableComponent } from '../SelectableComponent';
import { RegionDataComponent } from '../RegionDataComponent';
import { TransformComponent } from '../TransformComponent';

// ---------------------------------------------------------------------------
// Minimal DOM mock
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
    click(): void;
    _fireEvent(eventName: string): void;
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

describe('PlanetInfoUIComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let panel: MockElement;
    let closeBtn: MockElement;
    let statusDot: MockElement;
    let statusText: MockElement;
    let biomeSummary: MockElement;
    let surfaceBtn: MockElement;
    let surfaceWrapper: MockElement;
    let surfaceTooltip: MockElement;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        panel = createMockElement('planet-info-panel');
        closeBtn = createMockElement('planet-panel-close');
        statusDot = createMockElement('planet-status-dot');
        statusText = createMockElement('planet-status-text');
        biomeSummary = createMockElement('planet-biome-summary');
        surfaceBtn = createMockElement('planet-view-surface-btn');
        surfaceWrapper = createMockElement('planet-surface-wrapper');
        surfaceTooltip = createMockElement('planet-surface-tooltip');

        elementMap = {
            'planet-info-panel': panel,
            'planet-panel-close': closeBtn,
            'planet-status-dot': statusDot,
            'planet-status-text': statusText,
            'planet-biome-summary': biomeSummary,
            'planet-view-surface-btn': surfaceBtn,
            'planet-surface-wrapper': surfaceWrapper,
            'planet-surface-tooltip': surfaceTooltip,
        };

        installMocks();
    });

    afterEach(() => {
        restoreMocks();
        elementMap = {};
    });

    function createPlanetWithInfoPanel(): {
        info: PlanetInfoUIComponent;
        selectable: SelectableComponent;
        regionData: RegionDataComponent;
    } {
        const entity = world.createEntity('newTerra');
        entity.addComponent(new TransformComponent(500, 400));
        const selectable = entity.addComponent(new SelectableComponent(20));
        const regionData = entity.addComponent(new RegionDataComponent());
        regionData.regions = [
            { id: 0, biome: 'Temperate Plains', colour: '#5a9a4a', vertices: [], canColonise: true, isLandingZone: true, colonised: false },
            { id: 1, biome: 'Temperate Plains', colour: '#5a9a4a', vertices: [], canColonise: true, isLandingZone: false, colonised: false },
            { id: 2, biome: 'Arctic Wastes', colour: '#b8d0e0', vertices: [], canColonise: true, isLandingZone: false, colonised: false },
        ];
        const info = entity.addComponent(new PlanetInfoUIComponent());
        info.init();
        return { info, selectable, regionData };
    }

    function createShipAt(x: number, y: number): void {
        const ship = world.createEntity('arkSalvage');
        ship.addComponent(new TransformComponent(x, y));
    }

    // --- Panel open/close via selection ---

    it('opens panel when planet is selected', () => {
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        expect(info.panelOpen).toBe(true);
        expect(panel.classList.contains('open')).toBe(true);
    });

    it('closes panel when planet is deselected', () => {
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);
        expect(info.panelOpen).toBe(true);

        selectable.selected = false;
        info.update(1 / 60);
        expect(info.panelOpen).toBe(false);
        expect(panel.classList.contains('open')).toBe(false);
    });

    it('does not open panel if no SelectableComponent', () => {
        const entity = world.createEntity('newTerra');
        entity.addComponent(new RegionDataComponent());
        const info = entity.addComponent(new PlanetInfoUIComponent());
        info.init();

        info.update(1 / 60);
        expect(info.panelOpen).toBe(false);
    });

    // --- Close button ---

    it('deselects planet when close button is clicked', () => {
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);
        expect(info.panelOpen).toBe(true);

        closeBtn.click();
        expect(selectable.selected).toBe(false);
    });

    // --- Escape key ---

    it('deselects planet on Escape when panel is open', () => {
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);
        expect(info.panelOpen).toBe(true);

        pressEscape();
        expect(selectable.selected).toBe(false);

        info.update(1 / 60);
        expect(info.panelOpen).toBe(false);
    });

    it('does not react to Escape when panel is closed', () => {
        const { info, selectable } = createPlanetWithInfoPanel();
        expect(info.panelOpen).toBe(false);

        pressEscape();
        // No crash, nothing changed
        expect(selectable.selected).toBe(false);
    });

    // --- VIEW SURFACE button ---

    it('emits PLANET_VIEW_ENTER when VIEW SURFACE is clicked', () => {
        createShipAt(500, 400); // in range
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        const emitSpy = vi.spyOn(eventQueue, 'emit');
        surfaceBtn.click();

        expect(emitSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                type: GameEvents.PLANET_VIEW_ENTER,
                entityId: info.entity.id,
            }),
        );
    });

    // --- Content updates ---

    it('shows UNCOLONISED status when no region is colonised', () => {
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        expect(statusText.textContent).toBe('UNCOLONISED');
        expect(statusDot.style.background).toBe('#ccaa44');
    });

    it('shows COLONY ESTABLISHED status when colonised', () => {
        const { info, selectable, regionData } = createPlanetWithInfoPanel();
        regionData.colonised = true;
        selectable.selected = true;
        info.update(1 / 60);

        expect(statusText.textContent).toBe('COLONY ESTABLISHED');
        expect(statusDot.style.background).toBe('#44cc66');
    });

    it('shows biome summary counts', () => {
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        // 2 Temperate Plains, 1 Arctic Wastes — output depends on BIOME_DEFINITIONS order
        // Should contain both counts
        const text = biomeSummary.textContent;
        expect(text).toContain('TEMPERATE PLAINS');
        expect(text).toContain('ARCTIC WASTES');
    });

    // --- VIEW SURFACE range-gating ---

    it('enables VIEW SURFACE when ship is in range', () => {
        createShipAt(500, 400); // same position as planet
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        expect(surfaceBtn.classList.contains('disabled')).toBe(false);
    });

    it('disables VIEW SURFACE when ship is out of range', () => {
        createShipAt(0, 0); // far from planet at (500, 400)
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        expect(surfaceBtn.classList.contains('disabled')).toBe(true);
    });

    it('disables VIEW SURFACE when no ship exists', () => {
        // No ship entity created
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        expect(surfaceBtn.classList.contains('disabled')).toBe(true);
    });

    it('blocks click when VIEW SURFACE is disabled', () => {
        createShipAt(0, 0); // out of range
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);
        expect(surfaceBtn.classList.contains('disabled')).toBe(true);

        const emitSpy = vi.spyOn(eventQueue, 'emit');
        surfaceBtn.click();
        expect(emitSpy).not.toHaveBeenCalled();
    });

    it('shows tooltip on hover when VIEW SURFACE is disabled', () => {
        createShipAt(0, 0); // out of range
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        surfaceWrapper._fireEvent('mouseenter');
        expect(surfaceTooltip.style.display).toBe('block');

        surfaceWrapper._fireEvent('mouseleave');
        expect(surfaceTooltip.style.display).toBe('none');
    });

    it('does not show tooltip on hover when VIEW SURFACE is enabled', () => {
        createShipAt(500, 400); // in range
        const { info, selectable } = createPlanetWithInfoPanel();
        selectable.selected = true;
        info.update(1 / 60);

        surfaceWrapper._fireEvent('mouseenter');
        expect(surfaceTooltip.style.display).not.toBe('block');
    });

    // --- Lifecycle ---

    it('removes window keydown listener on destroy', () => {
        const { info } = createPlanetWithInfoPanel();
        expect(windowKeydownListeners).toHaveLength(1);

        info.destroy();
        expect(windowKeydownListeners).toHaveLength(0);
    });
});
