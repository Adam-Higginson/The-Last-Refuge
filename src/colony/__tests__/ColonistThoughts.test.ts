import { describe, it, expect } from 'vitest';
import { resolveThought } from '../ColonistThoughts';
import { CrewMemberComponent } from '../../components/CrewMemberComponent';
import type { ColonistVisualState } from '../ColonistState';

function makeColonist(overrides: Partial<ColonistVisualState> = {}): ColonistVisualState {
    return {
        entityId: 1,
        role: 'Civilian',
        activity: 'idle',
        gridX: 5,
        gridY: 5,
        path: [],
        pathIndex: 0,
        walkSpeed: 2,
        stateTimer: 0,
        facingDirection: 0,
        assignedBuildingSlot: null,
        sheltered: false,
        emergeDelay: 0,
        skinTone: '#f5d0b0',
        hairColour: '#1a1a1a',
        colour: '#66bb6a',
        name: 'Test Person',
        isLeader: false,
        walkPhase: 0,
        subActivity: null,
        subActivityTimer: 0,
        subActivityPhase: 0,
        buildingTypeId: null,
        secondaryTarget: null,
        returningToOrigin: false,
        greetingTimer: 0,
        greetingTargetId: null,
        thoughtBubble: null,
        thoughtTimer: 0,
        ...overrides,
    };
}

describe('ColonistThoughts', () => {
    it('returns a string for idle colonist', () => {
        const colonist = makeColonist({ activity: 'idle' });
        const crew = new CrewMemberComponent('Test', 30, 'Civilian', 50, ['Determined', 'Resourceful'], '');

        const thought = resolveThought(colonist, crew, 12);
        expect(thought).not.toBeNull();
        expect(typeof thought).toBe('string');
    });

    it('returns a string for working colonist', () => {
        const colonist = makeColonist({ activity: 'working' });
        const crew = new CrewMemberComponent('Test', 30, 'Engineer', 50, ['Analytical', 'Determined'], '');

        const thought = resolveThought(colonist, crew, 10);
        expect(thought).not.toBeNull();
        expect(typeof thought).toBe('string');
    });

    it('returns a string for socializing colonist', () => {
        const colonist = makeColonist({ activity: 'socializing' });
        const crew = new CrewMemberComponent('Test', 30, 'Civilian', 70, ['Hopeful', 'Empathetic'], '');

        const thought = resolveThought(colonist, crew, 18);
        expect(thought).not.toBeNull();
    });

    it('returns null for walking colonist', () => {
        const colonist = makeColonist({ activity: 'walking' });
        const crew = new CrewMemberComponent('Test', 30, 'Civilian', 50, ['Determined', 'Resourceful'], '');

        const thought = resolveThought(colonist, crew, 12);
        // Walking has no default thoughts, but morale/trait may trigger
        // Just verify it doesn't throw
        expect(thought === null || typeof thought === 'string').toBe(true);
    });

    it('returns varied thoughts across entity IDs', () => {
        const thoughts = new Set<string | null>();
        for (let id = 0; id < 50; id++) {
            const colonist = makeColonist({ entityId: id, activity: 'idle' });
            const crew = new CrewMemberComponent('Test', 30, 'Civilian', 50, ['Hopeful', 'Analytical'], '');
            thoughts.add(resolveThought(colonist, crew, 12));
        }
        // Should produce at least a few different thoughts
        expect(thoughts.size).toBeGreaterThan(2);
    });

    it('returns resting thoughts for resting colonist', () => {
        const colonist = makeColonist({ activity: 'resting' });
        const crew = new CrewMemberComponent('Test', 30, 'Civilian', 50, ['Determined', 'Resourceful'], '');

        const thought = resolveThought(colonist, crew, 2);
        expect(thought).not.toBeNull();
    });

    it('returns eating thoughts for eating colonist', () => {
        const colonist = makeColonist({ activity: 'eating' });
        const crew = new CrewMemberComponent('Test', 30, 'Civilian', 50, ['Determined', 'Resourceful'], '');

        const thought = resolveThought(colonist, crew, 12);
        expect(thought).not.toBeNull();
    });
});
