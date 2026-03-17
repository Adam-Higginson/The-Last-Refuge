// ExtirisDetectionUIComponent.ts — Detection FX overlay.
// Shows red edge pulse + "DETECTED" text when the Extiris detects the player.
// Shows intercepted signals when Extiris is in blip range (ship or colony).
// Shows amber "COLONY SENSORS: HOSTILE CONTACT" when Extiris is near a colony.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { TransformComponent } from './TransformComponent';
import { ExtirisAIComponent } from './ExtirisAIComponent';
import { VisibilitySourceComponent } from './VisibilitySourceComponent';
import { getEntityFogZone } from './FogOfWarComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';
import type { EventQueue, EventHandler } from '../core/EventQueue';

/** Detection vignette + text overlay. */
export class ExtirisDetectionUIComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private detectedHandler: EventHandler | null = null;
    private turnEndHandler: EventHandler | null = null;

    private overlayEl: HTMLElement | null = null;
    private detectedTextEl: HTMLElement | null = null;
    private signalEl: HTMLElement | null = null;
    private colonyAlertEl: HTMLElement | null = null;

    /** Whether detection was already triggered this detection window. */
    private detectionActive = false;
    /** Timer for fading out detection text. */
    private detectionFadeTimer = 0;
    /** Timer for intercepted signal display. */
    private signalFadeTimer = 0;
    /** Timer for colony alert display. */
    private colonyAlertFadeTimer = 0;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        // Red vignette overlay
        this.overlayEl = document.createElement('div');
        this.overlayEl.id = 'extiris-detection-overlay';
        this.overlayEl.style.cssText = `
            position: fixed; inset: 0; pointer-events: none; z-index: 100;
            box-shadow: inset 0 0 120px rgba(180, 20, 20, 0);
            transition: box-shadow 0.3s ease;
        `;
        document.body.appendChild(this.overlayEl);

        // "DETECTED" text
        this.detectedTextEl = document.createElement('div');
        this.detectedTextEl.id = 'extiris-detected-text';
        this.detectedTextEl.textContent = 'DETECTED';
        this.detectedTextEl.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            color: #cc2222; font-family: monospace; font-size: 48px; font-weight: bold;
            letter-spacing: 12px; text-transform: uppercase;
            opacity: 0; pointer-events: none; z-index: 101;
            text-shadow: 0 0 20px rgba(200,30,30,0.6), 0 0 40px rgba(200,30,30,0.3);
        `;
        document.body.appendChild(this.detectedTextEl);

        // Intercepted signal text
        this.signalEl = document.createElement('div');
        this.signalEl.id = 'extiris-signal';
        this.signalEl.style.cssText = `
            position: fixed; top: 120px; left: 50%; transform: translateX(-50%);
            color: #cc8833; font-family: monospace; font-size: 12px;
            letter-spacing: 1px; opacity: 0; pointer-events: none; z-index: 101;
            text-shadow: 0 0 8px rgba(200,120,40,0.4);
            max-width: 400px; text-align: center;
        `;
        document.body.appendChild(this.signalEl);

        // Colony sensor alert (amber — distinct from ship's red "DETECTED")
        this.colonyAlertEl = document.createElement('div');
        this.colonyAlertEl.id = 'extiris-colony-alert';
        this.colonyAlertEl.textContent = 'COLONY SENSORS: HOSTILE CONTACT';
        this.colonyAlertEl.style.cssText = `
            position: fixed; top: 150px; left: 50%; transform: translateX(-50%);
            color: #cc8833; font-family: monospace; font-size: 18px; font-weight: bold;
            letter-spacing: 4px; text-transform: uppercase;
            opacity: 0; pointer-events: none; z-index: 101;
            text-shadow: 0 0 12px rgba(200,140,40,0.5), 0 0 24px rgba(200,140,40,0.25);
        `;
        document.body.appendChild(this.colonyAlertEl);

        this.detectedHandler = (): void => {
            this.triggerDetection();
        };
        this.eventQueue.on(GameEvents.EXTIRIS_DETECTED_PLAYER, this.detectedHandler);

        this.turnEndHandler = (): void => {
            this.onTurnEnd();
        };
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
    }

    private triggerDetection(): void {
        if (this.detectionActive) return;
        this.detectionActive = true;
        this.detectionFadeTimer = 2.0;

        if (this.overlayEl) {
            this.overlayEl.style.boxShadow = 'inset 0 0 120px rgba(180, 20, 20, 0.5)';
        }
        if (this.detectedTextEl) {
            this.detectedTextEl.style.opacity = '1';
        }
    }

    private onTurnEnd(): void {
        // Check if Extiris is still in detection range — if not, reset detection
        this.checkExtirisRange();
    }

    private checkExtirisRange(): void {
        try {
            const world = ServiceLocator.get<World>('world');
            const extiris = world.getEntityByName('extiris');
            const extirisTransform = extiris?.getComponent(TransformComponent);
            const extirisAI = extiris?.getComponent(ExtirisAIComponent);
            if (!extirisTransform || !extirisAI) return;

            const ship = world.getEntityByName('arkSalvage');
            const shipTransform = ship?.getComponent(TransformComponent);
            if (!shipTransform) return;

            const dx = extirisTransform.x - shipTransform.x;
            const dy = extirisTransform.y - shipTransform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Reset detection flag if player escaped sensor range
            if (dist > extirisAI.sensorRadius) {
                this.detectionActive = false;
            }

            // Intercepted signals: ~30% chance when Extiris is in blip range
            const zone = getEntityFogZone(extirisTransform.x, extirisTransform.y);
            if (zone === 'blip' && Math.random() < 0.3 && extirisAI.memory.reasoning) {
                this.showInterceptedSignal(extirisAI.memory.reasoning);
            }

            // Colony sensor alert: check if Extiris is within any colony's blip radius
            this.checkColonyDetection(world, extirisTransform, ship);
        } catch {
            // Graceful degradation
        }
    }

    private checkColonyDetection(world: World, extirisTransform: TransformComponent, ship: Entity | null): void {
        const sources = world.getEntitiesWithComponent(VisibilitySourceComponent);
        for (const sourceEntity of sources) {
            if (sourceEntity === ship) continue; // skip ship — has its own detection

            const vis = sourceEntity.getComponent(VisibilitySourceComponent);
            const transform = sourceEntity.getComponent(TransformComponent);
            if (!vis?.active || !transform) continue;

            const cdx = extirisTransform.x - transform.x;
            const cdy = extirisTransform.y - transform.y;
            const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

            if (cdist <= vis.effectiveBlipRadius) {
                this.showColonyAlert();
                return;
            }
        }
    }

    private showColonyAlert(): void {
        if (!this.colonyAlertEl) return;
        this.colonyAlertEl.style.opacity = '1';
        this.colonyAlertFadeTimer = 3.0;
    }

    private showInterceptedSignal(reasoning: string): void {
        if (!this.signalEl) return;

        // Garble the reasoning text
        const garbled = this.garbleText(reasoning);
        this.signalEl.textContent = `SIGNAL INTERCEPTED: ${garbled}`;
        this.signalEl.style.opacity = '1';
        this.signalFadeTimer = 3.0;
    }

    private garbleText(text: string): string {
        const alienGlyphs = ['[UNTRANSLATABLE]', '▓▒░', '◈◇◆', '⟐⟑⟒'];
        const words = text.split(' ');
        return words.map(word => {
            if (Math.random() < 0.35) {
                return alienGlyphs[Math.floor(Math.random() * alienGlyphs.length)];
            }
            if (Math.random() < 0.2) {
                return word.split('').reverse().join('');
            }
            return word;
        }).join(' ');
    }

    update(dt: number): void {
        // Fade out detection text
        if (this.detectionFadeTimer > 0) {
            this.detectionFadeTimer -= dt;
            if (this.detectionFadeTimer <= 0) {
                if (this.detectedTextEl) this.detectedTextEl.style.opacity = '0';
                if (this.overlayEl) {
                    this.overlayEl.style.boxShadow = 'inset 0 0 120px rgba(180, 20, 20, 0)';
                }
            }
        }

        // Fade out intercepted signal
        if (this.signalFadeTimer > 0) {
            this.signalFadeTimer -= dt;
            if (this.signalFadeTimer <= 0 && this.signalEl) {
                this.signalEl.style.opacity = '0';
            }
        }

        // Fade out colony alert
        if (this.colonyAlertFadeTimer > 0) {
            this.colonyAlertFadeTimer -= dt;
            if (this.colonyAlertFadeTimer <= 0 && this.colonyAlertEl) {
                this.colonyAlertEl.style.opacity = '0';
            }
        }
    }

    destroy(): void {
        if (this.eventQueue && this.detectedHandler) {
            this.eventQueue.off(GameEvents.EXTIRIS_DETECTED_PLAYER, this.detectedHandler);
        }
        if (this.eventQueue && this.turnEndHandler) {
            this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
        }
        this.overlayEl?.remove();
        this.detectedTextEl?.remove();
        this.signalEl?.remove();
        this.colonyAlertEl?.remove();
    }
}
