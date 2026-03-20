import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { CrewDetailUIComponent } from '../CrewDetailUIComponent';
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
        closest(_selector: string): MockElement | null { return null; },
        querySelector(_selector: string): MockElement | null { return null; },
        focus(): void { /* no-op */ },
        select(): void { /* no-op */ },
        _fireKeydown(e: Partial<KeyboardEvent>): void {
            for (const fn of listeners['keydown'] ?? []) fn(e);
        },
    };
}

// ---------------------------------------------------------------------------
// Stub document and window
// ---------------------------------------------------------------------------

let elementMap: Record<string, MockElement> = {};
const origDocument = globalThis.document;
const origWindow = (globalThis as Record<string, unknown>).window;

// Track click listeners added to the detail section
let detailSectionClickListeners: ((...args: unknown[]) => void)[] = [];

function installMocks(): void {
    detailSectionClickListeners = [];

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
    detailSectionClickListeners = [];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CrewDetailUIComponent', () => {
    let world: World;
    let detailSection: MockElement;

    beforeEach(() => {
        ServiceLocator.clear();
        const eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        detailSection = createMockElement('crew-detail-section');

        // Intercept addEventListener to capture click listeners
        const origAEL = detailSection.addEventListener;
        detailSection.addEventListener = (evt: string, fn: (...args: unknown[]) => void): void => {
            if (evt === 'click') detailSectionClickListeners.push(fn);
            origAEL.call(detailSection, evt, fn);
        };

        elementMap = {
            'ship-info-panel': createMockElement('ship-info-panel'),
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
            'crew-manifest-section': createMockElement('crew-manifest-section'),
            'crew-detail-section': detailSection,
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

    function createDetail(): {
        shipInfo: ShipInfoUIComponent;
        detail: CrewDetailUIComponent;
    } {
        const entity = world.createEntity('arkSalvage');
        entity.addComponent(new TransformComponent(400, 300));
        entity.addComponent(new SelectableComponent(18));
        const shipInfo = entity.addComponent(new ShipInfoUIComponent());
        shipInfo.init();
        const detail = entity.addComponent(new CrewDetailUIComponent());
        detail.init();
        return { shipInfo, detail };
    }

    // --- Visibility ---

    it('shows detail section when activeView is detail with entity ID', () => {
        const entityId = addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);

        expect(detailSection.classList.contains('active')).toBe(true);
    });

    it('hides detail section when activeView is overview', () => {
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'overview';
        detail.update(1 / 60);

        expect(detailSection.classList.contains('active')).toBe(false);
    });

    it('hides detail section when activeView is manifest', () => {
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'manifest';
        detail.update(1 / 60);

        expect(detailSection.classList.contains('active')).toBe(false);
    });

    it('hides detail section when activeView is detail but no entity ID', () => {
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = null;
        detail.update(1 / 60);

        expect(detailSection.classList.contains('active')).toBe(false);
    });

    // --- Content rendering ---

    it('renders crew member name', () => {
        const entityId = addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);

        expect(detailSection.innerHTML).toContain('Mira Chen');
    });

    it('renders age and role', () => {
        const entityId = addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);

        expect(detailSection.innerHTML).toContain('AGE 22');
        expect(detailSection.innerHTML).toContain('SOLDIER');
    });

    it('renders traits as tags', () => {
        const entityId = addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);

        expect(detailSection.innerHTML).toContain('crew-trait-tag');
        expect(detailSection.innerHTML).toContain('Stubborn');
        expect(detailSection.innerHTML).toContain('Empathetic');
    });

    it('renders morale bar with value', () => {
        const entityId = addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);

        expect(detailSection.innerHTML).toContain('55 / 100');
        expect(detailSection.innerHTML).toContain('width:55%');
    });

    // --- Morale colours ---

    it('shows green morale bar for morale >= 60', () => {
        const entityId = addCrewMember('Happy Person', 30, 'Civilian', 65);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);

        expect(detailSection.innerHTML).toContain('background:#44cc66');
    });

    it('shows amber morale bar for morale 40-59', () => {
        const entityId = addCrewMember('Okay Person', 30, 'Civilian', 50);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);

        expect(detailSection.innerHTML).toContain('background:#ccaa44');
    });

    it('shows red morale bar for morale < 40', () => {
        const entityId = addCrewMember('Sad Person', 30, 'Civilian', 30);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);

        expect(detailSection.innerHTML).toContain('background:#cc4444');
    });

    // --- Relationships ---

    it('renders relationships', () => {
        const miraId = addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const yaelId = addCrewMember('Dr. Yael Chen', 51, 'Medic', 65);

        // Wire relationship manually
        const miraEntity = world.getEntity(miraId);
        const miraComp = miraEntity?.getComponent(CrewMemberComponent);
        if (miraComp) {
            miraComp.relationships.push({
                targetId: yaelId,
                targetName: 'Dr. Yael Chen',
                type: 'Close Bond',
                level: 95,
                description: 'Yael is her mother',
            });
        }

        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = miraId;
        detail.update(1 / 60);

        expect(detailSection.innerHTML).toContain('Dr. Yael Chen');
        expect(detailSection.innerHTML).toContain('Close Bond');
        expect(detailSection.innerHTML).toContain('Yael is her mother');
    });

    it('shows no-relationships message when crew has none', () => {
        const entityId = addCrewMember('Lonely Person', 30, 'Civilian', 50);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);

        expect(detailSection.innerHTML).toContain('No known relationships');
    });

    // --- Relationship navigation ---

    it('navigates to related crew member on relationship name click', () => {
        const miraId = addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const yaelId = addCrewMember('Dr. Yael Chen', 51, 'Medic', 65);

        const miraEntity = world.getEntity(miraId);
        const miraComp = miraEntity?.getComponent(CrewMemberComponent);
        if (miraComp) {
            miraComp.relationships.push({
                targetId: yaelId,
                targetName: 'Dr. Yael Chen',
                type: 'Close Bond',
                level: 95,
                description: 'Yael is her mother',
            });
        }

        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = miraId;
        detail.update(1 / 60);

        // Simulate clicking the relationship name
        if (detailSectionClickListeners.length > 0) {
            const relNameEl = createMockElement('');
            relNameEl.dataset.entityId = String(yaelId);

            const target = createMockElement('');
            target.closest = (selector: string): MockElement | null => {
                if (selector === '.rel-name') return relNameEl;
                if (selector === '#detail-back-btn') return null;
                return null;
            };

            detailSectionClickListeners[0]({ target });
        }

        expect(shipInfo.selectedCrewEntityId).toBe(yaelId);
        expect(shipInfo.activeView).toBe('detail');
    });

    // --- Back button ---

    it('navigates to manifest on back button click', () => {
        const entityId = addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);

        // Simulate back button click
        if (detailSectionClickListeners.length > 0) {
            const backBtn = createMockElement('detail-back-btn');

            const target = createMockElement('');
            target.id = 'detail-back-btn';
            target.closest = (selector: string): MockElement | null => {
                if (selector === '#detail-back-btn') return backBtn;
                return null;
            };

            detailSectionClickListeners[0]({ target });
        }

        expect(shipInfo.activeView).toBe('manifest');
        expect(shipInfo.selectedCrewEntityId).toBeNull();
    });

    // --- Re-rendering ---

    it('updates content when selectedCrewEntityId changes', () => {
        const miraId = addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const yaelId = addCrewMember('Dr. Yael Chen', 51, 'Medic', 65);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = miraId;
        detail.update(1 / 60);
        expect(detailSection.innerHTML).toContain('Mira Chen');

        shipInfo.selectedCrewEntityId = yaelId;
        detail.update(1 / 60);
        expect(detailSection.innerHTML).toContain('Dr. Yael Chen');
        expect(detailSection.innerHTML).toContain('AGE 51');
    });

    it('does not re-render if same entity ID', () => {
        const entityId = addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);

        const firstHTML = detailSection.innerHTML;
        detail.update(1 / 60);
        // innerHTML should be identical (no unnecessary re-render)
        expect(detailSection.innerHTML).toBe(firstHTML);
    });

    // --- Edge cases ---

    it('handles invalid entity ID gracefully', () => {
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = 99999;
        detail.update(1 / 60);

        expect(detailSection.innerHTML).toContain('not found');
    });

    it('resets lastRenderedEntityId when leaving detail view', () => {
        const entityId = addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { shipInfo, detail } = createDetail();

        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detail.update(1 / 60);
        expect(detailSection.innerHTML).toContain('Mira Chen');

        // Switch away from detail
        shipInfo.activeView = 'manifest';
        detail.update(1 / 60);

        // Come back to same entity — should re-render
        shipInfo.activeView = 'detail';
        shipInfo.selectedCrewEntityId = entityId;
        detailSection.innerHTML = ''; // clear to prove it re-renders
        detail.update(1 / 60);
        expect(detailSection.innerHTML).toContain('Mira Chen');
    });

    // --- Destroy ---

    it('cleans up listeners on destroy', () => {
        addCrewMember('Mira Chen', 22, 'Soldier', 55);
        const { detail } = createDetail();

        // Should not throw
        detail.destroy();
    });
});
