// RenderComponent.ts — Rendering data for an entity.
// The RenderSystem reads this to know how to draw the entity.

import { Component } from '../core/Component';

export type RenderLayer = 'background' | 'world' | 'foreground' | 'hud';

export type RenderFunction = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    scale: number,
    dt: number,
) => void;

export class RenderComponent extends Component {
    layer: RenderLayer;
    draw: RenderFunction;
    visible: boolean;

    constructor(layer: RenderLayer, draw: RenderFunction) {
        super();
        this.layer = layer;
        this.draw = draw;
        this.visible = true;
    }
}
