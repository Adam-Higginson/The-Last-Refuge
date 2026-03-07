// main.js — Entry point and game loop

import { state } from './state.js';
import { initRenderer, render } from './renderer.js';
import { initShip } from './ship.js';
import { generateCrew } from './humans.js';
import { initPlanet } from './planet.js';
import { initUI } from './ui.js';
import { endTurn } from './events.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    state.planet.orbitRadius = Math.min(canvas.width, canvas.height) * 0.35;
}

function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    initRenderer(canvas, ctx);
    initPlanet(state);
    initShip(state, canvas);
    generateCrew(state);
    initUI(canvas, ctx, state);
}

function gameLoop() {
    render(state);
    requestAnimationFrame(gameLoop);
}

init();
gameLoop();
