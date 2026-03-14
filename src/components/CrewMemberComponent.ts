// CrewMemberComponent.ts — Data for a single human crew member.
// Human entities have this instead of a TransformComponent.

import { Component } from '../core/Component';

export interface Relationship {
    targetId: number;        // entity ID of the other human
    targetName: string;
    type: 'Close Bond' | 'Romantic' | 'Mentor/Protege' | 'Rival' | 'Estranged';
    description: string;
}

export type CrewRole = 'Engineer' | 'Soldier' | 'Medic' | 'Scientist' | 'Civilian';

export type CrewLocation =
    | { type: 'ship' }
    | { type: 'colony'; regionId: number; planetEntityId: number };

export type Trait =
    | 'Stubborn' | 'Empathetic' | 'Reckless' | 'Analytical'
    | 'Protective' | 'Haunted' | 'Resourceful' | 'Quiet'
    | 'Hopeful' | 'Grieving' | 'Determined';

export class CrewMemberComponent extends Component {
    fullName: string;
    age: number;
    role: CrewRole;
    morale: number;
    traits: [Trait, Trait];
    relationships: Relationship[];
    location: CrewLocation;

    constructor(
        fullName: string,
        age: number,
        role: CrewRole,
        morale: number,
        traits: [Trait, Trait],
    ) {
        super();
        this.fullName = fullName;
        this.age = age;
        this.role = role;
        this.morale = morale;
        this.traits = traits;
        this.relationships = [];
        this.location = { type: 'ship' };
    }
}
