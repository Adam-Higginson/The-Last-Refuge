import { describe, it, expect } from 'vitest';
import { getRelationshipColour } from '../colourUtils';

describe('getRelationshipColour', () => {
    it('returns red for level 0', () => {
        expect(getRelationshipColour(0)).toBe('#cc4444');
    });

    it('returns red for level 25', () => {
        expect(getRelationshipColour(25)).toBe('#cc4444');
    });

    it('returns orange for level 26', () => {
        expect(getRelationshipColour(26)).toBe('#cc8844');
    });

    it('returns orange for level 50', () => {
        expect(getRelationshipColour(50)).toBe('#cc8844');
    });

    it('returns yellow for level 51', () => {
        expect(getRelationshipColour(51)).toBe('#ccaa44');
    });

    it('returns yellow for level 75', () => {
        expect(getRelationshipColour(75)).toBe('#ccaa44');
    });

    it('returns green for level 76', () => {
        expect(getRelationshipColour(76)).toBe('#44cc66');
    });

    it('returns green for level 100', () => {
        expect(getRelationshipColour(100)).toBe('#44cc66');
    });
});
