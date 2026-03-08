// TurnSystem.ts — Owns the turn counter and validates turn advancement.
// Listens for 'turn:advance' requests (from InputSystem / UI).
// Validates the request (e.g. blocks if orbit animation is still playing),
// then increments the turn counter and emits 'turn:end' for other systems.

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { OrbitComponent } from '../components/OrbitComponent';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';

export class TurnSystem extends System {
    private eventQueue!: EventQueue;
    private turnAdvanceHandler!: EventHandler;

    /** Current turn number (starts at 1) */
    currentTurn = 1;

    init(world: World): void {
        super.init(world);
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.turnAdvanceHandler = (): void => {
            // Block turn advance if any orbit animation is still playing
            const orbiters = this.world.getEntitiesWithComponent(OrbitComponent);
            for (const entity of orbiters) {
                const orbit = entity.getComponent(OrbitComponent);
                if (orbit?.animating) return;
            }

            this.currentTurn++;
            this.eventQueue.emit({ type: 'turn:end', turn: this.currentTurn });
        };

        this.eventQueue.on('turn:advance', this.turnAdvanceHandler);
    }

    update(_dt: number): void {
        // No per-tick logic — turn advancement is event-driven
    }

    destroy(): void {
        this.eventQueue.off('turn:advance', this.turnAdvanceHandler);
    }
}
