// planets.ts — Planet configuration data for the solar system.
// Each entry defines the physical, orbital, and visual properties of a planet.
// Orbit speeds follow Kepler-ish scaling: speed ∝ 1 / sqrt(radius).

export type PlanetType = 'rocky' | 'gas-giant';

export interface PlanetConfig {
    /** Entity name (camelCase, used for lookups) */
    name: string;
    /** Display name shown in UI */
    displayName: string;
    /** Planet classification */
    type: PlanetType;
    /** Visual body radius in world units */
    radius: number;
    /** Hit radius for hover/click detection */
    hitRadius: number;
    /** Orbital distance from star in world units */
    orbitRadius: number;
    /** Orbital speed in radians per turn */
    orbitSpeed: number;
    /** Whether this planet can be colonised */
    colonisable: boolean;
    /** Number of Voronoi surface regions (rocky planets only) */
    regionCount: number;
    /** Colour palette for system view rendering */
    palette: PlanetPalette;
}

export interface PlanetPalette {
    /** Primary body colour */
    body: string;
    /** Secondary body colour (gradient stop) */
    bodyAlt: string;
    /** Atmospheric glow colour */
    atmosphere: string;
    /** Orbit ring colour */
    orbitRing: string;
}

/** Base orbit speed reference: New Terra at radius 1500 orbits at 0.07 rad/turn */
const BASE_RADIUS = 1500;
const BASE_SPEED = 0.07;

/** Kepler-ish speed: speed = BASE_SPEED * sqrt(BASE_RADIUS / radius) */
function keplerSpeed(radius: number): number {
    return BASE_SPEED * Math.sqrt(BASE_RADIUS / radius);
}

export const PLANET_CONFIGS: readonly PlanetConfig[] = [
    {
        name: 'ember',
        displayName: 'Ember',
        type: 'rocky',
        radius: 30,
        hitRadius: 50,
        orbitRadius: 800,
        orbitSpeed: keplerSpeed(800),
        colonisable: false,
        regionCount: 6,
        palette: {
            body: '#8a2a0a',
            bodyAlt: '#5a1a0a',
            atmosphere: 'rgba(255, 100, 30, 0.12)',
            orbitRing: 'rgba(200, 100, 60, 0.25)',
        },
    },
    {
        name: 'newTerra',
        displayName: 'New Terra',
        type: 'rocky',
        radius: 45,
        hitRadius: 65,
        orbitRadius: 1500,
        orbitSpeed: keplerSpeed(1500),
        colonisable: true,
        regionCount: 8,
        palette: {
            body: '#2a7a6a',
            bodyAlt: '#1a5a7a',
            atmosphere: 'rgba(120, 200, 255, 0.15)',
            orbitRing: 'rgba(90, 140, 220, 0.25)',
        },
    },
    {
        name: 'dust',
        displayName: 'Dust',
        type: 'rocky',
        radius: 35,
        hitRadius: 55,
        orbitRadius: 2400,
        orbitSpeed: keplerSpeed(2400),
        colonisable: false,
        regionCount: 7,
        palette: {
            body: '#9a8a6a',
            bodyAlt: '#6a5a4a',
            atmosphere: 'rgba(180, 160, 120, 0.08)',
            orbitRing: 'rgba(150, 130, 100, 0.25)',
        },
    },
    {
        name: 'goliath',
        displayName: 'Goliath',
        type: 'gas-giant',
        radius: 120,
        hitRadius: 145,
        orbitRadius: 4500,
        orbitSpeed: keplerSpeed(4500),
        colonisable: false,
        regionCount: 0,
        palette: {
            body: '#c8a040',
            bodyAlt: '#8a6a20',
            atmosphere: 'rgba(200, 170, 80, 0.12)',
            orbitRing: 'rgba(180, 150, 80, 0.25)',
        },
    },
    {
        name: 'shepherd',
        displayName: 'Shepherd',
        type: 'gas-giant',
        radius: 90,
        hitRadius: 115,
        orbitRadius: 7200,
        orbitSpeed: keplerSpeed(7200),
        colonisable: false,
        regionCount: 0,
        palette: {
            body: '#4a8a7a',
            bodyAlt: '#2a5a6a',
            atmosphere: 'rgba(100, 180, 160, 0.10)',
            orbitRing: 'rgba(100, 160, 140, 0.25)',
        },
    },
] as const;

/** Get a planet config by entity name */
export function getPlanetConfig(name: string): PlanetConfig | undefined {
    return PLANET_CONFIGS.find(p => p.name === name);
}
