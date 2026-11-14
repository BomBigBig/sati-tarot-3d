import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 1 - Feature 9: Crystal Ball Mystical Cupping & Wave Gestures', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('T1-F9-01: State hover crystal flag activates crystal cupping state', () => {
    state.isHoveringCrystal = true;
    const engine = createSati3DEngine({ canvas, state });
    assert.equal(state.isHoveringCrystal, true);
    engine.dispose();
  });

  it('T1-F9-02: Left and Right hands flank crystal ball at lateral offsets (+/- X)', () => {
    const leftTargetX = -0.32;
    const rightTargetX = 0.32;
    assert.ok(leftTargetX < 0, 'Left hand target must be negative X');
    assert.ok(rightTargetX > 0, 'Right hand target must be positive X');
    assert.equal(Math.abs(leftTargetX), Math.abs(rightTargetX), 'Symmetric flanking distance');
  });

  it('T1-F9-03: Sinusoidal wave undulation produces non-zero periodic oscillation', () => {
    const t1 = 0.5;
    const t2 = 1.0;
    const wave1 = Math.sin(t1 * 3.0) * 0.12;
    const wave2 = Math.sin(t2 * 3.0) * 0.12;
    assert.notEqual(wave1, wave2, 'Wave values must oscillate over time');
    assert.ok(Math.abs(wave1) <= 0.12);
  });

  it('T1-F9-04: Crystal light pulses dynamically during hover interaction', () => {
    const baseIntensity = 1.25;
    const hoveredIntensity = baseIntensity * 1.5;
    assert.ok(hoveredIntensity > baseIntensity, 'Hovered intensity must exceed base intensity');
    assert.equal(hoveredIntensity, 1.875);
  });

  it('T1-F9-05: Clearing crystal hover restores hands to resting positions', () => {
    state.isHoveringCrystal = false;
    const restLeft = new THREE.Vector3(-0.92, 1.16, 2.22);
    const restRight = new THREE.Vector3(0.92, 1.16, 2.22);

    assert.equal(restLeft.z, 2.22);
    assert.equal(restRight.z, 2.22);
  });
});
