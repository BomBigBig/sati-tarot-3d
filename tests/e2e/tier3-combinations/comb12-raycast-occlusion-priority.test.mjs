import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 3 - Pairwise 12: Card Picking Raycast Priority vs Table Scenery (F4 + F8)', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck], isPicking: true });
  });

  it('PW-12: In picking mode, raycaster prioritizes fan cards over background table scenery', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const cards = engine.getFanCardMeshes();

    assert.ok(cards.length > 0);
    assert.equal(state.isPicking, true);

    // Ensure world matrices are computed
    cards.forEach(c => c.updateMatrixWorld(true));

    // Create ray targeting fan card
    const targetCard = cards[39]; // center card
    const raycaster = new THREE.Raycaster();
    const origin = new THREE.Vector3(targetCard.position.x, targetCard.position.y + 2, targetCard.position.z + 0.1);
    const dir = new THREE.Vector3().subVectors(targetCard.position, origin).normalize();
    raycaster.set(origin, dir);

    const hits = raycaster.intersectObjects(cards, false);
    assert.ok(hits.length >= 1, 'Target fan card must be intersected first');
    assert.equal(hits[0].object.userData.isFanCard, true);

    engine.dispose();
  });
});
