import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { CrewMemberComponent } from '../CrewMemberComponent';
import { ScoutDataComponent } from '../ScoutDataComponent';
import { StationDataComponent } from '../StationDataComponent';
import { StationRepairComponent } from '../StationRepairComponent';
import { EventStateComponent } from '../EventStateComponent';
import { ResourceComponent } from '../ResourceComponent';
import { TransformComponent } from '../TransformComponent';
import { VisibilitySourceComponent } from '../VisibilitySourceComponent';
import { STATION_REPAIR_TURNS, SCOUT_FOG_DETAIL_RADIUS, SCOUT_FOG_BLIP_RADIUS } from '../../data/constants';

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

    function createStation(x = 100, y = 100): {
        entity: import('../../core/Entity').Entity;
        data: StationDataComponent;
        repair: StationRepairComponent;
    } {
        const entity = world.createEntity('kethRelay');
        entity.addComponent(new TransformComponent(x, y));
        const data = entity.addComponent(new StationDataComponent());
        const repair = entity.addComponent(new StationRepairComponent());
        repair.init();
        return { entity, data, repair };
    }

    /** Create a scout entity near the station with a VisibilitySourceComponent and an engineer crew member. */
    function createScoutWithEngineer(x = 100, y = 100): {
        scoutEntity: import('../../core/Entity').Entity;
        engineerEntity: import('../../core/Entity').Entity;
    } {
        const scoutEntity = world.createEntity('scout1');
        scoutEntity.addComponent(new TransformComponent(x, y));
        scoutEntity.addComponent(new ScoutDataComponent('Scout Alpha', 0, 'Pilot'));
        const vis = new VisibilitySourceComponent(SCOUT_FOG_DETAIL_RADIUS, SCOUT_FOG_BLIP_RADIUS, true);
        scoutEntity.addComponent(vis);

        const engineerEntity = world.createEntity('engineer');
        const crew = new CrewMemberComponent('Jane Doe', 30, 'Engineer', 80, ['Determined', 'Analytical'], 'An engineer.');
        crew.location = { type: 'scout', scoutEntityId: scoutEntity.id };
        engineerEntity.addComponent(crew);

        return { scoutEntity, engineerEntity };
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
        createScoutWithEngineer();
        const initialMaterials = resources.resources.materials.current;

        const result = repair.startRepair();

        expect(result).toBe(true);
        expect(data.repairState).toBe('repairing');
        expect(resources.resources.materials.current).toBe(initialMaterials - data.repairCost);
    });

    it('emits STATION_REPAIR_STARTED event', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        createScoutWithEngineer();

        const events: unknown[] = [];
        eventQueue.on(GameEvents.STATION_REPAIR_STARTED, (e) => events.push(e));

        repair.startRepair();
        eventQueue.drain();

        expect(events).toHaveLength(1);
    });

    it('turn advance decrements repair counter', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        createScoutWithEngineer();
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
        createScoutWithEngineer();
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
        createScoutWithEngineer();
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
        createScoutWithEngineer();
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
        createScoutWithEngineer();
        const initialMaterials = resources.resources.materials.current;

        repair.startRepair();
        repair.startRepair(); // Second call should fail

        // Materials only deducted once
        expect(resources.resources.materials.current).toBe(initialMaterials - data.repairCost);
    });

    it('turn advances after repair complete are no-ops', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        createScoutWithEngineer();
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

    it('startRepair fails when no engineer nearby', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        // No scout with engineer created

        const result = repair.startRepair();

        expect(result).toBe(false);
        expect(data.repairState).toBe('discovered');
    });

    it('startRepair succeeds when engineer is on nearby scout', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        createScoutWithEngineer(); // Same position as station

        const result = repair.startRepair();

        expect(result).toBe(true);
        expect(data.repairState).toBe('repairing');
    });

    it('startRepair fails when scout with engineer is too far away', () => {
        const { data, repair } = createStation(100, 100);
        data.repairState = 'discovered';
        // Place scout far away from station
        createScoutWithEngineer(100 + SCOUT_FOG_DETAIL_RADIUS + 100, 100);

        const result = repair.startRepair();

        expect(result).toBe(false);
        expect(data.repairState).toBe('discovered');
    });

    it('onTurnAdvance pauses when engineer leaves', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        const { engineerEntity } = createScoutWithEngineer();
        repair.startRepair();

        // Advance one turn with engineer present
        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();
        expect(data.repairTurnsRemaining).toBe(STATION_REPAIR_TURNS - 1);

        // Move engineer away (back to ship)
        const crew = engineerEntity.getComponent(CrewMemberComponent);
        if (crew) crew.location = { type: 'ship' };

        // Advance another turn — should NOT decrement
        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();
        expect(data.repairTurnsRemaining).toBe(STATION_REPAIR_TURNS - 1);
    });

    it('onTurnAdvance resumes when engineer returns', () => {
        const { data, repair } = createStation();
        data.repairState = 'discovered';
        const { scoutEntity, engineerEntity } = createScoutWithEngineer();
        repair.startRepair();

        // Move engineer away
        const crew = engineerEntity.getComponent(CrewMemberComponent);
        if (crew) crew.location = { type: 'ship' };

        // Turn should not decrement
        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();
        expect(data.repairTurnsRemaining).toBe(STATION_REPAIR_TURNS);

        // Return engineer to scout
        if (crew) crew.location = { type: 'scout', scoutEntityId: scoutEntity.id };

        // Turn should decrement again
        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();
        expect(data.repairTurnsRemaining).toBe(STATION_REPAIR_TURNS - 1);
    });
});
