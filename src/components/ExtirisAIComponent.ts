// ExtirisAIComponent.ts — The Extiris AI brain.
// Lifecycle component driven by ComponentSystem. Listens for TURN_ADVANCE to
// initiate AI decision-making, blocks the turn until movement completes.
// Delegates actual movement animation to ExtirisMovementComponent.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { TransformComponent } from './TransformComponent';
import { ExtirisMovementComponent } from './ExtirisMovementComponent';
import { PlanetDataComponent } from './PlanetDataComponent';
import { ScoutDataComponent } from './ScoutDataComponent';

import {
    EXTIRIS_SENSOR_RADIUS,
    EXTIRIS_MOVEMENT_BUDGET,
} from '../data/constants';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { AIService, ExtirisStatePayload, ExtirisAIResponse } from '../services/AIService';

type AIState = 'idle' | 'thinking';

export interface CombatEncounterRecord {
    turn: number;
    tacticUsed: string;
    crewSkillsUsed: string[];
    outcome: string;
    playerLosses: number;
}

export interface ExtirisMemory {
    lastSeenPlayerPos: { x: number; y: number; turn: number } | null;
    visitedPositions: Array<{ x: number; y: number; turn: number }>;
    knownPlanets: Array<{ name: string; x: number; y: number; lastVisitedTurn: number | null }>;
    reasoning: string;
    /** History of combat encounters for adaptation learning. */
    combatHistory: CombatEncounterRecord[];
    /** Currently active adaptation tags applied to crisis cards. */
    activeAdaptations: string[];
}

function isDebugEnabled(): boolean {
    try {
        return localStorage.getItem('extiris-debug') === 'true';
    } catch {
        return false;
    }
}

const BLOCKER_KEY = 'extiris-ai';

export class ExtirisAIComponent extends Component {
    readonly sensorRadius = EXTIRIS_SENSOR_RADIUS;
    readonly movementBudget = EXTIRIS_MOVEMENT_BUDGET;

    memory: ExtirisMemory = {
        lastSeenPlayerPos: null,
        visitedPositions: [],
        knownPlanets: [],
        reasoning: '',
        combatHistory: [],
        activeAdaptations: [],
    };

    aiState: AIState = 'idle';
    playerDetected = false;
    destroyed = false;

    private eventQueue: EventQueue | null = null;
    private turnAdvanceHandler: EventHandler | null = null;
    private moveCompleteHandler: EventHandler | null = null;
    private abortController: AbortController | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.turnAdvanceHandler = (): void => {
            if (this.aiState !== 'idle') return;
            this.startThinking();
        };

        this.moveCompleteHandler = (): void => {
            this.onMoveComplete();
        };

        this.eventQueue.on(GameEvents.TURN_ADVANCE, this.turnAdvanceHandler);
        this.eventQueue.on(GameEvents.EXTIRIS_MOVE_COMPLETE, this.moveCompleteHandler);
    }

    private startThinking(): void {
        this.aiState = 'thinking';
        this.playerDetected = false;
        this.turnCounter++;

        this.entity.emit({ type: GameEvents.TURN_BLOCK, key: BLOCKER_KEY });
        this.entity.emit({ type: GameEvents.AI_PHASE_START });

        const payload = this.buildStatePayload();
        if (isDebugEnabled()) {
            console.log('[Extiris AI] State payload:', payload);
        }

        this.abortController = new AbortController();

        let aiService: AIService;
        try {
            aiService = ServiceLocator.get<AIService>('aiService');
        } catch {
            // No AI service registered — skip AI phase
            this.finishTurn();
            return;
        }

        try {
            aiService.requestMove(payload, this.abortController.signal)
                .then((response) => {
                    if (this.destroyed) return;
                    this.handleAIResponse(response, payload);
                })
                .catch(() => {
                    if (this.destroyed) return;
                    this.finishTurn();
                });
        } catch {
            // Guard against synchronous throw before Promise is returned
            if (!this.destroyed) this.finishTurn();
        }
    }

    private handleAIResponse(response: ExtirisAIResponse, payload: ExtirisStatePayload): void {
        if (isDebugEnabled()) {
            console.log('[Extiris AI] Response:', response);
        }

        // Validate and clamp target
        const transform = this.entity.getComponent(TransformComponent);
        if (!transform) {
            this.finishTurn();
            return;
        }

        let { x: tx, y: ty } = response.target;

        // Clamp to movement budget
        const dx = tx - transform.x;
        const dy = ty - transform.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > this.movementBudget) {
            const scale = this.movementBudget / dist;
            tx = transform.x + dx * scale;
            ty = transform.y + dy * scale;
        }

        // Clamp to world bounds
        const bounds = payload.worldBounds;
        tx = Math.max(bounds.min, Math.min(bounds.max, tx));
        ty = Math.max(bounds.min, Math.min(bounds.max, ty));

        // Store reasoning
        this.memory.reasoning = response.reasoning.slice(0, 200);

        // Delegate movement to ExtirisMovementComponent
        const movement = this.entity.getComponent(ExtirisMovementComponent);
        if (movement) {
            movement.setTarget(tx, ty);
        } else {
            // No movement component — just snap position
            transform.x = tx;
            transform.y = ty;
            this.onMoveComplete();
        }
    }

    private onMoveComplete(): void {
        if (this.aiState !== 'thinking') return;

        const transform = this.entity.getComponent(TransformComponent);
        if (transform) {
            const currentTurn = this.getCurrentTurn();

            // Record visited position
            this.memory.visitedPositions.push({
                x: transform.x,
                y: transform.y,
                turn: currentTurn,
            });
            if (this.memory.visitedPositions.length > 10) {
                this.memory.visitedPositions.shift();
            }

            // Mark nearby planets as visited
            for (const planet of this.memory.knownPlanets) {
                const dx = transform.x - planet.x;
                const dy = transform.y - planet.y;
                if (dx * dx + dy * dy < 200 * 200) {
                    planet.lastVisitedTurn = currentTurn;
                }
            }
        }

        this.finishTurn();
    }

    private finishTurn(): void {
        this.aiState = 'idle';
        this.abortController = null;

        this.entity.emit({ type: GameEvents.TURN_UNBLOCK, key: BLOCKER_KEY });
        this.entity.emit({ type: GameEvents.AI_PHASE_END });
    }

    /** Incremented each time startThinking is called (proxy for turn number). */
    private turnCounter = 0;

    private getCurrentTurn(): number {
        return this.turnCounter;
    }

    buildStatePayload(): ExtirisStatePayload {
        const transform = this.entity.getComponent(TransformComponent);
        const selfX = transform?.x ?? 0;
        const selfY = transform?.y ?? 0;

        let world: World;
        try {
            world = ServiceLocator.get<World>('world');
        } catch {
            return this.emptyPayload(selfX, selfY);
        }

        // Scan for visible entities
        const visibleEntities: ExtirisStatePayload['visibleEntities'] = [];
        const currentTurn = this.getCurrentTurn();

        for (const entity of world.allEntities()) {
            if (entity === this.entity) continue;

            const entityTransform = entity.getComponent(TransformComponent);
            if (!entityTransform) continue;

            const dx = entityTransform.x - selfX;
            const dy = entityTransform.y - selfY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > this.sensorRadius) continue;

            // Determine entity type
            let type: 'planet' | 'ship' | 'star' | 'scout' | null = null;
            if (entity.name === 'arkSalvage') {
                type = 'ship';
            } else if (entity.hasComponent(ScoutDataComponent)) {
                type = 'scout';
            } else if (entity.hasComponent(PlanetDataComponent)) {
                type = 'planet';
            } else if (entity.name === 'star') {
                type = 'star';
            }

            if (!type) continue;

            visibleEntities.push({
                type,
                name: entity.name,
                x: entityTransform.x,
                y: entityTransform.y,
                distance,
            });

            // Track player detection
            if (type === 'ship') {
                this.playerDetected = true;
                this.memory.lastSeenPlayerPos = {
                    x: entityTransform.x,
                    y: entityTransform.y,
                    turn: currentTurn,
                };
                this.entity.emit({ type: GameEvents.EXTIRIS_DETECTED_PLAYER });
            }

            // Track scout detection
            if (type === 'scout') {
                this.playerDetected = true;
                this.entity.emit({
                    type: GameEvents.EXTIRIS_DETECTED_SCOUT,
                    scoutEntityId: entity.id,
                });
            }

            // Track known planets
            if (type === 'planet') {
                const known = this.memory.knownPlanets.find(p => p.name === entity.name);
                if (!known) {
                    this.memory.knownPlanets.push({
                        name: entity.name,
                        x: entityTransform.x,
                        y: entityTransform.y,
                        lastVisitedTurn: null,
                    });
                } else {
                    // Update position (planets orbit)
                    known.x = entityTransform.x;
                    known.y = entityTransform.y;
                }
            }
        }

        return {
            turn: currentTurn,
            self: {
                x: selfX,
                y: selfY,
                movementBudget: this.movementBudget,
                sensorRadius: this.sensorRadius,
            },
            visibleEntities,
            memory: {
                lastSeenPlayerPos: this.memory.lastSeenPlayerPos
                    ? {
                        x: this.memory.lastSeenPlayerPos.x,
                        y: this.memory.lastSeenPlayerPos.y,
                        turnsSinceLastSeen: currentTurn - this.memory.lastSeenPlayerPos.turn,
                    }
                    : null,
                visitedPositions: this.memory.visitedPositions.map(p => ({ x: p.x, y: p.y })),
                knownPlanets: this.memory.knownPlanets.map(p => ({
                    name: p.name,
                    x: p.x,
                    y: p.y,
                    turnsSinceLastVisit: p.lastVisitedTurn !== null
                        ? currentTurn - p.lastVisitedTurn
                        : null,
                })),
                previousReasoning: this.memory.reasoning,
            },
            worldBounds: { min: -5000, max: 5000 },
        };
    }

    private emptyPayload(selfX: number, selfY: number): ExtirisStatePayload {
        return {
            turn: 1,
            self: {
                x: selfX,
                y: selfY,
                movementBudget: this.movementBudget,
                sensorRadius: this.sensorRadius,
            },
            visibleEntities: [],
            memory: {
                lastSeenPlayerPos: null,
                visitedPositions: [],
                knownPlanets: [],
                previousReasoning: '',
            },
            worldBounds: { min: -5000, max: 5000 },
        };
    }

    destroy(): void {
        this.destroyed = true;

        // Abort in-flight fetch
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        // Prevent dangling blocker
        if (this.aiState !== 'idle' && this.eventQueue) {
            this.entity.emit({ type: GameEvents.TURN_UNBLOCK, key: BLOCKER_KEY });
            this.entity.emit({ type: GameEvents.AI_PHASE_END });
        }

        if (this.eventQueue && this.turnAdvanceHandler) {
            this.eventQueue.off(GameEvents.TURN_ADVANCE, this.turnAdvanceHandler);
        }
        if (this.eventQueue && this.moveCompleteHandler) {
            this.eventQueue.off(GameEvents.EXTIRIS_MOVE_COMPLETE, this.moveCompleteHandler);
        }
    }
}
