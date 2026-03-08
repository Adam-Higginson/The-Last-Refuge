// Component.ts — Base class for all components
// Components are data containers with minimal logic.
// Game logic lives in Systems, not here.

export abstract class Component {
    /** Back-reference to the owning entity, set by Entity.addComponent() */
    entity!: import('./Entity').Entity;
}
