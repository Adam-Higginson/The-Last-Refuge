// MoonOrbitComponent.ts — Circular orbit around a parent entity's position.
// Similar to OrbitComponent but dynamically tracks the parent entity's
// TransformComponent each tick, so the moon follows the planet as it orbits.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { TransformComponent } from './TransformComponent';
import type { Entity } from '../core/Entity';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Duration of the orbit animation in seconds */
const MOON_ORBIT_ANIM_DURATION = 0.5;

/** Ease-in-out cubic for smooth animation start and stop. */
function easeInOutCubic(t: number): number {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class MoonOrbitComponent extends Component {
    parentEntity: Entity;
    radius: number;
    angle: number;
    speed: number;

    // Animation state
    targetAngle: number;
    startAngle: number;
    animating: boolean;
    animElapsed: number;
    animDuration: number;

    private eventQueue: EventQueue | null = null;
    private turnEndHandler: EventHandler | null = null;

    constructor(parentEntity: Entity, radius: number, speed: number, startAngle: number) {
        super();
        this.parentEntity = parentEntity;
        this.radius = radius;
        this.angle = startAngle;
        this.speed = speed;

        this.targetAngle = startAngle;
        this.startAngle = startAngle;
        this.animating = false;
        this.animElapsed = 0;
        this.animDuration = MOON_ORBIT_ANIM_DURATION;
    }

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.turnEndHandler = (): void => {
            if (this.animating) {
                this.angle = this.targetAngle;
            }

            this.startAngle = this.angle;
            this.targetAngle = this.angle + this.speed;
            this.animElapsed = 0;
            this.animating = true;

            this.entity.emit({
                type: GameEvents.TURN_BLOCK,
                key: `moonOrbit:${this.entity.id}`,
            });
        };

        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
    }

    update(dt: number): void {
        const transform = this.entity.getComponent(TransformComponent);
        if (!transform) return;

        // Get parent entity's current position
        const parentTransform = this.parentEntity.getComponent(TransformComponent);
        if (!parentTransform) return;

        // Advance animation if in progress
        if (this.animating) {
            this.animElapsed += dt;
            const t = Math.min(this.animElapsed / this.animDuration, 1);
            const eased = easeInOutCubic(t);
            this.angle = this.startAngle + (this.targetAngle - this.startAngle) * eased;

            if (t >= 1) {
                this.angle = this.targetAngle;
                this.animating = false;

                this.entity.emit({
                    type: GameEvents.TURN_UNBLOCK,
                    key: `moonOrbit:${this.entity.id}`,
                });
            }
        }

        // Position relative to parent's current position
        transform.x = parentTransform.x + this.radius * Math.cos(this.angle);
        transform.y = parentTransform.y + this.radius * Math.sin(this.angle);
    }

    destroy(): void {
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
    }
}
