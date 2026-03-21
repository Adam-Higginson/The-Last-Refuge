// AdaptiveQualityComponent.ts — FPS monitoring with automatic quality scaling.
// Monitors frame rate via a circular buffer and degrades/restores visual
// effects to maintain playable performance.

import { Component } from '../core/Component';

export interface QualityFlags {
    shadows: boolean;
    haze: boolean;
    smoke: boolean;
    breathPuffs: boolean;
    puddles: boolean;
    windParticles: boolean;
}

export type QualityTier = 'high' | 'medium' | 'low';

const BUFFER_SIZE = 60;
const DEGRADE_FPS = 28;
const RESTORE_FPS = 35;
const DEGRADE_DELAY = 2; // seconds below threshold before degrading
const RESTORE_DELAY = 5; // seconds above threshold before restoring

export class AdaptiveQualityComponent extends Component {
    /** Current quality flags — renderers check these */
    flags: QualityFlags = {
        shadows: true,
        haze: true,
        smoke: true,
        breathPuffs: true,
        puddles: true,
        windParticles: true,
    };

    /** Current FPS rolling average */
    fps = 60;

    /** Current quality tier */
    tier: QualityTier = 'high';

    /** Whether debug overlay is visible (toggled by Q key) */
    debugVisible = false;

    /** Time spent below degrade threshold (seconds) */
    private degradeTimer = 0;

    /** Time spent above restore threshold (seconds) */
    private restoreTimer = 0;

    /** Circular buffer of frame delta times in milliseconds */
    private frameTimes: number[];

    /** Current write index in the circular buffer */
    private frameIndex = 0;

    /** How many samples have been written (up to BUFFER_SIZE) */
    private sampleCount = 0;

    constructor() {
        super();
        this.frameTimes = new Array<number>(BUFFER_SIZE).fill(0);
    }

    update(dt: number): void {
        // dt is in seconds; store as milliseconds
        const dtMs = dt * 1000;

        // Write to circular buffer
        this.frameTimes[this.frameIndex] = dtMs;
        this.frameIndex = (this.frameIndex + 1) % BUFFER_SIZE;
        if (this.sampleCount < BUFFER_SIZE) {
            this.sampleCount++;
        }

        // Compute rolling average FPS
        if (this.sampleCount > 0) {
            let sum = 0;
            for (let i = 0; i < this.sampleCount; i++) {
                sum += this.frameTimes[i];
            }
            const avgMs = sum / this.sampleCount;
            const rawFps = 1000 / avgMs;
            this.fps = Math.max(1, rawFps || 60);
        }

        // Threshold logic with hysteresis
        if (this.fps < DEGRADE_FPS) {
            this.restoreTimer = 0;
            this.degradeTimer += dt;
            if (this.degradeTimer >= DEGRADE_DELAY) {
                this.degradeTier();
                this.degradeTimer = 0;
            }
        } else if (this.fps > RESTORE_FPS) {
            this.degradeTimer = 0;
            this.restoreTimer += dt;
            if (this.restoreTimer >= RESTORE_DELAY) {
                this.restoreTier();
                this.restoreTimer = 0;
            }
        } else {
            // In the dead zone between thresholds — reset both timers
            this.degradeTimer = 0;
            this.restoreTimer = 0;
        }
    }

    /** Drop one quality tier and update flags. */
    private degradeTier(): void {
        if (this.tier === 'high') {
            this.tier = 'medium';
        } else if (this.tier === 'medium') {
            this.tier = 'low';
        }
        this.applyFlags();
    }

    /** Raise one quality tier and update flags. */
    private restoreTier(): void {
        if (this.tier === 'low') {
            this.tier = 'medium';
        } else if (this.tier === 'medium') {
            this.tier = 'high';
        }
        this.applyFlags();
    }

    /** Set flags based on current tier. */
    private applyFlags(): void {
        // Smoke is NEVER disabled
        this.flags.smoke = true;

        if (this.tier === 'high') {
            this.flags.shadows = true;
            this.flags.haze = true;
            this.flags.breathPuffs = true;
            this.flags.puddles = true;
            this.flags.windParticles = true;
        } else if (this.tier === 'medium') {
            // Disable breathPuffs, puddles, windParticles
            this.flags.shadows = true;
            this.flags.haze = true;
            this.flags.breathPuffs = false;
            this.flags.puddles = false;
            this.flags.windParticles = false;
        } else {
            // Low: also disable shadows, haze
            this.flags.shadows = false;
            this.flags.haze = false;
            this.flags.breathPuffs = false;
            this.flags.puddles = false;
            this.flags.windParticles = false;
        }
    }

    /** Format the debug overlay text. */
    getDebugText(): string {
        const fpsInt = Math.round(this.fps);
        const tierLabel = this.tier.toUpperCase();

        if (this.tier === 'high') {
            return `FPS: ${fpsInt} | ${tierLabel} | All effects on`;
        }

        const disabled: string[] = [];
        if (!this.flags.breathPuffs) disabled.push('-breath');
        if (!this.flags.puddles) disabled.push('-puddles');
        if (!this.flags.windParticles) disabled.push('-wind');
        if (!this.flags.shadows) disabled.push('-shadows');
        if (!this.flags.haze) disabled.push('-haze');

        return `FPS: ${fpsInt} | ${tierLabel} | ${disabled.join(' ')}`;
    }
}
