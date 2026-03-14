// constants.ts — Shared gameplay constants.

/** Maximum distance (px) between ship and planet for colonisation / planet descent. */
export const COLONISE_RANGE = 150;

/** Fog of war grid dimensions (cells per axis). World is divided into gridSize x gridSize cells. */
export const FOG_GRID_SIZE = 100;

/** Size of each fog cell in world units. */
export const FOG_CELL_SIZE = 100;

/** Full visibility radius around the ship (world units). Interaction enabled. */
export const FOG_DETAIL_RADIUS = 600;

/** Blip radius around the ship (world units). Entities shown as simple dots, no interaction. */
export const FOG_BLIP_RADIUS = 1200;
