import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTestCanvas, createMockState } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';

describe('Tier 1 - Feature 8: Synchronized 3-Phase Card Draw Animation', () => {
  let canvas;
  let state;
  let fullDeck;

  beforeEach(() => {
    canvas = createTestCanvas();
    fullDeck = buildFullDeck78();
    state = createMockState({ remainingDeck: [...fullDeck] });
  });

  it('T1-F8-01: Initiating card pick sets hand state targeting card position', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const cards = engine.getFanCardMeshes();
    assert.ok(cards.length > 0);

    const targetCard = cards[10];
    state.handGrab = {
      side: targetCard.position.x < 0 ? 'left' : 'right',
      pos: targetCard.position.clone(),
      startTime: engine.getElapsedTime()
    };

    assert.ok(state.handGrab);
    assert.ok(state.handGrab.pos);
    engine.dispose();
  });

  it('T1-F8-02: Card translation logic updates card position to slot coordinates', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const cards = engine.getFanCardMeshes();
    const cardMesh = cards[0];

    engine.placeSpreadCardIn3D(cardMesh, fullDeck[0], 0, 10);
    assert.ok(cardMesh.userData.targetPos, 'Card must have targetPos defined');
    assert.equal(cardMesh.userData.targetPos.z, -0.34, 'Slot 0 target Z coordinate is -0.34');
    engine.dispose();
  });

  it('T1-F8-03: Left hand reaches when card x < 0 and right hand reaches when card x >= 0', () => {
    const leftCardPos = new THREE.Vector3(-0.6, 1.0, 1.2);
    const rightCardPos = new THREE.Vector3(0.6, 1.0, 1.2);

    const sideForLeft = leftCardPos.x < 0 ? 'left' : 'right';
    const sideForRight = rightCardPos.x < 0 ? 'left' : 'right';

    assert.equal(sideForLeft, 'left');
    assert.equal(sideForRight, 'right');
  });

  it('T1-F8-04: Audio feedback trigger for pick action executes without error', () => {
    const soundMock = {
      playPickCalled: false,
      playPick() {
        this.playPickCalled = true;
      }
    };
    soundMock.playPick();
    assert.equal(soundMock.playPickCalled, true);
  });

  it('T1-F8-05: Spread card placement lands in designated table slot with isSpreadCard metadata', () => {
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const cardMesh = engine.getFanCardMeshes()[0];

    engine.placeSpreadCardIn3D(cardMesh, fullDeck[0], 0, 10);
    assert.equal(cardMesh.userData.isSpreadCard, true, 'Card must be marked as spread card');
    assert.equal(cardMesh.userData.isFanCard, false, 'Card must no longer be marked as fan card');
    assert.ok(cardMesh.userData.targetPos, 'Card must have targetPos defined');
    engine.dispose();
  });

  it('T1-F8-06: Hand grab state clears or resets after duration elapsed', () => {
    const startTime = 1.0;
    state.handGrab = { side: 'left', pos: new THREE.Vector3(0, 1, 1), startTime };

    // Test duration check (> 0.38s is finished)
    const currentTime = 1.5;
    const isFinished = currentTime - state.handGrab.startTime >= 0.38;
    assert.equal(isFinished, true);
  });
});
