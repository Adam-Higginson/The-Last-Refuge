import { describe, it, expect } from 'vitest';
import { ColonyGrid, COLONY_GRID_SIZE } from '../ColonyGrid';
import type { Region } from '../../components/RegionDataComponent';

function makeRegion(buildings: { typeId: string; slotIndex: number }[]): Region {
    return {
        id: 1,
        biome: 'Temperate Plains',
        colour: '#aaa',
        canColonise: true,
        colonised: true,
        isLandingZone: false,
        vertices: [],
        buildings: buildings.map(b => ({
            typeId: b.typeId as 'shelter',
            slotIndex: b.slotIndex,
            state: 'active' as const,
            turnsRemaining: 0,
            modifierIds: [],
        })),
        buildingSlots: 6,
    };
}

describe('ColonyGrid', () => {
    it('builds from region with 0 buildings', () => {
        const grid = new ColonyGrid();
        grid.buildFromRegion(makeRegion([]));
        // All cells should be empty
        for (let y = 0; y < COLONY_GRID_SIZE; y++) {
            for (let x = 0; x < COLONY_GRID_SIZE; x++) {
                expect(grid.getCell(x, y)?.type).toBe('empty');
            }
        }
    });

    it('builds from region with 1 building', () => {
        const grid = new ColonyGrid();
        grid.buildFromRegion(makeRegion([{ typeId: 'shelter', slotIndex: 0 }]));
        // Shelter is 2x2 at position (2,1)
        expect(grid.getCell(2, 1)?.type).toBe('building');
        expect(grid.getCell(3, 2)?.type).toBe('building');
        expect(grid.getCell(4, 1)?.type).toBe('empty');
    });

    it('builds from region with 6 buildings', () => {
        const grid = new ColonyGrid();
        grid.buildFromRegion(makeRegion([
            { typeId: 'shelter', slotIndex: 0 },
            { typeId: 'farm', slotIndex: 1 },
            { typeId: 'solar_array', slotIndex: 2 },
            { typeId: 'storage_depot', slotIndex: 3 },
            { typeId: 'workshop', slotIndex: 4 },
            { typeId: 'med_bay', slotIndex: 5 },
        ]));
        // Each building should have at least one building cell
        const buildingSlots = new Set<number>();
        for (let y = 0; y < COLONY_GRID_SIZE; y++) {
            for (let x = 0; x < COLONY_GRID_SIZE; x++) {
                const cell = grid.getCell(x, y);
                if (cell?.type === 'building' && cell.buildingSlotIndex !== undefined) {
                    buildingSlots.add(cell.buildingSlotIndex);
                }
            }
        }
        expect(buildingSlots.size).toBe(6);
    });

    it('placeBuilding succeeds on empty area', () => {
        const grid = new ColonyGrid();
        const result = grid.placeBuilding(0, 0, 0, 2, 2);
        expect(result).toBe(true);
        expect(grid.getCell(0, 0)?.type).toBe('building');
        expect(grid.getCell(1, 1)?.type).toBe('building');
    });

    it('placeBuilding rejects overlap', () => {
        const grid = new ColonyGrid();
        grid.placeBuilding(0, 0, 0, 2, 2);
        const result = grid.placeBuilding(1, 1, 1, 2, 2);
        expect(result).toBe(false);
    });

    it('placeBuilding rejects out-of-bounds', () => {
        const grid = new ColonyGrid();
        const result = grid.placeBuilding(0, 9, 9, 2, 2);
        expect(result).toBe(false);
    });

    it('isAreaFree returns true for empty grid', () => {
        const grid = new ColonyGrid();
        expect(grid.isAreaFree(0, 0, 3, 3)).toBe(true);
    });

    it('isAreaFree returns false for occupied area', () => {
        const grid = new ColonyGrid();
        grid.placeBuilding(0, 2, 2, 2, 2);
        expect(grid.isAreaFree(1, 1, 3, 3)).toBe(false);
    });

    it('getCell returns null for out-of-bounds', () => {
        const grid = new ColonyGrid();
        expect(grid.getCell(-1, 0)).toBeNull();
        expect(grid.getCell(0, COLONY_GRID_SIZE)).toBeNull();
        expect(grid.getCell(COLONY_GRID_SIZE, 0)).toBeNull();
    });

    it('getCell returns cell for in-bounds', () => {
        const grid = new ColonyGrid();
        expect(grid.getCell(0, 0)).not.toBeNull();
        expect(grid.getCell(0, 0)?.type).toBe('empty');
    });

    it('places 2x2 footprint correctly', () => {
        const grid = new ColonyGrid();
        grid.placeBuilding(0, 3, 3, 2, 2);
        expect(grid.getCell(3, 3)?.buildingSlotIndex).toBe(0);
        expect(grid.getCell(4, 4)?.buildingSlotIndex).toBe(0);
        expect(grid.getCell(5, 3)?.type).toBe('empty');
    });

    it('places 3x3 footprint correctly', () => {
        const grid = new ColonyGrid();
        grid.placeBuilding(1, 0, 0, 3, 3);
        expect(grid.getCell(0, 0)?.buildingSlotIndex).toBe(1);
        expect(grid.getCell(2, 2)?.buildingSlotIndex).toBe(1);
        expect(grid.getCell(3, 0)?.type).toBe('empty');
    });

    it('getBuildingCenter returns center of placed building', () => {
        const grid = new ColonyGrid();
        grid.placeBuilding(0, 2, 2, 2, 2);
        const center = grid.getBuildingCenter(0);
        expect(center).toEqual({ gridX: 3, gridY: 3 });
    });

    it('getBuildingCenter returns null for non-existent building', () => {
        const grid = new ColonyGrid();
        expect(grid.getBuildingCenter(99)).toBeNull();
    });

    it('getBuildingExtent returns correct min/max for placed building', () => {
        const grid = new ColonyGrid();
        grid.placeBuilding(0, 2, 1, 3, 3);
        const extent = grid.getBuildingExtent(0);
        expect(extent).toEqual({ minX: 2, minY: 1, maxX: 4, maxY: 3 });
    });

    it('getBuildingExtent returns null for invalid slot', () => {
        const grid = new ColonyGrid();
        expect(grid.getBuildingExtent(99)).toBeNull();
    });

    it('getBuildingFrontDepth: 2x2 at (2,1) gives depth 4', () => {
        const grid = new ColonyGrid();
        grid.placeBuilding(0, 2, 1, 2, 2);
        // maxX=3, maxY=2 → frontDepth = 3+2 = 5
        expect(grid.getBuildingFrontDepth(0)).toBe(5);
    });

    it('getBuildingFrontDepth: 3x3 at (5,4) gives depth 12', () => {
        const grid = new ColonyGrid();
        grid.placeBuilding(1, 5, 4, 3, 3);
        // maxX=7, maxY=6 → frontDepth = 7+6 = 13
        expect(grid.getBuildingFrontDepth(1)).toBe(13);
    });

    it('getBuildingFrontDepth returns null for non-existent building', () => {
        const grid = new ColonyGrid();
        expect(grid.getBuildingFrontDepth(99)).toBeNull();
    });
});
