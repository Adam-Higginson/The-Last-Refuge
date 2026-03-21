import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTurnMorale, getWorkEfficiency } from '../ColonistMoraleEffects';
import { CrewMemberComponent } from '../../components/CrewMemberComponent';
import { World } from '../../core/World';
import type { PersonalityTrait } from '../../components/CrewMemberComponent';

function makeWorld(): World {
    return new World();
}

function addCrew(
    world: World,
    name: string,
    morale: number,
    traits: PersonalityTrait[] = ['Determined', 'Resourceful'],
    planetEntityId = 99,
    regionId = 1,
): { entityId: number; crew: CrewMemberComponent } {
    const entity = world.createEntity(name);
    const crew = new CrewMemberComponent(name, 30, 'Civilian', morale, traits, 'test');
    crew.location = { type: 'colony', planetEntityId, regionId };
    entity.addComponent(crew);
    return { entityId: entity.id, crew };
}

describe('ColonistMoraleEffects', () => {
    let world: World;

    beforeEach(() => {
        world = makeWorld();
        // Create the planet entity that matches planetEntityId
        const planet = world.createEntity('planet');
        // Ensure planet gets ID 99 by adjusting — not guaranteed
        // Instead, we use the planet's actual ID
        void planet;
    });

    describe('resolveTurnMorale', () => {
        it('friends co-located boost morale', () => {
            const { entityId: aliceId, crew: crew1 } = addCrew(world, 'Alice', 50, ['Determined', 'Resourceful'], 99, 1);
            const { entityId: bobId, crew: crew2 } = addCrew(world, 'Bob', 50, ['Determined', 'Resourceful'], 99, 1);

            crew1.relationships.push({ targetId: bobId, targetName: 'Bob', type: 'Close Bond', level: 80, description: '' });
            crew2.relationships.push({ targetId: aliceId, targetName: 'Alice', type: 'Close Bond', level: 80, description: '' });

            resolveTurnMorale(world, 99, 1);

            // Both should gain morale from friendship
            expect(crew1.morale).toBeGreaterThan(50);
            expect(crew2.morale).toBeGreaterThan(50);
        });

        it('romantic partner gives +2', () => {
            const { crew: crew1 } = addCrew(world, 'Alice', 50, ['Determined', 'Resourceful'], 99, 1);
            const { entityId: id2 } = addCrew(world, 'Bob', 50, ['Determined', 'Resourceful'], 99, 1);

            crew1.relationships.push({ targetId: id2, targetName: 'Bob', type: 'Romantic', level: 90, description: '' });

            resolveTurnMorale(world, 99, 1);

            // +2 from romantic, +0.3 from Determined, -1 isolation (no Close Bond or Romantic from Bob's side)
            expect(crew1.morale).toBeGreaterThan(50);
        });

        it('rival co-located reduces morale', () => {
            const { crew: crew1 } = addCrew(world, 'Alice', 50, ['Determined', 'Resourceful'], 99, 1);
            const { entityId: id2 } = addCrew(world, 'Bob', 50, ['Determined', 'Resourceful'], 99, 1);

            crew1.relationships.push({ targetId: id2, targetName: 'Bob', type: 'Rival', level: 20, description: '' });

            resolveTurnMorale(world, 99, 1);

            // -1.5 from rival, -1 isolation, +0.3 Determined = net negative
            expect(crew1.morale).toBeLessThan(50);
        });

        it('isolation penalty when no friends at colony', () => {
            const { crew: crew1 } = addCrew(world, 'Alice', 50, ['Determined', 'Resourceful'], 99, 1);
            addCrew(world, 'Bob', 50, ['Determined', 'Resourceful'], 99, 1);

            // No relationships between them
            resolveTurnMorale(world, 99, 1);

            // -1 isolation + 0.3 Determined = net -0.7
            expect(crew1.morale).toBeLessThan(50);
        });

        it('Hopeful trait gives +0.5', () => {
            const { crew } = addCrew(world, 'Alice', 50, ['Hopeful', 'Resourceful'], 99, 1);

            resolveTurnMorale(world, 99, 1);

            // +0.5 Hopeful, -1 isolation (alone-ish) → depends on count
            // Single colonist means no isolation penalty (size check)
            // With just one colonist, crewMap.size = 1, so no isolation penalty
            expect(crew.morale).toBe(50.5);
        });

        it('Haunted trait gives -0.5', () => {
            const { crew } = addCrew(world, 'Alice', 50, ['Haunted', 'Resourceful'], 99, 1);

            resolveTurnMorale(world, 99, 1);
            expect(crew.morale).toBe(49.5);
        });

        it('clamps morale to [0, 100]', () => {
            const { crew: crew1 } = addCrew(world, 'Alice', 2, ['Haunted', 'Grieving'], 99, 1);
            const { entityId: id2 } = addCrew(world, 'Bob', 50, ['Determined', 'Resourceful'], 99, 1);

            crew1.relationships.push({ targetId: id2, targetName: 'Bob', type: 'Rival', level: 20, description: '' });

            resolveTurnMorale(world, 99, 1);
            expect(crew1.morale).toBeGreaterThanOrEqual(0);

            // High morale
            const { crew: crew3 } = addCrew(world, 'Charlie', 99, ['Hopeful', 'Determined'], 99, 1);
            const { entityId: id4 } = addCrew(world, 'Diana', 50, ['Determined', 'Resourceful'], 99, 1);
            crew3.relationships.push({ targetId: id4, targetName: 'Diana', type: 'Romantic', level: 90, description: '' });
            crew3.relationships.push({ targetId: id4, targetName: 'Diana', type: 'Close Bond', level: 90, description: '' });

            resolveTurnMorale(world, 99, 1);
            expect(crew3.morale).toBeLessThanOrEqual(100);
        });

        it('caps delta at ±5 per turn', () => {
            const { crew: crew1 } = addCrew(world, 'Alice', 50, ['Hopeful', 'Determined'], 99, 1);

            // Add many friends
            for (let i = 0; i < 10; i++) {
                const { entityId } = addCrew(world, `Friend${i}`, 50, ['Determined', 'Resourceful'], 99, 1);
                crew1.relationships.push({ targetId: entityId, targetName: `Friend${i}`, type: 'Close Bond', level: 80, description: '' });
            }

            resolveTurnMorale(world, 99, 1);
            // Even with 10 friends (+10), delta capped at +5 + traits
            expect(crew1.morale).toBeLessThanOrEqual(55.8); // 50 + 5 + 0.5 + 0.3
        });

        it('handles empty colony', () => {
            // No crew at this region
            expect(() => resolveTurnMorale(world, 99, 999)).not.toThrow();
        });

        it('ignores crew at different regions', () => {
            const { crew: crew1 } = addCrew(world, 'Alice', 50, ['Determined', 'Resourceful'], 99, 1);
            const { entityId: id2 } = addCrew(world, 'Bob', 50, ['Determined', 'Resourceful'], 99, 2); // different region

            crew1.relationships.push({ targetId: id2, targetName: 'Bob', type: 'Close Bond', level: 80, description: '' });

            resolveTurnMorale(world, 99, 1);
            // Bob is in region 2, not region 1 — no friendship bonus, isolation penalty
            expect(crew1.morale).toBeLessThanOrEqual(50.3); // Determined only
        });
    });

    describe('getWorkEfficiency', () => {
        it('returns 1.0 for empty colony', () => {
            expect(getWorkEfficiency(world, 99, 999)).toBe(1.0);
        });

        it('returns 1.0 for full morale', () => {
            addCrew(world, 'Alice', 100, ['Determined', 'Resourceful'], 99, 1);
            addCrew(world, 'Bob', 100, ['Determined', 'Resourceful'], 99, 1);
            expect(getWorkEfficiency(world, 99, 1)).toBe(1.0);
        });

        it('returns 0.5 for zero morale', () => {
            addCrew(world, 'Alice', 0, ['Determined', 'Resourceful'], 99, 1);
            expect(getWorkEfficiency(world, 99, 1)).toBe(0.5);
        });

        it('returns correct value for mixed morale', () => {
            addCrew(world, 'Alice', 80, ['Determined', 'Resourceful'], 99, 1);
            addCrew(world, 'Bob', 40, ['Determined', 'Resourceful'], 99, 1);
            // Average morale = 60, efficiency = 0.5 + 0.6 * 0.5 = 0.8
            expect(getWorkEfficiency(world, 99, 1)).toBeCloseTo(0.8, 5);
        });
    });
});
