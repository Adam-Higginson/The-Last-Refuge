// ColonistPathfinding.ts — A* pathfinding on the colony grid.
// Walkable cells: path, door, empty cells adjacent to paths.
// 8-directional movement with octile distance heuristic.

import { ColonyGrid, COLONY_GRID_SIZE } from './ColonyGrid';

interface Node {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent: Node | null;
}

function isWalkable(grid: ColonyGrid, x: number, y: number): boolean {
    const cell = grid.getCell(x, y);
    if (!cell) return false;
    if (cell.type === 'path' || cell.type === 'door') return true;
    if (cell.type === 'empty') {
        // Walkable if adjacent to a path or door
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const adj = grid.getCell(x + dx, y + dy);
            if (adj && (adj.type === 'path' || adj.type === 'door')) return true;
        }
    }
    return false;
}

function octileDistance(ax: number, ay: number, bx: number, by: number): number {
    const dx = Math.abs(ax - bx);
    const dy = Math.abs(ay - by);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

const DIRS = [
    [-1, 0], [1, 0], [0, -1], [0, 1],       // cardinal
    [-1, -1], [-1, 1], [1, -1], [1, 1],       // diagonal
];

export function findPath(
    grid: ColonyGrid,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
): { gridX: number; gridY: number }[] | null {
    // Bounds check
    if (fromX < 0 || fromY < 0 || fromX >= COLONY_GRID_SIZE || fromY >= COLONY_GRID_SIZE) return null;
    if (toX < 0 || toY < 0 || toX >= COLONY_GRID_SIZE || toY >= COLONY_GRID_SIZE) return null;

    // Same start and end
    if (fromX === toX && fromY === toY) return [];

    // Check endpoints are walkable
    if (!isWalkable(grid, fromX, fromY) || !isWalkable(grid, toX, toY)) return null;

    const open: Node[] = [];
    const closed = new Set<number>();
    const key = (x: number, y: number): number => y * COLONY_GRID_SIZE + x;

    const startNode: Node = {
        x: fromX, y: fromY,
        g: 0, h: octileDistance(fromX, fromY, toX, toY),
        f: octileDistance(fromX, fromY, toX, toY),
        parent: null,
    };
    open.push(startNode);

    while (open.length > 0) {
        // Find lowest f
        let bestIdx = 0;
        for (let i = 1; i < open.length; i++) {
            if (open[i].f < open[bestIdx].f) bestIdx = i;
        }
        const current = open[bestIdx];
        open.splice(bestIdx, 1);

        if (current.x === toX && current.y === toY) {
            // Reconstruct path
            const path: { gridX: number; gridY: number }[] = [];
            let node: Node | null = current;
            while (node && (node.x !== fromX || node.y !== fromY)) {
                path.unshift({ gridX: node.x, gridY: node.y });
                node = node.parent;
            }
            return path;
        }

        const currentKey = key(current.x, current.y);
        if (closed.has(currentKey)) continue;
        closed.add(currentKey);

        for (const [dx, dy] of DIRS) {
            const nx = current.x + dx;
            const ny = current.y + dy;

            if (nx < 0 || ny < 0 || nx >= COLONY_GRID_SIZE || ny >= COLONY_GRID_SIZE) continue;
            if (closed.has(key(nx, ny))) continue;
            if (!isWalkable(grid, nx, ny)) continue;

            // No corner cutting: diagonal blocked if either adjacent cardinal cell is non-walkable
            if (dx !== 0 && dy !== 0) {
                if (!isWalkable(grid, current.x + dx, current.y) ||
                    !isWalkable(grid, current.x, current.y + dy)) {
                    continue;
                }
            }

            const moveCost = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
            const g = current.g + moveCost;
            const h = octileDistance(nx, ny, toX, toY);

            // Check if there's already a better path in open
            const existingIdx = open.findIndex(n => n.x === nx && n.y === ny);
            if (existingIdx >= 0 && open[existingIdx].g <= g) continue;
            if (existingIdx >= 0) open.splice(existingIdx, 1);

            open.push({ x: nx, y: ny, g, h, f: g + h, parent: current });
        }
    }

    return null; // No path found
}
