// ModalLock.ts — Global modal coordination service.
// Prevents multiple modal-showing systems (NarrativeEventSystem, EncounterSystem)
// from opening modals simultaneously. Registered via ServiceLocator as 'modalLock'.

export class ModalLock {
    private _locked = false;

    get locked(): boolean {
        return this._locked;
    }

    acquire(): boolean {
        if (this._locked) return false;
        this._locked = true;
        return true;
    }

    release(): void {
        this._locked = false;
    }
}
