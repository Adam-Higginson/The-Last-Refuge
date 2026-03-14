import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../core/World';
import { ServiceLocator } from '../../core/ServiceLocator';
import { FogOfWarComponent, TileVisibility, getEntityFogZone } from '../FogOfWarComponent';
import { TransformComponent } from '../TransformComponent';
import { GameModeComponent } from '../GameModeComponent';
import {
    FOG_GRID_SIZE,
    FOG_CELL_SIZE,
    FOG_DETAIL_RADIUS,
    FOG_BLIP_RADIUS,
} from '../../data/constants';

describe('FogOfWarComponent', () => {
    let world: World;
    let fog: FogOfWarComponent;

    beforeEach(() => {
        ServiceLocator.clear();
        world = new World();
        ServiceLocator.register('world', world);

        const gameState = world.createEntity('gameState');
        gameState.addComponent(new GameModeComponent());
        fog = gameState.addComponent(new FogOfWarComponent());
    });

    // --- Grid initialization ---

    it('initializes all cells as Hidden', () => {
        for (let i = 0; i < fog.grid.length; i++) {
            expect(fog.grid[i]).toBe(TileVisibility.Hidden);
        }
    });

    it('grid has correct size', () => {
        expect(fog.grid.length).toBe(FOG_GRID_SIZE * FOG_GRID_SIZE);
    });

    // --- Coordinate conversion ---

    it('worldToCell maps origin to center of grid', () => {
        const { col, row } = fog.worldToCell(0, 0);
        const halfWorld = (FOG_GRID_SIZE * FOG_CELL_SIZE) / 2;
        const expectedCol = Math.floor(halfWorld / FOG_CELL_SIZE);
        const expectedRow = Math.floor(halfWorld / FOG_CELL_SIZE);
        expect(col).toBe(expectedCol);
        expect(row).toBe(expectedRow);
    });

    it('worldToCell maps negative edge to (0, 0)', () => {
        const halfWorld = (FOG_GRID_SIZE * FOG_CELL_SIZE) / 2;
        const { col, row } = fog.worldToCell(-halfWorld, -halfWorld);
        expect(col).toBe(0);
        expect(row).toBe(0);
    });

    it('worldToCell clamps out-of-bounds coordinates', () => {
        const { col, row } = fog.worldToCell(-9999, 9999);
        expect(col).toBe(0);
        expect(row).toBe(FOG_GRID_SIZE - 1);
    });

    it('cellToWorld returns center of cell', () => {
        const halfWorld = (FOG_GRID_SIZE * FOG_CELL_SIZE) / 2;
        const { x, y } = fog.cellToWorld(0, 0);
        expect(x).toBe(FOG_CELL_SIZE / 2 - halfWorld);
        expect(y).toBe(FOG_CELL_SIZE / 2 - halfWorld);
    });

    // --- Visibility getters/setters ---

    it('get/set cell visibility', () => {
        fog.setCellVisibility(10, 20, TileVisibility.Active);
        expect(fog.getCellVisibility(10, 20)).toBe(TileVisibility.Active);

        fog.setCellVisibility(10, 20, TileVisibility.Revealed);
        expect(fog.getCellVisibility(10, 20)).toBe(TileVisibility.Revealed);
    });

    it('getVisibilityAtWorld combines conversion and lookup', () => {
        fog.setCellVisibility(50, 50, TileVisibility.Active);
        expect(fog.getVisibilityAtWorld(0, 0)).toBe(TileVisibility.Active);
    });

    // --- Zone classification ---

    it('getEntityZone returns active within detail radius', () => {
        expect(fog.getEntityZone(100, 0, 0, 0)).toBe('active');
    });

    it('getEntityZone returns blip between detail and blip radius', () => {
        const dist = (FOG_DETAIL_RADIUS + FOG_BLIP_RADIUS) / 2;
        expect(fog.getEntityZone(dist, 0, 0, 0)).toBe('blip');
    });

    it('getEntityZone returns hidden beyond blip radius', () => {
        expect(fog.getEntityZone(FOG_BLIP_RADIUS + 100, 0, 0, 0)).toBe('hidden');
    });

    it('isInteractable returns true only for active zone', () => {
        expect(fog.isInteractable(100, 0, 0, 0)).toBe(true);
        expect(fog.isInteractable(FOG_DETAIL_RADIUS + 100, 0, 0, 0)).toBe(false);
        expect(fog.isInteractable(FOG_BLIP_RADIUS + 100, 0, 0, 0)).toBe(false);
    });

    // --- Pre-reveal ---

    it('revealAround marks cells within radius as Active', () => {
        fog.revealAround(0, 0, 300);
        expect(fog.getVisibilityAtWorld(0, 0)).toBe(TileVisibility.Active);
        expect(fog.getVisibilityAtWorld(200, 0)).toBe(TileVisibility.Active);
    });

    it('revealAround does not mark cells beyond radius', () => {
        fog.revealAround(0, 0, 300);
        expect(fog.getVisibilityAtWorld(4000, 4000)).toBe(TileVisibility.Hidden);
    });

    // --- Init pre-reveals around ship ---

    it('init pre-reveals cells around the ship', () => {
        const ship = world.createEntity('arkSalvage');
        ship.addComponent(new TransformComponent(1000, -800));
        fog.init();

        expect(fog.getVisibilityAtWorld(1000, -800)).toBe(TileVisibility.Active);
    });

    // --- Update cycle ---

    it('update marks cells near ship as Active', () => {
        const ship = world.createEntity('arkSalvage');
        ship.addComponent(new TransformComponent(0, 0));
        fog.update(1 / 60);

        expect(fog.getVisibilityAtWorld(0, 0)).toBe(TileVisibility.Active);
    });

    it('update demotes old Active cells to Revealed when ship moves', () => {
        const ship = world.createEntity('arkSalvage');
        const transform = ship.addComponent(new TransformComponent(0, 0));

        fog.update(1 / 60);
        expect(fog.getVisibilityAtWorld(0, 0)).toBe(TileVisibility.Active);

        // Move ship far away
        transform.x = 4000;
        transform.y = 4000;
        fog.update(1 / 60);

        // Old position is now Revealed
        expect(fog.getVisibilityAtWorld(0, 0)).toBe(TileVisibility.Revealed);
        // New position is Active
        expect(fog.getVisibilityAtWorld(4000, 4000)).toBe(TileVisibility.Active);
    });

    it('hidden cells far from ship stay Hidden', () => {
        const ship = world.createEntity('arkSalvage');
        ship.addComponent(new TransformComponent(0, 0));
        fog.update(1 / 60);

        expect(fog.getVisibilityAtWorld(4500, 4500)).toBe(TileVisibility.Hidden);
    });

    it('tracks revealed cells in revealedCells set', () => {
        const ship = world.createEntity('arkSalvage');
        const transform = ship.addComponent(new TransformComponent(0, 0));

        fog.update(1 / 60);
        expect(fog.revealedCells.size).toBe(0);

        // Move ship away — old cells become revealed
        transform.x = 4000;
        transform.y = 4000;
        fog.update(1 / 60);

        expect(fog.revealedCells.size).toBeGreaterThan(0);
    });

    it('skips update when ship has not moved', () => {
        const ship = world.createEntity('arkSalvage');
        ship.addComponent(new TransformComponent(0, 0));

        fog.update(1 / 60);
        const activeCount = fog.grid.filter(v => v === TileVisibility.Active).length;

        // Update again without moving — should not change
        fog.update(1 / 60);
        const activeCount2 = fog.grid.filter(v => v === TileVisibility.Active).length;
        expect(activeCount2).toBe(activeCount);
    });

    it('skips update during planet view', () => {
        const ship = world.createEntity('arkSalvage');
        ship.addComponent(new TransformComponent(0, 0));

        const gameState = world.getEntityByName('gameState');
        const gameMode = gameState?.getComponent(GameModeComponent);
        if (gameMode) gameMode.mode = 'planet';

        fog.update(1 / 60);
        // No cells should be marked Active since update was skipped
        expect(fog.getVisibilityAtWorld(0, 0)).toBe(TileVisibility.Hidden);
    });

    // --- Last known position tracking ---

    it('recordPosition stores and getLastKnownPosition retrieves', () => {
        fog.recordPosition(42, 1000, -500);
        const pos = fog.getLastKnownPosition(42);
        expect(pos).toEqual({ x: 1000, y: -500 });
    });

    it('recordPosition updates existing position', () => {
        fog.recordPosition(42, 1000, -500);
        fog.recordPosition(42, 2000, 300);
        expect(fog.getLastKnownPosition(42)).toEqual({ x: 2000, y: 300 });
    });

    it('getLastKnownPosition returns undefined for unknown entity', () => {
        expect(fog.getLastKnownPosition(999)).toBeUndefined();
    });

    // --- getEntityFogZone standalone helper ---

    it('getEntityFogZone returns active near ship', () => {
        const ship = world.createEntity('arkSalvage');
        ship.addComponent(new TransformComponent(0, 0));
        fog.update(1 / 60);

        expect(getEntityFogZone(100, 0)).toBe('active');
    });

    it('getEntityFogZone returns blip at medium distance', () => {
        const ship = world.createEntity('arkSalvage');
        ship.addComponent(new TransformComponent(0, 0));
        fog.update(1 / 60);

        const dist = (FOG_DETAIL_RADIUS + FOG_BLIP_RADIUS) / 2;
        expect(getEntityFogZone(dist, 0)).toBe('blip');
    });

    it('getEntityFogZone returns hidden far from ship', () => {
        const ship = world.createEntity('arkSalvage');
        ship.addComponent(new TransformComponent(0, 0));
        fog.update(1 / 60);

        expect(getEntityFogZone(FOG_BLIP_RADIUS + 500, 0)).toBe('hidden');
    });

    it('getEntityFogZone returns active when ship has no transform', () => {
        // Ship exists but without TransformComponent
        world.createEntity('arkSalvage');
        fog.update(1 / 60);

        expect(getEntityFogZone(100, 0)).toBe('active');
    });

    it('getEntityFogZone returns active when no fog component exists', () => {
        // Create a world without fog
        ServiceLocator.clear();
        const noFogWorld = new World();
        ServiceLocator.register('world', noFogWorld);
        noFogWorld.createEntity('gameState');

        expect(getEntityFogZone(5000, 5000)).toBe('active');
    });
});
