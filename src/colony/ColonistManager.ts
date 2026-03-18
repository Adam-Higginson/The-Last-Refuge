// ColonistManager.ts — Slim orchestrator for colonist state machines.
// Delegates to extracted modules for movement, location resolution, and sub-activities.
//
// Update Pipeline:
//
//   1. resolveSchedules()     — dawn stagger, shelter, schedule lookup
//   2. updateStateTransitions() — pathfind to new location on schedule change
//   3. updateSubActivities()    — cycle sub-activity animations within activities
//   4. updateMovement()         — advance walking/patrol positions

import { findPath } from './ColonistPathfinding';
import { getScheduleBlock } from './ColonistSchedule';
import { spreadAroundCell, resolveLocation } from './ColonistLocationResolver';
import { updateWalking, updatePatrol, emitActivityChanged } from './ColonistMovement';
import {
    resolveWorkSubActivity,
    resolveIdleSubActivity,
    resolveSocializingSubActivity,
    resolveEatingSubActivity,
} from './ColonistSubActivity';
import { applyTraitScheduleModifier, applyTraitSubActivityModifier } from './ColonistTraitModifiers';
import { CrewMemberComponent } from '../components/CrewMemberComponent';
import type { ColonistVisualState } from './ColonistState';
import type { ColonySimulationComponent } from '../components/ColonySimulationComponent';
import type { CrewRole } from '../components/CrewMemberComponent';
import type { EventQueue } from '../core/EventQueue';
import type { BuildingInstance } from '../data/buildings';
import type { World } from '../core/World';

// Re-export spreadAroundCell for external consumers (tests, etc.)
export { spreadAroundCell } from './ColonistLocationResolver';

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
        // Start at shelter door or near grid centre, spread out to avoid stacking
        const shelterDoor = sim.grid.getDoors().find(d => d.slotIndex === 0);
        const baseX = shelterDoor ? shelterDoor.gridX : 5;
        const baseY = shelterDoor ? shelterDoor.gridY : 5;
        const spawn = spreadAroundCell(sim.grid, baseX, baseY, crew.id);

        const state: ColonistVisualState = {
            entityId: crew.id,
            role: crew.role,
            activity: 'idle',
            gridX: spawn.gridX,
            gridY: spawn.gridY,
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
            subActivity: null,
            subActivityTimer: 0,
            subActivityPhase: 0,
            buildingTypeId: null,
            secondaryTarget: null,
            returningToOrigin: false,
            greetingTimer: 0,
            greetingTargetId: null,
            thoughtBubble: null,
            thoughtTimer: 0,
        };

        sim.colonistStates.set(crew.id, state);
    }
}

/** Count other colonists already socializing or walking toward socializing. */
function countOthersSocializing(
    sim: ColonySimulationComponent, excludeId: number, gameHour: number,
): number {
    let count = 0;
    for (const [id, c] of sim.colonistStates) {
        if (id === excludeId) continue;
        if (c.activity === 'socializing') {
            count++;
        } else if (c.activity === 'walking') {
            const sched = getScheduleBlock(c.role, gameHour, c.entityId);
            if (sched.activity === 'socializing') count++;
        }
    }
    return count;
}

/** Check if any other colonist is scheduled to socialize at this hour. */
function anyOtherScheduledToSocialize(
    sim: ColonySimulationComponent, excludeId: number, gameHour: number,
): boolean {
    for (const [id, c] of sim.colonistStates) {
        if (id === excludeId) continue;
        const sched = getScheduleBlock(c.role, gameHour, c.entityId);
        if (sched.activity === 'socializing') return true;
    }
    return false;
}

/** Count colonists near a given colonist for socializing sub-activity. */
function countNearbySocializing(sim: ColonySimulationComponent, entityId: number): number {
    const colonist = sim.colonistStates.get(entityId);
    if (!colonist) return 0;
    let count = 0;
    for (const [id, c] of sim.colonistStates) {
        if (id === entityId) continue;
        if (c.activity !== 'socializing') continue;
        const dx = c.gridX - colonist.gridX;
        const dy = c.gridY - colonist.gridY;
        if (Math.abs(dx) + Math.abs(dy) <= 3) count++;
    }
    return count;
}

interface ColonistCrewData {
    traits: [import('../components/CrewMemberComponent').Trait, import('../components/CrewMemberComponent').Trait];
    morale: number;
}

/** Get traits + morale for a colonist from the World in a single lookup. */
function getCrewData(world: World | undefined, entityId: number): ColonistCrewData | null {
    if (!world) return null;
    const entity = world.getEntity(entityId);
    if (!entity) return null;
    const crew = entity.getComponent(CrewMemberComponent);
    if (!crew) return null;
    return { traits: crew.traits, morale: crew.morale };
}

/** Set the initial sub-activity when a colonist arrives at their destination. */
function assignSubActivity(colonist: ColonistVisualState, sim: ColonySimulationComponent, world?: World): void {
    const elapsed = colonist.stateTimer;
    const crewData = getCrewData(world, colonist.entityId);
    const traits = crewData?.traits ?? null;
    const morale = crewData?.morale;
    // Clear carrying state when assigning new sub-activity
    colonist.secondaryTarget = null;
    colonist.returningToOrigin = false;

    switch (colonist.activity) {
        case 'working': {
            let result = resolveWorkSubActivity(colonist.role, colonist.buildingTypeId, colonist.entityId, elapsed);
            if (traits) result = applyTraitSubActivityModifier(result, traits);
            colonist.subActivity = result.subActivity;
            colonist.subActivityTimer = result.duration;

            // Set up carrying waypoint loop: walk to campfire/storage then back
            if (result.subActivity === 'carrying' && sim.campfireCell) {
                const target = spreadAroundCell(sim.grid, sim.campfireCell.gridX, sim.campfireCell.gridY, colonist.entityId);
                const roundX = Math.round(colonist.gridX);
                const roundY = Math.round(colonist.gridY);
                const pathToTarget = findPath(sim.grid, roundX, roundY, target.gridX, target.gridY);
                if (pathToTarget && pathToTarget.length > 0) {
                    colonist.secondaryTarget = target;
                    colonist.returningToOrigin = false;
                    colonist.path = pathToTarget;
                    colonist.pathIndex = 0;
                } else {
                    // Can't reach secondary target — skip carrying, re-resolve
                    const fallback = resolveWorkSubActivity(colonist.role, colonist.buildingTypeId, colonist.entityId, elapsed + 10);
                    colonist.subActivity = fallback.subActivity === 'carrying' ? 'hammering' : fallback.subActivity;
                    colonist.subActivityTimer = fallback.duration;
                }
            }
            break;
        }
        case 'idle': {
            let result = resolveIdleSubActivity(colonist.entityId, elapsed, morale);
            if (traits) result = applyTraitSubActivityModifier(result, traits);
            colonist.subActivity = result.subActivity;
            colonist.subActivityTimer = result.duration;
            break;
        }
        case 'socializing': {
            const nearby = countNearbySocializing(sim, colonist.entityId);
            let result = resolveSocializingSubActivity(colonist.entityId, elapsed, nearby, morale);
            if (traits) result = applyTraitSubActivityModifier(result, traits);
            colonist.subActivity = result.subActivity;
            colonist.subActivityTimer = result.duration;
            break;
        }
        case 'eating': {
            const result = resolveEatingSubActivity(colonist.entityId);
            colonist.subActivity = result.subActivity;
            colonist.subActivityTimer = result.duration;
            break;
        }
        default:
            colonist.subActivity = null;
            colonist.subActivityTimer = 0;
    }
    colonist.subActivityPhase = 0;
}

/** Advance a carrying colonist along their secondary target path. */
function advanceCarryingWalk(
    colonist: ColonistVisualState,
    sim: ColonySimulationComponent,
    dt: number,
): void {
    if (colonist.pathIndex >= colonist.path.length) {
        // Arrived at waypoint
        if (!colonist.returningToOrigin && colonist.secondaryTarget) {
            // At secondary target — now path back to building
            colonist.returningToOrigin = true;
            const door = colonist.assignedBuildingSlot !== null
                ? sim.grid.getDoors().find(d => d.slotIndex === colonist.assignedBuildingSlot)
                : null;
            if (door) {
                const roundX = Math.round(colonist.gridX);
                const roundY = Math.round(colonist.gridY);
                const returnPath = findPath(sim.grid, roundX, roundY, door.gridX, door.gridY);
                if (returnPath && returnPath.length > 0) {
                    colonist.path = returnPath;
                    colonist.pathIndex = 0;
                    return;
                }
            }
            // Can't path back — end carrying
            colonist.path = [];
            colonist.pathIndex = 0;
            colonist.secondaryTarget = null;
            colonist.returningToOrigin = false;
        } else {
            // Returned to origin — done carrying
            colonist.path = [];
            colonist.pathIndex = 0;
            colonist.secondaryTarget = null;
            colonist.returningToOrigin = false;
        }
        return;
    }

    // Move along path (same as walking but activity stays 'working')
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
    colonist.facingDirection = Math.atan2(dy, dx);
    colonist.walkPhase += dt * 8;
}

/** Update all colonist state machines. */
export function updateColonists(
    sim: ColonySimulationComponent,
    dt: number,
    gameHour: number,
    _weather: string,
    eventQueue: EventQueue,
    buildings: BuildingInstance[],
    world?: World,
): void {
    for (const [_id, colonist] of sim.colonistStates) {
        // Dawn stagger: wait for emerge delay
        if (colonist.emergeDelay > 0) {
            colonist.emergeDelay -= dt;
            colonist.sheltered = true;
            continue;
        }
        // Resting colonists assigned to shelter (slot 0) are inside the building
        if (colonist.activity === 'resting' && colonist.assignedBuildingSlot === 0) {
            colonist.sheltered = true;
            continue;
        }
        colonist.sheltered = false;

        // Increment state timer
        colonist.stateTimer += dt;

        // Building demolished while working: brief confused idle then schedule fallback
        if (colonist.activity === 'working' && colonist.assignedBuildingSlot !== null) {
            const buildingStillExists = buildings.some(
                b => b.slotIndex === colonist.assignedBuildingSlot && b.state === 'active',
            );
            if (!buildingStillExists) {
                colonist.activity = 'idle';
                colonist.subActivity = 'looking_around';
                colonist.subActivityTimer = 2.5;
                colonist.subActivityPhase = 0;
                colonist.assignedBuildingSlot = null;
                colonist.buildingTypeId = null;
                colonist.secondaryTarget = null;
                colonist.path = [];
                colonist.pathIndex = 0;
                emitActivityChanged(eventQueue, colonist.entityId, 'working', 'idle', colonist.gridX, colonist.gridY);
            }
        }

        // Single ECS lookup per colonist per frame
        const crewData = getCrewData(world, colonist.entityId);

        // Morale-driven walk speed: 0.7–1.0x based on morale
        if (crewData) {
            colonist.walkSpeed = 2.0 * (0.7 + 0.3 * crewData.morale / 100);
        }

        // Check current schedule, apply trait modifiers
        let schedule = getScheduleBlock(colonist.role, gameHour, colonist.entityId);
        if (crewData) {
            schedule = applyTraitScheduleModifier(schedule, crewData.traits, colonist.entityId, gameHour);
        }

        // Handle patrol separately for soldiers
        if (schedule.activity === 'patrolling' && sim.perimeterPath.length > 0) {
            updatePatrol(colonist, sim.perimeterPath, dt, eventQueue);
            continue;
        }

        // --- State transitions ---
        if (colonist.activity !== 'walking' && colonist.activity !== schedule.activity) {
            // Enforce group socializing: don't socialize alone
            if (schedule.activity === 'socializing') {
                const othersSocializing = countOthersSocializing(sim, colonist.entityId, gameHour);
                if (othersSocializing === 0) {
                    const othersScheduled = anyOtherScheduledToSocialize(sim, colonist.entityId, gameHour);
                    if (!othersScheduled) {
                        if (colonist.activity !== 'idle') {
                            const oldActivity = colonist.activity;
                            colonist.activity = 'idle';
                            colonist.subActivity = null;
                            emitActivityChanged(eventQueue, colonist.entityId, oldActivity, 'idle', colonist.gridX, colonist.gridY);
                        }
                        continue;
                    }
                }
            }

            const oldActivity = colonist.activity;
            const target = resolveLocation(sim, schedule.location, colonist.role, buildings, colonist.entityId, world);

            if (target) {
                const roundX = Math.round(colonist.gridX);
                const roundY = Math.round(colonist.gridY);
                const path = findPath(sim.grid, roundX, roundY, target.gridX, target.gridY);

                if (path && path.length > 0) {
                    colonist.path = path;
                    colonist.pathIndex = 0;
                    colonist.activity = 'walking';
                    colonist.assignedBuildingSlot = target.buildingSlot;
                    colonist.buildingTypeId = target.buildingTypeId;
                    colonist.subActivity = null;
                    colonist.stateTimer = 0;
                    emitActivityChanged(eventQueue, colonist.entityId, oldActivity, 'walking', colonist.gridX, colonist.gridY);
                } else if (path && path.length === 0) {
                    // Already at destination
                    colonist.activity = schedule.activity;
                    colonist.assignedBuildingSlot = target.buildingSlot;
                    colonist.buildingTypeId = target.buildingTypeId;
                    colonist.stateTimer = 0;
                    assignSubActivity(colonist, sim, world);
                    emitActivityChanged(eventQueue, colonist.entityId, oldActivity, schedule.activity, colonist.gridX, colonist.gridY);
                } else {
                    // No path — stay idle
                    if (colonist.activity !== 'idle') {
                        colonist.activity = 'idle';
                        colonist.subActivity = null;
                        emitActivityChanged(eventQueue, colonist.entityId, oldActivity, 'idle', colonist.gridX, colonist.gridY);
                    }
                }
            } else {
                if (colonist.activity !== 'idle') {
                    colonist.activity = 'idle';
                    colonist.subActivity = null;
                    emitActivityChanged(eventQueue, colonist.entityId, oldActivity, 'idle', colonist.gridX, colonist.gridY);
                }
            }
        }

        // --- Walking ---
        if (colonist.activity === 'walking') {
            const prevActivity = colonist.activity;
            updateWalking(colonist, dt, eventQueue, schedule.activity);
            // If walking just completed (activity changed), assign sub-activity
            if (prevActivity === 'walking' && colonist.activity !== 'walking') {
                assignSubActivity(colonist, sim, world);
            }
        }

        // --- Carrying walk (worker stays in 'working' activity but walks to secondary target) ---
        if (colonist.subActivity === 'carrying' && colonist.activity === 'working' && colonist.path.length > 0) {
            advanceCarryingWalk(colonist, sim, dt);
        }

        // --- Sub-activity cycling ---
        if (colonist.subActivity !== null && colonist.activity !== 'walking') {
            colonist.subActivityTimer -= dt;
            colonist.subActivityPhase += dt;
            if (colonist.subActivityTimer <= 0) {
                assignSubActivity(colonist, sim, world);
            }
        }

        // --- Greeting detection ---
        if (colonist.greetingTimer > 0) {
            colonist.greetingTimer -= dt;
            if (colonist.greetingTimer <= 0) {
                colonist.greetingTargetId = null;
            }
        } else if (colonist.activity === 'walking' && world) {
            // Check if walking near a friend
            const crewEntity = world.getEntity(colonist.entityId);
            const crew = crewEntity?.getComponent(CrewMemberComponent);
            if (crew) {
                for (const rel of crew.relationships) {
                    if (rel.type !== 'Close Bond' && rel.type !== 'Romantic') continue;
                    const other = sim.colonistStates.get(rel.targetId);
                    if (!other || other.sheltered) continue;
                    const dx = other.gridX - colonist.gridX;
                    const dy = other.gridY - colonist.gridY;
                    if (Math.abs(dx) + Math.abs(dy) <= 1.5) {
                        colonist.greetingTimer = 0.5;
                        colonist.greetingTargetId = rel.targetId;
                        break;
                    }
                }
            }
        }

        // --- Thought bubble timer ---
        if (colonist.thoughtTimer > 0) {
            colonist.thoughtTimer -= dt;
            if (colonist.thoughtTimer <= 0) {
                colonist.thoughtBubble = null;
            }
        }
    }
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
