// createMinimap.ts — Factory for the minimap overlay entity.
// Renders a small system overview on the HUD layer showing planet positions,
// ship position, viewport rectangle, and fog of war state.

import { ServiceLocator } from '../core/ServiceLocator';
import { RenderComponent } from '../components/RenderComponent';
import { CameraComponent } from '../components/CameraComponent';
import { TransformComponent } from '../components/TransformComponent';
import { FogOfWarComponent, TileVisibility } from '../components/FogOfWarComponent';
import { PlanetDataComponent } from '../components/PlanetDataComponent';
import { MinimapComponent } from '../components/MinimapComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

function drawMinimap(
    entity: Entity,
    ctx: CanvasRenderingContext2D,
): void {
    const minimap = entity.getComponent(MinimapComponent);
    if (!minimap) return;

    const world = ServiceLocator.get<World>('world');
    const { screenX, screenY, size } = minimap;

    // --- Background ---
    ctx.fillStyle = 'rgba(3, 4, 10, 0.85)';
    ctx.fillRect(screenX, screenY, size, size);

    // --- Fog layer ---
    if (minimap.fogCanvas) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(minimap.fogCanvas, screenX, screenY, size, size);
        ctx.restore();
    }

    // --- Star (world origin) ---
    const starPos = minimap.worldToMinimap(0, 0);
    ctx.fillStyle = '#ffdd88';
    ctx.beginPath();
    ctx.arc(starPos.x, starPos.y, 2, 0, Math.PI * 2);
    ctx.fill();

    // --- Planets ---
    const gameState = world.getEntityByName('gameState');
    const fog = gameState?.getComponent(FogOfWarComponent) ?? null;

    const entities = world.getEntitiesWithComponent(PlanetDataComponent);
    for (const planetEntity of entities) {
        const planetData = planetEntity.getComponent(PlanetDataComponent);
        const transform = planetEntity.getComponent(TransformComponent);
        if (!planetData || !transform) continue;

        const vis = fog?.getVisibilityAtWorld(transform.x, transform.y) ?? TileVisibility.Active;
        if (vis === TileVisibility.Hidden) continue;

        const pos = minimap.worldToMinimap(transform.x, transform.y);
        const dotR = planetData.config.type === 'gas-giant' ? 3 : 2;

        ctx.globalAlpha = vis === TileVisibility.Active ? 1.0 : 0.4;
        ctx.fillStyle = planetData.config.palette.body;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, dotR, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // --- Ship ---
    const ship = world.getEntityByName('arkSalvage');
    const shipTransform = ship?.getComponent(TransformComponent);
    if (shipTransform) {
        const shipPos = minimap.worldToMinimap(shipTransform.x, shipTransform.y);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(shipPos.x, shipPos.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Subtle glow
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(shipPos.x, shipPos.y, 6, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Viewport rectangle ---
    const cameraEntity = world.getEntityByName('camera');
    const camera = cameraEntity?.getComponent(CameraComponent);
    if (camera) {
        const topLeft = camera.screenToWorld(0, 0);
        const bottomRight = camera.screenToWorld(camera.canvasWidth, camera.canvasHeight);

        const vpTL = minimap.worldToMinimap(topLeft.x, topLeft.y);
        const vpBR = minimap.worldToMinimap(bottomRight.x, bottomRight.y);

        // Clamp to minimap bounds
        const x1 = Math.max(screenX, vpTL.x);
        const y1 = Math.max(screenY, vpTL.y);
        const x2 = Math.min(screenX + size, vpBR.x);
        const y2 = Math.min(screenY + size, vpBR.y);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    }

    // --- Border ---
    ctx.strokeStyle = 'rgba(192, 200, 216, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX, screenY, size, size);
}

export function createMinimap(world: World): Entity {
    const entity = world.createEntity('minimap');
    entity.addComponent(new MinimapComponent());
    entity.addComponent(new RenderComponent('hud', (ctx) => {
        drawMinimap(entity, ctx);
    }));
    return entity;
}
