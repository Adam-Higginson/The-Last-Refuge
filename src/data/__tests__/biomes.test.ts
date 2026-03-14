import { describe, it, expect } from 'vitest';
import { assignBiomes, BIOME_DEFINITIONS, getBiomePool } from '../biomes';
import type { BiomePool } from '../biomes';
import { generateVoronoi } from '../../utils/voronoi';
import { mulberry32 } from '../../utils/prng';

describe('BIOME_DEFINITIONS', () => {
    it('contains 13 biomes across all pools', () => {
        expect(BIOME_DEFINITIONS).toHaveLength(13);
    });

    it('has 5 habitable biomes', () => {
        expect(getBiomePool('habitable')).toHaveLength(5);
    });

    it('has 4 volcanic biomes', () => {
        expect(getBiomePool('volcanic')).toHaveLength(4);
    });

    it('has 4 barren biomes', () => {
        expect(getBiomePool('barren')).toHaveLength(4);
    });

    it('has one non-colonisable habitable biome (Ocean)', () => {
        const habitable = getBiomePool('habitable');
        const nonColonisable = habitable.filter(b => !b.canColonise);
        expect(nonColonisable).toHaveLength(1);
        expect(nonColonisable[0].name).toBe('Ocean');
    });

    it('all volcanic biomes are non-colonisable', () => {
        for (const biome of getBiomePool('volcanic')) {
            expect(biome.canColonise).toBe(false);
        }
    });

    it('all barren biomes are non-colonisable', () => {
        for (const biome of getBiomePool('barren')) {
            expect(biome.canColonise).toBe(false);
        }
    });

    it('each biome has a valid hex colour', () => {
        for (const biome of BIOME_DEFINITIONS) {
            expect(biome.colour).toMatch(/^#[0-9a-f]{6}$/i);
        }
    });
});

describe('assignBiomes', () => {
    const width = 400;
    const height = 300;

    function makeRegions(
        numCells: number,
        seed = 42,
        pool: BiomePool = 'habitable',
    ): ReturnType<typeof assignBiomes> {
        const rng = mulberry32(seed);
        const cells = generateVoronoi(width, height, numCells, rng);
        const rng2 = mulberry32(seed + 100);
        return assignBiomes(cells, rng2, width, height, pool);
    }

    describe('habitable pool', () => {
        it('returns the same number of regions as cells', () => {
            const regions = makeRegions(8);
            expect(regions).toHaveLength(8);
        });

        it('assigns at least 2 Ocean regions', () => {
            const regions = makeRegions(8);
            const oceans = regions.filter(r => r.biome === 'Ocean');
            expect(oceans.length).toBeGreaterThanOrEqual(2);
        });

        it('assigns 3 Ocean regions when there are more than 8 cells', () => {
            const regions = makeRegions(12);
            const oceans = regions.filter(r => r.biome === 'Ocean');
            expect(oceans).toHaveLength(3);
        });

        it('has exactly 1 landing zone', () => {
            const regions = makeRegions(8);
            const landingZones = regions.filter(r => r.isLandingZone);
            expect(landingZones).toHaveLength(1);
        });

        it('landing zone is colonisable and not Ocean', () => {
            const regions = makeRegions(8);
            const lz = regions.find(r => r.isLandingZone);
            expect(lz).toBeDefined();
            expect(lz?.canColonise).toBe(true);
            expect(lz?.biome).not.toBe('Ocean');
        });

        it('Ocean regions are not colonisable', () => {
            const regions = makeRegions(8);
            const oceans = regions.filter(r => r.biome === 'Ocean');
            for (const ocean of oceans) {
                expect(ocean.canColonise).toBe(false);
            }
        });

        it('all non-Ocean regions are colonisable', () => {
            const regions = makeRegions(8);
            const nonOceans = regions.filter(r => r.biome !== 'Ocean');
            for (const region of nonOceans) {
                expect(region.canColonise).toBe(true);
            }
        });

        it('no regions start colonised', () => {
            const regions = makeRegions(8);
            for (const region of regions) {
                expect(region.colonised).toBe(false);
            }
        });

        it('all biome names are from habitable pool', () => {
            const validNames = new Set(getBiomePool('habitable').map(b => b.name));
            const regions = makeRegions(8);
            for (const region of regions) {
                expect(validNames.has(region.biome)).toBe(true);
            }
        });

        it('each region has vertices', () => {
            const regions = makeRegions(8);
            for (const region of regions) {
                expect(region.vertices.length).toBeGreaterThanOrEqual(3);
            }
        });

        it('each region has a unique id', () => {
            const regions = makeRegions(8);
            const ids = regions.map(r => r.id);
            expect(new Set(ids).size).toBe(regions.length);
        });
    });

    describe('volcanic pool', () => {
        it('returns the correct number of regions', () => {
            const regions = makeRegions(6, 42, 'volcanic');
            expect(regions).toHaveLength(6);
        });

        it('all biomes are from the volcanic pool', () => {
            const validNames = new Set(getBiomePool('volcanic').map(b => b.name));
            const regions = makeRegions(6, 42, 'volcanic');
            for (const region of regions) {
                expect(validNames.has(region.biome)).toBe(true);
            }
        });

        it('no regions are colonisable', () => {
            const regions = makeRegions(6, 42, 'volcanic');
            for (const region of regions) {
                expect(region.canColonise).toBe(false);
            }
        });

        it('no landing zones', () => {
            const regions = makeRegions(6, 42, 'volcanic');
            const landingZones = regions.filter(r => r.isLandingZone);
            expect(landingZones).toHaveLength(0);
        });
    });

    describe('barren pool', () => {
        it('returns the correct number of regions', () => {
            const regions = makeRegions(7, 42, 'barren');
            expect(regions).toHaveLength(7);
        });

        it('all biomes are from the barren pool', () => {
            const validNames = new Set(getBiomePool('barren').map(b => b.name));
            const regions = makeRegions(7, 42, 'barren');
            for (const region of regions) {
                expect(validNames.has(region.biome)).toBe(true);
            }
        });

        it('no regions are colonisable', () => {
            const regions = makeRegions(7, 42, 'barren');
            for (const region of regions) {
                expect(region.canColonise).toBe(false);
            }
        });

        it('no landing zones', () => {
            const regions = makeRegions(7, 42, 'barren');
            const landingZones = regions.filter(r => r.isLandingZone);
            expect(landingZones).toHaveLength(0);
        });
    });
});
