import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { RenderSystem } from '../RenderSystem';
import { RenderComponent } from '../../components/RenderComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { CameraComponent } from '../../components/CameraComponent';

function createMockCtx(): CanvasRenderingContext2D {
    return {
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
}

describe('RenderSystem', () => {
    let world: World;
    let mockCtx: CanvasRenderingContext2D;

    beforeEach(() => {
        ServiceLocator.clear();

        const mockCanvas = { width: 800, height: 600 } as HTMLCanvasElement;
        mockCtx = createMockCtx();

        ServiceLocator.register('canvas', mockCanvas);
        ServiceLocator.register('ctx', mockCtx);

        world = new World();
    });

    it('clears the canvas on render', () => {
        const system = new RenderSystem();
        system.init(world);
        system.render(0);
        expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 800, 600);
    });

    it('calls draw functions for visible entities', () => {
        const system = new RenderSystem();
        system.init(world);

        const drawFn = vi.fn();
        const entity = world.createEntity('test');
        entity.addComponent(new TransformComponent(10, 20, 0.5, 2));
        entity.addComponent(new RenderComponent('world', drawFn));

        system.render(0.5);

        expect(drawFn).toHaveBeenCalledWith(mockCtx, 10, 20, 0.5, 2, 0.5);
    });

    it('does not call draw for invisible entities', () => {
        const system = new RenderSystem();
        system.init(world);

        const drawFn = vi.fn();
        const entity = world.createEntity('hidden');
        entity.addComponent(new TransformComponent());
        const render = entity.addComponent(new RenderComponent('world', drawFn));
        render.visible = false;

        system.render(0);

        expect(drawFn).not.toHaveBeenCalled();
    });

    it('draws entities in layer order: background → world → foreground → hud', () => {
        const system = new RenderSystem();
        system.init(world);

        const callOrder: string[] = [];

        // Create entities in reverse layer order to verify sorting
        const hudEntity = world.createEntity('hud');
        hudEntity.addComponent(new TransformComponent());
        hudEntity.addComponent(new RenderComponent('hud', () => { callOrder.push('hud'); }));

        const bgEntity = world.createEntity('bg');
        bgEntity.addComponent(new TransformComponent());
        bgEntity.addComponent(new RenderComponent('background', () => { callOrder.push('background'); }));

        const fgEntity = world.createEntity('fg');
        fgEntity.addComponent(new TransformComponent());
        fgEntity.addComponent(new RenderComponent('foreground', () => { callOrder.push('foreground'); }));

        const worldEntity = world.createEntity('world');
        worldEntity.addComponent(new TransformComponent());
        worldEntity.addComponent(new RenderComponent('world', () => { callOrder.push('world'); }));

        system.render(0);

        expect(callOrder).toEqual(['background', 'world', 'foreground', 'hud']);
    });

    it('wraps each draw call in save/restore', () => {
        const system = new RenderSystem();
        system.init(world);

        const entity = world.createEntity('test');
        entity.addComponent(new TransformComponent());
        entity.addComponent(new RenderComponent('world', vi.fn()));

        system.render(0);

        expect(mockCtx.save).toHaveBeenCalledTimes(1);
        expect(mockCtx.restore).toHaveBeenCalledTimes(1);
    });

    it('uses default transform values when TransformComponent is missing', () => {
        const system = new RenderSystem();
        system.init(world);

        const drawFn = vi.fn();
        const entity = world.createEntity('no-transform');
        // Only add RenderComponent, no TransformComponent
        entity.addComponent(new RenderComponent('world', drawFn));

        system.render(0.3);

        expect(drawFn).toHaveBeenCalledWith(mockCtx, 0, 0, 0, 1, 0.3);
    });

    it('update is a no-op', () => {
        const system = new RenderSystem();
        system.init(world);
        // Should not throw
        expect(() => system.update(16)).not.toThrow();
    });

    describe('camera transform', () => {
        function addCamera(): void {
            const eventQueue = new EventQueue();
            ServiceLocator.register('eventQueue', eventQueue);
            const cam = world.createEntity('camera');
            const cameraComp = cam.addComponent(new CameraComponent());
            cameraComp.init();
        }

        it('applies camera transform to world-layer entities', () => {
            addCamera();
            const system = new RenderSystem();
            system.init(world);

            const entity = world.createEntity('star');
            entity.addComponent(new TransformComponent(0, 0));
            entity.addComponent(new RenderComponent('world', vi.fn()));

            system.render(0);

            // Camera applies translate then scale
            expect(mockCtx.translate).toHaveBeenCalledWith(400, 300);
            expect(mockCtx.scale).toHaveBeenCalledWith(0.6, 0.6);
        });

        it('applies camera transform to foreground-layer entities', () => {
            addCamera();
            const system = new RenderSystem();
            system.init(world);

            const entity = world.createEntity('overlay');
            entity.addComponent(new TransformComponent(0, 0));
            entity.addComponent(new RenderComponent('foreground', vi.fn()));

            system.render(0);

            expect(mockCtx.translate).toHaveBeenCalled();
            expect(mockCtx.scale).toHaveBeenCalled();
        });

        it('does NOT apply camera transform to background layer', () => {
            addCamera();
            const system = new RenderSystem();
            system.init(world);

            const entity = world.createEntity('bg');
            entity.addComponent(new TransformComponent(0, 0));
            entity.addComponent(new RenderComponent('background', vi.fn()));

            system.render(0);

            expect(mockCtx.translate).not.toHaveBeenCalled();
            expect(mockCtx.scale).not.toHaveBeenCalled();
        });

        it('does NOT apply camera transform to hud layer', () => {
            addCamera();
            const system = new RenderSystem();
            system.init(world);

            const entity = world.createEntity('ui');
            entity.addComponent(new TransformComponent(0, 0));
            entity.addComponent(new RenderComponent('hud', vi.fn()));

            system.render(0);

            expect(mockCtx.translate).not.toHaveBeenCalled();
            expect(mockCtx.scale).not.toHaveBeenCalled();
        });

        it('always applies camera transform for world layers regardless of game mode', () => {
            addCamera();
            // Camera is always applied — draw functions opt into screen space
            // via ctx.setTransform() when needed (e.g. planet surface rendering)
            const system = new RenderSystem();
            system.init(world);

            const entity = world.createEntity('star');
            entity.addComponent(new TransformComponent(0, 0));
            entity.addComponent(new RenderComponent('world', vi.fn()));

            system.render(0);

            expect(mockCtx.translate).toHaveBeenCalledWith(400, 300);
            expect(mockCtx.scale).toHaveBeenCalledWith(0.6, 0.6);
        });

        it('works without camera entity (no transform applied)', () => {
            const system = new RenderSystem();
            system.init(world);

            const drawFn = vi.fn();
            const entity = world.createEntity('test');
            entity.addComponent(new TransformComponent(10, 20));
            entity.addComponent(new RenderComponent('world', drawFn));

            system.render(0);

            // Still draws, just no camera transform
            expect(drawFn).toHaveBeenCalled();
            expect(mockCtx.translate).not.toHaveBeenCalled();
        });
    });
});
