import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { TransformComponent } from '../TransformComponent';
import { ScoutDataComponent } from '../ScoutDataComponent';
import { ScoutDestructionComponent } from '../ScoutDestructionComponent';
import { CrewMemberComponent } from '../CrewMemberComponent';

describe('ScoutDestructionComponent', () => {
    let world: World;
    let eventQueue: EventQueue;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);
    });

    function createExtiris(x: number, y: number): void {
        const entity = world.createEntity('extiris');
        entity.addComponent(new TransformComponent(x, y));
    }

    function createScout(
        x: number, y: number, pilotEntityId: number, pilotName: string,
    ): { scout: import('../../core/Entity').Entity; destruction: ScoutDestructionComponent } {
        const scout = world.createEntity('testScout');
        scout.addComponent(new TransformComponent(x, y));
        scout.addComponent(new ScoutDataComponent('Test Scout', pilotEntityId, pilotName));
        const destruction = scout.addComponent(new ScoutDestructionComponent());
        return { scout, destruction };
    }

    it('destroys scout when within kill radius of Extiris', () => {
        // Create pilot crew member
        const pilotEntity = world.createEntity('pilot');
        const pilot = pilotEntity.addComponent(new CrewMemberComponent(
            'Lt. Kira Yossef', 33, 'Pilot', 58, ['Determined', 'Protective'],
            'Test backstory',
        ));
        pilot.location = { type: 'scout', scoutEntityId: 0 }; // will be updated

        createExtiris(100, 100);
        const { scout, destruction } = createScout(150, 100, pilotEntity.id, 'Lt. Kira Yossef');
        pilot.location = { type: 'scout', scoutEntityId: scout.id };

        // Distance is 50, within SCOUT_KILL_RADIUS (100)
        destruction.update(0.016);

        // Pilot should be dead
        expect(pilot.location.type).toBe('dead');
    });

    it('emits SCOUT_DESTROYED event with pilot name', () => {
        const pilotEntity = world.createEntity('pilot');
        const pilot = pilotEntity.addComponent(new CrewMemberComponent(
            'Lt. Kira Yossef', 33, 'Pilot', 58, ['Determined', 'Protective'],
            'Test backstory',
        ));

        createExtiris(100, 100);
        const { scout, destruction } = createScout(150, 100, pilotEntity.id, 'Lt. Kira Yossef');
        pilot.location = { type: 'scout', scoutEntityId: scout.id };

        const events: Array<{ type: string; pilotName?: string }> = [];
        eventQueue.on(GameEvents.SCOUT_DESTROYED, (e) => {
            events.push(e as { type: string; pilotName?: string });
        });

        destruction.update(0.016);
        eventQueue.drain();

        expect(events).toHaveLength(1);
        expect(events[0].pilotName).toBe('Lt. Kira Yossef');
    });

    it('does not destroy scout when outside kill radius', () => {
        const pilotEntity = world.createEntity('pilot');
        pilotEntity.addComponent(new CrewMemberComponent(
            'Lt. Kira Yossef', 33, 'Pilot', 58, ['Determined', 'Protective'],
            'Test backstory',
        ));

        createExtiris(100, 100);
        const { destruction } = createScout(500, 100, pilotEntity.id, 'Lt. Kira Yossef');

        const events: unknown[] = [];
        eventQueue.on(GameEvents.SCOUT_DESTROYED, (e) => events.push(e));

        destruction.update(0.016);
        eventQueue.drain();

        expect(events).toHaveLength(0);
    });

    it('handles missing Extiris entity gracefully', () => {
        const pilotEntity = world.createEntity('pilot');
        pilotEntity.addComponent(new CrewMemberComponent(
            'Lt. Kira Yossef', 33, 'Pilot', 58, ['Determined', 'Protective'],
            'Test backstory',
        ));

        // No Extiris created
        const { destruction } = createScout(100, 100, pilotEntity.id, 'Lt. Kira Yossef');

        // Should not throw
        expect(() => destruction.update(0.016)).not.toThrow();
    });

    it('handles already-dead pilot gracefully', () => {
        const pilotEntity = world.createEntity('pilot');
        const pilot = pilotEntity.addComponent(new CrewMemberComponent(
            'Lt. Kira Yossef', 33, 'Pilot', 58, ['Determined', 'Protective'],
            'Test backstory',
        ));
        pilot.location = { type: 'dead' };

        createExtiris(100, 100);
        const { destruction } = createScout(150, 100, pilotEntity.id, 'Lt. Kira Yossef');

        // Should not throw; pilot stays dead
        destruction.update(0.016);
        expect(pilot.location.type).toBe('dead');
    });
});
