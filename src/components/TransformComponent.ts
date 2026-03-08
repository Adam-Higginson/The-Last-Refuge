// TransformComponent.ts — Position, rotation, and scale in canvas space

import { Component } from '../core/Component';

export class TransformComponent extends Component {
    x: number;
    y: number;
    angle: number; // radians
    scale: number;

    constructor(x = 0, y = 0, angle = 0, scale = 1) {
        super();
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.scale = scale;
    }
}
