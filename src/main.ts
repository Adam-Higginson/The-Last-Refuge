// main.ts — Entry point.
// Registers services, creates the world, adds systems, and starts the game loop.

import { World } from './core/World';
import { GameLoop } from './core/GameLoop';
import { EventQueue } from './core/EventQueue';
import { ServiceLocator } from './core/ServiceLocator';
import { InputSystem } from './systems/InputSystem';
import { MovementSystem } from './systems/MovementSystem';
import { OrbitSystem } from './systems/OrbitSystem';
import { RenderSystem } from './systems/RenderSystem';
import { UISystem } from './systems/UISystem';
import { TransformComponent } from './components/TransformComponent';
import { createBackground } from './entities/createBackground';
import { createStar } from './entities/createStar';

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
    world.addSystem(new OrbitSystem());
    world.addSystem(new MovementSystem());
    world.addSystem(new RenderSystem());
    world.addSystem(new UISystem());

    // Create entities
    createBackground(world);
    createStar(world);
    // TODO: create planet, ship, crew entities

    // Resize handler — updates canvas dimensions and re-centres entities
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const star = world.getEntityByName('star');
        if (star) {
            const transform = star.getComponent(TransformComponent);
            if (transform) {
                transform.x = canvas.width / 2;
                transform.y = canvas.height / 2;
            }
        }
    });

    // Start the game loop
    const loop = new GameLoop(world);
    loop.start();
}

boot();
