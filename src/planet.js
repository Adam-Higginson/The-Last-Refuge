// planet.js — Planet and biome data

const BIOMES = [
    { type: 'Temperate Plains', colour: '#4a7c3f', canColonise: true },
    { type: 'Arctic Wastes', colour: '#b8d4e3', canColonise: true },
    { type: 'Dense Jungle', colour: '#1a5c32', canColonise: true },
    { type: 'Volcanic Highlands', colour: '#8b3a2a', canColonise: true },
    { type: 'Ocean', colour: '#1a3a5c', canColonise: false },
];

export function initPlanet(state) {
    state.planet.regions = generateRegions();
}

function generateRegions() {
    // TODO: Generate Voronoi-style regions with biome assignments
    // For now, return placeholder data
    const regions = [];
    const regionCount = 9;

    for (let i = 0; i < regionCount; i++) {
        const biome = BIOMES[i % BIOMES.length];
        regions.push({
            id: i,
            biome: biome.type,
            colour: biome.colour,
            canColonise: biome.canColonise,
            colonised: false,
            isLandingZone: i === 0, // first temperate plains region
            vertices: [], // populated during Voronoi generation
        });
    }

    return regions;
}

export function getPlanetPosition(state, canvas) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    return {
        x: cx + Math.cos(state.planet.orbitAngle) * state.planet.orbitRadius,
        y: cy + Math.sin(state.planet.orbitAngle) * state.planet.orbitRadius,
    };
}
