// StationDiscoveryComponent.ts — Lifecycle component that detects when
// a visibility source's blip radius covers the station, triggering discovery.
// Follows ScoutDestructionComponent pattern: per-frame distance check, try/catch.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { TransformComponent } from './TransformComponent';
import { VisibilitySourceComponent } from './VisibilitySourceComponent';
import { StationDataComponent } from './StationDataComponent';
import { EventStateComponent } from './EventStateComponent';
import { CameraComponent } from './CameraComponent';
import type { World } from '../core/World';

export class StationDiscoveryComponent extends Component {
    private fired = false;

    update(_dt: number): void {
        if (this.fired) return;

        let world: World;
        try {
            world = ServiceLocator.get<World>('world');
        } catch {
            return;
        }

        const stationTransform = this.entity.getComponent(TransformComponent);
        const stationData = this.entity.getComponent(StationDataComponent);
        if (!stationTransform || !stationData) return;

        // Check distance to every entity with a visibility source
        const sources = world.getEntitiesWithComponent(VisibilitySourceComponent);
        for (const sourceEntity of sources) {
            const vis = sourceEntity.getComponent(VisibilitySourceComponent);
            const sourceTransform = sourceEntity.getComponent(TransformComponent);
            if (!vis || !sourceTransform || !vis.active) continue;

            const dx = sourceTransform.x - stationTransform.x;
            const dy = sourceTransform.y - stationTransform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= vis.effectiveBlipRadius) {
                this.triggerDiscovery(world, stationData, stationTransform);
                return;
            }
        }
    }

    private triggerDiscovery(
        world: World,
        stationData: StationDataComponent,
        stationTransform: TransformComponent,
    ): void {
        this.fired = true;
        stationData.discovered = true;
        stationData.repairState = 'discovered';

        // Set flag on EventStateComponent
        const gameState = world.getEntityByName('gameState');
        const eventState = gameState?.getComponent(EventStateComponent);
        eventState?.addFlag('station_discovered');

        // Emit discovery event
        const eventQueue = ServiceLocator.get<import('../core/EventQueue').EventQueue>('eventQueue');
        eventQueue.emit({ type: GameEvents.STATION_DISCOVERED });

        // Camera auto-pan to station
        const cameraEntity = world.getEntityByName('camera');
        const camera = cameraEntity?.getComponent(CameraComponent);
        if (camera) {
            camera.panTo(stationTransform.x, stationTransform.y);
        }
    }
}
