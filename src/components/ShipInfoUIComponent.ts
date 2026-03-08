// ShipInfoUIComponent.ts — Ship info panel that slides in from the right.
// Opens on right-click of the ship entity. Shows ship name (renameable),
// lore text, crew count, and a placeholder VIEW MANIFEST button.
// Closes on Escape, clicking elsewhere, or right-clicking the ship again.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import type { EntityRightClickEvent } from '../core/GameEvents';
import type { EventQueue, EventHandler } from '../core/EventQueue';

export class ShipInfoUIComponent extends Component {
    shipName: string;
    panelOpen = false;
    renaming = false;

    private eventQueue: EventQueue | null = null;
    private panel: HTMLElement | null = null;
    private nameEl: HTMLElement | null = null;
    private renameRow: HTMLElement | null = null;
    private renameInput: HTMLInputElement | null = null;

    private entityRightClickHandler: EventHandler | null = null;
    private entityClickHandler: EventHandler | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

    constructor(shipName = 'ESV-7 (Unnamed)') {
        super();
        this.shipName = shipName;
    }

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.panel = document.getElementById('ship-info-panel');
        if (!this.panel) return;

        this.buildPanelHTML();

        // Toggle panel on right-click of this entity
        this.entityRightClickHandler = (event): void => {
            const { entityId } = event as EntityRightClickEvent;
            if (entityId !== this.entity.id) return;

            if (this.panelOpen) {
                this.closePanel();
            } else {
                this.openPanel();
            }
        };

        // Close panel when clicking elsewhere (left-click on empty space or other entity)
        this.entityClickHandler = (): void => {
            if (this.panelOpen && !this.renaming) {
                this.closePanel();
            }
        };

        // Escape: cancel rename or close panel
        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Escape') {
                if (this.renaming) {
                    this.cancelRename();
                } else if (this.panelOpen) {
                    this.closePanel();
                }
            }
        };

        this.eventQueue.on(GameEvents.ENTITY_RIGHT_CLICK, this.entityRightClickHandler);
        this.eventQueue.on(GameEvents.ENTITY_CLICK, this.entityClickHandler);
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
            <div style="margin-top:16px">
                <button class="hud-btn" type="button" disabled>VIEW MANIFEST</button>
            </div>
        `;

        this.nameEl = document.getElementById('ship-name-label');
        this.renameRow = document.getElementById('ship-rename-row');
        this.renameInput = document.getElementById('ship-rename-input') as HTMLInputElement | null;

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
        if (this.eventQueue && this.entityRightClickHandler) {
            this.eventQueue.off(GameEvents.ENTITY_RIGHT_CLICK, this.entityRightClickHandler);
        }
        if (this.eventQueue && this.entityClickHandler) {
            this.eventQueue.off(GameEvents.ENTITY_CLICK, this.entityClickHandler);
        }
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown);
        }
    }
}
