import { describe, it, expect } from 'vitest';
import { findPath } from '../ColonistPathfinding';
import { ColonyGrid, COLONY_GRID_SIZE } from '../ColonyGrid';

describe('ColonistPathfinding', () => {
    it('finds a clear path between two points', () => {
        const grid = new ColonyGrid();
        // Mark some cells as path so they're walkable
        grid.cells[0][0] = { type: 'path' };
        grid.cells[0][1] = { type: 'path' };
        grid.cells[0][2] = { type: 'path' };
        grid.cells[0][3] = { type: 'path' };

        const path = findPath(grid, 0, 0, 3, 0);
        expect(path).not.toBeNull();
        expect(path!.length).toBeGreaterThan(0);
        // Should end at destination
        expect(path![path!.length - 1]).toEqual({ gridX: 3, gridY: 0 });
    });

    it('returns null when path is blocked by buildings', () => {
        const grid = new ColonyGrid();
        // Create a wall of buildings blocking the path
        grid.cells[0][0] = { type: 'path' };
        grid.cells[0][4] = { type: 'path' };
        // Fill column 2 with buildings (blocking)
        for (let y = 0; y < COLONY_GRID_SIZE; y++) {
            grid.cells[y][2] = { type: 'building', buildingSlotIndex: 0 };
        }

        const path = findPath(grid, 0, 0, 4, 0);
        expect(path).toBeNull();
    });

    it('returns empty array when start equals end', () => {
        const grid = new ColonyGrid();
        grid.cells[3][3] = { type: 'path' };

        const path = findPath(grid, 3, 3, 3, 3);
        expect(path).not.toBeNull();
        expect(path!.length).toBe(0);
    });

    it('returns null for out-of-bounds input', () => {
        const grid = new ColonyGrid();
        expect(findPath(grid, -1, 0, 5, 5)).toBeNull();
        expect(findPath(grid, 0, 0, COLONY_GRID_SIZE, 0)).toBeNull();
    });

    it('prevents corner cutting through buildings', () => {
        const grid = new ColonyGrid();
        // Create a scenario where diagonal would cut a corner
        grid.cells[0][0] = { type: 'path' };
        grid.cells[1][1] = { type: 'path' };
        grid.cells[0][1] = { type: 'building', buildingSlotIndex: 0 }; // blocks diagonal
        grid.cells[1][0] = { type: 'building', buildingSlotIndex: 1 }; // blocks diagonal

        const path = findPath(grid, 0, 0, 1, 1);
        // Should be null since diagonal is blocked and no alternative exists
        expect(path).toBeNull();
    });

    it('finds path through door cells', () => {
        const grid = new ColonyGrid();
        grid.cells[0][0] = { type: 'door', buildingSlotIndex: 0 };
        grid.cells[0][1] = { type: 'path' };
        grid.cells[0][2] = { type: 'door', buildingSlotIndex: 1 };

        const path = findPath(grid, 0, 0, 2, 0);
        expect(path).not.toBeNull();
        expect(path!.length).toBeGreaterThan(0);
    });
});
