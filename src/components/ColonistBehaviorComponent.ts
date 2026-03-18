// ColonistBehaviorComponent.ts — ECS component for colonist visual state in colony view.
// Attached to crew entities when entering colony view, removed on exit.
// Data/state container — updated by ColonistManager orchestrator via ColonySimulationComponent.
//
// State Machine:
//
//   [emerge] ─▶ idle ──▶ walking ──▶ { working | socializing | eating | resting | patrolling }
//                 ▲                         │
//                 └─────── schedule ─────────┘
//
// Sub-activities cycle within each top-level activity (e.g. working → hammering → carrying → watering).

import { Component } from '../core/Component';
import type { ColonistActivity, SubActivity } from '../colony/ColonistState';
import type { CrewRole } from './CrewMemberComponent';

export class ColonistBehaviorComponent extends Component {
    // --- Identity / visual ---
    role: CrewRole = 'Civilian';
    skinTone = '#f5d0b0';
    hairColour = '#1a1a1a';
    colour = '#c0c8d8';
    name = 'Unknown';
    isLeader = false;

    // --- Position & movement ---
    gridX = 0;
    gridY = 0;
    path: { gridX: number; gridY: number }[] = [];
    pathIndex = 0;
    walkSpeed = 2.0;
    facingDirection = 0;
    walkPhase = 0;

    // --- Activity state ---
    activity: ColonistActivity = 'idle';
    stateTimer = 0;
    assignedBuildingSlot: number | null = null;
    sheltered = false;
    emergeDelay = 0;

    // --- Sub-activity layer ---
    subActivity: SubActivity | null = null;
    subActivityTimer = 0;
    subActivityPhase = 0;
    buildingTypeId: string | null = null;

    // --- Carrying loop ---
    secondaryTarget: { gridX: number; gridY: number } | null = null;
    returningToOrigin = false;

    // --- Interrupt (Phase C) ---
    currentInterrupt: unknown = null;
}
