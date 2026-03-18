// ConfirmModal.ts — Reusable in-game confirmation dialog.
// Registered as a service via ServiceLocator. Callers await show() which
// returns a Promise<boolean> resolved on confirm/cancel/Escape/backdrop click.

import './ConfirmModal.css';

export interface ConfirmModalOptions {
    title: string;
    body: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
}

export class ConfirmModal {
    private backdrop: HTMLElement | null = null;
    private resolve: ((value: boolean) => void) | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

    get isOpen(): boolean {
        return this.resolve !== null;
    }

    show(options: ConfirmModalOptions): Promise<boolean> {
        // If already open, resolve previous as false
        if (this.resolve) {
            this.resolve(false);
            this.resolve = null;
        }

        this.ensureDOM();
        this.render(options);

        return new Promise<boolean>((resolve) => {
            this.resolve = resolve;
            this.backdrop?.classList.add('open');

            this.onKeyDown = (e: KeyboardEvent): void => {
                if (e.code === 'Escape') {
                    e.stopPropagation();
                    this.close(false);
                } else if (e.code === 'Enter') {
                    e.stopPropagation();
                    this.close(true);
                }
            };
            window.addEventListener('keydown', this.onKeyDown, true);
        });
    }

    destroy(): void {
        if (this.resolve) {
            this.resolve(false);
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
    }

    private close(value: boolean): void {
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown, true);
            this.onKeyDown = null;
        }
        this.backdrop?.classList.remove('open');
        if (this.resolve) {
            this.resolve(value);
            this.resolve = null;
        }
    }

    private ensureDOM(): void {
        if (this.backdrop && document.body.contains(this.backdrop)) return;

        if (this.backdrop) {
            // Was removed externally — warn and recreate
            console.warn('ConfirmModal: backdrop was removed externally, recreating');
        }
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'confirm-modal-backdrop';
        document.body.appendChild(this.backdrop);

        // Backdrop click (outside the box) → cancel. Attached once per element.
        this.backdrop.addEventListener('click', (e: MouseEvent) => {
            if (e.target === this.backdrop) {
                this.close(false);
            }
        });
    }

    private render(options: ConfirmModalOptions): void {
        if (!this.backdrop) return;

        const confirmLabel = options.confirmLabel ?? 'CONFIRM';
        const cancelLabel = options.cancelLabel ?? 'CANCEL';
        const dangerClass = options.danger ? ' danger' : '';

        this.backdrop.innerHTML = `
            <div class="confirm-modal-box">
                <div class="confirm-modal-title">${this.escapeHtml(options.title)}</div>
                <div class="confirm-modal-body">${this.escapeHtml(options.body)}</div>
                <div class="confirm-modal-actions">
                    <button class="confirm-modal-btn cancel" type="button">${this.escapeHtml(cancelLabel)}</button>
                    <button class="confirm-modal-btn confirm${dangerClass}" type="button">${this.escapeHtml(confirmLabel)}</button>
                </div>
            </div>
        `;

        // Button clicks
        this.backdrop.querySelector('.confirm-modal-btn.cancel')?.addEventListener('click', () => {
            this.close(false);
        });
        this.backdrop.querySelector('.confirm-modal-btn.confirm')?.addEventListener('click', () => {
            this.close(true);
        });
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
