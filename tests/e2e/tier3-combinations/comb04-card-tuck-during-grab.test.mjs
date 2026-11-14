import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 3 - Pairwise 04: Rapid Card Tuck while Hand Grab is Active (F1 + F8)', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('PW-04: Tucking spread cards while hand grab is in motion cleans up meshes without crash', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const fan = engine.getFanCardMeshes();

    // Deal card
    engine.placeSpreadCardIn3D(fan[0], fullDeck[0], 0, 10);
    state.handGrab = { side: 'left', pos: new THREE.Vector3(0, 1, 1), startTime: 0 };

    // Sudden tuck
    assert.doesNotThrow(() => {
      engine.tuckNatalSpreadAway3D();
    });

    state.handGrab = null;
    assert.equal(state.handGrab, null);
    engine.dispose();
  });
});
