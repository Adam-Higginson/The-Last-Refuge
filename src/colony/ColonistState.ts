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

// Sub-activities cycle within each top-level activity for visual variety.
export type WorkSubActivity =
    | 'hammering'
    | 'carrying'
    | 'watering'
    | 'harvesting'
    | 'checking_patient'
    | 'calibrating';

export type IdleSubActivity =
    | 'standing'
    | 'stretching'
    | 'sitting'
    | 'looking_around';

export type SocializingSubActivity =
    | 'chatting'
    | 'laughing'
    | 'gesturing'
    | 'sitting_together';

export type EatingSubActivity =
    | 'sitting_eating'
    | 'eating_standing';

export type SubActivity =
    | WorkSubActivity
    | IdleSubActivity
    | SocializingSubActivity
    | EatingSubActivity;

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
    subActivity: SubActivity | null;
    subActivityTimer: number;
    subActivityPhase: number;
    buildingTypeId: string | null;
    secondaryTarget: { gridX: number; gridY: number } | null;
    returningToOrigin: boolean;
    greetingTimer: number;
    greetingTargetId: number | null;
    thoughtBubble: string | null;
    thoughtTimer: number;
}
