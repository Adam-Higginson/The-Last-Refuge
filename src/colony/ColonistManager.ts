// ColonistManager.ts — Stateless orchestrator for colonist state machines.
// Operates on ColonySimulationComponent fields. Handles init, update, and
// state transitions with event emission.

import { findPath } from './ColonistPathfinding';
import { getScheduleBlock } from './ColonistSchedule';
import { GameEvents } from '../core/GameEvents';
import type { ColonistActivity, ColonistVisualState } from './ColonistState';
import type { ColonySimulationComponent } from '../components/ColonySimulationComponent';
import type { CrewRole } from '../components/CrewMemberComponent';
import type { EventQueue } from '../core/EventQueue';
import type { BuildingInstance } from '../data/buildings';

const ROLE_COLOURS: Record<string, string> = {
    Soldier: '#4fa8ff',
    Civilian: '#66bb6a',
    Engineer: '#c0c8d8',
    Medic: '#ef5350',
    Scientist: '#ffca28',
};

const SKIN_TONES = [
    '#f5d0b0', '#e8b88a', '#d4a574', '#c08a5a',
    '#a0714a', '#8a5a3a', '#6a4030', '#4a2a1a',
];

const HAIR_COLOURS = [
    '#1a1a1a', '#3a2a1a', '#5a3a20',
    '#8a6030', '#b08040', '#2a2a2a',
];

function getSkinTone(id: number): string {
    return SKIN_TONES[id % SKIN_TONES.length];
}

function getHairColour(id: number): string {
    return HAIR_COLOURS[(id * 3 + 7) % HAIR_COLOURS.length];
}

/** Initialise colonist visual states from crew entities. */
export function initColonists(
    sim: ColonySimulationComponent,
    crewEntities: { id: number; role: CrewRole; isLeader: boolean; name: string }[],
): void {
    sim.colonistStates.clear();

    for (const crew of crewEntities) {
        // Start at shelter door or near grid centre
        const shelterDoor = sim.grid.getDoors().find(d => d.slotIndex === 0);
        const startX = shelterDoor ? shelterDoor.gridX : 5;
        const startY = shelterDoor ? shelterDoor.gridY : 5;

        const state: ColonistVisualState = {
            entityId: crew.id,
            role: crew.role,
            activity: 'idle',
            gridX: startX,
            gridY: startY,
            path: [],
            pathIndex: 0,
            walkSpeed: 2.0,
            stateTimer: 0,
            facingDirection: 0,
            assignedBuildingSlot: null,
            sheltered: false,
            emergeDelay: (Math.sin(crew.id * 3.7 + 1.2) * 0.5 + 0.5) * 2, // 0-2s
            skinTone: getSkinTone(crew.id),
            hairColour: getHairColour(crew.id),
            colour: ROLE_COLOURS[crew.role] ?? '#c0c8d8',
            name: crew.name,
            isLeader: crew.isLeader,
            walkPhase: (crew.id * 2.3) % (Math.PI * 2),
        };

        sim.colonistStates.set(crew.id, state);
    }
}

interface ResolvedLocation {
    gridX: number;
    gridY: number;
    buildingSlot: number | null;
}

/** Resolve a schedule location to a grid cell. */
function resolveLocation(
    sim: ColonySimulationComponent,
    location: string,
    role: CrewRole,
    buildings: BuildingInstance[],
    entityId: number,
): ResolvedLocation | null {
    if (location === 'social_area') {
        return sim.campfireCell ? { ...sim.campfireCell, buildingSlot: null } : null;
    }

    if (location === 'shelter') {
        const shelterDoor = sim.grid.getDoors().find(d => d.slotIndex === 0);
        if (shelterDoor) return { gridX: shelterDoor.gridX, gridY: shelterDoor.gridY, buildingSlot: 0 };
        return sim.campfireCell ? { ...sim.campfireCell, buildingSlot: null } : null;
    }

    if (location === 'patrol') {
        // Soldiers use perimeter path — handled separately
        return null;
    }

    if (location === 'workplace') {
        // Find a building that requires this role
        const ROLE_BUILDINGS: Record<string, string[]> = {
            Civilian: ['farm', 'hydroponics_bay'],
            Engineer: ['solar_array', 'workshop', 'hydroponics_bay'],
            Medic: ['med_bay'],
            Scientist: ['workshop'],
            Soldier: ['barracks'],
        };
        const roleBuildings = buildings.filter(b =>
            ROLE_BUILDINGS[role]?.includes(b.typeId) && b.state === 'active',
        );

        if (roleBuildings.length > 0) {
            // Round-robin by entity ID
            const building = roleBuildings[entityId % roleBuildings.length];
            const door = sim.grid.getDoors().find(d => d.slotIndex === building.slotIndex);
            if (door) return { gridX: door.gridX, gridY: door.gridY, buildingSlot: building.slotIndex };

            // Fallback: building centre
            const center = sim.grid.getBuildingCenter(building.slotIndex);
            if (center) return { ...center, buildingSlot: building.slotIndex };
        }

        // No building for this role — go to campfire
        return sim.campfireCell ? { ...sim.campfireCell, buildingSlot: null } : null;
    }

    return null;
}

/** Emit state change event. */
function emitActivityChanged(
    eventQueue: EventQueue,
    entityId: number,
    from: ColonistActivity,
    to: ColonistActivity,
    gridX: number,
    gridY: number,
): void {
    eventQueue.emit({
        type: GameEvents.COLONIST_ACTIVITY_CHANGED,
        entityId,
        from,
        to,
        gridX,
        gridY,
    });
}

/** Emit arrival event. */
function emitArrived(
    eventQueue: EventQueue,
    entityId: number,
    gridX: number,
    gridY: number,
    buildingSlot?: number,
): void {
    eventQueue.emit({
        type: GameEvents.COLONIST_ARRIVED,
        entityId,
        gridX,
        gridY,
        buildingSlot,
    });
}

/** Update all colonist state machines. */
export function updateColonists(
    sim: ColonySimulationComponent,
    dt: number,
    gameHour: number,
    _weather: string,
    eventQueue: EventQueue,
    buildings: BuildingInstance[],
): void {
    for (const [_id, colonist] of sim.colonistStates) {
        // Dawn stagger: wait for emerge delay
        if (colonist.emergeDelay > 0) {
            colonist.emergeDelay -= dt;
            colonist.sheltered = true;
            continue;
        }
        colonist.sheltered = false;

        // Check current schedule
        const schedule = getScheduleBlock(colonist.role, gameHour, colonist.entityId);

        // Handle patrol separately for soldiers
        if (schedule.activity === 'patrolling' && sim.perimeterPath.length > 0) {
            updatePatrol(colonist, sim, dt, eventQueue);
            continue;
        }

        // Check if schedule demands a different activity
        if (colonist.activity !== 'walking' && colonist.activity !== schedule.activity) {
            const oldActivity = colonist.activity;
            const target = resolveLocation(sim, schedule.location, colonist.role, buildings, colonist.entityId);

            if (target) {
                const roundX = Math.round(colonist.gridX);
                const roundY = Math.round(colonist.gridY);
                const path = findPath(sim.grid, roundX, roundY, target.gridX, target.gridY);

                if (path && path.length > 0) {
                    colonist.path = path;
                    colonist.pathIndex = 0;
                    colonist.activity = 'walking';
                    colonist.assignedBuildingSlot = target.buildingSlot;
                    emitActivityChanged(eventQueue, colonist.entityId, oldActivity, 'walking', colonist.gridX, colonist.gridY);
                } else if (path && path.length === 0) {
                    // Already at destination
                    colonist.activity = schedule.activity;
                    colonist.assignedBuildingSlot = target.buildingSlot;
                    emitActivityChanged(eventQueue, colonist.entityId, oldActivity, schedule.activity, colonist.gridX, colonist.gridY);
                } else {
                    // No path — stay idle
                    if (colonist.activity !== 'idle') {
                        colonist.activity = 'idle';
                        emitActivityChanged(eventQueue, colonist.entityId, oldActivity, 'idle', colonist.gridX, colonist.gridY);
                    }
                }
            } else {
                // No target location (or patrol without perimeter path)
                if (colonist.activity !== 'idle') {
                    colonist.activity = 'idle';
                    emitActivityChanged(eventQueue, colonist.entityId, oldActivity, 'idle', colonist.gridX, colonist.gridY);
                }
            }
        }

        // Update walking
        if (colonist.activity === 'walking') {
            updateWalking(colonist, dt, eventQueue, schedule.activity);
        }
    }
}

/** Advance a walking colonist along their A* path. */
function updateWalking(
    colonist: ColonistVisualState,
    dt: number,
    eventQueue: EventQueue,
    destinationActivity: ColonistActivity,
): void {
    if (colonist.pathIndex >= colonist.path.length) {
        // Arrived
        const oldActivity = colonist.activity;
        colonist.activity = destinationActivity;
        colonist.path = [];
        colonist.pathIndex = 0;
        emitActivityChanged(eventQueue, colonist.entityId, oldActivity, destinationActivity, colonist.gridX, colonist.gridY);
        emitArrived(eventQueue, colonist.entityId, colonist.gridX, colonist.gridY);
        return;
    }

    const target = colonist.path[colonist.pathIndex];
    const dx = target.gridX - colonist.gridX;
    const dy = target.gridY - colonist.gridY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.05) {
        colonist.gridX = target.gridX;
        colonist.gridY = target.gridY;
        colonist.pathIndex++;
        return;
    }

    const moveAmount = colonist.walkSpeed * dt;
    if (moveAmount >= dist) {
        colonist.gridX = target.gridX;
        colonist.gridY = target.gridY;
        colonist.pathIndex++;
    } else {
        colonist.gridX += (dx / dist) * moveAmount;
        colonist.gridY += (dy / dist) * moveAmount;
    }

    // Update facing direction
    colonist.facingDirection = Math.atan2(dy, dx);
    colonist.walkPhase += dt * 8;
}

/** Update soldier patrol — walk the perimeter loop. */
function updatePatrol(
    colonist: ColonistVisualState,
    sim: ColonySimulationComponent,
    dt: number,
    eventQueue: EventQueue,
): void {
    if (colonist.activity !== 'patrolling') {
        const oldActivity = colonist.activity;
        colonist.activity = 'patrolling';

        // Find closest perimeter point to start
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < sim.perimeterPath.length; i++) {
            const p = sim.perimeterPath[i];
            const dx = p.gridX - colonist.gridX;
            const dy = p.gridY - colonist.gridY;
            const d = dx * dx + dy * dy;
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        colonist.pathIndex = bestIdx;
        emitActivityChanged(eventQueue, colonist.entityId, oldActivity, 'patrolling', colonist.gridX, colonist.gridY);
    }

    const target = sim.perimeterPath[colonist.pathIndex % sim.perimeterPath.length];
    if (!target) return;

    const dx = target.gridX - colonist.gridX;
    const dy = target.gridY - colonist.gridY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.05) {
        colonist.gridX = target.gridX;
        colonist.gridY = target.gridY;
        colonist.pathIndex = (colonist.pathIndex + 1) % sim.perimeterPath.length;
    } else {
        const moveAmount = colonist.walkSpeed * dt;
        if (moveAmount >= dist) {
            colonist.gridX = target.gridX;
            colonist.gridY = target.gridY;
            colonist.pathIndex = (colonist.pathIndex + 1) % sim.perimeterPath.length;
        } else {
            colonist.gridX += (dx / dist) * moveAmount;
            colonist.gridY += (dy / dist) * moveAmount;
        }
    }

    colonist.facingDirection = Math.atan2(dy, dx);
    colonist.walkPhase += dt * 8;
}

/** Get colonists sorted by depth (gridX + gridY) for correct render order. */
export function getVisibleColonists(sim: ColonySimulationComponent): ColonistVisualState[] {
    const visible: ColonistVisualState[] = [];
    for (const [_id, colonist] of sim.colonistStates) {
        if (!colonist.sheltered) {
            visible.push(colonist);
        }
    }
    visible.sort((a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY));
    return visible;
}
