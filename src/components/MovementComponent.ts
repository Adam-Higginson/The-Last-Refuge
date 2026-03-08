// MovementComponent.ts — Ship movement with budget and animation.
// MovementSystem reads this to animate the ship gliding to its target.

import { Component } from '../core/Component';

export class MovementComponent extends Component {
    budgetMax: number;       // max movement distance per turn (px)
    budgetRemaining: number; // remaining this turn
    targetX: number | null;  // where the ship is gliding toward
    targetY: number | null;
    speed: number;           // glide speed in px/second
    moving: boolean;

    constructor(budgetMax: number, speed = 200) {
        super();
        this.budgetMax = budgetMax;
        this.budgetRemaining = budgetMax;
        this.targetX = null;
        this.targetY = null;
        this.speed = speed;
        this.moving = false;
    }
}
