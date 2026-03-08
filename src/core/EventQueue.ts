// EventQueue.ts — Central event bus for cross-entity and cross-system communication.
// Decouples senders from receivers both statically and in time.
// Events are queued and processed in FIFO order during a dedicated drain step.

export interface GameEvent {
    type: string;
    [key: string]: unknown;
}

export type EventHandler = (event: GameEvent) => void;

export class EventQueue {
    private handlers: Map<string, EventHandler[]> = new Map();
    private queue: GameEvent[] = [];

    /** Subscribe to events of a given type */
    on(type: string, handler: EventHandler): void {
        const list = this.handlers.get(type);
        if (list) {
            list.push(handler);
        } else {
            this.handlers.set(type, [handler]);
        }
    }

    /** Unsubscribe a handler */
    off(type: string, handler: EventHandler): void {
        const list = this.handlers.get(type);
        if (!list) return;
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
    }

    /** Enqueue an event for processing on the next drain */
    emit(event: GameEvent): void {
        this.queue.push(event);
    }

    /** Process all queued events, dispatching to registered handlers */
    drain(): void {
        // Snapshot the current queue so events emitted during processing
        // are deferred to the next drain cycle
        const events = this.queue;
        this.queue = [];

        for (const event of events) {
            const list = this.handlers.get(event.type);
            if (!list) continue;
            for (const handler of list) {
                handler(event);
            }
        }
    }

    /** Clear all queued events without processing them */
    clear(): void {
        this.queue = [];
    }

    /** Remove all handlers and queued events */
    destroy(): void {
        this.handlers.clear();
        this.queue = [];
    }
}
