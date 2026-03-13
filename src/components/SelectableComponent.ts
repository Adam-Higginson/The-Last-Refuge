// SelectableComponent.ts — Makes an entity clickable/hoverable on the canvas.
// InputSystem uses the hitRadius to detect mouse interactions.

import { Component } from '../core/Component';

export class SelectableComponent extends Component {
    hitRadius: number;       // distance from transform position for hit detection
    hovered: boolean;
    selected: boolean;
    cursorStyle: string;     // CSS cursor to show on hover
    cursorX: number;         // current mouse x (world coords), written by InputSystem
    cursorY: number;         // current mouse y (world coords), written by InputSystem

    constructor(hitRadius: number, cursorStyle = 'pointer') {
        super();
        this.hitRadius = hitRadius;
        this.hovered = false;
        this.selected = false;
        this.cursorStyle = cursorStyle;
        this.cursorX = 0;
        this.cursorY = 0;
    }
}
