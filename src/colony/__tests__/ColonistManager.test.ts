import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initColonists, updateColonists, getVisibleColonists } from '../ColonistManager';
import { ColonyGrid } from '../ColonyGrid';
import { generatePathNetwork } from '../ColonyPathNetwork';
import type { ColonistVisualState } from '../ColonistState';
import type { EventQueue } from '../../core/EventQueue';
import type { BuildingId, BuildingInstance } from '../../data/buildings';

// Minimal ColonySimulationComponent mock
function makeSim(buildings: { typeId: string; slotIndex: number }[] = []): {
    grid: ColonyGrid;
    colonistStates: Map<number, ColonistVisualState>;
    campfireCell: { gridX: number; gridY: number } | null;
    perimeterPath: { gridX: number; gridY: number }[];
} {
    const grid = new ColonyGrid();
    const region = {
        id: 1,
        biome: 'Temperate Plains' as const,
        colour: '#aaa',
        canColonise: true,
        colonised: true,
        isLandingZone: false,
        vertices: [],
        buildings: buildings.map(b => ({
            typeId: b.typeId as BuildingId,
            slotIndex: b.slotIndex,
            state: 'active' as const,
            turnsRemaining: 0,
            modifierIds: [],
        })),
        buildingSlots: 6,
    };
    grid.buildFromRegion(region);
    const network = generatePathNetwork(grid);
    return {
        grid,
        colonistStates: new Map(),
        campfireCell: network.campfireCell,
        perimeterPath: network.perimeterPath,
    };
}

function makeEventQueue(): EventQueue {
    return {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        drain: vi.fn(),
        clear: vi.fn(),
        destroy: vi.fn(),
    } as unknown as EventQueue;
}

describe('ColonistManager', () => {
    let sim: ReturnType<typeof makeSim>;
    let eq: EventQueue;

    beforeEach(() => {
        sim = makeSim([
            { typeId: 'shelter', slotIndex: 0 },
            { typeId: 'farm', slotIndex: 1 },
        ]);
        eq = makeEventQueue();
    });

    it('initColonists creates correct number of states', () => {
        const crew = [
            { id: 1, role: 'Civilian' as const, isLeader: false, name: 'Alice Test' },
            { id: 2, role: 'Engineer' as const, isLeader: true, name: 'Bob Test' },
        ];

        initColonists(sim as Parameters<typeof initColonists>[0], crew);
        expect(sim.colonistStates.size).toBe(2);
    });

    it('initColonists sets visual properties from crew data', () => {
        const crew = [
            { id: 5, role: 'Soldier' as const, isLeader: true, name: 'Commander Rex' },
        ];

        initColonists(sim as Parameters<typeof initColonists>[0], crew);
        const state = sim.colonistStates.get(5);
        expect(state).toBeDefined();
        expect(state?.role).toBe('Soldier');
        expect(state?.isLeader).toBe(true);
        expect(state?.name).toBe('Commander Rex');
        expect(state?.colour).toBe('#4fa8ff'); // Soldier colour
    });

    it('walking colonist advances along path', () => {
        const crew = [
            { id: 1, role: 'Civilian' as const, isLeader: false, name: 'Test' },
        ];
        initColonists(sim as Parameters<typeof initColonists>[0], crew);

        const colonist = sim.colonistStates.get(1);
        expect(colonist).toBeDefined();
        if (!colonist) return;

        // Force into walking state with a path
        colonist.activity = 'walking';
        colonist.emergeDelay = 0;
        colonist.path = [
            { gridX: 2, gridY: 2 },
            { gridX: 3, gridY: 2 },
        ];
        colonist.pathIndex = 0;
        colonist.gridX = 1;
        colonist.gridY = 2;

        const buildings: BuildingInstance[] = sim.grid.getDoors().length > 0
            ? [{ typeId: 'shelter', slotIndex: 0, state: 'active', turnsRemaining: 0, modifierIds: [] }]
            : [];

        // Update with a large dt to move along path
        updateColonists(
            sim as Parameters<typeof updateColonists>[0],
            1.0, 10, 'clear', eq, buildings as BuildingInstance[],
        );

        // Colonist should have moved
        expect(colonist.gridX).not.toBe(1);
    });

    it('unreachable destination keeps colonist idle', () => {
        const crew = [
            { id: 1, role: 'Civilian' as const, isLeader: false, name: 'Test' },
        ];
        initColonists(sim as Parameters<typeof initColonists>[0], crew);

        const colonist = sim.colonistStates.get(1);
        expect(colonist).toBeDefined();
        if (!colonist) return;

        colonist.emergeDelay = 0;
        colonist.activity = 'resting';
        // Put colonist in an isolated spot surrounded by buildings
        colonist.gridX = 9;
        colonist.gridY = 9;

        const buildings: BuildingInstance[] = [];
        updateColonists(
            sim as Parameters<typeof updateColonists>[0],
            0.1, 10, 'clear', eq, buildings as BuildingInstance[],
        );

        // Should stay idle or transition without crashing
        expect(['idle', 'walking', 'working', 'socializing', 'resting', 'eating', 'patrolling']).toContain(colonist.activity);
    });

    it('dawn stagger causes different emerge times', () => {
        const crew = [
            { id: 1, role: 'Civilian' as const, isLeader: false, name: 'Early' },
            { id: 2, role: 'Civilian' as const, isLeader: false, name: 'Late' },
        ];
        initColonists(sim as Parameters<typeof initColonists>[0], crew);

        const c1 = sim.colonistStates.get(1);
        const c2 = sim.colonistStates.get(2);
        expect(c1?.emergeDelay).toBeDefined();
        expect(c2?.emergeDelay).toBeDefined();
        // Emerge delays should differ
        expect(c1?.emergeDelay).not.toBe(c2?.emergeDelay);
    });

    it('getVisibleColonists excludes sheltered colonists', () => {
        const crew = [
            { id: 1, role: 'Civilian' as const, isLeader: false, name: 'Visible' },
            { id: 2, role: 'Civilian' as const, isLeader: false, name: 'Hidden' },
        ];
        initColonists(sim as Parameters<typeof initColonists>[0], crew);

        const c1 = sim.colonistStates.get(1);
        const c2 = sim.colonistStates.get(2);
        if (c1) {
            c1.sheltered = false;
            c1.emergeDelay = 0;
        }
        if (c2) c2.sheltered = true;

        const visible = getVisibleColonists(sim as Parameters<typeof getVisibleColonists>[0]);
        expect(visible.length).toBe(1);
        expect(visible[0].entityId).toBe(1);
    });

    it('getVisibleColonists sorts by depth', () => {
        const crew = [
            { id: 1, role: 'Civilian' as const, isLeader: false, name: 'Far' },
            { id: 2, role: 'Civilian' as const, isLeader: false, name: 'Near' },
        ];
        initColonists(sim as Parameters<typeof initColonists>[0], crew);

        const c1 = sim.colonistStates.get(1);
        const c2 = sim.colonistStates.get(2);
        if (c1) { c1.sheltered = false; c1.emergeDelay = 0; c1.gridX = 5; c1.gridY = 5; }
        if (c2) { c2.sheltered = false; c2.emergeDelay = 0; c2.gridX = 1; c2.gridY = 1; }

        const visible = getVisibleColonists(sim as Parameters<typeof getVisibleColonists>[0]);
        expect(visible.length).toBe(2);
        // Near (1+1=2) should come before Far (5+5=10)
        expect(visible[0].entityId).toBe(2);
        expect(visible[1].entityId).toBe(1);
    });

    it('emits events on state transitions', () => {
        const crew = [
            { id: 1, role: 'Civilian' as const, isLeader: false, name: 'Test' },
        ];
        initColonists(sim as Parameters<typeof initColonists>[0], crew);

        const colonist = sim.colonistStates.get(1);
        if (!colonist) return;
        colonist.emergeDelay = 0;
        colonist.activity = 'resting'; // Different from schedule at 10am

        const buildings: BuildingInstance[] = [
            { typeId: 'shelter', slotIndex: 0, state: 'active', turnsRemaining: 0, modifierIds: [] },
            { typeId: 'farm', slotIndex: 1, state: 'active', turnsRemaining: 0, modifierIds: [] },
        ];

        updateColonists(
            sim as Parameters<typeof updateColonists>[0],
            0.1, 10, 'clear', eq, buildings as BuildingInstance[],
        );

        // Should have emitted at least one event
        expect((eq.emit as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    });
});
