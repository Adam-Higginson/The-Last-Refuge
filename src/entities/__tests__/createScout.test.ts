import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { EventQueue } from '../../core/EventQueue';
import { ServiceLocator } from '../../core/ServiceLocator';
import { createScout } from '../createScout';
import { TransformComponent } from '../../components/TransformComponent';
import { MovementComponent } from '../../components/MovementComponent';
import { SelectableComponent } from '../../components/SelectableComponent';
import { MoveConfirmComponent } from '../../components/MoveConfirmComponent';
import { VisibilitySourceComponent } from '../../components/VisibilitySourceComponent';
import { ScoutDataComponent } from '../../components/ScoutDataComponent';
import { EncounterTriggerComponent } from '../../components/EncounterTriggerComponent';
import { RenderComponent } from '../../components/RenderComponent';
import {
    SCOUT_MOVEMENT_BUDGET,
    SCOUT_GLIDE_SPEED,
    SCOUT_HIT_RADIUS,
    SCOUT_FOG_DETAIL_RADIUS,
    SCOUT_FOG_BLIP_RADIUS,
} from '../../data/constants';

describe('createScout', () => {
    let world: World;

    beforeEach(() => {
        ServiceLocator.clear();
        const eventQueue = new EventQueue();
        ServiceLocator.register('eventQueue', eventQueue);
        world = new World();
        ServiceLocator.register('world', world);
    });

    it('creates an entity with the given name', () => {
        const scout = createScout(world, 'scoutAlpha', 'Scout Alpha', 1, 'Lt. Kira Yossef', 100, 200);
        expect(scout.name).toBe('scoutAlpha');
    });

    it('has TransformComponent at the given position', () => {
        const scout = createScout(world, 'scoutAlpha', 'Scout Alpha', 1, 'Lt. Kira Yossef', 100, 200);
        const transform = scout.getComponent(TransformComponent);
        expect(transform?.x).toBe(100);
        expect(transform?.y).toBe(200);
    });

    it('has MovementComponent with scout budget and speed', () => {
        const scout = createScout(world, 'scoutAlpha', 'Scout Alpha', 1, 'Lt. Kira Yossef', 0, 0);
        const movement = scout.getComponent(MovementComponent);
        expect(movement?.budgetMax).toBe(SCOUT_MOVEMENT_BUDGET);
        expect(movement?.speed).toBe(SCOUT_GLIDE_SPEED);
    });

    it('has SelectableComponent with scout hit radius', () => {
        const scout = createScout(world, 'scoutAlpha', 'Scout Alpha', 1, 'Lt. Kira Yossef', 0, 0);
        const selectable = scout.getComponent(SelectableComponent);
        expect(selectable?.hitRadius).toBe(SCOUT_HIT_RADIUS);
    });

    it('has MoveConfirmComponent for move confirmation', () => {
        const scout = createScout(world, 'scoutAlpha', 'Scout Alpha', 1, 'Lt. Kira Yossef', 0, 0);
        expect(scout.getComponent(MoveConfirmComponent)).toBeTruthy();
    });

    it('has VisibilitySourceComponent with scout radii', () => {
        const scout = createScout(world, 'scoutAlpha', 'Scout Alpha', 1, 'Lt. Kira Yossef', 0, 0);
        const vis = scout.getComponent(VisibilitySourceComponent);
        expect(vis?.detailRadius).toBe(SCOUT_FOG_DETAIL_RADIUS);
        expect(vis?.blipRadius).toBe(SCOUT_FOG_BLIP_RADIUS);
    });

    it('has ScoutDataComponent with correct pilot assignment', () => {
        const scout = createScout(world, 'scoutAlpha', 'Scout Alpha', 42, 'Lt. Kira Yossef', 0, 0);
        const data = scout.getComponent(ScoutDataComponent);
        expect(data?.displayName).toBe('Scout Alpha');
        expect(data?.pilotEntityId).toBe(42);
        expect(data?.pilotName).toBe('Lt. Kira Yossef');
    });

    it('has EncounterTriggerComponent', () => {
        const scout = createScout(world, 'scoutAlpha', 'Scout Alpha', 1, 'Lt. Kira Yossef', 0, 0);
        expect(scout.getComponent(EncounterTriggerComponent)).toBeTruthy();
    });

    it('has RenderComponent on the world layer', () => {
        const scout = createScout(world, 'scoutAlpha', 'Scout Alpha', 1, 'Lt. Kira Yossef', 0, 0);
        const render = scout.getComponent(RenderComponent);
        expect(render?.layer).toBe('world');
    });
});
