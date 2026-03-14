import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { PlanetViewInputComponent } from '../PlanetViewInputComponent';
import { GameModeComponent } from '../GameModeComponent';
import { RegionDataComponent } from '../RegionDataComponent';

// ---------------------------------------------------------------------------
// Mock canvas and DOM
// ---------------------------------------------------------------------------

const origDocument = globalThis.document;
const origWindow = (globalThis as Record<string, unknown>).window;

let canvasListeners: Record<string, ((...args: unknown[]) => void)[]>;
let windowListeners: Record<string, ((...args: unknown[]) => void)[]>;

function createMockCanvas(): Record<string, unknown> {
    canvasListeners = {};
    return {
        addEventListener: (type: string, fn: (...args: unknown[]) => void): void => {
            (canvasListeners[type] ??= []).push(fn);
        },
        removeEventListener: (type: string, fn: (...args: unknown[]) => void): void => {
            const list = canvasListeners[type];
            if (!list) return;
            const idx = list.indexOf(fn);
            if (idx !== -1) list.splice(idx, 1);
        },
    };
}

const mockBackBtn = {
    style: { display: '' },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
};

function installMocks(canvas: Record<string, unknown>): void {
    windowListeners = {};

    (globalThis as Record<string, unknown>).document = {
        getElementById: (id: string): unknown => {
            if (id === 'planet-view-back') return mockBackBtn;
            return null;
        },
    };

    (globalThis as Record<string, unknown>).window = {
        addEventListener: (type: string, fn: (...args: unknown[]) => void): void => {
            (windowListeners[type] ??= []).push(fn);
        },
        removeEventListener: (type: string, fn: (...args: unknown[]) => void): void => {
            const list = windowListeners[type];
            if (!list) return;
            const idx = list.indexOf(fn);
            if (idx !== -1) list.splice(idx, 1);
        },
    };

    ServiceLocator.register('canvas', canvas);
}

function restoreMocks(): void {
    (globalThis as Record<string, unknown>).document = origDocument;
    if (origWindow !== undefined) {
        (globalThis as Record<string, unknown>).window = origWindow;
    } else {
        delete (globalThis as Record<string, unknown>).window;
    }
}

function fireCanvasClick(): void {
    for (const fn of canvasListeners['click'] ?? []) {
        fn({} as MouseEvent);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PlanetViewInputComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let gameMode: GameModeComponent;
    let inputComp: PlanetViewInputComponent;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        const canvas = createMockCanvas();
        installMocks(canvas);

        // Create gameState with GameModeComponent
        const gameState = world.createEntity('gameState');
        gameMode = gameState.addComponent(new GameModeComponent());
        gameMode.mode = 'planet';

        // Create planet entity with PlanetViewInputComponent + RegionDataComponent
        const planet = world.createEntity('newTerra');
        const regionData = planet.addComponent(new RegionDataComponent());
        regionData.regions = [
            { id: 0, biome: 'Temperate Plains', colour: '#5a9a4a', vertices: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], canColonise: true, isLandingZone: true, colonised: false, buildings: [], buildingSlots: 0 },
            { id: 1, biome: 'Ocean', colour: '#1a3a6a', vertices: [{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 100, y: 100 }], canColonise: false, isLandingZone: false, colonised: false, buildings: [], buildingSlots: 0 },
        ];

        inputComp = planet.addComponent(new PlanetViewInputComponent());
        inputComp.init();
    });

    afterEach(() => {
        inputComp.destroy();
        restoreMocks();
        ServiceLocator.clear();
    });

    describe('selectedRegionId', () => {
        it('starts with selectedRegionId = -1', () => {
            expect(inputComp.selectedRegionId).toBe(-1);
        });

        it('sets selectedRegionId to hovered region on click', () => {
            // Simulate hovering region 0
            inputComp.hoveredRegionId = 0;
            fireCanvasClick();

            expect(inputComp.selectedRegionId).toBe(0);
        });

        it('deselects region when clicking the same region again', () => {
            inputComp.hoveredRegionId = 0;
            inputComp.selectedRegionId = 0;
            fireCanvasClick();

            expect(inputComp.selectedRegionId).toBe(-1);
        });

        it('changes selection when clicking a different region', () => {
            inputComp.selectedRegionId = 0;
            inputComp.hoveredRegionId = 1;
            fireCanvasClick();

            expect(inputComp.selectedRegionId).toBe(1);
        });

        it('deselects when clicking empty space', () => {
            inputComp.selectedRegionId = 0;
            inputComp.hoveredRegionId = -1;
            fireCanvasClick();

            expect(inputComp.selectedRegionId).toBe(-1);
        });

        it('resets selectedRegionId when leaving planet mode', () => {
            inputComp.selectedRegionId = 0;
            gameMode.mode = 'system';
            inputComp.update(1 / 60);

            expect(inputComp.selectedRegionId).toBe(-1);
        });

        it('does not select when not in planet mode', () => {
            gameMode.mode = 'system';
            inputComp.hoveredRegionId = 0;
            fireCanvasClick();

            expect(inputComp.selectedRegionId).toBe(-1);
        });
    });

    describe('lifecycle', () => {
        it('removes click listener on destroy', () => {
            expect(canvasListeners['click']).toHaveLength(1);
            inputComp.destroy();
            expect(canvasListeners['click']).toHaveLength(0);
        });
    });
});
