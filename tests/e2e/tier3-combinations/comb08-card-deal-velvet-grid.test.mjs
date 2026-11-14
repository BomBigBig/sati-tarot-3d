import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 3 - Pairwise 08: Card Deal Placement Precision onto Velvet Tablecloth Grid (F6 + F8)', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('PW-08: All 10 Celtic Cross spread slots receive distinct non-overlapping target positions', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const fan = engine.getFanCardMeshes();

    const placedCards = [];
    for (let i = 0; i < 10; i++) {
      engine.placeSpreadCardIn3D(fan[i], fullDeck[i], i, 10);
      placedCards.push(fan[i]);
    }

    // Verify all 10 slots have distinct coordinates
    const positions = placedCards.map(c => `${c.userData.targetPos.x.toFixed(2)},${c.userData.targetPos.z.toFixed(2)}`);
    const uniquePositions = new Set(positions);
    assert.equal(uniquePositions.size, 10, 'All 10 Celtic Cross slots must have unique coordinates');

    // Height above velvet surface
    placedCards.forEach(c => {
      assert.equal(c.userData.targetPos.y, 1.05, 'Cards must float at table height Y=1.05');
    });

    engine.dispose();
  });
});
