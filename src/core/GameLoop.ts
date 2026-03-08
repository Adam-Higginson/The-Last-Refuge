// GameLoop.ts — Fixed-timestep update with variable rendering.
//
// Based on the "Fix Your Timestep" pattern:
//   - update() ticks at a fixed rate (TICK_RATE) for deterministic game logic
//   - render() runs every requestAnimationFrame with an interpolation alpha
//     so animations stay smooth regardless of frame rate
//   - The event queue is drained once per frame after all updates

import { World } from './World';
import { EventQueue } from './EventQueue';
import { ServiceLocator } from './ServiceLocator';

const TICK_RATE = 1000 / 60;  // ~16.67ms per update tick
const MAX_FRAME_TIME = 250;    // Clamp to avoid spiral of death

export class GameLoop {
    private world: World;
    private running = false;
    private previousTime = 0;
    private accumulator = 0;
    private rafId = 0;

    constructor(world: World) {
        this.world = world;
    }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.previousTime = performance.now();
        this.accumulator = 0;
        this.rafId = requestAnimationFrame((t) => this.loop(t));
    }

    stop(): void {
        this.running = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        }
    }

    private loop(currentTime: number): void {
        if (!this.running) return;

        let frameTime = currentTime - this.previousTime;
        this.previousTime = currentTime;

        // Clamp large frame deltas to prevent spiral of death
        // (e.g. when tab is backgrounded and comes back)
        if (frameTime > MAX_FRAME_TIME) {
            frameTime = MAX_FRAME_TIME;
        }

        this.accumulator += frameTime;

        // Fixed-timestep updates: consume accumulated time in fixed chunks
        while (this.accumulator >= TICK_RATE) {
            this.world.update(TICK_RATE / 1000); // pass dt in seconds
            this.accumulator -= TICK_RATE;
        }

        // Drain the event queue once per frame, after all updates
        const eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        eventQueue.drain();

        // Render with interpolation alpha for smooth animation
        const alpha = this.accumulator / TICK_RATE;
        this.world.render(alpha);

        this.rafId = requestAnimationFrame((t) => this.loop(t));
    }
}
