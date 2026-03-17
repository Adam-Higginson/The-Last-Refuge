// VisibilitySourceComponent.ts — Marks an entity as a source of fog-of-war visibility.
// Data-only component: effective radii are animated by FogOfWarComponent.

import { Component } from '../core/Component';

export class VisibilitySourceComponent extends Component {
    /** Configured maximum detail radius (full visibility). */
    readonly detailRadius: number;
    /** Configured maximum blip radius (partial visibility). */
    readonly blipRadius: number;
    /** Whether this source is currently active (false when colony has 0 crew). */
    active: boolean;
    /** Current animated detail radius (grows toward detailRadius). */
    effectiveDetailRadius: number;
    /** Current animated blip radius (grows toward blipRadius). */
    effectiveBlipRadius: number;

    constructor(detailRadius: number, blipRadius: number, startFull = false) {
        super();
        this.detailRadius = detailRadius;
        this.blipRadius = blipRadius;
        this.active = true;
        this.effectiveDetailRadius = startFull ? detailRadius : 0;
        this.effectiveBlipRadius = startFull ? blipRadius : 0;
    }
}
