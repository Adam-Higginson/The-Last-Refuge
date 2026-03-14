import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { GameEvents } from '../../core/GameEvents';
import { ServiceLocator } from '../../core/ServiceLocator';
import { MinimapComponent } from '../MinimapComponent';
import { GameModeComponent } from '../GameModeComponent';
import { RenderComponent } from '../RenderComponent';

describe('MinimapComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let minimap: MinimapComponent;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);
        ServiceLocator.register('canvas', {
            width: 1024,
            height: 768,
        } as unknown as HTMLCanvasElement);

        // GameModeComponent lives on gameState (not on the minimap entity)
        const gameState = world.createEntity('gameState');
        gameState.addComponent(new GameModeComponent());

        const entity = world.createEntity('minimap');
        entity.addComponent(new RenderComponent('hud', () => {}));
        minimap = entity.addComponent(new MinimapComponent());
        minimap.init();
    });

    // --- Position ---

    it('positions in bottom-right on wide canvas', () => {
        expect(minimap.size).toBe(160);
        expect(minimap.screenX).toBe(1024 - 160 - 12);
        expect(minimap.screenY).toBe(768 - 160 - 12 - 48);
    });

    it('uses smaller size on narrow canvas', () => {
        ServiceLocator.clear();
        ServiceLocator.register('eventQueue', new EventQueue());
        ServiceLocator.register('world', world);
        ServiceLocator.register('canvas', {
            width: 400,
            height: 700,
        } as unknown as HTMLCanvasElement);

        const entity = world.createEntity('minimap2');
        entity.addComponent(new RenderComponent('hud', () => {}));
        const narrow = entity.addComponent(new MinimapComponent());
        narrow.init();

        expect(narrow.size).toBe(120);
    });

    // --- Coordinate transforms ---

    it('worldToMinimap maps origin to centre of minimap', () => {
        const pos = minimap.worldToMinimap(0, 0);
        const cx = minimap.screenX + minimap.size / 2;
        const cy = minimap.screenY + minimap.size / 2;
        expect(pos.x).toBeCloseTo(cx, 1);
        expect(pos.y).toBeCloseTo(cy, 1);
    });

    it('minimapToWorld is the inverse of worldToMinimap', () => {
        const wx = 1500;
        const wy = -2000;
        const mp = minimap.worldToMinimap(wx, wy);
        const back = minimap.minimapToWorld(mp.x, mp.y);
        expect(back.x).toBeCloseTo(wx, 0);
        expect(back.y).toBeCloseTo(wy, 0);
    });

    it('round-trips for origin', () => {
        const mp = minimap.worldToMinimap(0, 0);
        const back = minimap.minimapToWorld(mp.x, mp.y);
        expect(back.x).toBeCloseTo(0, 0);
        expect(back.y).toBeCloseTo(0, 0);
    });

    // --- Hit testing ---

    it('hitTest returns true inside minimap', () => {
        const cx = minimap.screenX + minimap.size / 2;
        const cy = minimap.screenY + minimap.size / 2;
        expect(minimap.hitTest(cx, cy)).toBe(true);
    });

    it('hitTest returns false outside minimap', () => {
        expect(minimap.hitTest(0, 0)).toBe(false);
        expect(minimap.hitTest(minimap.screenX - 1, minimap.screenY)).toBe(false);
    });

    it('hitTest returns true on edge', () => {
        expect(minimap.hitTest(minimap.screenX, minimap.screenY)).toBe(true);
        expect(minimap.hitTest(minimap.screenX + minimap.size, minimap.screenY + minimap.size)).toBe(true);
    });

    // --- Visibility gating (reads from gameState, not minimap entity) ---

    it('hides minimap in planet view', () => {
        const gameState = world.getEntityByName('gameState');
        const gameMode = gameState?.getComponent(GameModeComponent);
        const render = minimap.entity.getComponent(RenderComponent);
        if (!gameMode || !render) throw new Error('missing components');

        gameMode.mode = 'planet';
        minimap.update(1 / 60);
        expect(render.visible).toBe(false);

        gameMode.mode = 'system';
        minimap.update(1 / 60);
        expect(render.visible).toBe(true);
    });

    // --- Lifecycle ---

    it('unsubscribes resize handler on destroy', () => {
        minimap.destroy();

        // Emit resize — should not change position (handler removed)
        const oldX = minimap.screenX;
        const oldY = minimap.screenY;
        eventQueue.emit({ type: GameEvents.CANVAS_RESIZE, width: 500, height: 400 });
        eventQueue.drain();

        expect(minimap.screenX).toBe(oldX);
        expect(minimap.screenY).toBe(oldY);
    });
});
