// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfirmModal } from '../ConfirmModal';

describe('ConfirmModal', () => {
    let modal: ConfirmModal;

    beforeEach(() => {
        modal = new ConfirmModal();
    });

    afterEach(() => {
        modal.destroy();
    });

    it('resolves true on confirm button click', async () => {
        const promise = modal.show({ title: 'Test', body: 'Confirm?' });
        const btn = document.querySelector('.confirm-modal-btn.confirm') as HTMLElement;
        btn.click();
        expect(await promise).toBe(true);
    });

    it('resolves false on cancel button click', async () => {
        const promise = modal.show({ title: 'Test', body: 'Cancel?' });
        const btn = document.querySelector('.confirm-modal-btn.cancel') as HTMLElement;
        btn.click();
        expect(await promise).toBe(false);
    });

    it('resolves false on Escape key', async () => {
        const promise = modal.show({ title: 'Test', body: 'Escape?' });
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
        expect(await promise).toBe(false);
    });

    it('resolves true on Enter key', async () => {
        const promise = modal.show({ title: 'Test', body: 'Enter?' });
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', bubbles: true }));
        expect(await promise).toBe(true);
    });

    it('resolves false on backdrop click', async () => {
        const promise = modal.show({ title: 'Test', body: 'Backdrop?' });
        const backdrop = document.querySelector('.confirm-modal-backdrop') as HTMLElement;
        backdrop.click();
        expect(await promise).toBe(false);
    });

    it('resolves previous promise as false when show() called while open', async () => {
        const first = modal.show({ title: 'First', body: 'First' });
        const second = modal.show({ title: 'Second', body: 'Second' });
        expect(await first).toBe(false);

        const btn = document.querySelector('.confirm-modal-btn.confirm') as HTMLElement;
        btn.click();
        expect(await second).toBe(true);
    });

    it('creates and removes DOM elements correctly', () => {
        expect(document.querySelector('.confirm-modal-backdrop')).toBeNull();
        modal.show({ title: 'Test', body: 'DOM?' });
        expect(document.querySelector('.confirm-modal-backdrop')).not.toBeNull();
        modal.destroy();
        expect(document.querySelector('.confirm-modal-backdrop')).toBeNull();
    });

    it('applies danger CSS class when danger option is true', () => {
        modal.show({ title: 'Delete', body: 'Sure?', danger: true });
        const confirmBtn = document.querySelector('.confirm-modal-btn.confirm') as HTMLElement;
        expect(confirmBtn.classList.contains('danger')).toBe(true);
    });

    it('renders custom confirmLabel and cancelLabel', () => {
        modal.show({ title: 'Test', body: 'Custom?', confirmLabel: 'YES', cancelLabel: 'NO' });
        const cancel = document.querySelector('.confirm-modal-btn.cancel') as HTMLElement;
        const confirm = document.querySelector('.confirm-modal-btn.confirm') as HTMLElement;
        expect(cancel.textContent?.trim()).toBe('NO');
        expect(confirm.textContent?.trim()).toBe('YES');
    });

    it('renders title and body text correctly', () => {
        modal.show({ title: 'DEMOLISH', body: 'Are you sure?' });
        const title = document.querySelector('.confirm-modal-title') as HTMLElement;
        const body = document.querySelector('.confirm-modal-body') as HTMLElement;
        expect(title.textContent?.trim()).toBe('DEMOLISH');
        expect(body.textContent?.trim()).toBe('Are you sure?');
    });

    it('isOpen getter reflects state', async () => {
        expect(modal.isOpen).toBe(false);
        const promise = modal.show({ title: 'Test', body: 'Open?' });
        expect(modal.isOpen).toBe(true);
        const btn = document.querySelector('.confirm-modal-btn.confirm') as HTMLElement;
        btn.click();
        await promise;
        expect(modal.isOpen).toBe(false);
    });

    it('escapes HTML in title and body', () => {
        modal.show({ title: '<script>alert(1)</script>', body: '<b>bold</b>' });
        const title = document.querySelector('.confirm-modal-title') as HTMLElement;
        const body = document.querySelector('.confirm-modal-body') as HTMLElement;
        expect(title.innerHTML).not.toContain('<script>');
        expect(body.innerHTML).not.toContain('<b>');
    });
});
