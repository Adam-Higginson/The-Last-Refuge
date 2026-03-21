// IntelComponent.ts — Tracks intel fragments gathered from Extiris encounters.
// 3 fragments = 1 countermeasure (negates an active Extiris adaptation).
// Attached to the gameState entity.

import { Component } from '../core/Component';

export class IntelComponent extends Component {
    /** Intel fragments collected from encounters (partial failure outcomes). */
    fragments = 0;
    /** How many countermeasures the player has used (for tracking). */
    countermeasuresUsed = 0;
}
