// PlanetDataComponent.ts — Stores planet configuration data on the entity.
// Allows systems and renderers to look up planet type, palette, etc.

import { Component } from '../core/Component';
import type { PlanetConfig } from '../data/planets';

export class PlanetDataComponent extends Component {
    readonly config: PlanetConfig;

    constructor(config: PlanetConfig) {
        super();
        this.config = config;
    }
}
