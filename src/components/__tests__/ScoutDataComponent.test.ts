import { describe, it, expect } from 'vitest';
import { ScoutDataComponent } from '../ScoutDataComponent';

describe('ScoutDataComponent', () => {
    it('stores display name, pilot entity ID, and pilot name', () => {
        const comp = new ScoutDataComponent('Scout Alpha', 42, 'Lt. Kira Yossef');
        expect(comp.displayName).toBe('Scout Alpha');
        expect(comp.pilotEntityId).toBe(42);
        expect(comp.pilotName).toBe('Lt. Kira Yossef');
    });

    it('initialises with empty trail positions', () => {
        const comp = new ScoutDataComponent('Scout Beta', 7, 'Cpl. Dae-Ho Lim');
        expect(comp.trailPositions).toEqual([]);
    });

    it('defaults capacity to 3', () => {
        const comp = new ScoutDataComponent('Scout Delta', 5, 'Sgt. Val Torres');
        expect(comp.capacity).toBe(3);
    });

    it('allows pushing trail positions', () => {
        const comp = new ScoutDataComponent('Scout Gamma', 10, 'Pvt. Nala Osei');
        comp.trailPositions.push({ x: 100, y: 200 });
        comp.trailPositions.push({ x: 150, y: 250 });
        expect(comp.trailPositions).toHaveLength(2);
        expect(comp.trailPositions[0]).toEqual({ x: 100, y: 200 });
    });
});
