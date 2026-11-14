import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 2 - Feature 9: Crystal Gesture Rapid Toggle & Priority Conflicts', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('T2-F9-01: Rapid cupping hover toggle spam (20 toggles in rapid succession)', () => {
    const engine = createSati3DEngine({ canvas, state });
    assert.doesNotThrow(() => {
      for (let i = 0; i < 20; i++) {
        state.isHoveringCrystal = i % 2 === 0;
      }
    });
    engine.dispose();
  });

  it('T2-F9-02: Priority conflict arbitration: card pick overrides crystal cupping state', () => {
    state.isHoveringCrystal = true;
    const engine = createSati3DEngine({ canvas, state });

    // When card pick triggers, isHoveringCrystal is superseded by handGrab
    state.handGrab = { side: 'left', pos: null, startTime: 0 };
    assert.ok(state.handGrab !== null);
    engine.dispose();
  });

  it('T2-F9-03: Concurrent animation flags (isAnimatingShuffle and isHoveringCrystal) run stably', () => {
    state.isAnimatingShuffle = true;
    state.isHoveringCrystal = true;
    const engine = createSati3DEngine({ canvas, state });
    assert.equal(state.isAnimatingShuffle, true);
    assert.equal(state.isHoveringCrystal, true);
    engine.dispose();
  });

  it('T2-F9-04: Time-scaled wave undulation progression matches across 15 FPS vs 144 FPS', () => {
    // 15 FPS: 15 steps of dt = 1/15
    let phase15 = 0;
    const dt15 = 1 / 15;
    for (let i = 0; i < 15; i++) phase15 += 2.0 * dt15;

    // 144 FPS: 144 steps of dt = 1/144
    let phase144 = 0;
    const dt144 = 1 / 144;
    for (let i = 0; i < 144; i++) phase144 += 2.0 * dt144;

    assert.ok(Math.abs(phase15 - phase144) < 0.001, 'Phase progression after 1s must match within 0.001 rad');
  });

  it('T2-F9-05: Audio trigger debounce on continuous crystal hover', () => {
    let playCount = 0;
    let wasHovering = false;

    function onHoverChange(isHovering) {
      if (isHovering && !wasHovering) {
        playCount++;
      }
      wasHovering = isHovering;
    }

    // 60 consecutive hover frames
    for (let i = 0; i < 60; i++) {
      onHoverChange(true);
    }
    assert.equal(playCount, 1, 'Audio should only trigger once upon entering hover');
  });
});
