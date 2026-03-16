// ColonyViewInputComponent.ts — Canvas click/hover handling for colony view.
// Lives on the planet entity. Active only when gameMode.mode === 'colony'.
// Inverse-transforms mouse coords through COLONY_ZOOM, hit-tests against
// building slot rects on ColonySceneStateComponent, and writes hover/select.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { GameModeComponent } from './GameModeComponent';
import { ColonySceneStateComponent } from './ColonySceneStateComponent';
import type { EventQueue } from '../core/EventQueue';
import type { World } from '../core/World';

export class ColonyViewInputComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private world: World | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private mouseX = 0;
    private mouseY = 0;
    private onMouseMove: ((e: MouseEvent) => void) | null = null;
    private onClick: ((e: MouseEvent) => void) | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private onTouchStart: ((e: TouchEvent) => void) | null = null;
    private onTouchMove: ((e: TouchEvent) => void) | null = null;
    private onTouchEnd: ((e: TouchEvent) => void) | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        this.world = ServiceLocator.get<World>('world');
        this.canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

        this.onMouseMove = (e: MouseEvent): void => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        };
        this.canvas.addEventListener('mousemove', this.onMouseMove);

        this.onTouchStart = (e: TouchEvent): void => {
            const touch = e.touches[0];
            if (touch) {
                this.mouseX = touch.clientX;
                this.mouseY = touch.clientY;
            }
        };
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });

        this.onTouchMove = (e: TouchEvent): void => {
            const touch = e.touches[0];
            if (touch) {
                this.mouseX = touch.clientX;
                this.mouseY = touch.clientY;
            }
        };
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });

        this.onClick = (_e: MouseEvent): void => {
            this.handleClick();
        };
        this.canvas.addEventListener('click', this.onClick);

        this.onTouchEnd = (e: TouchEvent): void => {
            const gameMode = this.getGameMode();
            if (!gameMode || gameMode.mode !== 'colony') return;
            e.preventDefault();
            this.handleClick();
        };
        this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });

        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Escape') {
                const gameMode = this.getGameMode();
                if (gameMode && gameMode.mode === 'colony') {
                    e.preventDefault();
                    const state = this.entity.getComponent(ColonySceneStateComponent);
                    if (state) {
                        // If a colonist is selected, deselect first
                        if (state.selectedColonistId !== null) {
                            state.selectedColonistId = null;
                            return;
                        }
                        state.selectedSlotIndex = null;
                        state.hoveredSlotIndex = null;
                    }
                    this.eventQueue?.emit({ type: GameEvents.COLONY_VIEW_EXIT });
                }
            }
        };
        window.addEventListener('keydown', this.onKeyDown);
    }

    update(_dt: number): void {
        const gameMode = this.getGameMode();
        if (!gameMode || gameMode.mode !== 'colony') {
            return;
        }

        const state = this.entity.getComponent(ColonySceneStateComponent);
        if (!state) return;

        // Inverse-transform mouse coords through the shared view transform
        const vt = state.viewTransform;
        const zoomedX = (this.mouseX - vt.groundCentreX) / vt.zoom + vt.groundCentreX;
        const zoomedY = (this.mouseY - vt.groundCentreY) / vt.zoom + vt.groundCentreY;

        // Hit-test against slot rects
        state.hoveredSlotIndex = null;
        for (const rect of state.lastSlotRects) {
            if (
                zoomedX >= rect.x &&
                zoomedX <= rect.x + rect.width &&
                zoomedY >= rect.y &&
                zoomedY <= rect.y + rect.height
            ) {
                state.hoveredSlotIndex = rect.slotIndex;
                break;
            }
        }
    }

    private handleClick(): void {
        const gameMode = this.getGameMode();
        if (!gameMode || gameMode.mode !== 'colony') return;

        const state = this.entity.getComponent(ColonySceneStateComponent);
        if (!state) return;

        // Inverse-transform mouse coords for colonist hit-testing
        const vt = state.viewTransform;
        const zoomedX = (this.mouseX - vt.groundCentreX) / vt.zoom + vt.groundCentreX;
        const zoomedY = (this.mouseY - vt.groundCentreY) / vt.zoom + vt.groundCentreY;

        // Test colonists first (foreground priority)
        const HIT_RADIUS = 12;
        for (const pos of state.lastColonistPositions) {
            const dx = zoomedX - pos.screenX;
            const dy = zoomedY - pos.screenY;
            if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) {
                state.selectedColonistId = pos.entityId;
                state.selectedSlotIndex = null;
                return;
            }
        }

        // No colonist hit — clear colonist selection, test building slots
        state.selectedColonistId = null;
        if (state.hoveredSlotIndex !== null) {
            state.selectedSlotIndex = state.hoveredSlotIndex;
        } else {
            state.selectedSlotIndex = null;
        }
    }

    private getGameMode(): GameModeComponent | null {
        if (!this.world) return null;
        const gameState = this.world.getEntityByName('gameState');
        return gameState?.getComponent(GameModeComponent) ?? null;
    }

    destroy(): void {
        if (this.canvas && this.onMouseMove) {
            this.canvas.removeEventListener('mousemove', this.onMouseMove);
        }
        if (this.canvas && this.onClick) {
            this.canvas.removeEventListener('click', this.onClick);
        }
        if (this.canvas && this.onTouchStart) {
            this.canvas.removeEventListener('touchstart', this.onTouchStart);
        }
        if (this.canvas && this.onTouchMove) {
            this.canvas.removeEventListener('touchmove', this.onTouchMove);
        }
        if (this.canvas && this.onTouchEnd) {
            this.canvas.removeEventListener('touchend', this.onTouchEnd);
        }
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown);
        }
    }
}
