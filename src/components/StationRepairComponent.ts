// StationRepairComponent.ts — Lifecycle component that manages station repair.
// Subscribes to TURN_ADVANCE to count down repair turns.
// Follows ColonyBuildingComponent pattern: subscribe in init(), unsubscribe in destroy().

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { CrewMemberComponent } from './CrewMemberComponent';
import { ScoutDataComponent } from './ScoutDataComponent';
import { StationDataComponent } from './StationDataComponent';
import { EventStateComponent } from './EventStateComponent';
import { ResourceComponent } from './ResourceComponent';
import { TransformComponent } from './TransformComponent';
import { VisibilitySourceComponent } from './VisibilitySourceComponent';
import {
    STATION_FOG_DETAIL_RADIUS,
    STATION_FOG_BLIP_RADIUS,
} from '../data/constants';
import { getCrewAtScout } from '../utils/crewUtils';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { World } from '../core/World';

export class StationRepairComponent extends Component {
    private eventQueue: EventQueue | null = null;
    private turnHandler: EventHandler | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');

        this.turnHandler = (): void => {
            this.onTurnAdvance();
        };
        this.eventQueue.on(GameEvents.TURN_ADVANCE, this.turnHandler);
    }

    /** Start repair. Returns true if successful. */
    startRepair(): boolean {
        const stationData = this.entity.getComponent(StationDataComponent);
        if (!stationData || stationData.repairState !== 'discovered') return false;

        let world: World;
        try {
            world = ServiceLocator.get<World>('world');
        } catch {
            return false;
        }

        const gameState = world.getEntityByName('gameState');
        const resources = gameState?.getComponent(ResourceComponent);
        if (!resources) return false;

        if (!resources.canAfford('materials', stationData.repairCost)) return false;

        if (!this.hasEngineerNearby()) return false;

        resources.deduct('materials', stationData.repairCost);
        stationData.repairState = 'repairing';

        this.eventQueue?.emit({ type: GameEvents.STATION_REPAIR_STARTED });
        return true;
    }

    private hasEngineerNearby(): boolean {
        let world: World;
        try {
            world = ServiceLocator.get<World>('world');
        } catch {
            return false;
        }

        const stationTransform = this.entity.getComponent(TransformComponent);
        if (!stationTransform) return false;

        const sources = world.getEntitiesWithComponent(VisibilitySourceComponent);
        for (const sourceEntity of sources) {
            const vis = sourceEntity.getComponent(VisibilitySourceComponent);
            const sourceTransform = sourceEntity.getComponent(TransformComponent);
            if (!vis || !sourceTransform || !vis.active) continue;

            const dx = sourceTransform.x - stationTransform.x;
            const dy = sourceTransform.y - stationTransform.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= vis.effectiveDetailRadius) {
                // Check if this source is a scout with an engineer
                const scoutData = sourceEntity.getComponent(ScoutDataComponent);
                if (scoutData) {
                    const crew = getCrewAtScout(world, sourceEntity.id);
                    for (const crewEntity of crew) {
                        const member = crewEntity.getComponent(CrewMemberComponent);
                        if (member && member.role === 'Engineer') return true;
                    }
                }
            }
        }
        return false;
    }

    private onTurnAdvance(): void {
        const stationData = this.entity.getComponent(StationDataComponent);
        if (!stationData || stationData.repairState !== 'repairing') return;

        // Pause repair if no engineer nearby
        if (!this.hasEngineerNearby()) return;

        stationData.repairTurnsRemaining--;

        if (stationData.repairTurnsRemaining <= 0) {
            stationData.repairTurnsRemaining = 0;
            stationData.repairState = 'repaired';

            // Set flag on EventStateComponent
            let world: World;
            try {
                world = ServiceLocator.get<World>('world');
            } catch {
                return;
            }

            const gameState = world.getEntityByName('gameState');
            const eventState = gameState?.getComponent(EventStateComponent);
            eventState?.addFlag('station_repaired');

            // Add visibility source — station becomes a sensor outpost
            this.entity.addComponent(
                new VisibilitySourceComponent(STATION_FOG_DETAIL_RADIUS, STATION_FOG_BLIP_RADIUS, false),
            );

            this.eventQueue?.emit({ type: GameEvents.STATION_REPAIRED });
        }
    }

    destroy(): void {
        if (this.eventQueue && this.turnHandler) {
            this.eventQueue.off(GameEvents.TURN_ADVANCE, this.turnHandler);
        }
    }
}
