// colonyDayNight.ts — Day/night cycle for the colony scene.
// Full cycle completes in 4 real minutes (1 real minute = 6 in-game hours).
// Provides current time of day, sky colours, ambient light, and shadow direction.

/** Cycle speed: how many in-game hours pass per real second. */
export const CYCLE_SPEED = 0.1; // 6 hours per minute = 0.1 hours per second

/** In-game hours (0-24). */
export type GameHour = number;

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export interface DayNightState {
    /** Current in-game hour (0-24, fractional). */
    hour: GameHour;
    /** Current phase. */
    phase: TimeOfDay;
    /** Phase progress (0-1 within current phase). */
    phaseProgress: number;
    /** Sky gradient top colour. */
    skyTop: string;
    /** Sky gradient bottom colour. */
    skyBottom: string;
    /** Ambient light multiplier (0-1, 1 = full daylight). */
    ambientLight: number;
    /** Overall colour temperature shift (-1 = cool blue, 0 = neutral, 1 = warm). */
    warmth: number;
    /** Sun/moon angle in radians (0 = east horizon, PI = west horizon). */
    celestialAngle: number;
    /** Sun/moon vertical position (0 = horizon, 1 = zenith). */
    celestialHeight: number;
    /** Whether stars should be visible (fades in at dusk, out at dawn). */
    starAlpha: number;
    /** Shadow direction angle in radians. */
    shadowAngle: number;
    /** Shadow length multiplier (long at dawn/dusk, short at noon). */
    shadowLength: number;
}

// --- Phase boundaries ---
const DAWN_START = 5;
const DAWN_END = 7;
const DAY_END = 17;
const DUSK_END = 20;
// Night: 20-5

// --- Sky colour keyframes ---
interface SkyKeyframe {
    hour: number;
    top: [number, number, number];
    bottom: [number, number, number];
    ambient: number;
    warmth: number;
}

const SKY_KEYFRAMES: SkyKeyframe[] = [
    { hour: 0,    top: [8, 12, 30],      bottom: [15, 20, 40],     ambient: 0.08, warmth: -0.8 },
    { hour: 5,    top: [20, 25, 60],      bottom: [40, 35, 60],     ambient: 0.15, warmth: -0.5 },
    { hour: 5.5,  top: [60, 40, 80],      bottom: [180, 100, 80],   ambient: 0.3,  warmth: 0.3 },
    { hour: 6.5,  top: [120, 80, 60],     bottom: [220, 170, 120],  ambient: 0.6,  warmth: 0.7 },
    { hour: 7.5,  top: [80, 140, 200],    bottom: [180, 210, 230],  ambient: 0.85, warmth: 0.2 },
    { hour: 12,   top: [70, 135, 200],    bottom: [170, 205, 230],  ambient: 1.0,  warmth: 0.0 },
    { hour: 16,   top: [80, 130, 190],    bottom: [180, 200, 220],  ambient: 0.9,  warmth: 0.1 },
    { hour: 17.5, top: [140, 100, 70],    bottom: [230, 150, 80],   ambient: 0.7,  warmth: 0.8 },
    { hour: 18.5, top: [100, 50, 50],     bottom: [200, 100, 60],   ambient: 0.4,  warmth: 0.6 },
    { hour: 19.5, top: [40, 30, 60],      bottom: [80, 50, 60],     ambient: 0.2,  warmth: -0.3 },
    { hour: 20.5, top: [15, 18, 40],      bottom: [25, 25, 45],     ambient: 0.1,  warmth: -0.7 },
    { hour: 24,   top: [8, 12, 30],       bottom: [15, 20, 40],     ambient: 0.08, warmth: -0.8 },
];

function lerpColour(a: [number, number, number], b: [number, number, number], t: number): string {
    const r = Math.round(a[0] + (b[0] - a[0]) * t);
    const g = Math.round(a[1] + (b[1] - a[1]) * t);
    const bl = Math.round(a[2] + (b[2] - a[2]) * t);
    return `rgb(${r}, ${g}, ${bl})`;
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/** Global time accumulator (in-game hours). Persists across frames. */
let gameHour = 10.0; // Start at 10am (pleasant daytime)

/** Get the current in-game hour. */
export function getGameHour(): GameHour {
    return gameHour;
}

/** Set the game hour directly (for testing/debugging). */
export function setGameHour(hour: GameHour): void {
    gameHour = ((hour % 24) + 24) % 24;
}

/** Advance the clock by real-time delta (seconds). */
export function advanceClock(dtSeconds: number): void {
    gameHour += dtSeconds * CYCLE_SPEED;
    gameHour = gameHour % 24;
}

/** Compute the full day/night state for the current time. */
export function getDayNightState(): DayNightState {
    const hour = gameHour;

    // Determine phase
    let phase: TimeOfDay;
    let phaseProgress: number;

    if (hour >= DAWN_START && hour < DAWN_END) {
        phase = 'dawn';
        phaseProgress = (hour - DAWN_START) / (DAWN_END - DAWN_START);
    } else if (hour >= DAWN_END && hour < DAY_END) {
        phase = 'day';
        phaseProgress = (hour - DAWN_END) / (DAY_END - DAWN_END);
    } else if (hour >= DAY_END && hour < DUSK_END) {
        phase = 'dusk';
        phaseProgress = (hour - DAY_END) / (DUSK_END - DAY_END);
    } else {
        phase = 'night';
        if (hour >= DUSK_END) {
            phaseProgress = (hour - DUSK_END) / (24 - DUSK_END + DAWN_START);
        } else {
            phaseProgress = (hour + 24 - DUSK_END) / (24 - DUSK_END + DAWN_START);
        }
    }

    // Interpolate sky colours from keyframes
    let skyTop = 'rgb(8, 12, 30)';
    let skyBottom = 'rgb(15, 20, 40)';
    let ambient = 0.08;
    let warmth = -0.8;

    for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
        const a = SKY_KEYFRAMES[i];
        const b = SKY_KEYFRAMES[i + 1];
        if (hour >= a.hour && hour < b.hour) {
            const t = (hour - a.hour) / (b.hour - a.hour);
            skyTop = lerpColour(a.top, b.top, t);
            skyBottom = lerpColour(a.bottom, b.bottom, t);
            ambient = lerp(a.ambient, b.ambient, t);
            warmth = lerp(a.warmth, b.warmth, t);
            break;
        }
    }

    // Celestial body position
    // Sun arc: rises at 5am (east horizon), peaks at noon (zenith), sets at 19:00 (west horizon)
    // Normalized: 0 at sunrise, 0.5 at noon, 1 at sunset
    const sunRise = 5;
    const sunSet = 19;
    const sunDuration = sunSet - sunRise;
    const sunNorm = (hour - sunRise) / sunDuration; // 0 at rise, 1 at set
    const celestialAngle = sunNorm * Math.PI; // 0 = east, PI = west
    // Height follows sine arc: 0 at horizons, 1 at zenith, negative when below
    const celestialHeight = Math.sin(sunNorm * Math.PI);

    // Stars fade in at dusk, out at dawn
    let starAlpha = 0;
    if (hour >= 19 && hour < 20) starAlpha = (hour - 19);
    else if (hour >= 20 || hour < 5) starAlpha = 1;
    else if (hour >= 5 && hour < 6) starAlpha = 1 - (hour - 5);

    // Shadow direction (opposite of sun)
    const shadowAngle = celestialAngle + Math.PI;
    // Shadow length: long at dawn/dusk, short at noon
    const noonDist = Math.abs(hour - 12);
    const shadowLength = 0.3 + Math.min(noonDist / 6, 1) * 0.7;

    return {
        hour,
        phase,
        phaseProgress,
        skyTop,
        skyBottom,
        ambientLight: ambient,
        warmth,
        celestialAngle,
        celestialHeight,
        starAlpha,
        shadowAngle,
        shadowLength,
    };
}
