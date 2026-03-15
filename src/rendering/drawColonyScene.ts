// drawColonyScene.ts — Isometric colony scene renderer.
// Draws biome-specific sky, isometric terrain grid, buildings, colonists.

import { ServiceLocator } from '../core/ServiceLocator';
import { RegionDataComponent } from '../components/RegionDataComponent';
import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { getBuildingType } from '../data/buildings';
import { getCrewAtColony } from '../utils/crewUtils';
import { drawBuilding } from './colonyBuildingSprites';
import { drawSettlementProps, drawMicroDetails } from './colonyProps';
import { drawParticles } from './colonyParticles';
import { drawCrewSprites } from './colonyCrewSprites';
import { advanceClock, getDayNightState, setGameHour, getGameHour } from './colonyDayNight';
import { advanceWeather, drawWeatherEffects, getWeatherInfo, forceNextWeather } from './colonyWeather';
import type { WeatherInfo } from './colonyWeather';
import type { DayNightState } from './colonyDayNight';
import {
    gridToScreen,
    drawIsometricTile,
    getSlotGridPositions,
    TILE_WIDTH,
    TILE_HEIGHT,
    COLONY_ZOOM,
} from './isometric';
import type { Region } from '../components/RegionDataComponent';
import type { BiomeName } from '../data/biomes';
import type { Entity } from '../core/Entity';
import type { World } from '../core/World';

/** Slot rectangle for hit-testing. */
export interface ColonySlotRect {
    slotIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    occupied: boolean;
}

// --- Biome visual configs ---

interface BiomeVisuals {
    skyTop: string;
    skyBottom: string;
    skyHaze: string;
    groundBase: string;
    groundDark: string;
    groundLight: string;
    horizonFeature: 'mountains' | 'trees' | 'volcanoes' | 'none';
    starTint: string;
    particleColour: string;
    particleType: 'pollen' | 'snow' | 'embers' | 'fireflies';
    dressing: 'grass' | 'ice' | 'ferns' | 'rocks';
}

const BIOME_VISUALS: Partial<Record<BiomeName, BiomeVisuals>> = {
    'Temperate Plains': {
        skyTop: '#4a8ac0', skyBottom: '#c8d8e8', skyHaze: 'rgba(200,220,240,0.3)',
        groundBase: '#4a7a3a', groundDark: '#3a6a2a', groundLight: '#5a8a4a',
        horizonFeature: 'trees', starTint: 'rgba(255, 220, 150, 0.25)',
        particleColour: 'rgba(255,255,200,0.4)', particleType: 'pollen',
        dressing: 'grass',
    },
    'Arctic Wastes': {
        skyTop: '#5a7a90', skyBottom: '#b0c0d0', skyHaze: 'rgba(200,210,220,0.4)',
        groundBase: '#b8c8d8', groundDark: '#a0b0c0', groundLight: '#c8d8e8',
        horizonFeature: 'mountains', starTint: 'rgba(255, 240, 200, 0.15)',
        particleColour: 'rgba(255,255,255,0.6)', particleType: 'snow',
        dressing: 'ice',
    },
    'Dense Jungle': {
        skyTop: '#3a6a5a', skyBottom: '#8aaa7a', skyHaze: 'rgba(100,150,100,0.3)',
        groundBase: '#2a5a2a', groundDark: '#1a4a1a', groundLight: '#3a6a3a',
        horizonFeature: 'trees', starTint: 'rgba(255, 200, 100, 0.2)',
        particleColour: 'rgba(150,255,100,0.3)', particleType: 'fireflies',
        dressing: 'ferns',
    },
    'Volcanic Highlands': {
        skyTop: '#4a2a1a', skyBottom: '#8a5a3a', skyHaze: 'rgba(100,50,20,0.3)',
        groundBase: '#3a2a2a', groundDark: '#2a1a1a', groundLight: '#4a3a2a',
        horizonFeature: 'volcanoes', starTint: 'rgba(255, 150, 50, 0.3)',
        particleColour: 'rgba(255,120,30,0.5)', particleType: 'embers',
        dressing: 'rocks',
    },
};

const DEFAULT_VISUALS: BiomeVisuals = {
    skyTop: '#4a8ac0', skyBottom: '#c8d8e8', skyHaze: 'rgba(200,220,240,0.3)',
    groundBase: '#5a7a4a', groundDark: '#4a6a3a', groundLight: '#6a8a5a',
    horizonFeature: 'none', starTint: 'rgba(255, 220, 150, 0.2)',
    particleColour: 'rgba(255,255,200,0.3)', particleType: 'pollen',
    dressing: 'grass',
};

function getVisuals(biome: BiomeName): BiomeVisuals {
    return BIOME_VISUALS[biome] ?? DEFAULT_VISUALS;
}

/** Last frame timestamp for delta time calculation. */
let lastFrameTime = 0;

/** Gust state shared between ground and grass. */
let _lastGustX = -1;
let _lastGustActive = false;

/** Debug keyboard handler (W = cycle weather, T = advance time 3 hours). */
let debugKeysRegistered = false;
function registerDebugKeys(): void {
    if (debugKeysRegistered) return;
    debugKeysRegistered = true;
    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.code === 'KeyW' && !e.ctrlKey && !e.metaKey) {
            forceNextWeather();
        }
        if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey) {
            setGameHour(getGameHour() + 3);
        }
    });
}

// --- Main draw function ---

export function drawColonyScene(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    regionId: number,
): ColonySlotRect[] {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
    const regionData = entity.getComponent(RegionDataComponent);
    if (!regionData) return [];

    const region = regionData.regions.find(r => r.id === regionId);
    if (!region) return [];

    registerDebugKeys();

    const w = canvas.width;
    const h = canvas.height;
    const t = performance.now();
    const visuals = getVisuals(region.biome);
    const horizonY = h * 0.25;

    // Compute frame delta and advance systems
    const now = performance.now();
    const dtSeconds = lastFrameTime > 0 ? (now - lastFrameTime) / 1000 : 0;
    lastFrameTime = now;

    advanceClock(dtSeconds);
    const dayNight = getDayNightState();
    advanceWeather(Math.min(dtSeconds, 0.1), dayNight);

    const weather = getWeatherInfo();

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Sky renders at 1x (no zoom)
    drawSky(ctx, w, h, horizonY, visuals, t, dayNight, weather);
    drawStars(ctx, w, horizonY, dayNight);
    drawHorizonFeatures(ctx, w, horizonY, visuals, region.id);

    // Ground-level content zoomed in — scale around colony centre
    const groundCentreX = w / 2;
    const groundCentreY = horizonY + (h - horizonY) * 0.38;
    ctx.save();
    ctx.translate(groundCentreX, groundCentreY);
    ctx.scale(COLONY_ZOOM, COLONY_ZOOM);
    ctx.translate(-groundCentreX, -groundCentreY);

    drawNaturalGround(ctx, w, h, horizonY, visuals, region.id);
    drawTerrainUndulation(ctx, w, h, horizonY, visuals, region.id);
    drawGroundDressing(ctx, w, h, horizonY, visuals, region.id);
    drawMidgroundScenery(ctx, w, h, horizonY, visuals, region.id, t);
    drawPaths(ctx, w, h, region);
    const slotRects = drawBuildingSlots(ctx, w, h, region, t);
    drawBuildingShadows(ctx, region, slotRects, dayNight);
    drawMicroDetails(ctx, w, h, region, t, slotRects);
    drawSettlementProps(ctx, region, slotRects, t);
    drawCrewOnSurface(ctx, entity, region, slotRects, t, dtSeconds);
    drawParticles(ctx, dtSeconds);

    ctx.restore(); // Back to 1x for overlays

    drawAmbientParticles(ctx, w, h, visuals, t);
    drawForegroundTrees(ctx, w, h, visuals, region.id, t);
    drawAmbientOverlay(ctx, w, h, dayNight);

    // Weather effects drawn AFTER ambient overlay so rain is visible on dark nights
    drawWeatherEffects(ctx, w, h, t);
    drawColonyLabel(ctx, w, region);
    drawTimeIndicator(ctx, w, dayNight, weather);

    return slotRects;
}

// --- Sky ---

function drawSky(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    _visuals: BiomeVisuals,
    t: number,
    dayNight: DayNightState,
    weather: WeatherInfo,
): void {
    // Sky gradient driven by day/night cycle
    const grad = ctx.createLinearGradient(0, 0, 0, horizonY + 10);
    grad.addColorStop(0, dayNight.skyTop);
    grad.addColorStop(0.8, dayNight.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, horizonY + 10);

    // Atmospheric haze near horizon (warmer during dawn/dusk)
    const hazeAlpha = dayNight.phase === 'dawn' || dayNight.phase === 'dusk' ? 0.25 : 0.12;
    const hazeGrad = ctx.createLinearGradient(0, horizonY - h * 0.1, 0, horizonY + 10);
    hazeGrad.addColorStop(0, 'rgba(0,0,0,0)');
    hazeGrad.addColorStop(1, `rgba(${dayNight.warmth > 0 ? '200,150,100' : '100,120,150'}, ${hazeAlpha})`);
    ctx.fillStyle = hazeGrad;
    ctx.fillRect(0, horizonY - h * 0.1, w, h * 0.1 + 10);

    // Sun/moon — dimmed by overcast
    const sunProgress = Math.max(0, Math.min(1, dayNight.celestialAngle / Math.PI));
    const sunX = w * (0.1 + sunProgress * 0.8);
    const sunY = horizonY - dayNight.celestialHeight * horizonY * 0.75;
    const pulse = 0.85 + 0.15 * Math.sin(t / 3000);
    const weatherDim = 1 - weather.overcastAmount * 1.2; // Sun fully hidden at ~80% overcast

    // Only render if not too far below horizon and not fully overcast
    if (dayNight.celestialHeight > -0.15 && weatherDim > 0.05) {
        const sunR = dayNight.phase === 'night' ? w * 0.03 : w * 0.05;

        // Fade out as it dips below horizon
        const horizonFade = dayNight.celestialHeight < 0
            ? 1 + dayNight.celestialHeight / 0.15
            : 1;

        if (dayNight.phase === 'night') {
            // Moon — arc across top of sky
            const moonNorm = ((dayNight.hour - 20) / 9 + 1) % 1; // 0 at 20:00, 1 at 05:00
            const moonX = w * (0.15 + moonNorm * 0.7);
            const moonY = horizonY * (0.6 - Math.sin(moonNorm * Math.PI) * 0.45);
            ctx.save();
            ctx.globalAlpha = dayNight.starAlpha * 0.7;
            ctx.fillStyle = 'rgba(200, 210, 230, 1)';
            ctx.beginPath();
            ctx.arc(moonX, moonY, sunR, 0, Math.PI * 2);
            ctx.fill();
            // Moon glow
            const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, sunR * 4);
            moonGlow.addColorStop(0, 'rgba(200, 210, 230, 0.1)');
            moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = moonGlow;
            ctx.beginPath();
            ctx.arc(moonX, moonY, sunR * 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            // Sun — warm glow with bloom, fades behind clouds and below horizon
            ctx.save();
            ctx.globalAlpha = horizonFade * weatherDim;
            const bloomR = sunR * 3;
            const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, bloomR);

            if (dayNight.phase === 'dawn' || dayNight.phase === 'dusk') {
                // Intense warm bloom at dawn/dusk
                sunGlow.addColorStop(0, `rgba(255, 220, 150, ${(0.8 * pulse).toFixed(2)})`);
                sunGlow.addColorStop(0.2, `rgba(255, 180, 80, ${(0.4 * pulse).toFixed(2)})`);
                sunGlow.addColorStop(0.5, `rgba(255, 140, 50, ${(0.15 * pulse).toFixed(2)})`);
            } else {
                // Bright white-yellow during day
                sunGlow.addColorStop(0, `rgba(255, 250, 230, ${(0.9 * pulse).toFixed(2)})`);
                sunGlow.addColorStop(0.15, `rgba(255, 240, 200, ${(0.5 * pulse).toFixed(2)})`);
                sunGlow.addColorStop(0.4, `rgba(255, 220, 150, ${(0.15 * pulse).toFixed(2)})`);
            }
            sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = sunGlow;
            ctx.beginPath();
            ctx.arc(sunX, sunY, bloomR, 0, Math.PI * 2);
            ctx.fill();

            // Solid sun core
            ctx.fillStyle = `rgba(255, 250, 235, ${(0.95 * pulse).toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(sunX, sunY, sunR * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Drifting clouds (tinted by time of day)
    drawClouds(ctx, w, horizonY, t, dayNight);
}

function drawClouds(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    t: number,
    dayNight: DayNightState,
): void {
    ctx.save();

    // Cloud colour shifts with time of day
    let cloudColour: string;
    if (dayNight.phase === 'dawn' || dayNight.phase === 'dusk') {
        cloudColour = 'rgba(255, 180, 120, 0.8)';
    } else if (dayNight.phase === 'night') {
        cloudColour = 'rgba(30, 35, 50, 0.6)';
    } else {
        cloudColour = 'rgba(255, 255, 255, 0.8)';
    }

    ctx.fillStyle = cloudColour;
    ctx.globalAlpha = dayNight.phase === 'night' ? 0.1 : 0.18;

    // Three cloud layers at different speeds
    for (let layer = 0; layer < 3; layer++) {
        const layerAlpha = (0.12 - layer * 0.03);
        ctx.globalAlpha = layerAlpha;

        for (let i = 0; i < 3; i++) {
            const speed = (0.006 + layer * 0.004) + i * 0.002;
            const baseX = ((t * speed + i * w * 0.35 + layer * w * 0.15) % (w + 300)) - 150;
            const baseY = horizonY * (0.15 + layer * 0.15 + i * 0.08);
            const cloudW = (100 + i * 40 - layer * 15);
            const cloudH = (18 + i * 6 - layer * 3);

            ctx.beginPath();
            ctx.ellipse(baseX, baseY, cloudW, cloudH, 0, 0, Math.PI * 2);
            ctx.ellipse(baseX + cloudW * 0.3, baseY - cloudH * 0.4, cloudW * 0.7, cloudH * 0.9, 0, 0, Math.PI * 2);
            ctx.ellipse(baseX - cloudW * 0.25, baseY + cloudH * 0.2, cloudW * 0.5, cloudH * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}

// --- Stars ---

function drawStars(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    dayNight: DayNightState,
): void {
    if (dayNight.starAlpha <= 0) return;

    ctx.save();
    ctx.fillStyle = '#ffffff';

    for (let i = 0; i < 60; i++) {
        const sx = (Math.sin(i * 7.13 + 0.5) * 0.5 + 0.5) * w;
        const sy = (Math.sin(i * 3.71 + 1.2) * 0.5 + 0.5) * horizonY * 0.85;
        const size = 0.5 + Math.abs(Math.sin(i * 2.37)) * 1.2;
        const twinkle = 0.5 + 0.5 * Math.sin(performance.now() / 1000 + i * 1.7);

        ctx.globalAlpha = dayNight.starAlpha * twinkle * 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// --- 3-layer parallax background with time-of-day reaction ---

function drawHorizonFeatures(
    ctx: CanvasRenderingContext2D,
    w: number,
    horizonY: number,
    visuals: BiomeVisuals,
    seed: number,
): void {
    const dayNight = getDayNightState();
    const isNight = dayNight.phase === 'night';
    const isDuskDawn = dayNight.phase === 'dusk' || dayNight.phase === 'dawn';

    // --- Layer 1: Far misty mountains (most hazy, least detail) ---
    ctx.save();
    // Fog increases at night and in distance
    const farAlpha = isNight ? 0.06 : isDuskDawn ? 0.1 : 0.14;
    ctx.globalAlpha = farAlpha;
    ctx.fillStyle = isNight ? '#0a0a15' : isDuskDawn ? '#4a3a3a' : visuals.groundDark;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= w; x += 3) {
        const hillY = horizonY - 20
            - Math.sin(x / 250 + seed * 0.7) * 25
            - Math.sin(x / 90 + seed * 1.3) * 10
            - Math.abs(Math.sin(x / 400 + seed * 0.3)) * 35;
        ctx.lineTo(x, hillY);
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();

    // Mountain peaks on far layer
    if (visuals.horizonFeature === 'mountains' || visuals.horizonFeature === 'volcanoes') {
        for (let i = 0; i < 5; i++) {
            const cx = (i + 0.4) * w / 5 + Math.sin(seed + i * 4.1) * w * 0.04;
            const peakH = horizonY * (0.15 + Math.abs(Math.sin(seed * 1.5 + i * 2.7)) * 0.2);
            const baseW = w / 5 * 1.5;
            ctx.beginPath();
            ctx.moveTo(cx - baseW / 2, horizonY);
            ctx.quadraticCurveTo(cx - baseW * 0.12, horizonY - peakH * 0.8, cx, horizonY - peakH);
            ctx.quadraticCurveTo(cx + baseW * 0.12, horizonY - peakH * 0.8, cx + baseW / 2, horizonY);
            ctx.closePath();
            ctx.fill();
        }
    }
    ctx.restore();

    // --- Layer 2: Mid tree line / ridgeline ---
    ctx.save();
    const midAlpha = isNight ? 0.1 : isDuskDawn ? 0.18 : 0.22;
    ctx.globalAlpha = midAlpha;
    ctx.fillStyle = isNight ? '#08080f' : isDuskDawn ? '#3a2a2a' : visuals.groundBase;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= w; x += 3) {
        const hillY = horizonY - 8
            - Math.sin(x / 170 + seed * 1.1) * 18
            - Math.sin(x / 55 + seed * 2.1) * 7;
        ctx.lineTo(x, hillY);
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();

    // Tree line on mid layer
    if (visuals.horizonFeature === 'trees') {
        for (let i = 0; i < 25; i++) {
            const cx = (i + 0.2) * w / 25 + Math.sin(seed + i * 2.3) * w * 0.012;
            const treeH = 10 + Math.abs(Math.sin(seed + i * 1.7)) * 14;
            const treeW = w / 25 * 0.75;
            ctx.beginPath();
            ctx.arc(cx, horizonY - treeH * 0.4 - 3, treeW / 2, Math.PI, 0);
            ctx.lineTo(cx + treeW / 2, horizonY + 2);
            ctx.lineTo(cx - treeW / 2, horizonY + 2);
            ctx.closePath();
            ctx.fill();
        }
    }
    ctx.restore();

    // --- Layer 3: Near individual trees with sway ---
    ctx.save();
    const nearAlpha = isNight ? 0.15 : isDuskDawn ? 0.3 : 0.35;
    ctx.globalAlpha = nearAlpha;
    ctx.fillStyle = isNight ? '#050508' : isDuskDawn ? '#2a1a1a' : visuals.groundDark;

    const t = performance.now();
    if (visuals.horizonFeature === 'trees') {
        for (let i = 0; i < 8; i++) {
            const cx = (i + 0.3) * w / 8 + Math.sin(seed * 2 + i * 5.1) * w * 0.03;
            const treeH = 18 + Math.abs(Math.sin(seed + i * 3.1)) * 20;
            const treeW = 12 + Math.abs(Math.sin(seed + i * 2.3)) * 10;
            const weatherInfo = getWeatherInfo();
            const windSway = weatherInfo.windAngle * 20; // Wind pushes trees
            const sway = Math.sin(t / 2000 + i * 1.5) * 2 + windSway;

            // Trunk
            ctx.fillRect(cx - 2, horizonY - treeH * 0.4, 4, treeH * 0.4 + 5);

            // Canopy with sway
            ctx.beginPath();
            ctx.arc(cx + sway, horizonY - treeH * 0.5, treeW, Math.PI, 0);
            ctx.closePath();
            ctx.fill();

            // Second canopy layer (fuller)
            ctx.beginPath();
            ctx.arc(cx + sway * 0.7 + 3, horizonY - treeH * 0.45 - 3, treeW * 0.7, Math.PI, 0);
            ctx.closePath();
            ctx.fill();
        }
    } else if (visuals.horizonFeature === 'mountains' || visuals.horizonFeature === 'volcanoes') {
        // Near rocky outcrops
        for (let i = 0; i < 5; i++) {
            const cx = (i + 0.5) * w / 5 + Math.sin(seed * 3 + i * 4.7) * w * 0.05;
            const rockH = 8 + Math.abs(Math.sin(seed + i * 2.9)) * 15;
            const rockW = 15 + Math.abs(Math.sin(seed + i * 1.8)) * 20;
            ctx.beginPath();
            ctx.moveTo(cx - rockW / 2, horizonY + 3);
            ctx.lineTo(cx - rockW * 0.3, horizonY - rockH);
            ctx.lineTo(cx + rockW * 0.2, horizonY - rockH * 0.8);
            ctx.lineTo(cx + rockW / 2, horizonY + 3);
            ctx.closePath();
            ctx.fill();
        }
    }
    ctx.restore();
}

// --- Ground surface — layered grass field ---

function drawNaturalGround(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    visuals: BiomeVisuals,
    seed: number,
): void {
    const terrainH = h - horizonY;
    const t = performance.now();
    const weather = getWeatherInfo();
    const isWet = weather.rainIntensity > 0.3;

    // --- Base gradient: atmospheric perspective (yellower toward horizon, richer foreground) ---
    const grad = ctx.createLinearGradient(0, horizonY, 0, h);
    grad.addColorStop(0, isWet ? '#3a5a30' : visuals.groundLight);  // horizon: lighter/yellower
    grad.addColorStop(0.15, isWet ? '#2a4a22' : visuals.groundBase);
    grad.addColorStop(0.5, isWet ? '#1a3a18' : visuals.groundBase);
    grad.addColorStop(1, isWet ? '#152a12' : visuals.groundDark);    // foreground: darker/richer
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY, w, terrainH);

    // --- Noise texture overlay — breaks up flatness ---
    ctx.save();
    for (let i = 0; i < 35; i++) {
        const ps = seed * 13.7 + i * 7.3;
        const px = (Math.sin(ps) * 0.5 + 0.5) * w;
        const py = horizonY + (Math.sin(ps * 2.1) * 0.5 + 0.5) * terrainH;
        const pr = 20 + Math.abs(Math.sin(ps * 3.7)) * 60;

        const patchGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
        const variant = i % 4;
        if (variant === 0) {
            patchGrad.addColorStop(0, 'rgba(80, 100, 50, 0.12)');  // yellow-green patch
        } else if (variant === 1) {
            patchGrad.addColorStop(0, 'rgba(30, 50, 20, 0.1)');   // dark shadow patch
        } else if (variant === 2) {
            patchGrad.addColorStop(0, 'rgba(60, 90, 40, 0.08)');  // mid green
        } else {
            patchGrad.addColorStop(0, 'rgba(90, 70, 40, 0.06)');  // earthy patch
        }
        patchGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = patchGrad;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // --- Subtle shadow variation patches (very gentle) ---
    ctx.save();
    for (let i = 0; i < 6; i++) {
        const es = seed * 5.3 + i * 19.7;
        const ex = (Math.sin(es * 1.1) * 0.5 + 0.5) * w;
        const ey = horizonY + (0.3 + Math.sin(es * 1.7) * 0.25) * terrainH;
        const ew = 30 + Math.abs(Math.sin(es * 2.3)) * 50;
        const eh = ew * (0.3 + Math.sin(es) * 0.15);
        const patchGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, ew);
        patchGrad.addColorStop(0, 'rgba(40, 35, 25, 0.05)');
        patchGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = patchGrad;
        ctx.beginPath();
        ctx.ellipse(ex, ey, ew, eh, Math.sin(es * 0.7) * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // --- Worn dirt area around shelter (slot 0 area) ---
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#4a3a28';
    const shelterX = w * 0.5 - 30;
    const shelterY = horizonY + terrainH * 0.38;
    ctx.beginPath();
    ctx.ellipse(shelterX, shelterY, 60, 25, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Dirt path from shelter toward bottom of screen
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#5a4a30';
    ctx.beginPath();
    ctx.moveTo(shelterX - 8, shelterY + 20);
    ctx.quadraticCurveTo(shelterX - 5, shelterY + terrainH * 0.3, shelterX + 5, h);
    ctx.lineTo(shelterX + 15, h);
    ctx.quadraticCurveTo(shelterX + 10, shelterY + terrainH * 0.3, shelterX + 8, shelterY + 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // --- Scattered small rocks ---
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 8; i++) {
        const rs = seed * 7.1 + i * 23.3;
        const rx = (Math.sin(rs * 1.3) * 0.5 + 0.5) * w;
        const ry = horizonY + (0.2 + Math.sin(rs * 1.9) * 0.3) * terrainH;
        const rw = 3 + Math.abs(Math.sin(rs * 2.1)) * 5;
        const rh = rw * (0.4 + Math.sin(rs) * 0.15);

        ctx.fillStyle = '#6a6058';
        ctx.beginPath();
        ctx.ellipse(rx, ry, rw, rh, Math.sin(rs * 0.5) * 0.3, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.ellipse(rx - rw * 0.2, ry - rh * 0.4, rw * 0.5, rh * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // --- Wind gust wave across grass (visible ripple) ---
    const gustCycle = (t / 18000) % 1; // One gust every ~18 seconds
    const gustActive = gustCycle < 0.15;
    const gustX = gustActive ? gustCycle / 0.15 * w : -1;

    // --- Wet ground sheen during rain ---
    if (isWet) {
        ctx.save();
        ctx.globalAlpha = weather.rainIntensity * 0.06;
        const sheenGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        sheenGrad.addColorStop(0, 'rgba(120, 150, 180, 0.5)');
        sheenGrad.addColorStop(1, 'rgba(80, 100, 120, 0.3)');
        ctx.fillStyle = sheenGrad;
        ctx.fillRect(0, horizonY, w, terrainH);
        ctx.restore();
    }

    // Store gust info for grass to use
    _lastGustX = gustX;
    _lastGustActive = gustActive;
}

// --- Grass blade clusters with wind sway and depth ---

function drawGroundDressing(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    visuals: BiomeVisuals,
    seed: number,
): void {
    if (visuals.dressing !== 'grass') {
        drawNonGrassDressing(ctx, w, h, horizonY, visuals, seed);
        return;
    }

    const terrainH = h - horizonY;
    const t = performance.now();
    const weather = getWeatherInfo();
    const windLean = weather.windAngle * 12;
    const rainBoost = weather.rainIntensity * 3;

    // Gust wave from drawNaturalGround
    const gustX = _lastGustX;
    const gustActive = _lastGustActive;

    // Green tone palette for variety
    const greens = ['#4a8a3a', '#3a7a2a', '#5a9a4a', '#3a6a28'];

    ctx.save();

    // --- Mid-ground grass (bulk of the field, 200 tufts) ---
    const midCount = 200;
    for (let i = 0; i < midCount; i++) {
        const ds = seed * 3.1 + i * 7.13;
        const dx = (Math.sin(ds * 1.1) * 0.5 + 0.5) * w;
        const depthRatio = (Math.sin(ds * 1.7) * 0.5 + 0.5);
        const dy = horizonY + depthRatio * terrainH * 0.88 + terrainH * 0.04;
        const scale = 0.3 + depthRatio * 0.7;

        // Wind sway — consistent direction, stronger in foreground
        const baseSway = Math.sin(t / 1800 + dx * 0.005 + i * 0.3) * (2 + rainBoost) * scale;
        const gustSway = (gustActive && Math.abs(dx - gustX) < 80) ? 4 * scale : 0;
        const sway = baseSway + windLean * scale + gustSway;

        ctx.globalAlpha = 0.25 + depthRatio * 0.45;

        const bladeCount = 3 + Math.floor(Math.abs(Math.sin(ds * 2.3)) * 3);
        const greenIdx = Math.floor(Math.abs(Math.sin(ds * 4.1)) * greens.length);
        ctx.strokeStyle = greens[greenIdx];
        ctx.lineWidth = (0.6 + depthRatio * 0.6) * scale;
        ctx.lineCap = 'round';

        for (let j = 0; j < bladeCount; j++) {
            const gx = dx + (j - bladeCount / 2) * 2.5 * scale;
            const bladeH = (5 + Math.abs(Math.sin(ds + j * 1.3)) * 8) * scale;
            const bladeLean = sway + Math.sin(ds + j * 0.7) * 2 * scale;

            ctx.beginPath();
            ctx.moveTo(gx, dy);
            ctx.quadraticCurveTo(
                gx + bladeLean * 0.4, dy - bladeH * 0.6,
                gx + bladeLean, dy - bladeH,
            );
            ctx.stroke();
        }

    }

    // --- Foreground grass (bottom edge, tallest, most detailed) ---
    ctx.globalAlpha = 0.7;
    const fgCount = 40;
    for (let i = 0; i < fgCount; i++) {
        const ds = seed * 11.3 + i * 13.7;
        const dx = (i / fgCount) * w + Math.sin(ds) * 15;
        const dy = h - Math.abs(Math.sin(ds * 1.7)) * 15;
        const scale = 1.2 + Math.abs(Math.sin(ds * 2.1)) * 0.4;

        const sway = Math.sin(t / 1500 + dx * 0.004 + i * 0.5) * (3 + rainBoost) + windLean;
        const gustFg = (gustActive && Math.abs(dx - gustX) < 100) ? 6 : 0;
        const totalSway = sway + gustFg;

        const bladeCount = 4 + Math.floor(Math.abs(Math.sin(ds * 3.1)) * 3);
        const greenIdx = Math.floor(Math.abs(Math.sin(ds * 2.7)) * greens.length);
        // Foreground grass is darker, more saturated
        ctx.strokeStyle = greenIdx % 2 === 0 ? '#2a5a1a' : '#1a4a12';
        ctx.lineWidth = 1.2 * scale;
        ctx.lineCap = 'round';

        for (let j = 0; j < bladeCount; j++) {
            const gx = dx + (j - bladeCount / 2) * 3 * scale;
            const bladeH = (12 + Math.abs(Math.sin(ds + j * 1.5)) * 10) * scale;
            const bladeLean = totalSway + Math.sin(ds + j * 0.9) * 3;

            ctx.beginPath();
            ctx.moveTo(gx, dy);
            ctx.quadraticCurveTo(
                gx + bladeLean * 0.3, dy - bladeH * 0.5,
                gx + bladeLean * 0.8, dy - bladeH,
            );
            ctx.stroke();
        }
    }

    ctx.restore();
}

/** Non-grass biome dressing (rocks, ice, ferns) — preserved from original. */
function drawNonGrassDressing(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    visuals: BiomeVisuals,
    seed: number,
): void {
    ctx.save();
    const terrainH = h - horizonY;
    const count = 100;

    for (let i = 0; i < count; i++) {
        const ds = seed * 3.1 + i * 7.13;
        const dx = (Math.sin(ds * 1.1) * 0.5 + 0.5) * w;
        const depthRatio = (Math.sin(ds * 1.7) * 0.5 + 0.5);
        const dy = horizonY + depthRatio * terrainH * 0.85 + terrainH * 0.05;
        const scale = 0.4 + depthRatio * 0.6;
        ctx.globalAlpha = 0.2 + depthRatio * 0.4;

        if (visuals.dressing === 'rocks') {
            const rockW = (3 + Math.abs(Math.sin(ds * 1.5)) * 6) * scale;
            const rockH = rockW * 0.5;
            ctx.fillStyle = i % 2 === 0 ? visuals.groundLight : '#5a4a3a';
            ctx.beginPath();
            ctx.ellipse(dx, dy, rockW, rockH, Math.sin(ds) * 0.3, 0, Math.PI * 2);
            ctx.fill();
        } else if (visuals.dressing === 'ice') {
            if (i % 3 === 0) {
                ctx.fillStyle = 'rgba(200, 220, 255, 0.3)';
                const s = 3 * scale;
                ctx.beginPath();
                ctx.moveTo(dx, dy - s);
                ctx.lineTo(dx + s * 0.7, dy);
                ctx.lineTo(dx, dy + s);
                ctx.lineTo(dx - s * 0.7, dy);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillStyle = 'rgba(230, 240, 255, 0.2)';
                ctx.beginPath();
                ctx.ellipse(dx, dy, 5 * scale, 2 * scale, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (visuals.dressing === 'ferns') {
            ctx.strokeStyle = i % 2 === 0 ? '#2a8a2a' : '#1a6a1a';
            ctx.lineWidth = 0.8 * scale;
            const fernH = (5 + Math.abs(Math.sin(ds)) * 5) * scale;
            ctx.beginPath();
            ctx.moveTo(dx, dy);
            ctx.lineTo(dx, dy - fernH);
            ctx.stroke();
            for (let j = 1; j <= 3; j++) {
                const fy = dy - j * fernH * 0.25;
                const fw = (4 - j) * 2 * scale;
                ctx.beginPath();
                ctx.moveTo(dx, fy);
                ctx.lineTo(dx - fw, fy - 2 * scale);
                ctx.moveTo(dx, fy);
                ctx.lineTo(dx + fw, fy - 2 * scale);
                ctx.stroke();
            }
        }
    }
    ctx.restore();
}

// --- Mid-ground scenery — trees and rocks between foreground and buildings ---

function drawMidgroundScenery(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    _visuals: BiomeVisuals,
    seed: number,
    t: number,
): void {
    const terrainH = h - horizonY;
    const dayNight = getDayNightState();
    const isNight = dayNight.ambientLight < 0.3;
    const weather = getWeatherInfo();
    const windLean = weather.windAngle * 8;

    ctx.save();

    // --- Ground rise left, dip right ---
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = _visuals.groundLight;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + terrainH * 0.25);
    ctx.quadraticCurveTo(w * 0.25, horizonY + terrainH * 0.18, w * 0.5, horizonY + terrainH * 0.28);
    ctx.quadraticCurveTo(w * 0.75, horizonY + terrainH * 0.35, w, horizonY + terrainH * 0.32);
    ctx.lineTo(w, horizonY + terrainH * 0.4);
    ctx.lineTo(0, horizonY + terrainH * 0.4);
    ctx.closePath();
    ctx.fill();

    // --- 3 mid-sized trees — prominently placed ---
    const midTrees = [
        { x: 0.18, y: 0.25 },
        { x: 0.72, y: 0.22 },
        { x: 0.4, y: 0.5 },
    ];

    for (let i = 0; i < midTrees.length; i++) {
        const mt = midTrees[i];
        const ms = seed * 9.3 + i * 21.7;
        const tx = w * mt.x + Math.sin(ms) * 15;
        const ty = horizonY + terrainH * mt.y;
        const treeScale = 0.7 + mt.y * 0.5;
        const trunkH = 35 * treeScale;
        const trunkW = 5 * treeScale;
        const canopyR = 25 * treeScale;

        const sway = Math.sin(t / 2000 + i * 2.3) * 3 * treeScale + windLean * treeScale;

        // Trunk
        ctx.globalAlpha = isNight ? 0.3 : 0.5;
        ctx.fillStyle = isNight ? '#1a1510' : '#3a2a18';
        ctx.beginPath();
        ctx.moveTo(tx - trunkW, ty);
        ctx.quadraticCurveTo(tx - trunkW * 0.5 + sway * 0.1, ty - trunkH * 0.5, tx - trunkW * 0.2 + sway * 0.3, ty - trunkH);
        ctx.lineTo(tx + trunkW * 0.2 + sway * 0.3, ty - trunkH);
        ctx.quadraticCurveTo(tx + trunkW * 0.5 + sway * 0.1, ty - trunkH * 0.5, tx + trunkW, ty);
        ctx.closePath();
        ctx.fill();

        // Canopy — 3 overlapping circles, lighter on top
        const canopyCx = tx + sway;
        const canopyCy = ty - trunkH - canopyR * 0.3;

        // Canopy — sunlit top, mid body, darker base
        // Sunlit top
        ctx.globalAlpha = isNight ? 0.2 : 0.45;
        ctx.fillStyle = isNight ? '#1a2a18' : '#5a9a42';
        ctx.beginPath();
        ctx.arc(canopyCx + canopyR * 0.1, canopyCy - canopyR * 0.2, canopyR * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Mid body — main mass
        ctx.globalAlpha = isNight ? 0.25 : 0.5;
        ctx.fillStyle = isNight ? '#0f1a0d' : '#3a7028';
        ctx.beginPath();
        ctx.arc(canopyCx - canopyR * 0.15, canopyCy, canopyR * 0.9, 0, Math.PI * 2);
        ctx.arc(canopyCx + canopyR * 0.2, canopyCy + canopyR * 0.05, canopyR * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Darker underside
        ctx.globalAlpha = isNight ? 0.15 : 0.3;
        ctx.fillStyle = isNight ? '#081008' : '#2a5018';
        ctx.beginPath();
        ctx.arc(canopyCx, canopyCy + canopyR * 0.2, canopyR * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // Ground shadow beneath tree
        ctx.globalAlpha = isNight ? 0.04 : 0.1;
        ctx.fillStyle = '#1a2a10';
        ctx.beginPath();
        ctx.ellipse(tx, ty + 4, canopyR * 1.0, canopyR * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- 6 mid-ground rocks — varied sizes ---
    const rocks = [
        { x: 0.2, y: 0.3, size: 1.4 },
        { x: 0.55, y: 0.2, size: 1.0 },
        { x: 0.42, y: 0.42, size: 1.3 },
        { x: 0.82, y: 0.35, size: 0.9 },
        { x: 0.1, y: 0.5, size: 1.1 },
        { x: 0.65, y: 0.48, size: 0.8 },
    ];

    for (let i = 0; i < rocks.length; i++) {
        const rock = rocks[i];
        const rs = seed * 11.1 + i * 29.3;
        const rx = w * rock.x + Math.sin(rs) * 15;
        const ry = horizonY + terrainH * rock.y;
        const scale = rock.size * (0.6 + rock.y * 0.5);
        const rw = (8 + Math.abs(Math.sin(rs * 1.5)) * 10) * scale;
        const rh = rw * (0.45 + Math.sin(rs) * 0.1);

        // Rock body
        ctx.globalAlpha = isNight ? 0.3 : 0.6;
        ctx.fillStyle = isNight ? '#2a2a28' : '#6a6258';
        ctx.beginPath();
        ctx.ellipse(rx, ry, rw, rh, Math.sin(rs * 0.5) * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Highlight on top
        ctx.globalAlpha = isNight ? 0.03 : 0.08;
        ctx.fillStyle = '#aaa89a';
        ctx.beginPath();
        ctx.ellipse(rx - rw * 0.15, ry - rh * 0.35, rw * 0.55, rh * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shadow
        ctx.globalAlpha = isNight ? 0.03 : 0.06;
        ctx.fillStyle = '#1a1a10';
        ctx.beginPath();
        ctx.ellipse(rx + rw * 0.3, ry + rh * 0.3, rw * 0.7, rh * 0.2, 0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// --- Terrain undulation — gentle hills and rises ---

function drawTerrainUndulation(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    visuals: BiomeVisuals,
    seed: number,
): void {
    const terrainH = h - horizonY;

    ctx.save();

    // Mid-ground hills — 2 gentle bumps in the terrain
    for (let i = 0; i < 2; i++) {
        const hs = seed * 4.7 + i * 31.3;
        const hillCx = w * (0.25 + i * 0.5) + Math.sin(hs) * w * 0.1;
        const hillTop = horizonY + terrainH * (0.15 + Math.sin(hs * 1.3) * 0.08);
        const hillW = w * (0.25 + Math.abs(Math.sin(hs * 2.1)) * 0.15);
        const hillH = terrainH * 0.12;

        // Hill body — slightly lighter than surrounding ground
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = visuals.groundLight;
        ctx.beginPath();
        ctx.moveTo(hillCx - hillW, horizonY + terrainH * 0.35);
        ctx.quadraticCurveTo(hillCx - hillW * 0.3, hillTop, hillCx, hillTop);
        ctx.quadraticCurveTo(hillCx + hillW * 0.3, hillTop, hillCx + hillW, horizonY + terrainH * 0.35);
        ctx.closePath();
        ctx.fill();

        // Shadow on far side of hill
        ctx.globalAlpha = 0.04;
        ctx.fillStyle = '#1a2a10';
        ctx.beginPath();
        ctx.moveTo(hillCx, hillTop);
        ctx.quadraticCurveTo(hillCx + hillW * 0.4, hillTop + hillH * 0.3, hillCx + hillW * 0.8, hillTop + hillH);
        ctx.lineTo(hillCx + hillW * 0.3, hillTop + hillH);
        ctx.quadraticCurveTo(hillCx + hillW * 0.1, hillTop + hillH * 0.5, hillCx, hillTop);
        ctx.closePath();
        ctx.fill();
    }

    // Ground rise at horizon — terrain crests slightly, overlapping treeline base
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = visuals.groundBase;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 8);
    for (let x = 0; x <= w; x += 5) {
        const rise = Math.sin(x / 120 + seed * 0.9) * 4 + Math.sin(x / 50 + seed * 2.1) * 2;
        ctx.lineTo(x, horizonY + 3 + rise);
    }
    ctx.lineTo(w, horizonY + 15);
    ctx.lineTo(0, horizonY + 15);
    ctx.closePath();
    ctx.fill();

    // Foreground rise — slight slope upward toward camera at bottom of screen
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = visuals.groundDark;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 5) {
        const rise = h - terrainH * 0.08 - Math.sin(x / 200 + seed * 1.5) * 8;
        ctx.lineTo(x, rise);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// --- Foreground trees — frame the scene ---

function drawForegroundTrees(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    visuals: BiomeVisuals,
    seed: number,
    t: number,
): void {
    if (visuals.horizonFeature !== 'trees') return;

    const dayNight = getDayNightState();
    const isNight = dayNight.ambientLight < 0.3;
    const weather = getWeatherInfo();
    const windLean = weather.windAngle * 15;

    ctx.save();

    // 3 foreground trees — left edge, right edge, and near-left
    const trees = [
        { x: w * 0.03, trunkVisible: true },
        { x: w * 0.92, trunkVisible: true },
        { x: w * -0.02, trunkVisible: true },
    ];

    for (let i = 0; i < trees.length; i++) {
        const tree = trees[i];
        const ts = seed * 5.1 + i * 17.3;
        const tx = tree.x + Math.sin(ts) * 10;
        const treeH = h * 0.5 + Math.abs(Math.sin(ts * 1.3)) * h * 0.08;
        const trunkW = 8 + Math.abs(Math.sin(ts * 2.1)) * 5;
        const canopyW = 40 + Math.abs(Math.sin(ts * 1.7)) * 20;

        const sway = Math.sin(t / 1500 + i * 2.1) * 6 + windLean * 1.5;

        const trunkBaseY = h * 0.8;
        const trunkTopY = trunkBaseY - treeH * 0.55;

        // Trunk — warm brown, tapers upward
        ctx.globalAlpha = isNight ? 0.4 : 0.6;
        ctx.fillStyle = isNight ? '#1a1510' : '#3a2a18';
        ctx.beginPath();
        ctx.moveTo(tx - trunkW, trunkBaseY);
        ctx.quadraticCurveTo(tx - trunkW * 0.6 + sway * 0.15, trunkTopY + treeH * 0.25, tx - trunkW * 0.2 + sway * 0.4, trunkTopY);
        ctx.lineTo(tx + trunkW * 0.2 + sway * 0.4, trunkTopY);
        ctx.quadraticCurveTo(tx + trunkW * 0.6 + sway * 0.15, trunkTopY + treeH * 0.25, tx + trunkW, trunkBaseY);
        ctx.closePath();
        ctx.fill();

        // Bark texture — subtle lines
        ctx.strokeStyle = isNight ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.5;
        for (let b = 0; b < 4; b++) {
            const bx = tx + (b - 1.5) * trunkW * 0.3;
            ctx.beginPath();
            ctx.moveTo(bx, trunkBaseY - 10);
            ctx.lineTo(bx + sway * 0.1, trunkTopY + 20);
            ctx.stroke();
        }

        // Grass around trunk base — rooted feel
        ctx.globalAlpha = isNight ? 0.2 : 0.4;
        ctx.strokeStyle = isNight ? '#1a2a12' : '#3a6a28';
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        for (let g = 0; g < 8; g++) {
            const gx = tx + (g - 3.5) * 5;
            const gy = trunkBaseY - 3;
            const gh = 6 + Math.abs(Math.sin(ts + g * 1.3)) * 6;
            const gl = Math.sin(ts + g * 0.7) * 2 + sway * 0.2;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.quadraticCurveTo(gx + gl * 0.4, gy - gh * 0.6, gx + gl, gy - gh);
            ctx.stroke();
        }

        // Canopy — 3 shade zones: light top, mid body, dark underside
        const canopyCx = tx + sway;
        const canopyCy = trunkTopY - canopyW * 0.15;

        // Zone 1: Sunlit top — brightest green, clearly lighter
        ctx.globalAlpha = isNight ? 0.2 : 0.4;
        ctx.fillStyle = isNight ? '#1a2a18' : '#5a9a48';
        for (let c = 0; c < 5; c++) {
            const cx = canopyCx + Math.sin(ts + c * 1.7) * canopyW * 0.3;
            const cy = canopyCy - canopyW * 0.08 + Math.sin(ts + c * 2.3) * canopyW * 0.1;
            const cr = canopyW * (0.25 + Math.abs(Math.sin(ts + c * 0.9)) * 0.15);
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Zone 2: Mid body — main canopy mass
        ctx.globalAlpha = isNight ? 0.25 : 0.35;
        ctx.fillStyle = isNight ? '#0f1a0d' : '#3a6a2a';
        for (let c = 0; c < 6; c++) {
            const cx = canopyCx + Math.sin(ts + c * 2.1) * canopyW * 0.35;
            const cy = canopyCy + Math.sin(ts + c * 1.5) * canopyW * 0.15;
            const cr = canopyW * (0.3 + Math.abs(Math.sin(ts + c * 1.3)) * 0.2);
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Zone 3: Dark underside — shadowed lower part
        ctx.globalAlpha = isNight ? 0.15 : 0.2;
        ctx.fillStyle = isNight ? '#080e08' : '#2a4a1a';
        for (let c = 0; c < 4; c++) {
            const cx = canopyCx + Math.sin(ts + c * 3.1) * canopyW * 0.25;
            const cy = canopyCy + canopyW * 0.1 + Math.abs(Math.sin(ts + c * 1.9)) * canopyW * 0.1;
            const cr = canopyW * (0.2 + Math.abs(Math.sin(ts + c * 1.5)) * 0.12);
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Dappled light on ground beneath
        if (!isNight) {
            ctx.globalAlpha = 0.05;
            ctx.fillStyle = '#aac880';
            for (let d = 0; d < 5; d++) {
                const dx = tx + Math.sin(ts + d * 3.1) * 30;
                const dy = trunkBaseY - 10 + Math.sin(ts + d * 2.7) * 10;
                const dr = 10 + Math.sin(ts + d) * 6;
                const dGrad = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr);
                dGrad.addColorStop(0, 'rgba(180, 210, 140, 0.3)');
                dGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = dGrad;
                ctx.beginPath();
                ctx.ellipse(dx, dy, dr, dr * 0.35, 0, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    ctx.restore();
}

// --- Paths between buildings ---

function drawPaths(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    region: Region,
): void {
    if (region.buildings.length < 1) return;

    const horizonY = h * 0.25;
    const centreX = w / 2;
    const centreY = horizonY + (h - horizonY) * 0.35;
    const gridPositions = getSlotGridPositions(region.buildingSlots);

    const occupiedIndices = region.buildings.map(b => b.slotIndex);
    if (occupiedIndices.length === 0) return;

    ctx.save();

    // Draw paths between all occupied buildings (star topology from first building)
    for (let i = 0; i < occupiedIndices.length; i++) {
        for (let j = i + 1; j < occupiedIndices.length; j++) {
            const a = gridPositions[occupiedIndices[i]];
            const b = gridPositions[occupiedIndices[j]];
            if (!a || !b) continue;

            const posA = gridToScreen(a.gridX, a.gridY, centreX, centreY);
            const posB = gridToScreen(b.gridX, b.gridY, centreX, centreY);
            const ay = posA.y + TILE_HEIGHT * 0.3;
            const by = posB.y + TILE_HEIGHT * 0.3;

            // Dirt path — wide, brown, slightly transparent
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = '#6a5a3a';
            ctx.lineWidth = 10;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(posA.x, ay);
            // Slight curve for natural feel
            const midX = (posA.x + posB.x) / 2 + (posA.y - posB.y) * 0.1;
            const midY = (ay + by) / 2;
            ctx.quadraticCurveTo(midX, midY, posB.x, by);
            ctx.stroke();

            // Lighter worn centre line
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = '#8a7a5a';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(posA.x, ay);
            ctx.quadraticCurveTo(midX, midY, posB.x, by);
            ctx.stroke();
        }
    }

    ctx.restore();
}

// --- Building shadows ---

function drawBuildingShadows(
    ctx: CanvasRenderingContext2D,
    _region: Region,
    slotRects: ColonySlotRect[],
    dayNight: DayNightState,
): void {
    if (dayNight.phase === 'night') return; // No sharp shadows at night

    const shadowAlpha = 0.08 + dayNight.ambientLight * 0.12;
    const shadowOffsetX = Math.cos(dayNight.shadowAngle) * 20 * dayNight.shadowLength;
    const shadowOffsetY = Math.sin(dayNight.shadowAngle) * 8 * dayNight.shadowLength;
    const shadowScale = 0.5 + dayNight.shadowLength * 0.5;

    ctx.save();
    ctx.globalAlpha = shadowAlpha;
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';

    for (const rect of slotRects) {
        if (!rect.occupied) continue;

        const sx = rect.x + rect.width / 2 + shadowOffsetX;
        const sy = rect.y + rect.height * 0.5 + shadowOffsetY;
        const shadowW = TILE_WIDTH * 0.4 * shadowScale;
        const shadowH = TILE_HEIGHT * 0.25 * shadowScale;

        ctx.beginPath();
        ctx.ellipse(sx, sy + 10, shadowW, shadowH, dayNight.shadowAngle * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// --- Ambient light overlay (night darkening, warm/cool tint) ---

function drawAmbientOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    dayNight: DayNightState,
): void {
    // Night darkness overlay
    if (dayNight.ambientLight < 0.9) {
        const darkness = 1 - dayNight.ambientLight;
        ctx.save();
        ctx.globalAlpha = darkness * 0.6;
        ctx.fillStyle = dayNight.warmth < 0 ? '#0a0a20' : '#1a1008';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    // Warm/cool colour grade
    if (Math.abs(dayNight.warmth) > 0.1) {
        ctx.save();
        ctx.globalAlpha = Math.abs(dayNight.warmth) * 0.08;
        ctx.fillStyle = dayNight.warmth > 0 ? 'rgba(255, 180, 80, 1)' : 'rgba(80, 120, 200, 1)';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }
}

// --- Time indicator (subtle, top-right) ---

function drawTimeIndicator(
    ctx: CanvasRenderingContext2D,
    w: number,
    dayNight: DayNightState,
    weather: WeatherInfo,
): void {
    const hours = Math.floor(dayNight.hour);
    const minutes = Math.floor((dayNight.hour - hours) * 60);
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // Weather icon
    let weatherIcon = ' ☀';
    if (weather.rainIntensity > 0.1) weatherIcon = ' 🌧';
    else if (weather.overcastAmount > 0.1) weatherIcon = ' ☁';
    if (dayNight.phase === 'night') weatherIcon = weather.overcastAmount > 0.1 ? ' ☁' : ' 🌙';

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = dayNight.phase === 'night' ? '#8090a0' : '#ffffff';
    ctx.font = '11px "Share Tech Mono", "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${timeStr}${weatherIcon}`, w - 16, 55);
    ctx.restore();
}

// --- Wet sheen on buildings during rain ---


// --- Ambient particles ---

function drawAmbientParticles(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    visuals: BiomeVisuals,
    t: number,
): void {
    ctx.save();
    ctx.fillStyle = visuals.particleColour;

    const count = 25;
    for (let i = 0; i < count; i++) {
        const seed = i * 7.13;
        let px: number;
        let py: number;
        let size: number;

        if (visuals.particleType === 'snow') {
            // Falling snow
            px = (Math.sin(seed) * 0.5 + 0.5) * w + Math.sin(t / 3000 + seed) * 20;
            py = ((t / 4000 + seed * 0.3) % 1.2 - 0.1) * h;
            size = 1.5 + Math.sin(seed * 2) * 1;
        } else if (visuals.particleType === 'embers') {
            // Rising embers
            px = (Math.sin(seed * 1.3) * 0.5 + 0.5) * w + Math.sin(t / 1500 + seed) * 30;
            py = h - ((t / 3000 + seed * 0.4) % 1.2) * h;
            size = 1 + Math.sin(seed) * 1;
        } else if (visuals.particleType === 'fireflies') {
            // Glowing fireflies with erratic movement
            px = (Math.sin(seed * 1.7) * 0.5 + 0.5) * w + Math.sin(t / 1000 + seed) * 40;
            py = h * 0.4 + Math.sin(t / 1200 + seed * 2) * h * 0.25;
            size = 1.5 + Math.sin(t / 500 + seed) * 0.5;
            ctx.globalAlpha = 0.3 + Math.sin(t / 400 + seed * 3) * 0.3;
        } else {
            // Floating pollen
            px = (Math.sin(seed) * 0.5 + 0.5) * w + Math.sin(t / 4000 + seed) * 30;
            py = h * 0.3 + Math.sin(t / 3000 + seed * 1.5) * h * 0.2;
            size = 1 + Math.sin(seed * 3) * 0.5;
        }

        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

// --- Building slots ---

function drawBuildingSlots(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    region: Region,
    t: number,
): ColonySlotRect[] {
    const slotRects: ColonySlotRect[] = [];
    const totalSlots = region.buildingSlots;
    if (totalSlots === 0) return slotRects;

    const horizonY = h * 0.25;
    const centreX = w / 2;
    const centreY = horizonY + (h - horizonY) * 0.35;

    const gridPositions = getSlotGridPositions(totalSlots);

    for (let i = 0; i < gridPositions.length; i++) {
        const gridPos = gridPositions[i];
        const screenPos = gridToScreen(gridPos.gridX, gridPos.gridY, centreX, centreY);

        const building = region.buildings.find(b => b.slotIndex === i);
        const rect: ColonySlotRect = {
            slotIndex: i,
            x: screenPos.x - TILE_WIDTH / 2,
            y: screenPos.y - TILE_HEIGHT,
            width: TILE_WIDTH,
            height: TILE_HEIGHT * 2,
            occupied: building !== null && building !== undefined,
        };
        slotRects.push(rect);

        if (building) {
            drawBuilding(ctx, building.typeId, screenPos.x, screenPos.y, building.state, t);

            // Building name label
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.8;
            ctx.font = '10px "Share Tech Mono", "Courier New", monospace';
            ctx.textAlign = 'center';
            const bt = getBuildingType(building.typeId);
            ctx.fillText(bt.name.toUpperCase(), screenPos.x, screenPos.y + TILE_HEIGHT * 0.7);

            if (building.state === 'constructing') {
                ctx.fillStyle = '#ffca28';
                ctx.fillText(`(${building.turnsRemaining} TURNS)`, screenPos.x, screenPos.y + TILE_HEIGHT * 0.7 + 12);
            }
            ctx.globalAlpha = 1.0;
        } else {
            // Empty slot — draw faded diamond outline with +
            ctx.save();
            ctx.globalAlpha = 0.15;
            drawIsometricTile(ctx, screenPos.x, screenPos.y, 'rgba(255,255,255,0.1)', '#c0c8d8');

            // Plus marker
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = '#c0c8d8';
            ctx.fillRect(screenPos.x - 8, screenPos.y - 1.5, 16, 3);
            ctx.fillRect(screenPos.x - 1.5, screenPos.y - 8, 3, 16);
            ctx.restore();
        }
    }

    return slotRects;
}

// --- Colonists ---

/** Gather crew data and draw walking sprite figures. */
function drawCrewOnSurface(
    ctx: CanvasRenderingContext2D,
    entity: Entity,
    region: Region,
    slotRects: ColonySlotRect[],
    t: number,
    dtSeconds: number,
): void {
    const world = ServiceLocator.get<World>('world');
    const crew = getCrewAtColony(world, entity.id, region.id);
    if (crew.length === 0) return;

    const crewData = crew.map(e => {
        const c = e.getComponent(CrewMemberComponent);
        return {
            id: e.id,
            role: c?.role ?? 'Civilian',
            isLeader: c?.isLeader ?? false,
        };
    });

    drawCrewSprites(ctx, crewData, slotRects, t, dtSeconds);
}

// --- Colony label ---

function drawColonyLabel(ctx: CanvasRenderingContext2D, w: number, region: Region): void {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8;
    ctx.font = '14px "Share Tech Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`COLONY — ${region.biome.toUpperCase()}`, w / 2, 55);
    ctx.globalAlpha = 1.0;
}

// --- Transition drawing ---

export function drawTransitionToColony(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    regionId: number,
    progress: number,
): void {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (progress < 0.4) {
        const phase = progress / 0.4;
        ctx.fillStyle = `rgba(3, 4, 10, ${phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (progress < 0.5) {
        ctx.fillStyle = '#03040a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        const phase = (progress - 0.5) / 0.5;
        ctx.save();
        ctx.globalAlpha = phase;
        drawColonyScene(entity, ctx, regionId);
        ctx.restore();
        ctx.fillStyle = `rgba(3, 4, 10, ${1 - phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

export function drawTransitionFromColony(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    regionId: number,
    progress: number,
): void {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (progress < 0.4) {
        const phase = progress / 0.4;
        ctx.save();
        ctx.globalAlpha = 1 - phase;
        drawColonyScene(entity, ctx, regionId);
        ctx.restore();
        ctx.fillStyle = `rgba(3, 4, 10, ${phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (progress < 0.5) {
        ctx.fillStyle = '#03040a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        const phase = (progress - 0.5) / 0.5;
        ctx.fillStyle = `rgba(3, 4, 10, ${1 - phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}
