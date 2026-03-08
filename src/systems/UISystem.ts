// UISystem.ts — Manages HTML/CSS overlay panels and modals.
// Ship panel, crew member details, colonisation confirmation.
// Listens for events from InputSystem and renders DOM elements.

import { System } from '../core/System';

export class UISystem extends System {
    update(_dt: number): void {
        // TODO: listen for 'ship:select', 'crew:select', 'colonise:confirm' events
        // TODO: show/hide/update DOM panels accordingly
    }
}
