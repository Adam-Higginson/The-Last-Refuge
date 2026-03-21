// EngineRepairComponent.ts — Lifecycle component that manages ship engine repair.
// Subscribes to TURN_ADVANCE to count down repair turns.
// Requires station_repaired flag before repair can begin.
// On completion, removes OrbitComponent to restore ship mobility.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { EngineStateComponent } from './EngineStateComponent';
import { EventStateComponent } from './EventStateComponent';
import { ResourceComponent } from './ResourceComponent';
import { OrbitComponent } from './OrbitComponent';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { World } from '../core/World';

export class EngineRepairComponent extends Component {
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
        const engineState = this.entity.getComponent(EngineStateComponent);
        if (!engineState || engineState.engineState !== 'offline') return false;

        let world: World;
        try {
            world = ServiceLocator.get<World>('world');
        } catch {
            return false;
        }

        const gameState = world.getEntityByName('gameState');
        const eventState = gameState?.getComponent(EventStateComponent);
        if (!eventState?.hasFlag('station_repaired')) return false;

        const resources = gameState?.getComponent(ResourceComponent);
        if (!resources) return false;

        if (!resources.canAfford('materials', engineState.repairCost)) return false;

        resources.deduct('materials', engineState.repairCost);
        engineState.engineState = 'repairing';

        this.eventQueue?.emit({ type: GameEvents.ENGINE_REPAIR_STARTED });
        return true;
    }

    private onTurnAdvance(): void {
        const engineState = this.entity.getComponent(EngineStateComponent);
        if (!engineState || engineState.engineState !== 'repairing') return;

        engineState.repairTurnsRemaining--;

        if (engineState.repairTurnsRemaining <= 0) {
            engineState.repairTurnsRemaining = 0;
            engineState.engineState = 'online';

            // Set flag on EventStateComponent
            let world: World;
            try {
                world = ServiceLocator.get<World>('world');
            } catch {
                return;
            }

            const gameState = world.getEntityByName('gameState');
            const eventState = gameState?.getComponent(EventStateComponent);
            eventState?.addFlag('engine_repaired');

            // Remove OrbitComponent — ship is no longer locked in orbit
            this.entity.removeComponent(OrbitComponent);

            this.eventQueue?.emit({ type: GameEvents.ENGINE_REPAIRED });
        }
    }

    destroy(): void {
        if (this.eventQueue && this.turnHandler) {
            this.eventQueue.off(GameEvents.TURN_ADVANCE, this.turnHandler);
        }
    }
}
