// ColonyGrid.ts — 10x10 isometric grid for colony building placement.
// Manages cell occupancy, building footprints, and walkable areas.

import type { Region } from '../components/RegionDataComponent';

export type CellType = 'empty' | 'building' | 'path' | 'door';

export interface GridCell {
    type: CellType;
    buildingSlotIndex?: number;
}

export const COLONY_GRID_SIZE = 10;

/** Building footprint sizes (width x height in grid cells). */
const BUILDING_FOOTPRINTS: Record<string, { w: number; h: number }> = {
    shelter: { w: 2, h: 2 },
    farm: { w: 3, h: 3 },
    solar_array: { w: 2, h: 2 },
    storage_depot: { w: 2, h: 2 },
    workshop: { w: 3, h: 3 },
    med_bay: { w: 2, h: 2 },
    barracks: { w: 3, h: 3 },
    hydroponics_bay: { w: 3, h: 3 },
};

/** Pre-defined building positions for up to 6 buildings on a 10x10 grid.
 *  Arranged in a ring around grid centre (5,5) for a circular colony layout.
 *  All positions allow up to 3x3 footprints within bounds. */
const BUILDING_POSITIONS: { gx: number; gy: number }[] = [
    { gx: 4, gy: 1 },   // slot 0 — top (shelter)
    { gx: 7, gy: 2 },   // slot 1 — upper-right
    { gx: 7, gy: 5 },   // slot 2 — lower-right
    { gx: 4, gy: 7 },   // slot 3 — bottom
    { gx: 1, gy: 5 },   // slot 4 — lower-left
    { gx: 1, gy: 2 },   // slot 5 — upper-left
];

export function getBuildingFootprint(typeId: string): { w: number; h: number } {
    return BUILDING_FOOTPRINTS[typeId] ?? { w: 2, h: 2 };
}

export class ColonyGrid {
    cells: GridCell[][];

    constructor() {
        this.cells = [];
        this.clear();
    }

    clear(): void {
        this.cells = [];
        for (let y = 0; y < COLONY_GRID_SIZE; y++) {
            const row: GridCell[] = [];
            for (let x = 0; x < COLONY_GRID_SIZE; x++) {
                row.push({ type: 'empty' });
            }
            this.cells.push(row);
        }
    }

    buildFromRegion(region: Region): void {
        this.clear();
        for (const building of region.buildings) {
            const pos = BUILDING_POSITIONS[building.slotIndex];
            if (!pos) continue;
            const footprint = getBuildingFootprint(building.typeId);
            this.placeBuilding(building.slotIndex, pos.gx, pos.gy, footprint.w, footprint.h);
        }
    }

    placeBuilding(slotIndex: number, gx: number, gy: number, w: number, h: number): boolean {
        if (!this.isAreaFree(gx, gy, w, h)) return false;
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                this.cells[gy + dy][gx + dx] = { type: 'building', buildingSlotIndex: slotIndex };
            }
        }
        return true;
    }

    isAreaFree(gx: number, gy: number, w: number, h: number): boolean {
        if (gx < 0 || gy < 0 || gx + w > COLONY_GRID_SIZE || gy + h > COLONY_GRID_SIZE) return false;
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                if (this.cells[gy + dy][gx + dx].type !== 'empty') return false;
            }
        }
        return true;
    }

    getCell(gx: number, gy: number): GridCell | null {
        if (gx < 0 || gy < 0 || gx >= COLONY_GRID_SIZE || gy >= COLONY_GRID_SIZE) return null;
        return this.cells[gy][gx];
    }

    /** Get the bounding extent (min/max grid coords) of a placed building. */
    getBuildingExtent(slotIndex: number): { minX: number; minY: number; maxX: number; maxY: number } | null {
        let minX = COLONY_GRID_SIZE;
        let minY = COLONY_GRID_SIZE;
        let maxX = -1;
        let maxY = -1;
        for (let y = 0; y < COLONY_GRID_SIZE; y++) {
            for (let x = 0; x < COLONY_GRID_SIZE; x++) {
                const cell = this.cells[y][x];
                if (cell.type === 'building' && cell.buildingSlotIndex === slotIndex) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX < 0) return null;
        return { minX, minY, maxX, maxY };
    }

    getBuildingCenter(slotIndex: number): { gridX: number; gridY: number } | null {
        const extent = this.getBuildingExtent(slotIndex);
        if (!extent) return null;
        return {
            gridX: (extent.minX + extent.maxX + 1) / 2,
            gridY: (extent.minY + extent.maxY + 1) / 2,
        };
    }

    /** Get the isometric front-depth of a building (front edge closest to camera). */
    getBuildingFrontDepth(slotIndex: number): number | null {
        const extent = this.getBuildingExtent(slotIndex);
        if (!extent) return null;
        return extent.maxX + extent.maxY;
    }

    getDoors(): { gridX: number; gridY: number; slotIndex: number }[] {
        const doors: { gridX: number; gridY: number; slotIndex: number }[] = [];
        for (let y = 0; y < COLONY_GRID_SIZE; y++) {
            for (let x = 0; x < COLONY_GRID_SIZE; x++) {
                if (this.cells[y][x].type === 'door') {
                    doors.push({
                        gridX: x,
                        gridY: y,
                        slotIndex: this.cells[y][x].buildingSlotIndex ?? -1,
                    });
                }
            }
        }
        return doors;
    }

    /** Get the grid position for a building slot (top-left corner). */
    getBuildingPosition(slotIndex: number): { gx: number; gy: number } | null {
        return BUILDING_POSITIONS[slotIndex] ?? null;
    }
}
