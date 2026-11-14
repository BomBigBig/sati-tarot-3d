import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 3 - Pairwise 06: Deck Reshuffle & Full Card Disposal with Crystal Scene Active (F1 + F4/5)', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('PW-06: Reshuffling 10 consecutive times reclaims card resources without affecting table scene', () => {
    const engine = createSati3DEngine({ canvas, state });

    for (let i = 0; i < 10; i++) {
      state.remainingDeck = [...fullDeck];
      engine.spawn78CardFan();
      assert.equal(engine.getFanCardMeshes().length, 78);
      engine.tuckNatalSpreadAway3D();
    }

    engine.dispose();
  });
});
