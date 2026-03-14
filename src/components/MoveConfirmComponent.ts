// MoveConfirmComponent.ts — Two-tap move confirmation for touch input.
// When the ship is selected and the player taps empty space, this component
// shows a pending move marker. A second tap near the marker confirms the move.
// Tapping elsewhere repositions the marker. Renders a dotted line, pulsing ring,
// and a screen-space "TAP TO MOVE" label.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { CameraComponent } from './CameraComponent';
import { SelectableComponent } from './SelectableComponent';
import { TransformComponent } from './TransformComponent';
import { MovementComponent } from './MovementComponent';
import type { World } from '../core/World';
import type { RightClickEvent, EntityClickEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Distance threshold for confirming a pending move (world units) */
const CONFIRM_RADIUS = 80;

export class MoveConfirmComponent extends Component {
    /** Pending move destination — shown as marker, confirmed by second tap */
    pendingX: number | null = null;
    pendingY: number | null = null;

    private label: HTMLElement | null = null;
    private eventQueue: EventQueue | null = null;
    private deselectedHandler: EventHandler | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        // Create DOM label element
        this.label = document.createElement('div');
        this.label.className = 'move-confirm-label';
        this.label.textContent = 'TAP TO MOVE';
        this.label.style.cssText = `
            position: fixed;
            pointer-events: none;
            color: rgba(120, 220, 255, 0.9);
            font: bold 14px "Share Tech Mono", "Courier New", monospace;
            text-align: center;
            transform: translateX(-50%);
            display: none;
            z-index: 10;
            text-shadow: 0 0 6px rgba(0, 0, 0, 0.8);
        `;
        document.body.appendChild(this.label);

        // Clear pending move when a different entity is clicked
        this.deselectedHandler = (event): void => {
            const { entityName } = event as EntityClickEvent;
            if (entityName !== this.entity.name) {
                this.clear();
            }
        };
        this.eventQueue.on(GameEvents.ENTITY_CLICK, this.deselectedHandler);
    }

    /** Called by InputSystem when a touch tap lands on empty space while ship is selected */
    handleTap(worldX: number, worldY: number): void {
        const movement = this.entity.getComponent(MovementComponent);
        if (!movement || movement.moving) return;

        const selectable = this.entity.getComponent(SelectableComponent);
        if (!selectable?.selected) return;

        // If there's already a pending move, check if this tap confirms it
        if (this.pendingX !== null && this.pendingY !== null) {
            const dx = worldX - this.pendingX;
            const dy = worldY - this.pendingY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= CONFIRM_RADIUS) {
                // Confirm — emit RIGHT_CLICK so MovementComponent picks it up
                this.eventQueue?.emit({
                    type: GameEvents.RIGHT_CLICK,
                    x: this.pendingX,
                    y: this.pendingY,
                } as RightClickEvent);
                this.clear();
                return;
            }
        }

        // Set/reposition pending marker
        this.pendingX = worldX;
        this.pendingY = worldY;
    }

    /** Clear pending move state */
    clear(): void {
        this.pendingX = null;
        this.pendingY = null;
        if (this.label) {
            this.label.style.display = 'none';
        }
    }

    update(_dt: number): void {
        const selectable = this.entity.getComponent(SelectableComponent);
        if (!selectable?.selected) {
            this.clear();
            return;
        }

        const movement = this.entity.getComponent(MovementComponent);
        if (!movement || movement.moving) {
            this.clear();
            return;
        }

        // Update label position
        if (this.pendingX !== null && this.pendingY !== null && this.label) {
            const world = ServiceLocator.get<World>('world');
            const cameraEntity = world.getEntityByName('camera');
            const camera = cameraEntity?.getComponent(CameraComponent);
            if (camera) {
                const transform = this.entity.getComponent(TransformComponent);
                if (!transform) return;

                // Clamp pending pos to budget range for display
                const dx = this.pendingX - transform.x;
                const dy = this.pendingY - transform.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                let displayX = this.pendingX;
                let displayY = this.pendingY;
                if (dist > movement.budgetRemaining) {
                    const scale = movement.budgetRemaining / dist;
                    displayX = transform.x + dx * scale;
                    displayY = transform.y + dy * scale;
                }

                const screenPos = camera.worldToScreen(displayX, displayY);
                this.label.style.left = `${screenPos.x}px`;
                this.label.style.top = `${screenPos.y - 30}px`;
                this.label.style.display = 'block';
            }
        }
    }

    /** Render the pending move marker (dotted line + pulsing ring) in world space */
    renderMarker(
        ctx: CanvasRenderingContext2D,
        shipX: number,
        shipY: number,
        budgetRemaining: number,
    ): void {
        if (this.pendingX === null || this.pendingY === null) return;

        const t = performance.now();

        // Clamp to budget
        const dx = this.pendingX - shipX;
        const dy = this.pendingY - shipY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let endX = this.pendingX;
        let endY = this.pendingY;
        if (dist > budgetRemaining) {
            const scale = budgetRemaining / dist;
            endX = shipX + dx * scale;
            endY = shipY + dy * scale;
        }

        ctx.save();

        // Dotted line from ship to pending destination
        ctx.beginPath();
        ctx.setLineDash([24, 16]);
        ctx.moveTo(shipX, shipY);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = 'rgba(120, 220, 255, 0.4)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.setLineDash([]);

        // Pulsing ring at destination
        const pulse = 0.5 + 0.5 * Math.sin(t / 400);
        const ringR = 24 + pulse * 8;
        ctx.beginPath();
        ctx.arc(endX, endY, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(120, 220, 255, ${(0.5 + pulse * 0.3).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.restore();
    }

    destroy(): void {
        if (this.label && this.label.parentNode) {
            this.label.parentNode.removeChild(this.label);
        }
        if (this.eventQueue && this.deselectedHandler) {
            this.eventQueue.off(GameEvents.ENTITY_CLICK, this.deselectedHandler);
        }
    }
}
