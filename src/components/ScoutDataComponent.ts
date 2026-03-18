// ScoutDataComponent.ts — Identity and data component for scout ships.
// Used for getEntitiesWithComponent() queries and trail rendering.

import { Component } from '../core/Component';

export class ScoutDataComponent extends Component {
    displayName: string;
    pilotEntityId: number;
    pilotName: string;
    trailPositions: Array<{ x: number; y: number }>;

    constructor(displayName: string, pilotEntityId: number, pilotName: string) {
        super();
        this.displayName = displayName;
        this.pilotEntityId = pilotEntityId;
        this.pilotName = pilotName;
        this.trailPositions = [];
    }
}
