import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { InputSystem } from '../InputSystem';
import { SelectableComponent } from '../../components/SelectableComponent';
import { TransformComponent } from '../../components/TransformComponent';

// Track listeners added to our mock canvas/window
type ListenerRecord = { type: string; handler: EventListener };

describe('InputSystem', () => {
    let world: World;
    let eventQueue: EventQueue;
    let mockCanvas: HTMLCanvasElement;
    let canvasListeners: ListenerRecord[];
    let windowListeners: ListenerRecord[];

    // Store the original window (may not exist in Node)
    const hadWindow = 'window' in globalThis;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let origWindow: any;

    beforeEach(() => {
        ServiceLocator.clear();

        canvasListeners = [];
        windowListeners = [];

        mockCanvas = {
            width: 800,
            height: 600,
            style: { cursor: '' },
            addEventListener: vi.fn((type: string, handler: EventListener) => {
                canvasListeners.push({ type, handler });
            }),
            removeEventListener: vi.fn((type: string, handler: EventListener) => {
                const idx = canvasListeners.findIndex(
                    (l) => l.type === type && l.handler === handler,
                );
                if (idx !== -1) canvasListeners.splice(idx, 1);
            }),
        } as unknown as HTMLCanvasElement;

        eventQueue = new EventQueue();
        ServiceLocator.register('canvas', mockCanvas);
        ServiceLocator.register('eventQueue', eventQueue);

        world = new World();

        // Stub globalThis.window with a mock that tracks addEventListener/removeEventListener
        if (hadWindow) {
            origWindow = globalThis.window;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).window = {
            addEventListener: vi.fn((type: string, handler: EventListener) => {
                windowListeners.push({ type, handler });
            }),
            removeEventListener: vi.fn((type: string, handler: EventListener) => {
                const idx = windowListeners.findIndex(
                    (l) => l.type === type && l.handler === handler,
                );
                if (idx !== -1) windowListeners.splice(idx, 1);
            }),
        };
    });

    afterEach(() => {
        if (hadWindow) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).window = origWindow;
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (globalThis as any).window;
        }
    });

    /** Simulate a mousemove event at the given canvas coordinates */
    function simulateMouseMove(x: number, y: number): void {
        const moveHandler = canvasListeners.find((l) => l.type === 'mousemove');
        if (moveHandler) {
            moveHandler.handler({ clientX: x, clientY: y } as MouseEvent);
        }
    }

    /** Simulate a click event */
    function simulateClick(): void {
        const clickHandler = canvasListeners.find((l) => l.type === 'click');
        if (clickHandler) {
            clickHandler.handler({} as MouseEvent);
        }
    }

    /** Simulate a keydown event */
    function simulateKeyDown(code: string): void {
        const keyHandler = windowListeners.find((l) => l.type === 'keydown');
        if (keyHandler) {
            keyHandler.handler({ code, preventDefault: vi.fn() } as unknown as KeyboardEvent);
        }
    }

    it('registers event listeners on init', () => {
        const system = new InputSystem();
        system.init(world);

        expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
            'mousemove',
            expect.any(Function),
        );
        expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
            'click',
            expect.any(Function),
        );
        expect(window.addEventListener).toHaveBeenCalledWith(
            'keydown',
            expect.any(Function),
        );
    });

    it('sets hovered=true when mouse is within hit radius', () => {
        const system = new InputSystem();
        system.init(world);

        const entity = world.createEntity('target');
        entity.addComponent(new TransformComponent(100, 100));
        const selectable = entity.addComponent(new SelectableComponent(20));

        // Move mouse within hit radius
        simulateMouseMove(110, 110); // distance ~14.1 < 20
        system.update(16);

        expect(selectable.hovered).toBe(true);
    });

    it('sets hovered=false when mouse is outside hit radius', () => {
        const system = new InputSystem();
        system.init(world);

        const entity = world.createEntity('target');
        entity.addComponent(new TransformComponent(100, 100));
        const selectable = entity.addComponent(new SelectableComponent(20));

        // Move mouse far away
        simulateMouseMove(500, 500);
        system.update(16);

        expect(selectable.hovered).toBe(false);
    });

    it('changes cursor to pointer when hovering', () => {
        const system = new InputSystem();
        system.init(world);

        const entity = world.createEntity('target');
        entity.addComponent(new TransformComponent(100, 100));
        entity.addComponent(new SelectableComponent(20));

        simulateMouseMove(100, 100);
        system.update(16);

        expect(mockCanvas.style.cursor).toBe('pointer');
    });

    it('resets cursor to default when not hovering', () => {
        const system = new InputSystem();
        system.init(world);

        const entity = world.createEntity('target');
        entity.addComponent(new TransformComponent(100, 100));
        entity.addComponent(new SelectableComponent(20));

        simulateMouseMove(500, 500);
        system.update(16);

        expect(mockCanvas.style.cursor).toBe('default');
    });

    it('emits entity:click event when clicking on a hovered entity', () => {
        const system = new InputSystem();
        system.init(world);

        const entity = world.createEntity('target');
        entity.addComponent(new TransformComponent(100, 100));
        entity.addComponent(new SelectableComponent(20));

        // Hover over entity then click
        simulateMouseMove(100, 100);
        simulateClick();
        system.update(16);

        // Check that an entity:click event was emitted
        const emittedEvents: Array<{ type: string; entityName?: string }> = [];
        eventQueue.on('entity:click', (event) => {
            emittedEvents.push(event as { type: string; entityName?: string });
        });
        eventQueue.drain();

        expect(emittedEvents).toHaveLength(1);
        expect(emittedEvents[0].entityName).toBe('target');
    });

    it('does not emit entity:click when clicking away from entities', () => {
        const system = new InputSystem();
        system.init(world);

        const entity = world.createEntity('target');
        entity.addComponent(new TransformComponent(100, 100));
        entity.addComponent(new SelectableComponent(20));

        // Move mouse far away and click
        simulateMouseMove(500, 500);
        simulateClick();
        system.update(16);

        const emittedEvents: Array<{ type: string }> = [];
        eventQueue.on('entity:click', (event) => {
            emittedEvents.push(event);
        });
        eventQueue.drain();

        expect(emittedEvents).toHaveLength(0);
    });

    it('emits turn:advance when Space key is pressed', () => {
        const system = new InputSystem();
        system.init(world);

        simulateKeyDown('Space');

        const emittedEvents: Array<{ type: string }> = [];
        eventQueue.on('turn:advance', (event) => {
            emittedEvents.push(event);
        });
        eventQueue.drain();

        expect(emittedEvents).toHaveLength(1);
    });

    it('clears pending click after processing', () => {
        const system = new InputSystem();
        system.init(world);

        const entity = world.createEntity('target');
        entity.addComponent(new TransformComponent(100, 100));
        entity.addComponent(new SelectableComponent(20));

        // Click and process
        simulateMouseMove(100, 100);
        simulateClick();
        system.update(16);

        // Drain to clear the first click event
        eventQueue.drain();

        // Second update without new click should not emit another event
        system.update(16);

        const emittedEvents: Array<{ type: string }> = [];
        eventQueue.on('entity:click', (event) => {
            emittedEvents.push(event);
        });
        eventQueue.drain();

        expect(emittedEvents).toHaveLength(0);
    });

    it('removes event listeners on destroy', () => {
        const system = new InputSystem();
        system.init(world);
        system.destroy();

        expect(mockCanvas.removeEventListener).toHaveBeenCalledWith(
            'mousemove',
            expect.any(Function),
        );
        expect(mockCanvas.removeEventListener).toHaveBeenCalledWith(
            'click',
            expect.any(Function),
        );
        expect(window.removeEventListener).toHaveBeenCalledWith(
            'keydown',
            expect.any(Function),
        );
    });
});
