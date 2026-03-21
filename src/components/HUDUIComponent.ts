// HUDUIComponent.ts — Bottom HUD bar with date and END TURN button.
// Creates and manages DOM elements inside #hud-bottom.
// Tracks turn blockers to disable the END TURN button during animations.

import './HUDUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { DateUIComponent } from './DateUIComponent';
import { RelationshipGraphComponent } from './RelationshipGraphComponent';
import { ExtirisRespawnComponent } from './ExtirisRespawnComponent';
import { IntelComponent } from './IntelComponent';
import { ExtirisAIComponent } from './ExtirisAIComponent';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { TurnBlockEvent, TurnUnblockEvent } from '../core/GameEvents';

export class HUDUIComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private container: HTMLElement | null = null;
    private dateEl: HTMLElement | null = null;
    private endTurnBtn: HTMLButtonElement | null = null;
    private aiHuntingEl: HTMLElement | null = null;
    private dormantEl: HTMLElement | null = null;
    private intelEl: HTMLElement | null = null;

    private socialBtn: HTMLButtonElement | null = null;

    private blockers = new Set<string>();
    private turnBlockHandler: EventHandler | null = null;
    private turnUnblockHandler: EventHandler | null = null;
    private onEndTurnClick: (() => void) | null = null;
    private onSocialClick: (() => void) | null = null;
    private aiPhaseStartHandler: EventHandler | null = null;
    private aiPhaseEndHandler: EventHandler | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.container = document.getElementById('hud-bottom');
        if (!this.container) return;

        // Build inner HTML
        this.container.innerHTML = `
            <span id="hud-date">JAN 01, 2700</span>
            <span id="hud-build" style="font-size:10px; opacity:0.4; margin-left:auto; margin-right:8px;">BUILD ${__BUILD_TIME__}</span>
            <button id="hud-social-btn" class="hud-btn" type="button">SOCIAL</button>
            <button id="hud-end-turn" class="hud-btn" type="button">END TURN</button>
        `;

        this.dateEl = document.getElementById('hud-date');
        this.endTurnBtn = document.getElementById('hud-end-turn') as HTMLButtonElement | null;

        // SOCIAL button click — opens relationship graph
        this.socialBtn = document.getElementById('hud-social-btn') as HTMLButtonElement | null;
        this.onSocialClick = (): void => {
            const graph = this.entity.getComponent(RelationshipGraphComponent);
            if (graph && !graph.isOpen) {
                graph.open();
            }
        };
        this.socialBtn?.addEventListener('click', this.onSocialClick);

        // END TURN button click
        this.onEndTurnClick = (): void => {
            if (this.blockers.size > 0) return;
            this.eventQueue?.emit({ type: GameEvents.TURN_ADVANCE });
        };
        this.endTurnBtn?.addEventListener('click', this.onEndTurnClick);

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

        // "Extiris is hunting..." indicator (guard for test environments without full DOM)
        if (typeof document.createElement === 'function') {
            this.aiHuntingEl = document.createElement('div');
            this.aiHuntingEl.id = 'hud-ai-hunting';
            this.aiHuntingEl.textContent = 'The Extiris is hunting...';
            this.aiHuntingEl.style.cssText = `
                position: fixed; top: 48px; left: 50%; transform: translateX(-50%);
                color: #cc3333; font-family: monospace; font-size: 14px;
                letter-spacing: 2px; text-transform: uppercase;
                opacity: 0; transition: opacity 0.3s ease;
                pointer-events: none; text-shadow: 0 0 8px rgba(200,30,30,0.5);
            `;
            document.body.appendChild(this.aiHuntingEl);
        }

        // "EXTIRIS SIGNAL: DORMANT" indicator
        if (typeof document.createElement === 'function') {
            this.dormantEl = document.createElement('div');
            this.dormantEl.id = 'hud-extiris-dormant';
            this.dormantEl.style.cssText = `
                position: fixed; top: 70px; left: 50%; transform: translateX(-50%);
                color: #d4a020; font-family: monospace; font-size: 11px;
                letter-spacing: 1.5px; text-transform: uppercase;
                opacity: 0; transition: opacity 0.3s ease;
                pointer-events: none; text-shadow: 0 0 6px rgba(212,160,32,0.3);
            `;
            document.body.appendChild(this.dormantEl);
        }

        // Intel fragment counter
        if (typeof document.createElement === 'function') {
            this.intelEl = document.createElement('div');
            this.intelEl.id = 'hud-intel';
            this.intelEl.style.cssText = `
                position: fixed; top: 92px; left: 50%; transform: translateX(-50%);
                color: #4fa8ff; font-family: monospace; font-size: 11px;
                letter-spacing: 1.5px; text-transform: uppercase;
                opacity: 0; transition: opacity 0.3s ease;
                pointer-events: auto; cursor: default;
                text-shadow: 0 0 6px rgba(79,168,255,0.3);
            `;
            document.body.appendChild(this.intelEl);

            this.intelEl.addEventListener('click', () => {
                this.handleCountermeasureClick();
            });
        }

        this.aiPhaseStartHandler = (): void => {
            if (this.aiHuntingEl) this.aiHuntingEl.style.opacity = '1';
        };
        this.aiPhaseEndHandler = (): void => {
            if (this.aiHuntingEl) this.aiHuntingEl.style.opacity = '0';
        };
        this.eventQueue.on(GameEvents.AI_PHASE_START, this.aiPhaseStartHandler);
        this.eventQueue.on(GameEvents.AI_PHASE_END, this.aiPhaseEndHandler);

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

        // Update Extiris dormant timer display
        this.updateDormantTimer();

        // Update intel display
        this.updateIntelDisplay();
    }

    private updateButtonState(): void {
        if (!this.endTurnBtn) return;
        if (this.blockers.size > 0) {
            this.endTurnBtn.classList.add('disabled');
        } else {
            this.endTurnBtn.classList.remove('disabled');
        }
    }

    private updateIntelDisplay(): void {
        if (!this.intelEl) return;

        try {
            const world = ServiceLocator.get<World>('world');
            const gameState = world.getEntityByName('gameState');
            const intel = gameState?.getComponent(IntelComponent);
            if (!intel || intel.fragments === 0) {
                this.intelEl.style.opacity = '0';
                return;
            }

            if (intel.fragments >= 3) {
                // Check if there are active adaptations to counter
                const extiris = world.getEntityByName('extiris');
                const ai = extiris?.getComponent(ExtirisAIComponent);
                const hasAdaptations = ai && ai.memory.activeAdaptations.length > 0;

                if (hasAdaptations) {
                    this.intelEl.textContent = `INTEL: ${intel.fragments}/3 \u2014 [COUNTERMEASURE AVAILABLE]`;
                    this.intelEl.style.color = '#50e080';
                    this.intelEl.style.cursor = 'pointer';
                } else {
                    this.intelEl.textContent = `INTEL: ${intel.fragments} fragments`;
                    this.intelEl.style.color = '#4fa8ff';
                    this.intelEl.style.cursor = 'default';
                }
            } else {
                this.intelEl.textContent = `INTEL: ${intel.fragments}/3 fragments`;
                this.intelEl.style.color = '#4fa8ff';
                this.intelEl.style.cursor = 'default';
            }
            this.intelEl.style.opacity = '1';
        } catch {
            // World not available
        }
    }

    private handleCountermeasureClick(): void {
        try {
            const world = ServiceLocator.get<World>('world');
            const gameState = world.getEntityByName('gameState');
            const intel = gameState?.getComponent(IntelComponent);
            if (!intel || intel.fragments < 3) return;

            const extiris = world.getEntityByName('extiris');
            const ai = extiris?.getComponent(ExtirisAIComponent);
            if (!ai || ai.memory.activeAdaptations.length === 0) return;

            // Remove the first active adaptation (auto-pick for simplicity)
            const removed = ai.memory.activeAdaptations.shift();
            intel.fragments -= 3;
            intel.countermeasuresUsed++;

            if (removed && this.eventQueue) {
                this.eventQueue.emit({
                    type: GameEvents.INTEL_COUNTERMEASURE,
                    removedAdaptation: removed,
                });
            }

            if (localStorage.getItem('combat-debug') === 'true') {
                console.log(`[Combat] Countermeasure used: removed adaptation '${removed}'. ${intel.fragments} fragments remaining.`);
            }
        } catch {
            // World not available
        }
    }

    private updateDormantTimer(): void {
        if (!this.dormantEl) return;

        try {
            const world = ServiceLocator.get<World>('world');
            const gameState = world.getEntityByName('gameState');
            const respawn = gameState?.getComponent(ExtirisRespawnComponent);

            if (respawn && respawn.turnsRemaining > 0) {
                this.dormantEl.textContent = `EXTIRIS SIGNAL: DORMANT (reacquisition in ~${respawn.turnsRemaining} turns)`;
                this.dormantEl.style.opacity = '1';
            } else {
                this.dormantEl.style.opacity = '0';
            }
        } catch {
            // World not available
        }
    }

    destroy(): void {
        if (this.endTurnBtn && this.onEndTurnClick) {
            this.endTurnBtn.removeEventListener('click', this.onEndTurnClick);
        }
        if (this.socialBtn && this.onSocialClick) {
            this.socialBtn.removeEventListener('click', this.onSocialClick);
        }
        if (this.eventQueue && this.turnBlockHandler) {
            this.eventQueue.off(GameEvents.TURN_BLOCK, this.turnBlockHandler);
        }
        if (this.eventQueue && this.turnUnblockHandler) {
            this.eventQueue.off(GameEvents.TURN_UNBLOCK, this.turnUnblockHandler);
        }
        if (this.eventQueue && this.aiPhaseStartHandler) {
            this.eventQueue.off(GameEvents.AI_PHASE_START, this.aiPhaseStartHandler);
        }
        if (this.eventQueue && this.aiPhaseEndHandler) {
            this.eventQueue.off(GameEvents.AI_PHASE_END, this.aiPhaseEndHandler);
        }
        if (this.aiHuntingEl) {
            this.aiHuntingEl.remove();
        }
        if (this.dormantEl) {
            this.dormantEl.remove();
        }
        if (this.intelEl) {
            this.intelEl.remove();
        }
    }
}
