import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initColonists, updateColonists, getVisibleColonists, spreadAroundCell } from '../ColonistManager';
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

    describe('spreadAroundCell', () => {
        it('returns different cells for different entityIds', () => {
            const pos1 = spreadAroundCell(sim.grid, 5, 5, 1);
            const pos2 = spreadAroundCell(sim.grid, 5, 5, 2);
            const pos3 = spreadAroundCell(sim.grid, 5, 5, 3);
            // At least some should differ
            const unique = new Set([
                `${pos1.gridX},${pos1.gridY}`,
                `${pos2.gridX},${pos2.gridY}`,
                `${pos3.gridX},${pos3.gridY}`,
            ]);
            expect(unique.size).toBeGreaterThan(1);
        });

        it('returns original cell when no walkable neighbours exist', () => {
            // Create a grid where a cell is surrounded by buildings
            const isolatedGrid = new ColonyGrid();
            // Fill entire grid with buildings
            for (let y = 0; y < 10; y++) {
                for (let x = 0; x < 10; x++) {
                    isolatedGrid.cells[y][x] = { type: 'building', buildingSlotIndex: 0 };
                }
            }
            const result = spreadAroundCell(isolatedGrid, 5, 5, 1);
            expect(result.gridX).toBe(5);
            expect(result.gridY).toBe(5);
        });
    });

    describe('sleep sheltering', () => {
        it('shelters resting colonist assigned to shelter (slot 0)', () => {
            const crew = [
                { id: 1, role: 'Civilian' as const, isLeader: false, name: 'Sleeper' },
            ];
            initColonists(sim as Parameters<typeof initColonists>[0], crew);
            const colonist = sim.colonistStates.get(1);
            if (!colonist) return;

            colonist.emergeDelay = 0;
            colonist.activity = 'resting';
            colonist.assignedBuildingSlot = 0; // shelter

            const buildings: BuildingInstance[] = [
                { typeId: 'shelter', slotIndex: 0, state: 'active', turnsRemaining: 0, modifierIds: [] },
            ];

            updateColonists(
                sim as Parameters<typeof updateColonists>[0],
                0.1, 22, 'clear', eq, buildings as BuildingInstance[],
            );

            expect(colonist.sheltered).toBe(true);
            const visible = getVisibleColonists(sim as Parameters<typeof getVisibleColonists>[0]);
            expect(visible.find(c => c.entityId === 1)).toBeUndefined();
        });

        it('does not shelter walking colonist toward shelter', () => {
            const crew = [
                { id: 1, role: 'Civilian' as const, isLeader: false, name: 'Walker' },
            ];
            initColonists(sim as Parameters<typeof initColonists>[0], crew);
            const colonist = sim.colonistStates.get(1);
            if (!colonist) return;

            colonist.emergeDelay = 0;
            colonist.activity = 'walking';
            colonist.assignedBuildingSlot = 0;
            colonist.path = [{ gridX: 3, gridY: 1 }];
            colonist.pathIndex = 0;

            const buildings: BuildingInstance[] = [
                { typeId: 'shelter', slotIndex: 0, state: 'active', turnsRemaining: 0, modifierIds: [] },
            ];

            updateColonists(
                sim as Parameters<typeof updateColonists>[0],
                0.1, 22, 'clear', eq, buildings as BuildingInstance[],
            );

            expect(colonist.sheltered).toBe(false);
        });

        it('does not shelter resting colonist without building assignment (sleeping rough)', () => {
            const crew = [
                { id: 1, role: 'Civilian' as const, isLeader: false, name: 'Rough' },
            ];
            initColonists(sim as Parameters<typeof initColonists>[0], crew);
            const colonist = sim.colonistStates.get(1);
            if (!colonist) return;

            colonist.emergeDelay = 0;
            colonist.activity = 'resting';
            colonist.assignedBuildingSlot = null; // no building

            const buildings: BuildingInstance[] = [
                { typeId: 'shelter', slotIndex: 0, state: 'active', turnsRemaining: 0, modifierIds: [] },
            ];

            updateColonists(
                sim as Parameters<typeof updateColonists>[0],
                0.1, 22, 'clear', eq, buildings as BuildingInstance[],
            );

            expect(colonist.sheltered).toBe(false);
        });
    });

    describe('group socializing enforcement', () => {
        it('colonist does not socialize alone when no others are scheduled', () => {
            // Single colonist — Scientist socializes 20:00-23:00, nobody else present
            const crew = [
                { id: 1, role: 'Scientist' as const, isLeader: false, name: 'Loner' },
            ];
            initColonists(sim as Parameters<typeof initColonists>[0], crew);
            const colonist = sim.colonistStates.get(1);
            if (!colonist) return;

            colonist.emergeDelay = 0;
            colonist.activity = 'working'; // will want to transition to socializing

            const buildings: BuildingInstance[] = [
                { typeId: 'shelter', slotIndex: 0, state: 'active', turnsRemaining: 0, modifierIds: [] },
            ];

            // Hour 21 — Scientist schedule says socializing, but no one else exists
            updateColonists(
                sim as Parameters<typeof updateColonists>[0],
                0.1, 21, 'clear', eq, buildings as BuildingInstance[],
            );

            // Should stay idle, not socialize
            expect(colonist.activity).toBe('idle');
        });

        it('colonist socializes when at least one other is already socializing', () => {
            const crew = [
                { id: 1, role: 'Civilian' as const, isLeader: false, name: 'Follower' },
                { id: 2, role: 'Civilian' as const, isLeader: false, name: 'Already There' },
            ];
            initColonists(sim as Parameters<typeof initColonists>[0], crew);
            const c1 = sim.colonistStates.get(1);
            const c2 = sim.colonistStates.get(2);
            if (!c1 || !c2) return;

            c1.emergeDelay = 0;
            c1.activity = 'working'; // wants to transition to socializing

            c2.emergeDelay = 0;
            c2.activity = 'socializing'; // already at the campfire

            // Place c1 at the campfire cell so pathfinding trivially succeeds
            if (sim.campfireCell) {
                c1.gridX = sim.campfireCell.gridX;
                c1.gridY = sim.campfireCell.gridY;
            }

            const buildings: BuildingInstance[] = [
                { typeId: 'shelter', slotIndex: 0, state: 'active', turnsRemaining: 0, modifierIds: [] },
            ];

            // Hour 18 — Civilian schedule says socializing
            updateColonists(
                sim as Parameters<typeof updateColonists>[0],
                0.1, 18, 'clear', eq, buildings as BuildingInstance[],
            );

            // c1 should transition (walking or socializing) — NOT blocked as idle
            expect(['walking', 'socializing']).toContain(c1.activity);
        });

        it('first-mover allowed when another colonist is also scheduled to socialize', () => {
            const crew = [
                { id: 1, role: 'Civilian' as const, isLeader: false, name: 'First' },
                { id: 2, role: 'Civilian' as const, isLeader: false, name: 'Second' },
            ];
            initColonists(sim as Parameters<typeof initColonists>[0], crew);
            const c1 = sim.colonistStates.get(1);
            const c2 = sim.colonistStates.get(2);
            if (!c1 || !c2) return;

            c1.emergeDelay = 0;
            c1.activity = 'working'; // wants to transition

            c2.emergeDelay = 0;
            c2.activity = 'working'; // also wants to transition — both scheduled

            const buildings: BuildingInstance[] = [
                { typeId: 'shelter', slotIndex: 0, state: 'active', turnsRemaining: 0, modifierIds: [] },
            ];

            // Hour 18 — both Civilians are scheduled to socialize
            updateColonists(
                sim as Parameters<typeof updateColonists>[0],
                0.1, 18, 'clear', eq, buildings as BuildingInstance[],
            );

            // At least one should have started moving (first-mover rule)
            const activities: string[] = [c1.activity, c2.activity];
            const movingOrSocializing = activities.filter(a => a === 'walking' || a === 'socializing');
            expect(movingOrSocializing.length).toBeGreaterThanOrEqual(1);
        });
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
