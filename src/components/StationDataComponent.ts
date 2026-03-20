// StationDataComponent.ts — Data component for the abandoned station entity.
// Tracks discovery state, repair progress, and display info.

import { Component } from '../core/Component';
import { STATION_REPAIR_TURNS, STATION_REPAIR_COST } from '../data/constants';

export type StationRepairState = 'undiscovered' | 'discovered' | 'repairing' | 'repaired';

export class StationDataComponent extends Component {
    readonly displayName: string = 'Keth Mining Relay';
    discovered = false;
    repairState: StationRepairState = 'undiscovered';
    readonly repairTurnsTotal: number = STATION_REPAIR_TURNS;
    repairTurnsRemaining: number = STATION_REPAIR_TURNS;
    readonly repairCost: number = STATION_REPAIR_COST;
}
