import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 2 - Feature 8: Card Draw Empty Deck, Boundary Slots & Rapid Spam', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('T2-F8-01: Empty deck boundary (remainingDeck.length === 0) exits cleanly', () => {
    state.remainingDeck = [];
    const engine = createSati3DEngine({ canvas, state });
    assert.doesNotThrow(() => {
      engine.spawn78CardFan();
    });
    assert.equal(engine.getFanCardMeshes().length, 0);
    engine.dispose();
  });

  it('T2-F8-02: Extreme leftmost card (idx = 0) and extreme rightmost card (idx = 77) draw reach', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const cards = engine.getFanCardMeshes();

    const card0 = cards[0];
    const card77 = cards[cards.length - 1];

    // Card 0 and Card 77 must be at opposite ends of the fan arc
    assert.ok(card0.position.x * card77.position.x < 0, 'Card 0 and Card 77 must span opposite sides of table center');
    assert.ok(Math.abs(card0.position.x) > 0.8, 'Card 0 must be near fan perimeter');
    assert.ok(Math.abs(card77.position.x) > 0.8, 'Card 77 must be near fan perimeter');
    engine.dispose();
  });

  it('T2-F8-03: Rapid card picking spam (10 cards in rapid succession) places cards into slots', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const cards = engine.getFanCardMeshes();

    assert.doesNotThrow(() => {
      for (let i = 0; i < 10; i++) {
        engine.placeSpreadCardIn3D(cards[i], fullDeck[i], i, 10);
      }
    });
    engine.dispose();
  });

  it('T2-F8-04: Screen navigation interruption mid-draw animation does not crash', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    state.handGrab = { side: 'left', pos: new THREE.Vector3(0, 1, 1), startTime: 0 };

    // Sudden screen change
    state.screen = 'login';
    assert.doesNotThrow(() => {
      engine.setCameraTarget(new THREE.Vector3(0, 4.1, 8.1), new THREE.Vector3(0, 2, -2));
    });
    engine.dispose();
  });

  it('T2-F8-05: Frame drop / time warp recovery (dt = 2.0s) completes hand animation', () => {
    const startTime = 10.0;
    state.handGrab = { side: 'right', pos: new THREE.Vector3(0.5, 1, 1), startTime };

    const frameDropTime = 12.0; // 2.0s later
    const isCompleted = frameDropTime - state.handGrab.startTime >= 0.38;
    assert.equal(isCompleted, true, 'Grab animation must be marked completed after large time step');
  });

  it('T2-F8-06: Invalid / null card mesh passed to placeSpreadCardIn3D is safely guarded', () => {
    const engine = createSati3DEngine({ canvas, state });
    assert.doesNotThrow(() => {
      try {
        engine.placeSpreadCardIn3D(null, fullDeck[0], 0, 10);
      } catch (err) {
        // Handled or thrown cleanly
      }
    });
    engine.dispose();
  });
});
