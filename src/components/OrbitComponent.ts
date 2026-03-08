// OrbitComponent.ts — Circular orbit around a centre point.
// OrbitSystem uses this to update the entity's TransformComponent each tick.
// Supports smooth interpolation between turn positions.

import { Component } from '../core/Component';

/** Duration of the orbit animation in seconds */
export const ORBIT_ANIM_DURATION = 0.5;

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
}
