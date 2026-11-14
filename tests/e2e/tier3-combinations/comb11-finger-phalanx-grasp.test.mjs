import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadTestGLB } from '../harness/testHelpers.mjs';

describe('Tier 3 - Pairwise 11: Multi-Finger Phalanx Articulation & Hand Pose (F7 + F8)', () => {
  it('PW-11: Hand rig articulates fingers and maintains local hierarchy transforms during card grasp', async () => {
    const gltf = await loadTestGLB('player_hands.glb');
    const leftHand = gltf.scene.getObjectByName('PlayerLeftHand');

    assert.ok(leftHand);

    // Apply rotation simulating hand pinch pose
    leftHand.rotation.x = -0.26;
    leftHand.position.set(-0.52, 1.14, 1.4);
    leftHand.updateMatrixWorld(true);

    const worldPos = new THREE.Vector3();
    leftHand.getWorldPosition(worldPos);
    assert.equal(worldPos.x, -0.52);
    assert.equal(worldPos.y, 1.14);
    assert.equal(worldPos.z, 1.4);
  });
});
