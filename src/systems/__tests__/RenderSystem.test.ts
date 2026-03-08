import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { RenderSystem } from '../RenderSystem';
import { RenderComponent } from '../../components/RenderComponent';
import { TransformComponent } from '../../components/TransformComponent';

function createMockCtx(): CanvasRenderingContext2D {
    return {
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
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
});
