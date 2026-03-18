// EventStateComponent.ts — Tracks narrative event state on the gameState entity.
// Records which events have fired, state flags set by choices,
// and chain events queued for future turns.

import { Component } from '../core/Component';

export interface ChainEntry {
    eventId: string;
    triggerTurn: number;
}

export class EventStateComponent extends Component {
    /** Event IDs that have already fired. */
    readonly seenEventIds: Set<string> = new Set();

    /** State flags set by narrative choices. */
    readonly flags: Set<string> = new Set();

    /** Pending chain events scheduled for future turns. */
    readonly chainQueue: ChainEntry[] = [];

    addFlag(flag: string): void {
        this.flags.add(flag);
    }

    hasFlag(flag: string): boolean {
        return this.flags.has(flag);
    }

    markSeen(eventId: string): void {
        this.seenEventIds.add(eventId);
    }

    hasSeen(eventId: string): boolean {
        return this.seenEventIds.has(eventId);
    }

    queueChain(eventId: string, currentTurn: number, delay: number): void {
        this.chainQueue.push({ eventId, triggerTurn: currentTurn + delay });
    }

    /** Returns and removes all chain entries whose triggerTurn matches the given turn. */
    getTriggeredChains(turn: number): ChainEntry[] {
        const triggered: ChainEntry[] = [];
        for (let i = this.chainQueue.length - 1; i >= 0; i--) {
            if (this.chainQueue[i].triggerTurn <= turn) {
                triggered.push(this.chainQueue[i]);
                this.chainQueue.splice(i, 1);
            }
        }
        return triggered;
    }
}
