// drawColonyScene.ts — Isometric colony scene renderer.
// Draws biome-specific sky, isometric terrain grid, buildings, colonists.

import { RegionDataComponent } from '../components/RegionDataComponent';
import { ColonySceneStateComponent } from '../components/ColonySceneStateComponent';
import { ColonySimulationComponent } from '../components/ColonySimulationComponent';
import { getBuildingType } from '../data/buildings';
import { drawBuilding } from './colonyBuildingSprites';
import { drawSettlementProps, drawMicroDetails, drawSettlementPropsForSlot } from './colonyProps';
import { drawParticles } from './colonyParticles';
import { getDayNightState, setGameHour } from './colonyDayNight';
import { drawWeatherEffects, getWeatherInfo, forceNextWeather } from './colonyWeather';
import { drawGridTiles, drawPathTiles, drawBuildingGlow, drawDebugOverlay, drawFigure, drawFireflies } from './colonyGridRenderer';
import { drawRelationshipOverlays, drawThoughtBubble } from './colonyRelationshipRenderer';
import { getVisibleColonists } from '../colony/ColonistManager';
import { resolveThought } from '../colony/ColonistThoughts';
import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { getBuildingFootprint, ColonyGrid } from '../colony/ColonyGrid';
import { ServiceLocator } from '../core/ServiceLocator';
import { RenderQueue, extractHitTestItems } from './RenderQueue';
import type { WeatherInfo } from './colonyWeather';
import type { DayNightState } from './colonyDayNight';
import type { ColonistVisualState } from '../colony/ColonistState';
import type { BuildingInstance } from '../data/buildings';
import type { World } from '../core/World';
import {
    gridToScreen,
    drawIsometricTile,
    getGridCentre,
    TILE_WIDTH,
    TILE_HEIGHT,
} from './isometric';
import type { Region } from '../components/RegionDataComponent';
import type { BiomeName } from '../data/biomes';
import type { Entity } from '../core/Entity';

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

/** Debug keyboard handler (W = cycle weather, T = advance time 3 hours, D = depth overlay). */
function registerDebugKeys(state: ColonySceneStateComponent): void {
    if (state.debugKeysRegistered) return;
    state.debugKeysRegistered = true;
    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.code === 'KeyW' && !e.ctrlKey && !e.metaKey) {
            forceNextWeather(state);
        }
        if (e.code === 'KeyT' && !e.ctrlKey && !e.metaKey) {
            setGameHour(state, state.gameHour + 3);
        }
        if (e.code === 'KeyD' && !e.ctrlKey && !e.metaKey) {
            state.debugDepthVisible = !state.debugDepthVisible;
        }
    });
}

// --- Main draw function ---

export function drawColonyScene(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    regionId: number,
): ColonySlotRect[] {
    const regionData = entity.getComponent(RegionDataComponent);
    if (!regionData) return [];

    const region = regionData.regions.find(r => r.id === regionId);
    if (!region) return [];

    const state = entity.getComponent(ColonySceneStateComponent);
    if (!state) return [];

    registerDebugKeys(state);

    const vt = state.viewTransform;
    const w = vt.canvasW;
    const h = vt.canvasH;
    const t = performance.now();
    const visuals = getVisuals(region.biome);
    const horizonY = vt.horizonY;

    // Compute frame delta (clock/weather now advance in ColonySceneStateComponent.update)
    const now = performance.now();
    const dtSeconds = state.lastFrameTime > 0 ? (now - state.lastFrameTime) / 1000 : 0;
    state.lastFrameTime = now;

    const dayNight = getDayNightState(state.gameHour);
    const weather = getWeatherInfo(state);

    // === Layer 1: Sky, horizon, background (1x scale, fills screen) ===
    drawSky(ctx, w, h, horizonY, visuals, t, dayNight, weather);
    drawStars(ctx, w, horizonY, dayNight);
    drawHorizonFeatures(ctx, w, horizonY, visuals, region.id, state);

    // Ground plane fill at 1x — covers horizon to bottom of screen
    drawNaturalGround(ctx, w, h, horizonY, visuals, region.id, state);

    // Soft horizon blend — gradient feathering sky into ground
    const blendH = h * 0.06;
    const blendGrad = ctx.createLinearGradient(0, horizonY - blendH * 0.3, 0, horizonY + blendH);
    blendGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blendGrad.addColorStop(0.3, `rgba(${dayNight.warmth > 0 ? '140,160,120' : '120,140,130'}, 0.15)`);
    blendGrad.addColorStop(0.7, `rgba(${dayNight.warmth > 0 ? '100,130,80' : '80,110,90'}, 0.1)`);
    blendGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blendGrad;
    ctx.fillRect(0, horizonY - blendH * 0.3, w, blendH * 1.3);

    // Ground fog wisp along treeline
    const fogScale = Math.min(w / 1200, 1);
    ctx.save();
    ctx.globalAlpha = dayNight.phase === 'night' ? 0.08 : 0.05;
    ctx.fillStyle = dayNight.warmth > 0 ? 'rgba(200, 210, 180, 1)' : 'rgba(180, 200, 210, 1)';
    for (let i = 0; i < 6; i++) {
        const fogX = ((t * 0.002 + i * w * 0.2) % (w + 200)) - 100;
        const fogY = horizonY + 3 * fogScale + Math.sin(i * 2.3) * 3 * fogScale;
        ctx.beginPath();
        ctx.ellipse(fogX, fogY, (70 + i * 15) * fogScale, (6 + i * 2) * fogScale, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // === Layer 2: Colony content (zoomed) ===
    // Scale around the colony centre point, which sits in the ground area
    const groundCentreX = vt.groundCentreX;
    const groundCentreY = vt.groundCentreY;
    ctx.save();
    ctx.translate(groundCentreX, groundCentreY);
    ctx.scale(vt.zoom, vt.zoom);
    ctx.translate(-groundCentreX, -groundCentreY);

    drawTerrainUndulation(ctx, w, h, horizonY, visuals, region.id);
    drawGroundDressing(ctx, w, h, horizonY, visuals, region.id, state);
    drawMidgroundScenery(ctx, w, h, horizonY, visuals, region.id, t, state);

    // Colony simulation rendering — grid-based paths, buildings, colonists
    const sim = entity.getComponent(ColonySimulationComponent);
    if (sim && !sim.isActive) {
        sim.initForRegion(region.id);
    }

    const gridCentre = getGridCentre(groundCentreX, groundCentreY);
    if (sim) {
        drawPathTiles(ctx, sim.grid, gridCentre.centreX, gridCentre.centreY);
        drawGridTiles(ctx, sim.grid, gridCentre.centreX, gridCentre.centreY);
    }

    const { slotData, slotRects } = collectBuildingSlotData(region, sim, gridCentre);
    drawBuildingShadows(ctx, region, slotRects, dayNight);

    // Micro-details (campfire ring, barrels, signposts) sit on the ground plane
    // beneath all depth-sorted entities — draw before the RenderQueue pass.
    drawMicroDetails(ctx, w, h, region, t, slotRects, state.gameHour);

    if (sim) {
        const colonists = getVisibleColonists(sim);
        drawBuildingGlow(ctx, colonists, slotRects);

        // Pre-compute selected colonist depth for building transparency
        const selectedColonistDepth = computeSelectedColonistDepth(colonists, state.selectedColonistId);

        const queue = new RenderQueue();
        registerBuildings(queue, slotData, region, t, state, selectedColonistDepth, sim.grid, gridCentre);
        registerColonists(queue, colonists, gridCentre, t, state, slotData);
        registerEmptySlots(queue, slotData, state);

        queue.sort();
        queue.drawAll(ctx);

        // Relationship overlays (only for selected colonist)
        if (ServiceLocator.has('world')) {
            const world = ServiceLocator.get<World>('world');
            drawRelationshipOverlays(ctx, colonists, gridCentre.centreX, gridCentre.centreY, world, t, state.selectedColonistId);

            // Thought bubbles for selected colonist
            if (state.selectedColonistId !== null) {
                const selColonist = colonists.find(c => c.entityId === state.selectedColonistId);
                if (selColonist) {
                    // Resolve new thought if timer expired
                    if (selColonist.thoughtTimer <= 0) {
                        const entity = world.getEntity(selColonist.entityId);
                        const crew = entity?.getComponent(CrewMemberComponent);
                        if (crew) {
                            const thought = resolveThought(selColonist, crew, state.gameHour);
                            if (thought) {
                                selColonist.thoughtBubble = thought;
                                // 8-12 second display timer
                                selColonist.thoughtTimer = 8 + (selColonist.entityId % 5);
                            }
                        }
                    }

                    if (selColonist.thoughtBubble) {
                        const screen = gridToScreen(selColonist.gridX, selColonist.gridY, gridCentre.centreX, gridCentre.centreY);
                        const maxTime = 8 + (selColonist.entityId % 5);
                        drawThoughtBubble(ctx, screen.x, screen.y, selColonist.thoughtBubble, selColonist.thoughtTimer, maxTime);
                    }
                }
            }
        }

        // Silhouette pass for selected colonist behind buildings
        drawOccludedColonistSilhouette(ctx, colonists, slotData, state, gridCentre, t);

        if (state.debugDepthVisible) queue.drawDebug(ctx);

        state.lastSlotRects = slotRects;
        state.lastHitTestItems = extractHitTestItems(queue);
        state.lastColonistPositions = [];
    } else {
        // No sim — draw props the old way (just empty slots)
        drawSettlementProps(ctx, region, slotRects, t, state.gameHour, null, gridCentre.centreX, gridCentre.centreY);
        state.lastSlotRects = slotRects;
    }

    drawParticles(ctx, dtSeconds, state);

    // Firefly particles near campfire during evening
    if (sim && sim.campfireCell) {
        const campfireScreen = gridToScreen(sim.campfireCell.gridX, sim.campfireCell.gridY, gridCentre.centreX, gridCentre.centreY);
        drawFireflies(ctx, campfireScreen.x, campfireScreen.y, state.gameHour, t);
    }

    // Debug overlay
    if (sim && sim.debugGridVisible) {
        drawDebugOverlay(ctx, sim.grid, gridCentre.centreX, gridCentre.centreY);
    }

    ctx.restore(); // Back to 1x

    // === Layer 3: Overlays and foreground (1x scale) ===
    drawAmbientParticles(ctx, w, h, visuals, t);
    drawForegroundTrees(ctx, w, h, visuals, region.id, t, state);
    drawForegroundGrass(ctx, w, h, region.id, t, state);
    drawAmbientOverlay(ctx, w, h, dayNight);

    // Weather effects drawn AFTER ambient overlay so rain is visible on dark nights
    drawWeatherEffects(ctx, w, h, t, state);
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
    const weatherDim = 1 - weather.overcastAmount * 1.2;

    if (dayNight.celestialHeight > -0.15 && weatherDim > 0.05) {
        const sunR = dayNight.phase === 'night' ? w * 0.03 : w * 0.05;
        const horizonFade = dayNight.celestialHeight < 0
            ? 1 + dayNight.celestialHeight / 0.15
            : 1;

        if (dayNight.phase === 'night') {
            const moonNorm = ((dayNight.hour - 20) / 9 + 1) % 1;
            const moonX = w * (0.15 + moonNorm * 0.7);
            const moonY = horizonY * (0.6 - Math.sin(moonNorm * Math.PI) * 0.45);
            ctx.save();
            ctx.globalAlpha = dayNight.starAlpha * 0.7;
            ctx.fillStyle = 'rgba(200, 210, 230, 1)';
            ctx.beginPath();
            ctx.arc(moonX, moonY, sunR, 0, Math.PI * 2);
            ctx.fill();
            const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, sunR * 4);
            moonGlow.addColorStop(0, 'rgba(200, 210, 230, 0.1)');
            moonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = moonGlow;
            ctx.beginPath();
            ctx.arc(moonX, moonY, sunR * 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        } else {
            ctx.save();
            ctx.globalAlpha = horizonFade * weatherDim;
            const bloomR = sunR * 3;
            const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, bloomR);

            if (dayNight.phase === 'dawn' || dayNight.phase === 'dusk') {
                sunGlow.addColorStop(0, `rgba(255, 220, 150, ${(0.8 * pulse).toFixed(2)})`);
                sunGlow.addColorStop(0.2, `rgba(255, 180, 80, ${(0.4 * pulse).toFixed(2)})`);
                sunGlow.addColorStop(0.5, `rgba(255, 140, 50, ${(0.15 * pulse).toFixed(2)})`);
            } else {
                sunGlow.addColorStop(0, `rgba(255, 250, 230, ${(0.9 * pulse).toFixed(2)})`);
                sunGlow.addColorStop(0.15, `rgba(255, 240, 200, ${(0.5 * pulse).toFixed(2)})`);
                sunGlow.addColorStop(0.4, `rgba(255, 220, 150, ${(0.15 * pulse).toFixed(2)})`);
            }
            sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = sunGlow;
            ctx.beginPath();
            ctx.arc(sunX, sunY, bloomR, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `rgba(255, 250, 235, ${(0.95 * pulse).toFixed(2)})`;
            ctx.beginPath();
            ctx.arc(sunX, sunY, sunR * 0.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

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
    state: ColonySceneStateComponent,
): void {
    const dayNight = getDayNightState(state.gameHour);
    const isNight = dayNight.phase === 'night';
    const isDuskDawn = dayNight.phase === 'dusk' || dayNight.phase === 'dawn';
    const scale = Math.min(w / 1200, 1);

    // --- Layer 1: Far misty mountains (most hazy, least detail) ---
    ctx.save();
    const farAlpha = isNight ? 0.06 : isDuskDawn ? 0.1 : 0.14;
    ctx.globalAlpha = farAlpha;
    ctx.fillStyle = isNight ? '#0a0a15' : isDuskDawn ? '#4a3a3a' : visuals.groundDark;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= w; x += 3) {
        const hillY = horizonY - 20 * scale
            - Math.sin(x / (250 * scale) + seed * 0.7) * 25 * scale
            - Math.sin(x / (90 * scale) + seed * 1.3) * 10 * scale
            - Math.abs(Math.sin(x / (400 * scale) + seed * 0.3)) * 35 * scale;
        ctx.lineTo(x, hillY);
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();

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
        const hillY = horizonY - 8 * scale
            - Math.sin(x / (170 * scale) + seed * 1.1) * 18 * scale
            - Math.sin(x / (55 * scale) + seed * 2.1) * 7 * scale;
        ctx.lineTo(x, hillY);
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fill();

    if (visuals.horizonFeature === 'trees') {
        for (let i = 0; i < 25; i++) {
            const cx = (i + 0.2) * w / 25 + Math.sin(seed + i * 2.3) * w * 0.012;
            const treeH = (10 + Math.abs(Math.sin(seed + i * 1.7)) * 14) * scale;
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
            const treeH = (18 + Math.abs(Math.sin(seed + i * 3.1)) * 20) * scale;
            const treeW = (12 + Math.abs(Math.sin(seed + i * 2.3)) * 10) * scale;
            const weatherInfo = getWeatherInfo(state);
            const windSway = weatherInfo.windAngle * 20;
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
        for (let i = 0; i < 5; i++) {
            const cx = (i + 0.5) * w / 5 + Math.sin(seed * 3 + i * 4.7) * w * 0.05;
            const rockH = (8 + Math.abs(Math.sin(seed + i * 2.9)) * 15) * scale;
            const rockW = (15 + Math.abs(Math.sin(seed + i * 1.8)) * 20) * scale;
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
    state: ColonySceneStateComponent,
): void {
    const terrainH = h - horizonY;
    const t = performance.now();
    const weather = getWeatherInfo(state);
    const isWet = weather.rainIntensity > 0.3;
    const scale = Math.min(w / 1200, 1);

    const grad = ctx.createLinearGradient(0, horizonY, 0, h);
    grad.addColorStop(0, isWet ? '#3a5a30' : visuals.groundLight);
    grad.addColorStop(0.15, isWet ? '#2a4a22' : visuals.groundBase);
    grad.addColorStop(0.5, isWet ? '#1a3a18' : visuals.groundBase);
    grad.addColorStop(1, isWet ? '#152a12' : visuals.groundDark);
    ctx.fillStyle = grad;
    ctx.fillRect(0, horizonY, w, terrainH);

    // Noise texture overlay
    ctx.save();
    for (let i = 0; i < 35; i++) {
        const ps = seed * 13.7 + i * 7.3;
        const px = (Math.sin(ps) * 0.5 + 0.5) * w;
        const py = horizonY + (Math.sin(ps * 2.1) * 0.5 + 0.5) * terrainH;
        const pr = (20 + Math.abs(Math.sin(ps * 3.7)) * 60) * scale;

        const patchGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
        const variant = i % 4;
        if (variant === 0) {
            patchGrad.addColorStop(0, 'rgba(80, 100, 50, 0.12)');
        } else if (variant === 1) {
            patchGrad.addColorStop(0, 'rgba(30, 50, 20, 0.1)');
        } else if (variant === 2) {
            patchGrad.addColorStop(0, 'rgba(60, 90, 40, 0.08)');
        } else {
            patchGrad.addColorStop(0, 'rgba(90, 70, 40, 0.06)');
        }
        patchGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = patchGrad;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // Subtle shadow variation patches
    ctx.save();
    for (let i = 0; i < 6; i++) {
        const es = seed * 5.3 + i * 19.7;
        const ex = (Math.sin(es * 1.1) * 0.5 + 0.5) * w;
        const ey = horizonY + (0.3 + Math.sin(es * 1.7) * 0.25) * terrainH;
        const ew = (30 + Math.abs(Math.sin(es * 2.3)) * 50) * scale;
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

    // Worn dirt area around shelter
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = '#4a3a28';
    const shelterX = w * 0.5 - 30 * scale;
    const shelterY = horizonY + terrainH * 0.38;
    ctx.beginPath();
    ctx.ellipse(shelterX, shelterY, 60 * scale, 25 * scale, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#5a4a30';
    ctx.beginPath();
    ctx.moveTo(shelterX - 8 * scale, shelterY + 20 * scale);
    ctx.quadraticCurveTo(shelterX - 5 * scale, shelterY + terrainH * 0.3, shelterX + 5 * scale, h);
    ctx.lineTo(shelterX + 15 * scale, h);
    ctx.quadraticCurveTo(shelterX + 10 * scale, shelterY + terrainH * 0.3, shelterX + 8 * scale, shelterY + 20 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Scattered small rocks
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 8; i++) {
        const rs = seed * 7.1 + i * 23.3;
        const rx = (Math.sin(rs * 1.3) * 0.5 + 0.5) * w;
        const ry = horizonY + (0.2 + Math.sin(rs * 1.9) * 0.3) * terrainH;
        const rw = (3 + Math.abs(Math.sin(rs * 2.1)) * 5) * scale;
        const rh = rw * (0.4 + Math.sin(rs) * 0.15);

        ctx.fillStyle = '#6a6058';
        ctx.beginPath();
        ctx.ellipse(rx, ry, rw, rh, Math.sin(rs * 0.5) * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.ellipse(rx - rw * 0.2, ry - rh * 0.4, rw * 0.5, rh * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // Wind gust wave across grass
    const gustCycle = (t / 18000) % 1;
    const gustActive = gustCycle < 0.15;
    const gustX = gustActive ? gustCycle / 0.15 * w : -1;

    // Wet ground sheen during rain
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

    // Store gust info on state for grass to use
    state.lastGustX = gustX;
    state.lastGustActive = gustActive;
}

// --- Grass blade clusters with wind sway and depth ---

function drawGroundDressing(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    horizonY: number,
    visuals: BiomeVisuals,
    seed: number,
    state: ColonySceneStateComponent,
): void {
    if (visuals.dressing !== 'grass') {
        drawNonGrassDressing(ctx, w, h, horizonY, visuals, seed);
        return;
    }

    const terrainH = h - horizonY;
    const t = performance.now();
    const wScale = Math.min(w / 1200, 1);
    const weather = getWeatherInfo(state);
    const windLean = weather.windAngle * 12 * wScale;
    const rainBoost = weather.rainIntensity * 3 * wScale;

    const gustX = state.lastGustX;
    const gustActive = state.lastGustActive;

    const greens = ['#4a8a3a', '#3a7a2a', '#5a9a4a', '#3a6a28'];

    ctx.save();

    const midCount = 200;
    for (let i = 0; i < midCount; i++) {
        const ds = seed * 3.1 + i * 7.13;
        const dx = (Math.sin(ds * 1.1) * 0.5 + 0.5) * w;
        const depthRatio = (Math.sin(ds * 1.7) * 0.5 + 0.5);
        const dy = horizonY + depthRatio * terrainH * 0.88 + terrainH * 0.04;
        const scale = 0.3 + depthRatio * 0.7;

        const baseSway = Math.sin(t / 1800 + dx * 0.005 + i * 0.3) * (2 + rainBoost) * scale;
        const gustSway = (gustActive && Math.abs(dx - gustX) < 80 * wScale) ? 4 * scale * wScale : 0;
        const sway = baseSway + windLean * scale + gustSway;

        ctx.globalAlpha = 0.25 + depthRatio * 0.45;

        const bladeCount = 3 + Math.floor(Math.abs(Math.sin(ds * 2.3)) * 3);
        const greenIdx = Math.floor(Math.abs(Math.sin(ds * 4.1)) * greens.length);
        ctx.strokeStyle = greens[greenIdx];
        ctx.lineWidth = (0.6 + depthRatio * 0.6) * scale * wScale;
        ctx.lineCap = 'round';

        for (let j = 0; j < bladeCount; j++) {
            const gx = dx + (j - bladeCount / 2) * 2.5 * scale * wScale;
            const bladeH = (5 + Math.abs(Math.sin(ds + j * 1.3)) * 8) * scale * wScale;
            const bladeLean = sway + Math.sin(ds + j * 0.7) * 2 * scale * wScale;

            ctx.beginPath();
            ctx.moveTo(gx, dy);
            ctx.quadraticCurveTo(
                gx + bladeLean * 0.4, dy - bladeH * 0.6,
                gx + bladeLean, dy - bladeH,
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
    state: ColonySceneStateComponent,
): void {
    const terrainH = h - horizonY;
    const scale = Math.min(w / 1200, 1);
    const dayNight = getDayNightState(state.gameHour);
    const isNight = dayNight.ambientLight < 0.3;
    const weather = getWeatherInfo(state);
    const windLean = weather.windAngle * 8;

    ctx.save();

    // Ground rise left, dip right
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

    // 3 mid-sized trees
    const midTrees = [
        { x: 0.18, y: 0.25 },
        { x: 0.72, y: 0.22 },
        { x: 0.4, y: 0.5 },
    ];

    for (let i = 0; i < midTrees.length; i++) {
        const mt = midTrees[i];
        const ms = seed * 9.3 + i * 21.7;
        const tx = w * mt.x + Math.sin(ms) * 15 * scale;
        const ty = horizonY + terrainH * mt.y;
        const treeScale = 0.7 + mt.y * 0.5;
        const trunkH = 35 * treeScale * scale;
        const trunkW = 5 * treeScale * scale;
        const canopyR = 25 * treeScale * scale;

        const sway = Math.sin(t / 2000 + i * 2.3) * 3 * treeScale * scale + windLean * treeScale;

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

        // Canopy — irregular organic shape with two shade zones
        const canopyCx = tx + sway;
        const canopyCy = ty - trunkH - canopyR * 0.3;

        ctx.globalAlpha = isNight ? 0.2 : 0.4;
        ctx.fillStyle = isNight ? '#1a2a18' : '#5a9a42';
        for (let c = 0; c < 4; c++) {
            const cx = canopyCx + Math.sin(ms + c * 2.7) * canopyR * 0.35;
            const cy = canopyCy - canopyR * 0.15 + Math.sin(ms + c * 1.3) * canopyR * 0.15;
            const cr = canopyR * (0.4 + Math.abs(Math.sin(ms + c * 1.9)) * 0.2);
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = isNight ? 0.2 : 0.45;
        ctx.fillStyle = isNight ? '#0f1a0d' : '#2a5a1a';
        for (let c = 0; c < 3; c++) {
            const cx = canopyCx + Math.sin(ms + c * 3.1 + 1) * canopyR * 0.3;
            const cy = canopyCy + canopyR * 0.12 + Math.abs(Math.sin(ms + c * 2.1)) * canopyR * 0.1;
            const cr = canopyR * (0.45 + Math.abs(Math.sin(ms + c * 1.7)) * 0.15);
            ctx.beginPath();
            ctx.arc(cx, cy, cr, 0, Math.PI * 2);
            ctx.fill();
        }

        // Ground shadow beneath tree
        ctx.globalAlpha = isNight ? 0.04 : 0.1;
        ctx.fillStyle = '#1a2a10';
        ctx.beginPath();
        ctx.ellipse(tx, ty + 4 * scale, canopyR * 1.0, canopyR * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // 6 mid-ground rocks
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
        const rx = w * rock.x + Math.sin(rs) * 15 * scale;
        const ry = horizonY + terrainH * rock.y;
        const rockScale = rock.size * (0.6 + rock.y * 0.5);
        const rw = (8 + Math.abs(Math.sin(rs * 1.5)) * 10) * rockScale * scale;
        const rh = rw * (0.45 + Math.sin(rs) * 0.1);

        const rockAngle = Math.sin(rs * 0.5) * 0.2;

        ctx.globalAlpha = isNight ? 0.04 : 0.1;
        ctx.fillStyle = '#1a1a10';
        ctx.beginPath();
        ctx.ellipse(rx + rw * 0.15, ry + rh * 0.4, rw * 0.9, rh * 0.3, rockAngle, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = isNight ? 0.3 : 0.55;
        ctx.fillStyle = isNight ? '#1a1a18' : '#4a4238';
        ctx.beginPath();
        ctx.ellipse(rx + rw * 0.08, ry + rh * 0.05, rw * 0.85, rh * 0.9, rockAngle, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = isNight ? 0.3 : 0.6;
        ctx.fillStyle = isNight ? '#2a2a28' : '#6a6258';
        ctx.beginPath();
        ctx.ellipse(rx, ry, rw * 0.9, rh * 0.85, rockAngle, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = isNight ? 0.08 : 0.25;
        ctx.fillStyle = isNight ? '#3a3a38' : '#9a9488';
        ctx.beginPath();
        ctx.ellipse(rx - rw * 0.15, ry - rh * 0.2, rw * 0.55, rh * 0.45, rockAngle - 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = isNight ? 0.02 : 0.1;
        ctx.fillStyle = '#c8c0b0';
        ctx.beginPath();
        ctx.ellipse(rx - rw * 0.2, ry - rh * 0.3, rw * 0.2, rh * 0.15, 0, 0, Math.PI * 2);
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
    const scale = Math.min(w / 1200, 1);

    ctx.save();

    for (let i = 0; i < 2; i++) {
        const hs = seed * 4.7 + i * 31.3;
        const hillCx = w * (0.25 + i * 0.5) + Math.sin(hs) * w * 0.1;
        const hillTop = horizonY + terrainH * (0.15 + Math.sin(hs * 1.3) * 0.08);
        const hillW = w * (0.25 + Math.abs(Math.sin(hs * 2.1)) * 0.15);
        const hillH = terrainH * 0.12;

        ctx.globalAlpha = 0.08;
        ctx.fillStyle = visuals.groundLight;
        ctx.beginPath();
        ctx.moveTo(hillCx - hillW, horizonY + terrainH * 0.35);
        ctx.quadraticCurveTo(hillCx - hillW * 0.3, hillTop, hillCx, hillTop);
        ctx.quadraticCurveTo(hillCx + hillW * 0.3, hillTop, hillCx + hillW, horizonY + terrainH * 0.35);
        ctx.closePath();
        ctx.fill();

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

    ctx.globalAlpha = 0.06;
    ctx.fillStyle = visuals.groundBase;
    ctx.beginPath();
    ctx.moveTo(0, horizonY + 8 * scale);
    for (let x = 0; x <= w; x += 5) {
        const rise = Math.sin(x / (120 * scale) + seed * 0.9) * 4 * scale + Math.sin(x / (50 * scale) + seed * 2.1) * 2 * scale;
        ctx.lineTo(x, horizonY + 3 * scale + rise);
    }
    ctx.lineTo(w, horizonY + 15 * scale);
    ctx.lineTo(0, horizonY + 15 * scale);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.1;
    ctx.fillStyle = visuals.groundDark;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 5) {
        const rise = h - terrainH * 0.08 - Math.sin(x / (200 * scale) + seed * 1.5) * 8 * scale;
        ctx.lineTo(x, rise);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// --- Foreground grass (1x scale, bottom edge) ---

function drawForegroundGrass(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    seed: number,
    t: number,
    state: ColonySceneStateComponent,
): void {
    const wScale = Math.min(w / 1200, 1);
    const weather = getWeatherInfo(state);
    const windLean = weather.windAngle * 12 * wScale;
    const rainBoost = weather.rainIntensity * 3 * wScale;

    const fgGreens = ['#2a5a1a', '#1a4a12', '#1a5a18', '#2a6a20'];
    const fgCount = 80;

    ctx.save();
    ctx.lineCap = 'round';

    for (let i = 0; i < fgCount; i++) {
        const ds = seed * 11.3 + i * 9.7;
        const dx = (i / fgCount) * w + Math.sin(ds * 1.3) * 12 * wScale + Math.sin(ds * 3.7) * 6 * wScale;
        const dy = h - Math.abs(Math.sin(ds * 1.7)) * 8 * wScale + 3 * wScale;
        const scale = 1.0 + Math.abs(Math.sin(ds * 2.1)) * 0.6;

        const sway = Math.sin(t / 1400 + dx * 0.005 + i * 0.4) * (3.5 * wScale + rainBoost) + windLean;

        const bladeCount = 4 + Math.floor(Math.abs(Math.sin(ds * 3.1)) * 4);
        const colourIdx = Math.floor(Math.abs(Math.sin(ds * 4.3)) * fgGreens.length);

        ctx.strokeStyle = fgGreens[colourIdx];
        ctx.globalAlpha = 0.6 + Math.abs(Math.sin(ds * 1.1)) * 0.3;
        ctx.lineWidth = (1.0 + Math.abs(Math.sin(ds * 2.7)) * 0.5) * scale * wScale;

        for (let j = 0; j < bladeCount; j++) {
            const gx = dx + (j - bladeCount / 2) * 2.8 * scale * wScale;
            const heightMod = 0.7 + Math.abs(Math.sin(ds + j * 1.9)) * 0.6;
            const bladeH = (14 + Math.abs(Math.sin(ds + j * 1.5)) * 12) * scale * heightMod * wScale;
            const bladeLean = sway + Math.sin(ds + j * 0.9) * 3 * wScale;

            ctx.beginPath();
            ctx.moveTo(gx, dy);
            ctx.quadraticCurveTo(
                gx + bladeLean * 0.3, dy - bladeH * 0.5,
                gx + bladeLean * 0.7, dy - bladeH,
            );
            ctx.stroke();
        }
    }

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
    state: ColonySceneStateComponent,
): void {
    if (visuals.horizonFeature !== 'trees') return;

    const scale = Math.min(w / 1200, 1);
    const dayNight = getDayNightState(state.gameHour);
    const isNight = dayNight.ambientLight < 0.3;
    const weather = getWeatherInfo(state);
    const windLean = weather.windAngle * 15 * scale;

    ctx.save();

    const trees = [
        { x: w * 0.03, trunkVisible: true },
        { x: w * 0.92, trunkVisible: true },
        { x: w * -0.02, trunkVisible: true },
    ];

    for (let i = 0; i < trees.length; i++) {
        const tree = trees[i];
        const ts = seed * 5.1 + i * 17.3;
        const tx = tree.x + Math.sin(ts) * 10 * scale;
        const treeH = h * 0.5 + Math.abs(Math.sin(ts * 1.3)) * h * 0.08;
        const trunkW = (8 + Math.abs(Math.sin(ts * 2.1)) * 5) * scale;
        const canopyW = (40 + Math.abs(Math.sin(ts * 1.7)) * 20) * scale;

        const sway = Math.sin(t / 1500 + i * 2.1) * 6 * scale + windLean * 1.5;

        const trunkBaseY = h * 0.92;
        const trunkTopY = trunkBaseY - treeH * 0.6;

        // Trunk
        ctx.globalAlpha = isNight ? 0.4 : 0.6;
        ctx.fillStyle = isNight ? '#1a1510' : '#3a2a18';
        ctx.beginPath();
        ctx.moveTo(tx - trunkW, trunkBaseY);
        ctx.quadraticCurveTo(tx - trunkW * 0.6 + sway * 0.15, trunkTopY + treeH * 0.25, tx - trunkW * 0.2 + sway * 0.4, trunkTopY);
        ctx.lineTo(tx + trunkW * 0.2 + sway * 0.4, trunkTopY);
        ctx.quadraticCurveTo(tx + trunkW * 0.6 + sway * 0.15, trunkTopY + treeH * 0.25, tx + trunkW, trunkBaseY);
        ctx.closePath();
        ctx.fill();

        // Bark texture
        ctx.strokeStyle = isNight ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 0.5;
        for (let b = 0; b < 4; b++) {
            const bx = tx + (b - 1.5) * trunkW * 0.3;
            ctx.beginPath();
            ctx.moveTo(bx, trunkBaseY - 10 * scale);
            ctx.lineTo(bx + sway * 0.1, trunkTopY + 20 * scale);
            ctx.stroke();
        }

        // Grass around trunk base
        ctx.globalAlpha = isNight ? 0.2 : 0.4;
        ctx.strokeStyle = isNight ? '#1a2a12' : '#3a6a28';
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        for (let g = 0; g < 8; g++) {
            const gx = tx + (g - 3.5) * 5 * scale;
            const gy = trunkBaseY - 3 * scale;
            const gh = (6 + Math.abs(Math.sin(ts + g * 1.3)) * 6) * scale;
            const gl = Math.sin(ts + g * 0.7) * 2 * scale + sway * 0.2;
            ctx.beginPath();
            ctx.moveTo(gx, gy);
            ctx.quadraticCurveTo(gx + gl * 0.4, gy - gh * 0.6, gx + gl, gy - gh);
            ctx.stroke();
        }

        // Canopy zones
        const canopyCx = tx + sway;
        const canopyCy = trunkTopY - canopyW * 0.15;

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
                const dx = tx + Math.sin(ts + d * 3.1) * 30 * scale;
                const dy = trunkBaseY - 10 * scale + Math.sin(ts + d * 2.7) * 10 * scale;
                const dr = (10 + Math.sin(ts + d) * 6) * scale;
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

// drawPaths removed — replaced by grid-based path tiles in colonyGridRenderer.ts

// --- Building shadows ---

function drawBuildingShadows(
    ctx: CanvasRenderingContext2D,
    _region: Region,
    slotRects: ColonySlotRect[],
    dayNight: DayNightState,
): void {
    if (dayNight.phase === 'night') return;

    const shadowAlpha = 0.15 + dayNight.ambientLight * 0.1;
    const shadowOffsetX = Math.cos(dayNight.shadowAngle) * 4 * dayNight.shadowLength;
    const shadowOffsetY = Math.sin(dayNight.shadowAngle) * 2 * dayNight.shadowLength;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';

    for (const rect of slotRects) {
        if (!rect.occupied) continue;

        ctx.globalAlpha = shadowAlpha;
        const sx = rect.x + rect.width / 2 + shadowOffsetX;
        const sy = rect.y + rect.height * 0.5 + shadowOffsetY;
        const shadowW = TILE_WIDTH * 0.45;
        const shadowH = TILE_HEIGHT * 0.3;

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
    if (dayNight.ambientLight < 0.9) {
        const darkness = 1 - dayNight.ambientLight;
        ctx.save();
        ctx.globalAlpha = darkness * 0.6;
        ctx.fillStyle = dayNight.warmth < 0 ? '#0a0a20' : '#1a1008';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

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
            px = (Math.sin(seed) * 0.5 + 0.5) * w + Math.sin(t / 3000 + seed) * 20;
            py = ((t / 4000 + seed * 0.3) % 1.2 - 0.1) * h;
            size = 1.5 + Math.sin(seed * 2) * 1;
        } else if (visuals.particleType === 'embers') {
            px = (Math.sin(seed * 1.3) * 0.5 + 0.5) * w + Math.sin(t / 1500 + seed) * 30;
            py = h - ((t / 3000 + seed * 0.4) % 1.2) * h;
            size = 1 + Math.sin(seed) * 1;
        } else if (visuals.particleType === 'fireflies') {
            px = (Math.sin(seed * 1.7) * 0.5 + 0.5) * w + Math.sin(t / 1000 + seed) * 40;
            py = h * 0.4 + Math.sin(t / 1200 + seed * 2) * h * 0.25;
            size = 1.5 + Math.sin(t / 500 + seed) * 0.5;
            ctx.globalAlpha = 0.3 + Math.sin(t / 400 + seed * 3) * 0.3;
        } else {
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

// --- Building slot data collection + RenderQueue registration ---

/** Collected data for a single building slot (no drawing). */
interface BuildingSlotData {
    slotIndex: number;
    building: BuildingInstance | null;
    screenPos: { x: number; y: number };
    rect: ColonySlotRect;
    frontDepth: number;
}

/** Collect building slot positions and rects without drawing. */
function collectBuildingSlotData(
    region: Region,
    sim: ColonySimulationComponent | null,
    gridCentre: { centreX: number; centreY: number },
): { slotData: BuildingSlotData[]; slotRects: ColonySlotRect[] } {
    const slotData: BuildingSlotData[] = [];
    const slotRects: ColonySlotRect[] = [];
    const totalSlots = region.buildingSlots;
    if (totalSlots === 0 || !sim) return { slotData, slotRects };

    const centreX = gridCentre.centreX;
    const centreY = gridCentre.centreY;

    for (let i = 0; i < totalSlots; i++) {
        const building = region.buildings.find(b => b.slotIndex === i) ?? null;

        let screenPos: { x: number; y: number };
        const buildingCenter = sim.grid.getBuildingCenter(i);
        if (buildingCenter) {
            screenPos = gridToScreen(buildingCenter.gridX, buildingCenter.gridY, centreX, centreY);
        } else {
            const pos = sim.grid.getBuildingPosition(i);
            if (pos) {
                // For empty slots, use max footprint (3x3) so the slot marker is centred
                // where any building type would render — prevents position shift on build.
                const footprint = building ? getBuildingFootprint(building.typeId) : { w: 3, h: 3 };
                screenPos = gridToScreen(pos.gx + footprint.w / 2, pos.gy + footprint.h / 2, centreX, centreY);
            } else {
                continue;
            }
        }

        const rect: ColonySlotRect = {
            slotIndex: i,
            x: screenPos.x - TILE_WIDTH / 2,
            y: screenPos.y - TILE_HEIGHT,
            width: TILE_WIDTH,
            height: TILE_HEIGHT * 2,
            occupied: building !== null,
        };
        slotRects.push(rect);

        // Compute front depth from grid extent, or fallback to building center depth
        const frontDepth = sim.grid.getBuildingFrontDepth(i);
        const centerForDepth = sim.grid.getBuildingCenter(i);
        const depth = frontDepth ?? (centerForDepth ? centerForDepth.gridX + centerForDepth.gridY : i * 2);

        slotData.push({ slotIndex: i, building, screenPos, rect, frontDepth: depth });
    }

    return { slotData, slotRects };
}

/** Draw a single occupied building slot (building sprite + label). */
function drawSingleBuildingSlot(
    ctx: CanvasRenderingContext2D,
    data: BuildingSlotData,
    t: number,
    state: ColonySceneStateComponent,
    isOccluding: boolean,
): void {
    const { building, screenPos } = data;
    if (!building) return;

    ctx.save();
    if (isOccluding) {
        ctx.globalAlpha = 0.4;
    }

    drawBuilding(ctx, building.typeId, screenPos.x, screenPos.y, building.state, t, state.gameHour);

    // Building name label
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = isOccluding ? 0.3 : 0.8;
    ctx.font = '10px "Share Tech Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    const bt = getBuildingType(building.typeId);
    ctx.fillText(bt.name.toUpperCase(), screenPos.x, screenPos.y + TILE_HEIGHT * 0.7);

    if (building.state === 'constructing') {
        ctx.fillStyle = '#ffca28';
        ctx.fillText(`(${building.turnsRemaining} TURNS)`, screenPos.x, screenPos.y + TILE_HEIGHT * 0.7 + 12);
    }

    ctx.restore();
}

/** Draw a single empty building slot (diamond outline + plus marker). */
function drawSingleEmptySlot(
    ctx: CanvasRenderingContext2D,
    data: BuildingSlotData,
    state: ColonySceneStateComponent,
): void {
    const { screenPos, slotIndex } = data;
    const isHovered = state.hoveredSlotIndex === slotIndex;

    ctx.save();
    ctx.globalAlpha = isHovered ? 0.5 : 0.25;
    drawIsometricTile(
        ctx, screenPos.x, screenPos.y,
        isHovered ? 'rgba(79, 168, 255, 0.2)' : 'rgba(255,255,255,0.15)',
        isHovered ? '#4fa8ff' : 'rgba(200, 210, 220, 0.6)',
    );

    ctx.globalAlpha = isHovered ? 0.7 : 0.4;
    ctx.fillStyle = isHovered ? '#4fa8ff' : '#c0c8d8';
    ctx.fillRect(screenPos.x - 10, screenPos.y - 1.5, 20, 3);
    ctx.fillRect(screenPos.x - 1.5, screenPos.y - 10, 3, 20);

    if (isHovered) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#4fa8ff';
        ctx.font = '9px "Share Tech Mono", "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BUILD', screenPos.x, screenPos.y + TILE_HEIGHT * 0.7);
    }
    ctx.restore();
}

/** Compute the isometric depth of the selected colonist, or null. */
function computeSelectedColonistDepth(
    colonists: ColonistVisualState[],
    selectedId: number | null,
): number | null {
    if (selectedId === null) return null;
    for (const c of colonists) {
        if (c.entityId === selectedId) {
            return c.gridX + c.gridY;
        }
    }
    return null;
}

/** Register occupied buildings into the RenderQueue. */
function registerBuildings(
    queue: RenderQueue,
    slotData: BuildingSlotData[],
    region: Region,
    t: number,
    state: ColonySceneStateComponent,
    selectedColonistDepth: number | null,
    grid: ColonyGrid,
    gridCentre: { centreX: number; centreY: number },
): void {
    for (const data of slotData) {
        if (!data.building) continue;

        const isOccluding = selectedColonistDepth !== null && selectedColonistDepth < data.frontDepth;

        queue.add({
            depth: data.frontDepth,
            kind: 'building',
            screenX: data.screenPos.x,
            screenY: data.screenPos.y,
            label: data.building.typeId,
            slotIndex: data.slotIndex,
            hitRect: { x: data.rect.x, y: data.rect.y, width: data.rect.width, height: data.rect.height },
            draw: (ctx) => {
                drawSingleBuildingSlot(ctx, data, t, state, isOccluding);
            },
        });

        // Register props as separate Renderables at building depth + epsilon
        queue.add({
            depth: data.frontDepth + 0.01,
            kind: 'prop',
            screenX: data.screenPos.x,
            screenY: data.screenPos.y,
            label: `props:${data.building.typeId}`,
            draw: (ctx) => {
                drawSettlementPropsForSlot(ctx, region, data.rect, t, state.gameHour, grid, gridCentre.centreX, gridCentre.centreY);
            },
        });
    }
}

const COLONIST_HIT_RADIUS = 12;

/** Register colonists into the RenderQueue. */
function registerColonists(
    queue: RenderQueue,
    colonists: ColonistVisualState[],
    gridCentre: { centreX: number; centreY: number },
    t: number,
    state: ColonySceneStateComponent,
    slotData: BuildingSlotData[],
): void {
    for (const colonist of colonists) {
        const screen = gridToScreen(colonist.gridX, colonist.gridY, gridCentre.centreX, gridCentre.centreY);
        const depth = colonist.gridX + colonist.gridY;
        const isWalking = colonist.activity === 'walking' || colonist.activity === 'patrolling';
        const isSelected = colonist.entityId === state.selectedColonistId;

        queue.add({
            depth,
            kind: 'colonist',
            screenX: screen.x,
            screenY: screen.y,
            label: colonist.name.split(' ')[0],
            entityId: colonist.entityId,
            hitRadius: COLONIST_HIT_RADIUS,
            draw: (ctx) => {
                // Depth-aware shadow stretching toward nearby buildings
                const nearbyBuildings = slotData.filter(sd => {
                    if (!sd.building) return false;
                    const center = sd.screenPos;
                    const dx = Math.abs(center.x - screen.x);
                    const dy = Math.abs(center.y - screen.y);
                    return dx < TILE_WIDTH * 1.5 && dy < TILE_HEIGHT * 2;
                });

                drawFigure(ctx, screen.x, screen.y, colonist, t, isWalking, isSelected, nearbyBuildings.length > 0 ? nearbyBuildings[0].screenPos : undefined);
            },
        });

        // Footstep dust particles for walking colonists
        if (isWalking) {
            queue.add({
                depth,
                kind: 'prop',
                screenX: screen.x,
                screenY: screen.y,
                label: 'dust',
                draw: (ctx) => {
                    drawFootstepDust(ctx, screen.x, screen.y, colonist.walkPhase, t);
                },
            });
        }
    }
}

/** Register empty building slots into the RenderQueue. */
function registerEmptySlots(
    queue: RenderQueue,
    slotData: BuildingSlotData[],
    state: ColonySceneStateComponent,
): void {
    for (const data of slotData) {
        if (data.building) continue;

        queue.add({
            depth: data.frontDepth,
            kind: 'empty-slot',
            screenX: data.screenPos.x,
            screenY: data.screenPos.y,
            label: `slot:${data.slotIndex}`,
            slotIndex: data.slotIndex,
            hitRect: { x: data.rect.x, y: data.rect.y, width: data.rect.width, height: data.rect.height },
            draw: (ctx) => {
                drawSingleEmptySlot(ctx, data, state);
            },
        });
    }
}

/** Draw footstep dust puffs at colonist feet. */
function drawFootstepDust(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    walkPhase: number,
    t: number,
): void {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = 'rgba(160, 140, 100, 0.5)';

    // 2-3 small circles that appear timed to step cycle
    const step = Math.abs(Math.sin(walkPhase));
    if (step < 0.3) {
        ctx.restore();
        return;
    }

    const drift = Math.sin(t / 200) * 2;
    for (let i = 0; i < 3; i++) {
        const dx = (i - 1) * 2 + drift;
        const dy = 2 + i * 0.5;
        const r = 1 + Math.sin(walkPhase + i) * 0.5;
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/** Draw silhouette of selected colonist through occluding buildings. */
function drawOccludedColonistSilhouette(
    ctx: CanvasRenderingContext2D,
    colonists: ColonistVisualState[],
    slotData: BuildingSlotData[],
    state: ColonySceneStateComponent,
    gridCentre: { centreX: number; centreY: number },
    t: number,
): void {
    if (state.selectedColonistId === null) return;

    const colonist = colonists.find(c => c.entityId === state.selectedColonistId);
    if (!colonist) return;

    const colonistDepth = colonist.gridX + colonist.gridY;

    // Check if any building with higher front depth occludes the selected colonist
    const occludingBuildings = slotData.filter(sd =>
        sd.building !== null && sd.frontDepth > colonistDepth
    );

    if (occludingBuildings.length === 0) return;

    const screen = gridToScreen(colonist.gridX, colonist.gridY, gridCentre.centreX, gridCentre.centreY);
    const isWalking = colonist.activity === 'walking' || colonist.activity === 'patrolling';

    // Draw a semi-transparent silhouette on top of occluding buildings
    ctx.save();
    ctx.globalAlpha = 0.25;
    drawFigure(ctx, screen.x, screen.y, colonist, t, isWalking, true);
    ctx.restore();
}

// drawCrewOnSurface removed — replaced by ColonistManager + colonyGridRenderer.ts

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
    const state = entity.getComponent(ColonySceneStateComponent);
    const w = state ? state.viewTransform.canvasW : ctx.canvas.width;
    const h = state ? state.viewTransform.canvasH : ctx.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (progress < 0.4) {
        const phase = progress / 0.4;
        ctx.fillStyle = `rgba(3, 4, 10, ${phase})`;
        ctx.fillRect(0, 0, w, h);
    } else if (progress < 0.5) {
        ctx.fillStyle = '#03040a';
        ctx.fillRect(0, 0, w, h);
    } else {
        const phase = (progress - 0.5) / 0.5;
        ctx.save();
        ctx.globalAlpha = phase;
        drawColonyScene(entity, ctx, regionId);
        ctx.restore();
        ctx.fillStyle = `rgba(3, 4, 10, ${1 - phase})`;
        ctx.fillRect(0, 0, w, h);
    }
}

export function drawTransitionFromColony(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    regionId: number,
    progress: number,
): void {
    const state = entity.getComponent(ColonySceneStateComponent);
    const w = state ? state.viewTransform.canvasW : ctx.canvas.width;
    const h = state ? state.viewTransform.canvasH : ctx.canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (progress < 0.4) {
        const phase = progress / 0.4;
        ctx.save();
        ctx.globalAlpha = 1 - phase;
        drawColonyScene(entity, ctx, regionId);
        ctx.restore();
        ctx.fillStyle = `rgba(3, 4, 10, ${phase})`;
        ctx.fillRect(0, 0, w, h);
    } else if (progress < 0.5) {
        ctx.fillStyle = '#03040a';
        ctx.fillRect(0, 0, w, h);
    } else {
        const phase = (progress - 0.5) / 0.5;
        ctx.fillStyle = `rgba(3, 4, 10, ${1 - phase})`;
        ctx.fillRect(0, 0, w, h);
    }
}
