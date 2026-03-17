import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { GameEvents } from '../../core/GameEvents';
import { ServiceLocator } from '../../core/ServiceLocator';
import { ColonySimulationComponent } from '../ColonySimulationComponent';
import { RegionDataComponent } from '../RegionDataComponent';
import { CrewMemberComponent } from '../CrewMemberComponent';
import type { Region } from '../RegionDataComponent';
import type { CrewTransferredEvent } from '../../core/GameEvents';

// ---------------------------------------------------------------------------
// Minimal window/document mock (Node has no DOM)
// ---------------------------------------------------------------------------

const origWindow = (globalThis as Record<string, unknown>).window;
const origDocument = globalThis.document;

function installMocks(): void {
    (globalThis as Record<string, unknown>).window = {
        addEventListener: (): void => { /* no-op */ },
        removeEventListener: (): void => { /* no-op */ },
    };
    (globalThis as Record<string, unknown>).document = {
        getElementById: (): null => null,
    };
}

function uninstallMocks(): void {
    (globalThis as Record<string, unknown>).window = origWindow;
    (globalThis as Record<string, unknown>).document = origDocument;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeColonyRegion(id: number): Region {
    return {
        id,
        biome: 'Temperate Plains',
        colour: '#8bc34a',
        canColonise: true,
        colonised: true,
        isLandingZone: false,
        vertices: [],
        buildings: [
            { typeId: 'shelter', slotIndex: 0, state: 'active', turnsRemaining: 0, modifierIds: [] },
        ],
        buildingSlots: 6,
    } as Region;
}

function addCrewAtColony(
    world: World, planetEntityId: number, regionId: number, name: string,
): { entityId: number } {
    const e = world.createEntity(name);
    const crew = e.addComponent(new CrewMemberComponent(name, 30, 'Civilian', 70, ['Empathetic', 'Analytical'], 'Test backstory'));
    crew.location = { type: 'colony', planetEntityId, regionId };
    return { entityId: e.id };
}

describe('ColonySimulationComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let sim: ColonySimulationComponent;
    let planetEntityId: number;
    const regionId = 1;

    beforeEach(() => {
        installMocks();
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        // Create planet entity with region data + simulation
        const planet = world.createEntity('testPlanet');
        planetEntityId = planet.id;
        const regionData = planet.addComponent(new RegionDataComponent());
        regionData.regions = [makeColonyRegion(regionId)];
        regionData.colonised = true;

        sim = planet.addComponent(new ColonySimulationComponent());
        sim.init();
    });

    afterEach(() => {
        uninstallMocks();
    });

    describe('refreshColonists', () => {
        it('adds new crew to colonistStates', () => {
            addCrewAtColony(world, planetEntityId, regionId, 'Alice');
            addCrewAtColony(world, planetEntityId, regionId, 'Bob');
            sim.initForRegion(regionId);
            expect(sim.colonistStates.size).toBe(2);

            const { entityId } = addCrewAtColony(world, planetEntityId, regionId, 'Charlie');
            sim.refreshColonists();

            expect(sim.colonistStates.size).toBe(3);
            expect(sim.colonistStates.has(entityId)).toBe(true);
        });

        it('removes departed crew from colonistStates', () => {
            const { entityId: aliceId } = addCrewAtColony(world, planetEntityId, regionId, 'Alice');
            addCrewAtColony(world, planetEntityId, regionId, 'Bob');
            sim.initForRegion(regionId);
            expect(sim.colonistStates.size).toBe(2);

            const alice = world.getEntity(aliceId);
            const crew = alice?.getComponent(CrewMemberComponent);
            if (crew) crew.location = { type: 'ship' };

            sim.refreshColonists();

            expect(sim.colonistStates.size).toBe(1);
            expect(sim.colonistStates.has(aliceId)).toBe(false);
        });

        it('preserves existing states untouched', () => {
            addCrewAtColony(world, planetEntityId, regionId, 'Alice');
            sim.initForRegion(regionId);

            const states = [...sim.colonistStates.values()];
            const aliceState = states[0];
            aliceState.gridX = 7;
            aliceState.gridY = 3;
            aliceState.activity = 'working';

            addCrewAtColony(world, planetEntityId, regionId, 'Bob');
            sim.refreshColonists();

            expect(aliceState.gridX).toBe(7);
            expect(aliceState.gridY).toBe(3);
            expect(aliceState.activity).toBe('working');
            expect(sim.colonistStates.size).toBe(2);
        });
    });

    describe('CREW_TRANSFERRED handler', () => {
        it('skips when sim not initialized', () => {
            addCrewAtColony(world, planetEntityId, regionId, 'Alice');

            eventQueue.emit({
                type: GameEvents.CREW_TRANSFERRED,
                count: 1,
                destination: { type: 'colony', planetEntityId, regionId },
                source: { type: 'ship' },
            } as CrewTransferredEvent);
            eventQueue.drain();

            expect(sim.colonistStates.size).toBe(0);
        });

        it('skips when event targets different colony', () => {
            addCrewAtColony(world, planetEntityId, regionId, 'Alice');
            sim.initForRegion(regionId);
            expect(sim.colonistStates.size).toBe(1);

            eventQueue.emit({
                type: GameEvents.CREW_TRANSFERRED,
                count: 1,
                destination: { type: 'colony', planetEntityId, regionId: 999 },
                source: { type: 'ship' },
            } as CrewTransferredEvent);
            eventQueue.drain();

            expect(sim.colonistStates.size).toBe(1);
        });

        it('refreshes when destination matches this colony', () => {
            addCrewAtColony(world, planetEntityId, regionId, 'Alice');
            sim.initForRegion(regionId);
            expect(sim.colonistStates.size).toBe(1);

            addCrewAtColony(world, planetEntityId, regionId, 'Bob');

            eventQueue.emit({
                type: GameEvents.CREW_TRANSFERRED,
                count: 1,
                destination: { type: 'colony', planetEntityId, regionId },
                source: { type: 'ship' },
            } as CrewTransferredEvent);
            eventQueue.drain();

            expect(sim.colonistStates.size).toBe(2);
        });

        it('refreshes when source matches this colony', () => {
            const { entityId: aliceId } = addCrewAtColony(world, planetEntityId, regionId, 'Alice');
            addCrewAtColony(world, planetEntityId, regionId, 'Bob');
            sim.initForRegion(regionId);
            expect(sim.colonistStates.size).toBe(2);

            const alice = world.getEntity(aliceId);
            const crew = alice?.getComponent(CrewMemberComponent);
            if (crew) crew.location = { type: 'ship' };

            eventQueue.emit({
                type: GameEvents.CREW_TRANSFERRED,
                count: 1,
                destination: { type: 'ship' },
                source: { type: 'colony', planetEntityId, regionId },
            } as CrewTransferredEvent);
            eventQueue.drain();

            expect(sim.colonistStates.size).toBe(1);
            expect(sim.colonistStates.has(aliceId)).toBe(false);
        });

        it('skips when only destination is set but targets different colony', () => {
            addCrewAtColony(world, planetEntityId, regionId, 'Alice');
            sim.initForRegion(regionId);
            expect(sim.colonistStates.size).toBe(1);

            eventQueue.emit({
                type: GameEvents.CREW_TRANSFERRED,
                count: 1,
                destination: { type: 'colony', planetEntityId, regionId: 999 },
            } as CrewTransferredEvent);
            eventQueue.drain();

            expect(sim.colonistStates.size).toBe(1);
        });

        it('refreshes when only destination is set and matches this colony', () => {
            addCrewAtColony(world, planetEntityId, regionId, 'Alice');
            sim.initForRegion(regionId);

            addCrewAtColony(world, planetEntityId, regionId, 'Bob');

            eventQueue.emit({
                type: GameEvents.CREW_TRANSFERRED,
                count: 1,
                destination: { type: 'colony', planetEntityId, regionId },
            } as CrewTransferredEvent);
            eventQueue.drain();

            expect(sim.colonistStates.size).toBe(2);
        });

        it('refreshes on blanket event without destination/source', () => {
            addCrewAtColony(world, planetEntityId, regionId, 'Alice');
            sim.initForRegion(regionId);

            addCrewAtColony(world, planetEntityId, regionId, 'Bob');

            eventQueue.emit({
                type: GameEvents.CREW_TRANSFERRED,
                count: 1,
            } as CrewTransferredEvent);
            eventQueue.drain();

            expect(sim.colonistStates.size).toBe(2);
        });

        it('unregisters handler on destroy', () => {
            sim.initForRegion(regionId);
            sim.destroy();

            addCrewAtColony(world, planetEntityId, regionId, 'Alice');

            eventQueue.emit({
                type: GameEvents.CREW_TRANSFERRED,
                count: 1,
                destination: { type: 'colony', planetEntityId, regionId },
                source: { type: 'ship' },
            } as CrewTransferredEvent);
            eventQueue.drain();

            expect(sim.colonistStates.size).toBe(0);
        });
    });
});
