import { describe, it, expect, vi } from 'vitest';
import { EventQueue } from '../EventQueue';

describe('EventQueue', () => {
    it('delivers events to registered handlers on drain', () => {
        const queue = new EventQueue();
        const handler = vi.fn();

        queue.on('test', handler);
        queue.emit({ type: 'test', value: 42 });
        queue.drain();

        expect(handler).toHaveBeenCalledWith({ type: 'test', value: 42 });
    });

    it('does not deliver events before drain', () => {
        const queue = new EventQueue();
        const handler = vi.fn();

        queue.on('test', handler);
        queue.emit({ type: 'test' });

        expect(handler).not.toHaveBeenCalled();
    });

    it('delivers events in FIFO order', () => {
        const queue = new EventQueue();
        const received: number[] = [];

        queue.on('test', (e) => received.push(e.order as number));
        queue.emit({ type: 'test', order: 1 });
        queue.emit({ type: 'test', order: 2 });
        queue.emit({ type: 'test', order: 3 });
        queue.drain();

        expect(received).toEqual([1, 2, 3]);
    });

    it('only delivers to handlers matching event type', () => {
        const queue = new EventQueue();
        const alphaHandler = vi.fn();
        const betaHandler = vi.fn();

        queue.on('alpha', alphaHandler);
        queue.on('beta', betaHandler);
        queue.emit({ type: 'alpha' });
        queue.drain();

        expect(alphaHandler).toHaveBeenCalledOnce();
        expect(betaHandler).not.toHaveBeenCalled();
    });

    it('supports multiple handlers for the same event type', () => {
        const queue = new EventQueue();
        const handlerA = vi.fn();
        const handlerB = vi.fn();

        queue.on('test', handlerA);
        queue.on('test', handlerB);
        queue.emit({ type: 'test' });
        queue.drain();

        expect(handlerA).toHaveBeenCalledOnce();
        expect(handlerB).toHaveBeenCalledOnce();
    });

    it('unsubscribes a handler with off()', () => {
        const queue = new EventQueue();
        const handler = vi.fn();

        queue.on('test', handler);
        queue.off('test', handler);
        queue.emit({ type: 'test' });
        queue.drain();

        expect(handler).not.toHaveBeenCalled();
    });

    it('defers events emitted during drain to the next cycle', () => {
        const queue = new EventQueue();
        const secondary = vi.fn();

        queue.on('first', () => {
            queue.emit({ type: 'second' });
        });
        queue.on('second', secondary);

        queue.emit({ type: 'first' });
        queue.drain();

        // The secondary event was emitted during drain, so it should NOT
        // have been processed yet
        expect(secondary).not.toHaveBeenCalled();

        // It should be processed on the next drain
        queue.drain();
        expect(secondary).toHaveBeenCalledOnce();
    });

    it('clears queued events without processing', () => {
        const queue = new EventQueue();
        const handler = vi.fn();

        queue.on('test', handler);
        queue.emit({ type: 'test' });
        queue.clear();
        queue.drain();

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores events with no handlers', () => {
        const queue = new EventQueue();

        // Should not throw
        queue.emit({ type: 'unhandled' });
        queue.drain();
    });
});
