// OrbitComponent.ts — Circular orbit around a centre point.
// OrbitSystem uses this to update the entity's TransformComponent each tick.

import { Component } from '../core/Component';

export class OrbitComponent extends Component {
    centreX: number;         // orbit centre (typically canvas centre for the star)
    centreY: number;
    radius: number;          // orbit radius in px
    angle: number;           // current position in orbit (radians)
    speed: number;           // radians per turn

    constructor(centreX: number, centreY: number, radius: number, speed: number) {
        super();
        this.centreX = centreX;
        this.centreY = centreY;
        this.radius = radius;
        this.angle = 0;
        this.speed = speed;
    }
}
