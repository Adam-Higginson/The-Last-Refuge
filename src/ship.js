// ship.js — Ship entity and movement

export function initShip(state, canvas) {
    // Start ship near edge of canvas
    state.ship.x = canvas.width * 0.85;
    state.ship.y = canvas.height * 0.2;
    state.ship.angle = Math.PI; // facing left initially
}

export function moveShip(state, targetX, targetY) {
    const dx = targetX - state.ship.x;
    const dy = targetY - state.ship.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > state.ship.movementBudget) {
        return false; // out of range
    }

    // TODO: animate movement (glide to target)
    state.ship.x = targetX;
    state.ship.y = targetY;
    state.ship.angle = Math.atan2(dy, dx);
    state.ship.movementBudget -= distance;

    return true;
}

export function getShipDistanceTo(state, x, y) {
    const dx = x - state.ship.x;
    const dy = y - state.ship.y;
    return Math.sqrt(dx * dx + dy * dy);
}
