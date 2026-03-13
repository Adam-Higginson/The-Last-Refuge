// createPlanet.ts — Factory for the New Terra planet entity.
// Renders a blue-green habitable world with atmospheric glow, cloud wisps,
// and shadow on the side facing away from the star. Shows a highlight ring
// when hovered. Draws a faint orbit ring centred on the star.
// Orbit is turn-based — position advances on 'turn:end' events.
//
// In planet view mode, renders the surface map with Voronoi biome regions.

import { ServiceLocator } from '../core/ServiceLocator';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { OrbitComponent } from '../components/OrbitComponent';
import { SelectableComponent } from '../components/SelectableComponent';
import { RegionDataComponent } from '../components/RegionDataComponent';
import { GameModeComponent } from '../components/GameModeComponent';
import { PlanetViewInputComponent } from '../components/PlanetViewInputComponent';
import { ColoniseUIComponent } from '../components/ColoniseUIComponent';
import { PlanetInfoUIComponent } from '../components/PlanetInfoUIComponent';
import { generateVoronoi } from '../utils/voronoi';
import { assignBiomes } from '../data/biomes';
import { polygonCentroid } from '../utils/geometry';
import { mulberry32 } from '../utils/prng';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Planet body radius in world units */
const PLANET_RADIUS = 12;

/** Hit radius for hover/click detection (slightly larger than visual) */
const HIT_RADIUS = 20;

/** Orbit speed in radians per turn (~8.6° per turn, full orbit in ~42 turns) */
const ORBIT_SPEED = 0.15;

/** Number of Voronoi cells for the surface map */
export const REGION_COUNT = 8;

/** Orbit radius in world units (35% of WORLD_SIZE = 1000) */
export const ORBIT_RADIUS = 350;

// ---------------------------------------------------------------------------
// System map drawing (globe)
// ---------------------------------------------------------------------------

function drawPlanetGlobe(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const t = performance.now();
    const r = PLANET_RADIUS;

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
        ctx.strokeStyle = 'rgba(90, 140, 220, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 8]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Atmospheric glow — star is at world origin (0, 0)
    const angleToStar = Math.atan2(0 - y, 0 - x);

    const glowX = x + Math.cos(angleToStar) * (r * 0.3);
    const glowY = y + Math.sin(angleToStar) * (r * 0.3);
    const atmosGrad = ctx.createRadialGradient(glowX, glowY, r * 0.5, x, y, r + 6);
    atmosGrad.addColorStop(0, 'rgba(120, 200, 255, 0.15)');
    atmosGrad.addColorStop(1, 'rgba(120, 200, 255, 0)');
    ctx.fillStyle = atmosGrad;
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.fill();

    // Planet body (clipped circle)
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    // Base ocean gradient
    const bodyGrad = ctx.createRadialGradient(
        x - r * 0.3, y - r * 0.3, r * 0.1,
        x, y, r,
    );
    bodyGrad.addColorStop(0, '#4aa8a0');
    bodyGrad.addColorStop(0.5, '#2a7a6a');
    bodyGrad.addColorStop(1, '#1a5a7a');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    // Spinning surface features (continents)
    const spin = (t / 20000) * r * 2;
    const wrap = r * 4;
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

// ---------------------------------------------------------------------------
// Planet view drawing (surface map)
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
    // Small house-like icon
    ctx.fillStyle = '#d4a020';
    ctx.beginPath();
    // Triangle roof
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x, y - 10);
    ctx.lineTo(x + 8, y);
    ctx.closePath();
    ctx.fill();
    // Rectangle base
    ctx.fillRect(x - 6, y, 12, 8);
    // Label
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
// Transition drawing
// ---------------------------------------------------------------------------

function drawTransitionToPlanet(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
): void {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

    if (progress < 0.5) {
        // Phase 1 (0→0.5): Planet globe scales up, everything else fades
        const phase = progress / 0.5; // 0→1
        const zoomScale = 1 + phase * 30; // grow from 1x to 31x
        const fadeAlpha = 1 - phase;

        // Draw fading background entities (they'll be drawn by RenderSystem normally)
        // Just draw the planet growing (still in world space — camera is applied)
        ctx.save();
        ctx.globalAlpha = fadeAlpha;
        ctx.translate(x, y);
        ctx.scale(zoomScale, zoomScale);
        ctx.translate(-x, -y);
        drawPlanetGlobe(entity, ctx, x, y);
        ctx.restore();

        // Overlay darkening — switch to screen space
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(3, 4, 10, ${phase * 0.8})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    } else if (progress < 0.6) {
        // Phase 2 (0.5→0.6): Black screen — screen space
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#03040a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    } else {
        // Phase 3 (0.6→1.0): Surface map fades in (drawPlanetSurface resets to screen space)
        const phase = (progress - 0.6) / 0.4; // 0→1

        ctx.save();
        ctx.globalAlpha = phase;
        drawPlanetSurface(entity, ctx);
        ctx.restore();

        // Remaining darkness — screen space
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
): void {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

    if (progress < 0.4) {
        // Phase 1 (0→0.4): Surface map fades out (drawPlanetSurface resets to screen space)
        const phase = progress / 0.4;

        ctx.save();
        ctx.globalAlpha = 1 - phase;
        drawPlanetSurface(entity, ctx);
        ctx.restore();

        // Overlay — screen space
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(3, 4, 10, ${phase})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    } else if (progress < 0.5) {
        // Phase 2 (0.4→0.5): Black screen — screen space
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#03040a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    } else {
        // Phase 3 (0.5→1.0): Fade back to normal (system entities restore visibility)
        const phase = (progress - 0.5) / 0.5;

        // Overlay — screen space
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

function drawPlanet(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const world = ServiceLocator.get<World>('world');
    const gameState = world.getEntityByName('gameState');
    const gameMode = gameState?.getComponent(GameModeComponent);

    if (!gameMode || gameMode.mode === 'system') {
        drawPlanetGlobe(entity, ctx, x, y);
    } else if (gameMode.mode === 'planet') {
        drawPlanetSurface(entity, ctx);
    } else if (gameMode.mode === 'transitioning-to-planet') {
        drawTransitionToPlanet(entity, ctx, x, y, gameMode.transitionProgress);
    } else if (gameMode.mode === 'transitioning-to-system') {
        drawTransitionToSystem(entity, ctx, gameMode.transitionProgress);
    }
}

// ---------------------------------------------------------------------------
// Entity factory
// ---------------------------------------------------------------------------

export function createPlanet(world: World): Entity {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

    const entity = world.createEntity('newTerra');

    // Position and orbit — fixed world coordinates, centred on star at (0, 0)
    entity.addComponent(new TransformComponent(ORBIT_RADIUS, 0));
    entity.addComponent(new OrbitComponent(0, 0, ORBIT_RADIUS, ORBIT_SPEED));
    entity.addComponent(new SelectableComponent(HIT_RADIUS));
    entity.addComponent(new RenderComponent('world', (ctx, x, y) => {
        drawPlanet(entity, ctx, x, y);
    }));

    // Generate surface regions (screen-space — used only in planet view mode)
    const rng = mulberry32(7);
    const mapWidth = canvas.width;
    const mapHeight = canvas.height;
    const cells = generateVoronoi(mapWidth, mapHeight, REGION_COUNT, rng);
    const regions = assignBiomes(cells, rng, mapWidth, mapHeight);

    const regionData = entity.addComponent(new RegionDataComponent());
    regionData.regions = regions;

    // Planet view components (lifecycle-driven)
    entity.addComponent(new PlanetInfoUIComponent());
    entity.addComponent(new PlanetViewInputComponent());
    entity.addComponent(new ColoniseUIComponent());

    return entity;
}
