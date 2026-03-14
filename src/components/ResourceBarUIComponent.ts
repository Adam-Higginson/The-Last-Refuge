// ResourceBarUIComponent.ts — Top HUD bar displaying resource amounts and rates.
// Lives on the HUD entity. Reads ResourceComponent from the gameState entity.

import './ResourceBarUIComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { ResourceComponent } from './ResourceComponent';
import { RESOURCE_TYPES, RESOURCE_CONFIGS } from '../data/resources';
import type { ResourceType } from '../data/resources';
import type { World } from '../core/World';

export class ResourceBarUIComponent extends Component {
    private container: HTMLElement | null = null;
    private valueEls: Record<ResourceType, HTMLElement | null> = {
        food: null,
        materials: null,
        energy: null,
    };
    private rateEls: Record<ResourceType, HTMLElement | null> = {
        food: null,
        materials: null,
        energy: null,
    };

    init(): void {
        this.container = document.getElementById('hud-resource-bar');
        if (!this.container) return;

        const colourClasses: Record<ResourceType, string> = {
            food: 'food',
            materials: 'materials',
            energy: 'energy',
        };

        this.container.innerHTML = RESOURCE_TYPES.map(type => {
            const config = RESOURCE_CONFIGS[type];
            const cls = colourClasses[type];
            return `
                <div class="resource-item">
                    <span class="resource-icon resource-icon--${cls}">${config.icon}</span>
                    <span class="resource-value" id="resource-val-${type}">0</span>
                    <span class="resource-cap" id="resource-cap-${type}">/ 0</span>
                    <span class="resource-rate resource-rate--zero" id="resource-rate-${type}">+0</span>
                </div>
            `;
        }).join('');

        for (const type of RESOURCE_TYPES) {
            this.valueEls[type] = document.getElementById(`resource-val-${type}`);
            this.rateEls[type] = document.getElementById(`resource-rate-${type}`);
        }
    }

    update(_dt: number): void {
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const res = gameState?.getComponent(ResourceComponent);
        if (!res) return;

        for (const type of RESOURCE_TYPES) {
            const state = res.resources[type];
            const net = res.getNetRate(type);

            const valEl = this.valueEls[type];
            if (valEl) {
                valEl.textContent = `${Math.floor(state.current)}`;
            }

            const capEl = document.getElementById(`resource-cap-${type}`);
            if (capEl) {
                capEl.textContent = `/ ${state.cap}`;
            }

            const rateEl = this.rateEls[type];
            if (rateEl) {
                const sign = net >= 0 ? '+' : '';
                rateEl.textContent = `${sign}${Math.round(net)}`;
                rateEl.className = 'resource-rate';
                if (net > 0) rateEl.classList.add('resource-rate--positive');
                else if (net < 0) rateEl.classList.add('resource-rate--negative');
                else rateEl.classList.add('resource-rate--zero');
            }
        }
    }
}
