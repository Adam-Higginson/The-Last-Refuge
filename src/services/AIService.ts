// AIService.ts — LLM integration + deterministic fallback for Extiris AI.
// Registered via ServiceLocator. Handles API calls to Claude Haiku,
// with automatic fallback to deterministic patrol logic on any failure.

export interface ExtirisStatePayload {
    turn: number;
    self: { x: number; y: number; movementBudget: number; sensorRadius: number };
    visibleEntities: Array<{
        type: 'planet' | 'ship' | 'star' | 'scout';
        name: string;
        x: number;
        y: number;
        distance: number;
    }>;
    memory: {
        lastSeenPlayerPos: { x: number; y: number; turnsSinceLastSeen: number } | null;
        visitedPositions: Array<{ x: number; y: number }>;
        knownPlanets: Array<{ name: string; x: number; y: number; turnsSinceLastVisit: number | null }>;
        previousReasoning: string;
    };
    worldBounds: { min: number; max: number };
}

export interface ExtirisAIResponse {
    action: 'move';
    target: { x: number; y: number };
    reasoning: string;
}

interface AIServiceConfig {
    apiKey?: string;
    model?: string;
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const LLM_TIMEOUT_MS = 10_000;

function isDebugEnabled(): boolean {
    try {
        return localStorage.getItem('extiris-debug') === 'true';
    } catch {
        return false;
    }
}

export class AIService {
    private apiKey: string | null = null;
    private model = DEFAULT_MODEL;

    get useDeterministic(): boolean {
        return this.apiKey === null;
    }

    configure(config: AIServiceConfig): void {
        if (config.apiKey !== undefined) {
            this.apiKey = config.apiKey || null;
        }
        if (config.model) {
            this.model = config.model;
        }
    }

    async requestMove(
        payload: ExtirisStatePayload,
        signal?: AbortSignal,
    ): Promise<ExtirisAIResponse> {
        if (this.useDeterministic) {
            if (isDebugEnabled()) {
                console.log('[Extiris AI] Mode: DETERMINISTIC (no API key)');
            }
            return this.deterministicMove(payload);
        }

        try {
            if (isDebugEnabled()) {
                console.log(`[Extiris AI] Mode: LLM (${this.model})`);
            }
            const response = await this.llmMove(payload, signal);
            if (isDebugEnabled()) {
                console.log('[Extiris AI] LLM response received');
            }
            return response;
        } catch (err) {
            if (isDebugEnabled()) {
                console.warn('[Extiris AI] LLM call failed, falling back to DETERMINISTIC:', err);
            }
            return this.deterministicMove(payload);
        }
    }

    private async llmMove(
        payload: ExtirisStatePayload,
        signal?: AbortSignal,
    ): Promise<ExtirisAIResponse> {
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), LLM_TIMEOUT_MS);

        // Combine external signal with timeout
        const combinedSignal = signal
            ? AbortSignal.any([signal, timeoutController.signal])
            : timeoutController.signal;

        try {
            const systemPrompt = this.buildSystemPrompt(payload);
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey ?? '',
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true',
                },
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 256,
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: JSON.stringify(payload) },
                    ],
                }),
                signal: combinedSignal,
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as {
                content?: Array<{ type: string; text?: string }>;
            };
            const text = data.content?.[0]?.text;
            if (!text) throw new Error('Empty response from API');

            return this.parseResponse(text);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    private buildSystemPrompt(payload: ExtirisStatePayload): string {
        return `You are the Extiris, an ancient alien hunter tracking a stolen vessel through a star system.
You are methodical, patient, and relentless. You cannot be reasoned with.

Rules:
- Move up to ${payload.self.movementBudget} world units per turn from your current position
- If you see the player ship, pursue it directly — highest priority
- If you see a scout, pursue it — scouts are reconnaissance vessels that lead back to the humans
- If you last saw the player, search that area
- If no leads, patrol toward planets you haven't visited recently (high turnsSinceLastVisit or null)
- Prefer unvisited planets (turnsSinceLastVisit=null), but revisit old ones after 8+ turns
- Stay within world bounds (${payload.worldBounds.min} to ${payload.worldBounds.max})

Respond with ONLY valid JSON: {"action":"move","target":{"x":N,"y":N},"reasoning":"brief note"}`;
    }

    private parseResponse(text: string): ExtirisAIResponse {
        // Try to extract JSON from response (LLM might wrap it in markdown)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');

        const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

        if (parsed.action !== 'move') throw new Error(`Unknown action: ${String(parsed.action)}`);

        const target = parsed.target as { x?: unknown; y?: unknown } | undefined;
        if (!target || typeof target.x !== 'number' || typeof target.y !== 'number') {
            throw new Error('Invalid target in response');
        }

        return {
            action: 'move',
            target: { x: target.x, y: target.y },
            reasoning: typeof parsed.reasoning === 'string'
                ? parsed.reasoning.slice(0, 200)
                : '',
        };
    }

    /** Deterministic fallback: pursue player if seen, search last known position, or patrol. */
    deterministicMove(payload: ExtirisStatePayload): ExtirisAIResponse {
        const { self, visibleEntities, memory, worldBounds } = payload;

        // Priority 1: Pursue visible player ship
        const playerShip = visibleEntities.find(e => e.type === 'ship');
        if (playerShip) {
            return this.clampMove(self, playerShip, payload, 'Pursuing visible player ship');
        }

        // Priority 2: Pursue visible scouts (they came from somewhere — hunt them)
        const visibleScouts = visibleEntities.filter(e => e.type === 'scout');
        if (visibleScouts.length > 0) {
            // Chase the closest scout
            let closestScout = visibleScouts[0];
            let closestScoutDist = Infinity;
            for (const scout of visibleScouts) {
                const sdx = scout.x - self.x;
                const sdy = scout.y - self.y;
                const sDist = Math.sqrt(sdx * sdx + sdy * sdy);
                if (sDist < closestScoutDist) {
                    closestScoutDist = sDist;
                    closestScout = scout;
                }
            }
            return this.clampMove(self, closestScout, payload, `Pursuing scout: ${closestScout.name}`);
        }

        // Priority 3: Search last known player position
        if (memory.lastSeenPlayerPos && memory.lastSeenPlayerPos.turnsSinceLastSeen < 5) {
            return this.clampMove(
                self,
                memory.lastSeenPlayerPos,
                payload,
                `Searching last known position (${memory.lastSeenPlayerPos.turnsSinceLastSeen} turns ago)`,
            );
        }

        // Priority 4: Patrol toward least-recently-visited planet
        // Prefer never-visited (null), then oldest visit (highest turnsSinceLastVisit)
        const REVISIT_THRESHOLD = 8;
        const patrolCandidates = memory.knownPlanets.filter(
            p => p.turnsSinceLastVisit === null || p.turnsSinceLastVisit >= REVISIT_THRESHOLD,
        );

        // Also consider visible planets not yet in knownPlanets
        const knownNames = new Set(memory.knownPlanets.map(p => p.name));
        const visiblePlanets = visibleEntities
            .filter(e => e.type === 'planet')
            .filter(e => !knownNames.has(e.name));

        const allTargets = [...patrolCandidates, ...visiblePlanets];
        if (allTargets.length > 0) {
            // Pick closest unvisited planet
            let closest = allTargets[0];
            let closestDist = Infinity;
            for (const target of allTargets) {
                const dx = target.x - self.x;
                const dy = target.y - self.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = target;
                }
            }
            return this.clampMove(self, closest, payload, `Patrolling toward ${('name' in closest) ? closest.name : 'planet'}`);
        }

        // Priority 5: Random patrol within world bounds
        const angle = Math.random() * Math.PI * 2;
        const dist = self.movementBudget * 0.8;
        const tx = Math.max(worldBounds.min, Math.min(worldBounds.max, self.x + Math.cos(angle) * dist));
        const ty = Math.max(worldBounds.min, Math.min(worldBounds.max, self.y + Math.sin(angle) * dist));

        return {
            action: 'move',
            target: { x: tx, y: ty },
            reasoning: 'Random patrol — no leads',
        };
    }

    private clampMove(
        self: { x: number; y: number; movementBudget: number },
        target: { x: number; y: number },
        payload: ExtirisStatePayload,
        reasoning: string,
    ): ExtirisAIResponse {
        const dx = target.x - self.x;
        const dy = target.y - self.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const { worldBounds } = payload;

        let tx: number;
        let ty: number;
        if (dist <= self.movementBudget) {
            tx = target.x;
            ty = target.y;
        } else {
            const scale = self.movementBudget / dist;
            tx = self.x + dx * scale;
            ty = self.y + dy * scale;
        }

        // Clamp to world bounds
        tx = Math.max(worldBounds.min, Math.min(worldBounds.max, tx));
        ty = Math.max(worldBounds.min, Math.min(worldBounds.max, ty));

        return {
            action: 'move',
            target: { x: tx, y: ty },
            reasoning,
        };
    }
}
