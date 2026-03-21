// ParticlePool.ts — Pre-allocated particle pool for zero-allocation particle effects.

export interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;       // 0-1, decreases over time
    maxLife: number;     // total lifetime in seconds
    size: number;
    alpha: number;
    color: string;
    active: boolean;
}

export type ParticleSpawnConfig = Partial<Particle> & { x: number; y: number };

export class ParticlePool {
    readonly particles: Particle[];

    constructor(maxSize: number) {
        this.particles = new Array<Particle>(maxSize);
        for (let i = 0; i < maxSize; i++) {
            this.particles[i] = {
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                life: 0,
                maxLife: 1,
                size: 2,
                alpha: 0.2,
                color: '#999',
                active: false,
            };
        }
    }

    /** Find the first inactive particle and reset it with the given config. */
    spawn(config: ParticleSpawnConfig): void {
        const len = this.particles.length;
        for (let i = 0; i < len; i++) {
            const p = this.particles[i];
            if (!p.active) {
                p.x = config.x;
                p.y = config.y;
                p.vx = config.vx ?? 0;
                p.vy = config.vy ?? -20;
                p.life = config.life ?? 1;
                p.maxLife = config.maxLife ?? 2;
                p.size = config.size ?? 3;
                p.alpha = config.alpha ?? 0.2;
                p.color = config.color ?? '#999';
                p.active = true;
                return;
            }
        }
        // Pool exhausted — silently drop the particle
    }

    /** Advance all active particles. Wind is applied as additional velocity. */
    update(dt: number, windX: number, windY: number): void {
        const len = this.particles.length;
        for (let i = 0; i < len; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            p.x += (p.vx + windX) * dt;
            p.y += (p.vy + windY) * dt;
            p.life -= dt / p.maxLife;

            if (p.life <= 0) {
                p.active = false;
            }
        }
    }

    /** Draw all active particles. Single save/restore wrapping all particles. */
    draw(ctx: CanvasRenderingContext2D): void {
        ctx.save();
        const len = this.particles.length;
        for (let i = 0; i < len; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            // Alpha fades from initial alpha down to 0 as life goes from 1 to 0
            ctx.globalAlpha = p.alpha * p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * (0.6 + p.life * 0.4), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    /** Count of currently active particles. */
    get activeCount(): number {
        let count = 0;
        const len = this.particles.length;
        for (let i = 0; i < len; i++) {
            if (this.particles[i].active) count++;
        }
        return count;
    }
}
