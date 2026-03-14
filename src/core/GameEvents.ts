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
    /** A right-click occurred on the canvas (not on an entity). Carries canvas coordinates. */
    RIGHT_CLICK: 'input:rightclick',
    /** A right-click occurred on a selectable entity. Carries entity ID and name. */
    ENTITY_RIGHT_CLICK: 'entity:rightClick',
    /** An entity finished moving to its target. Carries entity ID. */
    MOVE_COMPLETE: 'move:complete',
    /** Request transition to planet view. Carries the planet entity ID. */
    PLANET_VIEW_ENTER: 'view:planet:enter',
    /** Request transition back to system map. */
    PLANET_VIEW_EXIT: 'view:planet:exit',
    /** Colony established on a region. Carries region ID and biome name. */
    COLONISE_CONFIRM: 'colonise:confirm',
    /** The canvas was resized. Carries new pixel dimensions. */
    CANVAS_RESIZE: 'canvas:resize',
    /** Resources were updated after turn resolution. */
    RESOURCES_UPDATED: 'resources:updated',
    /** A resource went into deficit (below 0). Carries resource type and deficit amount. */
    RESOURCE_DEFICIT: 'resources:deficit',
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
    /** World x coordinate of the right-click. */
    x: number;
    /** World y coordinate of the right-click. */
    y: number;
}

export interface EntityRightClickEvent extends GameEvent {
    type: typeof GameEvents.ENTITY_RIGHT_CLICK;
    /** Numeric entity ID. */
    entityId: number;
    /** Debug name of the entity. */
    entityName: string;
}

export interface MoveCompleteEvent extends GameEvent {
    type: typeof GameEvents.MOVE_COMPLETE;
    /** Numeric entity ID of the entity that finished moving. */
    entityId: number;
}

export interface PlanetViewEnterEvent extends GameEvent {
    type: typeof GameEvents.PLANET_VIEW_ENTER;
    /** Entity ID of the planet to view. */
    entityId: number;
}

export interface PlanetViewExitEvent extends GameEvent {
    type: typeof GameEvents.PLANET_VIEW_EXIT;
}

export interface ColoniseConfirmEvent extends GameEvent {
    type: typeof GameEvents.COLONISE_CONFIRM;
    /** Region ID that was colonised. */
    regionId: number;
    /** Biome name of the colonised region. */
    biome: string;
}

export interface CanvasResizeEvent extends GameEvent {
    type: typeof GameEvents.CANVAS_RESIZE;
    /** New canvas width in pixels. */
    width: number;
    /** New canvas height in pixels. */
    height: number;
}

export interface ResourcesUpdatedEvent extends GameEvent {
    type: typeof GameEvents.RESOURCES_UPDATED;
}

export interface ResourceDeficitEvent extends GameEvent {
    type: typeof GameEvents.RESOURCE_DEFICIT;
    /** Which resource is in deficit. */
    resource: string;
    /** How much below zero (positive number). */
    deficit: number;
}
