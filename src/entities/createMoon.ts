// createMoon.ts — Factory for the moon entity orbiting New Terra.
// Purely visual: small gray body with craters, no interaction or colony components.

import { ServiceLocator } from '../core/ServiceLocator';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { MoonOrbitComponent } from '../components/MoonOrbitComponent';
import { GameModeComponent } from '../components/GameModeComponent';
import { CameraComponent } from '../components/CameraComponent';
import { getEntityFogZone } from '../components/FogOfWarComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Moon visual radius in world units (~15% of New Terra's 120wu body). */
const MOON_RADIUS = 18;

/** Moon orbit radius from New Terra centre in world units. */
const MOON_ORBIT_RADIUS = 250;

/**
 * Moon orbit speed in radians per turn.
 * One full orbit (2*PI) every 3 turns: 2*PI / 3 ≈ 2.094
 */
const MOON_ORBIT_SPEED = (2 * Math.PI) / 3;

/** Starting orbital angle in radians. */
const MOON_START_ANGLE = 0.7;

// ---------------------------------------------------------------------------
// Moon drawing
// ---------------------------------------------------------------------------

function drawMoon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const r = MOON_RADIUS;

    // Moon body — gray circle
    const bodyGrad = ctx.createRadialGradient(
        x - r * 0.3, y - r * 0.3, r * 0.1,
        x, y, r,
    );
    bodyGrad.addColorStop(0, '#aaaaaa');
    bodyGrad.addColorStop(1, '#777777');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    // Craters — darker ellipses
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#666666';

    // Crater 1 — upper left
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.25, r * 0.2, r * 0.15, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Crater 2 — lower right
    ctx.beginPath();
    ctx.ellipse(x + r * 0.25, y + r * 0.3, r * 0.15, r * 0.12, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Crater 3 — centre-right, smaller
    ctx.beginPath();
    ctx.ellipse(x + r * 0.1, y - r * 0.1, r * 0.1, r * 0.08, 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Shadow on one side — light comes from star at (0,0)
    const angleToStar = Math.atan2(0 - y, 0 - x);
    const shadowX = x - Math.cos(angleToStar) * r * 0.4;
    const shadowY = y - Math.sin(angleToStar) * r * 0.4;
    const shadowGrad = ctx.createRadialGradient(
        shadowX, shadowY, r * 0.2,
        shadowX, shadowY, r * 1.1,
    );
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

function drawMoonLabel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
): void {
    const world = ServiceLocator.get<World>('world');
    const cameraEntity = world.getEntityByName('camera');
    const camera = cameraEntity?.getComponent(CameraComponent);

    const fontSize = camera ? 10 / camera.scale : 10;

    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#a0a8b8';
    ctx.font = `${fontSize}px "Share Tech Mono", "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('LUNA', x, y + MOON_RADIUS + fontSize * 1.5);
    ctx.restore();
}

// ---------------------------------------------------------------------------
// Entity factory
// ---------------------------------------------------------------------------

export function createMoon(world: World, parentPlanet: Entity): Entity {
    const entity = world.createEntity('luna');

    // Initial position on the orbit circle around parent
    const parentTransform = parentPlanet.getComponent(TransformComponent);
    const parentX = parentTransform?.x ?? 0;
    const parentY = parentTransform?.y ?? 0;
    const startX = parentX + MOON_ORBIT_RADIUS * Math.cos(MOON_START_ANGLE);
    const startY = parentY + MOON_ORBIT_RADIUS * Math.sin(MOON_START_ANGLE);

    entity.addComponent(new TransformComponent(startX, startY));

    // Orbit around parent planet
    const moonOrbit = new MoonOrbitComponent(
        parentPlanet,
        MOON_ORBIT_RADIUS,
        MOON_ORBIT_SPEED,
        MOON_START_ANGLE,
    );
    entity.addComponent(moonOrbit);

    // Render — only in system view, respects fog of war
    entity.addComponent(new RenderComponent('world', (ctx, x, y) => {
        const gameState = world.getEntityByName('gameState');
        const gameMode = gameState?.getComponent(GameModeComponent);

        // Only render in system view
        if (gameMode && gameMode.mode !== 'system') return;

        // Respect fog of war
        const zone = getEntityFogZone(x, y);
        if (zone === 'hidden' || zone === 'blip') return;

        drawMoon(ctx, x, y);
        drawMoonLabel(ctx, x, y);
    }));

    return entity;
}
