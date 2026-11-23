import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { setupHeadlessEnv } from '../harness/headlessEnv.mjs';
import { createMockState, disposalTracker } from '../harness/testHelpers.mjs';
import * as tarot78 from '../../../src/data/tarot78.js';
import * as tarot78I18n from '../../../src/data/tarot78I18n.js';
import * as satiBrain from '../../../src/engine/satiBrain.js';
import * as storage from '../../../src/engine/storage.js';
import * as translations from '../../../src/i18n/translations.js';
import * as geminiProxy from '../../../backend/geminiProxyServer.js';

setupHeadlessEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u20E3|\uFE0F/u;
const THAKSA_RING = [0, 1, 2, 3, 6, 4, 7, 5];
const PLANET_LABEL_PATTERN = {
  sun: '(?:sun|อาทิตย์)',
  moon: '(?:moon|จันทร์)',
  mars: '(?:mars|อังคาร)',
  mercury: '(?:mercury|พุธ)',
  jupiter: '(?:jupiter|พฤหัสบดี|พฤหัส)',
  venus: '(?:venus|ศุกร์)',
  saturn: '(?:saturn|เสาร์)',
  rahu: '(?:rahu|ราหู)'
};

function parseSseFrames(rawText) {
  return String(rawText || '')
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      let event = 'message';
      let dataStr = '';
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
      }
      return { event, data: dataStr ? JSON.parse(dataStr) : null };
    });
}

async function withTestServer(options, fn) {
  const app = geminiProxy.createSatiExpressApp(options);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function createFullTestUser(overrides = {}) {
  return {
    fullname: 'ธนภัทร พิมพ์มากร',
    nickname: 'บอม',
    day: 25,
    month: 6,
    year: 2539,
    birthdate: '1996-06-25',
    birthTime: '10:30',
    email: 'bom.sc09@example.com',
    ...overrides
  };
}

function invokeI18nFormatter(key, fn) {
  const sampleUser = {
    dayName: 'วันอังคาร',
    lifePath: 2,
    birthCard: 'The Sun (ดวงอาทิตย์)'
  };
  const sampleCardData = {
    core: 'แกนหลัก',
    work: 'การงาน',
    money: 'การเงิน',
    love: 'ความรัก',
    advice: 'คำแนะนำ'
  };
  const sampleDayI18n = { day: 'Tuesday', elem: 'Air' };

  switch (key) {
    case 'natalSummaryFmt':
      return fn(sampleUser, 'ลม', 10, sampleDayI18n);
    case 'cardModalMeaning':
      return fn(sampleCardData);
    case 'formatYear':
      return fn(2569);
    case 'hudDiscardLabel':
    case 'btnLedgerHistory':
    case 'btnResetDeck9':
    case 'breakdownOtherNatalToggle':
    case 'activeCardLabel':
    case 'drawFollowUpActionLabel':
    case 'pickFollowUpPrompt':
    case 'waitPickFollowUpDialogue':
      return fn(5);
    case 'discardSummaryFmt':
      return fn(13, 65);
    case 'resumeDeckInfo':
    case 'selfShuffledDoneDialogue':
    case 'welcomeBackDialogue':
      return fn('บอม', 65);
    case 'returningNatalInfo':
      return fn('บอม', 'The Sun', 2);
    case 'archiveSessionHeaderFmt':
      return fn('2026-11-23', 'บอม', 13);
    case 'pickInstructionFmt':
      return fn('เลือกไพ่', 2, 3);
    case 'natalCardItemFmt':
      return fn(0, 'ปัจจุบัน', 'The Fool');
    case 'pickOrderPos':
      return fn(1, 'สถานการณ์');
    case 'welcomeQuick3Dialogue':
      return fn('บอม', 'อดีต · ปัจจุบัน · อนาคต', 'งานช่วงนี้');
    case 'expandPrevActionLogFmt':
      return fn(3, 'งานช่วงนี้');
    default:
      return fn('บอม', 3, 10);
  }
}

function collectEmojiMatchesFromValue(val, keyPath, hits) {
  if (typeof val === 'string') {
    if (EMOJI_RE.test(val)) hits.push(`${keyPath}: ${val}`);
    return;
  }
  if (Array.isArray(val)) {
    val.forEach((item, idx) => collectEmojiMatchesFromValue(item, `${keyPath}[${idx}]`, hits));
    return;
  }
  if (typeof val === 'function') {
    const leafKey = keyPath.split('.').pop();
    const rendered = invokeI18nFormatter(leafKey, val);
    if (typeof rendered === 'string' && EMOJI_RE.test(rendered)) {
      hits.push(`${keyPath}(): ${rendered}`);
    }
    return;
  }
  if (val && typeof val === 'object') {
    for (const [k, v] of Object.entries(val)) {
      collectEmojiMatchesFromValue(v, `${keyPath}.${k}`, hits);
    }
  }
}

function findEmojiLines(text, label) {
  const matches = [];
  String(text || '').split(/\r?\n/).forEach((line, idx) => {
    if (EMOJI_RE.test(line)) {
      matches.push(`${label}:${idx + 1}: ${line.trim().slice(0, 100)}`);
    }
  });
  return matches;
}

describe('Tier 4 - Scenario 09: Annual Thaksa, 78-Card GD, Calibration, Extended Memory & Smart Routing', () => {
  const deck = tarot78.buildFullDeck78();

  beforeEach(() => {
    geminiProxy.resetModelCooldownForTest();
    geminiProxy.resetReadRateLimitForTest();
    disposalTracker.reset();
    globalThis.localStorage?.clear();
  });

  afterEach(() => {
    geminiProxy.resetModelCooldownForTest();
    geminiProxy.resetReadRateLimitForTest();
    disposalTracker.reset();
    globalThis.localStorage?.clear();
  });

  it('SC-09-01: R1 computes annual walking Thaksa across BE/CE, birthday edges, Feb 29 leap year, Wed-night Rahu, and injects real-time date into buildSatiPromptBundle', () => {
    assert.equal(typeof satiBrain.computeAnnualThaksa, 'function', 'computeAnnualThaksa must be exported from satiBrain.js');
    assert.equal(typeof satiBrain.computeNatalProfile, 'function', 'computeNatalProfile must be exported from satiBrain.js');

    const refBeforeBday = new Date('2026-06-24T12:00:00Z');
    const refAfterBday = new Date('2026-11-23T12:00:00Z');

    // 1. BE (2539) vs CE (1996) equivalence & before/after birthday boundary
    const userBE = createFullTestUser({ year: 2539 });
    const userCE = createFullTestUser({ year: 1996 });

    const beforeBE = satiBrain.computeAnnualThaksa(userBE, refBeforeBday);
    const afterBE = satiBrain.computeAnnualThaksa(userBE, refAfterBday);
    const afterCE = satiBrain.computeAnnualThaksa(userCE, refAfterBday);

    assert.equal(beforeBE.ageCompleted, 29);
    assert.equal(beforeBE.ageYung, 30);
    assert.equal(afterBE.ageCompleted, 30);
    assert.equal(afterBE.ageYung, 31);
    assert.equal(afterCE.ageCompleted, 30);
    assert.equal(afterCE.ageYung, 31);
    assert.equal(afterCE.fallingHouse?.groupIdx, afterBE.fallingHouse?.groupIdx, 'BE and CE years must yield identical annual fallingHouse');
    assert.equal(afterCE.siJon?.groupIdx, afterBE.siJon?.groupIdx);
    assert.equal(afterCE.dejJon?.groupIdx, afterBE.dejJon?.groupIdx);
    assert.equal(afterCE.kalakiniJon?.groupIdx, afterBE.kalakiniJon?.groupIdx);

    // Structure verification for fallingHouse & 8 roles
    assert.ok(afterBE.fallingHouse && typeof afterBE.fallingHouse.groupIdx === 'number');
    assert.ok(afterBE.fallingHouse.dayName && afterBE.fallingHouse.planet && afterBE.fallingHouse.elem);
    assert.ok(afterBE.siJon && afterBE.dejJon && afterBE.kalakiniJon);
    assert.ok(Array.isArray(afterBE.roles) && afterBE.roles.length === 8, 'Annual Thaksa must expose all 8 walking roles');
    for (const r of afterBE.roles) {
      assert.ok(r.role && r.annualRole && typeof r.groupIdx === 'number' && r.dayName && r.planet && r.elem);
    }

    // Verify clockwise THAKSA_RING progression for Tuesday birth (1996-06-25 -> dow=2, ringIdx=2)
    const tueRingIdx = THAKSA_RING.indexOf(2);
    const annualStartRingIdx = (tueRingIdx + (31 - 1)) % 8;
    assert.equal(afterBE.fallingHouse.groupIdx, THAKSA_RING[annualStartRingIdx]);
    assert.equal(beforeBE.fallingHouse.groupIdx, THAKSA_RING[(tueRingIdx + (30 - 1)) % 8]);
    assert.equal(afterBE.dejJon.groupIdx, THAKSA_RING[(annualStartRingIdx + 2) % 8], 'dejJon must sit +2 clockwise on THAKSA_RING');
    assert.equal(afterBE.siJon.groupIdx, THAKSA_RING[(annualStartRingIdx + 3) % 8], 'siJon must sit +3 clockwise on THAKSA_RING');
    assert.equal(afterBE.kalakiniJon.groupIdx, THAKSA_RING[(annualStartRingIdx + 7) % 8], 'kalakiniJon must sit +7 clockwise on THAKSA_RING');
    assert.notEqual(afterBE.siJon.groupIdx, afterBE.kalakiniJon.groupIdx, 'siJon and kalakiniJon must never collide');
    assert.equal(afterBE.roles[2].groupIdx, afterBE.dejJon.groupIdx);
    assert.equal(afterBE.roles[3].groupIdx, afterBE.siJon.groupIdx);
    assert.equal(afterBE.roles[7].groupIdx, afterBE.kalakiniJon.groupIdx);

    // 2. Feb 29 leap-year edge (2000-02-29)
    const leapUser = createFullTestUser({ day: 29, month: 2, year: 2000, birthdate: '2000-02-29' });
    const feb28NonLeap = satiBrain.computeAnnualThaksa(leapUser, new Date('2026-02-28T12:00:00Z'));
    const mar01NonLeap = satiBrain.computeAnnualThaksa(leapUser, new Date('2026-03-01T12:00:00Z'));
    const feb29Leap = satiBrain.computeAnnualThaksa(leapUser, new Date('2024-02-29T12:00:00Z'));

    assert.equal(feb28NonLeap.ageCompleted, 25);
    assert.equal(feb28NonLeap.ageYung, 26);
    assert.equal(mar01NonLeap.ageCompleted, 26);
    assert.equal(mar01NonLeap.ageYung, 27);
    assert.equal(feb29Leap.ageCompleted, 24);
    assert.equal(feb29Leap.ageYung, 25);

    // 3. Wednesday-night Rahu handling (1996-06-26 is Wednesday; birthTime '21:00' -> Rahu groupIdx 7)
    const wedDayUser = createFullTestUser({ day: 26, month: 6, year: 1996, birthdate: '1996-06-26', birthTime: '10:00' });
    const wedNightUser = createFullTestUser({ day: 26, month: 6, year: 1996, birthdate: '1996-06-26', birthTime: '21:00' });
    const wedDayThaksa = satiBrain.computeAnnualThaksa(wedDayUser, refAfterBday);
    const wedNightThaksa = satiBrain.computeAnnualThaksa(wedNightUser, refAfterBday);

    assert.equal(wedDayThaksa.fallingHouse.groupIdx, THAKSA_RING[(THAKSA_RING.indexOf(3) + (wedDayThaksa.ageYung - 1)) % 8]);
    assert.equal(wedNightThaksa.fallingHouse.groupIdx, THAKSA_RING[(THAKSA_RING.indexOf(7) + (wedNightThaksa.ageYung - 1)) % 8]);
    assert.notEqual(wedNightThaksa.fallingHouse.groupIdx, wedDayThaksa.fallingHouse.groupIdx);

    // 4. computeNatalProfile(user, referenceDate) attaches user.annualThaksa
    const profiled = satiBrain.computeNatalProfile(createFullTestUser({ year: 2539 }), refAfterBday);
    assert.ok(profiled.annualThaksa, 'computeNatalProfile must attach annualThaksa');
    assert.equal(profiled.annualThaksa.ageYung, 31);
    assert.equal(profiled.annualThaksa.fallingHouse.groupIdx, afterBE.fallingHouse.groupIdx);

    // 5. buildSatiPromptBundle injects annual Thaksa roles & real-time current date (with and without precomputed annualThaksa)
    const bundleWithPrecomputed = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: profiled,
      now: '2026-11-23T10:00:00Z',
      question: 'ช่วงปลายปีนี้การงานจะเป็นยังไงบ้าง',
      cards: [deck[0]]
    });
    assert.match(bundleWithPrecomputed.userContext, /23/, 'Prompt userContext must include real-time current day (23)');
    assert.match(bundleWithPrecomputed.userContext, /(2026|2569)/, 'Prompt userContext must include real-time current year (2026/2569)');
    assert.match(bundleWithPrecomputed.userContext, /(11|พฤศจิกายน|November|พ\.ย\.)/, 'Prompt userContext must include real-time current month');
    assert.ok(bundleWithPrecomputed.userContext.includes('ศรีจร'), 'Prompt userContext must include annual Thaksa role ศรีจร');
    assert.ok(bundleWithPrecomputed.userContext.includes('เดชจร'), 'Prompt userContext must include annual Thaksa role เดชจร');
    assert.ok(bundleWithPrecomputed.userContext.includes('กาลกิณีจร'), 'Prompt userContext must include annual Thaksa role กาลกิณีจร');

    const siIdx = bundleWithPrecomputed.userContext.indexOf('ศรีจร');
    const siClause = bundleWithPrecomputed.userContext
      .slice(siIdx)
      .split(/(?:\r?\n|\||;|(?=(?:บริวาร|อายุ|เดช|มูละ|อุตสาหะ|มนตรี|กาลกิณี)จร))/)[0];
    assert.match(
      siClause,
      new RegExp(PLANET_LABEL_PATTERN[afterBE.siJon.planet], 'i'),
      `userContext ศรีจร clause must pair with siJon planet (${afterBE.siJon.planet}), got: ${siClause}`
    );
    assert.doesNotMatch(
      siClause,
      new RegExp(PLANET_LABEL_PATTERN[afterBE.kalakiniJon.planet], 'i'),
      `userContext ศรีจร clause must NOT pair with kalakiniJon planet (${afterBE.kalakiniJon.planet}), got: ${siClause}`
    );

    const bundleNonToday = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: { fullname: 'ธนภัทร พิมพ์มากร', nickname: 'บอม', day: 25, month: 6, year: 2539 },
      now: '2025-03-15T10:00:00Z',
      question: 'เช็กจังหวะช่วงนี้',
      cards: [deck[2]]
    });
    assert.match(bundleNonToday.userContext, /(?:^|\D)15(?:\D|$)/, 'Prompt userContext must respect non-today body.now day (15)');
    assert.match(bundleNonToday.userContext, /(2025|2568)/, 'Prompt userContext must respect non-today body.now year (2025/2568)');
    assert.match(bundleNonToday.userContext, /(03|มีนาคม|March|มี\.ค\.|(?<!\d)3(?!\d))/, 'Prompt userContext must respect non-today body.now month');
    assert.ok(bundleNonToday.userContext.includes('ศรีจร') && bundleNonToday.userContext.includes('กาลกิณีจร'));

    const bundleOmittedAnnual = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: { fullname: 'ธนภัทร พิมพ์มากร', nickname: 'บอม', day: 25, month: 6, year: 2539 },
      now: '2026-11-23T10:00:00Z',
      question: 'เช็กจังหวะเดือนนี้',
      cards: [deck[1]]
    });
    assert.match(bundleOmittedAnnual.userContext, /23/);
    assert.match(bundleOmittedAnnual.userContext, /(2026|2569)/);
    assert.ok(bundleOmittedAnnual.userContext.includes('ศรีจร') && bundleOmittedAnnual.userContext.includes('กาลกิณีจร'), 'Server must resolve annual Thaksa from userProfile.day/month/year when omitted by client');
  });

  it('SC-09-02: R2 exposes 78-card Golden Dawn mappings, Court personalities, localized card attributions, querent astro intersection, and preserves SC-06-01 & SC-07-02', () => {
    assert.equal(typeof satiBrain.computeAstroCardIntersection, 'function', 'computeAstroCardIntersection must be exported from satiBrain.js');

    assert.equal(deck.length, 78);
    const hydratedAll = tarot78.hydrateDeckCards(deck.map((c, idx) => ({ uid: c.uid, reversed: idx % 7 === 0 })));
    assert.equal(hydratedAll.length, 78);

    const categoryCounts = { major: 0, ace: 0, pip: 0, court: 0 };
    const majorMotherUids = new Set(['M_0', 'M_12', 'M_20']);
    for (const [label, cardsList] of [['buildFullDeck78', deck], ['hydrateDeckCards', hydratedAll]]) {
      let majorAstroCount = 0;
      for (const c of cardsList) {
        assert.ok(c.gd && typeof c.gd === 'object', `${label} card ${c.uid} must expose gd metadata`);
        assert.ok(['major', 'ace', 'pip', 'court'].includes(c.gd.category), `${label} card ${c.uid} invalid gd.category: ${c.gd.category}`);
        assert.ok(['fire', 'water', 'air', 'earth'].includes(c.gd.gdElement), `${label} card ${c.uid} invalid gd.gdElement: ${c.gd.gdElement}`);
        if (label === 'buildFullDeck78') categoryCounts[c.gd.category] += 1;
        if (c.gd.category === 'major') {
          if (c.gd.planet || c.gd.zodiac) majorAstroCount += 1;
          if (!majorMotherUids.has(c.uid)) {
            assert.ok(Boolean(c.gd.planet || c.gd.zodiac), `Major card ${c.uid} must expose gd.planet or gd.zodiac`);
          }
        }
        if (c.gd.category === 'court') {
          assert.ok(c.gd.subElement && String(c.gd.subElement).length > 3, `Court card ${c.uid} must expose gd.subElement`);
          assert.ok(c.gd.courtPersonality, `Court card ${c.uid} must expose gd.courtPersonality`);
        }
        if (c.gd.category === 'pip') {
          assert.ok(c.gd.planet && c.gd.zodiac && [1, 2, 3].includes(c.gd.decan), `Pip card ${c.uid} must expose planet/zodiac/decan`);
        }
      }
      assert.ok(majorAstroCount >= 19, `${label} must expose planetary/zodiacal GD mappings on >= 19 Major Arcana (got ${majorAstroCount})`);
    }
    assert.deepEqual(categoryCounts, { major: 22, ace: 4, pip: 36, court: 16 });

    // Spot-checks required by R2 specification
    const tower = hydratedAll.find((c) => c.uid === 'M_16');
    const hermit = hydratedAll.find((c) => c.uid === 'M_9');
    const threeWands = hydratedAll.find((c) => c.uid === 'Wands_Three');
    const knightWands = hydratedAll.find((c) => c.uid === 'Wands_Knight');
    const chariot = hydratedAll.find((c) => c.uid === 'M_7');

    assert.equal(tower.gd.planet, 'mars');
    assert.equal(hermit.gd.zodiac, 'virgo');
    assert.equal(threeWands.gd.planet, 'sun');
    assert.equal(threeWands.gd.zodiac, 'aries');
    assert.equal(threeWands.gd.decan, 2);

    for (const lang of ['th', 'en', 'zh']) {
      const towerLoc = tarot78I18n.getLocalizedCardData(tower, lang);
      const threeWandsLoc = tarot78I18n.getLocalizedCardData(threeWands, lang);
      const knightLoc = tarot78I18n.getLocalizedCardData(knightWands, lang);
      assert.ok(typeof towerLoc.gdAttribution === 'string' && towerLoc.gdAttribution.length > 0, `getLocalizedCardData(${lang}) must expose gdAttribution for Tower`);
      assert.ok(typeof threeWandsLoc.gdAttribution === 'string' && threeWandsLoc.gdAttribution.length > 0, `getLocalizedCardData(${lang}) must expose gdAttribution for 3 of Wands`);
      assert.ok(typeof knightLoc.courtPersonality === 'string' && knightLoc.courtPersonality.trim().length > 0, `getLocalizedCardData(${lang}) must expose non-empty string courtPersonality for Court card`);
    }

    // Querent born 1996-06-25: Cancer (Chariot = Cancer), Tuesday (Mars = Tower)
    const user = satiBrain.computeNatalProfile(createFullTestUser(), new Date('2026-11-23T12:00:00Z'));
    // Comparison querent born 1996-01-05: Capricorn, Friday (Venus) - neither Cancer nor Mars
    const otherUser = satiBrain.computeNatalProfile(
      createFullTestUser({ day: 5, month: 1, year: 1996, birthdate: '1996-01-05', birthTime: '10:30' }),
      new Date('2026-11-23T12:00:00Z')
    );
    const sampleSpread = [{ ...tower, reversed: true }, chariot, knightWands];

    for (const lang of ['th', 'en', 'zh']) {
      const intersection = satiBrain.computeAstroCardIntersection(user, sampleSpread, lang);
      const otherIntersection = satiBrain.computeAstroCardIntersection(otherUser, sampleSpread, lang);
      const text = typeof intersection === 'string' ? intersection : JSON.stringify(intersection || '');
      const otherText = typeof otherIntersection === 'string' ? otherIntersection : JSON.stringify(otherIntersection || '');
      assert.ok(intersection && text.length > 15, `computeAstroCardIntersection(${lang}) must produce non-empty intersection insight`);
      assert.notEqual(text, otherText, `computeAstroCardIntersection(${lang}) must vary with querent zodiac/planet`);
      assert.match(text, /(cancer|กรกฎ|巨蟹|mars|อังคาร|火星)/i, `computeAstroCardIntersection(${lang}) must reference matching Cancer/Mars intersection`);
    }

    // Preserve SC-06-01 exact substrings in computeElementalDignityInsight
    const fireAirCards = ['Ace of Wands', 'Knight of Swords', 'The Sun'].map((n) => deck.find((c) => c.name === n));
    assert.ok(satiBrain.computeElementalDignityInsight(fireAirCards, 'th').includes('ไฟ+ลม'));
    assert.ok(satiBrain.computeElementalDignityInsight(fireAirCards, 'en').includes('Fire + Air'));
    assert.ok(satiBrain.computeElementalDignityInsight(fireAirCards, 'zh').includes('火风相生'));

    // Prompt bundle injects GD attributions per card line (keeping [กลับหัว / Reversed] for SC-07-02) & astro intersection in userContext
    const bundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      question: 'ทิศทางงานช่วงนี้',
      cards: sampleSpread
    });
    assert.ok(bundle.formattedSpread.includes('[กลับหัว / Reversed]'), 'SC-07-02 reversed tag must be preserved');
    const spreadLines = bundle.formattedSpread.split(/\r?\n/).filter((l) => l.trim().length > 0);
    assert.equal(spreadLines.length, 3, 'formattedSpread must emit one line per card in 3-card spread');
    assert.ok(spreadLines[0].includes('[กลับหัว / Reversed]'), 'Card 1 line must preserve [กลับหัว / Reversed]');
    assert.match(spreadLines[0], /(mars|อังคาร)/i, 'Card 1 (Tower) line must include Mars GD attribution');
    assert.match(spreadLines[1], /(cancer|กรกฎ)/i, 'Card 2 (Chariot) line must include Cancer GD attribution');
    assert.match(
      spreadLines[2],
      /(fire\s+of\s+fire|air\s+of\s+fire|of\s+fire|sagittarius|ธนู|aries|เมษ|leo|สิงห์|ลมในไฟ|ไฟในไฟ|golden dawn|\bGD\b|(?<![a-z])fire(?![a-z])|(?<![a-z])air(?![a-z])|ลม)/i,
      'Card 3 (Knight of Wands) line must include Court GD attribution'
    );

    const nonSpreadContext = bundle.userContext.replace(bundle.formattedSpread, '');
    assert.match(
      nonSpreadContext,
      /(The Tower|The Chariot|หอคอย|ราชรถ|จุดตัด|สอดคล้อง|เชื่อมโยง|ประสาน|intersection|astro|mars)/i,
      'Prompt userContext must include astrological intersection insight'
    );
    const nonMatchSpread = ['Wands_Three', 'Pentacles_Eight', 'Swords_Five'].map((uid) => hydratedAll.find((c) => c.uid === uid));
    const nonMatchBundle = geminiProxy.buildSatiPromptBundle({
      lang: 'th',
      userProfile: user,
      now: '2026-11-23T10:00:00Z',
      question: 'ทิศทางงานช่วงนี้',
      cards: nonMatchSpread
    });
    assert.notEqual(
      nonSpreadContext,
      nonMatchBundle.userContext.replace(nonMatchBundle.formattedSpread, ''),
      'Prompt userContext astro intersection must reflect the actual drawn cards'
    );
  });

  it('SC-09-03: R3 delivers zero-emoji localized calibration UI, main.js wiring, storage round-trip, and subsequent-turn adaptation', async () => {
    // 1. Structural check on index.html #dialogue-box calibration controls & i18n keys
    const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
    const dlgStart = indexHtml.indexOf('id="dialogue-box"');
    const dlgEnd = indexHtml.indexOf('id="screen-login"');
    assert.ok(dlgStart !== -1 && dlgEnd > dlgStart, 'Expected #dialogue-box region in index.html');
    const dialogueBoxHtml = indexHtml.slice(dlgStart, dlgEnd);

    const requiredCalibIds = [
      'btn-calib-accurate',
      'btn-calib-inaccurate',
      'calib-reason-wrap',
      'calib-reason-input',
      'btn-calib-submit',
      'btn-calib-cancel'
    ];
    for (const id of requiredCalibIds) {
      assert.ok(dialogueBoxHtml.includes(`id="${id}"`), `Expected #${id} inside #dialogue-box in index.html`);
    }
    assert.match(dialogueBoxHtml, /<button[^>]*id="btn-calib-accurate"/);
    assert.match(dialogueBoxHtml, /<button[^>]*id="btn-calib-inaccurate"/);
    assert.match(dialogueBoxHtml, /<button[^>]*id="btn-calib-submit"/);
    assert.match(dialogueBoxHtml, /<button[^>]*id="btn-calib-cancel"/);
    assert.match(dialogueBoxHtml, /<(?:input|textarea)[^>]*id="calib-reason-input"/);

    // Extract data-i18n and data-i18n-placeholder keys on calibration controls (directly on tag or nested child elements like <span>)
    const calibKeySet = new Set();
    for (const btnMatch of dialogueBoxHtml.matchAll(/<button\b[^>]*id="btn-calib-(?:accurate|inaccurate|submit|cancel)"[^>]*>[\s\S]*?<\/button>/g)) {
      for (const keyMatch of btnMatch[0].matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)) {
        calibKeySet.add(keyMatch[1]);
      }
    }
    for (const inputMatch of dialogueBoxHtml.matchAll(/<(?:input|textarea)\b[^>]*id="calib-reason-input"[^>]*>/g)) {
      for (const keyMatch of inputMatch[0].matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)) {
        calibKeySet.add(keyMatch[1]);
      }
    }
    const calibKeys = [...calibKeySet];
    assert.ok(calibKeys.length >= 4, `Expected localized data-i18n keys on calibration controls, found ${calibKeys.length}`);
    for (const lang of ['th', 'en', 'zh']) {
      for (const key of calibKeys) {
        const label = translations.t(lang, key);
        assert.ok(typeof label === 'string' && label.trim().length > 0, `Missing translation for ${lang}.${key}`);
        assert.equal(EMOJI_RE.test(label), false, `Calibration translation ${lang}.${key} must not contain emojis: ${label}`);
      }
    }

    // 2. Wiring check on src/main.js
    const mainJs = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
    assert.ok(mainJs.includes('calibrationFeedback'), 'src/main.js must maintain state.calibrationFeedback');
    for (const calibId of ['btn-calib-accurate', 'btn-calib-inaccurate', 'btn-calib-submit', 'btn-calib-cancel', 'calib-reason-input']) {
      assert.ok(mainJs.includes(calibId), `src/main.js must wire #${calibId}`);
    }
    assert.ok(mainJs.includes('renderChatEntriesIntoList'), 'src/main.js must have renderChatEntriesIntoList');
    const renderIdx = mainJs.indexOf('function renderChatEntriesIntoList');
    const renderEndIdx = mainJs.indexOf('function renderArchivesView', renderIdx);
    const renderSection = renderEndIdx > renderIdx
      ? mainJs.slice(renderIdx, renderEndIdx)
      : mainJs.slice(renderIdx, renderIdx + 12000);
    assert.match(renderSection, /calib/i, 'renderChatEntriesIntoList must display or attach calibration state/controls');
    assert.ok(mainJs.includes('saveAccountState'), 'src/main.js must persist calibration via saveAccountState');

    // 3. Storage round-trip (offline fetch mock + localStorage)
    const sampleCalib = [
      {
        id: 'cal_sc09_1',
        createdAt: '2026-11-23T04:00:00.000Z',
        verdict: 'inaccurate',
        note: 'เพิ่งย้ายไปสาย Product ไม่ใช่สายบัญชีแล้ว',
        question: 'งานช่วงนี้เป็นยังไง',
        topic: 'work',
        cardsSummary: 'The Fool'
      }
    ];
    const user = satiBrain.computeNatalProfile(createFullTestUser(), new Date('2026-11-23T12:00:00Z'));
    const stStorage = createMockState({
      user,
      sessionActive: true,
      remainingDeck: deck.slice(3),
      calibrationFeedback: sampleCalib
    });

    const defaultPayload = storage.buildStoragePayload({ user: {} });
    assert.deepEqual(defaultPayload.calibrationFeedback, [], 'buildStoragePayload must default calibrationFeedback to []');
    const payload = storage.buildStoragePayload(stStorage);
    assert.deepEqual(payload.calibrationFeedback, sampleCalib);

    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        throw new Error('offline');
      };
      await storage.saveAccountState(stStorage);
      const loaded = await storage.loadAccountState(user.email);
      assert.ok(loaded, 'Expected localStorage fallback record from loadAccountState');
      assert.deepEqual(loaded.calibrationFeedback, sampleCalib);

      await storage.clearAccountState(user.email);
      const afterClear = await storage.loadAccountState(user.email);
      assert.equal(afterClear, null);

      // 4. requestSatiReading -> buildSatiPromptBundle -> offline synthesizeDeepReply adaptation
      let capturedBody = null;
      globalThis.fetch = async (url, init) => {
        if (String(url).includes('/api/sati/read')) {
          capturedBody = JSON.parse(init.body);
          return new Response(
            JSON.stringify({ ok: true, fallback: false, model: 'gemini-4-hydrogen', reply: 'ปรับคำทำนายตามบริบท Product แล้ว' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`Unexpected URL: ${url}`);
      };

      const calibEntries = [
        {
          id: 'cal_ok',
          createdAt: '2026-11-23T03:50:00.000Z',
          verdict: 'accurate',
          note: 'ตรงเรื่องแรงกดดันจากกำหนดส่งงาน',
          question: 'งานตอนนี้เป็นยังไง',
          topic: 'work',
          cardsSummary: 'Ten of Wands'
        },
        ...sampleCalib
      ];
      const stCalib = createMockState({
        lang: 'th',
        user,
        natalCards: deck.slice(0, 10),
        remainingDeck: deck.slice(10),
        calibrationFeedback: calibEntries
      });

      const followUpQ = 'เดือนหน้าควรโฟกัสอะไรในงานที่ทำอยู่';
      const spread3 = [deck[10], deck[11], deck[12]];
      const onlineReply = await satiBrain.requestSatiReading(stCalib, followUpQ, spread3, false);
      assert.equal(onlineReply, 'ปรับคำทำนายตามบริบท Product แล้ว');
      assert.ok(Array.isArray(capturedBody?.calibrationFeedback) && capturedBody.calibrationFeedback.length === 2, 'requestSatiReading must forward calibrationFeedback');
      assert.ok(capturedBody.calibrationFeedback.some((c) => c.note.includes('Product')));

      const promptBundle = geminiProxy.buildSatiPromptBundle(capturedBody);
      assert.ok(promptBundle.userContext.includes('เพิ่งย้ายไปสาย Product ไม่ใช่สายบัญชีแล้ว'), 'buildSatiPromptBundle must inject inaccurate correction note into userContext');
      assert.ok(promptBundle.userContext.includes('ตรงเรื่องแรงกดดันจากกำหนดส่งงาน'), 'buildSatiPromptBundle must inject accurate anchor into userContext');

      const stNoCalib = createMockState({
        lang: 'th',
        user,
        natalCards: deck.slice(0, 10),
        remainingDeck: deck.slice(10),
        calibrationFeedback: []
      });
      const offlineNoCalib = satiBrain.synthesizeDeepReply(stNoCalib, followUpQ, spread3);
      const offlineWithCalib = satiBrain.synthesizeDeepReply(stCalib, followUpQ, spread3);
      assert.ok(offlineWithCalib.length > 30 && offlineWithCalib.length < 550, `Offline calibrated reply must be < 550 chars, got ${offlineWithCalib.length}`);
      assert.equal(EMOJI_RE.test(offlineWithCalib), false);
      assert.notEqual(offlineWithCalib, offlineNoCalib, 'Offline synthesizeDeepReply must adapt when calibrationFeedback is present');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SC-09-04: R4 retains multi-clause early facts (>76 chars) across 10+ turns, expands recentHistory > 6, preserves SC-06-05 role update & SC-06-04 reset isolation', async () => {
    const user = satiBrain.computeNatalProfile(createFullTestUser(), new Date('2026-11-23T12:00:00Z'));

    // 1. Rich fact extraction on >76-char multi-clause inputs + SC-06-05 role replacement
    const initialStudentFacts = satiBrain.extractUserContextFacts([
      { role: 'user', text: 'ตอนนี้ผมยังเรียนอยู่ปี 4 และกำลังเตรียมสอบปลายภาค' }
    ]);
    assert.ok(initialStudentFacts.some((f) => f.includes('กำลังเรียน/เตรียมสอบ')));

    const earlyClause1 = 'ตอนนี้ย้ายมาเป็นพนักงานประจำสาย Product Manager กับหัวหน้าชื่อพี่เอก และวางแผนย้ายคอนโดภายในเดือนมีนาคมด้วยงบ 120000 บาท';
    const earlyClause2 = 'นอกจากนี้ยังมีภาระผ่อนรถเดือนละ 15000 บาท และต้องดูแลแม่วันเสาร์อาทิตย์เลยไม่สะดวกทำงานเสริม';
    assert.ok(earlyClause1.length > 76 && earlyClause2.length > 76);

    const longHistory = [
      { role: 'user', speaker: user.nickname, text: earlyClause1 },
      { role: 'sati', speaker: 'สติ', text: 'รับทราบเรื่องบทบาท Product Manager และแผนงบ 120000 บาทช่วงมีนาคมแล้วนะ', meta: { cards: [deck[0]] } },
      { role: 'user', speaker: user.nickname, text: earlyClause2 },
      { role: 'sati', speaker: 'สติ', text: 'เข้าใจข้อจำกัดเรื่องผ่อนรถ 15000 และการดูแลแม่วันหยุดเลย', meta: { cards: [deck[1]] } }
    ];
    for (let i = 3; i <= 10; i += 1) {
      const userText = i === 5
        ? 'คำถามทั่วไปรอบที่ 5: วันนี้กำลังตรวจเอกสารโครงการแสงเหนืออยู่ มีความคืบหน้าเล็กน้อย'
        : `คำถามทั่วไปรอบที่ ${i}: วันนี้อากาศและอารมณ์การทำงานเป็นยังไงบ้าง`;
      longHistory.push({ role: 'user', speaker: user.nickname, text: userText });
      longHistory.push({ role: 'sati', speaker: 'สติ', text: `คำตอบรอบที่ ${i}: รักษาจังหวะพักผ่อนและโฟกัสทีละเรื่อง`, meta: { cards: [deck[i]] } });
    }

    const richFacts = satiBrain.extractUserContextFacts(longHistory, initialStudentFacts);
    assert.ok(richFacts.some((f) => f.includes('ทำงานประจำ/องค์กร')), 'SC-06-05 role update must promote to ทำงานประจำ/องค์กร');
    assert.ok(!richFacts.some((f) => f.includes('กำลังเรียน/เตรียมสอบ')), 'SC-06-05 old student role must be replaced');

    const joinedFacts = richFacts.join(' | ');
    assert.match(joinedFacts, /(120000|15000)/, 'Rich fact extraction must retain financial figures from >76-char turns');
    assert.match(joinedFacts, /มีนาคม/, 'Rich fact extraction must retain timeline/month from >76-char turns');
    assert.match(joinedFacts, /(Product Manager|พี่เอก)/i, 'Rich fact extraction must retain role or person entity from >76-char turns');
    assert.match(joinedFacts, /(แม่|เสาร์อาทิตย์)/, 'Rich fact extraction must retain caregiving/schedule constraints from >76-char turns');

    // 2. requestSatiReading sends > 6 recentHistory turns AND earlierContextDigest -> surfaced in buildSatiPromptBundle
    const origFetch = globalThis.fetch;
    let capturedBody = null;
    try {
      globalThis.fetch = async (url, init) => {
        if (String(url).includes('/api/sati/read')) {
          capturedBody = JSON.parse(init.body);
          return new Response(
            JSON.stringify({ ok: true, fallback: false, model: 'gemini-4-hydrogen', reply: 'ตอบโดยเชื่อมโยงแผนย้ายคอนโดเดือนมีนาคมและงบ 120000 บาทเรียบร้อย' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`Unexpected URL: ${url}`);
      };

      const st = createMockState({
        lang: 'th',
        user,
        natalCards: deck.slice(0, 10),
        remainingDeck: deck.slice(20),
        chatHistory: [...longHistory],
        userContextFacts: initialStudentFacts
      });

      const reply = await satiBrain.requestSatiReading(st, 'ช่วงนี้ควรจัดลำดับการเงินกับงานยังไงดี', [deck[15], deck[16], deck[17]], false);
      assert.ok(reply.length > 0);
      assert.ok(Array.isArray(capturedBody?.recentHistory) && capturedBody.recentHistory.length > 6, `Expected recentHistory.length > 6, got ${capturedBody?.recentHistory?.length}`);

      const bundle = geminiProxy.buildSatiPromptBundle(capturedBody);
      assert.match(bundle.userContext, /(120000|มีนาคม|Product Manager|15000)/, 'Prompt userContext must surface early Turn 1-2 complex facts after 10+ turns');
      assert.ok(bundle.userContext.includes('โครงการแสงเหนือ'), 'Prompt userContext must retain mid-window Turn 5 token inside 14-turn window');
      assert.ok(
        (capturedBody.earlierContextDigest && capturedBody.earlierContextDigest.length > 0) ||
        capturedBody.recentHistory.length >= 14,
        'requestSatiReading must preserve pre-window turns via earlierContextDigest and/or expanded recentHistory window'
      );

      // Explicitly verify buildCompressedHistoryDigest does not drop >6 turns AND buildSatiPromptBundle renders earlierContextDigest
      const windowAndDigestBundle = geminiProxy.buildSatiPromptBundle({
        ...capturedBody,
        userFacts: [],
        earlierContextDigest: 'สรุปก่อนหน้า: เคยปรึกษาเรื่องตรวจสุขภาพคุณตาช่วงต้นเดือน'
      });
      assert.ok(
        windowAndDigestBundle.userContext.includes('โครงการแสงเหนือ'),
        'buildCompressedHistoryDigest must retain Turn 5 (>6 turns back) within recentHistory rather than truncating via .slice(-6)'
      );
      assert.ok(
        windowAndDigestBundle.userContext.includes('ตรวจสุขภาพคุณตา'),
        'buildSatiPromptBundle must render earlierContextDigest in userContext'
      );

      // 3. Deck reset preserves SC-06-04 no-false-repeat isolation while keeping earlier facts/digest
      st.deckResetAtIndex = st.chatHistory.length;
      st.deckNumber = 2;
      st.deckCarryoverSummary = 'สำรับ 1: โฟกัสงาน Product Manager และงบ 120000 บาท';
      st.lastTopic = 'general';

      await satiBrain.requestSatiReading(st, 'ในสำรับใหม่นี้ โอกาสเรื่องงานเดือนมีนาคมจะเริ่มจากทางไหน', [deck[20], deck[21], deck[22]], false);
      assert.equal(capturedBody.recentHistory.length, 0, 'SC-06-04: scoped recentHistory after deck reset must start empty');

      globalThis.fetch = async () => {
        throw new Error('offline');
      };
      const offlinePostReset = await satiBrain.requestSatiReading(st, 'ในสำรับใหม่นี้ โอกาสเรื่องงานเดือนมีนาคมจะเริ่มจากทางไหน', [deck[20], deck[21], deck[22]], false);
      assert.ok(!offlinePostReset.includes('ถามวนเรื่องเดิมซ้ำ'), 'SC-06-04: deck reset must not trigger false repeat scolding');
      assert.ok(offlinePostReset.length < 550);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SC-09-05: R5 Smart Thinking Routing routes 1-3 card quick queries to low, 10-card/major decisions/corrections to medium, preserves SC-06-08, and exposes SSE meta thinkingLevel', async () => {
    assert.equal(typeof geminiProxy.resolveThinkingConfigForRequest, 'function', 'resolveThinkingConfigForRequest must be exported from geminiProxyServer.js');

    // 1. Unit checks for resolveThinkingConfigForRequest
    const quickRoute = geminiProxy.resolveThinkingConfigForRequest({
      isNatal10: false,
      cards: [deck[0], deck[1], deck[2]],
      question: 'วันนี้พลังโดยรวมเป็นยังไงบ้าง',
      questionProfile: { topic: 'general', intent: 'explain' }
    }, 'gemini-4-hydrogen');
    assert.equal(quickRoute.thinkingLevel, 'low');

    const natal10Route = geminiProxy.resolveThinkingConfigForRequest({
      isNatal10: true,
      cards: deck.slice(0, 10),
      question: 'เปิดไพ่พื้นดวง 10 ใบแรก'
    }, 'gemini-4-hydrogen');
    assert.equal(natal10Route.thinkingLevel, 'medium');
    assert.ok(natal10Route.maxOutputTokens >= 4096, `Expected scaled maxOutputTokens >= 4096 for medium, got ${natal10Route.maxOutputTokens}`);

    const cards10NonNatalRoute = geminiProxy.resolveThinkingConfigForRequest({
      isNatal10: false,
      cards: deck.slice(0, 10),
      question: 'เปิดไพ่ 10 ใบ'
    }, 'gemini-4-hydrogen');
    assert.equal(cards10NonNatalRoute.thinkingLevel, 'medium', '10-card spreads must route to medium even when isNatal10 is false');

    const decisionRoute = geminiProxy.resolveThinkingConfigForRequest({
      isNatal10: false,
      cards: [deck[2], deck[3], deck[4]],
      question: 'ควรลาออกจากงานประจำตอนนี้เลย หรืออยู่รอโบนัสปลายปีแล้วค่อยย้ายสายดี',
      questionProfile: { topic: 'work', intent: 'decision' }
    }, 'gemini-4-hydrogen');
    assert.equal(decisionRoute.thinkingLevel, 'medium');
    assert.ok(decisionRoute.maxOutputTokens >= 4096);

    const calibCorrectionRoute = geminiProxy.resolveThinkingConfigForRequest({
      isNatal10: false,
      cards: [deck[5]],
      question: 'ช่วยดูใหม่อีกครั้ง',
      calibrationFeedback: [{ verdict: 'inaccurate', note: 'ไม่ได้ทำบัญชีแล้ว ตอนนี้ทำสาย Product' }]
    }, 'gemini-4-hydrogen');
    assert.equal(calibCorrectionRoute.thinkingLevel, 'medium');

    // 2. Preserve SC-06-08 1-arg defaults and flash-lite omission
    const h4Default = geminiProxy.buildModelGenerateConfig('gemini-4-hydrogen');
    assert.equal(h4Default.maxOutputTokens, 2600);
    assert.deepEqual(h4Default.thinkingConfig, { thinkingLevel: 'low' });
    assert.equal(h4Default.temperature, undefined);

    const h4Medium = geminiProxy.buildModelGenerateConfig('gemini-4-hydrogen', undefined, { thinkingLevel: 'medium' });
    assert.deepEqual(h4Medium.thinkingConfig, { thinkingLevel: 'medium' });
    assert.ok(h4Medium.maxOutputTokens >= 4096);
    assert.equal(h4Medium.temperature, undefined);

    const flash36Medium = geminiProxy.buildModelGenerateConfig('gemini-3.6-flash', undefined, { thinkingLevel: 'medium' });
    assert.equal(flash36Medium.thinkingConfig?.thinkingBudget, 1024, 'gemini-3.6-flash medium tier must scale thinkingBudget to 1024');
    assert.ok(flash36Medium.maxOutputTokens >= 3200, `gemini-3.6-flash medium tier must scale maxOutputTokens >= 3200, got ${flash36Medium.maxOutputTokens}`);

    const flash25Medium = geminiProxy.buildModelGenerateConfig('gemini-2.5-flash', undefined, { thinkingLevel: 'medium' });
    assert.equal(flash25Medium.thinkingConfig?.thinkingBudget, 1024, 'gemini-2.5-flash medium tier must scale thinkingBudget to 1024');
    assert.ok(flash25Medium.maxOutputTokens >= 3200, `gemini-2.5-flash medium tier must scale maxOutputTokens >= 3200, got ${flash25Medium.maxOutputTokens}`);

    const flashLiteMedium = geminiProxy.buildModelGenerateConfig('gemini-3.5-flash-lite', undefined, { thinkingLevel: 'medium' });
    assert.equal(flashLiteMedium.thinkingConfig, undefined, 'SC-06-08: gemini-3.5-flash-lite must still omit thinkingConfig even with routing options');

    // 3. Ephemeral Express SSE & JSON routing verification
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key-sc09';
    const recordedCalls = [];

    try {
      await withTestServer({
        createAiClient: () => ({
          models: {
            async generateContentStream({ model, contents, config }) {
              recordedCalls.push({ kind: 'stream', model, contents, config });
              async function* gen() {
                yield { text: 'สติมองเห็นจังหวะชัดเจน ' };
                yield { text: 'ลองก้าวอย่างมั่นคงได้เลย' };
              }
              return gen();
            },
            async generateContent({ model, contents, config }) {
              recordedCalls.push({ kind: 'json', model, contents, config });
              return { text: 'คำแนะนำเชิงลึกสำหรับทางเลือกสำคัญของคุณ' };
            }
          }
        })
      }, async (baseUrl) => {
        // 3a. 3-card quick query -> SSE meta thinkingLevel: 'low'
        const quickRes = await fetch(`${baseUrl}/api/sati/read/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lang: 'th',
            question: 'วันนี้เป็นยังไงบ้าง',
            isNatal10: false,
            cards: [deck[0], deck[1], deck[2]],
            questionProfile: { topic: 'general', intent: 'explain' }
          })
        });
        assert.equal(quickRes.status, 200);
        const quickFrames = parseSseFrames(await quickRes.text());
        assert.equal(quickFrames[0]?.event, 'meta');
        assert.equal(quickFrames[0]?.data?.model, 'gemini-4-hydrogen');
        assert.equal(quickFrames[0]?.data?.thinkingLevel, 'low');
        assert.ok(quickFrames.some((f) => f.event === 'chunk'));
        assert.ok(quickFrames.some((f) => f.event === 'done' && f.data?.ok === true));
        assert.equal(recordedCalls[0]?.config?.thinkingConfig?.thinkingLevel, 'low');

        // 3b. 10-card natal spread -> SSE meta thinkingLevel: 'medium'
        const natalRes = await fetch(`${baseUrl}/api/sati/read/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lang: 'th',
            question: 'เปิดไพ่พื้นดวง 10 ใบแรก',
            isNatal10: true,
            cards: deck.slice(0, 10)
          })
        });
        assert.equal(natalRes.status, 200);
        const natalFrames = parseSseFrames(await natalRes.text());
        assert.equal(natalFrames[0]?.event, 'meta');
        assert.equal(natalFrames[0]?.data?.model, 'gemini-4-hydrogen');
        assert.equal(natalFrames[0]?.data?.thinkingLevel, 'medium');
        assert.ok(natalFrames.some((f) => f.event === 'chunk'));
        assert.ok(natalFrames.some((f) => f.event === 'done' && f.data?.ok === true));
        assert.equal(recordedCalls[1]?.config?.thinkingConfig?.thinkingLevel, 'medium');
        assert.ok(recordedCalls[1]?.config?.maxOutputTokens >= 4096);

        // 3c. Major decision query on JSON /api/sati/read -> thinkingLevel: 'medium'
        const jsonRes = await fetch(`${baseUrl}/api/sati/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lang: 'th',
            question: 'ควรย้ายงานไปบริษัทใหม่เลยไหม หรืออยู่ต่ออีกปีดี',
            isNatal10: false,
            cards: [deck[4], deck[5], deck[6]],
            questionProfile: { topic: 'work', intent: 'decision' }
          })
        });
        assert.equal(jsonRes.status, 200);
        const jsonData = await jsonRes.json();
        assert.equal(jsonData.fallback, false);
        assert.equal(jsonData.thinkingLevel, 'medium');
        assert.equal(recordedCalls[2]?.config?.thinkingConfig?.thinkingLevel, 'medium');
      });
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it('SC-09-06: R6 enforces zero Unicode emojis across UI/i18n/engine/backend, preserves allowReversedCards, 4 spreads, and <550 char offline fallback with R1-R4 active', async () => {
    // 1. Unicode emoji scan across production files
    const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
    const htmlEmojiHits = findEmojiLines(indexHtml, 'index.html');
    assert.deepEqual(htmlEmojiHits, [], `index.html must contain zero emojis, found:\n${htmlEmojiHits.join('\n')}`);

    const uiEmojiHits = [];
    for (const lang of ['th', 'en', 'zh']) {
      collectEmojiMatchesFromValue(translations.UI_TEXT?.[lang], `UI_TEXT.${lang}`, uiEmojiHits);
    }
    assert.deepEqual(uiEmojiHits, [], `src/i18n/translations.js UI_TEXT must contain zero emojis, found:\n${uiEmojiHits.join('\n')}`);

    const cardI18nHits = [];
    collectEmojiMatchesFromValue(tarot78I18n.SPREAD_3_PRESETS_I18N, 'SPREAD_3_PRESETS_I18N', cardI18nHits);
    collectEmojiMatchesFromValue(tarot78I18n.CELTIC_POSITIONS_I18N, 'CELTIC_POSITIONS_I18N', cardI18nHits);
    collectEmojiMatchesFromValue(tarot78I18n.SUIT_LABELS_I18N, 'SUIT_LABELS_I18N', cardI18nHits);
    collectEmojiMatchesFromValue(tarot78I18n.THAKSA_DAY_I18N, 'THAKSA_DAY_I18N', cardI18nHits);
    collectEmojiMatchesFromValue(tarot78I18n.THAKSA_ROLE_I18N, 'THAKSA_ROLE_I18N', cardI18nHits);
    for (const lang of ['th', 'en', 'zh']) {
      for (const c of deck) {
        const loc = tarot78I18n.getLocalizedCardData(c, lang);
        collectEmojiMatchesFromValue(loc, `card(${c.uid},${lang})`, cardI18nHits);
      }
    }
    assert.deepEqual(cardI18nHits, [], `src/data/tarot78I18n.js must contain zero emojis, found:\n${cardI18nHits.join('\n')}`);

    for (const relPath of ['src/main.js', 'src/engine/satiBrain.js', 'backend/geminiProxyServer.js']) {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf8');
      const hits = findEmojiLines(content, relPath);
      assert.deepEqual(hits, [], `${relPath} must contain zero emojis, found:\n${hits.join('\n')}`);
    }

    // 2. Preserved allowReversedCards toggle & persistence
    assert.ok(indexHtml.includes('id="btn-toggle-reversed"'));
    assert.ok(indexHtml.includes('id="settings-reversed-status"'));
    assert.equal(storage.buildStoragePayload({ user: {} }).allowReversedCards, true);
    assert.equal(storage.buildStoragePayload({ user: {}, allowReversedCards: false }).allowReversedCards, false);

    // 3. Preserved 4 selectable 3-card spreads across th/en/zh
    assert.equal(Object.keys(tarot78I18n.SPREAD_3_PRESETS_I18N).length, 4);
    for (const lang of ['th', 'en', 'zh']) {
      const presets = tarot78I18n.listSpread3Presets(lang);
      assert.equal(presets.length, 4);
      for (const p of presets) {
        assert.equal(p.positions.length, 3);
      }
    }

    // 4. Offline synthesizeDeepReply / requestSatiReading fallback < 550 chars & 0 emojis with R1-R4 active
    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        throw new Error('offline');
      };

      const sampleQuestions = {
        th: 'ไตรมาสหน้าควรย้ายงานหรืออยู่ต่อดี',
        en: 'Should I switch roles next quarter or stay put?',
        zh: '下个季度我该换赛道还是继续留任？'
      };

      for (const lang of ['th', 'en', 'zh']) {
        const user = satiBrain.computeNatalProfile(createFullTestUser(), new Date('2026-11-23T12:00:00Z'));
        const st = createMockState({
          lang,
          user,
          natalCards: deck.slice(0, 10),
          remainingDeck: deck.slice(10),
          activeSpreadPreset: 'external_internal_solution',
          userContextFacts: ['บทบาทหลัก: ทำงานประจำ/องค์กร', 'งบย้ายที่อยู่ 120000 บาท ในเดือนมีนาคม'],
          calibrationFeedback: [{ id: 'c1', verdict: 'inaccurate', note: 'Not accounting; moved to Product', question: 'Career?', topic: 'work', cardsSummary: 'The Tower' }]
        });
        const spread = [{ ...deck[16], reversed: true }, deck[7], deck[24]];
        const reply = await satiBrain.requestSatiReading(st, sampleQuestions[lang], spread, false);
        assert.equal(st.lastReadingOffline, true);
        assert.ok(reply.length > 40 && reply.length < 550, `Expected offline ${lang} reply < 550 chars, got ${reply.length}`);
        assert.equal(EMOJI_RE.test(reply), false, `Offline ${lang} reply must contain zero emojis`);
      }
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
