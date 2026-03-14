// createHUD.ts — Factory for the HUD entity.
// Creates a pure UI entity (no TransformComponent) with the bottom bar
// and date tracking components.

import { HUDUIComponent } from '../components/HUDUIComponent';
import { DateUIComponent } from '../components/DateUIComponent';
import { ResourceBarUIComponent } from '../components/ResourceBarUIComponent';
import { TransferScreenComponent } from '../components/TransferScreenComponent';
import type { World } from '../core/World';
import type { Entity } from '../core/Entity';

export function createHUD(world: World): Entity {
    const entity = world.createEntity('hud');
    entity.addComponent(new DateUIComponent());
    entity.addComponent(new HUDUIComponent());
    entity.addComponent(new ResourceBarUIComponent());
    entity.addComponent(new TransferScreenComponent());
    return entity;
}
