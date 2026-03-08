// OrbitComponent.ts — Circular orbit with smooth turn-based animation.
// Listens for TURN_END to set a target orbit angle and begin interpolation.
// Each tick, interpolates the visual angle toward the target using ease-in-out.
// Syncs TransformComponent position from orbit parameters each tick.
// Blocks turn advancement per-entity while animating.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { TransformComponent } from './TransformComponent';
import { getOrbitRadius } from '../entities/createPlanet';
import type { CanvasResizeEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Duration of the orbit animation in seconds */
export const ORBIT_ANIM_DURATION = 0.5;

/** Ease-in-out cubic for smooth animation start and stop. */
function easeInOutCubic(t: number): number {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class OrbitComponent extends Component {
    centreX: number;         // orbit centre (typically canvas centre for the star)
    centreY: number;
    radius: number;          // orbit radius in px
    angle: number;           // current visual position in orbit (radians)
    speed: number;           // radians per turn

    // --- Animation state for smooth interpolation ---
    targetAngle: number;     // destination angle after turn advance
    startAngle: number;      // angle at start of animation
    animating: boolean;      // whether we're currently interpolating
    animElapsed: number;     // seconds elapsed in current animation
    animDuration: number;    // total animation time in seconds

    private eventQueue: EventQueue | null = null;
    private turnEndHandler: EventHandler | null = null;
    private resizeHandler: EventHandler | null = null;

    constructor(centreX: number, centreY: number, radius: number, speed: number) {
        super();
        this.centreX = centreX;
        this.centreY = centreY;
        this.radius = radius;
        this.angle = 0;
        this.speed = speed;

        this.targetAngle = 0;
        this.startAngle = 0;
        this.animating = false;
        this.animElapsed = 0;
        this.animDuration = ORBIT_ANIM_DURATION;
    }

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.turnEndHandler = (): void => {
            // If already animating, snap to the current target first
            if (this.animating) {
                this.angle = this.targetAngle;
            }

            this.startAngle = this.angle;
            this.targetAngle = this.angle + this.speed;
            this.animElapsed = 0;
            this.animating = true;

            // Block turn advancement while this entity animates
            this.entity.emit({
                type: GameEvents.TURN_BLOCK,
                key: `orbit:${this.entity.id}`,
            });
        };

        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);

        this.resizeHandler = (event): void => {
            const { width, height } = event as CanvasResizeEvent;
            this.centreX = width / 2;
            this.centreY = height / 2;
            const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
            this.radius = getOrbitRadius(canvas);
        };

        this.eventQueue.on(GameEvents.CANVAS_RESIZE, this.resizeHandler);
    }

    update(dt: number): void {
        const transform = this.entity.getComponent(TransformComponent);
        if (!transform) return;

        // Advance animation if in progress
        if (this.animating) {
            this.animElapsed += dt;
            const t = Math.min(this.animElapsed / this.animDuration, 1);
            const eased = easeInOutCubic(t);
            this.angle = this.startAngle + (this.targetAngle - this.startAngle) * eased;

            if (t >= 1) {
                this.angle = this.targetAngle;
                this.animating = false;

                // Unblock turn advancement for this entity
                this.entity.emit({
                    type: GameEvents.TURN_UNBLOCK,
                    key: `orbit:${this.entity.id}`,
                });
            }
        }

        // Sync transform position from orbit parameters each tick
        transform.x = this.centreX + this.radius * Math.cos(this.angle);
        transform.y = this.centreY + this.radius * Math.sin(this.angle);
    }

    destroy(): void {
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
        if (this.eventQueue && this.resizeHandler) {
            this.eventQueue.off(GameEvents.CANVAS_RESIZE, this.resizeHandler);
        }
    }
}
