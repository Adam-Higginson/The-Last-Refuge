import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';
import { ExtirisAIComponent } from '../ExtirisAIComponent';
import { ExtirisMovementComponent } from '../ExtirisMovementComponent';
import { TransformComponent } from '../TransformComponent';
import { PlanetDataComponent } from '../PlanetDataComponent';
import { AIService } from '../../services/AIService';
import type { PlanetConfig } from '../../data/planets';
import type { TurnBlockEvent, TurnUnblockEvent } from '../../core/GameEvents';

describe('ExtirisAIComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let aiService: AIService;

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        aiService = new AIService();

        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);
        ServiceLocator.register('aiService', aiService);
    });

    function createExtirisEntity(x = 3000, y = 3000): {
        ai: ExtirisAIComponent;
        movement: ExtirisMovementComponent;
        transform: TransformComponent;
    } {
        const entity = world.createEntity('extiris');
        const transform = entity.addComponent(new TransformComponent(x, y));
        const ai = entity.addComponent(new ExtirisAIComponent());
        const movement = entity.addComponent(new ExtirisMovementComponent());
        ai.init();
        return { ai, movement, transform };
    }

    it('starts in idle state', () => {
        const { ai } = createExtirisEntity();
        expect(ai.aiState).toBe('idle');
    });

    it('transitions to thinking on TURN_ADVANCE', () => {
        const { ai } = createExtirisEntity();

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        expect(ai.aiState).toBe('thinking');
    });

    it('emits TURN_BLOCK and AI_PHASE_START on TURN_ADVANCE', () => {
        createExtirisEntity();

        const blocked: string[] = [];
        const aiStarted: boolean[] = [];
        eventQueue.on(GameEvents.TURN_BLOCK, (e) => {
            blocked.push((e as TurnBlockEvent).key);
        });
        eventQueue.on(GameEvents.AI_PHASE_START, () => aiStarted.push(true));

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();
        // Drain the events emitted by startThinking
        eventQueue.drain();

        expect(blocked).toContain('extiris-ai');
        expect(aiStarted).toHaveLength(1);
    });

    it('emits TURN_UNBLOCK and AI_PHASE_END after move complete', async () => {
        const { ai } = createExtirisEntity();

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        // Wait for async AI service to resolve
        await vi.waitFor(() => {
            expect(ai.aiState).toBe('thinking');
        });

        // Give the promise a tick to resolve
        await new Promise(resolve => setTimeout(resolve, 10));

        // Simulate move complete
        eventQueue.emit({ type: GameEvents.EXTIRIS_MOVE_COMPLETE, entityId: 0 });
        eventQueue.drain();

        expect(ai.aiState).toBe('idle');
    });

    it('detects player ship within sensor radius', () => {
        const { ai } = createExtirisEntity(100, 100);

        // Create a player ship within sensor radius
        const ship = world.createEntity('arkSalvage');
        ship.addComponent(new TransformComponent(200, 200));

        const payload = ai.buildStatePayload();
        expect(ai.playerDetected).toBe(true);
        expect(payload.visibleEntities.some(e => e.type === 'ship')).toBe(true);
    });

    it('does not detect player ship outside sensor radius', () => {
        const { ai } = createExtirisEntity(0, 0);

        // Create a player ship far away
        const ship = world.createEntity('arkSalvage');
        ship.addComponent(new TransformComponent(5000, 5000));

        const payload = ai.buildStatePayload();
        expect(ai.playerDetected).toBe(false);
        expect(payload.visibleEntities).toHaveLength(0);
    });

    it('tracks known planets in memory', () => {
        const { ai } = createExtirisEntity(100, 100);

        const planet = world.createEntity('newTerra');
        planet.addComponent(new TransformComponent(200, 200));
        planet.addComponent(new PlanetDataComponent({
            name: 'newTerra',
            displayName: 'New Terra',
            type: 'rocky',
            orbitRadius: 1500,
            startAngle: 0,
            orbitSpeed: 0,
            radius: 120,
            hitRadius: 140,
            colonisable: true,
            regionCount: 8,
            lore: 'Test planet',
            palette: { body: '#4488ff', bodyAlt: '#2266cc', atmosphere: '#88aaff', orbitRing: '#334466' },
        } as PlanetConfig));

        ai.buildStatePayload();
        expect(ai.memory.knownPlanets).toHaveLength(1);
        expect(ai.memory.knownPlanets[0].name).toBe('newTerra');
    });

    it('cleans up and unblocks on destroy while thinking', () => {
        const { ai } = createExtirisEntity();

        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();
        expect(ai.aiState).toBe('thinking');

        const unblocked: string[] = [];
        eventQueue.on(GameEvents.TURN_UNBLOCK, (e) => {
            unblocked.push((e as TurnUnblockEvent).key);
        });

        ai.destroy();
        eventQueue.drain();

        expect(ai.destroyed).toBe(true);
        expect(unblocked).toContain('extiris-ai');
    });

    it('unsubscribes from events on destroy', () => {
        const { ai } = createExtirisEntity();
        ai.destroy();

        // Should not transition on TURN_ADVANCE after destroy
        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        expect(ai.destroyed).toBe(true);
    });

    it('caps visitedPositions at 10 entries', async () => {
        const { ai } = createExtirisEntity();

        // Manually fill memory with 10 positions
        for (let i = 0; i < 10; i++) {
            ai.memory.visitedPositions.push({ x: i * 100, y: 0, turn: i });
        }
        expect(ai.memory.visitedPositions).toHaveLength(10);

        // Trigger one more turn cycle
        eventQueue.emit({ type: GameEvents.TURN_ADVANCE });
        eventQueue.drain();

        // Wait for async resolution
        await new Promise(resolve => setTimeout(resolve, 10));

        // Simulate move complete
        eventQueue.emit({ type: GameEvents.EXTIRIS_MOVE_COMPLETE, entityId: 0 });
        eventQueue.drain();

        expect(ai.memory.visitedPositions.length).toBeLessThanOrEqual(10);
    });
});
