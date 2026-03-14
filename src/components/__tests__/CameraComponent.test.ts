import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import {
    CameraComponent,
    WORLD_SIZE,
    DEFAULT_ZOOM,
    MIN_ZOOM,
    MAX_ZOOM,
} from '../CameraComponent';

describe('CameraComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let canvas: { width: number; height: number };

    // With WORLD_SIZE=10000, canvas 800x600, DEFAULT_ZOOM=2.5:
    // baseScale = min(800,600) / 10000 = 0.06
    // scale = 0.06 * 2.5 = 0.15
    const expectedScale = (600 / WORLD_SIZE) * DEFAULT_ZOOM;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        canvas = { width: 800, height: 600 };
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('canvas', canvas);
        world = new World();
    });

    function createCamera(): CameraComponent {
        const entity = world.createEntity('camera');
        const cam = entity.addComponent(new CameraComponent());
        cam.init();
        return cam;
    }

    it('initialises with canvas dimensions', () => {
        const cam = createCamera();
        expect(cam.canvasWidth).toBe(800);
        expect(cam.canvasHeight).toBe(600);
    });

    it('calculates scale incorporating default zoom', () => {
        const cam = createCamera();
        expect(cam.scale).toBeCloseTo(expectedScale);
    });

    it('calculates offset as canvas centre when pan is zero', () => {
        const cam = createCamera();
        expect(cam.offsetX).toBe(400);
        expect(cam.offsetY).toBe(300);
    });

    it('recalculates on CANVAS_RESIZE event', () => {
        const cam = createCamera();

        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 1920,
            height: 1080,
        });
        eventQueue.drain();

        expect(cam.canvasWidth).toBe(1920);
        expect(cam.canvasHeight).toBe(1080);
        expect(cam.scale).toBeCloseTo((1080 / WORLD_SIZE) * DEFAULT_ZOOM);
        expect(cam.offsetX).toBe(960);
        expect(cam.offsetY).toBe(540);
    });

    it('handles square canvas (width === height)', () => {
        canvas.width = 500;
        canvas.height = 500;
        const cam = createCamera();
        expect(cam.scale).toBeCloseTo((500 / WORLD_SIZE) * DEFAULT_ZOOM);
        expect(cam.offsetX).toBe(250);
        expect(cam.offsetY).toBe(250);
    });

    describe('worldToScreen', () => {
        it('maps world origin to canvas centre', () => {
            const cam = createCamera();
            const screen = cam.worldToScreen(0, 0);
            expect(screen.x).toBe(400);
            expect(screen.y).toBe(300);
        });

        it('maps positive world coords to right/below centre', () => {
            const cam = createCamera();
            const screen = cam.worldToScreen(100, 200);
            expect(screen.x).toBeCloseTo(100 * expectedScale + 400);
            expect(screen.y).toBeCloseTo(200 * expectedScale + 300);
        });

        it('maps negative world coords to left/above centre', () => {
            const cam = createCamera();
            const screen = cam.worldToScreen(-500, -500);
            expect(screen.x).toBeCloseTo(-500 * expectedScale + 400);
            expect(screen.y).toBeCloseTo(-500 * expectedScale + 300);
        });
    });

    describe('screenToWorld', () => {
        it('maps canvas centre to world origin', () => {
            const cam = createCamera();
            const w = cam.screenToWorld(400, 300);
            expect(w.x).toBeCloseTo(0);
            expect(w.y).toBeCloseTo(0);
        });

        it('round-trips with worldToScreen', () => {
            const cam = createCamera();
            const wx = 123.45;
            const wy = -67.89;
            const screen = cam.worldToScreen(wx, wy);
            const back = cam.screenToWorld(screen.x, screen.y);
            expect(back.x).toBeCloseTo(wx);
            expect(back.y).toBeCloseTo(wy);
        });

        it('round-trips after resize', () => {
            const cam = createCamera();
            cam.resize(1920, 1080);
            const wx = -200;
            const wy = 350;
            const screen = cam.worldToScreen(wx, wy);
            const back = cam.screenToWorld(screen.x, screen.y);
            expect(back.x).toBeCloseTo(wx);
            expect(back.y).toBeCloseTo(wy);
        });
    });

    describe('worldToScreenDist', () => {
        it('converts a world distance to screen pixels', () => {
            const cam = createCamera();
            expect(cam.worldToScreenDist(100)).toBeCloseTo(100 * expectedScale);
        });
    });

    describe('applyTransform', () => {
        it('calls translate then scale on the context', () => {
            const cam = createCamera();
            const calls: string[] = [];
            const ctx = {
                translate: (x: number, y: number): void => {
                    calls.push(`translate(${x},${y})`);
                },
                scale: (sx: number, sy: number): void => {
                    calls.push(`scale(${sx},${sy})`);
                },
            } as unknown as CanvasRenderingContext2D;

            cam.applyTransform(ctx);

            expect(calls).toEqual([
                'translate(400,300)',
                `scale(${expectedScale},${expectedScale})`,
            ]);
        });
    });

    it('unsubscribes on destroy', () => {
        const cam = createCamera();
        cam.destroy();

        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: 1920,
            height: 1080,
        });
        eventQueue.drain();

        // Should remain at original values
        expect(cam.canvasWidth).toBe(800);
        expect(cam.canvasHeight).toBe(600);
    });

    it('exports WORLD_SIZE constant as 10000', () => {
        expect(WORLD_SIZE).toBe(10_000);
    });

    describe('zoom', () => {
        it('initialises with default zoom level', () => {
            const cam = createCamera();
            expect(cam.zoomLevel).toBe(DEFAULT_ZOOM);
            expect(cam.targetZoomLevel).toBe(DEFAULT_ZOOM);
        });

        it('updates targetZoomLevel on zoom()', () => {
            const cam = createCamera();
            cam.zoom(1.15, 400, 300); // zoom in at canvas centre
            expect(cam.targetZoomLevel).toBeCloseTo(DEFAULT_ZOOM * 1.15);
        });

        it('clamps to MIN_ZOOM', () => {
            const cam = createCamera();
            cam.targetZoomLevel = MIN_ZOOM;
            cam.zoom(0.1, 400, 300); // try to zoom out past min
            expect(cam.targetZoomLevel).toBe(MIN_ZOOM);
        });

        it('clamps to MAX_ZOOM', () => {
            const cam = createCamera();
            cam.targetZoomLevel = MAX_ZOOM;
            cam.zoom(2.0, 400, 300); // try to zoom in past max
            expect(cam.targetZoomLevel).toBe(MAX_ZOOM);
        });

        it('interpolates zoomLevel toward targetZoomLevel on update', () => {
            const cam = createCamera();
            cam.zoom(2.0, 400, 300);
            const target = cam.targetZoomLevel;
            expect(cam.zoomLevel).toBe(DEFAULT_ZOOM); // not yet changed

            cam.update(0.016); // one tick
            expect(cam.zoomLevel).toBeGreaterThan(DEFAULT_ZOOM);
            expect(cam.zoomLevel).toBeLessThan(target);
        });

        it('snaps to target when close enough', () => {
            const cam = createCamera();
            cam.zoom(1.001, 400, 300); // tiny zoom change
            const target = cam.targetZoomLevel;

            // Run enough updates to converge
            for (let i = 0; i < 100; i++) {
                cam.update(0.016);
            }

            expect(cam.zoomLevel).toBe(target);
        });

        it('keeps world point under cursor fixed during zoom-to-cursor', () => {
            const cam = createCamera();
            const screenX = 600;
            const screenY = 400;

            // Get the world point under cursor before zoom
            const worldBefore = cam.screenToWorld(screenX, screenY);

            cam.zoom(1.5, screenX, screenY);

            // Run interpolation to completion
            for (let i = 0; i < 200; i++) {
                cam.update(0.016);
            }

            // The same world point should still map to the same screen point
            const screenAfter = cam.worldToScreen(worldBefore.x, worldBefore.y);
            expect(screenAfter.x).toBeCloseTo(screenX, 0);
            expect(screenAfter.y).toBeCloseTo(screenY, 0);
        });
    });

    describe('pan', () => {
        it('shifts the camera centre in world space', () => {
            const cam = createCamera();
            cam.pan(100, -50);
            expect(cam.panX).toBe(100);
            expect(cam.panY).toBe(-50);
        });

        it('updates offset to reflect pan', () => {
            const cam = createCamera();
            cam.pan(100, 0);
            // offsetX = canvasWidth/2 - panX * scale = 400 - 100 * 0.15 = 385
            expect(cam.offsetX).toBeCloseTo(400 - 100 * expectedScale);
        });

        it('clamps to prevent going too far from origin', () => {
            const cam = createCamera();
            cam.pan(100_000, 100_000); // way beyond limits
            const maxPan = WORLD_SIZE * 0.8;
            expect(cam.panX).toBe(maxPan);
            expect(cam.panY).toBe(maxPan);
        });

        it('round-trips worldToScreen/screenToWorld with pan', () => {
            const cam = createCamera();
            cam.pan(500, -300);
            const wx = 100;
            const wy = 200;
            const screen = cam.worldToScreen(wx, wy);
            const back = cam.screenToWorld(screen.x, screen.y);
            expect(back.x).toBeCloseTo(wx);
            expect(back.y).toBeCloseTo(wy);
        });

        it('clears zoom animation when panning', () => {
            const cam = createCamera();
            cam.zoom(2.0, 400, 300); // start zoom animation
            cam.pan(10, 10); // pan should clear zoom anchor

            // Update should still interpolate zoom but not fight with pan
            cam.update(0.016);
            expect(cam.panX).toBeCloseTo(10);
            expect(cam.panY).toBeCloseTo(10);
        });
    });

    describe('resize with zoom/pan', () => {
        it('preserves zoom level on resize', () => {
            const cam = createCamera();
            cam.zoom(2.0, 400, 300);
            // Snap zoom
            for (let i = 0; i < 200; i++) cam.update(0.016);

            const zoomBefore = cam.zoomLevel;
            cam.resize(1920, 1080);
            expect(cam.zoomLevel).toBe(zoomBefore);
        });

        it('preserves pan on resize', () => {
            const cam = createCamera();
            cam.pan(500, -300);
            cam.resize(1920, 1080);
            expect(cam.panX).toBe(500);
            expect(cam.panY).toBe(-300);
        });
    });

    it('exports zoom constants', () => {
        expect(MIN_ZOOM).toBe(0.5);
        expect(MAX_ZOOM).toBe(10.0);
        expect(DEFAULT_ZOOM).toBe(5.0);
    });
});
