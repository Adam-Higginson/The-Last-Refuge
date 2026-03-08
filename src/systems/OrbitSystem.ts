// OrbitSystem.ts — Manages turn-based orbital movement.
// Listens for 'turn:end' events to advance orbit angles.
// Syncs TransformComponent position from OrbitComponent each tick
// (handles resize and initial placement).

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { OrbitComponent } from '../components/OrbitComponent';
import { TransformComponent } from '../components/TransformComponent';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';

export class OrbitSystem extends System {
    private turnEndHandler!: EventHandler;

    init(world: World): void {
        super.init(world);

        const eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        // On turn end, advance all orbiting entities by their speed (radians per turn)
        this.turnEndHandler = (): void => {
            const entities = this.world.getEntitiesWithComponent(OrbitComponent);
            for (const entity of entities) {
                const orbit = entity.getComponent(OrbitComponent);
                if (orbit) {
                    orbit.angle += orbit.speed;
                }
            }
        };

        eventQueue.on('turn:end', this.turnEndHandler);
    }

    update(_dt: number): void {
        // Sync transform position from orbit parameters each tick.
        // This keeps position correct after resize, initial creation,
        // and after turn:end advances the angle.
        const entities = this.world.getEntitiesWithComponent(OrbitComponent);
        for (const entity of entities) {
            const orbit = entity.getComponent(OrbitComponent);
            const transform = entity.getComponent(TransformComponent);
            if (!orbit || !transform) continue;

            transform.x = orbit.centreX + orbit.radius * Math.cos(orbit.angle);
            transform.y = orbit.centreY + orbit.radius * Math.sin(orbit.angle);
        }
    }

    destroy(): void {
        const eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        eventQueue.off('turn:end', this.turnEndHandler);
    }
}
