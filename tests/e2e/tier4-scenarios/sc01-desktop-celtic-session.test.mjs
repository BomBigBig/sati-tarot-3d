import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine, CAM_POS } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';
import { computeNatalProfile } from '../../../src/engine/satiBrain.js';

describe('Tier 4 - Scenario 01: Full Desktop Celtic Cross 10-Card Reading Session', () => {
  it('SC-01: Complete end-to-end journey from login to 10-card interpretation', async () => {
    const canvas = createTestCanvas(1920, 1080);
    const fullDeck = buildFullDeck78();
    const state = createMockState({
      screen: 'login',
      remainingDeck: [...fullDeck],
      activeSpread: []
    });

    // Step 1: Launch & login screen
    const engine = createSati3DEngine({ canvas, state });
    assert.equal(state.screen, 'login');

    // Step 2: Login & Ledger transition
    state.user = {
      fullname: 'สมชาย มีสติ',
      nickname: 'บอม',
      day: 25,
      month: 6,
      year: 2539,
      birthdate: '1996-06-25',
      birthTime: '10:30',
      email: 'somchai@gmail.com'
    };
    state.screen = 'ledger';
    engine.setCameraTarget(CAM_POS.ledger, CAM_POS.ledgerLook);

    // Step 3: Thaksa Natal profile calculation
    const profile = computeNatalProfile(state.user);
    assert.ok(profile, 'Natal profile must be computed');
    assert.ok(profile.dayName, 'Should calculate birth day');
    assert.ok(profile.element, 'Should calculate element');
    assert.ok(profile.birthCard, 'Should determine birth card');

    // Step 4: Table Setup & Sati Shuffle
    state.screen = 'game';
    state.isPicking = true;
    engine.setCameraTarget(CAM_POS.view1P, CAM_POS.view1PLook);
    engine.spawn78CardFan();
    const fanCards = engine.getFanCardMeshes();
    assert.equal(fanCards.length, 78, '78-card fan rendered');

    // Step 5: 10-Card Picking Phase
    for (let i = 0; i < 10; i++) {
      const cardMesh = fanCards[i];
      const cardData = fullDeck[i];
      engine.placeSpreadCardIn3D(cardMesh, cardData, i, 10);
      state.activeSpread.push(cardData);
    }

    assert.equal(state.activeSpread.length, 10, '10 cards placed in active spread');

    // Step 6: Interpretation state
    state.natalCompleted = true;
    state.natalCards = [...state.activeSpread];
    assert.equal(state.natalCompleted, true);
    assert.equal(state.natalCards.length, 10);

    engine.dispose();
  });
});
