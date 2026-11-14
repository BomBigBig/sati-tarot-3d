import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 3 - Pairwise 01: Card Draw while Hands Hovering Crystal Ball (F8 + F9)', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck], isHoveringCrystal: true });
  });

  it('PW-01: Intercepting crystal hover with card pick cleanly re-targets active hand', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const fan = engine.getFanCardMeshes();
    assert.equal(state.isHoveringCrystal, true);

    // Pick card on left side
    const cardLeft = fan.find(m => m.position.x < -0.3) || fan[0];
    state.handGrab = {
      side: 'left',
      pos: cardLeft.position.clone(),
      startTime: engine.getElapsedTime()
    };
    state.isHoveringCrystal = false;

    assert.equal(state.isHoveringCrystal, false);
    assert.equal(state.handGrab.side, 'left');
    assert.ok(state.handGrab.pos);
    engine.dispose();
  });
});
