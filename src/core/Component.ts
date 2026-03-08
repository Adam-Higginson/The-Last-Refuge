// Component.ts — Base class for all components.
// Components are data containers by default.
// Entity-specific behaviour may implement optional lifecycle methods
// (init, update, destroy), driven by ComponentSystem.

export abstract class Component {
    /** Back-reference to the owning entity, set by Entity.addComponent() */
    entity!: import('./Entity').Entity;

    /** Called once when ComponentSystem first encounters this component */
    init?(): void;

    /** Called every tick by ComponentSystem */
    update?(dt: number): void;

    /** Called when the component is removed or the system is destroyed */
    destroy?(): void;
}
