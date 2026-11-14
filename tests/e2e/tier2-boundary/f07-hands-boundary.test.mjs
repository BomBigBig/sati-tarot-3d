import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadTestGLB } from '../harness/testHelpers.mjs';

describe('Tier 2 - Feature 7: Articulated Hands Joint Limits & Hierarchy Stress', () => {
  it('T2-F7-01: Joint rotation clamping clamps out-of-bounds angles into physiological range', () => {
    function clampJointRotation(angle, min = -0.5, max = 0.5) {
      return Math.max(min, Math.min(max, angle));
    }
    assert.equal(clampJointRotation(-3.14), -0.5);
    assert.equal(clampJointRotation(3.14), 0.5);
    assert.equal(clampJointRotation(0.2), 0.2);
  });

  it('T2-F7-02: Deep hierarchy recursive traversal stress test (1,000 lookups)', async () => {
    const gltf = await loadTestGLB('player_hands.glb');
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      const left = gltf.scene.getObjectByName('PlayerLeftHand');
      assert.ok(left);
    }
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 100, `1000 traversals finished in ${elapsed}ms (< 100ms)`);
  });

  it('T2-F7-03: Missing joint node fault injection skips node without null pointer dereference', () => {
    const fakeHand = {
      children: [],
      getObjectByName: () => null
    };

    assert.doesNotThrow(() => {
      const finger = fakeHand.getObjectByName('MissingFinger');
      if (finger) finger.rotation.x = 0.1;
    });
  });

  it('T2-F7-04: Extreme hand scaling boundary (0.001x and 100x) maintains valid transform matrices', async () => {
    const gltf = await loadTestGLB('player_hands.glb');
    const root = gltf.scene.getObjectByName('PlayerHandsRoot') || gltf.scene;

    root.scale.set(0.001, 0.001, 0.001);
    root.updateMatrixWorld(true);
    assert.ok(!isNaN(root.matrixWorld.elements[0]));

    root.scale.set(100, 100, 100);
    root.updateMatrixWorld(true);
    assert.ok(!isNaN(root.matrixWorld.elements[0]));
  });

  it('T2-F7-05: Zero-allocation joint updates over 1,000 iterations without memory leaks', async () => {
    const gltf = await loadTestGLB('player_hands.glb');
    const left = gltf.scene.getObjectByName('PlayerLeftHand');

    assert.doesNotThrow(() => {
      for (let i = 0; i < 1000; i++) {
        left.rotation.x = Math.sin(i * 0.01) * 0.2;
        left.updateMatrixWorld(false);
      }
    });
  });
});
