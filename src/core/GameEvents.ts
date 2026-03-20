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
    /** Crew member(s) transferred between locations. */
    CREW_TRANSFERRED: 'crew:transferred',
    /** A colony leader was appointed. */
    LEADER_APPOINTED: 'leader:appointed',
    /** A colony leader was removed. */
    LEADER_REMOVED: 'leader:removed',
    /** The ship captain was appointed. */
    CAPTAIN_APPOINTED: 'captain:appointed',
    /** The ship captain was removed. */
    CAPTAIN_REMOVED: 'captain:removed',
    /** A building started construction. */
    BUILDING_STARTED: 'building:started',
    /** A building completed construction. */
    BUILDING_COMPLETED: 'building:completed',
    /** A building was demolished. */
    BUILDING_DEMOLISHED: 'building:demolished',
    /** Request transition to colony view. Carries planet entity ID and region ID. */
    COLONY_VIEW_ENTER: 'view:colony:enter',
    /** Request transition back to planet surface from colony view. */
    COLONY_VIEW_EXIT: 'view:colony:exit',
    /** A colonist changed activity (state machine transition). */
    COLONIST_ACTIVITY_CHANGED: 'colonist:activity_changed',
    /** A colonist arrived at their destination. */
    COLONIST_ARRIVED: 'colonist:arrived',
    /** Extiris AI has begun thinking (for UI indicator). */
    AI_PHASE_START: 'ai:phase:start',
    /** Extiris AI has finished its move. */
    AI_PHASE_END: 'ai:phase:end',
    /** Extiris movement animation completed. */
    EXTIRIS_MOVE_COMPLETE: 'extiris:move:complete',
    /** Extiris detected the player ship within sensor radius. */
    EXTIRIS_DETECTED_PLAYER: 'extiris:detected:player',
    /** A scout ship was destroyed by the Extiris. */
    SCOUT_DESTROYED: 'scout:destroyed',
    /** A scout ship docked with the main ship. */
    SCOUT_DOCKED: 'scout:docked',
    /** A ctrl+right-click occurred (waypoint queue). Carries world coordinates. */
    MODIFIER_RIGHT_CLICK: 'input:modifier-right-click',
    /** Extiris detected a scout within sensor radius. */
    EXTIRIS_DETECTED_SCOUT: 'extiris:detected:scout',
    /** A narrative event was shown and a choice was made. */
    NARRATIVE_SHOWN: 'narrative:shown',
} as const;

// ---------------------------------------------------------------------------
// Typed event payloads
// ---------------------------------------------------------------------------

export interface TurnAdvanceEvent extends GameEvent {
    type: typeof GameEvents.TURN_ADVANCE;
    /** When true, movement animations should teleport to destination (colony view turns). */
    skipAnimations?: boolean;
}

export interface TurnEndEvent extends GameEvent {
    type: typeof GameEvents.TURN_END;
    /** The new turn number after advancement. */
    turn: number;
    /** When true, movement animations should teleport to destination (colony view turns). */
    skipAnimations?: boolean;
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

export interface CrewTransferredEvent extends GameEvent {
    type: typeof GameEvents.CREW_TRANSFERRED;
    /** Number of crew transferred. */
    count: number;
}

export interface LeaderAppointedEvent extends GameEvent {
    type: typeof GameEvents.LEADER_APPOINTED;
}

export interface LeaderRemovedEvent extends GameEvent {
    type: typeof GameEvents.LEADER_REMOVED;
}

export interface CaptainAppointedEvent extends GameEvent {
    type: typeof GameEvents.CAPTAIN_APPOINTED;
}

export interface CaptainRemovedEvent extends GameEvent {
    type: typeof GameEvents.CAPTAIN_REMOVED;
}

export interface BuildingStartedEvent extends GameEvent {
    type: typeof GameEvents.BUILDING_STARTED;
}

export interface BuildingCompletedEvent extends GameEvent {
    type: typeof GameEvents.BUILDING_COMPLETED;
    /** Which building type completed construction. */
    buildingId: string;
}

export interface BuildingDemolishedEvent extends GameEvent {
    type: typeof GameEvents.BUILDING_DEMOLISHED;
}

export interface ColonyViewEnterEvent extends GameEvent {
    type: typeof GameEvents.COLONY_VIEW_ENTER;
    /** Planet entity ID. */
    entityId: number;
    /** Region ID of the colony. */
    regionId: number;
}

export interface ColonyViewExitEvent extends GameEvent {
    type: typeof GameEvents.COLONY_VIEW_EXIT;
}

export interface ColonistActivityChangedEvent extends GameEvent {
    type: typeof GameEvents.COLONIST_ACTIVITY_CHANGED;
    entityId: number;
    from: string;
    to: string;
    gridX: number;
    gridY: number;
}

export interface ColonistArrivedEvent extends GameEvent {
    type: typeof GameEvents.COLONIST_ARRIVED;
    entityId: number;
    gridX: number;
    gridY: number;
    buildingSlot?: number;
}

export interface AIPhaseStartEvent extends GameEvent {
    type: typeof GameEvents.AI_PHASE_START;
}

export interface AIPhaseEndEvent extends GameEvent {
    type: typeof GameEvents.AI_PHASE_END;
}

export interface ExtirisMoveCompleteEvent extends GameEvent {
    type: typeof GameEvents.EXTIRIS_MOVE_COMPLETE;
    entityId: number;
}

export interface ExtirisDetectedPlayerEvent extends GameEvent {
    type: typeof GameEvents.EXTIRIS_DETECTED_PLAYER;
}

export interface ScoutDestroyedEvent extends GameEvent {
    type: typeof GameEvents.SCOUT_DESTROYED;
    scoutEntityId: number;
    pilotName: string;
}

export interface ScoutDockedEvent extends GameEvent {
    type: typeof GameEvents.SCOUT_DOCKED;
    scoutEntityId: number;
}

export interface ModifierRightClickEvent extends GameEvent {
    type: typeof GameEvents.MODIFIER_RIGHT_CLICK;
    x: number;
    y: number;
}

export interface ExtirisDetectedScoutEvent extends GameEvent {
    type: typeof GameEvents.EXTIRIS_DETECTED_SCOUT;
    scoutEntityId: number;
}

export interface NarrativeShownEvent extends GameEvent {
    type: typeof GameEvents.NARRATIVE_SHOWN;
    /** ID of the narrative event that was shown. */
    id: string;
    /** Index of the choice made, or -1 for continue-only events. */
    choiceIndex: number;
}
