// ExtirisMovementComponent.ts — Movement animation for the Extiris hunter ship.
// Purely handles lerp animation toward a target. ExtirisAIComponent sets the target,
// and this component emits EXTIRIS_MOVE_COMPLETE on arrival.

import { Component } from '../core/Component';
import { GameEvents } from '../core/GameEvents';
import { TransformComponent } from './TransformComponent';
import { animateMovement } from '../utils/animateMovement';
import { EXTIRIS_MOVEMENT_SPEED } from '../data/constants';

export class ExtirisMovementComponent extends Component {
    targetX: number | null = null;
    targetY: number | null = null;
    speed: number = EXTIRIS_MOVEMENT_SPEED;
    moving = false;
    facing = 0;

    /** Called by ExtirisAIComponent after receiving an AI decision. */
    setTarget(x: number, y: number): void {
        this.targetX = x;
        this.targetY = y;
        this.moving = true;
    }

    update(dt: number): void {
        if (!this.moving || this.targetX === null || this.targetY === null) return;

        const transform = this.entity.getComponent(TransformComponent);
        if (!transform) return;

        const result = animateMovement({
            x: transform.x,
            y: transform.y,
            targetX: this.targetX,
            targetY: this.targetY,
            speed: this.speed,
        }, dt);

        transform.x = result.x;
        transform.y = result.y;
        this.facing = result.facing;
        transform.angle = this.facing;

        if (result.arrived) {
            this.moving = false;
            this.targetX = null;
            this.targetY = null;

            this.entity.emit({
                type: GameEvents.EXTIRIS_MOVE_COMPLETE,
                entityId: this.entity.id,
            });
        }
    }
}
