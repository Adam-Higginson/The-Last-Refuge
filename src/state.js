// state.js — Game state object

export const state = {
    turn: 1,
    phase: 'system', // 'system' | 'planet' | 'transitioning'

    ship: {
        x: 0,
        y: 0,
        angle: 0,
        movementBudget: 300,
        movementMax: 300,
        selected: false,
    },

    planet: {
        name: 'New Terra',
        orbitAngle: 0,
        orbitSpeed: 0.002,
        orbitRadius: 0,
        colonised: false,
        regions: [],
    },

    humans: [],

    ui: {
        shipPanelOpen: false,
        selectedHuman: null,
        planetViewActive: false,
    },

    flags: {
        firstColonyEstablished: false,
    },
};
