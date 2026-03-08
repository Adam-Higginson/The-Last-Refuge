// main.ts — Entry point.
// Registers services, creates the world, adds systems, and starts the game loop.

import { World } from './core/World';
import { GameLoop } from './core/GameLoop';
import { EventQueue } from './core/EventQueue';
import { ServiceLocator } from './core/ServiceLocator';
import { InputSystem } from './systems/InputSystem';
import { TurnSystem } from './systems/TurnSystem';
import { ComponentSystem } from './systems/ComponentSystem';
import { RenderSystem } from './systems/RenderSystem';
import { UISystem } from './systems/UISystem';
import { TransformComponent } from './components/TransformComponent';
import { OrbitComponent } from './components/OrbitComponent';
import { MovementComponent } from './components/MovementComponent';
import { createBackground } from './entities/createBackground';
import { createStar } from './entities/createStar';
import { createPlanet, getOrbitRadius } from './entities/createPlanet';
import { createShip } from './entities/createShip';
import { createHUD } from './entities/createHUD';
import { createCrew } from './entities/createCrew';

function boot(): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D canvas context');
    }

    // Size canvas to window (initial sizing before entities exist)
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

    // Create entities
    createBackground(world);
    createStar(world);
    createPlanet(world);
    createShip(world);
    createCrew(world);
    createHUD(world);

    // Resize handler — updates canvas dimensions and re-centres entities
    window.addEventListener('resize', () => {
        const oldCx = canvas.width / 2;
        const oldCy = canvas.height / 2;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const newCx = canvas.width / 2;
        const newCy = canvas.height / 2;
        const dx = newCx - oldCx;
        const dy = newCy - oldCy;

        const star = world.getEntityByName('star');
        if (star) {
            const transform = star.getComponent(TransformComponent);
            if (transform) {
                transform.x = newCx;
                transform.y = newCy;
            }
        }

        const planet = world.getEntityByName('newTerra');
        if (planet) {
            const orbit = planet.getComponent(OrbitComponent);
            if (orbit) {
                orbit.centreX = newCx;
                orbit.centreY = newCy;
                orbit.radius = getOrbitRadius(canvas);
            }
        }

        // Shift ship by the same delta so it keeps its relative position
        const ship = world.getEntityByName('arkSalvage');
        if (ship) {
            const transform = ship.getComponent(TransformComponent);
            if (transform) {
                transform.x += dx;
                transform.y += dy;
            }
            const movement = ship.getComponent(MovementComponent);
            if (movement) {
                if (movement.turnOriginX !== null) movement.turnOriginX += dx;
                if (movement.turnOriginY !== null) movement.turnOriginY += dy;
                if (movement.targetX !== null) movement.targetX += dx;
                if (movement.targetY !== null) movement.targetY += dy;
            }
        }
    });

    // Expose world for browser console debugging (dev only)
    (window as unknown as Record<string, unknown>).__debugWorld = world;

    // Start the game loop
    const loop = new GameLoop(world);
    loop.start();
}

boot();
