import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { CameraComponent, WORLD_SIZE } from '../CameraComponent';

describe('CameraComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let canvas: { width: number; height: number };

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

    it('calculates scale from smaller canvas dimension', () => {
        const cam = createCamera();
        // min(800, 600) / 1000 = 0.6
        expect(cam.scale).toBe(600 / WORLD_SIZE);
    });

    it('calculates offset as canvas centre', () => {
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
        expect(cam.scale).toBe(1080 / WORLD_SIZE);
        expect(cam.offsetX).toBe(960);
        expect(cam.offsetY).toBe(540);
    });

    it('handles square canvas (width === height)', () => {
        canvas.width = 500;
        canvas.height = 500;
        const cam = createCamera();
        expect(cam.scale).toBe(500 / WORLD_SIZE);
        expect(cam.offsetX).toBe(250);
        expect(cam.offsetY).toBe(250);
    });

    describe('worldToScreen', () => {
        it('maps world origin to canvas centre', () => {
            const cam = createCamera();
            const screen = cam.worldToScreen(0, 0);
            expect(screen.x).toBe(400); // canvas centre x
            expect(screen.y).toBe(300); // canvas centre y
        });

        it('maps positive world coords to right/below centre', () => {
            const cam = createCamera();
            const screen = cam.worldToScreen(100, 200);
            // scale = 0.6, offset = (400, 300)
            expect(screen.x).toBeCloseTo(100 * 0.6 + 400);
            expect(screen.y).toBeCloseTo(200 * 0.6 + 300);
        });

        it('maps negative world coords to left/above centre', () => {
            const cam = createCamera();
            const screen = cam.worldToScreen(-500, -500);
            expect(screen.x).toBeCloseTo(-500 * 0.6 + 400);
            expect(screen.y).toBeCloseTo(-500 * 0.6 + 300);
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
            // scale = 0.6
            expect(cam.worldToScreenDist(100)).toBeCloseTo(60);
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
                'scale(0.6,0.6)',
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

    it('exports WORLD_SIZE constant as 1000', () => {
        expect(WORLD_SIZE).toBe(1000);
    });
});
