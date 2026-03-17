// RenderQueue.ts — Depth-sorted render queue for isometric colony scene.
// Collects Renderable items, sorts by depth (gridX + gridY), and draws
// in correct back-to-front order so buildings occlude colonists behind them.

/** Priority order for tie-breaking at same depth. */
const KIND_PRIORITY: Record<string, number> = {
    'building': 0,
    'prop': 1,
    'empty-slot': 2,
    'colonist': 3,
};

/** A single drawable item in the depth-sorted render queue. */
export interface Renderable {
    /** Isometric depth: gridX + gridY. Higher = closer to camera. */
    depth: number;
    /** Entity kind for tie-breaking and hit-testing. */
    kind: 'building' | 'colonist' | 'empty-slot' | 'prop';
    /** Screen X position (for debug overlay + hit-testing). */
    screenX: number;
    /** Screen Y position (for debug overlay + hit-testing). */
    screenY: number;
    /** Debug label. */
    label?: string;
    /** Draw callback — called in sorted order. */
    draw: (ctx: CanvasRenderingContext2D) => void;
    /** Optional entity ID for hit-testing (colonist entityId or slot index). */
    entityId?: number;
    /** Optional slot index for hit-testing. */
    slotIndex?: number;
    /** Optional hit rect for building/empty-slot hit-testing. */
    hitRect?: { x: number; y: number; width: number; height: number };
    /** Optional hit radius for colonist hit-testing. */
    hitRadius?: number;
}

/** Item extracted from RenderQueue for input hit-testing. */
export interface HitTestItem {
    kind: 'building' | 'colonist' | 'empty-slot' | 'prop';
    depth: number;
    screenX: number;
    screenY: number;
    entityId?: number;
    slotIndex?: number;
    hitRect?: { x: number; y: number; width: number; height: number };
    hitRadius?: number;
}

export class RenderQueue {
    private items: Renderable[] = [];

    /** Add a renderable item to the queue. */
    add(item: Renderable): void {
        this.items.push(item);
    }

    /** Sort items by depth ascending, then by kind priority for ties. */
    sort(): void {
        this.items.sort((a, b) => {
            const depthDiff = a.depth - b.depth;
            if (depthDiff !== 0) return depthDiff;
            return (KIND_PRIORITY[a.kind] ?? 0) - (KIND_PRIORITY[b.kind] ?? 0);
        });
    }

    /** Draw all items in sorted order. */
    drawAll(ctx: CanvasRenderingContext2D): void {
        for (const item of this.items) {
            item.draw(ctx);
        }
    }

    /** Draw colour-coded depth debug overlay (blue=far → red=near). */
    drawDebug(ctx: CanvasRenderingContext2D): void {
        if (this.items.length === 0) return;

        let minDepth = Infinity;
        let maxDepth = -Infinity;
        for (const item of this.items) {
            if (item.depth < minDepth) minDepth = item.depth;
            if (item.depth > maxDepth) maxDepth = item.depth;
        }
        const range = maxDepth - minDepth || 1;

        ctx.save();
        ctx.font = '9px "Share Tech Mono", "Courier New", monospace';
        ctx.textAlign = 'center';

        for (const item of this.items) {
            const t = (item.depth - minDepth) / range; // 0=far, 1=near
            // Blue (far) → Red (near) lerp
            const r = Math.round(50 + t * 205);
            const g = Math.round(50 + (1 - Math.abs(t - 0.5) * 2) * 100);
            const b = Math.round(255 - t * 205);

            const label = `${item.kind} d=${item.depth.toFixed(1)}`;
            const textWidth = ctx.measureText(label).width;
            const pillW = textWidth + 8;
            const pillH = 14;
            const px = item.screenX - pillW / 2;
            const py = item.screenY - 30 - pillH / 2;

            // Background pill
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
            ctx.beginPath();
            ctx.roundRect(px, py, pillW, pillH, 3);
            ctx.fill();

            // Text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, item.screenX, py + 10);
        }

        ctx.restore();
    }

    /** Remove all items from the queue. */
    clear(): void {
        this.items = [];
    }

    /** Get items in current order (sorted or insertion order). */
    getItems(): readonly Renderable[] {
        return this.items;
    }
}

/** Extract hit-test items from a sorted RenderQueue. */
export function extractHitTestItems(queue: RenderQueue): HitTestItem[] {
    const items: HitTestItem[] = [];
    for (const r of queue.getItems()) {
        // Only include items with hit-testing data
        if (r.hitRect || r.hitRadius) {
            items.push({
                kind: r.kind,
                depth: r.depth,
                screenX: r.screenX,
                screenY: r.screenY,
                entityId: r.entityId,
                slotIndex: r.slotIndex,
                hitRect: r.hitRect,
                hitRadius: r.hitRadius,
            });
        }
    }
    return items;
}
