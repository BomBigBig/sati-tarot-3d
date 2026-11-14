import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState, simulateResize } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 3 - Pairwise 05: Crystal Ball Mystical Gesture with Dynamic Aspect Shift (F2 + F9)', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck], isHoveringCrystal: true });
  });

  it('PW-05: Rapid switch between mobile portrait and widescreen during crystal cupping maintains state', () => {
    simulateResize(390, 844);
    const engine = createSati3DEngine({ canvas, state });
    assert.equal(state.isHoveringCrystal, true);

    // Dynamic resize to desktop
    simulateResize(1920, 1080);
    assert.equal(state.isHoveringCrystal, true);

    // Dynamic resize back to mobile
    simulateResize(375, 812);
    assert.equal(state.isHoveringCrystal, true);

    engine.dispose();
  });
});
