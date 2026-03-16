// RelationshipGraphComponent.ts — Full-screen SVG relationship graph overlay.
// Social intelligence hub showing all crew relationships with force-directed layout.
// Follows TransferScreenComponent pattern: lives on the HUD entity.

import './RelationshipGraphComponent.css';

import { Component } from '../core/Component';
import { ServiceLocator } from '../core/ServiceLocator';
import { CrewMemberComponent } from './CrewMemberComponent';
import { getRelationshipColour } from '../utils/colourUtils';
import { forceLayout, computeConvexHull, clampViewBox } from '../utils/graphMath';
import type { RelationshipType, CrewRole } from './CrewMemberComponent';
import type { PositionedNode, ViewBoxBounds } from '../utils/graphMath';
import type { World } from '../core/World';

// ─── Role colours ──────────────────────────────────────────────
const ROLE_COLOURS: Record<CrewRole, string> = {
    Soldier: '#cc4444',
    Engineer: '#4488cc',
    Medic: '#44cc66',
    Scientist: '#cc88ff',
    Civilian: '#888888',
};

// ─── Layout constants ──────────────────────────────────────────
const GRAPH_WIDTH = 1400;
const GRAPH_HEIGHT = 1000;
const LAYOUT_SEED = 7;
const PRECOMPUTE_ITERS = 80;
const ANIMATE_ITERS = 20;
const ANIMATE_INTERVAL_MS = 30;
const MIN_NODE_RADIUS = 6;
const MAX_NODE_RADIUS = 18;

interface NodeData {
    entityId: number;
    name: string;
    role: CrewRole;
    morale: number;
    traits: [string, string];
    connectionCount: number;
    relationships: { targetId: number; targetName: string; type: RelationshipType; level: number; description: string }[];
}

interface EdgeData {
    sourceId: number;
    targetId: number;
    type: RelationshipType;
    level: number;
    descAB: string;
    descBA: string;
    nameA: string;
    nameB: string;
}

export class RelationshipGraphComponent extends Component {
    isOpen = false;

    private container: HTMLElement | null = null;
    private svg: SVGSVGElement | null = null;
    private cardEl: HTMLElement | null = null;
    private edgePopoverEl: HTMLElement | null = null;

    private nodes: NodeData[] = [];
    private edges: EdgeData[] = [];
    private positions: PositionedNode[] = [];

    private selectedNodeId: number | null = null;
    private focusEntityId: number | null = null;
    private showAllEdges = false;
    private activeFilter: RelationshipType | null = null;
    private searchQuery = '';

    private zoom = 1;
    private panX = 0;
    private panY = 0;
    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;
    private panStartX = 0;
    private panStartY = 0;

    private animationTimer: ReturnType<typeof setInterval> | null = null;
    private animationStep = 0;

    private onKeyDown: ((e: KeyboardEvent) => void) | null = null;
    private onWheel: ((e: WheelEvent) => void) | null = null;
    private onMouseDown: ((e: MouseEvent) => void) | null = null;
    private onMouseMove: ((e: MouseEvent) => void) | null = null;
    private onMouseUp: ((e: MouseEvent) => void) | null = null;
    private onTouchStart: ((e: TouchEvent) => void) | null = null;
    private onTouchMove: ((e: TouchEvent) => void) | null = null;
    private onTouchEnd: ((e: TouchEvent) => void) | null = null;
    private lastPinchDist: number | null = null;

    private viewBoxBounds: ViewBoxBounds = {
        minZoom: 0.4,
        maxZoom: 3,
        worldWidth: GRAPH_WIDTH,
        worldHeight: GRAPH_HEIGHT,
    };

    init(): void {
        this.container = document.getElementById('relationship-graph-screen');
    }

    /** Open the graph. Optionally focus on a specific crew member. */
    open(focusEntityId?: number): void {
        if (!this.container) return;
        this.isOpen = true;
        this.focusEntityId = focusEntityId ?? null;
        this.selectedNodeId = focusEntityId ?? null;
        this.showAllEdges = false;
        this.activeFilter = null;
        this.searchQuery = '';
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;

        this.buildGraphData();
        this.precomputeLayout();
        this.render();
        this.container.classList.add('open');
        this.wireEvents();

        // Animate remaining iterations for satisfying settle
        this.animationStep = 0;
        this.animationTimer = setInterval(() => {
            this.animateStep();
        }, ANIMATE_INTERVAL_MS);

        // Auto-focus if entity specified
        if (this.focusEntityId !== null) {
            this.zoomToNode(this.focusEntityId);
        }
    }

    /** Close the graph. */
    close(): void {
        if (!this.container) return;
        this.isOpen = false;
        this.container.classList.remove('open');
        this.unwireEvents();
        if (this.animationTimer !== null) {
            clearInterval(this.animationTimer);
            this.animationTimer = null;
        }
    }

    // ─── Data building ─────────────────────────────────────────────

    private buildGraphData(): void {
        const world = ServiceLocator.get<World>('world');
        const entities = world.getEntitiesWithComponent(CrewMemberComponent);

        this.nodes = [];
        this.edges = [];
        const edgeSet = new Set<string>();

        for (const entity of entities) {
            const crew = entity.getComponent(CrewMemberComponent);
            if (!crew) continue;

            this.nodes.push({
                entityId: entity.id,
                name: crew.fullName,
                role: crew.role,
                morale: crew.morale,
                traits: [...crew.traits],
                connectionCount: crew.relationships.length,
                relationships: crew.relationships.map(r => ({
                    targetId: r.targetId,
                    targetName: r.targetName,
                    type: r.type,
                    level: r.level,
                    description: r.description,
                })),
            });

            for (const rel of crew.relationships) {
                const key = [Math.min(entity.id, rel.targetId), Math.max(entity.id, rel.targetId)].join('-');
                if (edgeSet.has(key)) continue;
                edgeSet.add(key);

                // Find the reverse description
                const targetEntity = entities.find(e => e.id === rel.targetId);
                const targetCrew = targetEntity?.getComponent(CrewMemberComponent);
                const reverseRel = targetCrew?.relationships.find(r => r.targetId === entity.id);

                this.edges.push({
                    sourceId: entity.id,
                    targetId: rel.targetId,
                    type: rel.type,
                    level: rel.level,
                    descAB: rel.description,
                    descBA: reverseRel?.description ?? '',
                    nameA: crew.fullName,
                    nameB: rel.targetName,
                });
            }
        }
    }

    // ─── Layout ────────────────────────────────────────────────────

    private precomputeLayout(): void {
        const graphNodes = this.nodes.map(n => ({
            id: n.entityId,
            x: GRAPH_WIDTH / 2,
            y: GRAPH_HEIGHT / 2,
            connectionCount: n.connectionCount,
        }));

        const graphEdges = this.edges.map(e => ({
            source: e.sourceId,
            target: e.targetId,
        }));

        this.positions = forceLayout(graphNodes, graphEdges, {
            iterations: PRECOMPUTE_ITERS,
            width: GRAPH_WIDTH,
            height: GRAPH_HEIGHT,
            seed: LAYOUT_SEED,
            repulsion: 4000,
            springStrength: 0.008,
            damping: 0.85,
        });
    }

    private animateStep(): void {
        if (this.animationStep >= ANIMATE_ITERS) {
            if (this.animationTimer !== null) {
                clearInterval(this.animationTimer);
                this.animationTimer = null;
            }
            return;
        }

        const graphNodes = this.positions.map(p => {
            const node = this.nodes.find(n => n.entityId === p.id);
            return {
                id: p.id,
                x: p.x,
                y: p.y,
                connectionCount: node?.connectionCount ?? 0,
            };
        });

        const graphEdges = this.edges.map(e => ({
            source: e.sourceId,
            target: e.targetId,
        }));

        this.positions = forceLayout(graphNodes, graphEdges, {
            iterations: 1,
            width: GRAPH_WIDTH,
            height: GRAPH_HEIGHT,
            seed: LAYOUT_SEED + this.animationStep,
            repulsion: 4000,
            springStrength: 0.008,
            damping: 0.85,
        });

        this.animationStep++;
        this.updateNodePositions();
    }

    // ─── Rendering ─────────────────────────────────────────────────

    private render(): void {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="graph-header">
                <span class="graph-title">Social Graph</span>
                <button class="graph-close-btn" id="graph-close-btn" type="button">← BACK</button>
            </div>
            <div class="graph-controls">
                <input class="graph-search" id="graph-search" type="text" placeholder="Search crew..." value="${this.searchQuery}">
                <button class="graph-filter-btn ${this.activeFilter === null ? 'active' : ''}" data-filter="all">ALL</button>
                <button class="graph-filter-btn ${this.activeFilter === 'Close Bond' ? 'active' : ''}" data-filter="Close Bond">CLOSE BOND</button>
                <button class="graph-filter-btn ${this.activeFilter === 'Romantic' ? 'active' : ''}" data-filter="Romantic">ROMANTIC</button>
                <button class="graph-filter-btn ${this.activeFilter === 'Mentor/Protege' ? 'active' : ''}" data-filter="Mentor/Protege">MENTOR</button>
                <button class="graph-filter-btn ${this.activeFilter === 'Rival' ? 'active' : ''}" data-filter="Rival">RIVAL</button>
                <button class="graph-filter-btn ${this.activeFilter === 'Estranged' ? 'active' : ''}" data-filter="Estranged">ESTRANGED</button>
                <button class="graph-filter-btn graph-toggle-edges ${this.showAllEdges ? 'active' : ''}" id="graph-toggle-edges">
                    ${this.showAllEdges ? 'HIDE EDGES' : 'SHOW ALL EDGES'}
                </button>
            </div>
            <div class="graph-svg-container" id="graph-svg-container">
                ${this.buildSVG()}
                <div id="graph-card-container"></div>
                <div id="graph-edge-popover-container"></div>
                ${this.buildLegend()}
            </div>
        `;

        this.svg = this.container.querySelector('.graph-svg') as SVGSVGElement | null;
        this.cardEl = document.getElementById('graph-card-container');
        this.edgePopoverEl = document.getElementById('graph-edge-popover-container');
    }

    private buildSVG(): string {
        const vb = this.getViewBox();
        const maxConns = Math.max(...this.nodes.map(n => n.connectionCount), 1);

        let svg = `<svg class="graph-svg" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" xmlns="http://www.w3.org/2000/svg">`;

        // Role cluster backgrounds
        svg += this.buildClusters();

        // Edges
        for (const edge of this.edges) {
            const visible = this.isEdgeVisible(edge);
            const highlight = this.isEdgeHighlighted(edge);
            const dimmed = this.selectedNodeId !== null && !highlight && !this.showAllEdges;
            const colour = getRelationshipColour(edge.level);
            const thickness = 1 + (edge.level / 100) * 3;

            const posA = this.positions.find(p => p.id === edge.sourceId);
            const posB = this.positions.find(p => p.id === edge.targetId);
            if (!posA || !posB) continue;

            const classes = ['graph-edge'];
            if (visible) classes.push('visible');
            if (highlight) classes.push('highlight');
            if (dimmed) classes.push('dimmed');

            svg += `<line class="${classes.join(' ')}"
                x1="${posA.x}" y1="${posA.y}" x2="${posB.x}" y2="${posB.y}"
                stroke="${colour}" stroke-width="${thickness}"
                data-source="${edge.sourceId}" data-target="${edge.targetId}" />`;
        }

        // Nodes
        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            const pos = this.positions.find(p => p.id === node.entityId);
            if (!pos) continue;

            const r = MIN_NODE_RADIUS + (node.connectionCount / maxConns) * (MAX_NODE_RADIUS - MIN_NODE_RADIUS);
            const colour = ROLE_COLOURS[node.role];
            const isSelected = this.selectedNodeId === node.entityId;
            const isConnected = this.selectedNodeId !== null && this.isConnected(this.selectedNodeId, node.entityId);
            const isDimmed = this.selectedNodeId !== null && !isSelected && !isConnected;
            const matchesSearch = this.matchesSearch(node);

            const classes = ['graph-node'];
            if (isDimmed && !matchesSearch) classes.push('dimmed');
            if (isSelected || isConnected) classes.push('highlight');

            const labelClasses = ['graph-node-label'];
            if (isDimmed && !matchesSearch) labelClasses.push('dimmed');

            svg += `<g class="${classes.join(' ')}" data-entity-id="${node.entityId}">
                <circle cx="${pos.x}" cy="${pos.y}" r="${r}" fill="${colour}" opacity="0.85"
                    stroke="${isSelected ? '#ffffff' : 'rgba(255,255,255,0.2)'}"
                    stroke-width="${isSelected ? 2 : 0.5}" />
                <text class="${labelClasses.join(' ')}" x="${pos.x}" y="${pos.y + r + 12}">${this.shortName(node.name)}</text>
            </g>`;
        }

        svg += '</svg>';
        return svg;
    }

    private buildClusters(): string {
        let svg = '';
        const roles: CrewRole[] = ['Soldier', 'Engineer', 'Medic', 'Scientist', 'Civilian'];

        for (const role of roles) {
            const roleNodes = this.nodes
                .filter(n => n.role === role)
                .map(n => this.positions.find(p => p.id === n.entityId))
                .filter((p): p is PositionedNode => p !== undefined);

            if (roleNodes.length < 3) continue;

            const hull = computeConvexHull(roleNodes);
            if (hull.length < 3) continue;

            // Expand hull slightly for padding
            const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
            const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
            const expanded = hull.map(p => ({
                x: p.x + (p.x - cx) * 0.15,
                y: p.y + (p.y - cy) * 0.15,
            }));

            const pathData = expanded.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
            svg += `<path class="graph-cluster" d="${pathData}" fill="${ROLE_COLOURS[role]}" stroke="${ROLE_COLOURS[role]}" />`;
        }

        return svg;
    }

    private buildLegend(): string {
        return `<div class="graph-legend">
            <div class="graph-legend-title">Legend</div>
            <div class="graph-legend-row"><span class="graph-legend-swatch" style="background:${ROLE_COLOURS.Soldier}"></span> Soldier</div>
            <div class="graph-legend-row"><span class="graph-legend-swatch" style="background:${ROLE_COLOURS.Engineer}"></span> Engineer</div>
            <div class="graph-legend-row"><span class="graph-legend-swatch" style="background:${ROLE_COLOURS.Medic}"></span> Medic</div>
            <div class="graph-legend-row"><span class="graph-legend-swatch" style="background:${ROLE_COLOURS.Scientist}"></span> Scientist</div>
            <div class="graph-legend-row"><span class="graph-legend-swatch" style="background:${ROLE_COLOURS.Civilian}"></span> Civilian</div>
            <div style="margin-top:6px">
                <div class="graph-legend-row"><span class="graph-legend-line" style="background:#cc4444"></span> Hostile (0-25)</div>
                <div class="graph-legend-row"><span class="graph-legend-line" style="background:#cc8844"></span> Tense (26-50)</div>
                <div class="graph-legend-row"><span class="graph-legend-line" style="background:#ccaa44"></span> Warm (51-75)</div>
                <div class="graph-legend-row"><span class="graph-legend-line" style="background:#44cc66"></span> Strong (76-100)</div>
            </div>
        </div>`;
    }

    // ─── Visibility helpers ────────────────────────────────────────

    private isEdgeVisible(edge: EdgeData): boolean {
        if (this.activeFilter !== null && edge.type !== this.activeFilter) return false;
        if (this.showAllEdges) return true;
        if (this.selectedNodeId === null) return false;
        return edge.sourceId === this.selectedNodeId || edge.targetId === this.selectedNodeId;
    }

    private isEdgeHighlighted(edge: EdgeData): boolean {
        if (this.selectedNodeId === null) return false;
        if (this.activeFilter !== null && edge.type !== this.activeFilter) return false;
        return edge.sourceId === this.selectedNodeId || edge.targetId === this.selectedNodeId;
    }

    private isConnected(nodeA: number, nodeB: number): boolean {
        return this.edges.some(e =>
            (e.sourceId === nodeA && e.targetId === nodeB) ||
            (e.sourceId === nodeB && e.targetId === nodeA),
        );
    }

    private matchesSearch(node: NodeData): boolean {
        if (!this.searchQuery) return false;
        return node.name.toLowerCase().includes(this.searchQuery.toLowerCase());
    }

    private shortName(fullName: string): string {
        // Drop titles for label brevity
        const cleaned = fullName
            .replace(/^(Commander|Lt\.|Sgt\.|Cpl\.|Pvt\.|Dr\.|Prof\.|Chief|Nurse|Medic|Old)\s+/i, '');
        const parts = cleaned.split(' ');
        if (parts.length >= 2) {
            return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
        }
        return parts[0];
    }

    // ─── ViewBox / zoom / pan ──────────────────────────────────────

    private getViewBox(): { x: number; y: number; width: number; height: number } {
        return clampViewBox(GRAPH_WIDTH, GRAPH_HEIGHT, this.zoom, this.panX, this.panY, this.viewBoxBounds);
    }

    private updateViewBox(): void {
        if (!this.svg) return;
        const vb = this.getViewBox();
        this.svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
    }

    private zoomToNode(entityId: number): void {
        const pos = this.positions.find(p => p.id === entityId);
        if (!pos) return;

        this.zoom = 1.8;
        const vb = clampViewBox(GRAPH_WIDTH, GRAPH_HEIGHT, this.zoom, 0, 0, this.viewBoxBounds);
        this.panX = pos.x - vb.width / 2;
        this.panY = pos.y - vb.height / 2;
        this.updateViewBox();
    }

    // ─── Node position updates (for animation) ────────────────────

    private updateNodePositions(): void {
        if (!this.svg) return;

        // Build a lookup map for O(1) position access
        const posMap = new Map<number, PositionedNode>();
        for (const p of this.positions) {
            posMap.set(p.id, p);
        }

        const nodeGroups = this.svg.querySelectorAll('.graph-node');
        for (const group of nodeGroups) {
            const entityId = parseInt((group as SVGElement).dataset.entityId ?? '0', 10);
            const pos = posMap.get(entityId);
            if (!pos) continue;

            const circle = group.querySelector('circle');
            const text = group.querySelector('text');
            if (circle) {
                circle.setAttribute('cx', String(pos.x));
                circle.setAttribute('cy', String(pos.y));
            }
            if (text) {
                text.setAttribute('x', String(pos.x));
                const r = parseFloat(circle?.getAttribute('r') ?? '8');
                text.setAttribute('y', String(pos.y + r + 12));
            }
        }

        // Update edges
        const edgeLines = this.svg.querySelectorAll('.graph-edge');
        for (const line of edgeLines) {
            const el = line as SVGLineElement;
            const source = parseInt(el.dataset.source ?? '0', 10);
            const target = parseInt(el.dataset.target ?? '0', 10);
            const posA = posMap.get(source);
            const posB = posMap.get(target);
            if (posA && posB) {
                el.setAttribute('x1', String(posA.x));
                el.setAttribute('y1', String(posA.y));
                el.setAttribute('x2', String(posB.x));
                el.setAttribute('y2', String(posB.y));
            }
        }

        // Update clusters
        this.updateClusters();
    }

    private updateClusters(): void {
        if (!this.svg) return;
        const paths = this.svg.querySelectorAll('.graph-cluster');
        // Remove old clusters and re-add
        for (const p of paths) p.remove();

        const clustersHTML = this.buildClusters();
        if (clustersHTML.length > 0) {
            // Insert at beginning of SVG (behind edges/nodes)
            const parser = new DOMParser();
            const doc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${clustersHTML}</svg>`, 'image/svg+xml');
            const elements = doc.documentElement.children;
            const firstChild = this.svg.firstChild;
            for (let i = elements.length - 1; i >= 0; i--) {
                const imported = document.importNode(elements[i], true);
                if (firstChild) {
                    this.svg.insertBefore(imported, firstChild);
                } else {
                    this.svg.appendChild(imported);
                }
            }
        }
    }

    // ─── Event wiring ──────────────────────────────────────────────

    private wireEvents(): void {
        // Remove prior window-level listeners to avoid stacking on re-wire
        this.unwireEvents();

        if (!this.container) return;

        // Close button
        this.container.querySelector('#graph-close-btn')?.addEventListener('click', () => this.close());

        // Escape key
        this.onKeyDown = (e: KeyboardEvent): void => {
            if (e.code === 'Escape') {
                e.stopImmediatePropagation();
                if (this.selectedNodeId !== null) {
                    this.selectedNodeId = null;
                    this.hideCard();
                    this.hideEdgePopover();
                    this.refreshVisuals();
                } else {
                    this.close();
                }
            }
        };
        window.addEventListener('keydown', this.onKeyDown);

        // Search input
        const searchInput = document.getElementById('graph-search') as HTMLInputElement | null;
        searchInput?.addEventListener('input', () => {
            this.searchQuery = searchInput.value;
            const match = this.nodes.find(n => this.matchesSearch(n));
            if (match) {
                this.selectedNodeId = match.entityId;
                this.zoomToNode(match.entityId);
            }
            this.refreshVisuals();
        });

        // Filter buttons
        for (const btn of this.container.querySelectorAll('.graph-filter-btn[data-filter]')) {
            btn.addEventListener('click', () => {
                const filter = (btn as HTMLElement).dataset.filter;
                if (filter === 'all') {
                    this.activeFilter = null;
                } else {
                    this.activeFilter = filter as RelationshipType;
                }
                this.render();
                this.wireEvents();
            });
        }

        // Toggle all edges
        this.container.querySelector('#graph-toggle-edges')?.addEventListener('click', () => {
            this.showAllEdges = !this.showAllEdges;
            this.render();
            this.wireEvents();
        });

        // Node clicks
        const svgContainer = document.getElementById('graph-svg-container');
        svgContainer?.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as SVGElement | HTMLElement;

            // Card detail button
            if (target.classList.contains('graph-card-detail-btn')) {
                return; // Handled separately
            }

            // Node click
            const nodeGroup = target.closest('.graph-node') as SVGElement | null;
            if (nodeGroup) {
                const entityId = parseInt(nodeGroup.dataset.entityId ?? '0', 10);
                if (this.selectedNodeId === entityId) {
                    this.selectedNodeId = null;
                    this.hideCard();
                } else {
                    this.selectedNodeId = entityId;
                    this.showCard(entityId, e.clientX, e.clientY);
                }
                this.hideEdgePopover();
                this.refreshVisuals();
                return;
            }

            // Edge click
            const edgeLine = target.closest('.graph-edge') as SVGLineElement | null;
            if (edgeLine) {
                const sourceId = parseInt(edgeLine.dataset.source ?? '0', 10);
                const targetId = parseInt(edgeLine.dataset.target ?? '0', 10);
                this.showEdgePopover(sourceId, targetId, e.clientX, e.clientY);
                return;
            }

            // Background click — deselect
            if (target.classList.contains('graph-svg') || target.tagName === 'svg') {
                this.selectedNodeId = null;
                this.hideCard();
                this.hideEdgePopover();
                this.refreshVisuals();
            }
        });

        // Zoom (wheel)
        this.onWheel = (e: WheelEvent): void => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.15 : 0.15;
            this.zoom = Math.max(this.viewBoxBounds.minZoom, Math.min(this.viewBoxBounds.maxZoom, this.zoom + delta));
            this.updateViewBox();
        };
        svgContainer?.addEventListener('wheel', this.onWheel, { passive: false });

        // Pan (mouse drag)
        this.onMouseDown = (e: MouseEvent): void => {
            if (e.button !== 0) return;
            // Don't start panning if clicking on a node
            const target = e.target as Element;
            if (target.closest('.graph-node') || target.closest('.graph-card') || target.closest('.graph-edge-popover')) return;

            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.panStartX = this.panX;
            this.panStartY = this.panY;
        };
        this.onMouseMove = (e: MouseEvent): void => {
            if (!this.isDragging || !this.svg) return;
            const vb = this.getViewBox();
            const svgRect = this.svg.getBoundingClientRect();
            const scaleX = vb.width / svgRect.width;
            const scaleY = vb.height / svgRect.height;
            this.panX = this.panStartX - (e.clientX - this.dragStartX) * scaleX;
            this.panY = this.panStartY - (e.clientY - this.dragStartY) * scaleY;
            this.updateViewBox();
        };
        this.onMouseUp = (): void => {
            this.isDragging = false;
        };
        svgContainer?.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);

        // Touch: pan + pinch zoom
        this.onTouchStart = (e: TouchEvent): void => {
            if (e.touches.length === 1) {
                const target = e.target as Element;
                if (target.closest('.graph-node') || target.closest('.graph-card')) return;
                this.isDragging = true;
                this.dragStartX = e.touches[0].clientX;
                this.dragStartY = e.touches[0].clientY;
                this.panStartX = this.panX;
                this.panStartY = this.panY;
            } else if (e.touches.length === 2) {
                this.lastPinchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY,
                );
            }
        };
        this.onTouchMove = (e: TouchEvent): void => {
            e.preventDefault();
            if (e.touches.length === 1 && this.isDragging && this.svg) {
                const vb = this.getViewBox();
                const svgRect = this.svg.getBoundingClientRect();
                const scaleX = vb.width / svgRect.width;
                const scaleY = vb.height / svgRect.height;
                this.panX = this.panStartX - (e.touches[0].clientX - this.dragStartX) * scaleX;
                this.panY = this.panStartY - (e.touches[0].clientY - this.dragStartY) * scaleY;
                this.updateViewBox();
            } else if (e.touches.length === 2 && this.lastPinchDist !== null) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY,
                );
                const scale = dist / this.lastPinchDist;
                this.zoom = Math.max(this.viewBoxBounds.minZoom, Math.min(this.viewBoxBounds.maxZoom, this.zoom * scale));
                this.lastPinchDist = dist;
                this.updateViewBox();
            }
        };
        this.onTouchEnd = (): void => {
            this.isDragging = false;
            this.lastPinchDist = null;
        };
        svgContainer?.addEventListener('touchstart', this.onTouchStart, { passive: true });
        svgContainer?.addEventListener('touchmove', this.onTouchMove, { passive: false });
        svgContainer?.addEventListener('touchend', this.onTouchEnd);
    }

    private unwireEvents(): void {
        if (this.onKeyDown) {
            window.removeEventListener('keydown', this.onKeyDown);
            this.onKeyDown = null;
        }
        if (this.onMouseMove) {
            window.removeEventListener('mousemove', this.onMouseMove);
            this.onMouseMove = null;
        }
        if (this.onMouseUp) {
            window.removeEventListener('mouseup', this.onMouseUp);
            this.onMouseUp = null;
        }
    }

    // ─── Mini crew card ────────────────────────────────────────────

    private showCard(entityId: number, clientX: number, clientY: number): void {
        if (!this.cardEl) return;

        const node = this.nodes.find(n => n.entityId === entityId);
        if (!node) return;

        const topRels = node.relationships.slice(0, 3);
        const relsHTML = topRels.map(r =>
            `<div>${r.targetName} — ${r.type} (${r.level})</div>`,
        ).join('');

        this.cardEl.innerHTML = `<div class="graph-card" style="left:${clientX + 10}px; top:${clientY + 10}px;">
            <div class="graph-card-name">${node.name}</div>
            <div class="graph-card-meta">${node.role} — Age ${node.morale > 0 ? node.morale : '?'}/100 morale</div>
            <div class="graph-card-traits">
                ${node.traits.map(t => `<span class="graph-card-trait">${t}</span>`).join('')}
            </div>
            <div class="graph-card-rels">${relsHTML}${node.relationships.length > 3 ? `<div>+${node.relationships.length - 3} more...</div>` : ''}</div>
            <button class="graph-card-detail-btn" id="graph-card-detail-btn" type="button">DETAIL →</button>
        </div>`;

        // Wire detail button
        this.cardEl.querySelector('#graph-card-detail-btn')?.addEventListener('click', () => {
            // Navigate to crew detail in the ship info panel
            // For now, just close the graph — the detail is accessible from the roster
            this.close();
        });

        // Clamp card position to viewport
        const card = this.cardEl.querySelector('.graph-card') as HTMLElement | null;
        if (card) {
            requestAnimationFrame(() => {
                const rect = card.getBoundingClientRect();
                if (rect.right > window.innerWidth) {
                    card.style.left = `${clientX - rect.width - 10}px`;
                }
                if (rect.bottom > window.innerHeight) {
                    card.style.top = `${clientY - rect.height - 10}px`;
                }
            });
        }
    }

    private hideCard(): void {
        if (this.cardEl) this.cardEl.innerHTML = '';
    }

    // ─── Edge popover ──────────────────────────────────────────────

    private showEdgePopover(sourceId: number, targetId: number, clientX: number, clientY: number): void {
        if (!this.edgePopoverEl) return;

        const edge = this.edges.find(e =>
            (e.sourceId === sourceId && e.targetId === targetId) ||
            (e.sourceId === targetId && e.targetId === sourceId),
        );
        if (!edge) return;

        const colour = getRelationshipColour(edge.level);

        this.edgePopoverEl.innerHTML = `<div class="graph-edge-popover" style="left:${clientX + 10}px; top:${clientY + 10}px;">
            <div class="graph-edge-popover-title" style="color:${colour}">${edge.type} — Level ${edge.level}</div>
            <div class="graph-edge-popover-perspective"><strong>${edge.nameA}:</strong> ${edge.descAB}</div>
            <div class="graph-edge-popover-perspective"><strong>${edge.nameB}:</strong> ${edge.descBA}</div>
        </div>`;
    }

    private hideEdgePopover(): void {
        if (this.edgePopoverEl) this.edgePopoverEl.innerHTML = '';
    }

    // ─── Visual refresh (without full re-render) ───────────────────

    private refreshVisuals(): void {
        if (!this.svg) return;

        // Update edge visibility
        const edgeLines = this.svg.querySelectorAll('.graph-edge');
        for (const line of edgeLines) {
            const el = line as SVGLineElement;
            const source = parseInt(el.dataset.source ?? '0', 10);
            const target = parseInt(el.dataset.target ?? '0', 10);
            const edge = this.edges.find(e =>
                (e.sourceId === source && e.targetId === target) ||
                (e.sourceId === target && e.targetId === source),
            );
            if (!edge) continue;

            const visible = this.isEdgeVisible(edge);
            const highlight = this.isEdgeHighlighted(edge);
            const dimmed = this.selectedNodeId !== null && !highlight && !this.showAllEdges;

            el.classList.toggle('visible', visible);
            el.classList.toggle('highlight', highlight);
            el.classList.toggle('dimmed', dimmed);
        }

        // Update node states
        const nodeGroups = this.svg.querySelectorAll('.graph-node');
        for (const group of nodeGroups) {
            const entityId = parseInt((group as SVGElement).dataset.entityId ?? '0', 10);
            const node = this.nodes.find(n => n.entityId === entityId);
            const isSelected = this.selectedNodeId === entityId;
            const isConnected = this.selectedNodeId !== null && this.isConnected(this.selectedNodeId, entityId);
            const isDimmed = this.selectedNodeId !== null && !isSelected && !isConnected;
            const matchSearch = node ? this.matchesSearch(node) : false;

            group.classList.toggle('dimmed', isDimmed && !matchSearch);
            group.classList.toggle('highlight', isSelected || isConnected);

            // Update stroke
            const circle = group.querySelector('circle');
            if (circle) {
                circle.setAttribute('stroke', isSelected ? '#ffffff' : 'rgba(255,255,255,0.2)');
                circle.setAttribute('stroke-width', isSelected ? '2' : '0.5');
            }

            // Update label
            const label = group.querySelector('.graph-node-label');
            if (label) {
                label.classList.toggle('dimmed', isDimmed && !matchSearch);
            }
        }
    }

    destroy(): void {
        this.unwireEvents();
        if (this.animationTimer !== null) {
            clearInterval(this.animationTimer);
        }
    }
}
