import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine, CAM_POS } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 3 - Pairwise 03: 1P to 2P Camera Perspective Toggle Mid-Deal (F10 + F8)', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck], cameraMode: '1P' });
  });

  it('PW-03: Switching 1P to 2P mid-draw preserves in-flight spread target coordinates', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const card = engine.getFanCardMeshes()[2];

    engine.placeSpreadCardIn3D(card, fullDeck[2], 2, 10);

    // Mid-deal camera mode switch
    state.cameraMode = '2P';
    engine.setCameraTarget(CAM_POS.view2P, CAM_POS.view2PLook);

    assert.equal(state.cameraMode, '2P');
    assert.equal(card.userData.isSpreadCard, true);
    assert.ok(card.userData.targetPos);
    assert.equal(card.userData.targetPos.y, 1.05);
    engine.dispose();
  });
});
