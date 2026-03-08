import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlanetViewTransitionComponent } from '../PlanetViewTransitionComponent';
import { GameModeComponent } from '../GameModeComponent';
import { SelectableComponent } from '../SelectableComponent';
import { RenderComponent } from '../RenderComponent';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { GameEvents } from '../../core/GameEvents';

describe('PlanetViewTransitionComponent', () => {
    let world: World;
    let eventQueue: EventQueue;
    let gameStateEntity: ReturnType<World['createEntity']>;
    let gameModeComp: GameModeComponent;
    let transitionComp: PlanetViewTransitionComponent;

    // Mock DOM
    const originalDocument = globalThis.document;
    const mockHud = {
        style: { display: '' },
    };

    beforeEach(() => {
        ServiceLocator.clear();
        eventQueue = new EventQueue();
        world = new World();
        ServiceLocator.register('eventQueue', eventQueue);
        ServiceLocator.register('world', world);

        // Mock document.getElementById for HUD
        globalThis.document = {
            ...originalDocument,
            getElementById: vi.fn((id: string) => {
                if (id === 'hud-bottom') return mockHud as unknown as HTMLElement;
                return null;
            }),
        } as unknown as Document;

        mockHud.style.display = '';

        // Create gameState entity with GameModeComponent + PlanetViewTransitionComponent
        gameStateEntity = world.createEntity('gameState');
        gameModeComp = gameStateEntity.addComponent(new GameModeComponent());
        transitionComp = gameStateEntity.addComponent(new PlanetViewTransitionComponent());
        transitionComp.init();
    });

    afterEach(() => {
        transitionComp.destroy();
        globalThis.document = originalDocument;
        ServiceLocator.clear();
    });

    it('responds to PLANET_VIEW_ENTER event', () => {
        gameModeComp.mode = 'system';
        eventQueue.emit({ type: GameEvents.PLANET_VIEW_ENTER, entityId: 99 });
        eventQueue.drain();

        expect(gameModeComp.mode).toBe('transitioning-to-planet');
        expect(gameModeComp.transitionProgress).toBe(0);
        expect(gameModeComp.planetEntityId).toBe(99);
    });

    it('ignores PLANET_VIEW_ENTER when not in system mode', () => {
        gameModeComp.mode = 'planet';
        eventQueue.emit({ type: GameEvents.PLANET_VIEW_ENTER, entityId: 99 });
        eventQueue.drain();

        expect(gameModeComp.mode).toBe('planet');
    });

    it('advances transitionProgress during transitioning-to-planet', () => {
        gameModeComp.mode = 'transitioning-to-planet';
        gameModeComp.transitionProgress = 0;
        gameModeComp.transitionDuration = 1.0;

        transitionComp.update(0.5);
        expect(gameModeComp.transitionProgress).toBe(0.5);
    });

    it('completes transition to planet mode when progress reaches 1', () => {
        gameModeComp.mode = 'transitioning-to-planet';
        gameModeComp.transitionProgress = 0.9;
        gameModeComp.transitionDuration = 1.0;

        // Create background and star entities so setSystemEntitiesVisible works
        const bg = world.createEntity('background');
        bg.addComponent(new RenderComponent('background', () => {}));
        const star = world.createEntity('star');
        star.addComponent(new RenderComponent('world', () => {}));

        transitionComp.update(0.2); // would push to 1.1, clamped to 1

        expect(gameModeComp.transitionProgress).toBe(1);
        expect(gameModeComp.mode).toBe('planet');
    });

    it('responds to PLANET_VIEW_EXIT event', () => {
        gameModeComp.mode = 'planet';
        eventQueue.emit({ type: GameEvents.PLANET_VIEW_EXIT });
        eventQueue.drain();

        expect(gameModeComp.mode).toBe('transitioning-to-system');
        expect(gameModeComp.transitionProgress).toBe(0);
    });

    it('ignores PLANET_VIEW_EXIT when not in planet mode', () => {
        gameModeComp.mode = 'system';
        eventQueue.emit({ type: GameEvents.PLANET_VIEW_EXIT });
        eventQueue.drain();

        expect(gameModeComp.mode).toBe('system');
    });

    it('completes transition back to system mode', () => {
        gameModeComp.mode = 'transitioning-to-system';
        gameModeComp.transitionProgress = 0.9;
        gameModeComp.transitionDuration = 1.0;
        gameModeComp.planetEntityId = 99;

        // Create entities for visibility restoration
        const bg = world.createEntity('background');
        bg.addComponent(new RenderComponent('background', () => {}));
        const star = world.createEntity('star');
        star.addComponent(new RenderComponent('world', () => {}));

        transitionComp.update(0.2);

        expect(gameModeComp.mode).toBe('system');
        expect(gameModeComp.planetEntityId).toBeNull();
    });

    it('emits TURN_BLOCK on transition start', () => {
        const events: string[] = [];
        eventQueue.on(GameEvents.TURN_BLOCK, () => events.push('block'));

        gameModeComp.mode = 'system';
        eventQueue.emit({ type: GameEvents.PLANET_VIEW_ENTER, entityId: 1 });
        // First drain delivers PLANET_VIEW_ENTER → handler emits TURN_BLOCK
        eventQueue.drain();
        // Second drain delivers TURN_BLOCK to our listener
        eventQueue.drain();

        expect(events).toContain('block');
    });

    it('emits TURN_UNBLOCK on transition complete', () => {
        const events: string[] = [];
        eventQueue.on(GameEvents.TURN_UNBLOCK, () => events.push('unblock'));

        // Create dummy entities
        world.createEntity('background').addComponent(new RenderComponent('background', () => {}));
        world.createEntity('star').addComponent(new RenderComponent('world', () => {}));

        // First block by entering transition
        gameModeComp.mode = 'system';
        eventQueue.emit({ type: GameEvents.PLANET_VIEW_ENTER, entityId: 1 });
        eventQueue.drain();
        eventQueue.drain();

        // Now complete the transition so unblock fires
        gameModeComp.mode = 'transitioning-to-planet';
        gameModeComp.transitionProgress = 0.99;
        gameModeComp.transitionDuration = 1.0;

        transitionComp.update(0.1);
        // Drain to deliver the TURN_UNBLOCK event
        eventQueue.drain();

        expect(events).toContain('unblock');
    });

    it('deselects all entities on planet view enter', () => {
        // Create a selectable entity
        const entity = world.createEntity('test');
        const sel = entity.addComponent(new SelectableComponent(20));
        sel.selected = true;

        gameModeComp.mode = 'system';
        eventQueue.emit({ type: GameEvents.PLANET_VIEW_ENTER, entityId: 1 });
        eventQueue.drain();

        expect(sel.selected).toBe(false);
    });

    it('hides ship immediately on planet view enter', () => {
        // Create a ship entity with a RenderComponent
        const ship = world.createEntity('arkSalvage');
        const shipRender = ship.addComponent(new RenderComponent('world', () => {}));
        expect(shipRender.visible).toBe(true);

        gameModeComp.mode = 'system';
        eventQueue.emit({ type: GameEvents.PLANET_VIEW_ENTER, entityId: 1 });
        eventQueue.drain();

        // Ship should be hidden immediately, not waiting for transition to complete
        expect(shipRender.visible).toBe(false);
    });

    it('does not advance when mode is system', () => {
        gameModeComp.mode = 'system';
        gameModeComp.transitionProgress = 0;

        transitionComp.update(0.5);
        expect(gameModeComp.transitionProgress).toBe(0);
    });

    it('hides HUD when entering planet mode', () => {
        gameModeComp.mode = 'transitioning-to-planet';
        gameModeComp.transitionProgress = 0.99;
        gameModeComp.transitionDuration = 1.0;

        world.createEntity('background').addComponent(new RenderComponent('background', () => {}));
        world.createEntity('star').addComponent(new RenderComponent('world', () => {}));

        // Need to block first
        eventQueue.emit({ type: GameEvents.PLANET_VIEW_ENTER, entityId: 1 });
        eventQueue.drain();
        gameModeComp.mode = 'transitioning-to-planet';
        gameModeComp.transitionProgress = 0.99;

        transitionComp.update(0.1);

        expect(mockHud.style.display).toBe('none');
    });
});
