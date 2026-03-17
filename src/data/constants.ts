// constants.ts — Shared gameplay constants.

/** Fog of war grid dimensions (cells per axis). World is divided into gridSize x gridSize cells. */
export const FOG_GRID_SIZE = 100;

/** Size of each fog cell in world units. */
export const FOG_CELL_SIZE = 100;

/** Full visibility radius around the ship (world units). Interaction enabled. */
export const FOG_DETAIL_RADIUS = 600;

/** Blip radius around the ship (world units). Entities shown as simple dots, no interaction. */
export const FOG_BLIP_RADIUS = 1200;

/** Minimum soldiers required on the ship for it to move. */
export const SHIP_MIN_SOLDIERS = 2;

/** Minimum engineers required on the ship for full efficiency. */
export const SHIP_MIN_ENGINEERS = 3;

/** Minimum crew to found a new colony (excluding leader). */
export const COLONY_MIN_CREW = 5;

/** Full visibility radius around a colony (world units). */
export const COLONY_FOG_DETAIL_RADIUS = 400;

/** Blip radius around a colony (world units). */
export const COLONY_FOG_BLIP_RADIUS = 600;

/** Duration of the colony fog reveal animation (seconds). */
export const FOG_REVEAL_DURATION = 1.5;

/** Extiris sensor radius — what it can "see" (world units). */
export const EXTIRIS_SENSOR_RADIUS = 1500;

/** Extiris movement budget per turn (world units). Faster than player's 800. */
export const EXTIRIS_MOVEMENT_BUDGET = 1000;

/** Extiris movement animation speed (world units/sec). */
export const EXTIRIS_MOVEMENT_SPEED = 400;

/** Extiris spawn distance from origin (world units). */
export const EXTIRIS_SPAWN_RADIUS = 4500;
