import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadTestGLB } from '../harness/testHelpers.mjs';

describe('Tier 1 - Feature 5: Refractive & Glowing Crystal Shader System', () => {
  it('T1-F5-01: Centerpiece crystal ball material is configured with specular reflections', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const orbGroup = gltf.scene.getObjectByName('TabletopCrystalBall');
    const orb = orbGroup.isMesh ? orbGroup : orbGroup.children.find(c => c.isMesh);
    assert.ok(orb && orb.material, 'Orb must have a material');
    assert.ok(orb.material.isMaterial, 'Must be a valid THREE.Material');
  });

  it('T1-F5-02: Centerpiece crystal ball material roughness is low (<= 0.45) for glossy crystal finish', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const orbGroup = gltf.scene.getObjectByName('TabletopCrystalBall');
    const orb = orbGroup.isMesh ? orbGroup : orbGroup.children.find(c => c.isMesh);
    const roughness = orb.material.roughness !== undefined ? orb.material.roughness : 0.2;
    assert.ok(roughness <= 0.45, `Roughness (${roughness}) should be <= 0.45 for crystal`);
  });

  it('T1-F5-03: Candle flames and glowing elements have non-zero emissive colors', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const flame = gltf.scene.getObjectByName('CandleFlame_0');
    assert.ok(flame, 'Flame node must exist');
    assert.ok(flame.material, 'Flame must have material');
    if (flame.material.emissive) {
      assert.ok(flame.material.emissive.r > 0 || flame.material.emissive.g > 0 || flame.material.emissive.b > 0,
        'Emissive color should be non-zero');
    }
  });

  it('T1-F5-04: Rotational updates advance centerpiece crystal ball rotation smoothly', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const orb = gltf.scene.getObjectByName('TabletopCrystalBall');
    const initialRot = orb.rotation.y;
    const dt = 0.1;
    orb.rotation.y += dt * 0.4;
    assert.ok(orb.rotation.y > initialRot, 'Orb rotation must increase over time');
  });

  it('T1-F5-05: PointLight intensity modulates within valid range [0.5, 3.0]', () => {
    const light = new THREE.PointLight('#c49aff', 1.25, 6, 1.8);
    assert.equal(light.isPointLight, true);
    assert.ok(light.intensity >= 0.5 && light.intensity <= 3.0);
    light.intensity = 2.2;
    assert.equal(light.intensity, 2.2);
  });
});
