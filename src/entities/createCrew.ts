// createCrew.ts — Procedural generation of 50 crew members at game start.
// Creates entities with CrewMemberComponent, builds a relationship web,
// and ensures the 4 pre-seeded story characters are present.

import { mulberry32 } from '../utils/prng';
import { FIRST_NAMES, LAST_NAMES } from '../data/names';
import { CrewMemberComponent } from '../components/CrewMemberComponent';
import type { CrewRole, Trait, Relationship } from '../components/CrewMemberComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Total crew size */
const CREW_SIZE = 50;

/** PRNG seed for deterministic crew generation */
const CREW_SEED = 42;

/** Role quotas — must sum to CREW_SIZE */
const ROLE_QUOTAS: Record<CrewRole, number> = {
    Engineer: 10,
    Soldier: 8,
    Medic: 5,
    Scientist: 5,
    Civilian: 22,
};

/** Full trait pool */
const TRAIT_POOL: readonly Trait[] = [
    'Stubborn', 'Empathetic', 'Reckless', 'Analytical',
    'Protective', 'Haunted', 'Resourceful', 'Quiet',
    'Hopeful', 'Grieving', 'Determined',
];

/** Relationship types */
const RELATIONSHIP_TYPES: readonly Relationship['type'][] = [
    'Close Bond', 'Romantic', 'Mentor/Protege', 'Rival', 'Estranged',
];

// ---------------------------------------------------------------------------
// Pre-seeded characters (created before procedural generation)
// ---------------------------------------------------------------------------

interface PreSeededDef {
    name: string;
    age: number;
    role: CrewRole;
    traits: [Trait, Trait];
}

const PRE_SEEDED: readonly PreSeededDef[] = [
    { name: 'Mira Chen', age: 22, role: 'Soldier', traits: ['Determined', 'Reckless'] },
    { name: 'Dr. Yael Chen', age: 51, role: 'Medic', traits: ['Protective', 'Analytical'] },
    { name: 'Commander Soren Vael', age: 38, role: 'Soldier', traits: ['Stubborn', 'Resourceful'] },
    { name: 'Lt. Desta Morrow', age: 29, role: 'Soldier', traits: ['Haunted', 'Empathetic'] },
];

/** Pre-seeded relationship wiring (applied after all entities exist). */
interface PreSeededRelDef {
    fromName: string;
    toName: string;
    type: Relationship['type'];
    descAB: string;
    descBA: string;
}

const PRE_SEEDED_RELS: readonly PreSeededRelDef[] = [
    {
        fromName: 'Mira Chen',
        toName: 'Dr. Yael Chen',
        type: 'Close Bond',
        descAB: 'Yael is her mother — the only family she has left',
        descBA: 'Mira is her daughter — she would burn worlds to keep her safe',
    },
    {
        fromName: 'Commander Soren Vael',
        toName: 'Mira Chen',
        type: 'Mentor/Protege',
        descAB: 'He took Mira under his wing after the exodus',
        descBA: 'Soren trained her when no one else would',
    },
    {
        fromName: 'Lt. Desta Morrow',
        toName: 'Commander Soren Vael',
        type: 'Romantic',
        descAB: 'They found each other in the dark between stars',
        descBA: 'Desta is the reason he still believes in tomorrow',
    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Weighted random integer in [min, max], bell-curve weighted toward centre. */
function weightedAge(rng: () => number, min: number, max: number): number {
    // Average two uniform samples to create a triangular distribution
    // peaking around the midpoint of [min, max]
    const a = rng();
    const b = rng();
    const avg = (a + b) / 2;
    return Math.floor(min + avg * (max - min + 1));
}

/** Random integer in [min, max]. */
function randInt(rng: () => number, min: number, max: number): number {
    return Math.floor(rng() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
function pick<T>(rng: () => number, arr: readonly T[]): T {
    return arr[Math.floor(rng() * arr.length)];
}

/** Pick n unique elements from an array. */
function pickUnique<T>(rng: () => number, arr: readonly T[], n: number): T[] {
    const copy = [...arr];
    const result: T[] = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
        const idx = Math.floor(rng() * copy.length);
        result.push(copy[idx]);
        copy.splice(idx, 1);
    }
    return result;
}

/** Generate a short relationship description based on type. */
function relationDescription(
    rng: () => number,
    type: Relationship['type'],
    nameA: string,
    nameB: string,
): string {
    const firstA = nameA.split(' ').pop() ?? nameA;
    const firstB = nameB.split(' ').pop() ?? nameB;

    const templates: Record<Relationship['type'], readonly string[]> = {
        'Close Bond': [
            `${firstA} and ${firstB} trust each other completely`,
            `${firstA} would follow ${firstB} into the void`,
            `They survived the exodus together`,
        ],
        'Romantic': [
            `${firstA} and ${firstB} share a quiet bond`,
            `They found solace in each other`,
            `${firstA} and ${firstB} are inseparable`,
        ],
        'Mentor/Protege': [
            `${firstA} took ${firstB} under their wing`,
            `${firstB} learned everything from ${firstA}`,
            `${firstA} sees potential in ${firstB}`,
        ],
        'Rival': [
            `${firstA} and ${firstB} clash at every turn`,
            `They compete for every scrap of recognition`,
            `${firstA} can't stand ${firstB}'s approach`,
        ],
        'Estranged': [
            `${firstA} and ${firstB} haven't spoken in months`,
            `Something broke between them during the exodus`,
            `They avoid each other in the corridors`,
        ],
    };

    return pick(rng, templates[type]);
}

/** Wire a bidirectional relationship between two crew entities. */
function wireRelationship(
    entityA: Entity,
    entityB: Entity,
    type: Relationship['type'],
    descAB: string,
    descBA: string,
): void {
    const crewA = entityA.getComponent(CrewMemberComponent);
    const crewB = entityB.getComponent(CrewMemberComponent);
    if (!crewA || !crewB) return;

    // Avoid duplicate relationships
    if (crewA.relationships.some(r => r.targetId === entityB.id)) return;

    crewA.relationships.push({
        targetId: entityB.id,
        targetName: crewB.fullName,
        type,
        description: descAB,
    });

    crewB.relationships.push({
        targetId: entityA.id,
        targetName: crewA.fullName,
        type,
        description: descBA,
    });
}

// ---------------------------------------------------------------------------
// Main generation
// ---------------------------------------------------------------------------

export function createCrew(world: World): Entity[] {
    const rng = mulberry32(CREW_SEED);
    const entities: Entity[] = [];
    const usedNames = new Set<string>();

    // Track remaining role slots (subtract pre-seeded characters)
    const remaining: Record<CrewRole, number> = { ...ROLE_QUOTAS };
    for (const ps of PRE_SEEDED) {
        remaining[ps.role]--;
    }

    // --- 1. Create pre-seeded characters ---
    for (const ps of PRE_SEEDED) {
        const entity = world.createEntity(ps.name.toLowerCase().replace(/[\s.]/g, ''));
        const morale = randInt(rng, 40, 70);
        entity.addComponent(new CrewMemberComponent(
            ps.name, ps.age, ps.role, morale, ps.traits,
        ));
        entities.push(entity);
        usedNames.add(ps.name);
    }

    // --- 2. Build role pool for procedural generation ---
    const rolePool: CrewRole[] = [];
    for (const [role, count] of Object.entries(remaining)) {
        for (let i = 0; i < count; i++) {
            rolePool.push(role as CrewRole);
        }
    }
    // Shuffle the role pool
    for (let i = rolePool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
    }

    // --- 3. Generate procedural crew members ---
    for (let i = 0; i < CREW_SIZE - PRE_SEEDED.length; i++) {
        // Generate unique name
        let fullName: string;
        do {
            const first = pick(rng, FIRST_NAMES);
            const last = pick(rng, LAST_NAMES);
            fullName = `${first} ${last}`;
        } while (usedNames.has(fullName));
        usedNames.add(fullName);

        const age = weightedAge(rng, 18, 65);
        const role = rolePool[i];
        const morale = randInt(rng, 40, 70);
        const traits = pickUnique(rng, TRAIT_POOL, 2) as [Trait, Trait];

        const entityName = fullName.toLowerCase().replace(/\s/g, '');
        const entity = world.createEntity(entityName);
        entity.addComponent(new CrewMemberComponent(
            fullName, age, role, morale, traits,
        ));
        entities.push(entity);
    }

    // --- 4. Wire pre-seeded relationships ---
    const entityByName = new Map<string, Entity>();
    for (const entity of entities) {
        const crew = entity.getComponent(CrewMemberComponent);
        if (crew) entityByName.set(crew.fullName, entity);
    }

    for (const rel of PRE_SEEDED_RELS) {
        const from = entityByName.get(rel.fromName);
        const to = entityByName.get(rel.toName);
        if (from && to) {
            wireRelationship(from, to, rel.type, rel.descAB, rel.descBA);
        }
    }

    // --- 5. Generate procedural relationships ---
    // Each crew member should end up with 1-3 relationships total.
    // Pre-seeded characters already have some.
    for (const entity of entities) {
        const crew = entity.getComponent(CrewMemberComponent);
        if (!crew) continue;

        const desired = randInt(rng, 1, 3);
        while (crew.relationships.length < desired) {
            // Pick a random other crew member
            const other = entities[Math.floor(rng() * entities.length)];
            if (other === entity) continue;

            const otherCrew = other.getComponent(CrewMemberComponent);
            if (!otherCrew) continue;

            // Skip if already related
            if (crew.relationships.some(r => r.targetId === other.id)) continue;

            // Skip if other already has 3 relationships
            if (otherCrew.relationships.length >= 3) continue;

            const type = pick(rng, RELATIONSHIP_TYPES);
            const descAB = relationDescription(rng, type, crew.fullName, otherCrew.fullName);
            const descBA = relationDescription(rng, type, otherCrew.fullName, crew.fullName);
            wireRelationship(entity, other, type, descAB, descBA);
        }
    }

    // --- 6. Orphan fix: ensure everyone has at least 1 relationship ---
    for (let i = 0; i < entities.length; i++) {
        const crew = entities[i].getComponent(CrewMemberComponent);
        if (!crew || crew.relationships.length > 0) continue;

        // Connect to a random neighbour who has room
        for (let attempt = 0; attempt < entities.length; attempt++) {
            const j = (i + 1 + attempt) % entities.length;
            if (j === i) continue;
            const other = entities[j];
            const otherCrew = other.getComponent(CrewMemberComponent);
            if (!otherCrew) continue;
            if (crew.relationships.some(r => r.targetId === other.id)) continue;

            const type = pick(rng, RELATIONSHIP_TYPES);
            const descAB = relationDescription(rng, type, crew.fullName, otherCrew.fullName);
            const descBA = relationDescription(rng, type, otherCrew.fullName, crew.fullName);
            wireRelationship(entities[i], other, type, descAB, descBA);
            break;
        }
    }

    return entities;
}
