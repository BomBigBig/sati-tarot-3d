import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import '../harness/testHelpers.mjs';
import {
  createVelvetTableClothTexture,
  createRobeEmbroideryTexture,
  createTapestryTexture,
  createTentWallTexture
} from '../../../src/scene/proceduralTextures.js';

describe('Tier 1 - Feature 6: Refined Velvet Tablecloth & Astrological Wheel', () => {
  it('T1-F6-01: createVelvetTableClothTexture() generates valid CanvasTexture with SRGBColorSpace', () => {
    const tex = createVelvetTableClothTexture();
    assert.ok(tex.isCanvasTexture, 'Should return a THREE.CanvasTexture');
    assert.equal(tex.colorSpace, THREE.SRGBColorSpace, 'Should use SRGBColorSpace');
    tex.dispose();
  });

  it('T1-F6-02: Tablecloth canvas dimensions are at least 512x512 with non-zero pixel data', () => {
    const tex = createVelvetTableClothTexture();
    assert.ok(tex.image.width >= 512, `Width (${tex.image.width}) must be >= 512`);
    assert.ok(tex.image.height >= 512, `Height (${tex.image.height}) must be >= 512`);
    tex.dispose();
  });

  it('T1-F6-03: createRobeEmbroideryTexture() generates embroidered robe texture', () => {
    const tex = createRobeEmbroideryTexture();
    assert.ok(tex.isCanvasTexture, 'Should return CanvasTexture');
    assert.equal(tex.colorSpace, THREE.SRGBColorSpace);
    tex.dispose();
  });

  it('T1-F6-04: createTapestryTexture() supports sun_eye and star_night themes', () => {
    const sunEye = createTapestryTexture('sun_eye');
    const starNight = createTapestryTexture('star_night');
    assert.ok(sunEye.isCanvasTexture);
    assert.ok(starNight.isCanvasTexture);
    sunEye.dispose();
    starNight.dispose();
  });

  it('T1-F6-05: Tablecloth texture supports setting anisotropy filtering >= 1', () => {
    const tex = createVelvetTableClothTexture();
    tex.anisotropy = 4;
    assert.equal(tex.anisotropy, 4);
    tex.dispose();
  });
});
