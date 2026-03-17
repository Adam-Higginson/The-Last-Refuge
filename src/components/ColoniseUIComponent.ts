// ColoniseUIComponent.ts — Colonisation button and confirmation modal.
// Lives on the planet entity. When in planet view, shows a COLONISE button
// if a colonisable region is selected and the ship is within range.
// Confirm establishes the colony and emits COLONISE_CONFIRM.

import './ColoniseUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { GameModeComponent } from './GameModeComponent';
import { RegionDataComponent } from './RegionDataComponent';
import { PlanetViewInputComponent } from './PlanetViewInputComponent';
import { TransformComponent } from './TransformComponent';
import { TransferScreenComponent } from './TransferScreenComponent';
import { ColonyBuildingComponent } from './ColonyBuildingComponent';
import { BUILDING_SLOTS_BY_BIOME, DEFAULT_BUILDING_SLOTS } from '../data/buildings';
import { CrewMemberComponent } from './CrewMemberComponent';
import type { EventQueue } from '../core/EventQueue';
import { FOG_DETAIL_RADIUS } from '../data/constants';
import type { World } from '../core/World';

/** Fisher-Yates in-place shuffle. */
function shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export class ColoniseUIComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private world: World | null = null;
    private coloniseBtn: HTMLElement | null = null;
    private modal: HTMLElement | null = null;
    private modalBiome: HTMLElement | null = null;
    private modalConfirm: HTMLElement | null = null;
    private modalCancel: HTMLElement | null = null;
    private colonyRosterBtn: HTMLElement | null = null;
    private colonyViewBtn: HTMLElement | null = null;
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

        // COLONISE button → open confirmation modal (guarded by disabled state)
        this.onColoniseBtnClick = (): void => {
            if (this.coloniseBtn?.classList.contains('disabled')) return;
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

                // Assign building slots based on biome
                region.buildingSlots = (BUILDING_SLOTS_BY_BIOME as Record<string, number>)[region.biome] ?? DEFAULT_BUILDING_SLOTS;

                // Auto-create starter Shelter via building system
                const buildingComp = this.entity.getComponent(ColonyBuildingComponent);
                if (buildingComp) {
                    buildingComp.addCompletedBuilding(region.id, 'shelter');
                }

                // Auto-transfer starter crew to the new colony
                const world = ServiceLocator.get<World>('world');
                const shipCrew = world.getEntitiesWithComponent(CrewMemberComponent).filter(e => {
                    const c = e.getComponent(CrewMemberComponent);
                    return c?.location.type === 'ship';
                });
                shuffleArray(shipCrew);
                const starterCount = Math.min(5, shipCrew.length);
                const colonyLoc = { type: 'colony' as const, planetEntityId: this.entity.id, regionId: region.id };
                for (let i = 0; i < starterCount; i++) {
                    const c = shipCrew[i].getComponent(CrewMemberComponent);
                    if (c) c.location = { ...colonyLoc };
                }

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

        // VIEW COLONY button — enters colony scene
        this.colonyViewBtn = document.getElementById('colony-view-btn');
        this.colonyViewBtn?.addEventListener('click', () => {
            const inputComp = this.entity.getComponent(PlanetViewInputComponent);
            if (!inputComp || !this.eventQueue) return;
            this.eventQueue.emit({
                type: GameEvents.COLONY_VIEW_ENTER,
                entityId: this.entity.id,
                regionId: inputComp.selectedRegionId,
            });
        });

        // Colony roster button — opens transfer screen for the selected colony
        this.colonyRosterBtn = document.getElementById('colony-roster-btn');
        this.colonyRosterBtn?.addEventListener('click', () => {
            const inputComp = this.entity.getComponent(PlanetViewInputComponent);
            const regionData = this.entity.getComponent(RegionDataComponent);
            if (!inputComp || !this.world || !regionData) return;

            // Verify region is actually colonised
            const region = regionData.regions.find(r => r.id === inputComp.selectedRegionId);
            if (!region?.colonised) return;

            const hud = this.world.getEntityByName('hud');
            const transferScreen = hud?.getComponent(TransferScreenComponent);
            if (transferScreen && !transferScreen.isOpen) {
                transferScreen.open({
                    type: 'colony',
                    planetEntityId: this.entity.id,
                    regionId: inputComp.selectedRegionId,
                });
            }
        });
    }

    update(_dt: number): void {
        const gameMode = this.getGameMode();

        // Colony mode — hide planet-level UI (sidebar handles colony buttons)
        if (gameMode?.mode === 'colony') {
            if (this.coloniseBtn) this.coloniseBtn.style.display = 'none';
            if (this.colonyRosterBtn) this.colonyRosterBtn.style.display = 'none';
            if (this.colonyViewBtn) this.colonyViewBtn.style.display = 'none';
            return;
        }

        if (!gameMode || gameMode.mode !== 'planet') {
            if (this.coloniseBtn) this.coloniseBtn.style.display = 'none';
            if (this.colonyRosterBtn) this.colonyRosterBtn.style.display = 'none';
            if (this.colonyViewBtn) this.colonyViewBtn.style.display = 'none';
            if (this.modal) this.modal.style.display = 'none';
            this.pendingRegionId = null;
            return;
        }

        // Don't toggle button while modal is open
        if (this.modal && this.modal.style.display === 'flex') return;

        // Check selected region
        const inputComp = this.entity.getComponent(PlanetViewInputComponent);
        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!inputComp || !regionData) {
            if (this.coloniseBtn) this.coloniseBtn.style.display = 'none';
            if (this.colonyRosterBtn) this.colonyRosterBtn.style.display = 'none';
            if (this.colonyViewBtn) this.colonyViewBtn.style.display = 'none';
            return;
        }

        const selectedRegion = regionData.regions.find(r => r.id === inputComp.selectedRegionId);

        if (selectedRegion && selectedRegion.colonised) {
            // Colonised region — show roster + view colony, hide colonise
            if (this.coloniseBtn) this.coloniseBtn.style.display = 'none';
            if (this.colonyRosterBtn) this.colonyRosterBtn.style.display = 'block';
            if (this.colonyViewBtn) this.colonyViewBtn.style.display = 'block';
        } else if (selectedRegion && selectedRegion.canColonise && !selectedRegion.colonised) {
            // Colonisable region — show colonise button, hide roster + view
            if (this.colonyRosterBtn) this.colonyRosterBtn.style.display = 'none';
            if (this.colonyViewBtn) this.colonyViewBtn.style.display = 'none';
            if (this.coloniseBtn) {
                this.coloniseBtn.style.display = 'block';
                if (this.isShipInRange()) {
                    this.coloniseBtn.classList.remove('disabled');
                    this.coloniseBtn.title = '';
                } else {
                    this.coloniseBtn.classList.add('disabled');
                    this.coloniseBtn.title = 'Ship with crew needs to be in range to set up a colony';
                }
            }
        } else {
            if (this.coloniseBtn) this.coloniseBtn.style.display = 'none';
            if (this.colonyRosterBtn) this.colonyRosterBtn.style.display = 'none';
            if (this.colonyViewBtn) this.colonyViewBtn.style.display = 'none';
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
        return Math.sqrt(dx * dx + dy * dy) <= FOG_DETAIL_RADIUS;
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
