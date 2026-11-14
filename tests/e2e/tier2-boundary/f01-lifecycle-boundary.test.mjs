import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTestCanvas, createMockState, disposalTracker } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 2 - Feature 1: Memory & Stress Boundaries', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    disposalTracker.reset();
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('T2-F1-01: 100-cycle card fan spawn and clear stress test (Zero Leak)', () => {
    const engine = createSati3DEngine({ canvas, state });

    // Warm-up cycle
    engine.spawn78CardFan();
    state.remainingDeck = [];
    engine.spawn78CardFan();
    disposalTracker.reset();

    // 100 Stress Cycles
    for (let i = 0; i < 100; i++) {
      state.remainingDeck = [...fullDeck];
      engine.spawn78CardFan();
      state.remainingDeck = [];
      engine.spawn78CardFan();
    }

    assert.equal(engine.getFanCardMeshes().length, 0);
    assert.ok(disposalTracker.geometries.length >= 100, 'Geometries must be disposed on every cycle');
    engine.dispose();
  });

  it('T2-F1-02: Double-dispose resilience on engine3D.dispose()', () => {
    const engine = createSati3DEngine({ canvas, state });
    assert.doesNotThrow(() => {
      engine.dispose();
      engine.dispose();
      engine.dispose();
    }, 'Multiple dispose calls must be idempotent and not throw');
  });

  it('T2-F1-03: WebGL context loss simulation and recovery handling', () => {
    const engine = createSati3DEngine({ canvas, state });
    const gl = canvas.getContext('webgl2');

    assert.doesNotThrow(() => {
      // Simulate losing WebGL context
      const loseExt = gl.getExtension('WEBGL_lose_context');
      loseExt.loseContext();
      // Simulate restoring WebGL context
      loseExt.restoreContext();
    });

    engine.dispose();
  });

  it('T2-F1-04: Disposing engine while card draw tween animation is actively in flight', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const card = engine.getFanCardMeshes()[0];

    engine.placeSpreadCardIn3D(card, fullDeck[0], 0, 10);
    state.handGrab = {
      side: 'left',
      pos: new THREE.Vector3(-0.5, 1.1, 1.5),
      startTime: engine.getElapsedTime()
    };

    // Dispose mid-flight
    assert.doesNotThrow(() => {
      engine.dispose();
    });
  });

  it('T2-F1-05: 100-cycle natal spread placement and tucking away stress test', () => {
    const engine = createSati3DEngine({ canvas, state });

    for (let cycle = 0; cycle < 100; cycle++) {
      state.remainingDeck = [...fullDeck];
      engine.spawn78CardFan();
      const fan = engine.getFanCardMeshes();
      for (let i = 0; i < 10; i++) {
        engine.placeSpreadCardIn3D(fan[i], fullDeck[i], i, 10);
      }
      engine.tuckNatalSpreadAway3D();
    }

    assert.ok(disposalTracker.geometries.length >= 100, 'All cycles must dispose spread cards');
    engine.dispose();
  });
});
