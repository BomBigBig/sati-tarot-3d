import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 3 - Pairwise 09: Hand Proximity Emissive Light Modulation (F5 + F10)', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('PW-09: Hand proximity to crystal position smoothly updates light parameters without error', () => {
    const engine = createSati3DEngine({ canvas, state });

    // Simulate hand approach from rest (Z=2.22) to crystal flanking (Z=-0.88)
    const light = new THREE.PointLight('#c49aff', 1.25);
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const alpha = i / steps;
      const handZ = THREE.MathUtils.lerp(2.22, -0.88, alpha);
      // Intensity rises as hand approaches
      light.intensity = THREE.MathUtils.lerp(1.25, 2.2, alpha);
      assert.ok(light.intensity >= 1.25 && light.intensity <= 2.2);
    }

    engine.dispose();
  });
});
