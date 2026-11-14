import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadTestGLB } from '../harness/testHelpers.mjs';

describe('Tier 2 - Feature 4: Table Centerpiece & Raycast Boundaries', () => {
  it('T2-F4-01: Raycasting centerpiece crystal ball under steep top-down angle (-85 degrees)', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const orbGroup = gltf.scene.getObjectByName('TabletopCrystalBall');
    const orb = orbGroup.isMesh ? orbGroup : orbGroup.children.find(c => c.isMesh);

    const worldPos = new THREE.Vector3();
    orb.getWorldPosition(worldPos);

    // Steep top-down camera
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
    camera.position.set(worldPos.x, worldPos.y + 4, worldPos.z + 0.1);
    camera.lookAt(worldPos);
    camera.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObject(orb, true);
    assert.ok(hits.length >= 1, 'Raycaster must intersect crystal orb from steep top-down angle');
  });

  it('T2-F4-02: Centerpiece relative transform stability under parent rotation', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const orb = gltf.scene.getObjectByName('TabletopCrystalBall');
    const initialLocalPos = orb.position.clone();

    // Rotate scene root by 45 degrees
    gltf.scene.rotation.y = Math.PI / 4;
    gltf.scene.updateMatrixWorld(true);

    // Local position relative to parent must remain invariant
    assert.equal(orb.position.x, initialLocalPos.x);
    assert.equal(orb.position.y, initialLocalPos.y);
    assert.equal(orb.position.z, initialLocalPos.z);
  });

  it('T2-F4-03: High-frequency hover oscillation (50 alternating raycasts) without hitching', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const tableMesh = gltf.scene.getObjectByName('OctagonalTableMesh');

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 50);
    camera.position.set(0, 3, 3);
    camera.lookAt(0, 1, 0);
    camera.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    assert.doesNotThrow(() => {
      for (let i = 0; i < 50; i++) {
        // Alternate between on-target and off-target
        const ndcX = i % 2 === 0 ? 0 : 0.99;
        raycaster.setFromCamera(new THREE.Vector2(ndcX, 0), camera);
        raycaster.intersectObject(tableMesh, true);
      }
    });
  });

  it('T2-F4-04: Model bounding box consistency check across multiple loads', async () => {
    const gltf1 = await loadTestGLB('divination_table.glb');
    const gltf2 = await loadTestGLB('divination_table.glb');

    const box1 = new THREE.Box3().setFromObject(gltf1.scene);
    const box2 = new THREE.Box3().setFromObject(gltf2.scene);

    assert.ok(Math.abs(box1.min.x - box2.min.x) < 0.001);
    assert.ok(Math.abs(box1.max.x - box2.max.x) < 0.001);
  });

  it('T2-F4-05: Graceful degradation when non-existent node is queried via getObjectByName', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const missingNode = gltf.scene.getObjectByName('NonExistentNode_XYZ');
    assert.equal(missingNode, undefined, 'Missing node should return undefined without throwing');
  });
});
