import { describe, it, expect } from 'vitest';
import { BUILDING_TYPES, getAvailableBuildings, getBuildingType } from '../buildings';

describe('buildings', () => {
    it('has 8 building types', () => {
        expect(Object.keys(BUILDING_TYPES)).toHaveLength(8);
    });

    it('has 4 tier 1 and 4 tier 2 buildings', () => {
        const all = Object.values(BUILDING_TYPES);
        expect(all.filter(b => b.tier === 1)).toHaveLength(4);
        expect(all.filter(b => b.tier === 2)).toHaveLength(4);
    });

    it('all buildings have positive material costs', () => {
        for (const b of Object.values(BUILDING_TYPES)) {
            expect(b.materialCost).toBeGreaterThan(0);
        }
    });

    it('all buildings have positive build times', () => {
        for (const b of Object.values(BUILDING_TYPES)) {
            expect(b.buildTime).toBeGreaterThan(0);
        }
    });

    it('all buildings have at least one effect', () => {
        for (const b of Object.values(BUILDING_TYPES)) {
            expect(b.effects.length).toBeGreaterThan(0);
        }
    });

    it('getBuildingType returns correct building', () => {
        const farm = getBuildingType('farm');
        expect(farm.name).toBe('Farm');
        expect(farm.tier).toBe(1);
    });

    it('getAvailableBuildings returns only tier 1 when no colonies', () => {
        const available = getAvailableBuildings(0);
        expect(available.every(b => b.tier === 1)).toBe(true);
        expect(available).toHaveLength(4);
    });

    it('getAvailableBuildings returns all buildings when 1+ colony', () => {
        const available = getAvailableBuildings(1);
        expect(available).toHaveLength(8);
    });
});
