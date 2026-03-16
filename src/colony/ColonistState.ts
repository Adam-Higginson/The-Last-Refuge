// ColonistState.ts — State machine types for colony colonists.

import type { CrewRole } from '../components/CrewMemberComponent';

export type ColonistActivity =
    | 'idle'
    | 'walking'
    | 'working'
    | 'socializing'
    | 'resting'
    | 'eating'
    | 'patrolling';

export interface ColonistVisualState {
    entityId: number;
    role: CrewRole;
    activity: ColonistActivity;
    gridX: number;
    gridY: number;
    path: { gridX: number; gridY: number }[];
    pathIndex: number;
    walkSpeed: number;
    stateTimer: number;
    facingDirection: number;
    assignedBuildingSlot: number | null;
    sheltered: boolean;
    emergeDelay: number;
    skinTone: string;
    hairColour: string;
    colour: string;
    name: string;
    isLeader: boolean;
    walkPhase: number;
}
