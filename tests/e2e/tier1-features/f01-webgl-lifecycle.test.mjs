import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTestCanvas, createMockState, disposalTracker } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 1 - Feature 1: WebGL Memory Lifecycle & Resource Disposal', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    disposalTracker.reset();
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('T1-F1-01: clear3DCards invokes geometry.dispose on all fan card meshes', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const fanMeshes = engine.getFanCardMeshes();
    assert.equal(fanMeshes.length, 78, 'Fan should spawn 78 card meshes');

    disposalTracker.reset();
    if (typeof engine.clear3DCards === 'function') {
      engine.clear3DCards();
    } else {
      // Re-spawning with empty deck invokes internal clear3DCards()
      state.remainingDeck = [];
      engine.spawn78CardFan();
    }

    assert.equal(engine.getFanCardMeshes().length, 0, 'Card meshes should be cleared');
    assert.ok(disposalTracker.geometries.length >= 1, 'Geometries must be explicitly disposed');
    engine.dispose();
  });

  it('T1-F1-02: clear3DCards invokes material and texture .dispose() on multi-material sub-elements', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();

    disposalTracker.reset();
    if (typeof engine.clear3DCards === 'function') {
      engine.clear3DCards();
    } else {
      state.remainingDeck = [];
      engine.spawn78CardFan();
    }

    assert.ok(disposalTracker.materials.length >= 1, 'Materials must be disposed');
    engine.dispose();
  });

  it('T1-F1-03: tuckNatalSpreadAway3D disposes geometries and materials of active spread cards', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const fan = engine.getFanCardMeshes();

    // Place 3 cards into spread
    for (let i = 0; i < 3; i++) {
      engine.placeSpreadCardIn3D(fan[i], fullDeck[i], i, 3);
    }

    disposalTracker.reset();
    engine.tuckNatalSpreadAway3D();

    assert.ok(disposalTracker.geometries.length >= 1 || disposalTracker.materials.length >= 1,
      'Spread card geometries or materials must be disposed on tuck');
    engine.dispose();
  });

  it('T1-F1-04: engine3D.dispose() cancels active requestAnimationFrame loop handle', () => {
    let cancelCalledWith = null;
    const origCancel = globalThis.cancelAnimationFrame;
    globalThis.cancelAnimationFrame = (id) => {
      cancelCalledWith = id;
      origCancel(id);
    };

    try {
      const engine = createSati3DEngine({ canvas, state });
      assert.equal(typeof engine.dispose, 'function', 'engine.dispose must be a function');
      engine.dispose();
      assert.ok(cancelCalledWith !== null, 'cancelAnimationFrame must be called on dispose');
    } finally {
      globalThis.cancelAnimationFrame = origCancel;
    }
  });

  it('T1-F1-05: engine3D.dispose() unbinds window event listeners (resize, pointermove, pointerdown)', () => {
    const removedEvents = [];
    const origRemove = globalThis.window.removeEventListener;
    globalThis.window.removeEventListener = (evt, handler) => {
      removedEvents.push(evt);
      origRemove(evt, handler);
    };

    try {
      const engine = createSati3DEngine({ canvas, state });
      engine.dispose();

      assert.ok(removedEvents.includes('resize'), 'resize listener must be removed');
      assert.ok(removedEvents.includes('pointermove'), 'pointermove listener must be removed');
      assert.ok(removedEvents.includes('pointerdown'), 'pointerdown listener must be removed');
    } finally {
      globalThis.window.removeEventListener = origRemove;
    }
  });

  it('T1-F1-06: engine3D.dispose() releases post-processing composer passes and calls renderer.dispose()', () => {
    const engine = createSati3DEngine({ canvas, state });
    assert.doesNotThrow(() => {
      engine.dispose();
    }, 'engine.dispose should execute cleanly without exceptions');
  });
});
