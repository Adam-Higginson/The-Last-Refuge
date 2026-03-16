// AISettingsUIComponent.ts — Settings modal for Extiris AI configuration.
// Provides API key input and deterministic/LLM toggle.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import type { AIService } from '../services/AIService';

export class AISettingsUIComponent extends Component {
    private gearBtn: HTMLButtonElement | null = null;
    private modal: HTMLElement | null = null;
    private onGearClick: (() => void) | null = null;

    init(): void {
        // Gear icon button
        this.gearBtn = document.createElement('button');
        this.gearBtn.id = 'ai-settings-btn';
        this.gearBtn.innerHTML = '&#9881;'; // gear emoji
        this.gearBtn.title = 'AI Settings';
        this.gearBtn.style.cssText = `
            position: fixed; top: 4px; right: 6px; z-index: 200;
            background: rgba(3, 4, 10, 0.75); border: none;
            color: rgba(192, 200, 216, 0.6); font-size: 18px; width: 32px; height: 32px;
            cursor: pointer; border-radius: 4px;
            display: flex; align-items: center; justify-content: center;
        `;
        document.body.appendChild(this.gearBtn);

        this.onGearClick = (): void => this.toggleModal();
        this.gearBtn.addEventListener('click', this.onGearClick);
    }

    private toggleModal(): void {
        if (this.modal) {
            this.closeModal();
        } else {
            this.openModal();
        }
    }

    private openModal(): void {
        let aiService: AIService | null = null;
        try {
            aiService = ServiceLocator.get<AIService>('aiService');
        } catch {
            // No AI service
        }

        const savedKey = this.getSavedKey();

        this.modal = document.createElement('div');
        this.modal.id = 'ai-settings-modal';
        this.modal.style.cssText = `
            position: fixed; top: 50px; right: 8px; z-index: 201;
            background: rgba(15, 15, 25, 0.95); border: 1px solid rgba(192, 200, 216, 0.3);
            border-radius: 6px; padding: 16px; width: 320px;
            font-family: monospace; color: #c0c8d8; font-size: 13px;
        `;

        this.modal.innerHTML = `
            <div style="margin-bottom: 12px; font-weight: bold; font-size: 14px;">
                Extiris AI Settings
            </div>
            <label style="display: block; margin-bottom: 4px; font-size: 11px; opacity: 0.7;">
                Anthropic API Key
            </label>
            <input id="ai-api-key-input" type="password"
                placeholder="sk-ant-..."
                style="width: 100%; box-sizing: border-box; padding: 6px 8px;
                    background: rgba(30, 30, 45, 0.8); border: 1px solid rgba(192, 200, 216, 0.2);
                    color: #c0c8d8; font-family: monospace; font-size: 12px;
                    border-radius: 3px; margin-bottom: 8px;"
            />
            <div style="font-size: 10px; opacity: 0.5; margin-bottom: 12px;">
                Your API key is stored locally in your browser. Leave blank for deterministic AI.
            </div>
            <div style="margin-bottom: 12px;">
                <label style="font-size: 12px; cursor: pointer;">
                    <input id="ai-deterministic-toggle" type="checkbox"
                        style="margin-right: 6px;"
                    />
                    Force deterministic AI (ignore API key)
                </label>
            </div>
            <button id="ai-settings-save" style="
                padding: 6px 16px; background: rgba(60, 60, 90, 0.8);
                border: 1px solid rgba(192, 200, 216, 0.3); color: #c0c8d8;
                font-family: monospace; font-size: 12px; cursor: pointer;
                border-radius: 3px; margin-right: 8px;
            ">Save</button>
            <button id="ai-settings-close" style="
                padding: 6px 16px; background: rgba(40, 40, 55, 0.8);
                border: 1px solid rgba(192, 200, 216, 0.2); color: #888;
                font-family: monospace; font-size: 12px; cursor: pointer;
                border-radius: 3px;
            ">Close</button>
        `;

        document.body.appendChild(this.modal);

        // Set values via DOM properties (not innerHTML interpolation) to prevent XSS
        const keyInput = document.getElementById('ai-api-key-input') as HTMLInputElement | null;
        if (keyInput) keyInput.value = savedKey;
        const deterministicToggle = document.getElementById('ai-deterministic-toggle') as HTMLInputElement | null;
        if (deterministicToggle) deterministicToggle.checked = aiService?.useDeterministic ?? true;

        const saveBtn = document.getElementById('ai-settings-save');
        const closeBtn = document.getElementById('ai-settings-close');
        saveBtn?.addEventListener('click', () => this.saveSettings());
        closeBtn?.addEventListener('click', () => this.closeModal());
    }

    private saveSettings(): void {
        const keyInput = document.getElementById('ai-api-key-input') as HTMLInputElement | null;
        const deterministicToggle = document.getElementById('ai-deterministic-toggle') as HTMLInputElement | null;

        const apiKey = keyInput?.value.trim() ?? '';
        const forceDeterministic = deterministicToggle?.checked ?? false;

        // Save to localStorage
        try {
            if (apiKey) {
                localStorage.setItem('extiris-api-key', apiKey);
            } else {
                localStorage.removeItem('extiris-api-key');
            }
            localStorage.setItem('extiris-force-deterministic', forceDeterministic ? 'true' : 'false');
        } catch {
            // localStorage not available
        }

        // Configure AI service
        try {
            const aiService = ServiceLocator.get<AIService>('aiService');
            if (forceDeterministic) {
                aiService.configure({ apiKey: '' });
            } else {
                aiService.configure({ apiKey });
            }
        } catch {
            // No AI service
        }

        this.closeModal();
    }

    private closeModal(): void {
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }
    }

    private getSavedKey(): string {
        try {
            return localStorage.getItem('extiris-api-key') ?? '';
        } catch {
            return '';
        }
    }

    destroy(): void {
        if (this.gearBtn && this.onGearClick) {
            this.gearBtn.removeEventListener('click', this.onGearClick);
        }
        this.gearBtn?.remove();
        this.closeModal();
    }
}
