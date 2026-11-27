import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { setupHeadlessEnv } from '../harness/headlessEnv.mjs';
import { createMockState } from '../harness/testHelpers.mjs';
import * as tarot78 from '../../../src/data/tarot78.js';
import * as divScience from '../../../src/engine/divinationScience.js';
import * as satiBrain from '../../../src/engine/satiBrain.js';
import * as geminiProxy from '../../../backend/geminiProxyServer.js';

setupHeadlessEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u20E3|\uFE0F/u;
const AI_OR_PROFANE_RE = /(?:\b(?:AI|Bot|chatbot)\b|เอไอ|บอท|จอมเวท|(?:^|[\s"'(])(?:กู|มึง)(?=[\s"'.,!?ๆ]|$)|\s+(?:นะ)?(?:วะ|เว้ย|โว้ย)(?=[\s.,!?]|$)|(?<![ก-๙])(?:แม่ง|เหี้ย|สัส|เชี่ย)(?![ก-๙])|ไม่อวย|สรุปตรงๆ:|สิ่งที่ควรทำตอนนี้:|ก้าวแรกตอนนี้:|เหลือไพ่)/i;
const DOOM_FATALISM_RE = /(?:หมดหวังตลอดกาล|ไม่มีวันฟื้น|พังพินาศแน่นอน|หายนะถาวร|ดวงแตกแก้ไม่ได้|doomed forever|hopeless fate)/i;

const deck = tarot78.buildFullDeck78();

function cardByUid(uid, reversed = false) {
  const found = deck.find((c) => c.uid === uid);
  assert.ok(found, `Card uid not found in 78-card deck: ${uid}`);
  return reversed ? { ...found, reversed: true } : { ...found, reversed: false };
}

function createBomUser(overrides = {}, referenceDate = new Date('2026-11-23T12:00:00Z')) {
  const user = {
    fullname: 'ธนภัทร พิมพ์มากร',
    nickname: 'บอม',
    day: 25,
    month: 6,
    year: 2539,
    birthdate: '1996-06-25',
    birthTime: '10:30',
    email: 'bom.sc12@example.com',
    ...overrides
  };
  return satiBrain.computeNatalProfile(user, referenceDate);
}

function assertCleanOfflineReply(reply, nick = 'บอม', label = 'offline') {
  assert.equal(typeof reply, 'string', `${label}: reply must be a string`);
  assert.ok(reply.length > 40 && reply.length < 550, `${label}: offline reply must stay < 550 chars, got ${reply.length}`);
  assert.equal(EMOJI_RE.test(reply), false, `${label}: offline reply must contain zero Unicode emojis`);
  assert.equal(AI_OR_PROFANE_RE.test(reply), false, `${label}: offline reply broke Sati persona guard: ${reply}`);
  assert.equal(DOOM_FATALISM_RE.test(reply), false, `${label}: offline reply used fatalistic doom framing`);
  assert.ok(!reply.includes('*') && !reply.includes('• '), `${label}: offline reply must contain no markdown or bullet dumps`);
  if (nick) {
    assert.ok(reply.includes(nick), `${label}: offline reply should address user nickname "${nick}"`);
  }
}

function assertQuestionFirstPromptLayout(bundle, expectedQuestion, expectedSubDomain) {
  const uc = bundle.userContext;
  const qfIdx = uc.indexOf('<question_focus>');
  const dcIdx = uc.indexOf('<drawn_cards>');
  const dsIdx = uc.indexOf('<divination_synthesis>');
  const bgIdx = uc.indexOf('<background_context>');
  const anIdx = uc.indexOf('<answer_now>');

  assert.ok(qfIdx !== -1 && dcIdx > qfIdx && dsIdx > dcIdx, 'Prompt must place <question_focus> -> <drawn_cards> -> <divination_synthesis> in order');
  if (bgIdx !== -1) {
    assert.ok(bgIdx > dsIdx && anIdx > bgIdx, 'Prompt must place <background_context> after synthesis and before <answer_now>');
  } else {
    assert.ok(anIdx > dsIdx, 'Prompt must place <answer_now> at the end');
  }

  const questionFocusBlock = uc.slice(qfIdx, dcIdx);
  assert.ok(questionFocusBlock.includes(expectedQuestion), `Question-First <question_focus> must contain literal question: ${expectedQuestion}`);
  if (expectedSubDomain) {
    assert.ok(questionFocusBlock.includes(`subDomain=${expectedSubDomain}`), `<question_focus> must lock subDomain=${expectedSubDomain}`);
  }
  assert.equal(EMOJI_RE.test(uc), false, 'Prompt userContext must contain zero Unicode emojis');
  assert.equal(EMOJI_RE.test(bundle.systemInstruction), false, 'System instruction must contain zero Unicode emojis');
}

describe('Tier 4 - Scenario 12: Divination Science, Thai Astrology & 10-Scenario Real-World Accuracy', () => {
  beforeEach(() => {
    geminiProxy.resetModelCooldownForTest();
    geminiProxy.resetReadRateLimitForTest();
  });

  afterEach(() => {
    geminiProxy.resetModelCooldownForTest();
    geminiProxy.resetReadRateLimitForTest();
  });

  it('SC-12-01: Golden Dawn Positional Elemental Dignity, Triad Modulation, 36 Decans & 4-Lens Constructive Reversals work accurately', () => {
    // 1. All 78 cards resolve canonical GD elements including Major Arcana
    for (const c of deck) {
      const el = divScience.resolveCardElement(c);
      assert.ok(['fire', 'water', 'air', 'earth'].includes(el), `Card ${c.uid} failed resolveCardElement: ${el}`);
    }
    assert.equal(divScience.resolveCardElement(cardByUid('M_16')), 'fire');
    assert.equal(divScience.resolveCardElement(cardByUid('M_18')), 'water');
    assert.equal(divScience.resolveCardElement(cardByUid('M_0')), 'air');

    // 2. Pairwise classification (Friendly, Contrary, Identical, Neutral)
    assert.equal(divScience.classifyElementPair('fire', 'air').relation, 'friendly');
    assert.equal(divScience.classifyElementPair('water', 'earth').relation, 'friendly');
    assert.equal(divScience.classifyElementPair('fire', 'water').relation, 'contrary');
    assert.equal(divScience.classifyElementPair('air', 'earth').relation, 'contrary');
    assert.equal(divScience.classifyElementPair('fire', 'fire').relation, 'identical');
    assert.equal(divScience.classifyElementPair('fire', 'earth').relation, 'neutral');

    // 3. Triad modulation & flanking cancellation + SC-06/SC-09 Fire+Air preservation
    const fireAirFire = [cardByUid('Wands_Ace'), cardByUid('Swords_Ace'), cardByUid('Wands_Three')];
    const doublyGood = divScience.analyzePositionalElementalDignity(fireAirFire, { lang: 'th' });
    assert.equal(doublyGood.centerModulation, 'doubly_well_dignified');
    assert.ok(doublyGood.legacyTag.includes('ไฟ+ลม'));
    assert.ok(divScience.analyzePositionalElementalDignity(fireAirFire, { lang: 'en' }).legacyTag.includes('Fire + Air'));
    assert.ok(divScience.analyzePositionalElementalDignity(fireAirFire, { lang: 'zh' }).legacyTag.includes('火风相生'));

    const doublyIll = divScience.analyzePositionalElementalDignity(
      [cardByUid('Wands_Ace'), cardByUid('Cups_Two'), cardByUid('Wands_Three')],
      { lang: 'th' }
    );
    assert.equal(doublyIll.centerModulation, 'doubly_ill_dignified');

    const flankingCancelled = divScience.analyzePositionalElementalDignity(
      [cardByUid('Wands_Ace'), cardByUid('M_2'), cardByUid('Cups_Two')],
      { lang: 'th' }
    );
    assert.equal(flankingCancelled.centerModulation, 'flanking_cancelled');

    const courtTension = divScience.analyzePositionalElementalDignity([cardByUid('Cups_Knight')], { lang: 'th' });
    assert.equal(courtTension.courtSubElements[0]?.internalRelation, 'contrary');
    const courtKing = divScience.analyzePositionalElementalDignity([cardByUid('Cups_King')], { lang: 'th' });
    assert.equal(courtKing.courtSubElements[0]?.internalRelation, 'neutral');

    const natal10Dignity = divScience.analyzePositionalElementalDignity(deck.slice(0, 10), { lang: 'th', isNatal10: true });
    assert.equal(natal10Dignity.pairs.length, 7);
    assert.equal(natal10Dignity.triads.length, 3);

    // 4. 36 Decan Timing & Reversed Delay
    assert.equal(Object.keys(divScience.DECAN_36_METADATA).length, 36);
    const fastWands = divScience.getDecanTimingProfile(cardByUid('Wands_Eight'), { lang: 'th' });
    const revFastWands = divScience.getDecanTimingProfile(cardByUid('Wands_Eight', true), { lang: 'th' });
    const slowEarth = divScience.getDecanTimingProfile(cardByUid('Pentacles_Seven'), { lang: 'th' });
    const revSlowEarth = divScience.getDecanTimingProfile(cardByUid('Pentacles_Seven', true), { lang: 'th' });

    assert.equal(fastWands.paceTier, 'immediate');
    assert.equal(revFastWands.paceTier, 'short');
    assert.equal(revFastWands.isDelayedByReversal, true);
    assert.equal(slowEarth.paceTier, 'slow');
    assert.ok(revSlowEarth.windowText.includes('3-5 เดือน'));

    // 5. 4-Lens Constructive Reversed Diagnosis across th/en/zh (zero doom, zero emojis)
    for (const lang of ['th', 'en', 'zh']) {
      const diagTower = divScience.diagnoseReversedCard(cardByUid('M_16', true), {
        lang,
        posIndex: 1,
        totalCards: 3,
        posLabel: 'Obstacle',
        neighborCards: [cardByUid('Wands_Ace'), cardByUid('Cups_Two')]
      });
      assert.equal(diagTower.isReversed, true);
      assert.ok(['blocked', 'internalized', 'delayed', 'excessive'].includes(diagTower.lens));
      assert.ok(diagTower.constructiveReframe.length > 10 && diagTower.actionTrigger.length > 10);
      assert.equal(EMOJI_RE.test(diagTower.promptLine), false);
      assert.equal(DOOM_FATALISM_RE.test(diagTower.promptLine), false);
    }
    assert.equal(divScience.diagnoseReversedCard(cardByUid('M_16', false), { lang: 'th' }).isReversed, false);
  });

  it('SC-12-02: Thai Planetary Pairs (คู่มิตร/คู่ศัตรู/คู่ธาตุ/คู่สมพล + 2-5 dual tag) and Domain-Targeted Thaksa preserve SC-09-01', () => {
    assert.equal(Object.keys(divScience.THAI_PLANET_NUMBERS).length, 8);
    assert.equal(divScience.THAI_PLANET_STRENGTHS.venus, 21);

    // Classic pairs + input normalization
    const friend36 = divScience.evaluateThaiPlanetaryPair('วันอังคาร', 6, { lang: 'th' });
    assert.ok(friend36.relations.includes('friend') && friend36.isSupportive && !friend36.isFriction);
    assert.ok(friend36.summary.includes('คู่มิตร (3-6)'));

    const enemy13 = divScience.evaluateThaiPlanetaryPair('sun', 'อังคาร', { lang: 'th' });
    assert.ok(enemy13.relations.includes('enemy') && enemy13.isFriction);
    assert.ok(enemy13.summary.includes('คู่ศัตรู (1-3)'));

    const dual25 = divScience.evaluateThaiPlanetaryPair(2, 'พฤหัสบดี', { lang: 'th' });
    assert.equal(dual25.primaryRelation, 'dual');
    assert.ok(dual25.relations.includes('element') && dual25.relations.includes('enemy'));
    assert.equal(dual25.elementTag, 'earth');

    const somphon47 = divScience.evaluateThaiPlanetaryPair('mercury', 'saturn', { lang: 'th' });
    assert.ok(somphon47.relations.includes('somphon'));
    assert.ok(somphon47.summary.includes('27'));

    const same33 = divScience.evaluateThaiPlanetaryPair('mars', 'วันอังคาร', { lang: 'th' });
    assert.equal(same33.primaryRelation, 'same');

    // Domain-targeted annual Thaksa across domains
    const user2026 = createBomUser({}, new Date('2026-11-23T12:00:00Z'));
    for (const [domain, expectedRole] of [
      ['work', 'เดช'],
      ['money', 'มูละ'],
      ['love', 'บริวาร'],
      ['study', 'เดช'],
      ['health', 'อายุ'],
      ['family', 'บริวาร']
    ]) {
      const focus = divScience.selectDomainThaksaFocus(
        user2026,
        user2026.annualThaksa,
        { topic: domain, subDomain: domain, intent: 'outcome', rawQuestion: 'ทดสอบ' },
        { lang: 'th', cards: [cardByUid('M_16', true), cardByUid('Wands_Six')] }
      );
      assert.equal(focus.targetedAnnualHouses[0]?.role, expectedRole);
      assert.ok(focus.compactPromptBlock.length <= 300, `${domain} compactPromptBlock exceeded 300 chars`);
      assert.ok(focus.shortOfflineClause.length <= 110, `${domain} shortOfflineClause exceeded 110 chars`);
      assert.ok(focus.compactPromptBlock.includes('ศรีจร=') && focus.compactPromptBlock.includes('กาลกิณีจร='));
      assert.equal(EMOJI_RE.test(focus.compactPromptBlock + focus.shortOfflineClause), false);
    }

    const studyFocus = divScience.selectDomainThaksaFocus(
      user2026,
      user2026.annualThaksa,
      { topic: 'work', subDomain: 'study', intent: 'outcome', rawQuestion: 'สอบผ่านไหม' },
      { lang: 'th', cards: [cardByUid('M_9')] }
    );
    assert.deepEqual(studyFocus.specialPlanets, ['mercury', 'jupiter']);
  });

  it('SC-12-03: Prompt architecture enforces Question-First ordering, domain-filtered card lines, compact natal, XML tag sanitization, and warm Sati mocked output', async () => {
    const user = createBomUser({}, new Date('2026-11-23T12:00:00Z'));
    const natal10 = deck.slice(0, 10);
    const spread3 = [cardByUid('M_6'), cardByUid('Cups_Seven'), cardByUid('Wands_Knight', true)];

    const loveBundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      natalCards: natal10,
      cards: spread3,
      question: 'คนคุยตอนนี้เขาคิดยังไงกับเรา จริงจังไหม'
    });
    assertQuestionFirstPromptLayout(loveBundle, 'คนคุยตอนนี้เขาคิดยังไงกับเรา จริงจังไหม', 'love');

    // Strictly 1 non-empty line per card and strictly domain-filtered (no work/money dump in love spread)
    const spreadLines = loveBundle.formattedSpread.split(/\r?\n/).filter((l) => l.trim().length > 0);
    assert.equal(spreadLines.length, 3);
    assert.ok(spreadLines.every((l) => l.includes('รัก:') && !l.includes('งาน:') && !l.includes('เงิน:')),
      `Love spread must emit only love aspect, got:\n${loveBundle.formattedSpread}`);

    // Compact natal baseline (only 3 secondary anchors, NOT all 10 natal cards & NOT raw 8-role char lists)
    assert.ok(!loveBundle.userContext.includes('รายละเอียดภูมิ:'));
    const bgMatch = loveBundle.userContext.match(/<background_context>([\s\S]*?)<\/background_context>/);
    assert.ok(bgMatch && bgMatch[1].includes('พื้นดวงเดิมเฉพาะจุดที่เกี่ยว'));
    assert.equal(bgMatch[1].includes(`10.${natal10[9].name}`) && bgMatch[1].includes(`1.${natal10[0].name}`) && bgMatch[1].includes(`4.${natal10[3].name}`), false,
      '1-3 card follow-up must NOT dump all 10 natal cards into <background_context>');

    // Sanitizer strips accidental XML prompt tags + markdown + profanity + emojis while preserving "ผู้เชี่ยวชาญ" / "เชี่ยวชาญ"
    const dirty = '<question_focus>สวัสดี</question_focus> **บอม** มึงไม่ต้องกลัว เชี่ย 🤖 <answer_now>ลองปรึกษาผู้เชี่ยวชาญที่เชี่ยวชาญตรงๆ นะ</answer_now>';
    const cleaned = geminiProxy.sanitizeSatiText(dirty, 'th');
    assert.ok(!cleaned.includes('<question_focus>') && !cleaned.includes('</answer_now>') && !cleaned.includes('**') && !cleaned.includes('มึง'));
    assert.ok(cleaned.includes('ผู้เชี่ยวชาญ') && cleaned.includes('เชี่ยวชาญ'), `Expected "ผู้เชี่ยวชาญ" / "เชี่ยวชาญ" preserved, got: ${cleaned}`);
    assert.ok(!/(?<![ก-๙])เชี่ย(?![ก-๙])/.test(cleaned), 'Standalone profanity must still be stripped');
    assert.equal(EMOJI_RE.test(cleaned), false);

    const chunkClean = geminiProxy.sanitizeStreamChunk('</drawn_cards>*สติ* 🌟');
    assert.equal(chunkClean, 'สติ ');

    // Mocked handleSatiReadRequest preserves Sati voice and system prompt tokens
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key-sc12';
    try {
      const res = await geminiProxy.handleSatiReadRequest({
        lang: 'th',
        userProfile: user,
        natalCards: natal10,
        cards: spread3,
        question: 'คนคุยตอนนี้เขาคิดยังไงกับเรา จริงจังไหม'
      }, {
        createAiClient: () => ({
          models: {
            async generateContent({ contents }) {
              assert.ok(contents.indexOf('<question_focus>') < contents.indexOf('<drawn_cards>'));
              return {
                text: '<question_focus>ตรงๆ นะบอม</question_focus> ตอนนี้เขายังชั่งใจอยู่ไม่ได้ปิดกั้น แต่ยังไม่วางใจเต็มร้อย\n\nไพ่ **The Lovers** ชนกับ Seven of Cups และ Knight of Wands [กลับหัว] สะท้อนว่าเขามีหลายเรื่องให้ลังเล\n\nลองเว้นจังหวะดูความสม่ำเสมอสักสองสัปดาห์ก่อนนะ'
              };
            }
          }
        })
      });
      assert.equal(res.fallback, false);
      assert.ok(res.reply.includes('บอม'));
      assert.equal(EMOJI_RE.test(res.reply), false);
      assert.equal(AI_OR_PROFANE_RE.test(res.reply), false);
      assert.ok(!res.reply.includes('<question_focus>') && !res.reply.includes('**'));
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it('SC-12-04 [S1 Love / Ex / No-Contact]: "เขาจะทักกลับมาหาเราไหม" detects love contact intent accurately', () => {
    const user = createBomUser();
    const q = 'เขาจะทักกลับมาหาเราไหม';
    const parsed = satiBrain.detectTopicAndIntent(q, 'work');
    assert.equal(parsed.topic, 'love');
    assert.equal(parsed.subDomain, 'love');
    assert.equal(parsed.intent, 'outcome');

    const spreadPos = [cardByUid('Cups_Eight'), cardByUid('M_20'), cardByUid('Wands_Eight')];
    const spreadNeg = [cardByUid('Cups_Five'), cardByUid('Swords_Eight'), cardByUid('M_18', true)];

    const bundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      natalCards: deck.slice(0, 10),
      cards: spreadPos,
      question: q
    });
    assertQuestionFirstPromptLayout(bundle, q, 'love');
    assert.ok(bundle.formattedSpread.includes('รัก:') && !bundle.formattedSpread.includes('งาน:'));

    const st = createMockState({ user, natalCards: deck.slice(0, 10), remainingDeck: deck.slice(10) });
    const replyPos = satiBrain.synthesizeDeepReply(st, q, spreadPos);
    const replyNeg = satiBrain.synthesizeDeepReply(st, q, spreadNeg);

    assertCleanOfflineReply(replyPos, 'บอม', 'S1-pos');
    assertCleanOfflineReply(replyNeg, 'บอม', 'S1-neg');
    assert.match(replyPos, /(ทัก|คุย|ติดต่อ)/);
    assert.match(replyNeg, /(ทักกลับ|ชะลอ|กำแพง|ปม)/);
  });

  it('SC-12-05 [S2 Love / Situationship Mindset]: "คนคุยตอนนี้เขาคิดยังไงกับเรา จริงจังไหม"', () => {
    const user = createBomUser();
    const q = 'คนคุยตอนนี้เขาคิดยังไงกับเรา จริงจังไหม';
    const parsed = satiBrain.detectTopicAndIntent(q, 'general');
    assert.equal(parsed.topic, 'love');
    assert.equal(parsed.subDomain, 'love');
    assert.equal(parsed.intent, 'other_person');

    const cards = [cardByUid('M_6'), cardByUid('Cups_Seven'), cardByUid('Wands_Knight', true)];
    const dynamics = divScience.analyzeSpreadCausalDynamics(cards, { lang: 'th', questionProfile: parsed });
    assert.equal(dynamics.courtRoles[0]?.roleType, 'other_person');

    const st = createMockState({ user, natalCards: deck.slice(0, 10) });
    const reply = satiBrain.synthesizeDeepReply(st, q, cards);
    assertCleanOfflineReply(reply, 'บอม', 'S2');
    assert.ok(!reply.includes('ดีลตกลงผลประโยชน์') && !reply.includes('เจ้านาย'));
    assert.ok(reply.includes('The Lovers') && reply.includes('Knight of Wands') && reply.includes('[กลับหัว]'));
  });

  it('SC-12-06 [S3 Work / Binary Decision]: "ควรลาออกไปทำที่ใหม่หรือรอโบนัสที่เดิมก่อน" routes to medium thinking & compares trade-offs', () => {
    const user = createBomUser();
    const q = 'ควรลาออกไปทำที่ใหม่หรือรอโบนัสที่เดิมก่อน';
    const parsed = satiBrain.detectTopicAndIntent(q, 'general');
    assert.equal(parsed.topic, 'work');
    assert.equal(parsed.subDomain, 'work');
    assert.equal(parsed.intent, 'decision');

    const pair = satiBrain.extractGenuineBinaryChoices(q, 'th');
    assert.ok(Array.isArray(pair) && pair.length === 2);
    assert.ok(pair[0].includes('ลาออก') && pair[1].includes('รอโบนัส'));

    const routing = geminiProxy.resolveThinkingConfigForRequest({
      isNatal10: false,
      cards: [cardByUid('Wands_Two'), cardByUid('Pentacles_Eight'), cardByUid('M_7')],
      question: q,
      questionProfile: parsed
    }, 'gemini-3.5-flash-lite');
    assert.equal(routing.thinkingLevel, 'medium');
    assert.equal(routing.thinkingBudget, 1024);
    assert.ok(routing.maxOutputTokens >= 3600);

    const bundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      natalCards: deck.slice(0, 10),
      cards: [cardByUid('Pentacles_Five'), cardByUid('M_16', true), cardByUid('Swords_Two')],
      question: q
    });
    assertQuestionFirstPromptLayout(bundle, q, 'work');
    assert.ok(bundle.formattedSpread.includes('งาน:') && !bundle.formattedSpread.includes('รัก:'));

    const st = createMockState({ user, natalCards: deck.slice(0, 10) });
    const reply = satiBrain.synthesizeDeepReply(st, q, [cardByUid('Pentacles_Five'), cardByUid('M_16', true), cardByUid('Swords_Two')]);
    assertCleanOfflineReply(reply, 'บอม', 'S3');
    assert.ok(reply.includes('ระหว่าง "'));
  });

  it('SC-12-07 [S4 Work / Interview Outcome]: "สัมภาษณ์งานรอบสุดท้ายอาทิตย์หน้าจะผ่านไหม"', () => {
    const user = createBomUser();
    const q = 'สัมภาษณ์งานรอบสุดท้ายอาทิตย์หน้าจะผ่านไหม';
    const parsed = satiBrain.detectTopicAndIntent(q, 'love');
    assert.equal(parsed.topic, 'work');
    assert.equal(parsed.subDomain, 'work');
    assert.equal(parsed.intent, 'outcome');

    const cards = [cardByUid('Pentacles_Three'), cardByUid('Swords_King'), cardByUid('Wands_Six')];
    const bundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      natalCards: deck.slice(0, 10),
      cards,
      question: q
    });
    assertQuestionFirstPromptLayout(bundle, q, 'work');
    assert.ok(bundle.formattedSpread.includes('งาน:') && !bundle.formattedSpread.includes('รัก:'));
    assert.ok(bundle.userContext.includes('เดชจร=') || bundle.userContext.includes('อุตสาหะจร='));

    const st = createMockState({ user, natalCards: deck.slice(0, 10) });
    const reply = satiBrain.synthesizeDeepReply(st, q, cards);
    assertCleanOfflineReply(reply, 'บอม', 'S4');
    assert.ok(reply.includes('โอกาสสำเร็จ') || reply.includes('Six of Wands'));
  });

  it('SC-12-08 [S5 Money / Investment Risk]: "ช่วงนี้เอาเงินเก็บไปลงทุนเปิดร้านดีไหม"', () => {
    const user = createBomUser();
    const q = 'ช่วงนี้เอาเงินเก็บไปลงทุนเปิดร้านดีไหม';
    const parsed = satiBrain.detectTopicAndIntent(q, 'general');
    assert.equal(parsed.topic, 'money');
    assert.equal(parsed.subDomain, 'money');
    assert.equal(parsed.intent, 'decision');

    const cards = [cardByUid('M_15'), cardByUid('Pentacles_Seven'), cardByUid('Pentacles_Ace', true)];
    const bundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      natalCards: deck.slice(0, 10),
      cards,
      question: q
    });
    assertQuestionFirstPromptLayout(bundle, q, 'money');
    assert.ok(bundle.formattedSpread.includes('เงิน:') && !bundle.formattedSpread.includes('รัก:'));
    assert.ok(bundle.userContext.includes('มูละจร=') && bundle.userContext.includes('ศรีจร='));

    const st = createMockState({ user, natalCards: deck.slice(0, 10) });
    const reply = satiBrain.synthesizeDeepReply(st, q, cards);
    assertCleanOfflineReply(reply, 'บอม', 'S5');
    assert.match(reply, /(ชะลอ|ปลอดภัย|ไม่ควรรีบ|รอบคอบ|ตัวเลข)/);
  });

  it('SC-12-09 [S6 Timing Question]: "อีกนานไหมกว่าการเงินจะเริ่มขยับดีขึ้น" differentiates Fire vs Earth decan pace', () => {
    const user = createBomUser();
    const q = 'อีกนานไหมกว่าการเงินจะเริ่มขยับดีขึ้น';
    const parsed = satiBrain.detectTopicAndIntent(q, 'general');
    assert.equal(parsed.topic, 'money');
    assert.equal(parsed.subDomain, 'money');
    assert.equal(parsed.intent, 'timing');

    const fastCards = [cardByUid('Wands_Ace'), cardByUid('Wands_Three'), cardByUid('Wands_Eight')];
    const slowCards = [cardByUid('Pentacles_Four'), cardByUid('Pentacles_Two'), cardByUid('Pentacles_Seven')];

    const fastBundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      cards: fastCards,
      question: q
    });
    const slowBundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      cards: slowCards,
      question: q
    });
    assertQuestionFirstPromptLayout(fastBundle, q, 'money');
    assert.ok(fastBundle.userContext.includes('1-3 สัปดาห์'));
    assert.ok(slowBundle.userContext.includes('2-4 เดือน'));

    const st = createMockState({ user, natalCards: deck.slice(0, 10) });
    const fastReply = satiBrain.synthesizeDeepReply(st, q, fastCards);
    const slowReply = satiBrain.synthesizeDeepReply(st, q, slowCards);
    assertCleanOfflineReply(fastReply, 'บอม', 'S6-fast');
    assertCleanOfflineReply(slowReply, 'บอม', 'S6-slow');
    assert.ok(fastReply.includes('1-3 สัปดาห์'));
    assert.ok(slowReply.includes('2-4 เดือน'));
  });

  it('SC-12-10 [S7 Study / Exam]: "สอบปลายเดือนนี้จะผ่านตามเป้าไหม"', () => {
    const user = createBomUser({ day: 15, month: 8, year: 2549, birthdate: '2006-08-15', nickname: 'มิ้นท์' });
    const q = 'สอบปลายเดือนนี้จะผ่านตามเป้าไหม';
    const parsed = satiBrain.detectTopicAndIntent(q, 'love');
    assert.equal(parsed.topic, 'work');
    assert.equal(parsed.subDomain, 'study');
    assert.equal(parsed.intent, 'outcome');

    const cards = [cardByUid('Pentacles_Eight'), cardByUid('M_9'), cardByUid('Swords_Nine')];
    const bundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      cards,
      question: q
    });
    assertQuestionFirstPromptLayout(bundle, q, 'study');
    assert.ok(bundle.formattedSpread.includes('เรียน/งาน:') && !bundle.formattedSpread.includes('รัก:'));
    assert.ok(bundle.userContext.includes('พุธ') || bundle.userContext.includes('พฤหัส'));

    const st = createMockState({ user, natalCards: deck.slice(0, 10) });
    const reply = satiBrain.synthesizeDeepReply(st, q, cards);
    assertCleanOfflineReply(reply, 'มิ้นท์', 'S7');
    assert.match(reply, /(เรียน|สอบ|โจทย์|เนื้อหา)/);
    assert.ok(!reply.includes('มีใจ') && !reply.includes('คนคุย'));
  });

  it('SC-12-11 [S8 Family]: "คุยเรื่องย้ายออกมาอยู่เองกับที่บ้านยังไงดีไม่ให้ทะเลาะ" isolates family lens with zero romance leak', () => {
    const user = createBomUser();
    const q = 'คุยเรื่องย้ายออกมาอยู่เองกับที่บ้านยังไงดีไม่ให้ทะเลาะ';
    const parsed = satiBrain.detectTopicAndIntent(q, 'love');
    assert.equal(parsed.topic, 'self');
    assert.equal(parsed.subDomain, 'family');
    assert.equal(parsed.intent, 'action');

    const cards = [cardByUid('Wands_Four'), cardByUid('M_14'), cardByUid('Wands_Five', true)];
    const bundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      cards,
      question: q
    });
    assertQuestionFirstPromptLayout(bundle, q, 'family');
    assert.ok(bundle.formattedSpread.includes('ครอบครัว:') && !bundle.formattedSpread.includes('รัก:'));

    const st = createMockState({ user, natalCards: deck.slice(0, 10) });
    const reply = satiBrain.synthesizeDeepReply(st, q, cards);
    assertCleanOfflineReply(reply, 'บอม', 'S8');
    assert.match(reply, /(ที่บ้าน|ครอบครัว|ห่วงใย)/);
    assert.ok(!reply.includes('มีใจ') && !reply.includes('คนคุย') && !reply.includes('ชู้สาว'));
  });

  it('SC-12-12 [S9 Broad Open Question]: "ช่วงนี้ชีวิตเป็นยังไงบ้าง" detects isBroadOpen and adds clarifying prompt', () => {
    const user = createBomUser();
    const q = 'ช่วงนี้ชีวิตเป็นยังไงบ้าง';
    const parsed = satiBrain.detectTopicAndIntent(q, 'money');
    assert.equal(parsed.isBroadOpen, true);
    assert.equal(parsed.intent, 'explain');

    const cards = [cardByUid('M_10'), cardByUid('Cups_Four'), cardByUid('Pentacles_Six')];
    const bundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      cards,
      question: q
    });
    assertQuestionFirstPromptLayout(bundle, q, parsed.subDomain);
    assert.ok(bundle.userContext.includes('isBroadOpen=true'));

    const st = createMockState({ user, natalCards: deck.slice(0, 10) });
    const reply = satiBrain.synthesizeDeepReply(st, q, cards);
    assertCleanOfflineReply(reply, 'บอม', 'S9');
    assert.ok(reply.includes('บอกเพิ่ม'));
  });

  it('SC-12-13 [S10 Conflicting Elements + Reversed Cards + Thai Planetary Pair Intersection]: คู่มิตร (2025) vs คู่ศัตรู (2026)', () => {
    // Tuesday birth (Mars = 3):
    // - 2025-11-23 (ageYung 30) -> fallingHouse = Venus (6) => 3-6 คู่มิตร!
    // - 2026-11-23 (ageYung 31) -> fallingHouse = Sun (1)   => 1-3 คู่ศัตรู!
    const userAllyYear = createBomUser({}, new Date('2025-11-23T12:00:00Z'));
    const userEnemyYear = createBomUser({}, new Date('2026-11-23T12:00:00Z'));

    const conflictSpread = [
      cardByUid('Wands_Ace', false), // Fire
      cardByUid('Cups_Two', false),  // Water (Fire vs Water contrary!)
      cardByUid('M_16', true)        // The Tower Reversed (Fire/Mars)
    ];
    const enemySpread = [
      cardByUid('M_18', true),       // The Moon Reversed (Water)
      cardByUid('M_16', true),       // The Tower Reversed (Fire/Mars)
      cardByUid('M_14', false)       // Temperance (Fire)
    ];

    const interAlly = satiBrain.computeAstroCardIntersection(userAllyYear, conflictSpread, 'th', {
      questionProfile: { topic: 'work', subDomain: 'work', intent: 'action', rawQuestion: 'ช่วงนี้จะจัดการจุดติดขัดยังไงดี' }
    });
    const interEnemy = satiBrain.computeAstroCardIntersection(userEnemyYear, enemySpread, 'th', {
      questionProfile: { topic: 'work', subDomain: 'work', intent: 'action', rawQuestion: 'ช่วงนี้จะจัดการจุดติดขัดยังไงดี' }
    });

    assert.equal(interAlly.birthVsAnnualPair?.primaryRelation, 'friend');
    assert.ok(interAlly.birthVsAnnualPair?.summary.includes('คู่มิตร (3-6)'));
    assert.equal(interEnemy.birthVsAnnualPair?.primaryRelation, 'enemy');
    assert.ok(interEnemy.birthVsAnnualPair?.summary.includes('คู่ศัตรู (1-3)'));

    const dignityConflict = divScience.analyzePositionalElementalDignity(conflictSpread, { lang: 'th' });
    assert.equal(dignityConflict.dominantRelation, 'contrary');
    assert.ok(dignityConflict.promptSummary.includes('ไฟปะทะน้ำ'));

    const bundleConflict = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: userEnemyYear,
      now: '2026-11-23T10:00:00Z',
      cards: enemySpread,
      question: 'ช่วงนี้งานเจอเรื่องติดขัดซ้อนกันควรปรับยังไงดี'
    });
    assertQuestionFirstPromptLayout(bundleConflict, 'ช่วงนี้งานเจอเรื่องติดขัดซ้อนกันควรปรับยังไงดี', 'work');
    assert.equal(bundleConflict.hasReversed, true);
    assert.ok(bundleConflict.formattedSpread.includes('[กลับหัว / Reversed]'));
    assert.equal(bundleConflict.formattedSpread.split(/\r?\n/).filter((l) => l.trim()).length, 3);
    assert.ok(bundleConflict.userContext.includes('คู่ศัตรู (1-3)'));
    assert.ok(bundleConflict.userContext.includes('ศรีจร=') && bundleConflict.userContext.includes('กาลกิณีจร='));

    const stAlly = createMockState({ user: userAllyYear, natalCards: deck.slice(0, 10) });
    const stEnemy = createMockState({ user: userEnemyYear, natalCards: deck.slice(0, 10) });
    const replyAlly = satiBrain.synthesizeDeepReply(stAlly, 'ช่วงนี้จะจัดการจุดติดขัดยังไงดี', conflictSpread);
    const replyEnemy = satiBrain.synthesizeDeepReply(stEnemy, 'ช่วงนี้จะจัดการจุดติดขัดยังไงดี', enemySpread);

    assertCleanOfflineReply(replyAlly, 'บอม', 'S10-ally');
    assertCleanOfflineReply(replyEnemy, 'บอม', 'S10-enemy');
    assert.ok(replyAlly.includes('[กลับหัว]'));
    assert.ok(replyEnemy.includes('[กลับหัว]'));
  });

  it('SC-12-14 [3-Mode Chat Pacing]: buildSatiPromptBundle resolves main_spread, expand_draw, and same_spread_chat accurately', () => {
    const user = createBomUser();
    const natal10 = deck.slice(0, 10);
    const spread3 = [cardByUid('Swords_Three'), cardByUid('Wands_Seven', true), cardByUid('Cups_Six')];

    // 1) main_spread: default fresh 3-card question
    const mainBundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      natalCards: natal10,
      cards: spread3,
      question: 'แฟนของผมจะรักผมจริงป่าว'
    });
    assert.equal(mainBundle.readingMode, 'main_spread');
    assert.ok(mainBundle.userContext.includes('3 ย่อหน้า'));

    // 2) same_spread_chat depth=1: synthesizes all cards behind scenes, no card lecture/names, 1-3 sentences, no premature draw nudge
    const chatDepth1 = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      natalCards: natal10,
      cards: spread3,
      question: 'แฟนผมต้องการอะไรในผมอยู่หรือป่าว',
      isSameSpreadFollowUp: true,
      sameSpreadFollowUpDepth: 1
    });
    assert.equal(chatDepth1.readingMode, 'same_spread_chat');
    assert.ok(chatDepth1.userContext.includes('1 ย่อหน้า (1-3 ประโยค'));
    assert.ok(chatDepth1.userContext.includes('ห้ามไล่อธิบายความหมายหน้าไพ่ซ้ำ') || chatDepth1.userContext.includes('ห้ามไล่อธิบายหน้าไพ่ซ้ำ'));
    assert.ok(chatDepth1.userContext.includes('ไม่ต้องเอ่ยชื่อไพ่'));
    assert.ok(chatDepth1.userContext.includes('รอบนี้ยังไม่ต้องชวนจั่วไพ่เพิ่ม'));
    assert.ok(chatDepth1.formattedSpread.includes('Three of Swords') && chatDepth1.formattedSpread.includes('Six of Cups'));

    // 3) same_spread_chat when explicitly asking which card -> allows brief card citation
    const chatAskCard = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      cards: spread3,
      question: 'แล้วไพ่ใบไหนบอกเรื่องความรู้สึกเขาตรงสุด',
      isSameSpreadFollowUp: true,
      sameSpreadFollowUpDepth: 3
    });
    assert.equal(chatAskCard.readingMode, 'same_spread_chat');
    assert.ok(chatAskCard.userContext.includes('ระบุเฉพาะชื่อไพ่'));
    assert.ok(chatAskCard.userContext.includes('ตบท้ายเบาๆ 1 ประโยคว่ากดจั่วเพิ่ม 1-3 ใบได้'));

    // 4) expand_draw: 1-2 short paragraphs, preserves expand mode directive
    const expandBundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      cards: [cardByUid('Cups_Ace')],
      question: 'ขยายความต่อจากที่ถามไว้ว่า: แฟนผมต้องการอะไรในผมอยู่หรือป่าว',
      isExpandFollowUp: true
    });
    assert.equal(expandBundle.readingMode, 'expand_draw');
    assert.ok(expandBundle.userContext.includes('โหมดจั่วไพ่ขยายคำถามเดิม'));
    assert.ok(expandBundle.userContext.includes('1-2 ย่อหน้าสั้นๆ'));
  });

  it('SC-12-15 [Offline Follow-Up Synthesis & UI Wiring]: same_spread_chat stays 1 paragraph (<320), expand_draw <=420, main.js tracks depth', () => {
    const user = createBomUser();
    const spread3 = [cardByUid('Swords_Three'), cardByUid('Wands_Seven', true), cardByUid('Cups_Six')];
    const st = createMockState({ user, natalCards: deck.slice(0, 10) });

    // Confirm Thai phrasing from video routes cleanly to love / other_person
    const q1 = satiBrain.detectTopicAndIntent('แฟนของผมจะรักผมจริงป่าว', 'general');
    const q2 = satiBrain.detectTopicAndIntent('แฟนผมต้องการอะไรในผมอยู่หรือป่าว', 'love');
    assert.equal(q1.topic, 'love');
    assert.equal(q1.intent, 'other_person');
    assert.equal(q2.topic, 'love');
    assert.equal(q2.intent, 'other_person');

    // Offline same_spread_chat depth 1: single paragraph, <320 chars, zero card names, zero emojis
    const replyChat1 = satiBrain.synthesizeDeepReply(st, 'แฟนผมต้องการอะไรในผมอยู่หรือป่าว', spread3, {
      isSameSpreadFollowUp: true,
      sameSpreadFollowUpDepth: 1
    });
    assert.equal(replyChat1.includes('\n\n'), false, 'same_spread_chat must be 1 single paragraph');
    assert.ok(replyChat1.length > 20 && replyChat1.length < 320, `Expected <320 chars, got ${replyChat1.length}: ${replyChat1}`);
    assert.equal(EMOJI_RE.test(replyChat1), false);
    assert.equal(AI_OR_PROFANE_RE.test(replyChat1), false);
    assert.ok(!replyChat1.includes('Three of Swords') && !replyChat1.includes('Six of Cups'),
      `same_spread_chat should not list card names unless asked: ${replyChat1}`);
    assert.ok(!replyChat1.includes('กดจั่วเพิ่ม'), 'Depth 1 should not append draw nudge');

    // Offline same_spread_chat depth 3: gently suggests drawing extra cards
    const replyChat3 = satiBrain.synthesizeDeepReply(st, 'ลึกๆ แล้วเขาคาดหวังอะไรจากเราอยู่', spread3, {
      isSameSpreadFollowUp: true,
      sameSpreadFollowUpDepth: 3
    });
    assert.equal(replyChat3.includes('\n\n'), false);
    assert.ok(replyChat3.length < 320);
    assert.ok(replyChat3.includes('กดจั่วเพิ่ม'));

    // Offline expand_draw: 1-2 short paragraphs <= 420 chars
    const replyExpand = satiBrain.synthesizeDeepReply(st, 'ขยายความต่อจากที่ถามไว้ว่า: แฟนผมต้องการอะไร', [cardByUid('Cups_Ace')], {
      isExpandFollowUp: true
    });
    const expandParas = replyExpand.split(/\n\s*\n/).filter(Boolean);
    assert.ok(expandParas.length >= 1 && expandParas.length <= 2, `expand_draw should be 1-2 paras, got ${expandParas.length}`);
    assert.ok(replyExpand.length <= 420, `expand_draw expected <= 420 chars, got ${replyExpand.length}`);
    assert.equal(EMOJI_RE.test(replyExpand), false);

    // Check src/main.js tracks sameSpreadFollowUpCount and passes options to requestSatiReading
    const mainSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
    assert.ok(mainSrc.includes('sameSpreadFollowUpCount'));
    assert.ok(mainSrc.includes('isSameSpreadFollowUp'));
    assert.ok(mainSrc.includes('sameSpreadFollowUpDepth: state.sameSpreadFollowUpCount'));
  });
});
