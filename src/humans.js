// humans.js — Crew generation and relationships

import { firstNames, lastNames } from '../data/names.js';

const TRAITS = [
    'Stubborn', 'Empathetic', 'Reckless', 'Analytical',
    'Protective', 'Haunted', 'Resourceful', 'Quiet',
    'Hopeful', 'Grieving', 'Determined',
];

const RELATIONSHIP_TYPES = [
    'Close Bond', 'Romantic', 'Mentor/Protege', 'Rival', 'Estranged',
];

const ROLE_DISTRIBUTION = {
    Engineer: 10,
    Soldier: 8,
    Medic: 5,
    Scientist: 5,
    Civilian: 22,
};

const PRESEEDED = [
    {
        name: 'Mira Chen',
        age: 22,
        role: 'Soldier',
        traits: ['Determined', 'Reckless'],
    },
    {
        name: 'Dr. Yael Chen',
        age: 51,
        role: 'Medic',
        traits: ['Protective', 'Analytical'],
    },
    {
        name: 'Commander Soren Vael',
        age: 38,
        role: 'Soldier',
        traits: ['Stubborn', 'Resourceful'],
    },
    {
        name: 'Lt. Desta Morrow',
        age: 29,
        role: 'Soldier',
        traits: ['Haunted', 'Empathetic'],
    },
];

const PRESEEDED_RELATIONSHIPS = [
    { from: 'Mira Chen', to: 'Dr. Yael Chen', type: 'Close Bond', description: 'Yael is Mira\'s mother — the last family either of them has.' },
    { from: 'Dr. Yael Chen', to: 'Mira Chen', type: 'Close Bond', description: 'Mira is everything Yael has left. She would burn the ship down to keep her safe.' },
    { from: 'Commander Soren Vael', to: 'Mira Chen', type: 'Mentor/Protege', description: 'Soren sees in Mira the soldier he wishes he\'d been at her age.' },
    { from: 'Mira Chen', to: 'Commander Soren Vael', type: 'Mentor/Protege', description: 'Mira trusts Soren more than anyone aboard.' },
    { from: 'Lt. Desta Morrow', to: 'Commander Soren Vael', type: 'Romantic', description: 'What started as respect became something neither expected.' },
    { from: 'Commander Soren Vael', to: 'Lt. Desta Morrow', type: 'Romantic', description: 'Desta is the only person who sees past the rank.' },
];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function weightedAge() {
    // Weighted toward 25-45
    const base = Math.random();
    if (base < 0.15) return randomInt(18, 24);
    if (base < 0.75) return randomInt(25, 45);
    return randomInt(46, 65);
}

function pickTraits(exclude = []) {
    const available = TRAITS.filter(t => !exclude.includes(t));
    const t1 = pickRandom(available);
    const t2 = pickRandom(available.filter(t => t !== t1));
    return [t1, t2];
}

function generateHuman(id, role, usedNames) {
    let name;
    do {
        name = `${pickRandom(firstNames)} ${pickRandom(lastNames)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    return {
        id,
        name,
        age: weightedAge(),
        role,
        morale: randomInt(40, 70),
        traits: pickTraits(),
        relationships: [],
    };
}

export function generateCrew(state) {
    const humans = [];
    const usedNames = new Set();
    let id = 0;

    // Add pre-seeded characters first
    for (const seed of PRESEEDED) {
        usedNames.add(seed.name);
        humans.push({
            id: id++,
            name: seed.name,
            age: seed.age,
            role: seed.role,
            morale: randomInt(40, 70),
            traits: [...seed.traits],
            relationships: [],
        });
    }

    // Count roles already filled by pre-seeded
    const roleCounts = {};
    for (const role of Object.keys(ROLE_DISTRIBUTION)) {
        roleCounts[role] = humans.filter(h => h.role === role).length;
    }

    // Build role pool for remaining humans
    const rolePool = [];
    for (const [role, count] of Object.entries(ROLE_DISTRIBUTION)) {
        const remaining = count - (roleCounts[role] || 0);
        for (let i = 0; i < remaining; i++) {
            rolePool.push(role);
        }
    }

    // Shuffle role pool
    for (let i = rolePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
    }

    // Generate remaining crew
    for (const role of rolePool) {
        humans.push(generateHuman(id++, role, usedNames));
    }

    // Apply pre-seeded relationships
    for (const rel of PRESEEDED_RELATIONSHIPS) {
        const from = humans.find(h => h.name === rel.from);
        const to = humans.find(h => h.name === rel.to);
        if (from && to) {
            from.relationships.push({
                targetId: to.id,
                targetName: to.name,
                type: rel.type,
                description: rel.description,
            });
        }
    }

    // Generate random relationships for remaining crew
    for (const human of humans) {
        if (human.relationships.length >= 1) continue;

        const numRelationships = randomInt(1, 3);
        const candidates = humans.filter(h =>
            h.id !== human.id &&
            !human.relationships.some(r => r.targetId === h.id)
        );

        for (let i = 0; i < numRelationships && candidates.length > 0; i++) {
            const idx = Math.floor(Math.random() * candidates.length);
            const target = candidates.splice(idx, 1)[0];
            const type = pickRandom(RELATIONSHIP_TYPES);

            human.relationships.push({
                targetId: target.id,
                targetName: target.name,
                type,
                description: `${type} — forged in the desperate hours of the exodus.`,
            });

            // Ensure reciprocal relationship
            if (!target.relationships.some(r => r.targetId === human.id)) {
                target.relationships.push({
                    targetId: human.id,
                    targetName: human.name,
                    type,
                    description: `${type} — forged in the desperate hours of the exodus.`,
                });
            }
        }
    }

    state.humans = humans;
}
