// ShipInfoUIComponent.ts — Ship info panel that slides in from the right.
// Opens when the ship is selected (left-click), closes on deselection.
// Shows ship name (renameable), lore text, crew count, movement range bar,
// and a placeholder VIEW MANIFEST button.

import { Component } from '../core/Component';
import { SelectableComponent } from './SelectableComponent';
import { MovementComponent } from './MovementComponent';

export class ShipInfoUIComponent extends Component {
    shipName: string;
    panelOpen = false;
    renaming = false;

    private panel: HTMLElement | null = null;
    private nameEl: HTMLElement | null = null;
    private renameRow: HTMLElement | null = null;
    private renameInput: HTMLInputElement | null = null;
    private rangeFill: HTMLElement | null = null;
    private rangeText: HTMLElement | null = null;

    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

    constructor(shipName = 'ESV-7 (Unnamed)') {
        super();
        this.shipName = shipName;
    }

    init(): void {
        this.panel = document.getElementById('ship-info-panel');
        if (!this.panel) return;

        this.buildPanelHTML();

        // Escape: cancel rename or deselect ship (which closes panel on next update)
        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Escape') {
                if (this.renaming) {
                    this.cancelRename();
                } else {
                    const selectable = this.entity.getComponent(SelectableComponent);
                    if (selectable) {
                        selectable.selected = false;
                    }
                }
            }
        };

        window.addEventListener('keydown', this.onKeyDown);
    }

    private buildPanelHTML(): void {
        if (!this.panel) return;

        this.panel.innerHTML = `
            <div class="ship-name-row">
                <span class="ship-name" id="ship-name-label"></span>
                <button class="rename-btn" id="ship-rename-btn" type="button" title="Rename ship">&#9998;</button>
            </div>
            <div class="ship-name-row" id="ship-rename-row" style="display:none">
                <input class="rename-input" id="ship-rename-input" type="text" maxlength="30">
                <button class="rename-ok" id="ship-rename-ok" type="button">OK</button>
            </div>
            <hr class="divider">
            <div class="lore-text">
                Extiris Slaver Vessel, designation unknown.
                Captured during the Keth-7 exodus.
            </div>
            <div class="crew-count">
                <span class="crew-dot"></span>50 SOULS ABOARD
            </div>
            <div class="ship-range-section">
                <span class="ship-range-label">RANGE</span>
                <div class="ship-range-bar"><div class="ship-range-fill" id="ship-range-fill"></div></div>
                <span class="ship-range-text" id="ship-range-text">300 / 300</span>
            </div>
            <div style="margin-top:16px">
                <button class="hud-btn" type="button" disabled>VIEW MANIFEST</button>
            </div>
        `;

        this.nameEl = document.getElementById('ship-name-label');
        this.renameRow = document.getElementById('ship-rename-row');
        this.renameInput = document.getElementById('ship-rename-input') as HTMLInputElement | null;
        this.rangeFill = document.getElementById('ship-range-fill');
        this.rangeText = document.getElementById('ship-range-text');

        if (this.nameEl) {
            this.nameEl.textContent = this.shipName;
        }

        // Rename button click
        const renameBtn = document.getElementById('ship-rename-btn');
        renameBtn?.addEventListener('click', () => {
            this.enterRenameMode();
        });

        // Rename OK button
        const renameOk = document.getElementById('ship-rename-ok');
        renameOk?.addEventListener('click', () => {
            this.confirmRename();
        });

        // Rename input Enter key
        this.renameInput?.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.code === 'Enter') {
                e.preventDefault();
                this.confirmRename();
            }
            if (e.code === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                this.cancelRename();
            }
        });
    }

    update(_dt: number): void {
        const selectable = this.entity.getComponent(SelectableComponent);
        const selected = selectable?.selected ?? false;

        // Sync panel visibility with selection state
        if (selected && !this.panelOpen) {
            this.openPanel();
        } else if (!selected && this.panelOpen) {
            this.closePanel();
        }

        // Update range display when panel is open
        if (this.panelOpen) {
            const movement = this.entity.getComponent(MovementComponent);
            if (movement) {
                this.updateRangeDisplay(movement.budgetRemaining, movement.budgetMax);
            }
        }
    }

    private openPanel(): void {
        this.panelOpen = true;
        this.panel?.classList.add('open');
    }

    private closePanel(): void {
        if (this.renaming) {
            this.cancelRename();
        }
        this.panelOpen = false;
        this.panel?.classList.remove('open');
    }

    private updateRangeDisplay(remaining: number, max: number): void {
        const ratio = max > 0 ? remaining / max : 0;

        if (this.rangeFill) {
            this.rangeFill.style.width = `${ratio * 100}%`;
            this.rangeFill.style.background = this.getRangeColour(ratio);
        }

        if (this.rangeText) {
            this.rangeText.textContent = `${Math.round(remaining)} / ${Math.round(max)}`;
        }
    }

    private getRangeColour(ratio: number): string {
        if (ratio > 0.5) return '#44cc66';
        if (ratio > 0.25) return '#ccaa44';
        return '#cc4444';
    }

    private enterRenameMode(): void {
        this.renaming = true;
        if (this.nameEl) this.nameEl.style.display = 'none';
        const renameBtn = document.getElementById('ship-rename-btn');
        if (renameBtn) renameBtn.style.display = 'none';
        if (this.renameRow) this.renameRow.style.display = 'flex';
        if (this.renameInput) {
            this.renameInput.value = this.shipName;
            this.renameInput.focus();
            this.renameInput.select();
        }
    }

    private confirmRename(): void {
        const newName = this.renameInput?.value.trim();
        if (newName && newName.length > 0) {
            this.shipName = newName;
            if (this.nameEl) {
                this.nameEl.textContent = this.shipName;
            }
        }
        this.exitRenameMode();
    }

    private cancelRename(): void {
        this.exitRenameMode();
    }

    private exitRenameMode(): void {
        this.renaming = false;
        if (this.nameEl) this.nameEl.style.display = '';
        const renameBtn = document.getElementById('ship-rename-btn');
        if (renameBtn) renameBtn.style.display = '';
        if (this.renameRow) this.renameRow.style.display = 'none';
    }

    destroy(): void {
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown);
        }
    }
}
