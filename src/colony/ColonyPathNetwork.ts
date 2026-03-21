// ColonyPathNetwork.ts — MST-based path network generation for colony grid.
// Connects buildings via L-shaped Manhattan paths, avoids building footprints.
// Also generates campfire cell and perimeter patrol path.

import { ColonyGrid, COLONY_GRID_SIZE } from './ColonyGrid';

export interface PathSegment {
    cells: { gridX: number; gridY: number }[];
}

interface DoorInfo {
    gridX: number;
    gridY: number;
    slotIndex: number;
}

/** Place doors adjacent to each building footprint, biased toward grid centre. */
function placeDoors(grid: ColonyGrid): DoorInfo[] {
    const doors: DoorInfo[] = [];
    const centre = COLONY_GRID_SIZE / 2;

    // Find each building's cells to determine footprint bounds
    const buildingBounds = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>();
    for (let y = 0; y < COLONY_GRID_SIZE; y++) {
        for (let x = 0; x < COLONY_GRID_SIZE; x++) {
            const cell = grid.getCell(x, y);
            if (cell && cell.type === 'building' && cell.buildingSlotIndex !== undefined) {
                const slot = cell.buildingSlotIndex;
                const existing = buildingBounds.get(slot);
                if (existing) {
                    existing.minX = Math.min(existing.minX, x);
                    existing.minY = Math.min(existing.minY, y);
                    existing.maxX = Math.max(existing.maxX, x);
                    existing.maxY = Math.max(existing.maxY, y);
                } else {
                    buildingBounds.set(slot, { minX: x, minY: y, maxX: x, maxY: y });
                }
            }
        }
    }

    for (const [slotIndex, bounds] of buildingBounds) {
        // Try adjacent cells, prioritise ones closer to grid centre
        const candidates: { x: number; y: number; dist: number }[] = [];

        // Check all cells adjacent to the footprint
        for (let x = bounds.minX - 1; x <= bounds.maxX + 1; x++) {
            for (let y = bounds.minY - 1; y <= bounds.maxY + 1; y++) {
                // Must be outside the footprint
                if (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY) continue;
                // Only cardinal adjacency (not diagonal)
                const isCardinalAdj = (
                    (x >= bounds.minX && x <= bounds.maxX && (y === bounds.minY - 1 || y === bounds.maxY + 1)) ||
                    (y >= bounds.minY && y <= bounds.maxY && (x === bounds.minX - 1 || x === bounds.maxX + 1))
                );
                if (!isCardinalAdj) continue;
                const cell = grid.getCell(x, y);
                if (cell && cell.type === 'empty') {
                    const dist = Math.abs(x - centre) + Math.abs(y - centre);
                    candidates.push({ x, y, dist });
                }
            }
        }

        candidates.sort((a, b) => a.dist - b.dist);
        if (candidates.length > 0) {
            const best = candidates[0];
            grid.cells[best.y][best.x] = { type: 'door', buildingSlotIndex: slotIndex };
            doors.push({ gridX: best.x, gridY: best.y, slotIndex });
        }
    }

    return doors;
}

/** MST via Prim's algorithm on Manhattan distance between doors. */
function buildMST(doors: DoorInfo[]): [number, number][] {
    if (doors.length < 2) return [];

    const inTree = new Set<number>([0]);
    const edges: [number, number][] = [];

    while (inTree.size < doors.length) {
        let bestDist = Infinity;
        let bestFrom = -1;
        let bestTo = -1;

        for (const from of inTree) {
            for (let to = 0; to < doors.length; to++) {
                if (inTree.has(to)) continue;
                const dist = Math.abs(doors[from].gridX - doors[to].gridX) +
                             Math.abs(doors[from].gridY - doors[to].gridY);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestFrom = from;
                    bestTo = to;
                }
            }
        }

        if (bestTo < 0) break;
        inTree.add(bestTo);
        edges.push([bestFrom, bestTo]);
    }

    return edges;
}

/** Route an L-shaped Manhattan path between two points, avoiding building cells. */
function routePath(grid: ColonyGrid, ax: number, ay: number, bx: number, by: number): { gridX: number; gridY: number }[] {
    const cells: { gridX: number; gridY: number }[] = [];

    // Try horizontal-first, then vertical
    const route1 = tryLRoute(grid, ax, ay, bx, by, true);
    const route2 = tryLRoute(grid, ax, ay, bx, by, false);

    // Pick the one with fewer blocked cells (or the first if tied)
    if (route1 && route2) {
        return route1.length <= route2.length ? route1 : route2;
    }
    return route1 ?? route2 ?? cells;
}

function tryLRoute(
    grid: ColonyGrid,
    ax: number, ay: number, bx: number, by: number,
    horizontalFirst: boolean,
): { gridX: number; gridY: number }[] | null {
    const cells: { gridX: number; gridY: number }[] = [];
    let cx = ax;
    let cy = ay;

    if (horizontalFirst) {
        // Move horizontally first
        const dx = bx > ax ? 1 : -1;
        while (cx !== bx) {
            cx += dx;
            const cell = grid.getCell(cx, cy);
            if (cell && cell.type === 'building') return null;
            cells.push({ gridX: cx, gridY: cy });
        }
        // Then vertically
        const dy = by > ay ? 1 : -1;
        while (cy !== by) {
            cy += dy;
            const cell = grid.getCell(cx, cy);
            if (cell && cell.type === 'building') return null;
            cells.push({ gridX: cx, gridY: cy });
        }
    } else {
        // Move vertically first
        const dy = by > ay ? 1 : -1;
        while (cy !== by) {
            cy += dy;
            const cell = grid.getCell(cx, cy);
            if (cell && cell.type === 'building') return null;
            cells.push({ gridX: cx, gridY: cy });
        }
        // Then horizontally
        const dx = bx > ax ? 1 : -1;
        while (cx !== bx) {
            cx += dx;
            const cell = grid.getCell(cx, cy);
            if (cell && cell.type === 'building') return null;
            cells.push({ gridX: cx, gridY: cy });
        }
    }

    return cells;
}

/** Find a campfire cell near grid centre on a path cell.
 *  Prefers the true grid centre (5,5) if it's empty or a path cell. */
function findCampfireCell(grid: ColonyGrid): { gridX: number; gridY: number } | null {
    const centre = COLONY_GRID_SIZE / 2;
    const centreInt = Math.floor(centre);

    // Prefer the true grid centre if it's available (empty or path)
    const centreCell = grid.getCell(centreInt, centreInt);
    if (centreCell && (centreCell.type === 'empty' || centreCell.type === 'path')) {
        return { gridX: centreInt, gridY: centreInt };
    }

    let bestCell: { gridX: number; gridY: number } | null = null;
    let bestDist = Infinity;

    for (let y = 0; y < COLONY_GRID_SIZE; y++) {
        for (let x = 0; x < COLONY_GRID_SIZE; x++) {
            const cell = grid.getCell(x, y);
            if (cell && cell.type === 'path') {
                const dist = Math.abs(x - centre) + Math.abs(y - centre);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestCell = { gridX: x, gridY: y };
                }
            }
        }
    }

    // If no path cells, try empty cells near centre
    if (!bestCell) {
        for (let y = 0; y < COLONY_GRID_SIZE; y++) {
            for (let x = 0; x < COLONY_GRID_SIZE; x++) {
                const cell = grid.getCell(x, y);
                if (cell && cell.type === 'empty') {
                    const dist = Math.abs(x - centre) + Math.abs(y - centre);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestCell = { gridX: x, gridY: y };
                    }
                }
            }
        }
    }

    return bestCell;
}

/** Generate perimeter patrol path — outer-edge walkable cells. */
function generatePerimeterPath(grid: ColonyGrid): { gridX: number; gridY: number }[] {
    const path: { gridX: number; gridY: number }[] = [];
    const max = COLONY_GRID_SIZE - 1;

    // Walk the outer edge clockwise
    // Top edge: left to right
    for (let x = 0; x <= max; x++) {
        const cell = grid.getCell(x, 0);
        if (cell && cell.type !== 'building') path.push({ gridX: x, gridY: 0 });
    }
    // Right edge: top to bottom
    for (let y = 1; y <= max; y++) {
        const cell = grid.getCell(max, y);
        if (cell && cell.type !== 'building') path.push({ gridX: max, gridY: y });
    }
    // Bottom edge: right to left
    for (let x = max - 1; x >= 0; x--) {
        const cell = grid.getCell(x, max);
        if (cell && cell.type !== 'building') path.push({ gridX: x, gridY: max });
    }
    // Left edge: bottom to top
    for (let y = max - 1; y >= 1; y--) {
        const cell = grid.getCell(0, y);
        if (cell && cell.type !== 'building') path.push({ gridX: 0, gridY: y });
    }

    return path;
}

export interface PathNetworkResult {
    segments: PathSegment[];
    campfireCell: { gridX: number; gridY: number } | null;
    perimeterPath: { gridX: number; gridY: number }[];
}

/** Generate path network on the colony grid. Mutates grid cells to mark paths. */
export function generatePathNetwork(grid: ColonyGrid): PathNetworkResult {
    const doors = placeDoors(grid);
    const segments: PathSegment[] = [];

    if (doors.length < 2) {
        // With only 1 building, create a short path from its door toward grid centre
        if (doors.length === 1) {
            const door = doors[0];
            const campfire = findCampfireCell(grid);
            if (campfire) {
                const pathCells = routePath(grid, door.gridX, door.gridY, campfire.gridX, campfire.gridY);
                for (const cell of pathCells) {
                    const existing = grid.getCell(cell.gridX, cell.gridY);
                    if (existing && existing.type === 'empty') {
                        grid.cells[cell.gridY][cell.gridX] = { type: 'path' };
                    }
                }
                segments.push({ cells: pathCells });
            }
        }
        return {
            segments,
            campfireCell: findCampfireCell(grid),
            perimeterPath: generatePerimeterPath(grid),
        };
    }

    const mstEdges = buildMST(doors);

    for (const [fromIdx, toIdx] of mstEdges) {
        const from = doors[fromIdx];
        const to = doors[toIdx];
        const pathCells = routePath(grid, from.gridX, from.gridY, to.gridX, to.gridY);

        // Mark path cells on grid (don't overwrite doors)
        for (const cell of pathCells) {
            const existing = grid.getCell(cell.gridX, cell.gridY);
            if (existing && existing.type === 'empty') {
                grid.cells[cell.gridY][cell.gridX] = { type: 'path' };
            }
        }

        segments.push({ cells: pathCells });
    }

    return {
        segments,
        campfireCell: findCampfireCell(grid),
        perimeterPath: generatePerimeterPath(grid),
    };
}
