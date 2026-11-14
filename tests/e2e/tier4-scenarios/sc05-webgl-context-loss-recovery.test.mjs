import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 4 - Scenario 05: WebGL Context Loss Simulation & Graceful Recovery', () => {
  it('SC-05: WebGL context loss triggers cleanly, recovers without crash, and disposes resources', async () => {
    const canvas = createTestCanvas();
    const fullDeck = buildFullDeck78();
    const state = createMockState({ remainingDeck: [...fullDeck] });

    // 1. Initial 3D Session
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    assert.equal(engine.getFanCardMeshes().length, 78);

    // 2. Simulate WebGL Context Loss
    const gl = canvas.getContext('webgl2');
    const loseExt = gl.getExtension('WEBGL_lose_context');
    assert.ok(loseExt);

    assert.doesNotThrow(() => {
      loseExt.loseContext();
    });

    // 3. Verify DOM and state remain intact during context loss
    assert.equal(state.remainingDeck.length, 78);
    assert.equal(state.screen, 'game');

    // 4. Restore Context
    assert.doesNotThrow(() => {
      loseExt.restoreContext();
    });

    // 5. Clean Engine Teardown
    assert.doesNotThrow(() => {
      engine.dispose();
    });
  });
});
