// ScoutDataComponent.ts — Identity and data component for scout ships.
// Used for getEntitiesWithComponent() queries and trail rendering.

import { Component } from '../core/Component';

export class ScoutDataComponent extends Component {
    displayName: string;
    pilotEntityId: number;
    pilotName: string;
    trailPositions: Array<{ x: number; y: number }>;
    /** Whether the scout is damaged and unable to move. */
    damaged: boolean;
    /** Turns remaining until the scout is repaired. 0 = operational. */
    damagedTurnsRemaining: number;

    constructor(displayName: string, pilotEntityId: number, pilotName: string) {
        super();
        this.displayName = displayName;
        this.pilotEntityId = pilotEntityId;
        this.pilotName = pilotName;
        this.trailPositions = [];
        this.damaged = false;
        this.damagedTurnsRemaining = 0;
    }
}
