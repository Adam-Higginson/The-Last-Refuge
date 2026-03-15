// colonyWeather.ts — Weather system for the colony scene.
// 3 states: Clear, Overcast, Rain. Smooth transitions.
// Rain has 3 depth layers, organic clouds, ground puddles, mist, lightning.

import { getGameHour } from './colonyDayNight';
import type { DayNightState } from './colonyDayNight';

export type WeatherState = 'clear' | 'overcast' | 'rain';

export interface WeatherInfo {
    current: WeatherState;
    previous: WeatherState;
    transition: number;
    overcastAmount: number;
    rainIntensity: number;
    ambientReduction: number;
    /** Current wind angle offset in radians (gusts). */
    windAngle: number;
    /** Wind intensity (0 = calm, 1 = gusting). */
    windIntensity: number;
}

const TRANSITION_DURATION = 45;
const MIN_CHANGE_INTERVAL = 5;
const MAX_CHANGE_INTERVAL = 15;

let currentWeather: WeatherState = 'clear';
let previousWeather: WeatherState = 'clear';
let transitionProgress = 1;
let nextChangeHour = 8;
let lastHour = -1;

// Wind gusting
let windAngle = 0.15; // Base wind angle (radians, slight lean)
let windTarget = 0.15;
let windIntensity = 0;
let nextGustTime = 0;

/** Force cycle to next weather state (debug). */
export function forceNextWeather(): void {
    const cycle: WeatherState[] = ['clear', 'overcast', 'rain'];
    const idx = cycle.indexOf(currentWeather);
    const next = cycle[(idx + 1) % cycle.length];
    previousWeather = currentWeather;
    currentWeather = next;
    transitionProgress = 0;
}

function pickNextWeather(currentState: WeatherState, isNight: boolean): WeatherState {
    const roll = Math.random();
    if (isNight) {
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
    if (roll < 0.4) return 'overcast';
    if (roll < 0.7) return 'clear';
    return 'rain';
}

export function advanceWeather(dtSeconds: number, dayNight: DayNightState): void {
    const hour = getGameHour();
    const t = performance.now() / 1000;

    if (transitionProgress < 1) {
        transitionProgress += dtSeconds / TRANSITION_DURATION;
        if (transitionProgress > 1) transitionProgress = 1;
    }

    if (lastHour >= 0 && hour < lastHour) { /* midnight wrap */ }
    else if (hour >= nextChangeHour && transitionProgress >= 1) {
        const isNight = dayNight.phase === 'night';
        const next = pickNextWeather(currentWeather, isNight);
        const finalNext = (next === 'rain' && isNight) ? 'overcast' : next;
        if (finalNext !== currentWeather) {
            previousWeather = currentWeather;
            currentWeather = finalNext;
            transitionProgress = 0;
        }
        nextChangeHour = hour + MIN_CHANGE_INTERVAL + Math.random() * (MAX_CHANGE_INTERVAL - MIN_CHANGE_INTERVAL);
        if (nextChangeHour >= 24) nextChangeHour -= 24;
    }
    lastHour = hour;

    // Wind gusting
    if (t > nextGustTime && currentWeather === 'rain') {
        windTarget = 0.25 + Math.random() * 0.15;
        windIntensity = 0.7 + Math.random() * 0.3;
        nextGustTime = t + 8 + Math.random() * 15;
        // Gust decays after 2-3 seconds
        setTimeout(() => {
            windTarget = 0.15;
            windIntensity = 0;
        }, 2000 + Math.random() * 1000);
    }
    windAngle += (windTarget - windAngle) * Math.min(1, dtSeconds * 3);
}

export function getWeatherInfo(): WeatherInfo {
    const t = transitionProgress;
    const prevOvercast = previousWeather === 'clear' ? 0 : previousWeather === 'overcast' ? 0.6 : 0.85;
    const currOvercast = currentWeather === 'clear' ? 0 : currentWeather === 'overcast' ? 0.6 : 0.85;
    const overcastAmount = prevOvercast + (currOvercast - prevOvercast) * t;
    const prevRain = previousWeather === 'rain' ? 1 : 0;
    const currRain = currentWeather === 'rain' ? 1 : 0;
    const rainIntensity = prevRain + (currRain - prevRain) * t;
    const ambientReduction = overcastAmount * 0.25;

    return {
        current: currentWeather,
        previous: previousWeather,
        transition: t,
        overcastAmount,
        rainIntensity,
        ambientReduction,
        windAngle,
        windIntensity,
    };
}

// =========================================================================
// RENDERING
// =========================================================================

export function drawWeatherEffects(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
): void {
    const weather = getWeatherInfo();

    if (weather.overcastAmount > 0) {
        drawOvercastSky(ctx, w, h, t, weather);
    }
    if (weather.rainIntensity > 0) {
        drawRainLayers(ctx, w, h, t, weather);
        drawGroundPuddles(ctx, w, h, t, weather.rainIntensity);
        drawRainMist(ctx, w, h, weather.rainIntensity);
        drawLightning(ctx, w, h, t, weather.rainIntensity);
    }
}

// --- Overcast sky ---

function drawOvercastSky(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    weather: WeatherInfo,
): void {
    const horizonY = h * 0.2;

    // Sky darkening
    ctx.save();
    ctx.globalAlpha = weather.overcastAmount * 0.4;
    ctx.fillStyle = '#1a1a25';
    ctx.fillRect(0, 0, w, horizonY + 10);
    ctx.globalAlpha = weather.overcastAmount * 0.12;
    ctx.fillRect(0, horizonY, w, h - horizonY);
    ctx.restore();

    // Blue-grey-green tint (classic overcast light)
    ctx.save();
    ctx.globalAlpha = weather.overcastAmount * 0.08;
    ctx.fillStyle = 'rgba(70, 90, 85, 1)';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Overcast clouds — lighter grey, wispy, spread out, soft edges
    ctx.save();

    // Main cloud layer — wide, soft, lighter grey
    for (let i = 0; i < 12; i++) {
        const speed = 0.0015 + (i % 3) * 0.0008;
        const baseX = ((t * speed + i * w * 0.1) % (w + 400)) - 200;
        const baseY = horizonY * (0.02 + (i % 5) * 0.06);

        // Each cloud is a spread of soft overlapping ellipses
        const puffs = 5 + (i % 3);
        for (let c = 0; c < puffs; c++) {
            const cx = baseX + c * 35 - puffs * 17;
            const cy = baseY + Math.sin(i + c * 1.3) * 6;
            const rw = 50 + Math.sin(i * 2.7 + c) * 25;
            const rh = 14 + Math.sin(i * 1.5 + c) * 6;

            // Lighter at top, slightly darker at base — all in grey range
            const shade = Math.floor(120 + (1 - cy / (horizonY * 0.35)) * 40);
            ctx.globalAlpha = weather.overcastAmount * (0.12 + Math.sin(i + c) * 0.04);
            ctx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 6})`;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Wispy streaks — thinner, faster, more transparent
    for (let i = 0; i < 8; i++) {
        const speed = 0.004 + i * 0.0015;
        const baseX = ((t * speed + i * w * 0.15 + 300) % (w + 300)) - 150;
        const baseY = horizonY * (0.15 + i * 0.04);
        ctx.globalAlpha = weather.overcastAmount * 0.06;
        ctx.fillStyle = 'rgb(140, 145, 155)';
        ctx.beginPath();
        ctx.ellipse(baseX, baseY, 80 + i * 12, 5 + i * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// --- 3-layer rain ---

function drawRainLayers(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    weather: WeatherInfo,
): void {
    const angle = weather.windAngle;
    const intensity = weather.rainIntensity;

    // Screen-wide rain desaturation overlay
    ctx.save();
    ctx.globalAlpha = intensity * 0.06;
    ctx.fillStyle = 'rgba(60, 80, 110, 1)';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Far layer — faint, small, slow
    drawRainLayer(ctx, w, h, t, {
        count: Math.floor(60 * intensity),
        speed: 600,
        length: 8,
        width: 0.5,
        alpha: 0.12 * intensity,
        angle,
        colour: 'rgba(150, 170, 200, 1)',
    });

    // Mid layer
    drawRainLayer(ctx, w, h, t, {
        count: Math.floor(120 * intensity),
        speed: 1000,
        length: 14,
        width: 1,
        alpha: 0.22 * intensity,
        angle,
        colour: 'rgba(170, 190, 215, 1)',
    });

    // Near layer — larger, faster, brighter
    drawRainLayer(ctx, w, h, t, {
        count: Math.floor(80 * intensity),
        speed: 1500,
        length: 22,
        width: 1.8,
        alpha: 0.3 * intensity,
        angle,
        colour: 'rgba(190, 210, 230, 1)',
    });
}

interface RainLayerConfig {
    count: number;
    speed: number;
    length: number;
    width: number;
    alpha: number;
    angle: number;
    colour: string;
}

function drawRainLayer(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    cfg: RainLayerConfig,
): void {
    ctx.save();
    ctx.strokeStyle = cfg.colour;
    ctx.lineCap = 'round';

    for (let i = 0; i < cfg.count; i++) {
        const seed = i * 7.31 + cfg.speed;
        const baseSpeed = cfg.speed + Math.sin(seed * 0.3) * cfg.speed * 0.2;
        const rx = (Math.sin(seed * 1.3) * 0.5 + 0.5) * (w + 80) - 40;
        const ry = ((t * baseSpeed / 1000 + seed * 40) % (h + 60)) - 30;
        const len = cfg.length + Math.sin(seed * 2) * cfg.length * 0.3;
        const dx = Math.sin(cfg.angle) * len;
        const dy = Math.cos(cfg.angle) * len;

        ctx.globalAlpha = cfg.alpha + Math.sin(seed * 3.7) * cfg.alpha * 0.3;
        ctx.lineWidth = cfg.width + Math.sin(seed * 1.7) * cfg.width * 0.2;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + dx, ry + dy);
        ctx.stroke();
    }
    ctx.restore();
}

// --- Ground puddles ---

function drawGroundPuddles(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    intensity: number,
): void {
    const horizonY = h * 0.2;
    const groundH = h - horizonY;

    // Wet ground sheen
    ctx.save();
    ctx.globalAlpha = intensity * 0.08;
    const sheenGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    sheenGrad.addColorStop(0, 'rgba(100, 130, 160, 0.5)');
    sheenGrad.addColorStop(1, 'rgba(60, 80, 100, 0.3)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, horizonY, w, groundH);
    ctx.restore();

    // 4 puddle shapes
    ctx.save();
    for (let i = 0; i < 4; i++) {
        const seed = i * 17.3 + 5;
        const px = (Math.sin(seed * 1.1) * 0.5 + 0.5) * w * 0.8 + w * 0.1;
        const py = horizonY + (0.3 + Math.sin(seed * 1.7) * 0.3) * groundH;
        const pw = 25 + Math.sin(seed) * 15;
        const ph = pw * 0.35;

        // Puddle — reflective
        ctx.globalAlpha = intensity * 0.2;
        ctx.fillStyle = 'rgba(80, 110, 140, 0.6)';
        ctx.beginPath();
        ctx.ellipse(px, py, pw, ph, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sky reflection in puddle
        ctx.globalAlpha = intensity * 0.08;
        ctx.fillStyle = 'rgba(120, 140, 170, 0.5)';
        ctx.beginPath();
        ctx.ellipse(px, py - ph * 0.2, pw * 0.6, ph * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Ripple rings on puddle
        for (let r = 0; r < 3; r++) {
            const cycle = ((t / 800 + seed * 0.3 + r * 0.7) % 2);
            if (cycle < 1.2) {
                const rippleR = cycle * pw * 0.4;
                ctx.globalAlpha = (1 - cycle / 1.2) * 0.25 * intensity;
                ctx.strokeStyle = 'rgba(180, 200, 220, 0.6)';
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.ellipse(
                    px + Math.sin(seed + r * 3) * pw * 0.3,
                    py + Math.sin(seed + r * 2) * ph * 0.3,
                    rippleR,
                    rippleR * 0.35,
                    0, 0, Math.PI * 2,
                );
                ctx.stroke();
            }
        }
    }

    // Scattered ground splash ripples
    ctx.strokeStyle = 'rgba(180, 200, 220, 0.3)';
    ctx.lineWidth = 0.6;
    for (let i = 0; i < Math.floor(20 * intensity); i++) {
        const seed = i * 13.7 + 99;
        const rx = (Math.sin(seed * 1.5) * 0.5 + 0.5) * w;
        const ry = horizonY + (Math.sin(seed * 2.1) * 0.5 + 0.5) * groundH * 0.85 + groundH * 0.1;
        const cycle = ((t / 600 + seed * 0.2) % 1.5);
        if (cycle < 1) {
            const rippleR = cycle * 5;
            ctx.globalAlpha = (1 - cycle) * 0.2 * intensity;
            ctx.beginPath();
            ctx.ellipse(rx, ry, rippleR, rippleR * 0.35, 0, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    ctx.restore();
}

// --- Rain mist near ground ---

function drawRainMist(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    intensity: number,
): void {
    const horizonY = h * 0.2;
    ctx.save();
    ctx.globalAlpha = intensity * 0.15;
    const mistGrad = ctx.createLinearGradient(0, horizonY, 0, horizonY + h * 0.15);
    mistGrad.addColorStop(0, 'rgba(150, 160, 180, 0.6)');
    mistGrad.addColorStop(1, 'rgba(150, 160, 180, 0)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, horizonY, w, h * 0.15);
    ctx.restore();
}

// --- Lightning ---

let lastLightningTime = 0;
let lightningAlpha = 0;

function drawLightning(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    t: number,
    intensity: number,
): void {
    // Trigger lightning every 30-90 seconds during rain
    if (t - lastLightningTime > (30000 + Math.random() * 60000) && intensity > 0.5) {
        lastLightningTime = t;
        lightningAlpha = 0.3;
    }

    if (lightningAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = lightningAlpha;
        ctx.fillStyle = '#e0e8ff';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
        lightningAlpha *= 0.85; // Rapid decay
        if (lightningAlpha < 0.01) lightningAlpha = 0;
    }
}
