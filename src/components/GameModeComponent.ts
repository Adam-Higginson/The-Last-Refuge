// GameModeComponent.ts — Tracks the active game view mode.
// Lives on the 'gameState' entity. Queried by systems and other
// components to decide rendering and input behaviour.

import { Component } from '../core/Component';

export type GameMode =
    | 'system' | 'planet' | 'colony'
    | 'transitioning-to-planet' | 'transitioning-to-system'
    | 'transitioning-to-colony' | 'transitioning-to-planet-from-colony';

export class GameModeComponent extends Component {
    mode: GameMode = 'system';

    /** Transition progress from 0 (start) to 1 (complete). */
    transitionProgress = 0;

    /** Duration of the transition animation in seconds. */
    transitionDuration = 1.5;

    /** Entity ID of the planet being viewed (set during transition / planet mode). */
    planetEntityId: number | null = null;

    /** Region ID of the colony being viewed (set during colony mode). */
    colonyRegionId: number | null = null;
}
