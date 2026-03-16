// TurnSystem.ts — Owns the turn counter and validates turn advancement.
// Listens for 'turn:advance' requests (from InputSystem / UI).
// Other systems can block advancement by emitting 'turn:block' / 'turn:unblock'
// events with a unique key. Turn advances only when no blockers are active.

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import type { TurnBlockEvent, TurnUnblockEvent } from '../core/GameEvents';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';

export class TurnSystem extends System {
    private eventQueue!: EventQueue;
    private turnAdvanceHandler!: EventHandler;
    private turnBlockHandler!: EventHandler;
    private turnUnblockHandler!: EventHandler;

    /** Current turn number (starts at 1) */
    currentTurn = 1;

    /** Active blocker keys — turn cannot advance while this set is non-empty */
    readonly blockers: ReadonlySet<string> = new Set<string>();

    /** Timestamps when each blocker was added (for stale blocker detection) */
    private blockerTimestamps = new Map<string, number>();

    /** Maximum time (ms) a blocker can be active before auto-removal */
    private static readonly BLOCKER_TIMEOUT_MS = 30_000;

    init(world: World): void {
        super.init(world);
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.turnBlockHandler = (event): void => {
            const { key } = event as TurnBlockEvent;
            if (key) {
                (this.blockers as Set<string>).add(key);
                this.blockerTimestamps.set(key, Date.now());
            }
        };

        this.turnUnblockHandler = (event): void => {
            const { key } = event as TurnUnblockEvent;
            if (key) {
                (this.blockers as Set<string>).delete(key);
                this.blockerTimestamps.delete(key);
            }
        };

        this.turnAdvanceHandler = (): void => {
            if (this.blockers.size > 0) return;

            this.currentTurn++;
            this.eventQueue.emit({ type: GameEvents.TURN_END, turn: this.currentTurn });
        };

        this.eventQueue.on(GameEvents.TURN_ADVANCE, this.turnAdvanceHandler);
        this.eventQueue.on(GameEvents.TURN_BLOCK, this.turnBlockHandler);
        this.eventQueue.on(GameEvents.TURN_UNBLOCK, this.turnUnblockHandler);
    }

    update(_dt: number): void {
        // Auto-remove stale blockers that have been active too long
        const now = Date.now();
        for (const [key, timestamp] of this.blockerTimestamps) {
            if (now - timestamp > TurnSystem.BLOCKER_TIMEOUT_MS) {
                console.warn(`Auto-removed stale blocker: ${key}`);
                (this.blockers as Set<string>).delete(key);
                this.blockerTimestamps.delete(key);
            }
        }
    }

    destroy(): void {
        this.eventQueue.off(GameEvents.TURN_ADVANCE, this.turnAdvanceHandler);
        this.eventQueue.off(GameEvents.TURN_BLOCK, this.turnBlockHandler);
        this.eventQueue.off(GameEvents.TURN_UNBLOCK, this.turnUnblockHandler);
    }
}
