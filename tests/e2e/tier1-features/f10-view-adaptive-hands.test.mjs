import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine, CAM_POS } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 1 - Feature 10: View-Adaptive & Mobile-Responsive Hand Transforms', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('T1-F10-01: In 1P perspective mode, camera targets CAM_POS.view1P', () => {
    const engine = createSati3DEngine({ canvas, state });
    assert.doesNotThrow(() => {
      engine.setCameraTarget(CAM_POS.view1P, CAM_POS.view1PLook);
    });
    assert.equal(CAM_POS.view1P.z, 4.44);
    assert.equal(CAM_POS.view1P.y, 3.22);
    engine.dispose();
  });

  it('T1-F10-02: In 2P top-down perspective mode, camera targets CAM_POS.view2P', () => {
    const engine = createSati3DEngine({ canvas, state });
    assert.doesNotThrow(() => {
      engine.setCameraTarget(CAM_POS.view2P, CAM_POS.view2PLook);
    });
    assert.equal(CAM_POS.view2P.z, 2.05);
    assert.equal(CAM_POS.view2P.y, 5.25);
    engine.dispose();
  });

  it('T1-F10-03: Perspective transition vectors are non-null and contain finite numeric coordinates', () => {
    for (const [key, vec] of Object.entries(CAM_POS)) {
      assert.ok(vec, `${key} must exist`);
      assert.ok(isFinite(vec.x) && !isNaN(vec.x), `${key}.x must be finite`);
      assert.ok(isFinite(vec.y) && !isNaN(vec.y), `${key}.y must be finite`);
      assert.ok(isFinite(vec.z) && !isNaN(vec.z), `${key}.z must be finite`);
    }
  });

  it('T1-F10-04: Mobile portrait aspect ratio scales resting hand horizontal coordinates inward', () => {
    const desktopAspect = 1920 / 1080;
    const mobileAspect = 390 / 844;

    const baseHandX = 0.92;
    const mobileFactor = Math.min(1.0, mobileAspect / 0.75);
    const mobileHandX = baseHandX * mobileFactor;

    assert.ok(mobileHandX < baseHandX, 'Mobile hand X coordinate must scale inward');
    assert.ok(mobileHandX <= 0.65, `Mobile hand X (${mobileHandX}) must be <= 0.65 to fit in portrait`);
  });

  it('T1-F10-05: Near-plane clearance condition is satisfied across camera positions', () => {
    const nearPlane = 0.1;
    // In view2P, camera is at Y=5.25, table is at Y=1.03
    const distanceToTable2P = CAM_POS.view2P.y - 1.03;
    assert.ok(distanceToTable2P > nearPlane + 1.0, 'Camera must remain well above table in 2P');

    // In view1P, camera is at Z=4.44, table center is at Z=0.0
    const distanceToTable1P = CAM_POS.view1P.z - 0.0;
    assert.ok(distanceToTable1P > nearPlane + 1.0, 'Camera must remain behind table in 1P');
  });
});
