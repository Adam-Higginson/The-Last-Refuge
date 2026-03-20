import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { StationDataComponent } from '../StationDataComponent';
import { StationRepairComponent } from '../StationRepairComponent';
import { EventStateComponent } from '../EventStateComponent';
import { ResourceComponent } from '../ResourceComponent';
import { VisibilitySourceComponent } from '../VisibilitySourceComponent';
import { STATION_REPAIR_TURNS } from '../../data/constants';

describe('StationRepairComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let resources: ResourceComponent;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        // GameState with EventStateComponent and ResourceComponent
        const gameState = world.createEntity('gameState');
        gameState.addComponent(new EventStateComponent());
        resources = gameState.addComponent(new ResourceComponent());
    });

    function createStation(): {
        entity: import('../../core/Entity').Entity;
        data: StationDataComponent;
        repair: StationRepairComponent;
    } {
        const entity = world.createEntity('kethRelay');
        const data = entity.addComponent(new StationDataComponent());
        const repair = entity.addComponent(new StationRepairComponent());
        repair.init();
        return { entity, data, repair };
    }

    it('cannot start repair when undiscovered', () => {
        const { repair } = createStation();

        const result = repair.startRepair();

        expect(result).toBe(false);
    });

    it('cannot start repair without sufficient materials', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        resources.resources.materials.current = 10; // Not enough (need 40)

        const result = repair.startRepair();

        expect(result).toBe(false);
        expect(data.repairState).toBe('discovered');
    });

    it('startRepair() deducts materials and sets state to repairing', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        const initialMaterials = resources.resources.materials.current;

        const result = repair.startRepair();

        expect(result).toBe(true);
        expect(data.repairState).toBe('repairing');
        expect(resources.resources.materials.current).toBe(initialMaterials - data.repairCost);
    });

    it('emits STATION_REPAIR_STARTED event', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';

        const events: unknown[] = [];
        eventQueue.on(GameEvents.STATION_REPAIR_STARTED, (e) => events.push(e));

        repair.startRepair();
        eventQueue.drain();

        expect(events).toHaveLength(1);
    });

    it('turn advance decrements repair counter', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        repair.startRepair();

        // Simulate a turn advance
        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        expect(data.repairTurnsRemaining).toBe(STATION_REPAIR_TURNS - 1);
        expect(data.repairState).toBe('repairing');
    });

    it('completion sets repairState to repaired and sets flag', () => {
        const { entity, data, repair } = createStation();
        data.repairState = 'discovered';
        repair.startRepair();

        // Advance all turns
        for (let i = 0; i < STATION_REPAIR_TURNS; i++) {
            eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
            eventQueue.drain();
        }

        expect(data.repairState).toBe('repaired');
        expect(data.repairTurnsRemaining).toBe(0);

        const gameState = world.getEntityByName('gameState');
        const eventState = gameState?.getComponent(EventStateComponent);
        expect(eventState?.hasFlag('station_repaired')).toBe(true);

        // Station should now have a VisibilitySourceComponent
        const vis = entity.getComponent(VisibilitySourceComponent);
        expect(vis).toBeDefined();
    });

    it('emits STATION_REPAIRED event on completion', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        repair.startRepair();

        const events: unknown[] = [];
        eventQueue.on(GameEvents.STATION_REPAIRED, (e) => events.push(e));

        for (let i = 0; i < STATION_REPAIR_TURNS; i++) {
            eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
            eventQueue.drain();
        }
        // STATION_REPAIRED is emitted during the last drain's handler,
        // so it lands in the next queue — drain again to process it.
        eventQueue.drain();

        expect(events).toHaveLength(1);
    });

    it('cannot repair when already repairing', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        repair.startRepair();

        const result = repair.startRepair();

        expect(result).toBe(false);
    });

    it('cannot repair when already repaired', () => {
        const { data, repair } = createStation();
        data.repairState = 'repaired';

        const result = repair.startRepair();

        expect(result).toBe(false);
    });

    it('double-call to startRepair() is idempotent', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        const initialMaterials = resources.resources.materials.current;

        repair.startRepair();
        repair.startRepair(); // Second call should fail

        // Materials only deducted once
        expect(resources.resources.materials.current).toBe(initialMaterials - data.repairCost);
    });

    it('turn advances after repair complete are no-ops', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        repair.startRepair();

        // Complete repair
        for (let i = 0; i < STATION_REPAIR_TURNS; i++) {
            eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
            eventQueue.drain();
        }
        // Drain the completion event
        eventQueue.drain();

        const events: unknown[] = [];
        eventQueue.on(GameEvents.STATION_REPAIRED, (e) => events.push(e));

        // Extra turns
        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();
        eventQueue.drain();

        expect(events).toHaveLength(0);
        expect(data.repairTurnsRemaining).toBe(0);
    });
});
