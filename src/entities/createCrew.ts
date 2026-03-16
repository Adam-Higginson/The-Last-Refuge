// createCrew.ts — Creates 50 crew members from the authored manifest.
// Reads CREW_MANIFEST and RELATIONSHIP_MANIFEST, creates entities with
// CrewMemberComponent, and wires bidirectional relationships with levels.

import { CREW_MANIFEST, RELATIONSHIP_MANIFEST } from '../data/crewManifest';
import { CrewMemberComponent } from '../components/CrewMemberComponent';
import type { RelationshipType } from '../components/CrewMemberComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Wire a bidirectional relationship between two crew entities. */
function wireRelationship(
    entityA: Entity,
    entityB: Entity,
    type: RelationshipType,
    level: number,
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
        level,
        description: descAB,
    });

    crewB.relationships.push({
        targetId: entityA.id,
        targetName: crewA.fullName,
        type,
        level,
        description: descBA,
    });
}

export function createCrew(world: World): Entity[] {
    const entities: Entity[] = [];
    const entityByName = new Map<string, Entity>();

    // --- 1. Create all crew from manifest ---
    for (const def of CREW_MANIFEST) {
        const entityName = def.name.toLowerCase().replace(/[\s.]/g, '');
        const entity = world.createEntity(entityName);
        entity.addComponent(new CrewMemberComponent(
            def.name, def.age, def.role, def.morale, def.traits,
        ));

        if (def.isCaptain) {
            const crew = entity.getComponent(CrewMemberComponent);
            if (crew) crew.isCaptain = true;
        }

        entities.push(entity);
        entityByName.set(def.name, entity);
    }

    // --- 2. Wire relationships from manifest ---
    for (const rel of RELATIONSHIP_MANIFEST) {
        const from = entityByName.get(rel.from);
        const to = entityByName.get(rel.to);
        if (from && to) {
            wireRelationship(from, to, rel.type, rel.level, rel.descAB, rel.descBA);
        }
    }

    return entities;
}
