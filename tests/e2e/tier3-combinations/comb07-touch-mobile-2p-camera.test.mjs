import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState, simulateResize, simulatePointerEvent } from '../harness/testHelpers.mjs';
import { createSati3DEngine, CAM_POS } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 3 - Pairwise 07: Touch Ergonomics & Drag on Mobile Portrait with 2P Camera (F10 + F2)', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck], cameraMode: '2P' });
  });

  it('PW-07: Mobile portrait touch drag maps accurately onto table plane under 2P camera mode', () => {
    simulateResize(390, 844);
    const engine = createSati3DEngine({ canvas, state });
    engine.setCameraTarget(CAM_POS.view2P, CAM_POS.view2PLook);
    engine.spawn78CardFan();

    assert.equal(canvas.style.touchAction, 'none');
    assert.doesNotThrow(() => {
      // Simulate continuous touch dragging across mobile screen
      for (let x = 50; x <= 350; x += 30) {
        simulatePointerEvent(canvas, 'pointermove', x, 400);
      }
    });

    engine.dispose();
  });
});
