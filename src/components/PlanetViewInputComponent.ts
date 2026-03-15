// PlanetViewInputComponent.ts — Handles mouse input in planet view mode.
// Lives on the planet entity. Reads mouse position, detects region hover
// via point-in-polygon. Escape key and back button trigger PLANET_VIEW_EXIT.

import './PlanetViewInputComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { GameModeComponent } from './GameModeComponent';
import { RegionDataComponent } from './RegionDataComponent';
import { pointInPolygon } from '../utils/geometry';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { World } from '../core/World';

export class PlanetViewInputComponent extends Component {
    /** Currently hovered region ID, or -1 if none. Read by the renderer. */
    hoveredRegionId = -1;

    /** Currently selected region ID, or -1 if none. Set by mouse click. */
    selectedRegionId = -1;

    private eventQueue: EventQueue | null = null;
    private world: World | null = null;
    private canvas: HTMLCanvasElement | null = null;
    private mouseX = 0;
    private mouseY = 0;
    private onMouseMove: ((e: MouseEvent) => void) | null = null;
    private onClick: ((e: MouseEvent) => void) | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private onBackClick: (() => void) | null = null;
    private onTouchStart: ((e: TouchEvent) => void) | null = null;
    private onTouchMove: ((e: TouchEvent) => void) | null = null;
    private onTouchEnd: ((e: TouchEvent) => void) | null = null;
    private backBtn: HTMLElement | null = null;
    private resizeHandler: EventHandler | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        this.world = ServiceLocator.get<World>('world');
        this.canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');

        // Track mouse position for region hit-testing
        this.onMouseMove = (e: MouseEvent): void => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        };
        this.canvas.addEventListener('mousemove', this.onMouseMove);

        // Touch — track finger position for region hit-testing
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

        // Click — select/deselect region
        this.onClick = (_e: MouseEvent): void => {
            const gameMode = this.getGameMode();
            if (!gameMode || gameMode.mode !== 'planet') return;

            if (this.hoveredRegionId === -1) {
                // Click on empty space deselects
                this.selectedRegionId = -1;
            } else if (this.hoveredRegionId === this.selectedRegionId) {
                // Click on same region toggles off
                this.selectedRegionId = -1;
            } else {
                // Click on different region selects it
                this.selectedRegionId = this.hoveredRegionId;
            }
        };
        this.canvas.addEventListener('click', this.onClick);

        // Touch end — select/deselect region (mirrors click handler)
        this.onTouchEnd = (e: TouchEvent): void => {
            // Use last tracked touch position (from touchmove or touchstart in InputSystem)
            const gameMode = this.getGameMode();
            if (!gameMode || gameMode.mode !== 'planet') return;

            e.preventDefault();
            if (this.hoveredRegionId === -1) {
                this.selectedRegionId = -1;
            } else if (this.hoveredRegionId === this.selectedRegionId) {
                this.selectedRegionId = -1;
            } else {
                this.selectedRegionId = this.hoveredRegionId;
            }
        };
        this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });

        // Escape key — exit planet view
        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Escape') {
                const gameMode = this.getGameMode();
                if (gameMode && gameMode.mode === 'planet') {
                    e.preventDefault();
                    this.eventQueue?.emit({ type: GameEvents.PLANET_VIEW_EXIT });
                }
            }
        };
        window.addEventListener('keydown', this.onKeyDown);

        // Back button DOM click
        this.backBtn = document.getElementById('planet-view-back');
        if (this.backBtn) {
            this.onBackClick = (): void => {
                const gameMode = this.getGameMode();
                if (gameMode && gameMode.mode === 'planet') {
                    this.eventQueue?.emit({ type: GameEvents.PLANET_VIEW_EXIT });
                }
            };
            this.backBtn.addEventListener('click', this.onBackClick);
        }

        // On resize, region vertices are regenerated by RegionDataComponent.
        // Clear hover/selection to avoid stale references to old positions.
        this.resizeHandler = (): void => {
            this.hoveredRegionId = -1;
            this.selectedRegionId = -1;
        };
        this.eventQueue?.on(GameEvents.CANVAS_RESIZE, this.resizeHandler);
    }

    update(_dt: number): void {
        const gameMode = this.getGameMode();
        if (!gameMode || gameMode.mode !== 'planet') {
            this.hoveredRegionId = -1;
            this.selectedRegionId = -1;
            // Hide back button when not in planet mode
            if (this.backBtn) this.backBtn.style.display = 'none';
            return;
        }

        // Show back button in planet mode
        if (this.backBtn) this.backBtn.style.display = 'block';

        // Hit-test mouse against region polygons
        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!regionData) return;

        this.hoveredRegionId = -1;
        for (const region of regionData.regions) {
            if (region.vertices.length < 3) continue;
            if (pointInPolygon(this.mouseX, this.mouseY, region.vertices)) {
                this.hoveredRegionId = region.id;
                break;
            }
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
        if (this.backBtn && this.onBackClick) {
            this.backBtn.removeEventListener('click', this.onBackClick);
        }
        if (this.eventQueue && this.resizeHandler) {
            this.eventQueue.off(GameEvents.CANVAS_RESIZE, this.resizeHandler);
        }
    }
}
