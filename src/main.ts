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

function boot(): void {
    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D canvas context');
    }

    // Size canvas to window
    function resize(): void {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

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

    // TODO: create entities (star, planet, ship, crew)

    // Start the game loop
    const loop = new GameLoop(world);
    loop.start();
}

boot();
