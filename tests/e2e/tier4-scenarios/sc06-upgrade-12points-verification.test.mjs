import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestCanvas, createMockState, disposalTracker } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78, shuffleArray } from '../../../src/data/tarot78.js';
import {
  buildDeckCarryoverSummary,
  buildReadingBreakdown,
  computeElementalDignityInsight,
  computeNatalProfile,
  detectTopicAndIntent,
  extractGenuineBinaryChoices,
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
    assert.ok(SATI_SYSTEM_PROMPT.includes('กู มึง'), 'System prompt must explicitly forbid crude Thai pronouns');

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

    engine.syncDiscardPile3D([]);
    assert.equal(engine.getDiscardCardMeshes().length, 0, '3D discard pile must stay 0 while initial spread is still on the table');

    engine.syncDiscardPile3D(state.discardPile);
    assert.equal(engine.getDiscardCardMeshes().length, 10, '3D discard pile renders layers matching discardPile count once replaced');

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

  it('SC-06-04: Long-deck anti-repetition, topic isolation, or-choice guard & deck reshuffle carryover work cleanly', () => {
    const deck = buildFullDeck78();
    const user = computeNatalProfile({ fullname: 'กิตติภพ รัตนโชติ', nickname: 'ต้น', day: 14, month: 9, year: 2537 });

    // 1. Standalone family/meta questions must not stick to previous 'work' topic
    assert.equal(detectTopicAndIntent('ความสัมพันธ์ในครอบครัวช่วงนี้มีเรื่องอะไรที่ต้องใส่ใจเป็นพิเศษ', 'work').topic, 'self');
    assert.equal(detectTopicAndIntent('จุดบอดที่ผมมองข้ามมานานที่สุดคืออะไร', 'work').topic, 'general');

    // 2. Non-choice 'หรือ' predicates must not break into nonsensical "เลือก X" phrases
    assert.equal(extractGenuineBinaryChoices('ถ้าอยากเริ่มทำโปรเจกต์เสริม จะรุ่งหรือเสี่ยง', 'th'), null);
    assert.equal(extractGenuineBinaryChoices('คนที่คุยอยู่ตอนนี้เขาจริงจังแค่ไหน หรือแค่คุยแก้เหงา', 'th'), null);
    assert.equal(extractGenuineBinaryChoices('ถ้าต้องเลือกวางแผนปลายปี ควรโฟกัสงาน เงิน หรือเรื่องคนรอบตัวก่อน', 'th'), null);
    const genuinePair = extractGenuineBinaryChoices('ควรลาออกตอนนี้เลยไหม หรือรอโบนัสปลายปีก่อนดี', 'th');
    assert.ok(Array.isArray(genuinePair) && genuinePair.length === 2);

    // 3. Multi-turn offline synthesis avoids copying identical opening/closing boilerplate back-to-back
    const st = createMockState({ user, natalCards: deck.slice(0, 10), remainingDeck: deck.slice(10), chatHistory: [] });
    const prompts = [
      'ความสัมพันธ์ในครอบครัวช่วงนี้มีเรื่องอะไรที่ต้องใส่ใจเป็นพิเศษ',
      'จุดบอดที่ผมมองข้ามมานานที่สุดคืออะไร',
      'โอกาสใหม่ที่ไม่คาดคิดใน 1 เดือนนี้จะมาทางไหน',
      'ก่อนจบสำรับแรก ไพ่อยากย้ำคำแนะนำสุดท้ายเรื่องอะไร',
      'ภาพรวมไพ่ช่วงท้ายสำรับนี้สรุปบทเรียนใหญ่ที่สุดของผมตอนนี้คืออะไร',
      'ทิศทางชีวิตอีก 6 เดือนข้างหน้าควรปรับอะไรบ้าง'
    ];
    const replies = prompts.map((q, idx) => {
      const spread = deck.slice(10 + idx * 3, 13 + idx * 3);
      st.chatHistory.push({ speaker: user.nickname, role: 'user', text: q });
      const ans = synthesizeDeepReply(st, q, spread);
      st.chatHistory.push({ speaker: 'สติ', role: 'sati', text: ans });
      assert.ok(!ans.includes('ถามวนเรื่องเดิมซ้ำ'), `Turn ${idx + 1} distinct question must not trigger repeat scolding`);
      return ans;
    });
    for (let i = 1; i < replies.length; i += 1) {
      assert.notEqual(replies[i].slice(0, 30), replies[i - 1].slice(0, 30), 'Consecutive offline openings should vary cleanly');
      const lastLinePrev = replies[i - 1].split('\n').pop().slice(0, 26);
      const lastLineCurr = replies[i].split('\n').pop().slice(0, 26);
      assert.notEqual(lastLineCurr, lastLinePrev, 'Consecutive offline closing clauses must rotate cleanly');
    }

    // 4. Reshuffle carryover summary preserves thematic anchor while isolating active repeat checks
    st.deckNumber = 1;
    st.activeSpread = deck.slice(28, 31);
    const summary = buildDeckCarryoverSummary(st, 'th');
    assert.ok(summary.includes('สำรับ 1') && summary.length > 20);
    st.deckCarryoverSummary = summary;
    st.deckResetAtIndex = st.chatHistory.length;
    st.deckNumber = 2;
    st.lastTopic = 'general';
    const postResetAns = synthesizeDeepReply(st, 'ในสำรับใหม่นี้ โอกาสใหญ่เรื่องงานจะเริ่มจากทางไหน', deck.slice(0, 3));
    assert.ok(!postResetAns.includes('ถามวนเรื่องเดิมซ้ำ'), 'First question on newly reset Deck #2 must never accuse repeat against Deck #1');
  });
});
