// ScoutDestructionComponent.ts — Checks if Extiris is within kill radius.
// Destroys the scout and marks the pilot as dead when caught.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { TransformComponent } from './TransformComponent';
import { ScoutDataComponent } from './ScoutDataComponent';
import { CrewMemberComponent } from './CrewMemberComponent';
import { SCOUT_KILL_RADIUS } from '../data/constants';
import type { World } from '../core/World';

export class ScoutDestructionComponent extends Component {
    update(_dt: number): void {
        let world: World;
        try {
            world = ServiceLocator.get<World>('world');
        } catch {
            return;
        }

        const extiris = world.getEntityByName('extiris');
        if (!extiris) return;

        const extirisTransform = extiris.getComponent(TransformComponent);
        const scoutTransform = this.entity.getComponent(TransformComponent);
        if (!extirisTransform || !scoutTransform) return;

        const dx = extirisTransform.x - scoutTransform.x;
        const dy = extirisTransform.y - scoutTransform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > SCOUT_KILL_RADIUS) return;

        const scoutData = this.entity.getComponent(ScoutDataComponent);
        if (!scoutData) return;

        // Mark pilot as dead
        const pilotEntity = world.getEntity(scoutData.pilotEntityId);
        const pilot = pilotEntity?.getComponent(CrewMemberComponent);
        if (pilot && pilot.location.type !== 'dead') {
            pilot.location = { type: 'dead' };
        }

        // Emit destruction event
        const eventQueue = ServiceLocator.get<import('../core/EventQueue').EventQueue>('eventQueue');
        eventQueue.emit({
            type: GameEvents.SCOUT_DESTROYED,
            scoutEntityId: this.entity.id,
            pilotName: scoutData.pilotName,
        });

        // Remove scout entity from world
        world.removeEntity(this.entity.id);
    }
}
