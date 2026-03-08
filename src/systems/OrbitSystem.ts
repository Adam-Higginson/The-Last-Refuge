// OrbitSystem.ts — Manages turn-based orbital movement with smooth interpolation.
// Listens for 'turn:end' events to set a target orbit angle.
// Each tick, interpolates the visual angle toward the target using ease-in-out.
// Syncs TransformComponent position from OrbitComponent each tick.

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { OrbitComponent } from '../components/OrbitComponent';
import { TransformComponent } from '../components/TransformComponent';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Ease-in-out cubic for smooth animation start and stop. */
function easeInOutCubic(t: number): number {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class OrbitSystem extends System {
    private turnEndHandler!: EventHandler;

    init(world: World): void {
        super.init(world);

        const eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        // On turn end, begin a smooth animation toward the next orbit position
        this.turnEndHandler = (): void => {
            const entities = this.world.getEntitiesWithComponent(OrbitComponent);
            for (const entity of entities) {
                const orbit = entity.getComponent(OrbitComponent);
                if (!orbit) continue;

                // If already animating, snap to the current target first
                if (orbit.animating) {
                    orbit.angle = orbit.targetAngle;
                }

                orbit.startAngle = orbit.angle;
                orbit.targetAngle = orbit.angle + orbit.speed;
                orbit.animElapsed = 0;
                orbit.animating = true;
            }
        };

        eventQueue.on('turn:end', this.turnEndHandler);
    }

    update(dt: number): void {
        const entities = this.world.getEntitiesWithComponent(OrbitComponent);
        for (const entity of entities) {
            const orbit = entity.getComponent(OrbitComponent);
            const transform = entity.getComponent(TransformComponent);
            if (!orbit || !transform) continue;

            // Advance animation if in progress
            if (orbit.animating) {
                orbit.animElapsed += dt;
                const t = Math.min(orbit.animElapsed / orbit.animDuration, 1);
                const eased = easeInOutCubic(t);
                orbit.angle = orbit.startAngle + (orbit.targetAngle - orbit.startAngle) * eased;

                if (t >= 1) {
                    orbit.angle = orbit.targetAngle;
                    orbit.animating = false;
                }
            }

            // Sync transform position from orbit parameters each tick.
            // This keeps position correct after resize, initial creation,
            // and during/after animation.
            transform.x = orbit.centreX + orbit.radius * Math.cos(orbit.angle);
            transform.y = orbit.centreY + orbit.radius * Math.sin(orbit.angle);
        }
    }

    destroy(): void {
        const eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        eventQueue.off('turn:end', this.turnEndHandler);
    }
}
