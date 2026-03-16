// ColonySceneStateComponent.ts — Holds all colony scene state that was
// previously scattered across module-level variables in rendering files.
// Lives on the planet entity. Cleaned up automatically by ECS lifecycle.

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { GameEvents } from '../core/GameEvents';
import { COLONY_ZOOM } from '../rendering/isometric';
import { advanceClock, getDayNightState } from '../rendering/colonyDayNight';
import { advanceWeather } from '../rendering/colonyWeather';
import type { ColonySlotRect } from '../rendering/drawColonyScene';
import type { ColonistScreenPos } from '../rendering/colonyGridRenderer';
import type { EventQueue, EventHandler } from '../core/EventQueue';
import type { CanvasResizeEvent } from '../core/GameEvents';

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

    // Colonist screen positions for input hit-testing
    lastColonistPositions: ColonistScreenPos[] = [];

    // Input state
    hoveredSlotIndex: number | null = null;
    selectedSlotIndex: number | null = null;
    selectedColonistId: number | null = null;

    // Wind gust decay timeout (frame-based, seconds remaining)
    gustDecayTimer = 0;
}
