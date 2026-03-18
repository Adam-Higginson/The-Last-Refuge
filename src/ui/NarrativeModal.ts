// NarrativeModal.ts — Typewriter-animated narrative event dialog.
// Registered as a service via ServiceLocator. Shows narrative text with
// typewriter effect, then presents choices or a continue button.

import './NarrativeModal.css';

export interface NarrativeModalChoice {
    label: string;
    description?: string;
    costText?: string;
    gainText?: string;
    disabled?: boolean;
}

export interface NarrativeModalOptions {
    title: string;
    body: string;
    choices?: NarrativeModalChoice[];
}

type ModalState = 'closed' | 'typewriting' | 'awaiting_choice';

const TYPEWRITER_INTERVAL_MS = 30;

export class NarrativeModal {
    private backdrop: HTMLElement | null = null;
    private bodyEl: HTMLElement | null = null;
    private actionsEl: HTMLElement | null = null;
    private resolve: ((value: number) => void) | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private typewriterTimer: ReturnType<typeof setInterval> | null = null;
    private state: ModalState = 'closed';
    private fullText = '';
    private charIndex = 0;

    get isOpen(): boolean {
        return this.state !== 'closed';
    }

    show(options: NarrativeModalOptions): Promise<number> {
        // If already open, resolve previous as -1
        if (this.resolve) {
            this.resolve(-1);
            this.resolve = null;
        }
        this.clearTypewriter();

        this.ensureDOM();
        this.render(options);

        return new Promise<number>((resolve) => {
            this.resolve = resolve;
            this.backdrop?.classList.add('open');
            this.state = 'typewriting';

            // Start typewriter
            this.fullText = options.body;
            this.charIndex = 0;
            if (this.bodyEl) this.bodyEl.textContent = '';

            this.typewriterTimer = setInterval(() => {
                if (!this.bodyEl) {
                    this.clearTypewriter();
                    return;
                }
                this.charIndex++;
                this.bodyEl.textContent = this.fullText.slice(0, this.charIndex);
                if (this.charIndex >= this.fullText.length) {
                    this.completeTypewriter();
                }
            }, TYPEWRITER_INTERVAL_MS);

            // Key handler
            this.onKeyDown = (e: KeyboardEvent): void => {
                if (this.state === 'typewriting') {
                    if (e.code === 'Escape' || e.code === 'Space') {
                        e.stopPropagation();
                        e.preventDefault();
                        this.completeTypewriter();
                    }
                } else if (this.state === 'awaiting_choice') {
                    if (e.code === 'Enter') {
                        e.stopPropagation();
                        e.preventDefault();
                        this.clickFirstEnabled();
                    }
                }
            };
            window.addEventListener('keydown', this.onKeyDown, true);
        });
    }

    /** Show outcome text, then wait for continue. Returns when user clicks continue. */
    showOutcome(text: string): Promise<void> {
        this.clearTypewriter();

        if (!this.bodyEl || !this.actionsEl) return Promise.resolve();

        this.state = 'typewriting';
        this.fullText = text;
        this.charIndex = 0;
        this.bodyEl.textContent = '';

        // Hide current actions, will show continue after typewriter
        this.actionsEl.classList.add('hidden');

        return new Promise<void>((outerResolve) => {
            // Render continue-only actions for the outcome phase
            const renderContinue = (): void => {
                if (!this.actionsEl) return;
                this.actionsEl.innerHTML = `<button class="narrative-modal-btn continue" type="button">CONTINUE</button>`;
                this.actionsEl.classList.remove('hidden');
                this.state = 'awaiting_choice';

                const btn = this.actionsEl.querySelector('.narrative-modal-btn.continue');
                btn?.addEventListener('click', () => {
                    outerResolve();
                });
            };

            this.typewriterTimer = setInterval(() => {
                if (!this.bodyEl) {
                    this.clearTypewriter();
                    return;
                }
                this.charIndex++;
                this.bodyEl.textContent = this.fullText.slice(0, this.charIndex);
                if (this.charIndex >= this.fullText.length) {
                    this.clearTypewriter();
                    renderContinue();
                }
            }, TYPEWRITER_INTERVAL_MS);
        });
    }

    destroy(): void {
        this.clearTypewriter();
        if (this.resolve) {
            this.resolve(-1);
            this.resolve = null;
        }
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown, true);
            this.onKeyDown = null;
        }
        if (this.backdrop) {
            this.backdrop.remove();
            this.backdrop = null;
        }
        this.bodyEl = null;
        this.actionsEl = null;
        this.state = 'closed';
    }

    private close(choiceIndex: number): void {
        this.clearTypewriter();
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown, true);
            this.onKeyDown = null;
        }
        this.backdrop?.classList.remove('open');
        this.state = 'closed';
        if (this.resolve) {
            this.resolve(choiceIndex);
            this.resolve = null;
        }
    }

    private completeTypewriter(): void {
        this.clearTypewriter();
        if (this.bodyEl) {
            this.bodyEl.textContent = this.fullText;
        }
        if (this.actionsEl) {
            this.actionsEl.classList.remove('hidden');
        }
        this.state = 'awaiting_choice';
    }

    private clearTypewriter(): void {
        if (this.typewriterTimer !== null) {
            clearInterval(this.typewriterTimer);
            this.typewriterTimer = null;
        }
    }

    private clickFirstEnabled(): void {
        if (!this.actionsEl) return;
        const btns = this.actionsEl.querySelectorAll('.narrative-modal-btn:not(.disabled)');
        if (btns.length > 0) {
            (btns[0] as HTMLElement).click();
        }
    }

    private ensureDOM(): void {
        if (this.backdrop && document.body.contains(this.backdrop)) return;

        if (this.backdrop) {
            console.warn('NarrativeModal: backdrop was removed externally, recreating');
        }
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'narrative-modal-backdrop';
        document.body.appendChild(this.backdrop);

        // Body click skips typewriter (does NOT dismiss modal)
        this.backdrop.addEventListener('click', (e: MouseEvent) => {
            if (this.state === 'typewriting') {
                e.stopPropagation();
                this.completeTypewriter();
            }
            // Backdrop click does nothing when awaiting_choice — narrative is not dismissible
        });
    }

    private render(options: NarrativeModalOptions): void {
        if (!this.backdrop) return;

        const hasChoices = options.choices && options.choices.length > 0;

        let actionsHtml: string;
        if (hasChoices && options.choices) {
            actionsHtml = options.choices.map((choice, i) => {
                const disabledClass = choice.disabled ? ' disabled' : '';
                const descHtml = choice.description
                    ? `<span class="description">${this.escapeHtml(choice.description)}</span>`
                    : '';
                const costHtml = choice.costText
                    ? `<span class="cost-text">${this.escapeHtml(choice.costText)}</span>`
                    : '';
                const gainHtml = choice.gainText
                    ? `<span class="gain-text">${this.escapeHtml(choice.gainText)}</span>`
                    : '';
                const resourceGroup = (costHtml || gainHtml)
                    ? `<span class="resource-group">${costHtml}${gainHtml}</span>`
                    : '';
                return `<button class="narrative-modal-btn${disabledClass}" type="button" data-choice="${i}">
                    <span class="label-group">${this.escapeHtml(choice.label)}${descHtml}</span>
                    ${resourceGroup}
                </button>`;
            }).join('');
        } else {
            actionsHtml = `<button class="narrative-modal-btn continue" type="button">CONTINUE</button>`;
        }

        this.backdrop.innerHTML = `
            <div class="narrative-modal-box">
                <div class="narrative-modal-title">${this.escapeHtml(options.title)}</div>
                <div class="narrative-modal-body"></div>
                <div class="narrative-modal-actions hidden">${actionsHtml}</div>
            </div>
        `;

        this.bodyEl = this.backdrop.querySelector('.narrative-modal-body');
        this.actionsEl = this.backdrop.querySelector('.narrative-modal-actions');

        // Attach choice handlers
        if (hasChoices && options.choices) {
            const btns = this.backdrop.querySelectorAll('.narrative-modal-btn[data-choice]');
            btns.forEach((btn) => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.getAttribute('data-choice') ?? '-1', 10);
                    this.close(idx);
                });
            });
        } else {
            const continueBtn = this.backdrop.querySelector('.narrative-modal-btn.continue');
            continueBtn?.addEventListener('click', () => {
                this.close(-1);
            });
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
