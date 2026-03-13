// RenderSystem.ts — Draws all entities with RenderComponent to the canvas.
// Sorts by render layer, passes transform data to each entity's draw function.
// Applies camera transform for world/foreground layers so world-space
// coordinates map to screen positions. Background and HUD layers are screen-space.
// Draw functions that need screen-space within world layers (e.g. planet
// surface, transitions) can reset the transform with ctx.setTransform(1,0,0,1,0,0).

import { System } from '../core/System';
import { ServiceLocator } from '../core/ServiceLocator';
import { RenderComponent, RenderLayer } from '../components/RenderComponent';
import { TransformComponent } from '../components/TransformComponent';
import { CameraComponent } from '../components/CameraComponent';
import type { World } from '../core/World';

const LAYER_ORDER: readonly RenderLayer[] = ['background', 'world', 'foreground', 'hud'];

/** Layers that render in world space (camera transform applied). */
const WORLD_SPACE_LAYERS: ReadonlySet<RenderLayer> = new Set(['world', 'foreground']);

export class RenderSystem extends System {
    private ctx!: CanvasRenderingContext2D;
    private canvas!: HTMLCanvasElement;

    init(world: World): void {
        super.init(world);
        this.canvas = ServiceLocator.get<HTMLCanvasElement>('canvas');
        this.ctx = ServiceLocator.get<CanvasRenderingContext2D>('ctx');
    }

    update(_dt: number): void {
        // RenderSystem does its work in render(), not update()
    }

    render(_alpha: number): void {
        const { ctx, canvas } = this;

        // Clear the entire canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Get camera for world-space transform
        const cameraEntity = this.world.getEntityByName('camera');
        const camera = cameraEntity?.getComponent(CameraComponent) ?? null;

        // Collect all entities that have a RenderComponent
        const entities = this.world.getEntitiesWithComponent(RenderComponent);

        // Sort by layer order: background → world → foreground → hud
        entities.sort((a, b) => {
            const renderA = a.getComponent(RenderComponent);
            const renderB = b.getComponent(RenderComponent);
            if (!renderA || !renderB) return 0;
            return LAYER_ORDER.indexOf(renderA.layer) - LAYER_ORDER.indexOf(renderB.layer);
        });

        // Draw each visible entity
        for (const entity of entities) {
            const render = entity.getComponent(RenderComponent);
            if (!render || !render.visible) continue;

            const transform = entity.getComponent(TransformComponent);
            const x = transform ? transform.x : 0;
            const y = transform ? transform.y : 0;
            const angle = transform ? transform.angle : 0;
            const scale = transform ? transform.scale : 1;

            // Apply camera transform for world-space layers
            const useCamera = camera != null && WORLD_SPACE_LAYERS.has(render.layer);

            ctx.save();
            if (useCamera) {
                camera.applyTransform(ctx);
            }
            render.draw(ctx, x, y, angle, scale, _alpha);
            ctx.restore();
        }
    }
}
