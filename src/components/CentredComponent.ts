// CentredComponent.ts — Keeps entity position centred at the canvas midpoint.
// Subscribes to CANVAS_RESIZE to re-centre on window resize.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { TransformComponent } from './TransformComponent';
import type { CanvasResizeEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

export class CentredComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private resizeHandler: EventHandler | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.resizeHandler = (event): void => {
            const { width, height } = event as CanvasResizeEvent;
            const transform = this.entity.getComponent(TransformComponent);
            if (transform) {
                transform.x = width / 2;
                transform.y = height / 2;
            }
        };

        this.eventQueue.on(GameEvents.CANVAS_RESIZE, this.resizeHandler);
    }

    destroy(): void {
        if (this.eventQueue && this.resizeHandler) {
            this.eventQueue.off(GameEvents.CANVAS_RESIZE, this.resizeHandler);
        }
    }
}
