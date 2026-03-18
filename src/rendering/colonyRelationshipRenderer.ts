// colonyRelationshipRenderer.ts — Relationship visual overlays for colony view.
// Only draws overlays for the selected colonist's relationships to avoid N² cost.

import { CrewMemberComponent } from '../components/CrewMemberComponent';
import { gridToScreen } from './isometric';
import type { ColonistVisualState } from '../colony/ColonistState';
import type { World } from '../core/World';

/** Draw relationship overlays for the selected colonist. */
export function drawRelationshipOverlays(
    ctx: CanvasRenderingContext2D,
    colonists: ColonistVisualState[],
    centreX: number,
    centreY: number,
    world: World,
    t: number,
    selectedColonistId: number | null,
): void {
    if (selectedColonistId === null) return;

    const selected = colonists.find(c => c.entityId === selectedColonistId);
    if (!selected) return;

    const entity = world.getEntity(selectedColonistId);
    const crew = entity?.getComponent(CrewMemberComponent);
    if (!crew) return;

    const selectedScreen = gridToScreen(selected.gridX, selected.gridY, centreX, centreY);

    ctx.save();

    for (const rel of crew.relationships) {
        const other = colonists.find(c => c.entityId === rel.targetId);
        if (!other) continue;

        const otherScreen = gridToScreen(other.gridX, other.gridY, centreX, centreY);

        switch (rel.type) {
            case 'Romantic':
                drawRomanticLine(ctx, selectedScreen, otherScreen, t);
                break;
            case 'Mentor/Protege':
                drawMentorIcon(ctx, otherScreen, t);
                break;
            case 'Rival': {
                const dx = Math.abs(selected.gridX - other.gridX);
                const dy = Math.abs(selected.gridY - other.gridY);
                if (dx + dy <= 3) {
                    drawRivalBolt(ctx, otherScreen, t);
                }
                break;
            }
        }
    }

    ctx.restore();
}

/** Subtle dotted line between romantic partners. */
function drawRomanticLine(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to: { x: number; y: number },
    t: number,
): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 150, 180, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.lineDashOffset = -t / 200;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y - 10);
    ctx.lineTo(to.x, to.y - 10);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

/** Book icon above protege to show mentor/protege relationship. */
function drawMentorIcon(
    ctx: CanvasRenderingContext2D,
    pos: { x: number; y: number },
    _t: number,
): void {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#a0d0ff';
    ctx.font = '10px "Share Tech Mono"';
    ctx.textAlign = 'center';
    ctx.fillText('\u{1F4D6}', pos.x, pos.y - 30);
    ctx.restore();
}

/** Lightning bolt near rival when adjacent. */
function drawRivalBolt(
    ctx: CanvasRenderingContext2D,
    pos: { x: number; y: number },
    t: number,
): void {
    const flash = Math.sin(t / 300) > 0.5 ? 1 : 0.3;
    ctx.save();
    ctx.globalAlpha = flash * 0.7;
    ctx.fillStyle = '#ff6644';
    ctx.font = '12px "Share Tech Mono"';
    ctx.textAlign = 'center';
    ctx.fillText('\u26A1', pos.x + 8, pos.y - 25);
    ctx.restore();
}

/** Draw a thought bubble above a colonist. */
export function drawThoughtBubble(
    ctx: CanvasRenderingContext2D,
    x: number, y: number,
    text: string,
    timer: number,
    maxTime: number,
): void {
    // Fade in for first 0.5s, fade out for last 1s
    let alpha = 1.0;
    const elapsed = maxTime - timer;
    if (elapsed < 0.5) alpha = elapsed / 0.5;
    if (timer < 1.0) alpha = Math.min(alpha, timer);

    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha * 0.9;

    // Measure text for bubble sizing
    ctx.font = '9px "Share Tech Mono", "Courier New", monospace';
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const padding = 6;
    const bw = textWidth + padding * 2;
    const bh = 16;
    const bx = x - bw / 2;
    const by = y - 45 - bh;

    // Cloud bubble background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    const r = 4;
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bw - r, by);
    ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + r);
    ctx.lineTo(bx + bw, by + bh - r);
    ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - r, by + bh);
    ctx.lineTo(bx + r, by + bh);
    ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.fill();

    // Small circles leading down to head
    ctx.beginPath();
    ctx.arc(x - 2, by + bh + 4, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, by + bh + 8, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Text
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, by + bh - 4);

    ctx.restore();
}
