// events.js — Turn resolution

export function endTurn(state) {
    // 1. Advance planet orbit
    state.planet.orbitAngle += state.planet.orbitSpeed;

    // 2. Reset ship movement budget
    state.ship.movementBudget = state.ship.movementMax;

    // 3. Increment turn counter
    state.turn++;

    // 4. Fire pending events (stub — no events in Phase 1)
    resolveEvents(state);
}

function resolveEvents(state) {
    // Hook for future event system
}
