// createPlanet.ts — Factory for planet entities.
// Creates a planet entity from a PlanetConfig. Handles rendering dispatch
// between system view (globe) and planet view (surface/atmosphere).
// Rocky planets show Voronoi surface regions; gas giants show banded atmospheres.

import { ServiceLocator } from '../core/ServiceLocator';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { OrbitComponent } from '../components/OrbitComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import { RegionDataComponent } from '../components/RegionDataComponent';
import { PlanetDataComponent } from '../components/PlanetDataComponent';
import { GameModeComponent } from '../components/GameModeComponent';
import { PlanetViewInputComponent } from '../components/PlanetViewInputComponent';
import { ColoniseUIComponent } from '../components/ColoniseUIComponent';
import { PlanetInfoUIComponent } from '../components/PlanetInfoUIComponent';
import { generateVoronoi } from '../utils/voronoi';
import { assignBiomes } from '../data/biomes';
import { polygonCentroid } from '../utils/geometry';
import { mulberry32 } from '../utils/prng';
import type { PlanetConfig } from '../data/planets';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

// ---------------------------------------------------------------------------
// System map drawing — rocky planet globe
// ---------------------------------------------------------------------------

function drawRockyGlobe(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    config: PlanetConfig,
): void {
    const t = performance.now();
    const r = config.radius;

    const selectable = entity.getComponent(SelectableComponent);
    const hovered = selectable?.hovered ?? false;

    // Hover highlight ring
    if (hovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(79, 168, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const glowGrad = ctx.createRadialGradient(x, y, r + 4, x, y, r + 16);
        glowGrad.addColorStop(0, 'rgba(79, 168, 255, 0.15)');
        glowGrad.addColorStop(1, 'rgba(79, 168, 255, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, r + 16, 0, Math.PI * 2);
        ctx.fill();
    }

    // Orbit ring
    const orbit = entity.getComponent(OrbitComponent);
    if (orbit) {
        ctx.beginPath();
        ctx.arc(orbit.centreX, orbit.centreY, orbit.radius, 0, Math.PI * 2);
        ctx.strokeStyle = config.palette.orbitRing;
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 12]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Atmospheric glow — star is at world origin (0, 0)
    const angleToStar = Math.atan2(0 - y, 0 - x);
    const glowX = x + Math.cos(angleToStar) * (r * 0.3);
    const glowY = y + Math.sin(angleToStar) * (r * 0.3);
    const atmosGrad = ctx.createRadialGradient(glowX, glowY, r * 0.5, x, y, r + 6);
    atmosGrad.addColorStop(0, config.palette.atmosphere);
    atmosGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = atmosGrad;
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.fill();

    // Planet body (clipped circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    // Base body gradient
    const bodyGrad = ctx.createRadialGradient(
        x - r * 0.3, y - r * 0.3, r * 0.1,
        x, y, r,
    );
    bodyGrad.addColorStop(0, config.palette.body);
    bodyGrad.addColorStop(1, config.palette.bodyAlt);
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    // Planet-specific surface features
    if (config.name === 'newTerra') {
        drawNewTerraSurface(ctx, x, y, r, t);
    } else if (config.name === 'ember') {
        drawEmberSurface(ctx, x, y, r, t);
    } else if (config.name === 'dust') {
        drawDustSurface(ctx, x, y, r, t);
    }

    // Shadow
    const shadowX = x - Math.cos(angleToStar) * r * 0.5;
    const shadowY = y - Math.sin(angleToStar) * r * 0.5;
    const shadowGrad = ctx.createRadialGradient(
        shadowX, shadowY, r * 0.2,
        shadowX, shadowY, r * 1.2,
    );
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    ctx.restore();
}

/** New Terra: oceans, continents, clouds */
function drawNewTerraSurface(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    t: number,
): void {
    const spin = (t / 20000) * r * 2;
    const wrap = r * 4;

    // Land patches
    ctx.globalAlpha = 0.4;
    const landColours = ['#4a9a5a', '#3a8a4a', '#5aaa6a', '#3a7a3a'];
    const landPatches = [
        { xOff: 0.0, yOff: -0.3, w: 0.5, h: 0.35 },
        { xOff: 1.2, yOff: 0.1, w: 0.7, h: 0.3 },
        { xOff: 2.4, yOff: -0.15, w: 0.4, h: 0.5 },
        { xOff: 3.2, yOff: 0.35, w: 0.55, h: 0.25 },
    ];
    for (let i = 0; i < landPatches.length; i++) {
        const p = landPatches[i];
        const rawX = (p.xOff * r + spin) % wrap - r;
        ctx.fillStyle = landColours[i];
        ctx.beginPath();
        ctx.ellipse(x + rawX, y + p.yOff * r, p.w * r, p.h * r, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Cloud bands
    const cloudSpin = (t / 16000) * r * 2;
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    const cloudBands = [
        { xOff: 0.5, yOff: -0.35, w: 0.8, h: 0.12 },
        { xOff: 2.0, yOff: 0.25, w: 0.6, h: 0.1 },
        { xOff: 3.5, yOff: -0.05, w: 0.9, h: 0.08 },
    ];
    for (const c of cloudBands) {
        const rawX = (c.xOff * r + cloudSpin) % wrap - r;
        ctx.beginPath();
        ctx.ellipse(x + rawX, y + c.yOff * r, c.w * r, c.h * r, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

/** Ember: volcanic cracks and faint glow spots */
function drawEmberSurface(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    t: number,
): void {
    const spin = (t / 30000) * r * 2;
    const wrap = r * 4;

    // Volcanic glow spots
    ctx.globalAlpha = 0.3;
    const glowSpots = [
        { xOff: 0.2, yOff: -0.2, size: 0.25 },
        { xOff: 1.5, yOff: 0.3, size: 0.2 },
        { xOff: 2.8, yOff: -0.1, size: 0.3 },
    ];
    for (const spot of glowSpots) {
        const rawX = (spot.xOff * r + spin) % wrap - r;
        const pulse = 0.7 + 0.3 * Math.sin(t / 3000 + spot.xOff);
        const grad = ctx.createRadialGradient(
            x + rawX, y + spot.yOff * r, 0,
            x + rawX, y + spot.yOff * r, spot.size * r,
        );
        grad.addColorStop(0, `rgba(255, 120, 20, ${(0.6 * pulse).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255, 80, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x + rawX, y + spot.yOff * r, spot.size * r, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

/** Dust: craters and pale surface texture */
function drawDustSurface(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    _t: number,
): void {
    // Static craters
    ctx.globalAlpha = 0.2;
    const craters = [
        { xOff: -0.3, yOff: -0.2, size: 0.15 },
        { xOff: 0.2, yOff: 0.3, size: 0.12 },
        { xOff: 0.4, yOff: -0.1, size: 0.2 },
        { xOff: -0.1, yOff: 0.15, size: 0.08 },
    ];
    for (const crater of craters) {
        ctx.beginPath();
        ctx.arc(x + crater.xOff * r, y + crater.yOff * r, crater.size * r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(60, 50, 40, 0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = 'rgba(80, 70, 55, 0.3)';
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;
}

// ---------------------------------------------------------------------------
// System map drawing — gas giant globe
// ---------------------------------------------------------------------------

function drawGasGiantGlobe(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    config: PlanetConfig,
): void {
    const t = performance.now();
    const r = config.radius;

    const selectable = entity.getComponent(SelectableComponent);
    const hovered = selectable?.hovered ?? false;

    // Hover highlight
    if (hovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 10, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(79, 168, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();

        const glowGrad = ctx.createRadialGradient(x, y, r + 5, x, y, r + 20);
        glowGrad.addColorStop(0, 'rgba(79, 168, 255, 0.15)');
        glowGrad.addColorStop(1, 'rgba(79, 168, 255, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, r + 20, 0, Math.PI * 2);
        ctx.fill();
    }

    // Orbit ring
    const orbit = entity.getComponent(OrbitComponent);
    if (orbit) {
        ctx.beginPath();
        ctx.arc(orbit.centreX, orbit.centreY, orbit.radius, 0, Math.PI * 2);
        ctx.strokeStyle = config.palette.orbitRing;
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 12]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Atmospheric glow
    const angleToStar = Math.atan2(0 - y, 0 - x);
    const glowX = x + Math.cos(angleToStar) * (r * 0.2);
    const glowY = y + Math.sin(angleToStar) * (r * 0.2);
    const atmosGrad = ctx.createRadialGradient(glowX, glowY, r * 0.5, x, y, r + 10);
    atmosGrad.addColorStop(0, config.palette.atmosphere);
    atmosGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = atmosGrad;
    ctx.beginPath();
    ctx.arc(x, y, r + 10, 0, Math.PI * 2);
    ctx.fill();

    // Planet body
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    // Base gradient
    const bodyGrad = ctx.createLinearGradient(x, y - r, x, y + r);
    bodyGrad.addColorStop(0, config.palette.body);
    bodyGrad.addColorStop(0.5, config.palette.bodyAlt);
    bodyGrad.addColorStop(1, config.palette.body);
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    // Horizontal atmospheric bands
    if (config.name === 'goliath') {
        drawGoliathBands(ctx, x, y, r, t);
    } else if (config.name === 'shepherd') {
        drawShepherdBands(ctx, x, y, r, t);
    }

    // Shadow
    const shadowX = x - Math.cos(angleToStar) * r * 0.4;
    const shadowY = y - Math.sin(angleToStar) * r * 0.4;
    const shadowGrad = ctx.createRadialGradient(
        shadowX, shadowY, r * 0.2,
        shadowX, shadowY, r * 1.2,
    );
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    ctx.restore();

    // Shepherd's rings (drawn outside clip)
    if (config.name === 'shepherd') {
        drawRings(ctx, x, y, r);
    }
}

/** Goliath: amber/cream bands with storm spot */
function drawGoliathBands(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    t: number,
): void {
    const bandColours = [
        'rgba(220, 180, 80, 0.3)',
        'rgba(180, 140, 60, 0.2)',
        'rgba(240, 200, 120, 0.25)',
        'rgba(160, 120, 50, 0.2)',
        'rgba(200, 160, 70, 0.3)',
    ];

    ctx.globalAlpha = 0.6;
    for (let i = 0; i < bandColours.length; i++) {
        const bandY = y - r + (r * 2 * (i + 0.5)) / bandColours.length;
        const bandH = (r * 2) / bandColours.length * 0.6;
        ctx.fillStyle = bandColours[i];
        ctx.fillRect(x - r, bandY - bandH / 2, r * 2, bandH);
    }

    // Great Storm spot
    const stormPulse = 0.8 + 0.2 * Math.sin(t / 4000);
    const stormGrad = ctx.createRadialGradient(
        x + r * 0.2, y + r * 0.15, 0,
        x + r * 0.2, y + r * 0.15, r * 0.18,
    );
    stormGrad.addColorStop(0, `rgba(200, 80, 30, ${(0.5 * stormPulse).toFixed(3)})`);
    stormGrad.addColorStop(1, 'rgba(180, 100, 40, 0)');
    ctx.fillStyle = stormGrad;
    ctx.beginPath();
    ctx.ellipse(x + r * 0.2, y + r * 0.15, r * 0.18, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;
}

/** Shepherd: blue-green bands */
function drawShepherdBands(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    _t: number,
): void {
    const bandColours = [
        'rgba(80, 160, 140, 0.25)',
        'rgba(60, 130, 120, 0.2)',
        'rgba(100, 180, 160, 0.3)',
        'rgba(50, 110, 100, 0.2)',
    ];

    ctx.globalAlpha = 0.5;
    for (let i = 0; i < bandColours.length; i++) {
        const bandY = y - r + (r * 2 * (i + 0.5)) / bandColours.length;
        const bandH = (r * 2) / bandColours.length * 0.5;
        ctx.fillStyle = bandColours[i];
        ctx.fillRect(x - r, bandY - bandH / 2, r * 2, bandH);
    }
    ctx.globalAlpha = 1.0;
}

/** Shepherd's ring system — thin tilted ellipse */
function drawRings(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
): void {
    ctx.save();
    ctx.globalAlpha = 0.4;

    const innerRing = r * 1.3;
    const outerRing = r * 1.8;
    const tilt = 0.3; // vertical squash factor

    // Draw multiple ring lines
    for (let ring = innerRing; ring <= outerRing; ring += 2) {
        const alpha = 0.15 + 0.1 * ((ring - innerRing) / (outerRing - innerRing));
        ctx.beginPath();
        ctx.ellipse(x, y, ring, ring * tilt, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180, 200, 190, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.restore();
}

// ---------------------------------------------------------------------------
// Planet view drawing (surface map) — rocky planets only
// ---------------------------------------------------------------------------

function drawPlanetSurface(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
): void {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

    // Planet surface renders in screen space — reset camera transform
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const regionData = entity.getComponent(RegionDataComponent);
    if (!regionData) return;

    // Get hovered/selected region from PlanetViewInputComponent
    const inputComp = entity.getComponent(PlanetViewInputComponent);
    const hoveredId = inputComp?.hoveredRegionId ?? -1;
    const selectedId = inputComp?.selectedRegionId ?? -1;

    // Dark background
    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw each region
    for (const region of regionData.regions) {
        if (region.vertices.length < 3) continue;

        ctx.beginPath();
        ctx.moveTo(region.vertices[0].x, region.vertices[0].y);
        for (let i = 1; i < region.vertices.length; i++) {
            ctx.lineTo(region.vertices[i].x, region.vertices[i].y);
        }
        ctx.closePath();

        // Fill with biome colour (brighten on hover, stronger on selection)
        if (region.id === selectedId) {
            ctx.fillStyle = brightenColour(region.colour, 0.35);
        } else if (region.id === hoveredId) {
            ctx.fillStyle = brightenColour(region.colour, 0.2);
        } else {
            ctx.fillStyle = region.colour;
        }
        ctx.fill();

        // Border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Selected border: blue outline
        if (region.id === selectedId) {
            ctx.strokeStyle = 'rgba(79, 168, 255, 0.8)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // Landing zone: gold outline + label
        if (region.isLandingZone && !region.colonised) {
            ctx.strokeStyle = '#d4a020';
            ctx.lineWidth = 3;
            ctx.stroke();

            const centroid = polygonCentroid(region.vertices);
            ctx.fillStyle = '#d4a020';
            ctx.font = '10px "Share Tech Mono", "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('HABITABLE LANDING ZONE', centroid.x, centroid.y - 8);
        }

        // Colonised: settlement icon
        if (region.colonised) {
            const centroid = polygonCentroid(region.vertices);
            drawSettlement(ctx, centroid.x, centroid.y);
        }

        // Biome label on hover or selection
        if (region.id === hoveredId || region.id === selectedId) {
            const centroid = polygonCentroid(region.vertices);
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px "Share Tech Mono", "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(region.biome.toUpperCase(), centroid.x, centroid.y + 4);
        }
    }
}

/** Draw a simple settlement icon at the given position. */
function drawSettlement(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#d4a020';
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x, y - 10);
    ctx.lineTo(x + 8, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 6, y, 12, 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px "Share Tech Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('COLONY', x, y + 22);
}

/** Brighten a hex colour by a fraction (0-1). */
function brightenColour(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const brighten = (c: number): number => Math.min(255, Math.round(c + (255 - c) * amount));
    return `rgb(${brighten(r)}, ${brighten(g)}, ${brighten(b)})`;
}

// ---------------------------------------------------------------------------
// Gas giant planet view — atmospheric bands (no surface regions)
// ---------------------------------------------------------------------------

function drawGasGiantView(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
): void {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
    const planetData = entity.getComponent(PlanetDataComponent);
    if (!planetData) return;
    const config = planetData.config;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Dark background
    ctx.fillStyle = '#03040a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const viewR = Math.min(canvas.width, canvas.height) * 0.35;

    // Planet body
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, viewR, 0, Math.PI * 2);
    ctx.clip();

    // Base gradient
    const bodyGrad = ctx.createLinearGradient(cx, cy - viewR, cx, cy + viewR);
    bodyGrad.addColorStop(0, config.palette.body);
    bodyGrad.addColorStop(0.5, config.palette.bodyAlt);
    bodyGrad.addColorStop(1, config.palette.body);
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(cx - viewR, cy - viewR, viewR * 2, viewR * 2);

    // Animated bands
    const t = performance.now();
    const bandCount = 12;
    for (let i = 0; i < bandCount; i++) {
        const bandY = cy - viewR + (viewR * 2 * (i + 0.5)) / bandCount;
        const bandH = (viewR * 2) / bandCount * 0.5;
        const drift = Math.sin(t / 5000 + i * 0.5) * 3;
        const alpha = 0.1 + 0.08 * Math.sin(i * 1.3);
        ctx.fillStyle = `rgba(${i % 2 === 0 ? '255, 230, 180' : '180, 150, 100'}, ${alpha.toFixed(3)})`;
        ctx.fillRect(cx - viewR + drift, bandY - bandH / 2, viewR * 2, bandH);
    }

    ctx.restore();

    // Planet name label
    ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
    ctx.font = '16px "Share Tech Mono", "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(config.displayName.toUpperCase(), cx, cy + viewR + 30);
    ctx.font = '12px "Share Tech Mono", "Courier New", monospace';
    ctx.fillText('GAS GIANT — NO LANDABLE SURFACE', cx, cy + viewR + 50);
}

// ---------------------------------------------------------------------------
// Transition drawing
// ---------------------------------------------------------------------------

function drawTransitionToPlanet(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    config: PlanetConfig,
): void {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

    if (progress < 0.5) {
        const phase = progress / 0.5;
        const zoomScale = 1 + phase * 30;
        const fadeAlpha = 1 - phase;

        ctx.save();
        ctx.globalAlpha = fadeAlpha;
        ctx.translate(x, y);
        ctx.scale(zoomScale, zoomScale);
        ctx.translate(-x, -y);
        if (config.type === 'rocky') {
            drawRockyGlobe(entity, ctx, x, y, config);
        } else {
            drawGasGiantGlobe(entity, ctx, x, y, config);
        }
        ctx.restore();

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(3, 4, 10, ${phase * 0.8})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    } else if (progress < 0.6) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#03040a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    } else {
        const phase = (progress - 0.6) / 0.4;

        ctx.save();
        ctx.globalAlpha = phase;
        if (config.type === 'rocky') {
            drawPlanetSurface(entity, ctx);
        } else {
            drawGasGiantView(entity, ctx);
        }
        ctx.restore();

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(3, 4, 10, ${1 - phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
}

function drawTransitionToSystem(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    progress: number,
    config: PlanetConfig,
): void {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

    if (progress < 0.4) {
        const phase = progress / 0.4;

        ctx.save();
        ctx.globalAlpha = 1 - phase;
        if (config.type === 'rocky') {
            drawPlanetSurface(entity, ctx);
        } else {
            drawGasGiantView(entity, ctx);
        }
        ctx.restore();

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(3, 4, 10, ${phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    } else if (progress < 0.5) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#03040a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    } else {
        const phase = (progress - 0.5) / 0.5;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(3, 4, 10, ${1 - phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
}

// ---------------------------------------------------------------------------
// Mode-aware draw dispatcher
// ---------------------------------------------------------------------------

function drawPlanetDispatch(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const world = ServiceLocator.get<World>('world');
    const gameState = world.getEntityByName('gameState');
    const gameMode = gameState?.getComponent(GameModeComponent);
    const planetData = entity.getComponent(PlanetDataComponent);
    if (!planetData) return;
    const config = planetData.config;

    // Only the viewed planet renders in planet/transition modes
    const isViewedPlanet = gameMode?.planetEntityId === entity.id;

    if (!gameMode || gameMode.mode === 'system') {
        if (config.type === 'rocky') {
            drawRockyGlobe(entity, ctx, x, y, config);
        } else {
            drawGasGiantGlobe(entity, ctx, x, y, config);
        }
    } else if (gameMode.mode === 'planet' && isViewedPlanet) {
        if (config.type === 'rocky') {
            drawPlanetSurface(entity, ctx);
        } else {
            drawGasGiantView(entity, ctx);
        }
    } else if (gameMode.mode === 'transitioning-to-planet' && isViewedPlanet) {
        drawTransitionToPlanet(entity, ctx, x, y, gameMode.transitionProgress, config);
    } else if (gameMode.mode === 'transitioning-to-system' && isViewedPlanet) {
        drawTransitionToSystem(entity, ctx, gameMode.transitionProgress, config);
    }
    // Non-viewed planets are not rendered during planet view / transitions
}

// ---------------------------------------------------------------------------
// Entity factory
// ---------------------------------------------------------------------------

export function createPlanet(world: World, config: PlanetConfig): Entity {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

    const entity = world.createEntity(config.name);

    // Planet data
    entity.addComponent(new PlanetDataComponent(config));

    // Position and orbit — fixed world coordinates, centred on star at (0, 0)
    entity.addComponent(new TransformComponent(config.orbitRadius, 0));
    entity.addComponent(new OrbitComponent(0, 0, config.orbitRadius, config.orbitSpeed));
    entity.addComponent(new SelectableComponent(config.hitRadius));
    entity.addComponent(new RenderComponent('world', (ctx, x, y) => {
        drawPlanetDispatch(entity, ctx, x, y);
    }));

    // Surface regions for rocky planets
    if (config.type === 'rocky' && config.regionCount > 0) {
        const rng = mulberry32(7);
        const mapWidth = canvas.width;
        const mapHeight = canvas.height;
        const cells = generateVoronoi(mapWidth, mapHeight, config.regionCount, rng);
        const regions = assignBiomes(cells, rng, mapWidth, mapHeight);

        const regionData = entity.addComponent(new RegionDataComponent(config.regionCount));
        regionData.regions = regions;
    }

    // Planet view UI components
    entity.addComponent(new PlanetInfoUIComponent());
    entity.addComponent(new PlanetViewInputComponent());

    // Only colonisable planets get the colonise UI
    if (config.colonisable) {
        entity.addComponent(new ColoniseUIComponent());
    }

    return entity;
}
