import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { CrewManifestUIComponent } from '../CrewManifestUIComponent';
import { ShipInfoUIComponent } from '../ShipInfoUIComponent';
import { TransformComponent } from '../TransformComponent';
import { SelectableComponent } from '../SelectableComponent';
import { CrewMemberComponent } from '../CrewMemberComponent';

// ---------------------------------------------------------------------------
// Minimal DOM mock
// ---------------------------------------------------------------------------

interface MockElement {
    id: string;
    innerHTML: string;
    textContent: string;
    style: Record<string, string>;
    dataset: Record<string, string>;
    classList: {
        add(c: string): void;
        remove(c: string): void;
        contains(c: string): boolean;
    };
    addEventListener(evt: string, fn: (...args: unknown[]) => void): void;
    removeEventListener(evt: string, fn: (...args: unknown[]) => void): void;
    click(): void;
    closest(selector: string): MockElement | null;
    querySelector(_selector: string): MockElement | null;
}

function createMockElement(id: string): MockElement {
    const classes = new Set<string>();
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const el: MockElement = {
        id,
        innerHTML: '',
        textContent: '',
        style: {},
        dataset: {},
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
        querySelector(_selector: string): MockElement | null {
            return null;
        },
        closest(_selector: string): MockElement | null {
            return null;
        },
    };
    return el;
}

// ---------------------------------------------------------------------------
// Stub document and window
// ---------------------------------------------------------------------------

let elementMap: Record<string, MockElement> = {};
const origDocument = globalThis.document;
const origWindow = (globalThis as Record<string, unknown>).window;

function installMocks(): void {
    (globalThis as Record<string, unknown>).document = {
        getElementById: (id: string): MockElement | null => elementMap[id] ?? null,
    };

    const mockWindow = {
        addEventListener: (): void => { /* no-op */ },
        removeEventListener: (): void => { /* no-op */ },
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
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CrewManifestUIComponent', () => {
    let world: World;
    let manifestSection: MockElement;
    let manifestList: MockElement;
    let manifestBackBtn: MockElement;

    // Ship panel elements (needed for ShipInfoUIComponent init)
    let panel: MockElement;

    beforeEach(() => {
        ServiceLocator.clear();
        const eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        panel = createMockElement('ship-info-panel');
        manifestSection = createMockElement('crew-manifest-section');
        manifestList = createMockElement('crew-manifest-list');
        manifestBackBtn = createMockElement('manifest-back-btn');

        // ShipInfoUIComponent needs these for its init
        elementMap = {
            'ship-info-panel': panel,
            'ship-name-label': createMockElement('ship-name-label'),
            'ship-rename-row': createMockElement('ship-rename-row'),
            'ship-rename-input': createMockElement('ship-rename-input'),
            'ship-rename-btn': createMockElement('ship-rename-btn'),
            'ship-rename-ok': createMockElement('ship-rename-ok'),
            'ship-range-fill': createMockElement('ship-range-fill'),
            'ship-range-text': createMockElement('ship-range-text'),
            'ship-panel-close': createMockElement('ship-panel-close'),
            'ship-view-manifest-btn': createMockElement('ship-view-manifest-btn'),
            'ship-overview-section': createMockElement('ship-overview-section'),
            'crew-manifest-section': manifestSection,
            'crew-detail-section': createMockElement('crew-detail-section'),
            'crew-manifest-list': manifestList,
            'manifest-back-btn': manifestBackBtn,
        };

        installMocks();
    });

    afterEach(() => {
        restoreMocks();
        elementMap = {};
    });

    function addCrewMember(
        name: string,
        age: number,
        role: 'Engineer' | 'Soldier' | 'Medic' | 'Scientist' | 'Civilian',
        morale: number,
    ): number {
        const entity = world.createEntity(name.toLowerCase().replace(/\s/g, ''));
        entity.addComponent(new CrewMemberComponent(
            name, age, role, morale, ['Stubborn', 'Empathetic'], 'Test backstory',
        ));
        return entity.id;
    }

    function createManifest(): {
        shipInfo: ShipInfoUIComponent;
        manifest: CrewManifestUIComponent;
    } {
        const entity = world.createEntity('arkSalvage');
        entity.addComponent(new TransformComponent(400, 300));
        entity.addComponent(new SelectableComponent(18));
        const shipInfo = entity.addComponent(new ShipInfoUIComponent());
        shipInfo.init();
        const manifest = entity.addComponent(new CrewManifestUIComponent());
        manifest.init();
        return { shipInfo, manifest };
    }

    // --- Rendering ---

    it('builds manifest rows for all crew on init', () => {
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        addCrewMember('Dr. Yael Chen', 51, 'Medic', 65);
        addCrewMember('Felix Torres', 35, 'Engineer', 42);

        createManifest();

        // Check that manifestSection innerHTML contains all crew names
        expect(manifestSection.innerHTML).toContain('Mira Chen');
        expect(manifestSection.innerHTML).toContain('Dr. Yael Chen');
        expect(manifestSection.innerHTML).toContain('Felix Torres');
    });

    it('sorts crew by role then name', () => {
        addCrewMember('Zara Diallo', 30, 'Civilian', 55);
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        addCrewMember('Felix Torres', 35, 'Engineer', 42);

        createManifest();

        const html = manifestSection.innerHTML;
        const soldierIdx = html.indexOf('Soldier');
        const engineerIdx = html.indexOf('Engineer');
        const civilianIdx = html.indexOf('Civilian');

        // Order: Soldier (0), Engineer (1), Civilian (4)
        expect(soldierIdx).toBeLessThan(engineerIdx);
        expect(engineerIdx).toBeLessThan(civilianIdx);
    });

    it('displays correct soul count', () => {
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        addCrewMember('Felix Torres', 35, 'Engineer', 42);

        createManifest();

        expect(manifestSection.innerHTML).toContain('2 SOULS ABOARD');
    });

    it('handles zero crew members gracefully', () => {
        const { manifest } = createManifest();
        expect(manifestSection.innerHTML).toContain('0 SOULS ABOARD');
        // No crash
        manifest.update(1 / 60);
    });

    // --- Morale dot colours ---

    it('shows green morale dot for morale >= 60', () => {
        addCrewMember('Happy Person', 30, 'Civilian', 65);
        createManifest();
        expect(manifestSection.innerHTML).toContain('background:#44cc66');
    });

    it('shows amber morale dot for morale 40-59', () => {
        addCrewMember('Okay Person', 30, 'Civilian', 50);
        createManifest();
        expect(manifestSection.innerHTML).toContain('background:#ccaa44');
    });

    it('shows red morale dot for morale < 40', () => {
        addCrewMember('Sad Person', 30, 'Civilian', 30);
        createManifest();
        expect(manifestSection.innerHTML).toContain('background:#cc4444');
    });

    // --- Visibility based on activeView ---

    it('shows manifest section when activeView is manifest', () => {
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, manifest } = createManifest();

        shipInfo.activeView = 'manifest';
        manifest.update(1 / 60);

        expect(manifestSection.classList.contains('active')).toBe(true);
    });

    it('hides manifest section when activeView is overview', () => {
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, manifest } = createManifest();

        shipInfo.activeView = 'overview';
        manifest.update(1 / 60);

        expect(manifestSection.classList.contains('active')).toBe(false);
    });

    it('hides manifest section when activeView is detail', () => {
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, manifest } = createManifest();

        shipInfo.activeView = 'detail';
        manifest.update(1 / 60);

        expect(manifestSection.classList.contains('active')).toBe(false);
    });

    // --- Row click navigation ---

    it('sets activeView to detail on crew row click', () => {
        const entityId = addCrewMember('Mira Chen', 22, 'Soldier', 55);

        // Capture the click listener that the manifest attaches to the list
        const listClickListeners: ((...args: unknown[]) => void)[] = [];
        const origAEL = manifestList.addEventListener;
        manifestList.addEventListener = (evt: string, fn: (...args: unknown[]) => void): void => {
            if (evt === 'click') listClickListeners.push(fn);
            origAEL.call(manifestList, evt, fn);
        };

        const { shipInfo } = createManifest();

        // Simulate clicking a row
        const mockRow = createMockElement('');
        mockRow.dataset.entityId = String(entityId);

        const target = createMockElement('');
        target.closest = (selector: string): MockElement | null => {
            if (selector === '.crew-manifest-row') return mockRow;
            return null;
        };

        expect(listClickListeners).toHaveLength(1);
        listClickListeners[0]({ target });

        expect(shipInfo.activeView).toBe('detail');
        expect(shipInfo.selectedCrewEntityId).toBe(entityId);
    });

    // --- Back button ---

    it('sets activeView to overview on back button click', () => {
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo } = createManifest();

        shipInfo.activeView = 'manifest';
        manifestBackBtn.click();

        expect(shipInfo.activeView).toBe('overview');
    });

    // --- Destroy ---

    it('cleans up listeners on destroy', () => {
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { manifest } = createManifest();

        // Should not throw
        manifest.destroy();
    });
});
