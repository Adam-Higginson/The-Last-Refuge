// biomes.ts — Biome definitions and region assignment for planet surface.

import type { Region } from '../components/RegionDataComponent';
import type { VoronoiCell } from '../utils/voronoi';
import { polygonCentroid } from '../utils/geometry';

export type BiomeName = 'Temperate Plains' | 'Arctic Wastes' | 'Dense Jungle' | 'Volcanic Highlands' | 'Ocean';

export interface BiomeDefinition {
    name: BiomeName;
    colour: string;
    canColonise: boolean;
}

export const BIOME_DEFINITIONS: readonly BiomeDefinition[] = [
    { name: 'Temperate Plains', colour: '#5a9a4a', canColonise: true },
    { name: 'Arctic Wastes', colour: '#b8d0e0', canColonise: true },
    { name: 'Dense Jungle', colour: '#2a6a3a', canColonise: true },
    { name: 'Volcanic Highlands', colour: '#7a3a2a', canColonise: true },
    { name: 'Ocean', colour: '#1a3a6a', canColonise: false },
] as const;

/** Colonisable biome names for random assignment. */
const COLONISABLE_BIOMES: readonly BiomeName[] =
    BIOME_DEFINITIONS.filter(b => b.canColonise).map(b => b.name);

/**
 * Assign biomes to Voronoi cells, producing fully typed Region objects.
 *
 * Rules:
 * - At least 2 Ocean regions (cells furthest from centre)
 * - Exactly 1 landing zone (most central colonisable cell)
 * - Remaining cells get random colonisable biomes
 */
export function assignBiomes(
    cells: VoronoiCell[],
    rng: () => number,
    mapWidth: number,
    mapHeight: number,
): Region[] {
    const cx = mapWidth / 2;
    const cy = mapHeight / 2;

    // Calculate distance from centre for each cell
    const cellDistances = cells.map((cell, idx) => {
        const centroid = polygonCentroid(cell.vertices);
        const dx = centroid.x - cx;
        const dy = centroid.y - cy;
        return { idx, dist: Math.sqrt(dx * dx + dy * dy) };
    });

    // Sort by distance: furthest first
    const sortedByDist = [...cellDistances].sort((a, b) => b.dist - a.dist);

    // Determine ocean count (2 for ≤8 cells, 3 for more)
    const oceanCount = cells.length > 8 ? 3 : 2;

    // Assign ocean to the furthest cells
    const oceanIndices = new Set(sortedByDist.slice(0, oceanCount).map(c => c.idx));

    // Find landing zone: most central non-ocean cell
    const sortedByClosest = [...cellDistances].sort((a, b) => a.dist - b.dist);
    let landingZoneIdx = -1;
    for (const c of sortedByClosest) {
        if (!oceanIndices.has(c.idx)) {
            landingZoneIdx = c.idx;
            break;
        }
    }

    const oceanDef = BIOME_DEFINITIONS.find(b => b.name === 'Ocean');
    if (!oceanDef) throw new Error('Ocean biome not found');

    const regions: Region[] = [];

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];

        if (oceanIndices.has(i)) {
            regions.push({
                id: i,
                biome: 'Ocean',
                colour: oceanDef.colour,
                canColonise: false,
                colonised: false,
                isLandingZone: false,
                vertices: cell.vertices,
            });
        } else {
            // Pick a random colonisable biome
            const biomeName = COLONISABLE_BIOMES[
                Math.floor(rng() * COLONISABLE_BIOMES.length)
            ];
            const biomeDef = BIOME_DEFINITIONS.find(b => b.name === biomeName);
            if (!biomeDef) throw new Error(`Biome ${biomeName} not found`);

            regions.push({
                id: i,
                biome: biomeName,
                colour: biomeDef.colour,
                canColonise: true,
                colonised: false,
                isLandingZone: i === landingZoneIdx,
                vertices: cell.vertices,
            });
        }
    }

    return regions;
}
