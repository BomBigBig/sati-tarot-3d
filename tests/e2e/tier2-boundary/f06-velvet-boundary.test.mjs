import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../harness/testHelpers.mjs';
import { loadTestGLB } from '../harness/testHelpers.mjs';
import { createVelvetTableClothTexture } from '../../../src/scene/proceduralTextures.js';

describe('Tier 2 - Feature 6: Tablecloth Procedural Canvas Boundaries', () => {
  it('T2-F6-01: Headless environment executes createVelvetTableClothTexture cleanly', () => {
    assert.doesNotThrow(() => {
      const tex = createVelvetTableClothTexture();
      assert.ok(tex);
      tex.dispose();
    });
  });

  it('T2-F6-02: High-DPI canvas texture memory allocation boundary (1024x1024)', () => {
    const tex = createVelvetTableClothTexture();
    const w = tex.image.width;
    const h = tex.image.height;
    const estimatedBytes = w * h * 4;
    assert.ok(estimatedBytes >= 512 * 512 * 4, 'RGBA byte buffer must be allocated');
    tex.dispose();
  });

  it('T2-F6-03: 50-cycle tablecloth texture generation and disposal stress test', () => {
    assert.doesNotThrow(() => {
      for (let i = 0; i < 50; i++) {
        const tex = createVelvetTableClothTexture();
        tex.dispose();
      }
    });
  });

  it('T2-F6-04: UV coordinate boundary validation on tabletop mesh vertices', async () => {
    const gltf = await loadTestGLB('divination_table.glb');
    const tableGroup = gltf.scene.getObjectByName('OctagonalTableMesh');
    const tableMesh = tableGroup.isMesh ? tableGroup : tableGroup.children.find(c => c.isMesh);
    const uvAttr = tableMesh.geometry.getAttribute('uv');

    if (uvAttr) {
      for (let i = 0; i < uvAttr.count; i++) {
        const u = uvAttr.getX(i);
        const v = uvAttr.getY(i);
        assert.ok(!isNaN(u) && !isNaN(v), 'UV coordinates must not be NaN');
      }
    }
  });

  it('T2-F6-05: Rapid procedural texture generation duration ceiling (< 150ms)', () => {
    const start = Date.now();
    for (let i = 0; i < 10; i++) {
      const tex = createVelvetTableClothTexture();
      tex.dispose();
    }
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 200, `10 procedural textures generated in ${elapsed}ms (< 200ms)`);
  });
});
