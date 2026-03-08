// GameEvents.ts — Central registry of all event type strings and their payloads.
// Use GameEvents.X constants instead of raw strings when emitting or subscribing.
// Typos become compile errors, and all event documentation lives here.

import type { GameEvent } from './EventQueue';

// ---------------------------------------------------------------------------
// Event type constants
// ---------------------------------------------------------------------------

/** All event type strings used in the EventQueue. */
export const GameEvents = {
    /** Request to advance a turn. Emitted by InputSystem / UI. TurnSystem validates. */
    TURN_ADVANCE: 'turn:advance',
    /** A turn was successfully advanced. Carries the new turn number. */
    TURN_END: 'turn:end',
    /** A system is blocking turn advancement. Carries a unique key. */
    TURN_BLOCK: 'turn:block',
    /** A system is no longer blocking turn advancement. Carries the same key. */
    TURN_UNBLOCK: 'turn:unblock',
    /** A selectable entity was clicked. Carries entity ID and name. */
    ENTITY_CLICK: 'entity:click',
    /** A right-click occurred on the canvas. Carries canvas coordinates. */
    RIGHT_CLICK: 'input:rightclick',
    /** An entity finished moving to its target. Carries entity ID. */
    MOVE_COMPLETE: 'move:complete',
} as const;

// ---------------------------------------------------------------------------
// Typed event payloads
// ---------------------------------------------------------------------------

export interface TurnAdvanceEvent extends GameEvent {
    type: typeof GameEvents.TURN_ADVANCE;
}

export interface TurnEndEvent extends GameEvent {
    type: typeof GameEvents.TURN_END;
    /** The new turn number after advancement. */
    turn: number;
}

export interface TurnBlockEvent extends GameEvent {
    type: typeof GameEvents.TURN_BLOCK;
    /** Unique key identifying the blocker (e.g. 'orbit', 'combat'). */
    key: string;
}

export interface TurnUnblockEvent extends GameEvent {
    type: typeof GameEvents.TURN_UNBLOCK;
    /** Key matching the original turn:block event. */
    key: string;
}

export interface EntityClickEvent extends GameEvent {
    type: typeof GameEvents.ENTITY_CLICK;
    /** Numeric entity ID. */
    entityId: number;
    /** Debug name of the entity. */
    entityName: string;
}

export interface RightClickEvent extends GameEvent {
    type: typeof GameEvents.RIGHT_CLICK;
    /** Canvas x coordinate of the right-click. */
    x: number;
    /** Canvas y coordinate of the right-click. */
    y: number;
}

export interface MoveCompleteEvent extends GameEvent {
    type: typeof GameEvents.MOVE_COMPLETE;
    /** Numeric entity ID of the entity that finished moving. */
    entityId: number;
}
