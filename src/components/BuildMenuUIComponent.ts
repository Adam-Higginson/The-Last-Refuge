// BuildMenuUIComponent.ts — Build menu for colony buildings in planet view.
// Shows available buildings when a colonised region with open slots is selected.
// Lives on the planet entity.

import './BuildMenuUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameModeComponent } from './GameModeComponent';
import { RegionDataComponent } from './RegionDataComponent';
import { PlanetViewInputComponent } from './PlanetViewInputComponent';
import { ColonyBuildingComponent } from './ColonyBuildingComponent';
import { ResourceComponent } from './ResourceComponent';
import { getAvailableBuildings, getBuildingType } from '../data/buildings';
import { spawnDustBurst } from '../rendering/colonyParticles';
import { gridToScreen, getSlotGridPositions } from '../rendering/isometric';
import { getColonyLocations } from '../utils/crewUtils';
import type { BuildingId } from '../data/buildings';
import type { World } from '../core/World';

export class BuildMenuUIComponent extends Component {
    private buildBtn: HTMLElement | null = null;
    private buildMenu: HTMLElement | null = null;
    private menuOpen = false;

    init(): void {
        this.buildBtn = document.getElementById('build-btn');
        this.buildMenu = document.getElementById('build-menu');

        this.buildBtn?.addEventListener('click', () => {
            if (this.menuOpen) {
                this.closeMenu();
            } else {
                this.openMenu();
            }
        });
    }

    update(_dt: number): void {
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const gameMode = gameState?.getComponent(GameModeComponent);

        if (!gameMode || gameMode.mode !== 'planet') {
            this.hideAll();
            return;
        }

        // Only show for the currently viewed planet
        if (gameMode.planetEntityId !== this.entity.id) {
            this.hideAll();
            return;
        }

        const inputComp = this.entity.getComponent(PlanetViewInputComponent);
        const regionData = this.entity.getComponent(RegionDataComponent);
        if (!inputComp || !regionData) {
            this.hideAll();
            return;
        }

        const selectedRegion = regionData.regions.find(r => r.id === inputComp.selectedRegionId);

        if (selectedRegion && selectedRegion.colonised && selectedRegion.buildings.length < selectedRegion.buildingSlots) {
            if (this.buildBtn) this.buildBtn.style.display = 'block';
        } else {
            this.hideAll();
        }
    }

    private openMenu(): void {
        if (!this.buildMenu) return;
        this.menuOpen = true;
        this.rebuildMenu();
        this.buildMenu.style.display = 'block';
    }

    private closeMenu(): void {
        if (!this.buildMenu) return;
        this.menuOpen = false;
        this.buildMenu.style.display = 'none';
    }

    private hideAll(): void {
        if (this.buildBtn) this.buildBtn.style.display = 'none';
        this.closeMenu();
    }

    private rebuildMenu(): void {
        if (!this.buildMenu) return;

        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const resources = gameState?.getComponent(ResourceComponent);
        const regionData = this.entity.getComponent(RegionDataComponent);
        const inputComp = this.entity.getComponent(PlanetViewInputComponent);

        if (!resources || !regionData || !inputComp) return;

        const region = regionData.regions.find(r => r.id === inputComp.selectedRegionId);
        if (!region) return;

        const colonyCount = getColonyLocations(world).length;
        const available = getAvailableBuildings(colonyCount);
        const slotsUsed = region.buildings.length;
        const slotsTotal = region.buildingSlots;

        // Existing buildings
        const existingHTML = region.buildings.length > 0
            ? `<div class="build-existing">
                <div class="build-existing-title">EXISTING BUILDINGS</div>
                ${region.buildings.map(b => {
                    const bt = getBuildingType(b.typeId);
                    const statusClass = b.state === 'active' ? 'active' : 'constructing';
                    const statusLabel = b.state === 'constructing'
                        ? `BUILDING (${b.turnsRemaining} turns)`
                        : b.state.toUpperCase();
                    return `<div class="build-existing-item">
                        <span>${bt.name}</span>
                        <span class="build-existing-status--${statusClass}">${statusLabel}</span>
                    </div>`;
                }).join('')}
            </div>` : '';

        // Available buildings to construct
        const buildingsHTML = available.map(bt => {
            const canAfford = resources.canAfford('materials', bt.materialCost);
            const disabled = !canAfford;
            const tierLabel = bt.tier === 2 ? 'TIER 2' : '';

            return `
                <div class="build-item ${disabled ? 'build-item--disabled' : ''}" data-building-id="${bt.id}">
                    <div class="build-item-name">${bt.name} ${tierLabel ? `<span class="build-item-tier">${tierLabel}</span>` : ''}</div>
                    <div class="build-item-desc">${bt.description}</div>
                    <div class="build-item-cost">
                        <span class="build-cost-mat">⛏ ${bt.materialCost}</span>
                        <span class="build-cost-time">🕐 ${bt.buildTime} turn${bt.buildTime > 1 ? 's' : ''}</span>
                        ${bt.energyPerTurn > 0 ? `<span class="build-cost-energy">⚡ -${bt.energyPerTurn}/turn</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        this.buildMenu.innerHTML = `
            <button class="build-close" id="build-menu-close">&times;</button>
            <div class="build-menu-title">BUILD</div>
            <div class="build-menu-slots">Slots: ${slotsUsed} / ${slotsTotal}</div>
            ${existingHTML}
            ${buildingsHTML}
        `;

        // Wire events
        this.buildMenu.querySelector('#build-menu-close')?.addEventListener('click', () => {
            this.closeMenu();
        });

        for (const item of this.buildMenu.querySelectorAll('.build-item:not(.build-item--disabled)')) {
            item.addEventListener('click', () => {
                const buildingId = (item as HTMLElement).dataset.buildingId as BuildingId;
                this.confirmBuild(buildingId, region.id);
            });
        }
    }

    private confirmBuild(buildingId: BuildingId, regionId: number): void {
        const bt = getBuildingType(buildingId);
        const proceed = confirm(`Build ${bt.name}?\n\nCost: ${bt.materialCost} Materials\nTime: ${bt.buildTime} turn(s)\n${bt.energyPerTurn > 0 ? `Energy: -${bt.energyPerTurn}/turn\n` : ''}${bt.description}`);
        if (!proceed) return;

        const buildingComp = this.entity.getComponent(ColonyBuildingComponent);
        if (buildingComp) {
            const success = buildingComp.startConstruction(regionId, buildingId);
            if (success) {
                // Dust burst at the new building's position
                const regionData = this.entity.getComponent(RegionDataComponent);
                if (regionData) {
                    const region = regionData.regions.find(r => r.id === regionId);
                    if (region) {
                        const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
                        const cw = canvas.width;
                        const ch = canvas.height;
                        const horizonY = ch * 0.35;
                        const centreX = cw / 2;
                        const centreY = horizonY + (ch - horizonY) * 0.35;
                        const gridPos = getSlotGridPositions(region.buildingSlots);
                        const newBuilding = region.buildings[region.buildings.length - 1];
                        if (newBuilding && gridPos[newBuilding.slotIndex]) {
                            const pos = gridToScreen(
                                gridPos[newBuilding.slotIndex].gridX,
                                gridPos[newBuilding.slotIndex].gridY,
                                centreX,
                                centreY,
                            );
                            spawnDustBurst(pos.x, pos.y + 15);
                        }
                    }
                }
                this.rebuildMenu();
            }
        }
    }
}
