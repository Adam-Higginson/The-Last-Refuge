// HUDUIComponent.ts — Bottom HUD bar with date and END TURN button.
// Creates and manages DOM elements inside #hud-bottom.
// Tracks turn blockers to disable the END TURN button during animations.

import './HUDUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { DateUIComponent } from './DateUIComponent';
import { GameModeComponent } from './GameModeComponent';
import { CameraComponent } from './CameraComponent';
import { TransformComponent } from './TransformComponent';
import { TransferScreenComponent } from './TransferScreenComponent';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { TurnBlockEvent, TurnUnblockEvent } from '../core/GameEvents';
import type { World } from '../core/World';

export class HUDUIComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private container: HTMLElement | null = null;
    private dateEl: HTMLElement | null = null;
    private endTurnBtn: HTMLButtonElement | null = null;

    private blockers = new Set<string>();
    private turnBlockHandler: EventHandler | null = null;
    private turnUnblockHandler: EventHandler | null = null;
    private onEndTurnClick: (() => void) | null = null;
    private centreShipBtn: HTMLButtonElement | null = null;
    private onCentreShipClick: (() => void) | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.container = document.getElementById('hud-bottom');
        if (!this.container) return;

        // Build inner HTML
        this.container.innerHTML = `
            <span id="hud-date">JAN 01, 2700</span>
            <span id="hud-build" style="font-size:10px; opacity:0.4; margin-left:auto; margin-right:8px;">BUILD ${__BUILD_TIME__}</span>
            <button id="hud-crew-btn" class="hud-btn" type="button">CREW</button>
            <button id="hud-centre-ship" class="hud-btn" type="button">CENTRE</button>
            <button id="hud-end-turn" class="hud-btn" type="button">END TURN</button>
        `;

        this.dateEl = document.getElementById('hud-date');
        this.endTurnBtn = document.getElementById('hud-end-turn') as HTMLButtonElement | null;

        // END TURN button click
        this.onEndTurnClick = (): void => {
            if (this.blockers.size > 0) return;
            this.eventQueue?.emit({ type: GameEvents.TURN_ADVANCE });
        };
        this.endTurnBtn?.addEventListener('click', this.onEndTurnClick);

        // CENTRE ON SHIP button
        this.centreShipBtn = document.getElementById('hud-centre-ship') as HTMLButtonElement | null;
        this.onCentreShipClick = (): void => {
            const world = ServiceLocator.get<World>('world');
            const ship = world.getEntityByName('arkSalvage');
            const shipTransform = ship?.getComponent(TransformComponent);
            const cameraEntity = world.getEntityByName('camera');
            const camera = cameraEntity?.getComponent(CameraComponent);
            if (shipTransform && camera) {
                camera.panTo(shipTransform.x, shipTransform.y);
            }
        };
        this.centreShipBtn?.addEventListener('click', this.onCentreShipClick);

        // CREW button — opens transfer screen
        const crewBtn = document.getElementById('hud-crew-btn');
        crewBtn?.addEventListener('click', () => {
            const transferScreen = this.entity.getComponent(TransferScreenComponent);
            if (transferScreen && !transferScreen.isOpen) {
                transferScreen.open();
            }
        });

        // Track blockers for button state
        this.turnBlockHandler = (event): void => {
            const { key } = event as TurnBlockEvent;
            if (key) this.blockers.add(key);
        };
        this.turnUnblockHandler = (event): void => {
            const { key } = event as TurnUnblockEvent;
            if (key) this.blockers.delete(key);
        };
        this.eventQueue.on(GameEvents.TURN_BLOCK, this.turnBlockHandler);
        this.eventQueue.on(GameEvents.TURN_UNBLOCK, this.turnUnblockHandler);

        // Show the HUD
        this.container.classList.add('visible');
    }

    update(_dt: number): void {
        // Update date display from DateUIComponent on the same entity
        const date = this.entity.getComponent(DateUIComponent);
        if (date && this.dateEl) {
            this.dateEl.textContent = date.getFormattedDate();
        }

        // Update END TURN button state
        this.updateButtonState();

        // Hide CENTRE ON SHIP during planet view
        if (this.centreShipBtn) {
            const world = ServiceLocator.get<World>('world');
            const gameState = world.getEntityByName('gameState');
            const gameMode = gameState?.getComponent(GameModeComponent);
            this.centreShipBtn.style.display =
                gameMode && gameMode.mode !== 'system' ? 'none' : '';
        }
    }

    private updateButtonState(): void {
        if (!this.endTurnBtn) return;
        if (this.blockers.size > 0) {
            this.endTurnBtn.classList.add('disabled');
        } else {
            this.endTurnBtn.classList.remove('disabled');
        }
    }

    destroy(): void {
        if (this.endTurnBtn && this.onEndTurnClick) {
            this.endTurnBtn.removeEventListener('click', this.onEndTurnClick);
        }
        if (this.centreShipBtn && this.onCentreShipClick) {
            this.centreShipBtn.removeEventListener('click', this.onCentreShipClick);
        }
        if (this.eventQueue && this.turnBlockHandler) {
            this.eventQueue.off(GameEvents.TURN_BLOCK, this.turnBlockHandler);
        }
        if (this.eventQueue && this.turnUnblockHandler) {
            this.eventQueue.off(GameEvents.TURN_UNBLOCK, this.turnUnblockHandler);
        }
    }
}
