// EngineStateComponent.ts — Data component tracking the ship's engine repair state.
//
// State machine:
//   OFFLINE ──startRepair()──▶ REPAIRING ──turns complete──▶ ONLINE
//
// Ship starts with engines offline (damaged from emergency hyperjump).
// Repair requires the Keth relay station to be repaired first.
// Once online, engines stay online permanently (terminal state).

import { Component } from '../core/Component';
import {
    ENGINE_REPAIR_TURNS,
    ENGINE_REPAIR_COST,
} from '../data/constants';

export type EngineState = 'offline' | 'repairing' | 'online';

export class EngineStateComponent extends Component {
    engineState: EngineState = 'offline';
    repairTurnsTotal: number = ENGINE_REPAIR_TURNS;
    repairTurnsRemaining: number = ENGINE_REPAIR_TURNS;
    repairCost: number = ENGINE_REPAIR_COST;
}
