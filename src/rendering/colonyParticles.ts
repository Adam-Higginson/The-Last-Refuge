// colonyParticles.ts — Particle effects for colony scene (dust bursts, etc).

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    colour: string;
}

const particles: Particle[] = [];

/** Spawn a dust burst at the given position (e.g. on building placement). */
export function spawnDustBurst(x: number, y: number, count = 12): void {
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const speed = 20 + Math.random() * 40;
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed * 0.4 - Math.random() * 15,
            life: 0.6 + Math.random() * 0.4,
            maxLife: 0.6 + Math.random() * 0.4,
            size: 2 + Math.random() * 3,
            colour: `rgba(${140 + Math.floor(Math.random() * 40)}, ${120 + Math.floor(Math.random() * 30)}, ${80 + Math.floor(Math.random() * 30)}, 1)`,
        });
    }
}

/** Update and draw all active particles. Call each frame. */
export function drawParticles(ctx: CanvasRenderingContext2D, dtSeconds: number): void {
    if (particles.length === 0) return;

    ctx.save();
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dtSeconds;
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        p.x += p.vx * dtSeconds;
        p.y += p.vy * dtSeconds;
        p.vy += 30 * dtSeconds; // gravity
        p.vx *= 0.97; // drag

        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = p.colour;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}
