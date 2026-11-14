import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createMockState } from '../harness/testHelpers.mjs';
import {
  buildNatal10Reading,
  buildReadingBreakdown,
  computeNatalProfile,
  detectTopicAndIntent,
  requestSatiReading,
  synthesizeDeepReply
} from '../../../src/engine/satiBrain.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';
import { getLocalizedCardData } from '../../../src/data/tarot78I18n.js';

describe('Tier 4 - Scenario 04: Network Offline / Gemini Proxy Failure Fallback', () => {
  it('SC-04: Graceful client-side fallback to Thai Thaksa astrology engine when network drops', async () => {
    const fullDeck = buildFullDeck78();
    const state = createMockState({
      user: {
        fullname: 'สมชาย ใจมั่นคง',
        nickname: 'บอม',
        day: 25,
        month: 6,
        year: 2539,
        birthdate: '1996-06-25',
        birthTime: '10:30',
        email: 'somchai@gmail.com'
      },
      chatHistory: []
    });

    // 1. Simulate network failure / 503 error
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (typeof url === 'string' && url.includes('/api/sati/read')) {
        throw new TypeError('Failed to fetch: NetworkError');
      }
      return origFetch(url);
    };

    try {
      // 2. Submit question during network drop
      state.isThinking = true;
      const question = 'ควรตัดสินใจย้ายงานตอนนี้เลยดีไหม หรือรอโบนัสปลายปีดีกว่า';
      const cards = fullDeck.slice(0, 3);

      const reply = await requestSatiReading(state, question, cards, false);
      state.isThinking = false;

      // 3. Verify fallback delivery
      assert.ok(reply, 'Must return a non-empty reading response');
      assert.equal(typeof reply, 'string');
      assert.ok(reply.length > 50, 'Fallback response must contain substantial text');
      // Must not contain AI or emojis per Sati rules
      assert.ok(!reply.includes('🤖'), 'Must not contain robot emojis');
      assert.equal(state.isThinking, false, 'Loading state must clear');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SC-04B: 78-card deck per-card aspects, Thai Thaksa 8-planet detection, and direct Thai replies match real intent', () => {
    const fullDeck = buildFullDeck78();
    assert.equal(fullDeck.length, 78);
    fullDeck.forEach((c) => {
      assert.ok(c.work && c.money && c.love && c.advice && c.tone, `Card ${c.name} must include work/money/love/advice/tone`);
    });

    const user = computeNatalProfile({
      fullname: 'ธนภัทร พิมพ์มากร',
      nickname: 'บอม',
      day: 25,
      month: 6,
      year: 2539
    });
    assert.equal(user.dayName, 'วันอังคาร');
    assert.equal(user.elemShort, 'ลม');
    assert.ok(user.thaksaDetails && Array.isArray(user.thaksaDetails.kalakiniChars));

    // Must not falsely match 'ขาย' inside 'เขายัง'
    const loveQuery = detectTopicAndIntent('เขายังคิดถึงหรือจริงใจกับเราไหม', 'work');
    assert.equal(loveQuery.topic, 'love');
    assert.equal(loveQuery.intent, 'other_person');

    const state = createMockState({ user, natalCards: fullDeck.slice(0, 10), remainingDeck: fullDeck.slice(10), chatHistory: [] });
    const twoOfCups = fullDeck.find((c) => c.name === 'Two of Cups');
    const eightOfSwords = fullDeck.find((c) => c.name === 'Eight of Swords');
    const theSun = fullDeck.find((c) => c.name === 'The Sun');
    const reply = synthesizeDeepReply(state, 'เขายังคิดถึงหรือจริงใจกับเราไหม', [twoOfCups, eightOfSwords, theSun]);

    assert.ok(reply.includes('Two of Cups') && reply.includes('The Sun'), 'Reply must cite actual drawn cards');
    assert.ok(!reply.includes('ดีลตกลงผลประโยชน์'), 'Love question must read love aspect, not money aspect');
    assert.ok(!/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(reply), 'No emojis allowed');
    assert.ok(!/\b(AI|เอไอ|บอท)\b/i.test(reply), 'Must never mention AI/Bot');

    // Legacy saved card without work/money/love/advice fields must auto-hydrate cleanly
    const legacyCard = { uid: 'Wands_Five', name: 'Five of Wands', th: '5ไม้เท้า', suit: 'Wands', core: 'ความขัดแย้งเก่า' };
    const workReply = synthesizeDeepReply(state, 'ควรลาออกตอนนี้เลยไหม หรือรอโบนัสปลายปีก่อนดี', [legacyCard]);
    assert.ok(workReply.includes('จัดกติกาและโฟกัสเป้าหมายเดียว'), 'Legacy card must hydrate specific advice');
    assert.ok(!workReply.includes('ความขัดแย้งเก่า'), 'Legacy card must hydrate updated work meaning');

    // No robotic AI-isms, bullet dumps, report headers, or duplicated lines allowed
    const natalReplyTh = buildNatal10Reading(state, fullDeck.slice(0, 10));
    const bomWorkCards = ['The Hermit', 'Ace of Wands', 'The Moon'].map((n) => fullDeck.find((c) => c.name === n));
    const bomWorkReply = synthesizeDeepReply(state, 'เรื่องการงานของผมจะเป็รยังไงต่อหลังจากนี้', bomWorkCards);
    const theMoon = bomWorkCards[2];
    assert.equal(bomWorkReply.split(theMoon.work).length - 1, 1, 'Outcome card meaning must never be duplicated verbatim');
    assert.ok(bomWorkReply.length < 550, `Bom work 3-card reply should be concise (<550 chars), got ${bomWorkReply.length}`);

    [natalReplyTh, reply, workReply, bomWorkReply].forEach((text) => {
      assert.ok(!text.includes('ไม่อวย'), 'Must not contain robotic ไม่อวย phrase');
      assert.ok(!text.includes('สรุปตรงๆ:'), 'Must not contain robotic สรุปตรงๆ: label');
      assert.ok(!text.includes('เหลือไพ่'), 'Must not repeat deck-count footer boilerplate');
      assert.ok(!text.includes('• '), 'Must not dump robotic bullet points');
      assert.ok(!text.includes('สิ่งที่ควรทำตอนนี้:'), 'Must not contain rigid สิ่งที่ควรทำตอนนี้: header');
      assert.ok(!text.includes('ก้าวแรกตอนนี้:'), 'Must not contain rigid ก้าวแรกตอนนี้: header');
    });
    assert.ok(reply.length < 550, `Follow-up 3-card reply should be concise (<550 chars), got ${reply.length}`);
    assert.ok(workReply.length < 550, `Follow-up 1-card reply should be concise (<550 chars), got ${workReply.length}`);
    assert.ok(!natalReplyTh.includes('กดจั่วเพิ่ม'), 'Natal reading should not include app UI button tutorial boilerplate');

    // Follow-up questions on 10-card spread pick different cards dynamically by intent/focus and stay on topic
    const bossReply = synthesizeDeepReply(state, 'เจ้านายคิดยังไงกับผลงานของเราตอนนี้', state.natalCards);
    const timingReply = synthesizeDeepReply(state, 'งานใหม่นี้จะได้คำตอบเมื่อไหร่', state.natalCards);
    assert.notEqual(bossReply, timingReply, 'Distinct follow-up intents must select relevant spread positions instead of repeating identical output');
    assert.ok(!bossReply.includes('มีใจ') && !bossReply.includes('เปิดใจอยากพัฒนาความสัมพันธ์'), 'Boss/work question must use work framing rather than romantic framing');

    // Full 78-card EN & ZH translations + localized offline readings
    fullDeck.forEach((c) => {
      const enCard = getLocalizedCardData(c, 'en');
      const zhCard = getLocalizedCardData(c, 'zh');
      assert.ok(enCard.title && enCard.work && enCard.money && enCard.love && enCard.advice, `EN missing for ${c.uid}`);
      assert.ok(zhCard.title && zhCard.work && zhCard.money && zhCard.love && zhCard.advice, `ZH missing for ${c.uid}`);
      assert.ok(/[\u4E00-\u9FFF]/.test(zhCard.title), `ZH card title must contain Chinese characters for ${c.uid}`);
    });

    const stateEn = createMockState({ lang: 'en', user, natalCards: fullDeck.slice(0, 10), remainingDeck: fullDeck.slice(10), chatHistory: [] });
    const natalEn = buildNatal10Reading(stateEn, fullDeck.slice(0, 10));
    const replyEn = synthesizeDeepReply(stateEn, 'Should I launch this new work project or wait?', [twoOfCups, theSun]);
    assert.ok(replyEn.includes('Two of Cups') && replyEn.includes('The Sun'), 'EN reply cites drawn cards');
    assert.ok(!natalEn.includes('• ') && !replyEn.includes('• '), 'EN readings must not dump bullet points');
    assert.ok(!replyEn.includes('What to do now:') && !natalEn.includes('First step now:'), 'EN readings must not use rigid headers');
    assert.ok(!/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(natalEn + replyEn), 'No emojis in EN');

    const stateZh = createMockState({ lang: 'zh', user, natalCards: fullDeck.slice(0, 10), remainingDeck: fullDeck.slice(10), chatHistory: [] });
    const natalZh = buildNatal10Reading(stateZh, fullDeck.slice(0, 10));
    const replyZh = synthesizeDeepReply(stateZh, '这份工作项目应该继续推进还是再等等？', [twoOfCups, theSun]);
    assert.ok(replyZh.includes('圣杯二') && replyZh.includes('太阳'), 'ZH reply cites localized card names');
    assert.ok(!natalZh.includes('• ') && !replyZh.includes('• '), 'ZH readings must not dump bullet points');
    assert.ok(!replyZh.includes('眼下建议') && !natalZh.includes('眼下第一步'), 'ZH readings must not use rigid headers');
    assert.ok(!/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(natalZh + replyZh), 'No emojis in ZH');

    // Question parsing fixes: "หรือป่าว" must stay yes/no outcome, not binary choice; "มีโอกาส...ไหม" matches outcome
    const dreamCheck = detectTopicAndIntent('ผมจะทำตามความฝันผมได้หรือป่าว', 'money');
    assert.equal(dreamCheck.intent, 'outcome');
    assert.equal(dreamCheck.topic, 'self');
    const dreamCards = ['King of Swords', 'Ace of Pentacles', 'Three of Cups'].map((n) => fullDeck.find((c) => c.name === n));
    const dreamReply = synthesizeDeepReply(createMockState({ user, lastTopic: 'money', natalCards: state.natalCards }), 'ผมจะทำตามความฝันผมได้หรือป่าว', dreamCards);
    assert.ok(!dreamReply.includes('ระหว่าง "') && !dreamReply.includes('"ป่าว"'), 'Must never split ได้หรือป่าว into a binary choice');
    assert.ok(dreamReply.length < 550, `Dream outcome reply must remain concise (<550 chars), got ${dreamReply.length}`);

    const goalCheck = detectTopicAndIntent('ผมจะมีโอกาสที่จะเก็บเงินให้ได้ 8-10 ล้านไหมก้อนอายุ 50 ปี', 'general');
    assert.equal(goalCheck.topic, 'money');
    assert.equal(goalCheck.intent, 'outcome');
    const goalCards = ['The Hanged Man', 'The Sun', 'Four of Pentacles'].map((n) => fullDeck.find((c) => c.name === n));
    const fourPentacles = goalCards[2];
    const goalReply = synthesizeDeepReply(state, 'ผมจะมีโอกาสที่จะเก็บเงินให้ได้ 8-10 ล้านไหมก้อนอายุ 50 ปี', goalCards);
    assert.ok(goalReply.includes(fourPentacles.advice), 'Outcome spread finishing balanced/favorable should close with outcome advice');

    // Neutral outcome card in 10-card natal reading should not claim "เปิดรับสวย"
    const neutralNatalCards = [...fullDeck.slice(0, 9), fourPentacles];
    const neutralNatalText = buildNatal10Reading(state, neutralNatalCards);
    assert.ok(!neutralNatalText.includes('เปิดรับสวย'), 'Neutral closing card should use balanced phrasing instead of เปิดรับสวย');

    // Chat History Breakdown (⋯): greeting ignored, legacy 3-card reconstructed in order, and 10-card shows full spread
    const greetingBreakdown = buildReadingBreakdown(
      { speaker: 'สติ', role: 'sati', text: 'สวัสดีนะบอม เราชื่อสติ เดี๋ยวรอบแรกนี้หยิบไพ่มา 10 ใบก่อน' },
      '',
      state,
      fullDeck
    );
    assert.equal(greetingBreakdown.isReading, false);

    const legacy3Breakdown = buildReadingBreakdown(
      { speaker: 'สติ', role: 'sati', text: goalReply },
      'ผมจะมีโอกาสที่จะเก็บเงินให้ได้ 8-10 ล้านไหมก้อนอายุ 50 ปี',
      state,
      fullDeck
    );
    assert.equal(legacy3Breakdown.isReading, true);
    assert.equal(legacy3Breakdown.isNatal10, false);
    assert.deepEqual(legacy3Breakdown.primaryCards.map((x) => x.card.name), ['The Hanged Man', 'The Sun', 'Four of Pentacles']);
    assert.ok(legacy3Breakdown.connectionText.length > 20, 'Connection text must link cards to the question');
    legacy3Breakdown.primaryCards.forEach((item) => {
      assert.ok(item.whyReason.length > 20 && item.advice.length > 5 && item.polarityLabel, `Complete breakdown fields required for ${item.card.name}`);
    });

    const natalState = createMockState({ user, natalCards: neutralNatalCards, chatHistory: [] });
    const natal10Breakdown = buildReadingBreakdown({ speaker: 'สติ', role: 'sati', text: neutralNatalText }, '', natalState, fullDeck);
    assert.equal(natal10Breakdown.isReading, true);
    assert.equal(natal10Breakdown.isNatal10, true);
    assert.equal(natal10Breakdown.fullSpreadCards.length, 10);
    assert.ok(natal10Breakdown.primaryCards.length >= 5);

    const zh10Breakdown = buildReadingBreakdown({ speaker: '思谛', role: 'sati', text: natalZh }, '', stateZh, fullDeck);
    assert.equal(zh10Breakdown.isReading, true);
    assert.equal(zh10Breakdown.fullSpreadCards.length, 10);

    // Master Persona Upgrade: Psychological Natal-Element Mirror + Subtext + Repeat-Question Callout + No Banned Phrases
    assert.ok(goalReply.includes('ธาตุลม'), 'Goal reply must anchor user natal element against the spread');
    assert.ok(goalReply.length < 550, `Upgraded goal reply must stay concise (<550 chars), got ${goalReply.length}`);
    assert.ok(
      legacy3Breakdown.connectionText.includes('Subtext') && legacy3Breakdown.connectionText.includes('Rainbow Ruse'),
      'Breakdown Part 2 must include deep subtext and psychological natal contrast'
    );

    const repeatState = createMockState({
      user,
      natalCards: state.natalCards,
      chatHistory: [
        { speaker: 'บอม', role: 'user', text: 'เขายังคิดถึงหรือจริงใจกับเราไหม' },
        { speaker: 'สติ', role: 'sati', text: reply }
      ]
    });
    const repeatLoveReply = synthesizeDeepReply(repeatState, 'สรุปเขายังรักเราอยู่ไหมกันแน่', [twoOfCups, eightOfSwords, theSun]);
    assert.ok(repeatLoveReply.includes('ถามวนเรื่องเดิม'), 'Consecutive question on same topic+intent must trigger repeat-question callout');
    assert.ok(repeatLoveReply.length < 550, `Repeat reply must remain <550 chars, got ${repeatLoveReply.length}`);

    [goalReply, dreamReply, repeatLoveReply].forEach((txt) => {
      assert.ok(!txt.includes('จอมเวท') && !txt.includes('ไม่อวย') && !txt.includes('สรุปตรงๆ') && !txt.includes('เหลือไพ่'), 'Banned AI/mage phrases must never appear');
      assert.ok(!/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(txt), 'No emojis allowed');
    });
  });
});
