import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { RenderComponent } from '../../components/RenderComponent';
import { TransformComponent } from '../../components/TransformComponent';
import { OrbitComponent } from '../../components/OrbitComponent';
import { SelectableComponent } from '../../components/SelectableComponent';
import { PlanetDataComponent } from '../../components/PlanetDataComponent';
import { RegionDataComponent } from '../../components/RegionDataComponent';
import { ColoniseUIComponent } from '../../components/ColoniseUIComponent';
import { createPlanet } from '../createPlanet';
import { PLANET_CONFIGS, getPlanetConfig } from '../../data/planets';

const newTerraConfig = getPlanetConfig('newTerra');

describe('createPlanet', () => {
    beforeEach(() => {
        ServiceLocator.clear();
        ServiceLocator.register('canvas', {
            width: 800,
            height: 600,
        } as unknown as HTMLCanvasElement);
    });

    it('creates an entity with the config name', () => {
        if (!newTerraConfig) throw new Error('missing config');
        const world = new World();
        const entity = createPlanet(world, newTerraConfig);
        expect(entity.name).toBe('newTerra');
    });

    it('entity is retrievable from the world by name', () => {
        if (!newTerraConfig) throw new Error('missing config');
        const world = new World();
        createPlanet(world, newTerraConfig);
        const entity = world.getEntityByName('newTerra');
        expect(entity).not.toBeNull();
    });

    it('has a RenderComponent on the world layer', () => {
        if (!newTerraConfig) throw new Error('missing config');
        const world = new World();
        const entity = createPlanet(world, newTerraConfig);
        const render = entity.getComponent(RenderComponent);
        expect(render).not.toBeNull();
        expect(render?.layer).toBe('world');
    });

    it('has a TransformComponent at initial orbit position', () => {
        if (!newTerraConfig) throw new Error('missing config');
        const world = new World();
        const entity = createPlanet(world, newTerraConfig);
        const transform = entity.getComponent(TransformComponent);
        expect(transform).not.toBeNull();
        const expectedX = newTerraConfig.orbitRadius * Math.cos(newTerraConfig.startAngle);
        const expectedY = newTerraConfig.orbitRadius * Math.sin(newTerraConfig.startAngle);
        expect(transform?.x).toBeCloseTo(expectedX);
        expect(transform?.y).toBeCloseTo(expectedY);
    });

    it('has an OrbitComponent with config parameters', () => {
        if (!newTerraConfig) throw new Error('missing config');
        const world = new World();
        const entity = createPlanet(world, newTerraConfig);
        const orbit = entity.getComponent(OrbitComponent);
        expect(orbit).not.toBeNull();
        expect(orbit?.centreX).toBe(0);
        expect(orbit?.centreY).toBe(0);
        expect(orbit?.radius).toBe(newTerraConfig.orbitRadius);
        expect(orbit?.speed).toBe(newTerraConfig.orbitSpeed);
    });

    it('has a SelectableComponent with config hit radius', () => {
        if (!newTerraConfig) throw new Error('missing config');
        const world = new World();
        const entity = createPlanet(world, newTerraConfig);
        const selectable = entity.getComponent(SelectableComponent);
        expect(selectable).not.toBeNull();
        expect(selectable?.hitRadius).toBe(newTerraConfig.hitRadius);
    });

    it('has a PlanetDataComponent with config', () => {
        if (!newTerraConfig) throw new Error('missing config');
        const world = new World();
        const entity = createPlanet(world, newTerraConfig);
        const planetData = entity.getComponent(PlanetDataComponent);
        expect(planetData).not.toBeNull();
        expect(planetData?.config.name).toBe('newTerra');
    });

    it('rocky planets have RegionDataComponent', () => {
        if (!newTerraConfig) throw new Error('missing config');
        const world = new World();
        const entity = createPlanet(world, newTerraConfig);
        const regionData = entity.getComponent(RegionDataComponent);
        expect(regionData).not.toBeNull();
        expect(regionData?.regions.length).toBeGreaterThan(0);
    });

    it('gas giants do not have RegionDataComponent', () => {
        const goliathConfig = getPlanetConfig('goliath');
        if (!goliathConfig) throw new Error('missing config');
        const world = new World();
        const entity = createPlanet(world, goliathConfig);
        const regionData = entity.getComponent(RegionDataComponent);
        expect(regionData).toBeNull();
    });

    it('only colonisable planets have ColoniseUIComponent', () => {
        if (!newTerraConfig) throw new Error('missing config');
        const world = new World();
        const terra = createPlanet(world, newTerraConfig);
        expect(terra.getComponent(ColoniseUIComponent)).not.toBeNull();

        const emberConfig = getPlanetConfig('ember');
        if (!emberConfig) throw new Error('missing config');
        const ember = createPlanet(world, emberConfig);
        expect(ember.getComponent(ColoniseUIComponent)).toBeNull();
    });

    it('creates all 5 planets from PLANET_CONFIGS', () => {
        const world = new World();
        for (const config of PLANET_CONFIGS) {
            createPlanet(world, config);
        }
        expect(world.getEntityByName('ember')).not.toBeNull();
        expect(world.getEntityByName('newTerra')).not.toBeNull();
        expect(world.getEntityByName('dust')).not.toBeNull();
        expect(world.getEntityByName('goliath')).not.toBeNull();
        expect(world.getEntityByName('shepherd')).not.toBeNull();
    });
});
