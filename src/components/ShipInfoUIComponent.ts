// ShipInfoUIComponent.ts — Ship info panel that slides in from the right.
// Opens when the ship is selected (left-click), closes on deselection.
// Shows ship overview with crew count, range, and buttons to open the
// crew roster (TransferScreenComponent) or centre camera on ship.

import './ShipInfoUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { SelectableComponent } from './SelectableComponent';
import { MovementComponent } from './MovementComponent';
import { TransformComponent } from './TransformComponent';
import { CameraComponent } from './CameraComponent';
import { TransferScreenComponent } from './TransferScreenComponent';
import { RelationshipGraphComponent } from './RelationshipGraphComponent';
import { EngineStateComponent } from './EngineStateComponent';
import { EngineRepairComponent } from './EngineRepairComponent';
import { EventStateComponent } from './EventStateComponent';
import { ResourceComponent } from './ResourceComponent';
import { getCrewCounts, hasEngineerOnShip } from '../utils/crewUtils';
import type { ConfirmModal } from '../ui/ConfirmModal';
import type { World } from '../core/World';

export type PanelView = 'overview' | 'manifest' | 'detail';

export class ShipInfoUIComponent extends Component {
    shipName: string;
    panelOpen = false;
    renaming = false;

    /** Which sub-view is currently active. Read by sibling components. */
    activeView: PanelView = 'overview';
    /** Entity ID of the selected crew member for detail view. */
    selectedCrewEntityId: number | null = null;

    private panel: HTMLElement | null = null;
    private nameEl: HTMLElement | null = null;
    private renameRow: HTMLElement | null = null;
    private renameInput: HTMLInputElement | null = null;
    private rangeFill: HTMLElement | null = null;
    private rangeText: HTMLElement | null = null;
    private overviewSection: HTMLElement | null = null;

    private lastEngineState: string | null = null;
    private lastRepairTurns = -1;
    private lastStationRepaired = false;
    private lastHasEngineerOnShip = false;

    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;

    constructor(shipName = 'ESV-7 (Unnamed)') {
        super();
        this.shipName = shipName;
    }

    init(): void {
        this.panel = document.getElementById('ship-info-panel');
        if (!this.panel) return;

        this.buildPanelHTML();

        // Escape: navigate back through view stack or cancel rename
        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Escape') {
                if (this.renaming) {
                    this.cancelRename();
                } else if (this.activeView === 'detail') {
                    this.activeView = 'manifest';
                    this.selectedCrewEntityId = null;
                } else if (this.activeView === 'manifest') {
                    this.activeView = 'overview';
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

        const engineStatusSection = this.buildEngineStatusSection();
        const engineData = this.entity.getComponent(EngineStateComponent);
        const engineOnline = !engineData || engineData.engineState === 'online';

        this.panel.innerHTML = `
            <button class="panel-close-btn" id="ship-panel-close" type="button" title="Close">&times;</button>
            <div class="view-section active" id="ship-overview-section">
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
                <div class="crew-count" id="ship-crew-count">
                    <span class="crew-dot"></span>
                </div>
                ${engineStatusSection}
                ${engineOnline ? `
                <div class="ship-range-section">
                    <span class="ship-range-label">RANGE</span>
                    <div class="ship-range-bar"><div class="ship-range-fill" id="ship-range-fill"></div></div>
                    <span class="ship-range-text" id="ship-range-text">300 / 300</span>
                </div>
                ` : ''}
                <div style="margin-top:16px; display:flex; flex-direction:column; gap:8px">
                    <button class="hud-btn" id="ship-crew-roster-btn" type="button">CREW ROSTER</button>
                    <button class="hud-btn" id="ship-relationships-btn" type="button">RELATIONSHIPS</button>
                    <button class="hud-btn" id="ship-centre-btn" type="button">CENTRE ON SHIP</button>
                </div>
            </div>
            <div class="view-section" id="crew-manifest-section"></div>
            <div class="view-section" id="crew-detail-section"></div>
        `;

        this.overviewSection = document.getElementById('ship-overview-section');
        this.nameEl = document.getElementById('ship-name-label');
        this.renameRow = document.getElementById('ship-rename-row');
        this.renameInput = document.getElementById('ship-rename-input') as HTMLInputElement | null;
        this.rangeFill = document.getElementById('ship-range-fill');
        this.rangeText = document.getElementById('ship-range-text');

        if (this.nameEl) {
            this.nameEl.textContent = this.shipName;
        }

        // Close button
        const closeBtn = document.getElementById('ship-panel-close');
        closeBtn?.addEventListener('click', () => {
            const selectable = this.entity.getComponent(SelectableComponent);
            if (selectable) {
                selectable.selected = false;
            }
        });

        // CREW ROSTER button — opens transfer screen (on the HUD entity)
        const crewRosterBtn = document.getElementById('ship-crew-roster-btn');
        crewRosterBtn?.addEventListener('click', () => {
            const world = ServiceLocator.get<World>('world');
            const hud = world.getEntityByName('hud');
            const transferScreen = hud?.getComponent(TransferScreenComponent);
            if (transferScreen && !transferScreen.isOpen) {
                transferScreen.open();
            }
        });

        // RELATIONSHIPS button — opens relationship graph
        const relBtn = document.getElementById('ship-relationships-btn');
        relBtn?.addEventListener('click', () => {
            const world = ServiceLocator.get<World>('world');
            const hud = world.getEntityByName('hud');
            const graph = hud?.getComponent(RelationshipGraphComponent);
            if (graph && !graph.isOpen) {
                graph.open();
            }
        });

        // CENTRE ON SHIP button
        const centreBtn = document.getElementById('ship-centre-btn');
        centreBtn?.addEventListener('click', () => {
            const world = ServiceLocator.get<World>('world');
            const shipTransform = this.entity.getComponent(TransformComponent);
            const cameraEntity = world.getEntityByName('camera');
            const camera = cameraEntity?.getComponent(CameraComponent);
            if (shipTransform && camera) {
                camera.panTo(shipTransform.x, shipTransform.y);
            }
        });

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

        // Engine repair button
        this.panel.querySelector('#engine-repair-btn')?.addEventListener('click', () => {
            const repair = this.entity.getComponent(EngineRepairComponent);
            const engineData = this.entity.getComponent(EngineStateComponent);
            if (!repair || !engineData) return;
            try {
                const confirmModal = ServiceLocator.get<ConfirmModal>('confirmModal');
                void confirmModal.show({
                    title: 'Begin Engine Repair',
                    body: `Repair the ESV-7's drive core?\n\nCost: ${engineData.repairCost} Materials\nTime: ${engineData.repairTurnsTotal} turns`,
                    confirmLabel: 'Begin Repairs',
                    cancelLabel: 'Cancel',
                }).then((confirmed) => {
                    if (confirmed) repair.startRepair();
                });
            } catch {
                repair.startRepair();
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

        // Manage overview section visibility
        if (this.overviewSection) {
            if (this.activeView === 'overview') {
                this.overviewSection.classList.add('active');
            } else {
                this.overviewSection.classList.remove('active');
            }
        }

        // Toggle wide class for manifest/detail views
        if (this.panel) {
            if (this.activeView !== 'overview') {
                this.panel.classList.add('wide');
            } else {
                this.panel.classList.remove('wide');
            }
        }

        // Detect engine state changes and rebuild panel when needed
        if (this.panelOpen && this.activeView === 'overview') {
            const engineData = this.entity.getComponent(EngineStateComponent);
            if (engineData) {
                // Check if station_repaired flag changed (unlocks repair button)
                let stationRepaired = false;
                try {
                    const world = ServiceLocator.get<World>('world');
                    const gameState = world.getEntityByName('gameState');
                    const eventState = gameState?.getComponent(EventStateComponent);
                    stationRepaired = eventState?.hasFlag('station_repaired') ?? false;
                } catch { /* ignore */ }

                let engineerOnShip = false;
                try {
                    const w = ServiceLocator.get<World>('world');
                    engineerOnShip = hasEngineerOnShip(w);
                } catch { /* ignore */ }

                const stateChanged = this.lastEngineState !== engineData.engineState;
                const turnsChanged = this.lastRepairTurns !== engineData.repairTurnsRemaining;
                const stationChanged = this.lastStationRepaired !== stationRepaired;
                const engineerChanged = this.lastHasEngineerOnShip !== engineerOnShip;
                if (stateChanged || turnsChanged || stationChanged || engineerChanged) {
                    this.lastEngineState = engineData.engineState;
                    this.lastRepairTurns = engineData.repairTurnsRemaining;
                    this.lastStationRepaired = stationRepaired;
                    this.lastHasEngineerOnShip = engineerOnShip;
                    this.buildPanelHTML();
                }
            }
        }

        // Update range display and crew count when panel is open and on overview
        if (this.panelOpen && this.activeView === 'overview') {
            const engineData = this.entity.getComponent(EngineStateComponent);
            const engineOnline = !engineData || engineData.engineState === 'online';

            if (engineOnline) {
                const movement = this.entity.getComponent(MovementComponent);
                if (movement) {
                    this.updateRangeDisplay(movement.budgetRemaining, movement.budgetMax);
                }
            }

            const crewCountEl = document.getElementById('ship-crew-count');
            if (crewCountEl) {
                const world = ServiceLocator.get<World>('world');
                const counts = getCrewCounts(world);
                crewCountEl.innerHTML = `<span class="crew-dot"></span>${counts.ship} SOULS ABOARD`;
            }
        }
    }

    private buildEngineStatusSection(): string {
        const engineData = this.entity.getComponent(EngineStateComponent);
        if (!engineData) return '';

        if (engineData.engineState === 'offline') {
            let world: World;
            try {
                world = ServiceLocator.get<World>('world');
            } catch {
                return '';
            }

            const gameState = world.getEntityByName('gameState');
            const eventState = gameState?.getComponent(EventStateComponent);
            const stationRepaired = eventState?.hasFlag('station_repaired') ?? false;

            if (!stationRepaired) {
                return `
                    <hr class="divider">
                    <div style="color: #c66; font-weight: bold; margin-bottom: 4px;">&#9888; ENGINES OFFLINE</div>
                    <div class="lore-text">Repair the Keth relay to begin diagnostics</div>
                `;
            }

            // Station is repaired — show repair controls
            const resources = gameState?.getComponent(ResourceComponent);
            const canAfford = resources?.canAfford('materials', engineData.repairCost) ?? false;
            const engineerPresent = hasEngineerOnShip(world);
            const canRepair = canAfford && engineerPresent;

            let hint = '';
            if (!engineerPresent) {
                hint = 'Assign an engineer to the ship';
            } else if (!canAfford) {
                hint = `Need ${engineData.repairCost} materials`;
            }

            return `
                <hr class="divider">
                <div style="color: #ca6; font-weight: bold; margin-bottom: 8px;">ENGINE REPAIR</div>
                <div class="station-panel-stat" style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>COST</span>
                    <span>${engineData.repairCost} Materials</span>
                </div>
                <div class="station-panel-stat" style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span>TIME</span>
                    <span>${engineData.repairTurnsTotal} turns</span>
                </div>
                <button class="hud-btn" id="engine-repair-btn" type="button"
                    ${canRepair ? '' : 'disabled'}>BEGIN ENGINE REPAIR</button>
                ${hint ? `<div class="station-repair-hint" style="color: #886; font-size: 11px; margin-top: 4px;">${hint}</div>` : ''}
            `;
        }

        if (engineData.engineState === 'repairing') {
            const done = engineData.repairTurnsTotal - engineData.repairTurnsRemaining;
            const pct = (done / engineData.repairTurnsTotal) * 100;

            let world2: World | null = null;
            try {
                world2 = ServiceLocator.get<World>('world');
            } catch { /* ignore */ }
            const engineerPresent = world2 ? hasEngineerOnShip(world2) : false;

            return `
                <hr class="divider">
                <div style="color: #ca6; font-weight: bold; margin-bottom: 8px;">ENGINE REPAIR</div>
                ${!engineerPresent ? '<div style="color: #c86; font-weight: bold; margin-bottom: 6px;">&#9888; REPAIR PAUSED &mdash; No engineer aboard</div>' : ''}
                <div class="station-panel-progress">
                    <div class="station-progress-bar">
                        <div class="station-progress-fill" style="width: ${pct}%"></div>
                    </div>
                    <div class="station-progress-label">${done} / ${engineData.repairTurnsTotal} TURNS</div>
                </div>
            `;
        }

        if (engineData.engineState === 'online') {
            return `
                <hr class="divider">
                <div style="color: #6a6;">&#9679; ENGINES OPERATIONAL</div>
            `;
        }

        return '';
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
        this.activeView = 'overview';
        this.selectedCrewEntityId = null;
        this.panel?.classList.remove('open');
        this.panel?.classList.remove('wide');
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
