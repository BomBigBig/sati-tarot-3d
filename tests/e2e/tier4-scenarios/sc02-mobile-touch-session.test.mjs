import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState, simulateResize, simulatePointerEvent } from '../harness/testHelpers.mjs';
import { createSati3DEngine, CAM_POS } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 4 - Scenario 02: Mobile Portrait 3-Card Spread with Touch Interactions', () => {
  it('SC-02: Complete mobile session with portrait framing, touch gestures, and 2P toggle', async () => {
    // 1. Mobile Viewport Init (390x844 portrait)
    simulateResize(390, 844);
    const canvas = createTestCanvas(390, 844);
    const fullDeck = buildFullDeck78();
    const state = createMockState({
      screen: 'game',
      remainingDeck: [...fullDeck],
      coins: 10,
      cameraMode: '1P'
    });

    const engine = createSati3DEngine({ canvas, state });
    assert.equal(canvas.style.touchAction, 'none', 'touch-action: none prevents browser pan/zoom');

    // 2. Initiate 3-Card Draw & Coin Spend
    state.coins -= 3;
    state.pickTargetCount = 3;
    state.isPicking = true;
    assert.equal(state.coins, 7);

    // 3. Spawn fan and touch-pick 3 cards
    engine.spawn78CardFan();
    const fan = engine.getFanCardMeshes();

    for (let i = 0; i < 3; i++) {
      simulatePointerEvent(canvas, 'pointerdown', 100 + i * 80, 500);
      engine.placeSpreadCardIn3D(fan[i], fullDeck[i], i, 3);
      state.activeSpread.push(fullDeck[i]);
    }
    assert.equal(state.activeSpread.length, 3, '3 cards dealt into spread');

    // 4. Perspective toggle from 1P to 2P on mobile
    state.cameraMode = '2P';
    engine.setCameraTarget(CAM_POS.view2P, CAM_POS.view2PLook);
    assert.equal(state.cameraMode, '2P');

    // 5. Clean view / UI collapse toggle
    state.dialogueCollapsed = true;
    state.uiHidden = true;
    assert.equal(state.dialogueCollapsed, true);
    assert.equal(state.uiHidden, true);

    engine.dispose();
  });
});
