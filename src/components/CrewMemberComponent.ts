// CrewMemberComponent.ts — Data for a single human crew member.
// Human entities have this instead of a TransformComponent.

import { Component } from '../core/Component';

export type RelationshipType = 'Close Bond' | 'Romantic' | 'Mentor/Protege' | 'Rival' | 'Estranged';

export interface Relationship {
    targetId: number;        // entity ID of the other human
    targetName: string;
    type: RelationshipType;
    level: number;           // 0 = hatred, 100 = love — intensity of the relationship
    description: string;
}

export type CrewRole = 'Engineer' | 'Soldier' | 'Medic' | 'Scientist' | 'Civilian' | 'Pilot';

export type CrewLocation =
    | { type: 'ship' }
    | { type: 'colony'; regionId: number; planetEntityId: number }
    | { type: 'scout'; scoutEntityId: number }
    | { type: 'dead' };

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
    backstory: string;
    relationships: Relationship[];
    location: CrewLocation;
    isLeader: boolean;
    isCaptain: boolean;

    constructor(
        fullName: string,
        age: number,
        role: CrewRole,
        morale: number,
        traits: [Trait, Trait],
        backstory: string,
    ) {
        super();
        this.fullName = fullName;
        this.age = age;
        this.role = role;
        this.morale = morale;
        this.traits = traits;
        this.backstory = backstory;
        this.relationships = [];
        this.location = { type: 'ship' };
        this.isLeader = false;
        this.isCaptain = false;
    }
}
