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

// ─── Scout constants ─────────────────────────────────────────────────────
/** Scout movement budget per turn (world units). Faster than ship's 800. */
export const SCOUT_MOVEMENT_BUDGET = 1200;

/** Scout movement animation speed (world units/sec). */
export const SCOUT_GLIDE_SPEED = 700;

/** Scout hit radius for hover/click detection (world units). */
export const SCOUT_HIT_RADIUS = 40;

/** Scout hull half-length (tip to centre, world units). */
export const SCOUT_HULL_LENGTH = 28;

/** Scout hull half-width at widest point (world units). */
export const SCOUT_HULL_WIDTH = 16;

/** Full visibility radius around a scout (world units). */
export const SCOUT_FOG_DETAIL_RADIUS = 300;

/** Blip radius around a scout (world units). */
export const SCOUT_FOG_BLIP_RADIUS = 600;

/** Extiris catch distance to destroy a scout (world units). */
export const SCOUT_KILL_RADIUS = 100;

/** Number of past positions to show in scout movement trail. */
export const SCOUT_TRAIL_LENGTH = 12;

// ─── Station constants ──────────────────────────────────────────────────
/** Station orbit radius — distance from Dust's centre (world units). Moon-like orbit. */
export const STATION_ORBIT_RADIUS = 200;

/** Station orbit speed — faster than planet orbit for visible moon-like motion (rad/turn). */
export const STATION_ORBIT_SPEED = 0.15;

/** Station starting angle around Dust (radians). */
export const STATION_START_ANGLE = 0;

/** Station hit radius for hover/click detection (world units). */
export const STATION_HIT_RADIUS = 60;

/** Turns required to repair the station. */
export const STATION_REPAIR_TURNS = 8;

/** Material cost to begin station repair. */
export const STATION_REPAIR_COST = 40;

/** Station detail visibility radius when repaired (world units). */
export const STATION_FOG_DETAIL_RADIUS = 400;

/** Station blip visibility radius when repaired (world units). */
export const STATION_FOG_BLIP_RADIUS = 800;
