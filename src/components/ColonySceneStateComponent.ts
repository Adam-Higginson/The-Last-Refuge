// ColonySceneStateComponent.ts — Holds all colony scene state that was
// previously scattered across module-level variables in rendering files.
// Lives on the planet entity. Cleaned up automatically by ECS lifecycle.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { COLONY_ZOOM } from '../rendering/isometric';
import { advanceClock, getDayNightState } from '../rendering/colonyDayNight';
import { advanceWeather } from '../rendering/colonyWeather';
import { ResourceComponent } from './ResourceComponent';
import { RESOURCE_CONFIGS, RESOURCE_TYPES } from '../data/resources';
import type { ColonySlotRect } from '../rendering/drawColonyScene';
import type { ColonistScreenPos } from '../rendering/colonyGridRenderer';
import type { HitTestItem } from '../rendering/RenderQueue';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { CanvasResizeEvent } from '../core/GameEvents';
import type { World } from '../core/World';

/**
 * Derived view layout — single source of truth for both rendering and input.
 * Recalculated on resize, read by drawColonyScene and ColonyViewInputComponent.
 */
export interface ColonyViewTransform {
    /** Canvas width in pixels. */
    canvasW: number;
    /** Canvas height in pixels. */
    canvasH: number;
    /** Y coordinate of the horizon line. */
    horizonY: number;
    /** X centre of the zoomed ground area. */
    groundCentreX: number;
    /** Y centre of the zoomed ground area. */
    groundCentreY: number;
    /** Zoom scale applied to colony content. */
    zoom: number;
}

const REFERENCE_WIDTH = 1200;
const MIN_COLONY_ZOOM = 1.0;

function computeViewTransform(w: number, h: number): ColonyViewTransform {
    const horizonY = h * 0.25;
    const responsiveZoom = COLONY_ZOOM * Math.min(w, h) / REFERENCE_WIDTH;
    return {
        canvasW: w,
        canvasH: h,
        horizonY,
        groundCentreX: w / 2,
        groundCentreY: horizonY + (h - horizonY) * 0.35,
        zoom: Math.max(MIN_COLONY_ZOOM, Math.min(COLONY_ZOOM, responsiveZoom)),
    };
}

export type WeatherStateName = 'clear' | 'overcast' | 'rain';

export interface ColonyParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    colour: string;
}

export interface ColonyCrewSprite {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    colour: string;
    skinTone: string;
    hairColour: string;
    name: string;
    isLeader: boolean;
    speed: number;
    walkPhase: number;
    idleTimer: number;
    targetSlotIdx: number;
    sheltered: boolean;
}

export class ColonySceneStateComponent extends Component {
    /** Derived view layout — recalculated on resize. */
    viewTransform: ColonyViewTransform = computeViewTransform(1, 1);

    private eventQueue: EventQueue | null = null;
    private resizeHandler: EventHandler | null = null;

    init(): void {
        this.eventQueue = ServiceLocator.get<EventQueue>('eventQueue');
        const canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
        this.viewTransform = computeViewTransform(canvas.width, canvas.height);

        this.resizeHandler = (event): void => {
            const { width, height } = event as CanvasResizeEvent;
            this.viewTransform = computeViewTransform(width, height);
            // Clear stale state — renderer recomputes on next frame
            this.lastSlotRects = [];
            this.lastColonistPositions = [];
            this.lastHitTestItems = [];
            this.hoveredSlotIndex = null;
            this.selectedSlotIndex = null;
            this.selectedColonistId = null;
            // Crew sprites have absolute positions from old layout — clear them
            // so they reinitialise at correct positions on next render
            this.crewSprites.clear();
            this.particles = [];
            // Reset frame time to avoid dt spike
            this.lastFrameTime = 0;
        };
        this.eventQueue.on(GameEvents.CANVAS_RESIZE, this.resizeHandler);
    }

    update(dt: number): void {
        // Advance day/night clock and weather every tick
        advanceClock(this, dt);
        const dayNight = getDayNightState(this.gameHour);
        advanceWeather(this, Math.min(dt, 0.1), dayNight);

        // Emergency mode: check resource crisis state
        this.updateEmergencyState(dt);
    }

    /** Check resource levels and update emergency mode with hysteresis. */
    private updateEmergencyState(dt: number): void {
        // Skip resource checks when debug override is active
        if (this.emergencyDebugOverride) {
            const target = this.emergencyActive ? 1 : 0;
            if (this.emergencyIntensity < target) {
                this.emergencyIntensity = Math.min(target, this.emergencyIntensity + dt / 2);
            } else if (this.emergencyIntensity > target) {
                this.emergencyIntensity = Math.max(target, this.emergencyIntensity - dt / 3);
            }
            return;
        }
        if (!ServiceLocator.has('world')) return;
        const world = ServiceLocator.get<World>('world');
        const gameState = world.getEntityByName('gameState');
        const resources = gameState?.getComponent(ResourceComponent);
        if (!resources) return;

        // Check if ANY resource is critical: net rate < 0 AND current < 20% of starting
        let anyCritical = false;
        let allAboveRecovery = true;
        for (const type of RESOURCE_TYPES) {
            const state = resources.resources[type];
            const startingAmount = RESOURCE_CONFIGS[type].startingAmount;
            const criticalThreshold = startingAmount * 0.2;
            const recoveryThreshold = startingAmount * 0.25;

            if (resources.getNetRate(type) < 0 && state.current < criticalThreshold) {
                anyCritical = true;
            }
            if (state.current < recoveryThreshold) {
                allAboveRecovery = false;
            }
        }

        // Hysteresis: activate on any critical, deactivate only when all above 25%
        if (anyCritical) {
            this.emergencyActive = true;
        } else if (allAboveRecovery) {
            this.emergencyActive = false;
        }

        // Linear fade: 2s fade-in, 3s fade-out
        const target = this.emergencyActive ? 1 : 0;
        if (this.emergencyIntensity < target) {
            this.emergencyIntensity = Math.min(target, this.emergencyIntensity + dt / 2);
        } else if (this.emergencyIntensity > target) {
            this.emergencyIntensity = Math.max(target, this.emergencyIntensity - dt / 3);
        }
    }

    destroy(): void {
        if (this.eventQueue && this.resizeHandler) {
            this.eventQueue.off(GameEvents.CANVAS_RESIZE, this.resizeHandler);
        }
    }

    // Day/night
    gameHour = 10.0;

    // Weather
    currentWeather: WeatherStateName = 'clear';
    previousWeather: WeatherStateName = 'clear';
    transitionProgress = 1;
    nextChangeHour = 8;
    lastHour = -1;
    windAngle = 0.15;
    windTarget = 0.15;
    windIntensity = 0;
    nextGustTime = 0;
    lastLightningTime = 0;
    lightningAlpha = 0;

    // Particles
    particles: ColonyParticle[] = [];

    // Crew sprites
    crewSprites: Map<number, ColonyCrewSprite> = new Map();

    // Frame timing
    lastFrameTime = 0;

    // Gust state shared between ground and grass
    lastGustX = -1;
    lastGustActive = false;

    // Debug keys registered flag
    debugKeysRegistered = false;

    // Slot rects for input hit-testing
    lastSlotRects: ColonySlotRect[] = [];

    // Colonist screen positions for input hit-testing (legacy, kept for compatibility)
    lastColonistPositions: ColonistScreenPos[] = [];

    // Depth-sorted hit-test items from RenderQueue
    lastHitTestItems: HitTestItem[] = [];

    // Debug depth overlay visibility
    debugDepthVisible = false;

    // Input state
    hoveredSlotIndex: number | null = null;
    selectedSlotIndex: number | null = null;
    selectedColonistId: number | null = null;

    // Wind gust decay timeout (frame-based, seconds remaining)
    gustDecayTimer = 0;

    // Emergency visual mode — activates when resources hit critical
    emergencyActive = false;
    emergencyIntensity = 0;
    /** Debug override — when true, updateEmergencyState skips resource checks. */
    emergencyDebugOverride = false;  // 0-1, drives visual effects
}
