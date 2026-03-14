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
