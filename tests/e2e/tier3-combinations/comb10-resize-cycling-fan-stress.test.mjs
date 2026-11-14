import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState, simulateResize } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 3 - Pairwise 10: Continuous Viewport Resize Cycling with Fan Spawning (F1 + F2)', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('PW-10: 20-cycle resize oscillation between mobile and ultrawide with fan spawning operates cleanly', () => {
    const engine = createSati3DEngine({ canvas, state });

    const viewports = [
      { w: 360, h: 740 },
      { w: 1920, h: 1080 },
      { w: 1024, h: 768 },
      { w: 2560, h: 1080 }
    ];

    assert.doesNotThrow(() => {
      for (let i = 0; i < 20; i++) {
        const vp = viewports[i % viewports.length];
        simulateResize(vp.w, vp.h);
        state.remainingDeck = [...fullDeck];
        engine.spawn78CardFan();
      }
    });

    assert.equal(engine.getFanCardMeshes().length, 78);
    engine.dispose();
  });
});
