// EncounterSystem.ts — Orchestrates encounter flow: card draw → modal → resolution.
//
// ENCOUNTER PIPELINE:
//   ENCOUNTER_TRIGGERED event received
//     └─▶ acquire modal lock (skip if locked)
//     └─▶ emit TURN_BLOCK('encounter')
//     └─▶ draw crisis card (filtered by encounter type)
//     └─▶ show CrisisModal (crew assignment UI)
//     └─▶ resolve outcome (skill totals vs difficulty)
//     └─▶ apply consequences via ConsequenceResolver
//     └─▶ show outcome text (with 0.3s blackout transition)
//     └─▶ emit TURN_UNBLOCK('encounter')
//     └─▶ release modal lock

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { EncounterTriggerComponent } from '../components/EncounterTriggerComponent';
import { ExtirisRespawnComponent } from '../components/ExtirisRespawnComponent';
import { GhostMarkerComponent } from '../components/GhostMarkerComponent';
import { TransformComponent } from '../components/TransformComponent';
import { RenderComponent } from '../components/RenderComponent';
import { ExtirisAIComponent } from '../components/ExtirisAIComponent';
import { CRISIS_CARDS, resolveOutcomeTier, getOutcomeForTier, applyAdaptations } from '../data/crisisCards';
import { getSkillScore, getRelationshipModifier } from '../utils/combatSkills';
import { applyConsequences, processEndOfTurn } from './ConsequenceResolver';
import type { CrisisCard, OutcomeTier } from '../data/crisisCards';
import type { CombatEncounterRecord } from '../components/ExtirisAIComponent';
import type { TurnEndEvent } from '../core/GameEvents';
import type { EncounterTriggeredEvent } from '../core/GameEvents';
import type { AIService } from '../services/AIService';
import type { CrisisModal } from '../ui/CrisisModal';
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
    private turnEndHandler!: EventHandler;
    private resolving = false;
    private currentTurn = 1;
    private extirisDestructionCount = 0;

    init(world: World): void {
        super.init(world);
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.encounterHandler = (event): void => {
            const e = event as EncounterTriggeredEvent;
            void this.handleEncounter(e);
        };

        this.turnEndHandler = (event): void => {
            const e = event as TurnEndEvent;
            this.currentTurn = e.turn;
            processEndOfTurn(this.world);
        };

        this.eventQueue.on(GameEvents.ENCOUNTER_TRIGGERED, this.encounterHandler);
        this.eventQueue.on(GameEvents.TURN_END, this.turnEndHandler);
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

            // Apply Extiris adaptations to the crisis card
            const extirisEntity = this.world.getEntityByName('extiris');
            const extirisAI = extirisEntity?.getComponent(ExtirisAIComponent);
            const activeAdaptations = extirisAI?.memory.activeAdaptations ?? [];
            const { modifiedCard, sacrificeDisabled } = applyAdaptations(card, activeAdaptations);

            if (isDebugEnabled()) {
                console.log(`[Combat] Crisis: ${card.title} (difficulty ${card.difficulty})`);
                if (activeAdaptations.length > 0) {
                    console.log(`[Combat] Active adaptations: ${activeAdaptations.join(', ')}`);
                }
                console.log(`[Combat] Available crew: ${availableCrew.map(c => c.crew.fullName).join(', ')}`);
            }

            // Show CrisisModal for player crew assignment
            let crisisModal: CrisisModal | null = null;
            try {
                crisisModal = ServiceLocator.get<CrisisModal>('crisisModal');
            } catch {
                // CrisisModal not registered — use fallback
            }

            let assignedCrewIds: number[];
            let sacrificeCrewId: number | null = null;

            if (crisisModal) {
                // Full CrisisModal UI — player assigns crew
                const result = await crisisModal.show(modifiedCard, availableCrew, sacrificeDisabled);
                assignedCrewIds = [...result.assignments.values()];
                sacrificeCrewId = sacrificeDisabled ? null : result.sacrificeCrewId;
            } else {
                // NarrativeModal fallback (if CrisisModal not registered)
                assignedCrewIds = this.autoAssignCrew(modifiedCard, availableCrew, event.pilotEntityId);
                const narrativeModal = ServiceLocator.get<NarrativeModal>('narrativeModal');
                const choiceLabels = this.buildFallbackChoices(resolveOutcomeTier(
                    this.calculateTotal(modifiedCard, assignedCrewIds) - card.difficulty,
                ));
                await narrativeModal.show({
                    title: `\u26A0 ${card.title}`,
                    body: `${card.description}\n\nYour crew responds.\nSkill total: ${this.calculateTotal(modifiedCard, assignedCrewIds)} vs Difficulty: ${card.difficulty}`,
                    choices: choiceLabels,
                });
            }

            // Handle sacrifice — auto-succeeds, destroys Extiris
            if (sacrificeCrewId !== null) {
                if (isDebugEnabled()) {
                    const sacCrew = this.world.getEntity(sacrificeCrewId)?.getComponent(CrewMemberComponent);
                    console.log(`[Combat] SACRIFICE: ${sacCrew?.fullName ?? 'Unknown'}`);
                }

                // Kill the sacrificed crew member
                const sacEntity = this.world.getEntity(sacrificeCrewId);
                const sacCrew = sacEntity?.getComponent(CrewMemberComponent);
                if (sacCrew && sacCrew.location.type !== 'dead') {
                    sacCrew.location = { type: 'dead' };
                    this.eventQueue.emit({
                        type: GameEvents.CREW_DEATH,
                        entityId: sacrificeCrewId,
                        name: sacCrew.fullName,
                        cause: 'sacrifice',
                    });
                }

                // Destroy the Extiris
                const extiris = this.world.getEntityByName('extiris');
                if (extiris) {
                    this.world.removeEntity(extiris.id);
                    this.extirisDestructionCount++;
                    this.eventQueue.emit({
                        type: GameEvents.EXTIRIS_DESTROYED,
                        cause: 'sacrifice',
                        sacrificeName: sacCrew?.fullName,
                    });

                    // Start respawn timer on gameState entity
                    const gameState = this.world.getEntityByName('gameState');
                    if (gameState) {
                        // Remove any existing respawn component (shouldn't happen, but defensive)
                        const existing = gameState.getComponent(ExtirisRespawnComponent);
                        if (!existing) {
                            // Gather combat memory for respawn inheritance
                            const combatHistory = extirisAI?.memory.combatHistory ?? [];
                            const adaptations = extirisAI?.memory.activeAdaptations ?? [];
                            // Include the pending record from this encounter
                            const fullHistory = this.pendingCombatRecord
                                ? [...combatHistory, this.pendingCombatRecord]
                                : [...combatHistory];
                            this.pendingCombatRecord = null;

                            gameState.addComponent(new ExtirisRespawnComponent(
                                this.extirisDestructionCount,
                                fullHistory,
                                adaptations,
                            ));
                        }
                    }
                }

                // Show sacrifice outcome
                const outcomeModal = crisisModal ?? ServiceLocator.get<NarrativeModal>('narrativeModal');
                const sacName = sacCrew?.fullName ?? 'Your crew member';
                await outcomeModal.showOutcome(
                    `${sacName} rams the scout directly into the Extiris hunter.\n\nThe explosion tears through both vessels. The hunter's signal goes dark.\n\nFor now, the skies are quiet. But the Extiris will send another.`,
                );

                this.eventQueue.emit({
                    type: GameEvents.ENCOUNTER_RESOLVED,
                    tier: 'sacrifice',
                    margin: 0,
                    cardId: card.id,
                    adaptationTag: card.adaptationTag,
                });

                // Record combat memory (Extiris is destroyed, store for respawn)
                this.recordCombatMemory(card, 'catastrophe' as OutcomeTier, assignedCrewIds, true);

                // Place ghost marker at scout's last position
                this.createGhostMarker(event.scoutEntityId, sacCrew?.fullName ?? 'Unknown');
            } else {
                // Normal resolution — calculate skill totals and resolve outcome
                const total = this.calculateTotal(modifiedCard, assignedCrewIds);
                const margin = total - card.difficulty;
                const tier = resolveOutcomeTier(margin);
                const outcome = getOutcomeForTier(card, tier);

                if (isDebugEnabled()) {
                    console.log(`[Combat] Total: ${total}, Difficulty: ${card.difficulty}, Margin: ${margin}, Tier: ${tier}`);
                }

                // Apply consequences
                if (outcome) {
                    applyConsequences(outcome.consequences, {
                        world: this.world,
                        eventQueue: this.eventQueue,
                        scoutEntityId: event.scoutEntityId,
                        pilotEntityId: event.pilotEntityId,
                        assignedCrewIds,
                        turn: this.currentTurn,
                        cardTitle: card.title,
                        tier,
                    });

                    // Show outcome text
                    const outcomeModal = crisisModal ?? ServiceLocator.get<NarrativeModal>('narrativeModal');
                    await outcomeModal.showOutcome(outcome.description);

                    // Ghost marker if pilot died (failure/catastrophe)
                    if (tier === 'failure' || tier === 'catastrophe') {
                        const pilotCrew = this.world.getEntity(event.pilotEntityId)?.getComponent(CrewMemberComponent);
                        if (pilotCrew && pilotCrew.location.type === 'dead') {
                            this.createGhostMarker(event.scoutEntityId, pilotCrew.fullName);
                        }
                    }
                }

                // Emit resolved event
                this.eventQueue.emit({
                    type: GameEvents.ENCOUNTER_RESOLVED,
                    tier,
                    margin,
                    cardId: card.id,
                    adaptationTag: card.adaptationTag,
                });

                // Record combat memory and request adaptation (fire-and-forget)
                this.recordCombatMemory(card, tier, assignedCrewIds, false);
                this.requestAdaptationUpdate();
            }

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

    private pendingCombatRecord: CombatEncounterRecord | null = null;

    private recordCombatMemory(
        card: CrisisCard,
        tier: OutcomeTier,
        assignedCrewIds: number[],
        extirisDestroyed: boolean,
    ): void {
        const record: CombatEncounterRecord = {
            turn: this.currentTurn,
            tacticUsed: card.adaptationTag,
            crewSkillsUsed: card.skillSlots.map(s => s.skill),
            outcome: tier,
            playerLosses: assignedCrewIds.filter(id => {
                const e = this.world.getEntity(id);
                const c = e?.getComponent(CrewMemberComponent);
                return c && c.location.type === 'dead';
            }).length,
        };

        if (extirisDestroyed) {
            // Extiris is gone — store record for respawn to pick up
            this.pendingCombatRecord = record;
        } else {
            const extiris = this.world.getEntityByName('extiris');
            const ai = extiris?.getComponent(ExtirisAIComponent);
            if (ai) {
                ai.memory.combatHistory.push(record);
                // Cap at 20 records
                if (ai.memory.combatHistory.length > 20) {
                    ai.memory.combatHistory.splice(0, ai.memory.combatHistory.length - 20);
                }
            }
        }

        if (isDebugEnabled()) {
            console.log(`[Combat] Memory recorded: tactic=${record.tacticUsed}, outcome=${record.outcome}, losses=${record.playerLosses}`);
        }
    }

    private requestAdaptationUpdate(): void {
        const extiris = this.world.getEntityByName('extiris');
        const ai = extiris?.getComponent(ExtirisAIComponent);
        if (!ai) return;

        const aiService = (() => {
            try { return ServiceLocator.get<AIService>('aiService'); }
            catch { return null; }
        })();
        if (!aiService) return;

        // Fire-and-forget: adaptations apply to NEXT encounter
        aiService.requestAdaptation(ai.memory.combatHistory, ai.memory.activeAdaptations)
            .then(adaptations => {
                if (!ai || ai.destroyed) return;
                ai.memory.activeAdaptations = adaptations;
                if (isDebugEnabled()) {
                    console.log(`[Combat] Adaptations updated: ${adaptations.join(', ') || 'none'}`);
                }
            })
            .catch(() => {
                // Silent failure — deterministic fallback handled inside requestAdaptation
            });
    }

    private createGhostMarker(scoutEntityId: number, pilotName: string): void {
        const scoutEntity = this.world.getEntity(scoutEntityId);
        const scoutTransform = scoutEntity?.getComponent(TransformComponent);
        if (!scoutTransform) return;

        const x = scoutTransform.x;
        const y = scoutTransform.y;
        const marker = this.world.createEntity(`ghost_${pilotName}`);
        marker.addComponent(new TransformComponent(x, y));
        marker.addComponent(new GhostMarkerComponent(pilotName));

        // Render: faint X + name, alpha based on turnsRemaining
        marker.addComponent(new RenderComponent('world', (ctx, mx, my) => {
            const ghost = marker.getComponent(GhostMarkerComponent);
            if (!ghost) return;
            const alpha = Math.max(0, (ghost.turnsRemaining / 10) * 0.3);
            if (alpha <= 0) return;

            ctx.save();
            ctx.globalAlpha = alpha;

            // X mark
            const size = 8;
            ctx.strokeStyle = '#e05050';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(mx - size, my - size);
            ctx.lineTo(mx + size, my + size);
            ctx.moveTo(mx + size, my - size);
            ctx.lineTo(mx - size, my + size);
            ctx.stroke();

            // Pilot name
            ctx.fillStyle = '#e05050';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(pilotName, mx, my + size + 12);

            ctx.restore();
        }));

        if (isDebugEnabled()) {
            console.log(`[Combat] Ghost marker placed for ${pilotName} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
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

    private calculateTotal(card: CrisisCard, assignedCrewIds: number[]): number {
        let total = 0;
        for (let i = 0; i < card.skillSlots.length && i < assignedCrewIds.length; i++) {
            const crewEntity = this.world.getEntity(assignedCrewIds[i]);
            const crew = crewEntity?.getComponent(CrewMemberComponent);
            if (crew) {
                let score = getSkillScore(crew, card.skillSlots[i].skill, assignedCrewIds[i]);
                // Relationship modifiers
                for (let j = 0; j < assignedCrewIds.length; j++) {
                    if (j === i) continue;
                    score += getRelationshipModifier(crew, assignedCrewIds[j]);
                }
                total += score;
            }
        }
        return total;
    }

    private autoAssignCrew(
        card: CrisisCard,
        availableCrew: Array<{ entityId: number; crew: CrewMemberComponent }>,
        pilotEntityId: number,
    ): number[] {
        const assignedCrewIds: number[] = [];
        const pilotEntry = availableCrew.find(c => c.entityId === pilotEntityId);
        if (pilotEntry) assignedCrewIds.push(pilotEntry.entityId);

        const shipCrew = availableCrew.filter(c => c.entityId !== pilotEntityId);
        for (let i = 1; i < card.skillSlots.length && i - 1 < shipCrew.length; i++) {
            const slot = card.skillSlots[i];
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
        return assignedCrewIds;
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
        this.eventQueue.off(GameEvents.TURN_END, this.turnEndHandler);
    }
}
