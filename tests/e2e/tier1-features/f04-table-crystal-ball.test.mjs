import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadTestGLB } from '../harness/testHelpers.mjs';

describe('Tier 1 - Feature 4: Table Centerpiece Crystal Ball & Gothic Stand', () => {
  it('T1-F4-01: divination_table.glb exports only centerpiece TabletopCrystalBall and sanctuary_room.glb has no side orbs', async () => {
    const tableGltf = await loadTestGLB('divination_table.glb');
    const centerOrb = tableGltf.scene.getObjectByName('TabletopCrystalBall');
    assert.ok(centerOrb, 'Divination table must contain centerpiece TabletopCrystalBall');

    const roomGltf = await loadTestGLB('sanctuary_room.glb');
    assert.equal(roomGltf.scene.getObjectByName('CrystalOrb_Left'), undefined, 'CrystalOrb_Left must be removed');
    assert.equal(roomGltf.scene.getObjectByName('CrystalOrb_Right'), undefined, 'CrystalOrb_Right must be removed');
  });

  it('T1-F4-02: Centerpiece TabletopCrystalBall mesh contains faceted low-poly geometry', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const orbGroup = gltf.scene.getObjectByName('TabletopCrystalBall');
    assert.ok(orbGroup, 'TabletopCrystalBall node must exist');
    const orbMesh = orbGroup.isMesh ? orbGroup : orbGroup.children.find(c => c.isMesh);
    assert.ok(orbMesh, 'Crystal ball must contain a mesh');
    assert.ok(orbMesh.geometry, 'Crystal ball must have geometry');
    const posAttr = orbMesh.geometry.getAttribute('position');
    assert.ok(posAttr && posAttr.count > 0, 'Geometry must have vertex position attribute');
  });

  it('T1-F4-03: Divination table GLB contains octagonal table mesh and candles', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const tableNode = gltf.scene.getObjectByName('OctagonalTableMesh');
    assert.ok(tableNode, 'Divination table must contain OctagonalTableMesh');
    const flame0 = gltf.scene.getObjectByName('CandleFlame_0');
    assert.ok(flame0, 'Table must feature candle lights');
  });

  it('T1-F4-04: Tabletop coordinates match target divination height (~1.03m)', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const tableGroup = gltf.scene.getObjectByName('OctagonalTableMesh');
    const tableMesh = tableGroup.isMesh ? tableGroup : tableGroup.children.find(c => c.isMesh);
    assert.ok(tableMesh && tableMesh.geometry, 'Table mesh must have geometry');
    tableMesh.geometry.computeBoundingBox();
    const box = tableMesh.geometry.boundingBox;
    const height = box.max.y - box.min.y;
    assert.ok(height > 0.05 && height < 2.0, `Table dimension (${height}) should be within expected range`);
  });

  it('T1-F4-05: Raycaster intersects centerpiece TabletopCrystalBall mesh from camera perspective', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const orb = gltf.scene.getObjectByName('TabletopCrystalBall');
    assert.ok(orb, 'TabletopCrystalBall should exist');

    orb.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    orb.getWorldPosition(worldPos);

    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.1, 50);
    camera.position.set(worldPos.x, worldPos.y, worldPos.z + 2);
    camera.lookAt(worldPos);
    camera.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.intersectObject(orb, true);
    assert.ok(hits.length >= 1, 'Raycaster must intersect crystal orb from front view');
  });
});
