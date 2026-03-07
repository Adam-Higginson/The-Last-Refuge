// ui.js — HUD, panels, transitions

let canvas, ctx;

export function initUI(c, context, state) {
    canvas = c;
    ctx = context;

    // TODO: set up click/hover event listeners
    // TODO: right-click for ship movement
    // TODO: left-click for ship panel, planet click
}

export function renderHUD(state) {
    // TODO: bottom panel with turn number, movement budget, end turn button
    // TODO: top-right crew count
}

export function renderShipPanel(state) {
    // TODO: slide-in panel with crew manifest
}

export function renderIndividualPanel(state) {
    // TODO: individual crew member details
}

export function renderColoniseModal(state, region) {
    // TODO: confirmation modal for colonisation
}
