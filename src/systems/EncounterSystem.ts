// EncounterSystem.ts — Orchestrates encounter flow: card draw → modal → resolution.
//
// ENCOUNTER PIPELINE:
//   ENCOUNTER_TRIGGERED event received
//     └─▶ acquire modal lock (skip if locked)
//     └─▶ emit TURN_BLOCK('encounter')
//     └─▶ draw crisis card (filtered by encounter type)
//     └─▶ show NarrativeModal fallback (PR 1 — CrisisModal replaces in PR 2)
//     └─▶ resolve outcome (skill totals vs difficulty)
//     └─▶ apply consequences via ConsequenceResolver
//     └─▶ show outcome text
//     └─▶ emit TURN_UNBLOCK('encounter')
//     └─▶ release modal lock

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { EncounterTriggerComponent } from '../components/EncounterTriggerComponent';
import { CRISIS_CARDS, resolveOutcomeTier, getOutcomeForTier } from '../data/crisisCards';
import { getSkillScore } from '../utils/combatSkills';
import { applyConsequences } from './ConsequenceResolver';
import type { CrisisCard, OutcomeTier } from '../data/crisisCards';
import type { EncounterTriggeredEvent } from '../core/GameEvents';
import type { NarrativeModal } from '../ui/NarrativeModal';
import type { ModalLock } from '../services/ModalLock';
import type { World } from '../core/World';
import type { EventQueue, EventHandler } from '../core/EventQueue';

const BLOCKER_KEY = 'encounter';

function isDebugEnabled(): boolean {
    try {
        return localStorage.getItem('combat-debug') === 'true';
    } catch {
        return false;
    }
}

/** Track which card was last drawn to weight toward variety. */
let lastDrawnCardId: string | null = null;

export class EncounterSystem extends System {
    private eventQueue!: EventQueue;
    private encounterHandler!: EventHandler;
    private resolving = false;

    init(world: World): void {
        super.init(world);
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.encounterHandler = (event): void => {
            const e = event as EncounterTriggeredEvent;
            void this.handleEncounter(e);
        };

        this.eventQueue.on(GameEvents.ENCOUNTER_TRIGGERED, this.encounterHandler);
    }

    update(_dt: number): void {
        // Encounter resolution is event-driven, not per-frame.
    }

    private async handleEncounter(event: EncounterTriggeredEvent): Promise<void> {
        if (this.resolving) return;

        // Acquire modal lock
        let modalLock: ModalLock | null = null;
        try {
            modalLock = ServiceLocator.get<ModalLock>('modalLock');
        } catch {
            // No modal lock registered — proceed without
        }

        if (modalLock && !modalLock.acquire()) {
            if (isDebugEnabled()) {
                console.log('[Combat] Modal lock busy — encounter deferred');
            }
            return;
        }

        this.resolving = true;
        this.eventQueue.emit({ type: GameEvents.TURN_BLOCK, key: BLOCKER_KEY });

        try {
            // Draw crisis card
            const card = this.drawCard('scout');
            if (!card) {
                if (isDebugEnabled()) {
                    console.warn('[Combat] No crisis cards available');
                }
                return;
            }

            // Get available crew for assignment
            const availableCrew = this.getAvailableCrew(event.scoutEntityId);
            const pilotEntry = availableCrew.find(c => c.entityId === event.pilotEntityId);

            if (isDebugEnabled()) {
                console.log(`[Combat] Crisis: ${card.title} (difficulty ${card.difficulty})`);
                console.log(`[Combat] Available crew: ${availableCrew.map(c => c.crew.fullName).join(', ')}`);
            }

            // --- NarrativeModal fallback (PR 1) ---
            // In PR 2, this is replaced by the full CrisisModal with crew assignment UI.
            // For now, the pilot is auto-assigned to the first required slot.
            const assignedCrewIds: number[] = [];

            if (pilotEntry) {
                assignedCrewIds.push(pilotEntry.entityId);
            }

            // Auto-assign: pilot fills first slot, ship crew fill remaining slots
            const shipCrew = availableCrew.filter(c => c.entityId !== event.pilotEntityId);
            for (let i = 1; i < card.skillSlots.length && i - 1 < shipCrew.length; i++) {
                const slot = card.skillSlots[i];
                if (slot.skill === 'combat' || slot.skill === 'engineering' || slot.skill === 'piloting') {
                    // Find best crew for this slot
                    let bestCrew = shipCrew[0];
                    let bestScore = 0;
                    for (const c of shipCrew) {
                        if (assignedCrewIds.includes(c.entityId)) continue;
                        const score = getSkillScore(c.crew, slot.skill, c.entityId);
                        if (score > bestScore) {
                            bestScore = score;
                            bestCrew = c;
                        }
                    }
                    if (bestCrew && !assignedCrewIds.includes(bestCrew.entityId)) {
                        assignedCrewIds.push(bestCrew.entityId);
                    }
                }
            }

            // Calculate total skill
            let total = 0;
            for (let i = 0; i < card.skillSlots.length && i < assignedCrewIds.length; i++) {
                const crewEntity = this.world.getEntity(assignedCrewIds[i]);
                const crew = crewEntity?.getComponent(CrewMemberComponent);
                if (crew) {
                    total += getSkillScore(crew, card.skillSlots[i].skill, assignedCrewIds[i]);
                }
            }

            const margin = total - card.difficulty;
            const tier = resolveOutcomeTier(margin);
            const outcome = getOutcomeForTier(card, tier);

            if (isDebugEnabled()) {
                console.log(`[Combat] Total: ${total}, Difficulty: ${card.difficulty}, Margin: ${margin}, Tier: ${tier}`);
            }

            // Show encounter via NarrativeModal fallback
            const narrativeModal = ServiceLocator.get<NarrativeModal>('narrativeModal');

            const crewNames = assignedCrewIds.map(id => {
                const e = this.world.getEntity(id);
                return e?.getComponent(CrewMemberComponent)?.fullName ?? 'Unknown';
            }).join(', ');

            const choiceLabels = this.buildFallbackChoices(tier);

            await narrativeModal.show({
                title: `⚠ ${card.title}`,
                body: `${card.description}\n\nYour crew responds: ${crewNames}\nSkill total: ${total} vs Difficulty: ${card.difficulty}`,
                choices: choiceLabels,
            });

            // Apply consequences
            if (outcome) {
                applyConsequences(outcome.consequences, {
                    world: this.world,
                    eventQueue: this.eventQueue,
                    scoutEntityId: event.scoutEntityId,
                    pilotEntityId: event.pilotEntityId,
                    assignedCrewIds,
                });

                // Show outcome text
                await narrativeModal.showOutcome(outcome.description);
            }

            // Emit resolved event
            this.eventQueue.emit({
                type: GameEvents.ENCOUNTER_RESOLVED,
                tier,
                margin,
                cardId: card.id,
            });

            // Reset the trigger on the scout so future encounters can fire
            const scoutEntity = this.world.getEntity(event.scoutEntityId);
            const trigger = scoutEntity?.getComponent(EncounterTriggerComponent);
            if (trigger) {
                trigger.resetTrigger();
            }

        } catch (err) {
            console.warn('EncounterSystem: error during encounter', err);
        } finally {
            this.eventQueue.emit({ type: GameEvents.TURN_UNBLOCK, key: BLOCKER_KEY });
            this.resolving = false;
            if (modalLock) {
                modalLock.release();
            }
        }
    }

    private drawCard(encounterType: 'scout' | 'colony' | 'ship'): CrisisCard | null {
        const eligible = CRISIS_CARDS.filter(c => c.encounterType === encounterType);
        if (eligible.length === 0) return null;

        // Weight toward cards not recently drawn
        if (eligible.length > 1 && lastDrawnCardId) {
            const nonRecent = eligible.filter(c => c.id !== lastDrawnCardId);
            if (nonRecent.length > 0) {
                const picked = nonRecent[Math.floor(Math.random() * nonRecent.length)];
                lastDrawnCardId = picked.id;
                return picked;
            }
        }

        const picked = eligible[Math.floor(Math.random() * eligible.length)];
        lastDrawnCardId = picked.id;
        return picked;
    }

    private getAvailableCrew(scoutEntityId: number): Array<{ entityId: number; crew: CrewMemberComponent }> {
        const result: Array<{ entityId: number; crew: CrewMemberComponent }> = [];

        for (const entity of this.world.getEntitiesWithComponent(CrewMemberComponent)) {
            const crew = entity.getComponent(CrewMemberComponent);
            if (!crew) continue;
            if (crew.location.type === 'dead') continue;

            // Available: on this scout, or on the ship (remote participation)
            const onThisScout = crew.location.type === 'scout'
                && crew.location.scoutEntityId === scoutEntityId;
            const onShip = crew.location.type === 'ship';

            if (onThisScout || onShip) {
                result.push({ entityId: entity.id, crew });
            }
        }

        return result;
    }

    private buildFallbackChoices(tier: OutcomeTier): Array<{ label: string; description: string }> {
        // Simple text-based choices for the NarrativeModal fallback
        const tierLabels: Record<OutcomeTier, string> = {
            critical_success: 'CRITICAL SUCCESS — Clean escape',
            success: 'SUCCESS — Escape with minor cost',
            partial: 'PARTIAL FAILURE — Scout lost, pilot ejects',
            failure: 'FAILURE — No survivors',
            catastrophe: 'CATASTROPHE — Total loss',
        };

        return [{
            label: `Outcome: ${tierLabels[tier]}`,
            description: 'Continue to see the result',
        }];
    }

    destroy(): void {
        this.eventQueue.off(GameEvents.ENCOUNTER_TRIGGERED, this.encounterHandler);
    }
}
