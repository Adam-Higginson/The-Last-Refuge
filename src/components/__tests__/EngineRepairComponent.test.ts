import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { EngineStateComponent } from '../EngineStateComponent';
import { EngineRepairComponent } from '../EngineRepairComponent';
import { EventStateComponent } from '../EventStateComponent';
import { ResourceComponent } from '../ResourceComponent';
import { OrbitComponent } from '../OrbitComponent';
import { TransformComponent } from '../TransformComponent';
import { ENGINE_REPAIR_TURNS } from '../../data/constants';

describe('EngineRepairComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let resources: ResourceComponent;
    let eventState: EventStateComponent;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        // GameState with EventStateComponent and ResourceComponent
        const gameState = world.createEntity('gameState');
        eventState = gameState.addComponent(new EventStateComponent());
        resources = gameState.addComponent(new ResourceComponent());
    });

    function createShip(): {
        entity: import('../../core/Entity').Entity;
        engineState: EngineStateComponent;
        repair: EngineRepairComponent;
    } {
        const entity = world.createEntity('ship');
        const engineState = entity.addComponent(new EngineStateComponent());
        entity.addComponent(new TransformComponent());
        entity.addComponent(new OrbitComponent(0, 0, 1500, 1));
        const repair = entity.addComponent(new EngineRepairComponent());
        repair.init();
        return { entity, engineState, repair };
    }

    it('startRepair returns false if engineState is not offline', () => {
        const { engineState, repair } = createShip();
        eventState.addFlag('station_repaired');
        engineState.engineState = 'repairing';

        expect(repair.startRepair()).toBe(false);
    });

    it('startRepair returns false if station_repaired flag is not set', () => {
        const { repair } = createShip();

        expect(repair.startRepair()).toBe(false);
    });

    it('startRepair returns false if cannot afford materials', () => {
        const { repair } = createShip();
        eventState.addFlag('station_repaired');
        resources.resources.materials.current = 0;

        expect(repair.startRepair()).toBe(false);
    });

    it('startRepair deducts materials and sets state to repairing', () => {
        const { engineState, repair } = createShip();
        eventState.addFlag('station_repaired');
        const initialMaterials = resources.resources.materials.current;

        const result = repair.startRepair();

        expect(result).toBe(true);
        expect(engineState.engineState).toBe('repairing');
        expect(resources.resources.materials.current).toBe(initialMaterials - engineState.repairCost);
    });

    it('startRepair emits ENGINE_REPAIR_STARTED', () => {
        const { repair } = createShip();
        eventState.addFlag('station_repaired');

        const events: unknown[] = [];
        eventQueue.on(GameEvents.ENGINE_REPAIR_STARTED, (e) => events.push(e));

        repair.startRepair();
        eventQueue.drain();

        expect(events).toHaveLength(1);
    });

    it('onTurnAdvance decrements repairTurnsRemaining', () => {
        const { engineState, repair } = createShip();
        eventState.addFlag('station_repaired');
        repair.startRepair();

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        expect(engineState.repairTurnsRemaining).toBe(ENGINE_REPAIR_TURNS - 1);
        expect(engineState.engineState).toBe('repairing');
    });

    it('onTurnAdvance sets state to online when turns reach 0', () => {
        const { engineState, repair } = createShip();
        eventState.addFlag('station_repaired');
        repair.startRepair();

        for (let i = 0; i < ENGINE_REPAIR_TURNS; i++) {
            eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
            eventQueue.drain();
        }

        expect(engineState.engineState).toBe('online');
        expect(engineState.repairTurnsRemaining).toBe(0);
    });

    it('onTurnAdvance sets engine_repaired flag on EventStateComponent', () => {
        const { repair } = createShip();
        eventState.addFlag('station_repaired');
        repair.startRepair();

        for (let i = 0; i < ENGINE_REPAIR_TURNS; i++) {
            eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
            eventQueue.drain();
        }

        expect(eventState.hasFlag('engine_repaired')).toBe(true);
    });

    it('onTurnAdvance removes OrbitComponent from ship on completion', () => {
        const { entity, repair } = createShip();
        eventState.addFlag('station_repaired');
        repair.startRepair();

        // Verify OrbitComponent exists before completion
        expect(entity.getComponent(OrbitComponent)).toBeDefined();

        for (let i = 0; i < ENGINE_REPAIR_TURNS; i++) {
            eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
            eventQueue.drain();
        }

        expect(entity.getComponent(OrbitComponent)).toBeNull();
    });

    it('onTurnAdvance emits ENGINE_REPAIRED on completion', () => {
        const { repair } = createShip();
        eventState.addFlag('station_repaired');
        repair.startRepair();

        const events: unknown[] = [];
        eventQueue.on(GameEvents.ENGINE_REPAIRED, (e) => events.push(e));

        for (let i = 0; i < ENGINE_REPAIR_TURNS; i++) {
            eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
            eventQueue.drain();
        }
        // ENGINE_REPAIRED is emitted during the last drain's handler,
        // so it lands in the next queue — drain again to process it.
        eventQueue.drain();

        expect(events).toHaveLength(1);
    });
});
