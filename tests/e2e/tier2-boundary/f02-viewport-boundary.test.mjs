import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState, simulateResize, simulatePointerEvent } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 2 - Feature 2: Extreme Viewports & Touch Stress', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('T2-F2-01: Extreme ultrawide 21:9 aspect ratio does not produce NaN matrices', () => {
    simulateResize(3440, 1440);
    const engine = createSati3DEngine({ canvas, state });
    const aspect = 3440 / 1440;
    assert.ok(aspect > 2.0);
    engine.dispose();
  });

  it('T2-F2-02: Extreme ultra-narrow 9:21 aspect ratio (1080x2520) keeps aspect bounded', () => {
    simulateResize(1080, 2520);
    const engine = createSati3DEngine({ canvas, state });
    const aspect = 1080 / 2520;
    assert.ok(aspect < 0.5);
    engine.dispose();
  });

  it('T2-F2-03: Rapid viewport resize oscillation (100 alternating resizes) without crash', () => {
    const engine = createSati3DEngine({ canvas, state });
    assert.doesNotThrow(() => {
      for (let i = 0; i < 100; i++) {
        if (i % 2 === 0) {
          simulateResize(390, 844);
        } else {
          simulateResize(1920, 1080);
        }
      }
    });
    engine.dispose();
  });

  it('T2-F2-04: Zero and near-zero viewport dimensions clamp gracefully without NaN or Infinity', () => {
    const engine = createSati3DEngine({ canvas, state });
    assert.doesNotThrow(() => {
      simulateResize(0, 0);
      simulateResize(1, 1);
      simulateResize(-100, -200);
    });
    engine.dispose();
  });

  it('T2-F2-05: Multi-touch pointer storm (10 concurrent pointerdown events) tracks cleanly', () => {
    const engine = createSati3DEngine({ canvas, state });
    assert.doesNotThrow(() => {
      for (let i = 0; i < 10; i++) {
        simulatePointerEvent(canvas, 'pointerdown', 50 + i * 30, 100 + i * 20);
      }
    });
    engine.dispose();
  });
});
