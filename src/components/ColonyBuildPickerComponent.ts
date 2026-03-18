// ColonyBuildPickerComponent.ts — Build picker popup for colony view.
// Opens when an empty slot is clicked (selectedSlotIndex on state component).
// Shows available buildings on empty slot, building info on occupied slot.

import './ColonyBuildPickerComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameModeComponent } from './GameModeComponent';
import { RegionDataComponent } from './RegionDataComponent';
import { ColonySceneStateComponent } from './ColonySceneStateComponent';
import { ColonyBuildingComponent } from './ColonyBuildingComponent';
import { ColonySimulationComponent } from './ColonySimulationComponent';
import { ResourceComponent } from './ResourceComponent';
import { spawnDustBurst } from '../rendering/colonyParticles';
import { gridToScreen, getGridCentre } from '../rendering/isometric';
import { getAvailableBuildings, getBuildingType } from '../data/buildings';
import { getColonyLocations } from '../utils/crewUtils';
import type { BuildingId } from '../data/buildings';
import type { ConfirmModal } from '../ui/ConfirmModal';
import type { World } from '../core/World';

export class ColonyBuildPickerComponent extends Component {
    private picker: HTMLElement | null = null;
    private lastSelectedSlot: number | null = null;
    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private onDocClick: ((e: MouseEvent) => void) | null = null;

    init(): void {
        this.picker = document.getElementById('colony-build-picker');

        // Escape closes picker
        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Escape' && this.picker?.classList.contains('open')) {
                e.stopPropagation();
                this.closePicker();
            }
        };
        window.addEventListener('keydown', this.onKeyDown, true);

        // Click outside closes picker
        this.onDocClick = (e: MouseEvent): void => {
            if (this.picker?.classList.contains('open') && !this.picker.contains(e.target as Node)) {
                this.closePicker();
            }
        };
        // Delay adding doc click to avoid immediate close
        setTimeout(() => {
            document.addEventListener('click', this.onDocClick as EventListener);
        }, 0);
    }

    update(_dt: number): void {
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const gameMode = gameState?.getComponent(GameModeComponent);

        if (!gameMode || gameMode.mode !== 'colony' || gameMode.planetEntityId !== this.entity.id) {
            this.closePicker();
            this.lastSelectedSlot = null;
            return;
        }

        const state = this.entity.getComponent(ColonySceneStateComponent);
        if (!state) return;

        // Detect selection changes
        if (state.selectedSlotIndex !== this.lastSelectedSlot) {
            this.lastSelectedSlot = state.selectedSlotIndex;
            if (state.selectedSlotIndex !== null) {
                this.openPicker(state.selectedSlotIndex, gameMode);
            } else {
                this.closePicker();
            }
        }
    }

    private openPicker(slotIndex: number, gameMode: GameModeComponent): void {
        if (!this.picker) return;

        const regionId = gameMode.colonyRegionId;
        if (regionId === null) return;

        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!regionData) return;

        const region = regionData.regions.find(r => r.id === regionId);
        if (!region) return;

        const building = region.buildings.find(b => b.slotIndex === slotIndex);
        if (building) {
            this.showBuildingInfo(building, regionId);
        } else {
            this.showBuildMenu(region, regionId, slotIndex);
        }

        this.picker.classList.add('open');
    }

    private showBuildMenu(
        region: { buildings: { typeId: string; slotIndex: number; state: string; turnsRemaining: number }[]; buildingSlots: number },
        regionId: number,
        _slotIndex: number,
    ): void {
        if (!this.picker) return;

        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const resources = gameState?.getComponent(ResourceComponent);
        const colonyCount = getColonyLocations(world).length;
        const available = getAvailableBuildings(colonyCount);

        const buildingsHTML = available.map(bt => {
            const canAfford = resources ? resources.canAfford('materials', bt.materialCost) : false;
            const disabled = !canAfford;
            const tierLabel = bt.tier === 2 ? 'TIER 2' : '';

            return `
                <div class="build-picker-item ${disabled ? 'build-picker-item--disabled' : ''}" data-building-id="${bt.id}">
                    <div class="build-picker-item-name">${bt.name} ${tierLabel ? `<span class="build-picker-item-tier">${tierLabel}</span>` : ''}</div>
                    <div class="build-picker-item-desc">${bt.description}</div>
                    <div class="build-picker-item-cost">
                        <span class="build-picker-cost-mat">MAT ${bt.materialCost}</span>
                        <span class="build-picker-cost-time">${bt.buildTime}T</span>
                        ${bt.energyPerTurn > 0 ? `<span class="build-picker-cost-energy">-${bt.energyPerTurn}E/T</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        this.picker.innerHTML = `
            <button class="build-picker-close" id="build-picker-close">&times;</button>
            <div class="build-picker-title">BUILD</div>
            <div class="build-picker-slots">Slots: ${region.buildings.length} / ${region.buildingSlots}</div>
            ${buildingsHTML}
        `;

        this.picker.querySelector('#build-picker-close')?.addEventListener('click', () => {
            this.closePicker();
        });

        for (const item of this.picker.querySelectorAll('.build-picker-item:not(.build-picker-item--disabled)')) {
            item.addEventListener('click', () => {
                const buildingId = (item as HTMLElement).dataset.buildingId as BuildingId;
                this.confirmBuild(buildingId, regionId);
            });
        }
    }

    private showBuildingInfo(
        building: { typeId: string; slotIndex: number; state: string; turnsRemaining: number },
        regionId: number,
    ): void {
        if (!this.picker) return;

        const bt = getBuildingType(building.typeId as BuildingId);
        const statusLabel = building.state === 'constructing'
            ? `CONSTRUCTING (${building.turnsRemaining} turns remaining)`
            : building.state.toUpperCase();
        const statusClass = building.state === 'active' ? 'colony-sidebar-building-status--active' : 'colony-sidebar-building-status--constructing';

        // Find workers assigned to this building
        const sim = this.entity.getComponent(ColonySimulationComponent);
        const workers: { name: string; role: string; activity: string }[] = [];
        if (sim) {
            for (const [_id, colonist] of sim.colonistStates) {
                if (colonist.assignedBuildingSlot === building.slotIndex) {
                    workers.push({ name: colonist.name, role: colonist.role, activity: colonist.activity });
                }
            }
        }

        const workersHTML = workers.length > 0
            ? `<div class="build-picker-workers">
                <div class="build-picker-workers-title">ASSIGNED CREW (${workers.length})</div>
                ${workers.map(w => `<div class="build-picker-worker"><span class="build-picker-worker-name">${w.name}</span> <span class="build-picker-worker-role">${w.role}</span></div>`).join('')}
            </div>`
            : building.state === 'active'
                ? '<div class="build-picker-workers"><div class="build-picker-workers-title">NO ASSIGNED CREW</div></div>'
                : '';

        this.picker.innerHTML = `
            <button class="build-picker-close" id="build-picker-close">&times;</button>
            <div class="build-picker-info">
                <div class="build-picker-info-name">${bt.name}</div>
                <div class="build-picker-info-desc">${bt.description}</div>
                <div class="build-picker-info-status ${statusClass}">${statusLabel}</div>
                ${workersHTML}
                ${building.state !== 'constructing' ? `<button class="build-picker-demolish" id="build-picker-demolish">DEMOLISH</button>` : ''}
            </div>
        `;

        this.picker.querySelector('#build-picker-close')?.addEventListener('click', () => {
            this.closePicker();
        });

        this.picker.querySelector('#build-picker-demolish')?.addEventListener('click', async () => {
            const modal = ServiceLocator.get<ConfirmModal>('confirmModal');
            const proceed = await modal.show({
                title: 'DEMOLISH BUILDING',
                body: `Demolish ${bt.name}?`,
                danger: true,
            });
            if (!proceed) return;
            if (!this.entity) return;
            const buildingComp = this.entity.getComponent(ColonyBuildingComponent);
            if (buildingComp) {
                buildingComp.demolish(regionId, building.slotIndex);
            }
            this.closePicker();
        });
    }

    private async confirmBuild(buildingId: BuildingId, regionId: number): Promise<void> {
        const bt = getBuildingType(buildingId);
        const modal = ServiceLocator.get<ConfirmModal>('confirmModal');
        const proceed = await modal.show({
            title: 'BUILD',
            body: `Build ${bt.name}?\n\nCost: ${bt.materialCost} Materials\nTime: ${bt.buildTime} turn(s)\n${bt.energyPerTurn > 0 ? `Energy: -${bt.energyPerTurn}/turn\n` : ''}${bt.description}`,
        });
        if (!proceed) return;
        if (!this.entity) return;

        const buildingComp = this.entity.getComponent(ColonyBuildingComponent);
        if (buildingComp) {
            const success = buildingComp.startConstruction(regionId, buildingId);
            if (success) {
                // Dust burst at the new building's position
                const regionData = this.entity.getComponent(RegionDataComponent);
                const state = this.entity.getComponent(ColonySceneStateComponent);
                if (regionData && state) {
                    const region = regionData.regions.find(r => r.id === regionId);
                    if (region) {
                        const vt = state.viewTransform;
                        const gridCentre = getGridCentre(vt.groundCentreX, vt.groundCentreY);

                        // Use ColonySimulationComponent grid if available
                        const sim = this.entity.getComponent(ColonySimulationComponent);
                        const newBuilding = region.buildings[region.buildings.length - 1];
                        if (newBuilding && sim) {
                            const center = sim.grid.getBuildingCenter(newBuilding.slotIndex);
                            if (center) {
                                const pos = gridToScreen(center.gridX, center.gridY, gridCentre.centreX, gridCentre.centreY);
                                spawnDustBurst(state, pos.x, pos.y + 15);
                            }
                        }
                    }
                }
            }
        }
        this.closePicker();
    }

    private closePicker(): void {
        if (this.picker) {
            this.picker.classList.remove('open');
        }
        const state = this.entity.getComponent(ColonySceneStateComponent);
        if (state) {
            state.selectedSlotIndex = null;
        }
        this.lastSelectedSlot = null;
    }

    destroy(): void {
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown, true);
        }
        if (this.onDocClick) {
            document.removeEventListener('click', this.onDocClick as EventListener);
        }
        this.closePicker();
    }
}
