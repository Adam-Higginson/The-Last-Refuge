// main.ts — Entry point.
// Registers services, creates the world, adds systems, and starts the game loop.

import './styles/global.css';

import { World } from './core/World';
import { GameLoop } from './core/GameLoop';
import { EventQueue } from './core/EventQueue';
import { ServiceLocator } from './core/ServiceLocator';
import { GameEvents } from './core/GameEvents';
import { InputSystem } from './systems/InputSystem';
import { TurnSystem } from './systems/TurnSystem';
import { ComponentSystem } from './systems/ComponentSystem';
import { RenderSystem } from './systems/RenderSystem';
import { UISystem } from './systems/UISystem';
import { createGameState } from './entities/createGameState';
import { createBackground } from './entities/createBackground';
import { createStar } from './entities/createStar';
import { createSolarSystem } from './entities/createSolarSystem';
import { createShip } from './entities/createShip';
import { createFogOverlay } from './entities/createFogOverlay';
import { createMinimap } from './entities/createMinimap';
import { createHUD } from './entities/createHUD';
import { createCrew } from './entities/createCrew';
import { CameraComponent } from './components/CameraComponent';
import { TransformComponent } from './components/TransformComponent';

function boot(): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D canvas context');
    }

    // Size canvas to window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Register core services
    const eventQueue = new EventQueue();
    ServiceLocator.register('canvas', canvas);
    ServiceLocator.register('ctx', ctx);
    ServiceLocator.register('eventQueue', eventQueue);

    // Create the world
    const world = new World();
    ServiceLocator.register('world', world);

    // Add systems in explicit update order
    world.addSystem(new InputSystem());
    world.addSystem(new TurnSystem());
    world.addSystem(new ComponentSystem());
    world.addSystem(new RenderSystem());
    world.addSystem(new UISystem());

    // Create entities (gameState and camera first — systems query them)
    createGameState(world);
    const cameraEntity = world.createEntity('camera');
    cameraEntity.addComponent(new CameraComponent());
    createBackground(world);
    createStar(world);
    createSolarSystem(world);
    const ship = createShip(world);
    createFogOverlay(world);
    createMinimap(world);
    createCrew(world);
    createHUD(world);

    // Centre camera on the ship's starting position
    const camera = cameraEntity.getComponent(CameraComponent);
    const shipTransform = ship.getComponent(TransformComponent);
    if (camera && shipTransform) {
        camera.panTo(shipTransform.x, shipTransform.y);
    }

    // Resize handler — updates canvas pixel dimensions.
    // CameraComponent, RegionDataComponent, and ColonySceneStateComponent
    // all subscribe to CANVAS_RESIZE to recalculate their layouts.
    function handleResize(): void {
        const newW = window.innerWidth;
        const newH = window.innerHeight;
        if (canvas.width === newW && canvas.height === newH) return;

        canvas.width = newW;
        canvas.height = newH;

        eventQueue.emit({
            type: GameEvents.CANVAS_RESIZE,
            width: newW,
            height: newH,
        });
    }

    window.addEventListener('resize', handleResize);

    // On mobile, visualViewport fires for address bar show/hide and
    // orientation changes that window.resize may miss.
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize);
    }

    // Expose world for browser console debugging (dev only)
    (window as unknown as Record<string, unknown>).__debugWorld = world;

    // Start the game loop
    const loop = new GameLoop(world);
    loop.start();
}

boot();
