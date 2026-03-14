// createSolarSystem.ts — Creates all planets from the configuration data.

import { PLANET_CONFIGS } from '../data/planets';
import { createPlanet } from './createPlanet';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

/** Create all planets in the solar system. Returns the array of planet entities. */
export function createSolarSystem(world: World): Entity[] {
    return PLANET_CONFIGS.map(config => createPlanet(world, config));
}
