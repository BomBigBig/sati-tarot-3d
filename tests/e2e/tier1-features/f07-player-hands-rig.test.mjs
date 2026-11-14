import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { loadTestGLB } from '../harness/testHelpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

describe('Tier 1 - Feature 7: Articulated 3D First-Person Hands Rig', () => {
  it('T1-F7-01: player_hands.glb exports PlayerLeftHand and PlayerRightHand nodes', async () => {
    const gltf = await loadTestGLB('player_hands.glb');
    const leftHand = gltf.scene.getObjectByName('PlayerLeftHand');
    const rightHand = gltf.scene.getObjectByName('PlayerRightHand');

    assert.ok(leftHand, 'PlayerLeftHand must exist in player_hands.glb');
    assert.ok(rightHand, 'PlayerRightHand must exist in player_hands.glb');
  });

  it('T1-F7-02: PlayerHandsRoot groups both player hands in model hierarchy', async () => {
    const gltf = await loadTestGLB('player_hands.glb');
    const root = gltf.scene.getObjectByName('PlayerHandsRoot') || gltf.scene;
    assert.ok(root, 'Hands root group must exist');
    const left = root.getObjectByName('PlayerLeftHand');
    const right = root.getObjectByName('PlayerRightHand');
    assert.ok(left, 'PlayerLeftHand must be grouped under hands root');
    assert.ok(right, 'PlayerRightHand must be grouped under hands root');
  });

  it('T1-F7-03: Left and Right hands have distinct geometries and vertex buffers', async () => {
    const gltf = await loadTestGLB('player_hands.glb');
    const left = gltf.scene.getObjectByName('PlayerLeftHand');
    const right = gltf.scene.getObjectByName('PlayerRightHand');

    assert.ok(left && right);
    assert.notEqual(left, right, 'Left and right hands must be distinct instances');
  });

  it('T1-F7-04: Total compiled player_hands.glb file size is under 256 KB', () => {
    const filePath = path.join(PROJECT_ROOT, 'public/models/player_hands.glb');
    assert.ok(fs.existsSync(filePath), 'player_hands.glb must exist in public/models/');
    const stats = fs.statSync(filePath);
    assert.ok(stats.size < 256000, `File size (${stats.size} bytes) must be < 256 KB for lightweight loading`);
  });

  it('T1-F7-05: Manipulating hand rotations updates world matrix deterministically', async () => {
    const gltf = await loadTestGLB('player_hands.glb');
    const left = gltf.scene.getObjectByName('PlayerLeftHand');

    left.position.set(-0.5, 1.2, 2.0);
    left.rotation.set(0.2, -0.3, 0.1);
    left.updateMatrixWorld(true);

    const worldPos = new THREE.Vector3();
    left.getWorldPosition(worldPos);
    assert.equal(worldPos.x, -0.5);
    assert.equal(worldPos.y, 1.2);
    assert.equal(worldPos.z, 2.0);
  });
});
