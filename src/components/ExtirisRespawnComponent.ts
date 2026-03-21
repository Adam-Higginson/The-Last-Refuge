// ExtirisRespawnComponent.ts — Countdown timer for Extiris respawn after destruction.
// Attached to the gameState entity when the Extiris is destroyed via sacrifice.
// Counts down turns, then spawns a new Extiris with inherited combat memory
// and escalated difficulty.
//
// STATE: turnsRemaining > 0 → counting down
//        turnsRemaining = 0 → respawn triggered, component removes itself

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { createExtiris } from '../entities/createExtiris';
import { ExtirisAIComponent } from './ExtirisAIComponent';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { TurnEndEvent } from '../core/GameEvents';

/** Base turns before Extiris respawns after destruction. */
const RESPAWN_TURNS = 8;

/** Maximum difficulty bonus from respawn escalation. */
const MAX_DIFFICULTY_ESCALATION = 3;

function isDebugEnabled(): boolean {
    try {
        return localStorage.getItem('combat-debug') === 'true';
    } catch {
        return false;
    }
}

export class ExtirisRespawnComponent extends Component {
    /** Turns remaining until the Extiris respawns. */
    turnsRemaining: number;
    /** Total number of times the Extiris has been destroyed. */
    destructionCount: number;
    /** Difficulty escalation applied to crisis cards (+1 per destruction, capped). */
    difficultyEscalation: number;

    private eventQueue: EventQueue | null = null;
    private turnEndHandler: EventHandler | null = null;

    constructor(destructionCount: number) {
        super();
        this.destructionCount = destructionCount;
        this.turnsRemaining = RESPAWN_TURNS;
        this.difficultyEscalation = Math.min(destructionCount, MAX_DIFFICULTY_ESCALATION);
    }

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.turnEndHandler = (event): void => {
            const e = event as TurnEndEvent;
            this.onTurnEnd(e);
        };

        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);

        if (isDebugEnabled()) {
            console.log(`[Combat] Extiris respawn timer started: ${this.turnsRemaining} turns (destruction #${this.destructionCount}, difficulty +${this.difficultyEscalation})`);
        }
    }

    private onTurnEnd(_event: TurnEndEvent): void {
        this.turnsRemaining--;

        if (isDebugEnabled()) {
            console.log(`[Combat] Extiris respawn in ${this.turnsRemaining} turns`);
        }

        if (this.turnsRemaining <= 0) {
            this.spawnExtiris();
        }
    }

    private spawnExtiris(): void {
        let world: World;
        try {
            world = ServiceLocator.get<World>('world');
        } catch {
            return;
        }

        // Guard against double-spawn
        if (world.getEntityByName('extiris')) return;

        const newExtiris = createExtiris(world);

        if (isDebugEnabled()) {
            console.log(`[Combat] Extiris respawned (destruction #${this.destructionCount}, difficulty +${this.difficultyEscalation})`);
        }

        // Emit respawn event
        if (this.eventQueue) {
            this.eventQueue.emit({
                type: GameEvents.EXTIRIS_RESPAWN,
                destructionCount: this.destructionCount,
            });
        }

        // Remove this component from gameState — respawn is complete
        // Set the difficulty escalation note on the new Extiris AI
        const ai = newExtiris.getComponent(ExtirisAIComponent);
        if (ai) {
            ai.memory.reasoning =
                `Replacement hunter #${this.destructionCount + 1}. Predecessor was destroyed. Difficulty escalated by +${this.difficultyEscalation}.`;
        }

        // Clean up — remove the respawn timer component
        this.entity.removeComponent(ExtirisRespawnComponent);
    }

    destroy(): void {
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
    }
}

export { RESPAWN_TURNS, MAX_DIFFICULTY_ESCALATION };
