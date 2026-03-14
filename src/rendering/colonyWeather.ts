// colonyWeather.ts — Weather system for the colony scene.
// 3 states: Clear, Overcast, Rain. Smooth transitions over 30-60 seconds.
// Weather changes randomly every 5-15 in-game hours.
// Rain does not occur at night — transitions to overcast instead.

import { getGameHour } from './colonyDayNight';
import type { DayNightState } from './colonyDayNight';

export type WeatherState = 'clear' | 'overcast' | 'rain';

export interface WeatherInfo {
    /** Current weather state (what we're transitioning toward). */
    current: WeatherState;
    /** Previous weather state (what we're transitioning from). */
    previous: WeatherState;
    /** Transition progress (0 = fully previous, 1 = fully current). */
    transition: number;
    /** Effective overcast amount (0 = clear sky, 1 = fully overcast). */
    overcastAmount: number;
    /** Effective rain intensity (0 = no rain, 1 = full rain). */
    rainIntensity: number;
    /** Ambient light reduction from weather (0-0.2). */
    ambientReduction: number;
}

/** Real seconds for a weather transition to complete. */
const TRANSITION_DURATION = 45;

/** In-game hours between weather changes (randomised). */
const MIN_CHANGE_INTERVAL = 5;
const MAX_CHANGE_INTERVAL = 15;

let currentWeather: WeatherState = 'clear';
let previousWeather: WeatherState = 'clear';
let transitionProgress = 1; // Start fully transitioned
let nextChangeHour = 8; // First change at 8am
let lastHour = -1;

/** Force cycle to next weather state (debug). */
export function forceNextWeather(): void {
    const cycle: WeatherState[] = ['clear', 'overcast', 'rain'];
    const idx = cycle.indexOf(currentWeather);
    const next = cycle[(idx + 1) % cycle.length];
    previousWeather = currentWeather;
    currentWeather = next;
    transitionProgress = 0;
}

/** Pick a random next weather state. Weighted toward clear. */
function pickNextWeather(currentState: WeatherState, isNight: boolean): WeatherState {
    const roll = Math.random();

    if (isNight) {
        // No rain at night
        if (currentState === 'clear') return roll < 0.3 ? 'overcast' : 'clear';
        return roll < 0.5 ? 'clear' : 'overcast';
    }

    if (currentState === 'clear') {
        if (roll < 0.25) return 'overcast';
        if (roll < 0.35) return 'rain';
        return 'clear';
    }
    if (currentState === 'overcast') {
        if (roll < 0.3) return 'rain';
        if (roll < 0.6) return 'clear';
        return 'overcast';
    }
    // Rain
    if (roll < 0.4) return 'overcast';
    if (roll < 0.7) return 'clear';
    return 'rain';
}

/** Advance the weather system. Call each frame with real-time delta. */
export function advanceWeather(dtSeconds: number, dayNight: DayNightState): void {
    const hour = getGameHour();

    // Progress transition
    if (transitionProgress < 1) {
        transitionProgress += dtSeconds / TRANSITION_DURATION;
        if (transitionProgress > 1) transitionProgress = 1;
    }

    // Check for weather change (compare in-game hours)
    if (lastHour >= 0 && hour < lastHour) {
        // Hour wrapped past midnight — don't trigger
    } else if (hour >= nextChangeHour && transitionProgress >= 1) {
        const isNight = dayNight.phase === 'night';
        const next = pickNextWeather(currentWeather, isNight);

        // If rain at night, force overcast
        const finalNext = (next === 'rain' && isNight) ? 'overcast' : next;

        if (finalNext !== currentWeather) {
            previousWeather = currentWeather;
            currentWeather = finalNext;
            transitionProgress = 0;
        }

        // Schedule next change
        nextChangeHour = hour + MIN_CHANGE_INTERVAL + Math.random() * (MAX_CHANGE_INTERVAL - MIN_CHANGE_INTERVAL);
        if (nextChangeHour >= 24) nextChangeHour -= 24;
    }

    lastHour = hour;
}

/** Get the current weather info with interpolated values. */
export function getWeatherInfo(): WeatherInfo {
    const t = transitionProgress;

    // Interpolate overcast and rain between previous and current
    const prevOvercast = previousWeather === 'clear' ? 0 : previousWeather === 'overcast' ? 0.6 : 0.8;
    const currOvercast = currentWeather === 'clear' ? 0 : currentWeather === 'overcast' ? 0.6 : 0.8;
    const overcastAmount = prevOvercast + (currOvercast - prevOvercast) * t;

    const prevRain = previousWeather === 'rain' ? 1 : 0;
    const currRain = currentWeather === 'rain' ? 1 : 0;
    const rainIntensity = prevRain + (currRain - prevRain) * t;

    const ambientReduction = overcastAmount * 0.2;

    return {
        current: currentWeather,
        previous: previousWeather,
        transition: t,
        overcastAmount,
        rainIntensity,
        ambientReduction,
    };
}

/** Draw weather effects (rain particles, puddle ripples, wet sheen). */
export function drawWeatherEffects(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
): void {
    const weather = getWeatherInfo();

    // Overcast sky darkening
    if (weather.overcastAmount > 0) {
        ctx.save();
        ctx.globalAlpha = weather.overcastAmount * 0.15;
        ctx.fillStyle = '#303040';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    // Rain particles
    if (weather.rainIntensity > 0) {
        drawRain(ctx, w, h, t, weather.rainIntensity);
        drawPuddleRipples(ctx, w, h, t, weather.rainIntensity);
    }
}

function drawRain(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    intensity: number,
): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 200, 220, 0.3)';
    ctx.lineWidth = 1;

    const dropCount = Math.floor(80 * intensity);
    for (let i = 0; i < dropCount; i++) {
        const seed = i * 7.31;
        const speed = 800 + Math.sin(seed) * 200;
        const rx = (Math.sin(seed * 1.3) * 0.5 + 0.5) * w + Math.sin(seed * 0.7) * 30;
        const ry = ((t * speed / 1000 + seed * 50) % (h + 40)) - 20;
        const len = 12 + Math.sin(seed * 2) * 5;

        ctx.globalAlpha = (0.15 + Math.sin(seed) * 0.1) * intensity;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + len);
        ctx.stroke();
    }
    ctx.restore();
}

function drawPuddleRipples(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    intensity: number,
): void {
    const horizonY = h * 0.35;
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 200, 220, 0.15)';
    ctx.lineWidth = 0.5;

    const rippleCount = Math.floor(15 * intensity);
    for (let i = 0; i < rippleCount; i++) {
        const seed = i * 11.7 + 5;
        const rx = (Math.sin(seed * 1.5) * 0.5 + 0.5) * w;
        const ry = horizonY + (Math.sin(seed * 2.1) * 0.5 + 0.5) * (h - horizonY) * 0.8 + (h - horizonY) * 0.1;

        // Ripple expands and fades cyclically
        const cycle = ((t / 1000 + seed * 0.3) % 2);
        if (cycle < 1.5) {
            const rippleR = cycle * 6;
            ctx.globalAlpha = (1 - cycle / 1.5) * 0.2 * intensity;
            ctx.beginPath();
            ctx.ellipse(rx, ry, rippleR, rippleR * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    ctx.restore();
}
