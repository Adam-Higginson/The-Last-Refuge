// RegionDataComponent.ts — Planet surface regions and biome data.
// Attached to the planet entity. Read by the planet view renderer.

import { Component } from '../core/Component';

export interface Region {
    id: number;
    biome: 'Temperate Plains' | 'Arctic Wastes' | 'Dense Jungle' | 'Volcanic Highlands' | 'Ocean';
    colour: string;
    canColonise: boolean;
    colonised: boolean;
    isLandingZone: boolean;
    vertices: { x: number; y: number }[];
}

export class RegionDataComponent extends Component {
    regions: Region[];
    colonised: boolean;

    constructor() {
        super();
        this.regions = [];
        this.colonised = false;
    }
}
