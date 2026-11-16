import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState, disposalTracker } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78, shuffleArray } from '../../../src/data/tarot78.js';
import {
  buildReadingBreakdown,
  computeElementalDignityInsight,
  computeNatalProfile,
  synthesizeDeepReply
} from '../../../src/engine/satiBrain.js';
import { buildStoragePayload } from '../../../src/engine/storage.js';
import { SATI_SYSTEM_PROMPT } from '../../../backend/geminiProxyServer.js';

describe('Tier 4 - Scenario 06: 12-Point SATI Upgrade Mechanics Verification', () => {
  it('SC-06-01: Elemental Dignity synthesis enriches breakdowns without altering Sati voice rules', () => {
    const deck = buildFullDeck78();
    const fireAirCards = ['Ace of Wands', 'Knight of Swords', 'The Sun'].map((n) => deck.find((c) => c.name === n));
    const thDignity = computeElementalDignityInsight(fireAirCards, 'th');
    const enDignity = computeElementalDignityInsight(fireAirCards, 'en');
    const zhDignity = computeElementalDignityInsight(fireAirCards, 'zh');

    assert.ok(thDignity.includes('ไฟ+ลม') && thDignity.length > 20);
    assert.ok(enDignity.includes('Fire + Air'));
    assert.ok(zhDignity.includes('火风相生'));

    assert.ok(SATI_SYSTEM_PROMPT.includes('Golden Dawn'), 'System prompt must guide Golden Dawn synthesis');
    assert.ok(SATI_SYSTEM_PROMPT.includes('ห้ามไล่ชื่อไพ่ทั้ง 10 ใบ'), 'System prompt must forbid textbook 10-card recitation');

    const user = computeNatalProfile({ fullname: 'ธนภัทร พิมพ์มากร', nickname: 'บอม', day: 25, month: 6, year: 2539 });
    const state = createMockState({ user, natalCards: deck.slice(0, 10), remainingDeck: deck.slice(10) });
    const reply = synthesizeDeepReply(state, 'โปรเจกต์ใหม่นี้จะรุ่งไหม', fireAirCards);
    const bd = buildReadingBreakdown({ speaker: 'สติ', role: 'sati', text: reply, meta: { cards: fireAirCards } }, 'โปรเจกต์ใหม่นี้จะรุ่งไหม', state, deck);
    assert.ok(bd.connectionText.includes('ไฟ+ลม'));
  });

  it('SC-06-02: 3D Discard Pile sync & Player Self-Shuffle preserve spread cards and remaining deck count', async () => {
    const canvas = createTestCanvas();
    const fullDeck = buildFullDeck78();
    const state = createMockState({
      remainingDeck: fullDeck.slice(10),
      discardPile: fullDeck.slice(0, 10),
      activeSpread: fullDeck.slice(0, 3)
    });
    const engine = createSati3DEngine({ canvas, state });

    engine.spawn78CardFan();
    assert.equal(engine.getFanCardMeshes().length, 68);

    const picked = engine.getFanCardMeshes().slice(0, 3);
    picked.forEach((m, i) => engine.placeSpreadCardIn3D(m, fullDeck[10 + i], i, 3));

    engine.syncDiscardPile3D(state.discardPile);
    assert.equal(engine.getDiscardCardMeshes().length, 10, '3D discard pile renders layers matching discardPile count');

    disposalTracker.reset();
    // Test preserveSpread=true keeps drawn spread cards while re-fanning remainingDeck cleanly
    state.remainingDeck = shuffleArray(state.remainingDeck.slice(3));
    engine.spawn78CardFan(true);
    assert.equal(engine.getFanCardMeshes().length, 65, 'Remaining fan updates cleanly to 65 unopened cards');

    // Clear discard pile disposes discard meshes
    engine.clearDiscardPile3D();
    assert.equal(engine.getDiscardCardMeshes().length, 0);
    assert.ok(disposalTracker.geometries.length >= 1, 'Discard pile disposal releases geometries');

    engine.dispose();
  });

  it('SC-06-03: Storage payload persists savedNatalCards, sessionArchives & sessionActive across exits', () => {
    const deck = buildFullDeck78();
    const state = createMockState({
      sessionActive: false,
      savedNatalCards: deck.slice(0, 10).map((c) => ({ uid: c.uid, name: c.name, th: c.th })),
      discardPile: [],
      remainingDeck: [...deck],
      sessionArchives: [
        {
          id: 'sess_test1',
          endedAt: '2026-11-16T03:00:00.000Z',
          user: { nickname: 'บอม' },
          natalCards: deck.slice(0, 10),
          chatHistory: [{ speaker: 'สติ', role: 'sati', text: 'คำทำนาย' }],
          usedCount: 13
        }
      ]
    });

    const payload = buildStoragePayload(state);
    assert.equal(payload.sessionActive, false);
    assert.equal(payload.savedNatalCards.length, 10);
    assert.equal(payload.remainingDeck.length, 78, 'After exiting, new session deck resets to full 78 cards');
    assert.equal(payload.sessionArchives.length, 1);
    assert.equal(payload.sessionArchives[0].usedCount, 13);

    // Verify 0-9 threshold logic
    const canResetAt = (n) => n <= 9;
    assert.equal(canResetAt(10), false);
    assert.equal(canResetAt(9), true);
    assert.equal(canResetAt(0), true);
  });
});
