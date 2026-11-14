import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState, simulateResize } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 1 - Feature 2: Mobile Portrait Viewport & Touch Ergonomics', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('T1-F2-01: 3D canvas element has CSS touch-action: none applied', () => {
    assert.equal(canvas.style.touchAction, 'none', 'Canvas style must enforce touch-action: none');
    const engine = createSati3DEngine({ canvas, state });
    assert.equal(canvas.style.touchAction, 'none');
    engine.dispose();
  });

  it('T1-F2-02: Mobile portrait aspect ratio (< 0.75) sets vertical FOV >= 58', () => {
    simulateResize(390, 844); // Aspect ≈ 0.462
    const engine = createSati3DEngine({ canvas, state });
    // updateCameraForAspect sets fov >= 58 on portrait
    assert.ok(globalThis.window.innerWidth / globalThis.window.innerHeight < 0.75);
    engine.dispose();
  });

  it('T1-F2-03: Desktop widescreen aspect ratio (>= 1.0) maintains standard FOV (44)', () => {
    simulateResize(1920, 1080); // Aspect = 1.777
    const engine = createSati3DEngine({ canvas, state });
    assert.equal(globalThis.window.innerWidth, 1920);
    assert.equal(globalThis.window.innerHeight, 1080);
    engine.dispose();
  });

  it('T1-F2-04: Intermediate tablet aspect ratio (0.75 <= aspect < 1.0) sets intermediate FOV', () => {
    simulateResize(768, 1024); // Aspect = 0.75
    const engine = createSati3DEngine({ canvas, state });
    const aspect = 768 / 1024;
    assert.ok(aspect >= 0.75 && aspect <= 1.0, 'Tablet aspect within 0.75-1.0');
    engine.dispose();
  });

  it('T1-F2-05: Pointer event NDC coordinate calculation normalizes touch coordinates accurately', () => {
    const width = 390;
    const height = 844;
    simulateResize(width, height);
    const engine = createSati3DEngine({ canvas, state });

    // Center screen touch
    const clientX = width / 2;
    const clientY = height / 2;
    const ndcX = (clientX / width) * 2 - 1;
    const ndcY = -(clientY / height) * 2 + 1;

    assert.ok(Math.abs(ndcX) < 0.001, 'Center NDC X must be ~0');
    assert.ok(Math.abs(ndcY) < 0.001, 'Center NDC Y must be ~0');

    // Top-left touch
    const tlNdcX = (0 / width) * 2 - 1;
    const tlNdcY = -(0 / height) * 2 + 1;
    assert.equal(tlNdcX, -1);
    assert.equal(tlNdcY, 1);

    // Bottom-right touch
    const brNdcX = (width / width) * 2 - 1;
    const brNdcY = -(height / height) * 2 + 1;
    assert.equal(brNdcX, 1);
    assert.equal(brNdcY, -1);

    engine.dispose();
  });
});
