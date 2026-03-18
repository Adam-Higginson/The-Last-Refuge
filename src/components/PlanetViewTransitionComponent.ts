// PlanetViewTransitionComponent.ts — Drives the cinematic zoom transition
// between system map and planet view. Listens for PLANET_VIEW_ENTER/EXIT
// events, animates GameModeComponent.transitionProgress, and toggles
// entity visibility and HUD display.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { GameModeComponent } from './GameModeComponent';
import { CameraComponent } from './CameraComponent';
import { RenderComponent } from './RenderComponent';
import { ScoutDataComponent } from './ScoutDataComponent';
import { SelectableComponent } from './SelectableComponent';
import type { EventQueue, GameEvent } from '../core/EventQueue';
import type { World } from '../core/World';

export class PlanetViewTransitionComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private world: World | null = null;
    private onEnter: ((e: GameEvent) => void) | null = null;
    private onExit: ((e: GameEvent) => void) | null = null;
    private turnBlocked = false;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        this.world = ServiceLocator.get<World>('world');

        this.onEnter = (e: GameEvent): void => {
            const gameMode = this.entity.getComponent(GameModeComponent);
            if (!gameMode || gameMode.mode !== 'system') return;

            const event = e as GameEvent & { entityId: number };
            gameMode.mode = 'transitioning-to-planet';
            gameMode.transitionProgress = 0;
            gameMode.planetEntityId = event.entityId;

            // Deselect all entities (closes ship panel)
            this.deselectAll();

            // Hide ship immediately so it doesn't linger during zoom
            this.hideShip();

            // Block turn advancement during transition
            this.blockTurn();
        };

        this.onExit = (_e: GameEvent): void => {
            const gameMode = this.entity.getComponent(GameModeComponent);
            if (!gameMode || gameMode.mode !== 'planet') return;

            gameMode.mode = 'transitioning-to-system';
            gameMode.transitionProgress = 0;

            // Block turn advancement during transition
            this.blockTurn();
        };

        this.eventQueue.on(GameEvents.PLANET_VIEW_ENTER, this.onEnter);
        this.eventQueue.on(GameEvents.PLANET_VIEW_EXIT, this.onExit);
    }

    update(dt: number): void {
        const gameMode = this.entity.getComponent(GameModeComponent);
        if (!gameMode) return;

        if (gameMode.mode === 'transitioning-to-planet') {
            gameMode.transitionProgress += dt / gameMode.transitionDuration;

            if (gameMode.transitionProgress >= 1) {
                gameMode.transitionProgress = 1;
                gameMode.mode = 'planet';
                this.setCameraScreenMode(true);
                this.setSystemEntitiesVisible(false);
                this.setHUDVisible(false);
                this.unblockTurn();
            }
        } else if (gameMode.mode === 'transitioning-to-system') {
            gameMode.transitionProgress += dt / gameMode.transitionDuration;

            if (gameMode.transitionProgress >= 1) {
                gameMode.transitionProgress = 1;
                gameMode.mode = 'system';
                gameMode.planetEntityId = null;
                this.setCameraScreenMode(false);
                this.setSystemEntitiesVisible(true);
                this.setHUDVisible(true);
                this.unblockTurn();
            }
        }
    }

    private setCameraScreenMode(screenMode: boolean): void {
        if (!this.world) return;
        const cam = this.world.getEntityByName('camera');
        const camera = cam?.getComponent(CameraComponent);
        if (camera) camera.screenMode = screenMode;
    }

    private deselectAll(): void {
        if (!this.world) return;
        const entities = this.world.getEntitiesWithComponent(SelectableComponent);
        for (const entity of entities) {
            const selectable = entity.getComponent(SelectableComponent);
            if (selectable) {
                selectable.selected = false;
            }
        }
    }

    private hideShip(): void {
        if (!this.world) return;
        const ship = this.world.getEntityByName('arkSalvage');
        if (ship) {
            const render = ship.getComponent(RenderComponent);
            if (render) {
                render.visible = false;
            }
        }
    }

    private setSystemEntitiesVisible(visible: boolean): void {
        if (!this.world) return;
        const names = ['background', 'star', 'arkSalvage'];
        for (const name of names) {
            const entity = this.world.getEntityByName(name);
            if (entity) {
                const render = entity.getComponent(RenderComponent);
                if (render) {
                    render.visible = visible;
                }
            }
        }
        // Also toggle scout visibility (dynamically created entities)
        for (const scout of this.world.getEntitiesWithComponent(ScoutDataComponent)) {
            const render = scout.getComponent(RenderComponent);
            if (render) {
                render.visible = visible;
            }
        }
    }

    private setHUDVisible(visible: boolean): void {
        const hud = document.getElementById('hud-bottom');
        if (hud) {
            hud.style.display = visible ? '' : 'none';
        }
    }

    private blockTurn(): void {
        if (!this.turnBlocked && this.eventQueue) {
            this.eventQueue.emit({
                type: GameEvents.TURN_BLOCK,
                key: 'viewTransition',
            });
            this.turnBlocked = true;
        }
    }

    private unblockTurn(): void {
        if (this.turnBlocked && this.eventQueue) {
            this.eventQueue.emit({
                type: GameEvents.TURN_UNBLOCK,
                key: 'viewTransition',
            });
            this.turnBlocked = false;
        }
    }

    destroy(): void {
        if (this.eventQueue) {
            if (this.onEnter) this.eventQueue.off(GameEvents.PLANET_VIEW_ENTER, this.onEnter);
            if (this.onExit) this.eventQueue.off(GameEvents.PLANET_VIEW_EXIT, this.onExit);
        }
    }
}
