import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { RenderComponent } from '../../components/RenderComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { createBackground } from '../createBackground';

function createMockCanvasCtx(): CanvasRenderingContext2D {
    return {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        fillRect: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        drawImage: vi.fn(),
        createRadialGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
        })),
    } as unknown as CanvasRenderingContext2D;
}

describe('createBackground', () => {
    let hadDocument: boolean;

    beforeEach(() => {
        ServiceLocator.clear();

        ServiceLocator.register('canvas', {
            width: 800,
            height: 600,
        } as unknown as HTMLCanvasElement);

        // Mock document.createElement for offscreen canvas creation.
        // In Node (no DOM), we create a minimal document stub.
        hadDocument = typeof globalThis.document !== 'undefined';

        const mockCreateElement = vi.fn((tag: string) => {
            if (tag === 'canvas') {
                return {
                    width: 0,
                    height: 0,
                    getContext: vi.fn(() => createMockCanvasCtx()),
                };
            }
            return {};
        });

        if (!hadDocument) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).document = { createElement: mockCreateElement };
        } else {
            vi.spyOn(document, 'createElement').mockImplementation(
                mockCreateElement as unknown as typeof document.createElement,
            );
        }
    });

    afterEach(() => {
        if (!hadDocument) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (globalThis as any).document;
        }
        vi.restoreAllMocks();
    });

    it('creates an entity named "background"', () => {
        const world = new World();
        const entity = createBackground(world);
        expect(entity.name).toBe('background');
    });

    it('entity is retrievable from the world by name', () => {
        const world = new World();
        createBackground(world);
        const entity = world.getEntityByName('background');
        expect(entity).not.toBeNull();
    });

    it('has a RenderComponent on the background layer', () => {
        const world = new World();
        const entity = createBackground(world);
        const render = entity.getComponent(RenderComponent);
        expect(render).not.toBeNull();
        expect(render?.layer).toBe('background');
    });

    it('has a TransformComponent', () => {
        const world = new World();
        const entity = createBackground(world);
        const transform = entity.getComponent(TransformComponent);
        expect(transform).not.toBeNull();
    });

    it('render draw function is callable', () => {
        const world = new World();
        const entity = createBackground(world);
        const render = entity.getComponent(RenderComponent);
        expect(render).not.toBeNull();

        // The draw function now also renders twinkle stars each frame,
        // so the mock needs canvas drawing methods beyond just drawImage.
        const mockCtx = createMockCanvasCtx();

        // Should not throw
        expect(() => render?.draw(mockCtx, 0, 0, 0, 1, 0)).not.toThrow();
    });
});
