// ColoniseUIComponent.ts — Colonisation button and confirmation modal.
// Lives on the planet entity. When in planet view, shows a COLONISE button
// if a colonisable region is selected and the ship is within range.
// Confirm establishes the colony and emits COLONISE_CONFIRM.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { GameModeComponent } from './GameModeComponent';
import { RegionDataComponent } from './RegionDataComponent';
import { PlanetViewInputComponent } from './PlanetViewInputComponent';
import { TransformComponent } from './TransformComponent';
import type { EventQueue } from '../core/EventQueue';
import { COLONISE_RANGE } from '../data/constants';
import type { World } from '../core/World';

export class ColoniseUIComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private world: World | null = null;
    private coloniseBtn: HTMLElement | null = null;
    private modal: HTMLElement | null = null;
    private modalBiome: HTMLElement | null = null;
    private modalConfirm: HTMLElement | null = null;
    private modalCancel: HTMLElement | null = null;
    private pendingRegionId: number | null = null;
    private onColoniseBtnClick: (() => void) | null = null;
    private onConfirmClick: (() => void) | null = null;
    private onCancelClick: (() => void) | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        this.world = ServiceLocator.get<World>('world');

        this.coloniseBtn = document.getElementById('colonise-btn');
        this.modal = document.getElementById('colonise-modal');
        this.modalBiome = document.getElementById('colonise-modal-biome');
        this.modalConfirm = document.getElementById('colonise-modal-confirm');
        this.modalCancel = document.getElementById('colonise-modal-cancel');

        // COLONISE button → open confirmation modal
        this.onColoniseBtnClick = (): void => {
            const inputComp = this.entity.getComponent(PlanetViewInputComponent);
            if (!inputComp) return;
            const regionData = this.entity.getComponent(RegionDataComponent);
            if (!regionData) return;

            const region = regionData.regions.find(r => r.id === inputComp.selectedRegionId);
            if (!region || !region.canColonise || region.colonised) return;

            this.pendingRegionId = region.id;
            if (this.modalBiome) {
                this.modalBiome.textContent = region.biome.toUpperCase();
            }
            if (this.modal) {
                this.modal.style.display = 'flex';
            }
        };
        this.coloniseBtn?.addEventListener('click', this.onColoniseBtnClick);

        // Confirm colonisation
        this.onConfirmClick = (): void => {
            if (this.pendingRegionId === null) return;
            const regionData = this.entity.getComponent(RegionDataComponent);
            if (!regionData) return;

            const region = regionData.regions.find(r => r.id === this.pendingRegionId);
            if (region) {
                region.colonised = true;
                regionData.colonised = true;
                this.eventQueue?.emit({
                    type: GameEvents.COLONISE_CONFIRM,
                    regionId: region.id,
                    biome: region.biome,
                });
            }

            this.pendingRegionId = null;
            if (this.modal) this.modal.style.display = 'none';
        };
        this.modalConfirm?.addEventListener('click', this.onConfirmClick);

        // Cancel — close modal
        this.onCancelClick = (): void => {
            this.pendingRegionId = null;
            if (this.modal) this.modal.style.display = 'none';
        };
        this.modalCancel?.addEventListener('click', this.onCancelClick);
    }

    update(_dt: number): void {
        const gameMode = this.getGameMode();
        if (!gameMode || gameMode.mode !== 'planet') {
            if (this.coloniseBtn) this.coloniseBtn.style.display = 'none';
            if (this.modal) this.modal.style.display = 'none';
            this.pendingRegionId = null;
            return;
        }

        // Don't toggle button while modal is open
        if (this.modal && this.modal.style.display === 'flex') return;

        // Check if ship is in range of planet
        if (!this.isShipInRange()) {
            if (this.coloniseBtn) this.coloniseBtn.style.display = 'none';
            return;
        }

        // Check if selected region is colonisable and not yet colonised
        const inputComp = this.entity.getComponent(PlanetViewInputComponent);
        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!inputComp || !regionData) {
            if (this.coloniseBtn) this.coloniseBtn.style.display = 'none';
            return;
        }

        const selectedRegion = regionData.regions.find(r => r.id === inputComp.selectedRegionId);
        if (selectedRegion && selectedRegion.canColonise && !selectedRegion.colonised) {
            if (this.coloniseBtn) this.coloniseBtn.style.display = 'block';
        } else {
            if (this.coloniseBtn) this.coloniseBtn.style.display = 'none';
        }
    }

    private isShipInRange(): boolean {
        if (!this.world) return false;

        const ship = this.world.getEntityByName('arkSalvage');
        if (!ship) return false;

        const shipTransform = ship.getComponent(TransformComponent);
        const planetTransform = this.entity.getComponent(TransformComponent);
        if (!shipTransform || !planetTransform) return false;

        const dx = shipTransform.x - planetTransform.x;
        const dy = shipTransform.y - planetTransform.y;
        return Math.sqrt(dx * dx + dy * dy) <= COLONISE_RANGE;
    }

    private getGameMode(): GameModeComponent | null {
        if (!this.world) return null;
        const gameState = this.world.getEntityByName('gameState');
        return gameState?.getComponent(GameModeComponent) ?? null;
    }

    destroy(): void {
        if (this.onColoniseBtnClick && this.coloniseBtn) {
            this.coloniseBtn.removeEventListener('click', this.onColoniseBtnClick);
        }
        if (this.onConfirmClick && this.modalConfirm) {
            this.modalConfirm.removeEventListener('click', this.onConfirmClick);
        }
        if (this.onCancelClick && this.modalCancel) {
            this.modalCancel.removeEventListener('click', this.onCancelClick);
        }
    }
}
