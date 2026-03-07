// renderer.js — All canvas drawing

let canvas, ctx;

export function initRenderer(c, context) {
    canvas = c;
    ctx = context;
}

export function render(state) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (state.phase === 'system') {
        renderSystemMap(state);
    } else if (state.phase === 'planet') {
        renderPlanetView(state);
    }
}

function renderSystemMap(state) {
    // TODO: star field background
    // TODO: star with glow + pulse
    // TODO: planet orbit + planet
    // TODO: ship + movement range
}

function renderPlanetView(state) {
    // TODO: planet surface map with biome regions
    // TODO: region hover/selection
    // TODO: colonise button
}
