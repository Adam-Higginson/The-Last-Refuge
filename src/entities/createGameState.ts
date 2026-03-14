// createGameState.ts — Factory for the game state entity.
// Tracks global game mode (system map vs planet view) and
// manages view transitions.

import { GameModeComponent } from '../components/GameModeComponent';
import { PlanetViewTransitionComponent } from '../components/PlanetViewTransitionComponent';
import { ColonyViewTransitionComponent } from '../components/ColonyViewTransitionComponent';
import { FogOfWarComponent } from '../components/FogOfWarComponent';
import { ResourceComponent } from '../components/ResourceComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

export function createGameState(world: World): Entity {
    const entity = world.createEntity('gameState');
    entity.addComponent(new GameModeComponent());
    entity.addComponent(new PlanetViewTransitionComponent());
    entity.addComponent(new ColonyViewTransitionComponent());
    entity.addComponent(new FogOfWarComponent());
    entity.addComponent(new ResourceComponent());
    return entity;
}
