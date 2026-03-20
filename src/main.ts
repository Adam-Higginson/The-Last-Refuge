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
import { createScout } from './entities/createScout';
import { createFogOverlay } from './entities/createFogOverlay';
import { createMinimap } from './entities/createMinimap';
import { createHUD } from './entities/createHUD';
import { createCrew } from './entities/createCrew';
import { createExtiris } from './entities/createExtiris';
import { createStation } from './entities/createStation';
import { CameraComponent } from './components/CameraComponent';
import { CrewMemberComponent } from './components/CrewMemberComponent';
import { TransformComponent } from './components/TransformComponent';
import { AIService } from './services/AIService';
import { ConfirmModal } from './ui/ConfirmModal';
import { NarrativeModal } from './ui/NarrativeModal';
import { NarrativeEventSystem } from './systems/NarrativeEventSystem';

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

    // Register AI service (configure API key later via settings UI)
    const aiService = new AIService();
    ServiceLocator.register('aiService', aiService);

    // Register modal services
    ServiceLocator.register('confirmModal', new ConfirmModal());
    ServiceLocator.register('narrativeModal', new NarrativeModal());

    // Load API key: localStorage override > build-time env > no key (deterministic)
    try {
        const savedKey = localStorage.getItem('extiris-api-key');
        const buildKey = __EXTIRIS_API_KEY__;
        const apiKey = savedKey || buildKey;
        if (apiKey) aiService.configure({ apiKey });
    } catch {
        // localStorage not available
    }

    // Add systems in explicit update order
    world.addSystem(new InputSystem());
    world.addSystem(new TurnSystem());
    world.addSystem(new NarrativeEventSystem());
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

    // Create 3 scout ships with their assigned pilots
    const shipTransformForScouts = ship.getComponent(TransformComponent);
    const sx = shipTransformForScouts?.x ?? 0;
    const sy = shipTransformForScouts?.y ?? 0;

    const pilotAssignments: Array<{ name: string; displayName: string; pilotFullName: string; dx: number; dy: number }> = [
        { name: 'scoutAlpha', displayName: 'Scout Alpha', pilotFullName: 'Lt. Kira Yossef', dx: -120, dy: -100 },
        { name: 'scoutBeta', displayName: 'Scout Beta', pilotFullName: 'Cpl. Dae-Ho Lim', dx: -120, dy: 100 },
        { name: 'scoutGamma', displayName: 'Scout Gamma', pilotFullName: 'Pvt. Nala Osei', dx: -180, dy: 0 },
    ];

    for (const pa of pilotAssignments) {
        // Find pilot crew entity by name
        const crewEntities = world.getEntitiesWithComponent(CrewMemberComponent);
        const pilotEntity = crewEntities.find(e => {
            const c = e.getComponent(CrewMemberComponent);
            return c?.fullName === pa.pilotFullName;
        });
        if (!pilotEntity) continue;

        const pilotCrew = pilotEntity.getComponent(CrewMemberComponent);
        if (!pilotCrew) continue;

        const scout = createScout(
            world, pa.name, pa.displayName,
            pilotEntity.id, pa.pilotFullName,
            sx + pa.dx, sy + pa.dy,
        );

        // Assign pilot location to scout
        pilotCrew.location = { type: 'scout', scoutEntityId: scout.id };
    }

    createStation(world);
    createHUD(world);

    // Spawn Extiris dynamically when the 'extiris_arrival' narrative fires
    eventQueue.on(GameEvents.NARRATIVE_SHOWN, (event) => {
        const e = event as import('./core/GameEvents').NarrativeShownEvent;
        if (e.id !== 'extiris_arrival') return;
        // Guard against double-spawn
        if (world.getEntityByName('extiris')) return;
        createExtiris(world);
    });

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
