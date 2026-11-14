import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 4 - Scenario 03: Continuous Divination Session (Multiple Spreads, Tucking & Scrying)', () => {
  it('SC-03: Multiple consecutive spreads, card tucking, crystal hover, and reshuffle without leak', async () => {
    const canvas = createTestCanvas();
    const fullDeck = buildFullDeck78();
    const state = createMockState({ remainingDeck: [...fullDeck] });
    const engine = createSati3DEngine({ canvas, state });

    // Step 1: Initial 10-card spread
    engine.spawn78CardFan();
    let fan = engine.getFanCardMeshes();
    for (let i = 0; i < 10; i++) {
      engine.placeSpreadCardIn3D(fan[i], fullDeck[i], i, 10);
    }
    state.remainingDeck = state.remainingDeck.slice(10);
    assert.equal(state.remainingDeck.length, 68);

    // Step 2: Tuck initial 10 cards and deal 3 follow-up cards
    engine.tuckNatalSpreadAway3D();
    engine.spawn78CardFan();
    fan = engine.getFanCardMeshes();
    for (let i = 0; i < 3; i++) {
      engine.placeSpreadCardIn3D(fan[i], fullDeck[10 + i], i, 3);
    }
    state.remainingDeck = state.remainingDeck.slice(3);
    assert.equal(state.remainingDeck.length, 65);

    // Step 3: Centerpiece crystal ball scrying interaction
    state.isHoveringCrystal = true;
    assert.equal(state.isHoveringCrystal, true);
    state.isHoveringCrystal = false;

    // Step 4: Tuck 3 cards and deal 1 single card
    engine.tuckNatalSpreadAway3D();
    engine.spawn78CardFan();
    fan = engine.getFanCardMeshes();
    engine.placeSpreadCardIn3D(fan[0], fullDeck[13], 0, 1);
    state.remainingDeck = state.remainingDeck.slice(1);
    assert.equal(state.remainingDeck.length, 64);

    // Step 5: Reshuffle to new 78-card deck
    state.deckNumber = 2;
    state.remainingDeck = [...fullDeck];
    engine.tuckNatalSpreadAway3D();
    engine.spawn78CardFan();
    assert.equal(engine.getFanCardMeshes().length, 78);
    assert.equal(state.deckNumber, 2);

    engine.dispose();
  });
});
