import { describe, it, expect } from 'vitest';
import { EngineStateComponent } from '../EngineStateComponent';
import { ENGINE_REPAIR_TURNS, ENGINE_REPAIR_COST } from '../../data/constants';

describe('EngineStateComponent', () => {
    it('defaults to offline state', () => {
        const comp = new EngineStateComponent();
        expect(comp.engineState).toBe('offline');
    });

    it('has correct repair turns from constants', () => {
        const comp = new EngineStateComponent();
        expect(comp.repairTurnsTotal).toBe(ENGINE_REPAIR_TURNS);
        expect(comp.repairTurnsTotal).toBe(10);
        expect(comp.repairTurnsRemaining).toBe(ENGINE_REPAIR_TURNS);
        expect(comp.repairTurnsRemaining).toBe(10);
    });

    it('has correct repair cost from constants', () => {
        const comp = new EngineStateComponent();
        expect(comp.repairCost).toBe(ENGINE_REPAIR_COST);
        expect(comp.repairCost).toBe(60);
    });
});
