// biomes.ts — Biome definitions and region assignment for planet surface.

import type { Region } from '../components/RegionDataComponent';
import type { VoronoiCell } from '../utils/voronoi';
import { polygonCentroid } from '../utils/geometry';

export type HabitableBiomeName = 'Temperate Plains' | 'Arctic Wastes' | 'Dense Jungle' | 'Volcanic Highlands' | 'Ocean';
export type VolcanicBiomeName = 'Lava Fields' | 'Obsidian Plains' | 'Volcanic Vents' | 'Magma Seas';
export type BarrenBiomeName = 'Dust Flats' | 'Impact Craters' | 'Rocky Wastes' | 'Salt Basins';
export type BiomeName = HabitableBiomeName | VolcanicBiomeName | BarrenBiomeName;

export type BiomePool = 'habitable' | 'volcanic' | 'barren';

export interface BiomeDefinition {
    name: BiomeName;
    colour: string;
    canColonise: boolean;
    pool: BiomePool;
}

export const BIOME_DEFINITIONS: readonly BiomeDefinition[] = [
    // Habitable (New Terra)
    { name: 'Temperate Plains', colour: '#5a9a4a', canColonise: true, pool: 'habitable' },
    { name: 'Arctic Wastes', colour: '#b8d0e0', canColonise: true, pool: 'habitable' },
    { name: 'Dense Jungle', colour: '#2a6a3a', canColonise: true, pool: 'habitable' },
    { name: 'Volcanic Highlands', colour: '#7a3a2a', canColonise: true, pool: 'habitable' },
    { name: 'Ocean', colour: '#1a3a6a', canColonise: false, pool: 'habitable' },
    // Volcanic (Ember)
    { name: 'Lava Fields', colour: '#cc3300', canColonise: false, pool: 'volcanic' },
    { name: 'Obsidian Plains', colour: '#2a2a2a', canColonise: false, pool: 'volcanic' },
    { name: 'Volcanic Vents', colour: '#ff6600', canColonise: false, pool: 'volcanic' },
    { name: 'Magma Seas', colour: '#aa2200', canColonise: false, pool: 'volcanic' },
    // Barren (Dust)
    { name: 'Dust Flats', colour: '#b8a882', canColonise: false, pool: 'barren' },
    { name: 'Impact Craters', colour: '#7a7060', canColonise: false, pool: 'barren' },
    { name: 'Rocky Wastes', colour: '#9a8a70', canColonise: false, pool: 'barren' },
    { name: 'Salt Basins', colour: '#d0c8b0', canColonise: false, pool: 'barren' },
] as const;

/** Get biome definitions for a specific pool. */
export function getBiomePool(pool: BiomePool): readonly BiomeDefinition[] {
    return BIOME_DEFINITIONS.filter(b => b.pool === pool);
}

/**
 * Assign biomes to Voronoi cells, producing fully typed Region objects.
 *
 * For habitable pools:
 * - At least 2 Ocean regions (cells furthest from centre)
 * - Exactly 1 landing zone (most central colonisable cell)
 * - Remaining cells get random colonisable biomes
 *
 * For volcanic/barren pools:
 * - No ocean, no landing zone, no colonisable regions
 * - All cells get random biomes from the pool
 */
export function assignBiomes(
    cells: VoronoiCell[],
    rng: () => number,
    mapWidth: number,
    mapHeight: number,
    pool: BiomePool = 'habitable',
): Region[] {
    if (pool !== 'habitable') {
        return assignNonHabitableBiomes(cells, rng, pool);
    }

    return assignHabitableBiomes(cells, rng, mapWidth, mapHeight);
}

function assignNonHabitableBiomes(
    cells: VoronoiCell[],
    rng: () => number,
    pool: BiomePool,
): Region[] {
    const poolBiomes = getBiomePool(pool);
    const regions: Region[] = [];

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const biomeDef = poolBiomes[Math.floor(rng() * poolBiomes.length)];
        regions.push({
            id: i,
            biome: biomeDef.name,
            colour: biomeDef.colour,
            canColonise: false,
            colonised: false,
            isLandingZone: false,
            vertices: cell.vertices,
        });
    }

    return regions;
}

function assignHabitableBiomes(
    cells: VoronoiCell[],
    rng: () => number,
    mapWidth: number,
    mapHeight: number,
): Region[] {
    const cx = mapWidth / 2;
    const cy = mapHeight / 2;

    const colonisableBiomes = getBiomePool('habitable').filter(b => b.canColonise);

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
            const biomeDef = colonisableBiomes[
                Math.floor(rng() * colonisableBiomes.length)
            ];

            regions.push({
                id: i,
                biome: biomeDef.name,
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
