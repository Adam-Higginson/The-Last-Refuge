// animateMovement.ts — Shared lerp-toward-target movement utility.
// Used by both MovementComponent (player ship) and ExtirisMovementComponent.

export interface MoveState {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    speed: number;
}

export interface MoveResult {
    x: number;
    y: number;
    arrived: boolean;
    facing: number;
}

/**
 * Advance a position toward a target by `speed * dt` world units.
 * Returns the new position, whether the target was reached, and the facing angle.
 */
export function animateMovement(state: MoveState, dt: number): MoveResult {
    const dx = state.targetX - state.x;
    const dy = state.targetY - state.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = state.speed * dt;
    const facing = Math.atan2(dy, dx);

    if (dist < 1 || step >= dist) {
        return {
            x: state.targetX,
            y: state.targetY,
            arrived: true,
            facing,
        };
    }

    const ratio = step / dist;
    return {
        x: state.x + dx * ratio,
        y: state.y + dy * ratio,
        arrived: false,
        facing,
    };
}
