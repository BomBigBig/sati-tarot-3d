import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTestCanvas, createMockState, simulateResize } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 3 - Pairwise 02: Viewport Resize & Aspect Ratio Shift Mid-Draw (F2 + F8)', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('PW-02: Window resize mid-animation updates camera projection while card settles in slot', () => {
    // Start at desktop resolution
    simulateResize(1920, 1080);
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const card = engine.getFanCardMeshes()[0];

    // Trigger card placement
    engine.placeSpreadCardIn3D(card, fullDeck[0], 0, 10);
    state.handGrab = { side: 'right', pos: card.position.clone(), startTime: 0 };

    // Sudden resize to mobile portrait mid-draw
    simulateResize(390, 844);

    // Card target position must remain stable on table plane
    assert.equal(card.userData.targetPos.z, -0.34);
    assert.equal(card.userData.targetPos.y, 1.05);
    engine.dispose();
  });
});
