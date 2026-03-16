import { describe, it, expect } from 'vitest';
import { CREW_MANIFEST, RELATIONSHIP_MANIFEST } from '../crewManifest';
import type { CrewRole, Trait, RelationshipType } from '../../components/CrewMemberComponent';

const VALID_ROLES: CrewRole[] = ['Engineer', 'Soldier', 'Medic', 'Scientist', 'Civilian'];
const VALID_TRAITS: Trait[] = [
    'Stubborn', 'Empathetic', 'Reckless', 'Analytical',
    'Protective', 'Haunted', 'Resourceful', 'Quiet',
    'Hopeful', 'Grieving', 'Determined',
];
const VALID_REL_TYPES: RelationshipType[] = [
    'Close Bond', 'Romantic', 'Mentor/Protege', 'Rival', 'Estranged',
];

describe('CREW_MANIFEST', () => {
    it('has exactly 50 crew members', () => {
        expect(CREW_MANIFEST).toHaveLength(50);
    });

    it('all names are unique', () => {
        const names = CREW_MANIFEST.map(c => c.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('has correct role distribution', () => {
        const counts: Record<string, number> = {};
        for (const c of CREW_MANIFEST) {
            counts[c.role] = (counts[c.role] ?? 0) + 1;
        }
        expect(counts.Engineer).toBe(10);
        expect(counts.Soldier).toBe(8);
        expect(counts.Medic).toBe(5);
        expect(counts.Scientist).toBe(5);
        expect(counts.Civilian).toBe(22);
    });

    it('all roles are valid', () => {
        for (const c of CREW_MANIFEST) {
            expect(VALID_ROLES).toContain(c.role);
        }
    });

    it('all traits are valid and each member has exactly 2 unique traits', () => {
        for (const c of CREW_MANIFEST) {
            expect(c.traits).toHaveLength(2);
            expect(VALID_TRAITS).toContain(c.traits[0]);
            expect(VALID_TRAITS).toContain(c.traits[1]);
            expect(c.traits[0]).not.toBe(c.traits[1]);
        }
    });

    it('all ages are between 18 and 65', () => {
        for (const c of CREW_MANIFEST) {
            expect(c.age).toBeGreaterThanOrEqual(18);
            expect(c.age).toBeLessThanOrEqual(65);
        }
    });

    it('all morale values are between 40 and 70', () => {
        for (const c of CREW_MANIFEST) {
            expect(c.morale).toBeGreaterThanOrEqual(40);
            expect(c.morale).toBeLessThanOrEqual(70);
        }
    });

    it('has exactly one captain', () => {
        const captains = CREW_MANIFEST.filter(c => c.isCaptain);
        expect(captains).toHaveLength(1);
        expect(captains[0].name).toBe('Commander Soren Vael');
    });
});

describe('RELATIONSHIP_MANIFEST', () => {
    const crewNames = new Set(CREW_MANIFEST.map(c => c.name));

    it('all from/to names exist in crew manifest', () => {
        for (const r of RELATIONSHIP_MANIFEST) {
            expect(crewNames.has(r.from)).toBe(true);
            expect(crewNames.has(r.to)).toBe(true);
        }
    });

    it('no self-referencing relationships', () => {
        for (const r of RELATIONSHIP_MANIFEST) {
            expect(r.from).not.toBe(r.to);
        }
    });

    it('all relationship types are valid', () => {
        for (const r of RELATIONSHIP_MANIFEST) {
            expect(VALID_REL_TYPES).toContain(r.type);
        }
    });

    it('all levels are between 0 and 100', () => {
        for (const r of RELATIONSHIP_MANIFEST) {
            expect(r.level).toBeGreaterThanOrEqual(0);
            expect(r.level).toBeLessThanOrEqual(100);
        }
    });

    it('all descriptions are non-empty', () => {
        for (const r of RELATIONSHIP_MANIFEST) {
            expect(r.descAB.length).toBeGreaterThan(0);
            expect(r.descBA.length).toBeGreaterThan(0);
        }
    });

    it('no duplicate description strings (catches copy-paste errors)', () => {
        const allDescs: string[] = [];
        for (const r of RELATIONSHIP_MANIFEST) {
            allDescs.push(r.descAB);
            allDescs.push(r.descBA);
        }
        const unique = new Set(allDescs);
        expect(unique.size).toBe(allDescs.length);
    });

    it('no duplicate from/to pairs', () => {
        const pairs = new Set<string>();
        for (const r of RELATIONSHIP_MANIFEST) {
            const key = [r.from, r.to].sort().join('|||');
            expect(pairs.has(key)).toBe(false);
            pairs.add(key);
        }
    });

    it('every crew member appears in at least 1 relationship', () => {
        const mentioned = new Set<string>();
        for (const r of RELATIONSHIP_MANIFEST) {
            mentioned.add(r.from);
            mentioned.add(r.to);
        }
        for (const c of CREW_MANIFEST) {
            expect(mentioned.has(c.name)).toBe(true);
        }
    });

    it('captain has at least 30 relationships', () => {
        const captainName = 'Commander Soren Vael';
        const count = RELATIONSHIP_MANIFEST.filter(
            r => r.from === captainName || r.to === captainName,
        ).length;
        expect(count).toBeGreaterThanOrEqual(30);
    });
});
