// createFogOverlay.ts — Factory for the fog of war overlay entity.
// Renders a full-screen fog layer using an offscreen canvas with
// compositing to carve out visibility around the ship.

import { ServiceLocator } from '../core/ServiceLocator';
import { RenderComponent } from '../components/RenderComponent';
import { CameraComponent } from '../components/CameraComponent';
import { TransformComponent } from '../components/TransformComponent';
import { GameModeComponent } from '../components/GameModeComponent';
import { FogOfWarComponent } from '../components/FogOfWarComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Base opacity of the fog overlay (0 = transparent, 1 = solid black). */
const FOG_BASE_OPACITY = 0.92;

/** Alpha used when punching revealed cells (lower = dimmer reveal). */
const REVEALED_PUNCH_ALPHA = 0.45;

/** Overlap in pixels added to each revealed cell rect to prevent grid seam artifacts. */
const CELL_OVERLAP = 1;

function drawFogOverlay(
    ctx: CanvasRenderingContext2D,
    fogCanvas: HTMLCanvasElement,
    fogCtx: CanvasRenderingContext2D,
): void {
    const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
    const world = ServiceLocator.get<World>('world');

    // Skip fog during planet view
    const gameState = world.getEntityByName('gameState');
    const gameMode = gameState?.getComponent(GameModeComponent);
    if (gameMode && gameMode.mode !== 'system') return;

    const fog = gameState?.getComponent(FogOfWarComponent);
    if (!fog) return;

    // Get ship screen position
    const ship = world.getEntityByName('arkSalvage');
    const shipTransform = ship?.getComponent(TransformComponent);
    if (!shipTransform) return;

    const cameraEntity = world.getEntityByName('camera');
    const camera = cameraEntity?.getComponent(CameraComponent);
    if (!camera) return;

    const shipScreen = camera.worldToScreen(shipTransform.x, shipTransform.y);
    const detailScreenR = camera.worldToScreenDist(fog.detailRadius);
    const blipScreenR = camera.worldToScreenDist(fog.blipRadius);

    // Reset to screen space
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Resize offscreen canvas if needed
    const w = canvas.width;
    const h = canvas.height;
    if (fogCanvas.width !== w || fogCanvas.height !== h) {
        fogCanvas.width = w;
        fogCanvas.height = h;
    }

    const fc = fogCtx;

    // Fill with near-opaque black (fog)
    fc.clearRect(0, 0, w, h);
    fc.globalCompositeOperation = 'source-over';
    fc.fillStyle = `rgba(0, 0, 0, ${FOG_BASE_OPACITY})`;
    fc.fillRect(0, 0, w, h);

    // Punch holes using destination-out
    fc.globalCompositeOperation = 'destination-out';

    // Revealed cells: partial punch-through (only iterate tracked set, not full grid)
    const cellScreenSize = camera.worldToScreenDist(fog.cellSize);
    fc.fillStyle = `rgba(0, 0, 0, ${REVEALED_PUNCH_ALPHA})`;
    for (const idx of fog.revealedCells) {
        const col = idx % fog.gridSize;
        const row = Math.floor(idx / fog.gridSize);
        const worldPos = fog.cellToWorld(col, row);
        const screenPos = camera.worldToScreen(worldPos.x, worldPos.y);

        // Cull off-screen cells
        const half = cellScreenSize / 2 + CELL_OVERLAP;
        if (screenPos.x + half < 0 || screenPos.x - half > w) continue;
        if (screenPos.y + half < 0 || screenPos.y - half > h) continue;

        fc.fillRect(
            screenPos.x - half,
            screenPos.y - half,
            cellScreenSize + CELL_OVERLAP * 2,
            cellScreenSize + CELL_OVERLAP * 2,
        );
    }

    // Active zone: radial gradient punch-through
    // Detail zone (inner): full visibility — alpha 1.0 clears fog completely
    // Blip zone (outer ring): partial visibility with soft falloff at the edge
    const ratio = blipScreenR > 0 ? detailScreenR / blipScreenR : 0.5;
    const detailEdge = Math.min(ratio * 0.9, 0.89);   // soft fade start inside detail zone
    const blipStart = Math.min(ratio, 0.90);            // detail/blip boundary
    const blipMid = Math.min((ratio + 1) / 2, 0.95);   // midpoint of blip zone

    const grad = fc.createRadialGradient(
        shipScreen.x, shipScreen.y, 0,
        shipScreen.x, shipScreen.y, blipScreenR,
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    grad.addColorStop(detailEdge, 'rgba(0, 0, 0, 1.0)');
    grad.addColorStop(blipStart, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(blipMid, 'rgba(0, 0, 0, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    fc.fillStyle = grad;
    fc.beginPath();
    fc.arc(shipScreen.x, shipScreen.y, blipScreenR, 0, Math.PI * 2);
    fc.fill();

    // Star is always visible — punch a soft hole at world origin
    const starScreen = camera.worldToScreen(0, 0);
    const starR = camera.worldToScreenDist(120);
    const starGrad = fc.createRadialGradient(
        starScreen.x, starScreen.y, 0,
        starScreen.x, starScreen.y, starR,
    );
    starGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    starGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
    starGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    fc.fillStyle = starGrad;
    fc.beginPath();
    fc.arc(starScreen.x, starScreen.y, starR, 0, Math.PI * 2);
    fc.fill();

    // Reset compositing and draw fog onto main canvas
    fc.globalCompositeOperation = 'source-over';
    ctx.drawImage(fogCanvas, 0, 0);

    ctx.restore();
}

export function createFogOverlay(world: World): Entity {
    const entity = world.createEntity('fogOverlay');

    // Offscreen canvas owned by this entity (not module-level singleton)
    const offscreen = document.createElement('canvas');
    const offscreenCtx = offscreen.getContext('2d');

    entity.addComponent(new RenderComponent('foreground', (ctx) => {
        if (!offscreenCtx) return;
        drawFogOverlay(ctx, offscreen, offscreenCtx);
    }));
    return entity;
}
