// CrisisModal.ts — BSG-inspired crew assignment crisis resolution modal.
//
// STATE MACHINE:
//   closed → typewriting → assigning → committed → showing_outcome → closed
//
// HIERARCHY (what the player sees, in order):
//   1. Title + narrative (what's happening)
//   2. Outcome bar (stakes — shows CATASTROPHE before any crew assigned)
//   3. Skill slots (what can I do)
//   4. Crew roster (resources)
//   5. Commit button (action)
//
// PACING:
//   - 0.5s fade-in (not instant)
//   - 20ms/char typewriter (faster than narrative 30ms — urgency)
//   - Narrative NOT skippable on first display
//   - 0.3s blackout between commit and outcome
//   - 0.5s fade-out after outcome dismissed

import './CrisisModal.css';
import { getSkillScore, getRelationshipModifier } from '../utils/combatSkills';
import { resolveOutcomeTier } from '../data/crisisCards';
import type { CrisisCard, OutcomeTier } from '../data/crisisCards';
import type { SkillType } from '../utils/combatSkills';
import type { CrewMemberComponent } from '../components/CrewMemberComponent';

const TYPEWRITER_MS = 20;
const BLACKOUT_MS = 300;
const FADE_MS = 500;

const SKILL_ICONS: Record<SkillType, string> = {
    piloting: '\u2708',      // ✈
    engineering: '\u2699',    // ⚙
    combat: '\u2694',         // ⚔
    leadership: '\u2605',     // ★
    medical: '\u271A',        // ✚
};

const TIER_LABELS: Record<OutcomeTier, string> = {
    critical_success: 'CRITICAL SUCCESS',
    success: 'SUCCESS',
    partial: 'PARTIAL FAILURE',
    failure: 'FAILURE',
    catastrophe: 'CATASTROPHE',
};

export interface CrewEntry {
    entityId: number;
    crew: CrewMemberComponent;
}

export interface CrisisModalResult {
    /** Map from slot index → assigned crew entity ID. */
    assignments: Map<number, number>;
    /** Entity ID of crew assigned to sacrifice slot, or null. */
    sacrificeCrewId: number | null;
}

type ModalState = 'closed' | 'typewriting' | 'assigning' | 'committed' | 'showing_outcome';

export class CrisisModal {
    private backdrop: HTMLElement | null = null;
    private state: ModalState = 'closed';
    private typewriterTimer: ReturnType<typeof setInterval> | null = null;
    private fullText = '';
    private charIndex = 0;

    // Assignment state
    private card: CrisisCard | null = null;
    private availableCrew: CrewEntry[] = [];
    private assignments: Map<number, number> = new Map(); // slotIndex → entityId
    private sacrificeCrewId: number | null = null;
    private selectedCrewId: number | null = null;

    // Resolve callbacks
    private resolveAssignment: ((result: CrisisModalResult) => void) | null = null;
    private resolveOutcome: (() => void) | null = null;

    // Key handler
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

    get isOpen(): boolean {
        return this.state !== 'closed';
    }

    /**
     * Show the crisis modal for crew assignment.
     * Returns when the player commits their crew assignments.
     */
    show(card: CrisisCard, crew: CrewEntry[]): Promise<CrisisModalResult> {
        this.card = card;
        this.availableCrew = crew;
        this.assignments = new Map();
        this.sacrificeCrewId = null;
        this.selectedCrewId = null;

        this.ensureDOM();
        this.renderCrisisView(card);

        return new Promise<CrisisModalResult>((resolve) => {
            this.resolveAssignment = resolve;

            // Fade in
            if (this.backdrop) {
                this.backdrop.classList.add('open');
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        this.backdrop?.classList.add('visible');
                    });
                });
            }

            // Start typewriter for narrative text
            this.state = 'typewriting';
            this.fullText = card.description;
            this.charIndex = 0;
            const bodyEl = this.backdrop?.querySelector('.crisis-modal-body') as HTMLElement;
            if (bodyEl) bodyEl.textContent = '';

            this.typewriterTimer = setInterval(() => {
                if (!bodyEl) { this.clearTypewriter(); return; }
                this.charIndex++;
                bodyEl.textContent = this.fullText.slice(0, this.charIndex);
                if (this.charIndex >= this.fullText.length) {
                    this.completeTypewriter();
                }
            }, TYPEWRITER_MS);

            // Key handler — Escape is blocked (crisis is mandatory)
            this.onKeyDown = (e: KeyboardEvent): void => {
                if (e.code === 'Escape') {
                    e.stopPropagation();
                    e.preventDefault();
                    return; // Blocked — cannot dismiss crisis
                }
                if (this.state === 'typewriting' && e.code === 'Space') {
                    // Do NOT allow skipping on first display — player must read
                    e.stopPropagation();
                    e.preventDefault();
                }
                if (this.state === 'assigning' && e.code === 'Enter') {
                    e.stopPropagation();
                    e.preventDefault();
                    this.handleCommit();
                }
                if (this.state === 'showing_outcome' && e.code === 'Enter') {
                    e.stopPropagation();
                    e.preventDefault();
                    this.handleContinue();
                }
            };
            window.addEventListener('keydown', this.onKeyDown, true);
        });
    }

    /**
     * Show the outcome text after crisis resolution.
     * Uses 0.3s blackout transition, then typewriter for outcome text.
     */
    showOutcome(text: string): Promise<void> {
        this.clearTypewriter();
        this.state = 'committed';

        return new Promise<void>((resolve) => {
            this.resolveOutcome = resolve;

            // Blackout
            this.backdrop?.classList.add('blackout');

            setTimeout(() => {
                // Replace modal content with outcome text
                const box = this.backdrop?.querySelector('.crisis-modal-box');
                if (box) {
                    box.innerHTML = `
                        <div class="crisis-modal-title">${this.escapeHtml(this.card?.title ?? 'OUTCOME')}</div>
                        <div class="crisis-outcome-text"></div>
                        <button class="crisis-continue-btn" type="button" style="display:none">CONTINUE</button>
                    `;
                }

                this.backdrop?.classList.remove('blackout');

                // Typewriter for outcome
                this.state = 'showing_outcome';
                this.fullText = text;
                this.charIndex = 0;
                const outcomeEl = this.backdrop?.querySelector('.crisis-outcome-text') as HTMLElement;
                const continueBtn = this.backdrop?.querySelector('.crisis-continue-btn') as HTMLElement;

                if (outcomeEl) {
                    this.typewriterTimer = setInterval(() => {
                        this.charIndex++;
                        outcomeEl.textContent = this.fullText.slice(0, this.charIndex);
                        if (this.charIndex >= this.fullText.length) {
                            this.clearTypewriter();
                            if (continueBtn) continueBtn.style.display = '';
                        }
                    }, TYPEWRITER_MS);
                }

                // Continue button handler
                continueBtn?.addEventListener('click', () => {
                    this.handleContinue();
                });
            }, BLACKOUT_MS);
        });
    }

    destroy(): void {
        this.clearTypewriter();
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown, true);
            this.onKeyDown = null;
        }
        if (this.backdrop) {
            this.backdrop.remove();
            this.backdrop = null;
        }
        this.state = 'closed';
    }

    // --- Private methods ---

    private handleCommit(): void {
        if (this.state !== 'assigning') return;

        // Debounce — disable commit after first click
        const commitBtn = this.backdrop?.querySelector('.crisis-commit-btn') as HTMLButtonElement;
        if (commitBtn) commitBtn.disabled = true;

        this.state = 'committed';

        if (this.resolveAssignment) {
            this.resolveAssignment({
                assignments: new Map(this.assignments),
                sacrificeCrewId: this.sacrificeCrewId,
            });
            this.resolveAssignment = null;
        }
    }

    private handleContinue(): void {
        if (this.state !== 'showing_outcome') return;

        this.clearTypewriter();

        // Fade out
        this.backdrop?.classList.remove('visible');
        setTimeout(() => {
            this.backdrop?.classList.remove('open');
            this.state = 'closed';

            if (this.onKeyDown) {
                window.removeEventListener('keydown', this.onKeyDown, true);
                this.onKeyDown = null;
            }

            if (this.resolveOutcome) {
                this.resolveOutcome();
                this.resolveOutcome = null;
            }
        }, FADE_MS);
    }

    private completeTypewriter(): void {
        this.clearTypewriter();
        const bodyEl = this.backdrop?.querySelector('.crisis-modal-body') as HTMLElement;
        if (bodyEl) bodyEl.textContent = this.fullText;
        this.state = 'assigning';
        // Enable slots and crew cards (they're already rendered but now interactive)
        this.updateOutcomeBar();
    }

    private clearTypewriter(): void {
        if (this.typewriterTimer !== null) {
            clearInterval(this.typewriterTimer);
            this.typewriterTimer = null;
        }
    }

    private ensureDOM(): void {
        if (this.backdrop && document.body.contains(this.backdrop)) return;
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'crisis-modal-backdrop';
        document.body.appendChild(this.backdrop);
    }

    private renderCrisisView(card: CrisisCard): void {
        if (!this.backdrop) return;

        const slotsHtml = card.skillSlots.map((slot, i) => {
            const icon = SKILL_ICONS[slot.skill];
            const isSacrifice = false; // sacrifice slot is separate
            return `<div class="crisis-slot${isSacrifice ? ' sacrifice' : ''}" data-slot="${i}">
                <div class="crisis-slot-header">
                    <span class="crisis-slot-icon">${icon}</span>
                    <span class="crisis-slot-skill">${slot.skill.toUpperCase()}</span>
                </div>
                <div class="crisis-slot-label">${this.escapeHtml(slot.label)}</div>
                <div class="crisis-slot-empty">click to assign</div>
            </div>`;
        }).join('');

        // Add sacrifice slot
        const sacrificeHtml = `<div class="crisis-slot sacrifice" data-slot="sacrifice">
            <div class="crisis-slot-header">
                <span class="crisis-slot-icon">\u2620</span>
                <span class="crisis-slot-skill">SACRIFICE</span>
            </div>
            <div class="crisis-slot-label">Ram the hunter</div>
            <div class="crisis-slot-empty">costs a life — destroys Extiris</div>
        </div>`;

        const crewHtml = this.availableCrew.map(entry => {
            const primarySkill = this.getPrimarySkill(entry);
            const isInjured = entry.crew.statusEffects.includes('Injured');
            const injuredClass = isInjured ? ' injured' : '';
            return `<div class="crisis-crew-card${injuredClass}" data-crew="${entry.entityId}">
                <div class="crisis-crew-name">${this.escapeHtml(this.truncateName(entry.crew.fullName))}</div>
                <div class="crisis-crew-role">${entry.crew.role}</div>
                <div class="crisis-crew-skills">${primarySkill}</div>
            </div>`;
        }).join('');

        this.backdrop.innerHTML = `
            <div class="crisis-modal-box">
                <div class="crisis-modal-title">\u26A0 ${this.escapeHtml(card.title)}</div>
                <div class="crisis-modal-body"></div>
                <div class="crisis-outcome-bar">
                    <div class="crisis-outcome-fill tier-catastrophe" style="width: 0%"></div>
                    <div class="crisis-outcome-label">
                        <span class="crisis-outcome-tier">CATASTROPHE</span>
                        <span class="crisis-outcome-score">0 / ${card.difficulty}</span>
                    </div>
                </div>
                <div class="crisis-slots">${slotsHtml}${sacrificeHtml}</div>
                <div class="crisis-crew-header">AVAILABLE CREW</div>
                <div class="crisis-crew-roster">${crewHtml}</div>
                <button class="crisis-commit-btn tier-catastrophe" type="button">ACCEPT FATE</button>
            </div>
        `;

        // Attach event handlers
        this.attachSlotHandlers();
        this.attachCrewHandlers();
        this.attachCommitHandler();
    }

    private attachSlotHandlers(): void {
        const slots = this.backdrop?.querySelectorAll('.crisis-slot');
        slots?.forEach(slot => {
            slot.addEventListener('click', () => {
                if (this.state !== 'assigning') return;
                const slotAttr = slot.getAttribute('data-slot');
                if (!slotAttr) return;

                if (slotAttr === 'sacrifice') {
                    this.handleSacrificeSlotClick();
                    return;
                }

                const slotIndex = parseInt(slotAttr, 10);

                // If slot has a crew member, unassign them
                if (this.assignments.has(slotIndex)) {
                    this.assignments.delete(slotIndex);
                    this.selectedCrewId = null;
                    this.refreshUI();
                    return;
                }

                // If a crew member is selected, assign them to this slot
                if (this.selectedCrewId !== null) {
                    // Remove from any previous slot
                    for (const [si, eid] of this.assignments) {
                        if (eid === this.selectedCrewId) {
                            this.assignments.delete(si);
                            break;
                        }
                    }
                    this.assignments.set(slotIndex, this.selectedCrewId);
                    this.selectedCrewId = null;
                    this.refreshUI();
                }
            });
        });
    }

    private attachCrewHandlers(): void {
        const cards = this.backdrop?.querySelectorAll('.crisis-crew-card');
        cards?.forEach(card => {
            card.addEventListener('click', () => {
                if (this.state !== 'assigning') return;
                const entityId = parseInt(card.getAttribute('data-crew') ?? '-1', 10);
                if (entityId < 0) return;

                // If already assigned, unassign
                for (const [si, eid] of this.assignments) {
                    if (eid === entityId) {
                        this.assignments.delete(si);
                        this.selectedCrewId = null;
                        this.refreshUI();
                        return;
                    }
                }
                if (this.sacrificeCrewId === entityId) {
                    this.sacrificeCrewId = null;
                    this.selectedCrewId = null;
                    this.refreshUI();
                    return;
                }

                // Toggle selection
                this.selectedCrewId = this.selectedCrewId === entityId ? null : entityId;
                this.refreshUI();
            });
        });
    }

    private attachCommitHandler(): void {
        const btn = this.backdrop?.querySelector('.crisis-commit-btn');
        btn?.addEventListener('click', () => {
            this.handleCommit();
        });
    }

    private handleSacrificeSlotClick(): void {
        if (this.sacrificeCrewId !== null) {
            // Unassign sacrifice
            this.sacrificeCrewId = null;
            this.selectedCrewId = null;
            this.refreshUI();
            return;
        }

        if (this.selectedCrewId !== null) {
            // Remove from any regular slot
            for (const [si, eid] of this.assignments) {
                if (eid === this.selectedCrewId) {
                    this.assignments.delete(si);
                    break;
                }
            }
            this.sacrificeCrewId = this.selectedCrewId;
            this.selectedCrewId = null;
            this.refreshUI();
        }
    }

    private refreshUI(): void {
        if (!this.backdrop || !this.card) return;

        // Update slots
        const slots = this.backdrop.querySelectorAll('.crisis-slot');
        slots.forEach(slotEl => {
            const slotAttr = slotEl.getAttribute('data-slot');
            if (!slotAttr) return;

            if (slotAttr === 'sacrifice') {
                this.refreshSacrificeSlot(slotEl);
                return;
            }

            const slotIndex = parseInt(slotAttr, 10);
            const assignedEntityId = this.assignments.get(slotIndex);

            if (assignedEntityId !== undefined) {
                const entry = this.availableCrew.find(c => c.entityId === assignedEntityId);
                if (entry && this.card) {
                    const skill = this.card.skillSlots[slotIndex].skill;
                    const score = getSkillScore(entry.crew, skill, entry.entityId);
                    slotEl.classList.add('assigned');

                    const crewDiv = slotEl.querySelector('.crisis-slot-empty, .crisis-slot-crew');
                    if (crewDiv) {
                        crewDiv.className = 'crisis-slot-crew';
                        crewDiv.innerHTML = `${this.escapeHtml(entry.crew.fullName)} <span class="crisis-slot-score">+${score}</span>`;
                    }

                    // Show bond/rivalry indicators
                    this.updateBondIndicator(slotEl, assignedEntityId);
                } else {
                    this.clearSlot(slotEl);
                }
            } else {
                this.clearSlot(slotEl);
            }
        });

        // Update crew cards
        const cards = this.backdrop.querySelectorAll('.crisis-crew-card');
        cards.forEach(cardEl => {
            const entityId = parseInt(cardEl.getAttribute('data-crew') ?? '-1', 10);
            const isAssigned = [...this.assignments.values()].includes(entityId) || this.sacrificeCrewId === entityId;
            const isSelected = this.selectedCrewId === entityId;

            cardEl.classList.toggle('assigned', isAssigned);
            cardEl.classList.toggle('selected', isSelected);
        });

        // Update outcome bar and commit button
        this.updateOutcomeBar();
    }

    private refreshSacrificeSlot(slotEl: Element): void {
        if (this.sacrificeCrewId !== null) {
            const entry = this.availableCrew.find(c => c.entityId === this.sacrificeCrewId);
            slotEl.classList.add('assigned');
            const emptyDiv = slotEl.querySelector('.crisis-slot-empty, .crisis-slot-crew');
            if (emptyDiv && entry) {
                emptyDiv.className = 'crisis-slot-crew';
                emptyDiv.innerHTML = `${this.escapeHtml(entry.crew.fullName)} <span style="color:#e05050">WILL DIE</span>`;
            }
        } else {
            slotEl.classList.remove('assigned');
            const crewDiv = slotEl.querySelector('.crisis-slot-crew, .crisis-slot-empty');
            if (crewDiv) {
                crewDiv.className = 'crisis-slot-empty';
                crewDiv.textContent = 'costs a life \u2014 destroys Extiris';
            }
        }
    }

    private clearSlot(slotEl: Element): void {
        slotEl.classList.remove('assigned');
        const crewDiv = slotEl.querySelector('.crisis-slot-crew, .crisis-slot-empty');
        if (crewDiv) {
            crewDiv.className = 'crisis-slot-empty';
            crewDiv.textContent = 'click to assign';
        }
        // Remove bond indicators
        const bondEl = slotEl.querySelector('.crisis-slot-bond, .crisis-slot-rivalry');
        if (bondEl) bondEl.remove();
    }

    private updateBondIndicator(slotEl: Element, entityId: number): void {
        // Remove existing indicators
        const existing = slotEl.querySelector('.crisis-slot-bond, .crisis-slot-rivalry');
        if (existing) existing.remove();

        // Check for bonds/rivalries with other assigned crew
        for (const [_si, otherId] of this.assignments) {
            if (otherId === entityId) continue;
            const entry = this.availableCrew.find(c => c.entityId === entityId);
            if (!entry) continue;

            const mod = getRelationshipModifier(entry.crew, otherId);
            if (mod > 0) {
                const bondEl = document.createElement('div');
                bondEl.className = 'crisis-slot-bond';
                bondEl.textContent = '\u2764 +1 bond';
                slotEl.appendChild(bondEl);
            } else if (mod < 0) {
                const rivalryEl = document.createElement('div');
                rivalryEl.className = 'crisis-slot-rivalry';
                rivalryEl.textContent = '\u26A0 -1 rivalry';
                slotEl.appendChild(rivalryEl);
            }
        }
    }

    private updateOutcomeBar(): void {
        if (!this.backdrop || !this.card) return;

        const total = this.calculateTotal();
        const difficulty = this.card.difficulty;
        const margin = total - difficulty;
        const tier = resolveOutcomeTier(margin);

        // Update fill bar
        const fillEl = this.backdrop.querySelector('.crisis-outcome-fill') as HTMLElement;
        if (fillEl) {
            const pct = Math.min(100, Math.max(2, (total / difficulty) * 100));
            fillEl.style.width = `${pct}%`;

            // Remove old tier classes, add new one
            fillEl.className = `crisis-outcome-fill tier-${tier}`;
        }

        // Update tier label
        const tierEl = this.backdrop.querySelector('.crisis-outcome-tier');
        if (tierEl) tierEl.textContent = TIER_LABELS[tier];

        // Update score
        const scoreEl = this.backdrop.querySelector('.crisis-outcome-score');
        if (scoreEl) scoreEl.textContent = `${total} / ${difficulty}`;

        // Update commit button
        const commitBtn = this.backdrop.querySelector('.crisis-commit-btn') as HTMLElement;
        if (commitBtn) {
            // Remove old tier classes
            commitBtn.className = `crisis-commit-btn tier-${tier}`;

            if (this.sacrificeCrewId !== null) {
                commitBtn.textContent = 'SACRIFICE';
            } else if (this.assignments.size === 0) {
                commitBtn.textContent = 'ACCEPT FATE';
            } else {
                commitBtn.textContent = 'COMMIT';
            }
        }
    }

    private calculateTotal(): number {
        if (!this.card) return 0;

        let total = 0;
        for (const [slotIndex, entityId] of this.assignments) {
            const slot = this.card.skillSlots[slotIndex];
            if (!slot) continue;
            const entry = this.availableCrew.find(c => c.entityId === entityId);
            if (!entry) continue;

            let score = getSkillScore(entry.crew, slot.skill, entityId);

            // Relationship modifiers
            for (const [otherSlotIndex, otherId] of this.assignments) {
                if (otherSlotIndex === slotIndex) continue;
                score += getRelationshipModifier(entry.crew, otherId);
            }

            total += score;
        }

        return total;
    }

    private getPrimarySkill(entry: CrewEntry): string {
        const skills: SkillType[] = ['piloting', 'combat', 'engineering', 'leadership', 'medical'];
        let best: SkillType = 'combat';
        let bestScore = 0;

        for (const skill of skills) {
            const score = getSkillScore(entry.crew, skill, entry.entityId);
            if (score > bestScore) {
                bestScore = score;
                best = skill;
            }
        }

        return `${best.slice(0, 3).toUpperCase()}: ${bestScore}`;
    }

    private truncateName(name: string): string {
        return name.length > 16 ? name.slice(0, 14) + '\u2026' : name;
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
