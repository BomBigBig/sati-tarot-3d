import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SPREAD_3_PRESETS_I18N,
  normalizeSpread3Preset,
  getSpread3PresetInfo,
  listSpread3Presets
} from '../../../src/data/tarot78I18n.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';
import { buildSatiPromptBundle } from '../../../backend/geminiProxyServer.js';
import {
  requestSatiReading,
  buildReadingBreakdown,
  computeNatalProfile
} from '../../../src/engine/satiBrain.js';
import { buildStoragePayload } from '../../../src/engine/storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

describe('Tier 4 - Scenario 08: Quick 3-Card Mode & 4 Flexible 3-Card Spread Presets', () => {
  const deck = buildFullDeck78();

  it('SC-08-01: SPREAD_3_PRESETS_I18N exposes 4 multilingual 3-card frameworks cleanly', () => {
    const expectedIds = [
      'past_present_future',
      'external_internal_solution',
      'situation_obstacle_advice',
      'daily_mindset_guidance'
    ];
    assert.deepEqual(Object.keys(SPREAD_3_PRESETS_I18N), expectedIds);
    assert.equal(normalizeSpread3Preset('unknown_id'), 'past_present_future');

    for (const lang of ['th', 'en', 'zh']) {
      const list = listSpread3Presets(lang);
      assert.equal(list.length, 4);
      for (const item of list) {
        assert.ok(item.title.length > 0);
        assert.ok(item.desc.length > 0);
        assert.equal(item.positions.length, 3);
        assert.ok(item.defaultQ.length > 0);
      }
    }

    const thExt = getSpread3PresetInfo('external_internal_solution', 'th');
    assert.deepEqual(thExt.positions, ['ปัจจัยภายนอก', 'ปัจจัยภายใน', 'ทางออก']);
    const thPpf = getSpread3PresetInfo('past_present_future', 'th');
    assert.deepEqual(thPpf.positions, ['อดีต', 'ปัจจุบัน', 'อนาคต']);
  });

  it('SC-08-02: buildSatiPromptBundle injects selected 3-card positions & handles empty natalCards cleanly', () => {
    const presetInfo = getSpread3PresetInfo('external_internal_solution', 'th');
    const bundle = buildSatiPromptBundle({
      lang: 'th',
      question: 'โปรเจกต์นี้ติดตรงไหน',
      natalCards: [],
      activeSpread: [deck[0], deck[1], deck[2]],
      spreadPositions: presetInfo.positions,
      spreadPresetTitle: presetInfo.title
    });

    assert.ok(bundle.formattedSpread.includes('[ปัจจัยภายนอก]'));
    assert.ok(bundle.formattedSpread.includes('[ปัจจัยภายใน]'));
    assert.ok(bundle.formattedSpread.includes('[ทางออก]'));
    assert.ok(bundle.userContext.includes(presetInfo.title));
    assert.ok(bundle.userContext.includes('ยังไม่เปิดผังพื้นดวง 10 ใบ'));
  });

  it('SC-08-03: requestSatiReading forwards spreadPositions & buildReadingBreakdown preserves preset positions', async () => {
    const origFetch = globalThis.fetch;
    let capturedBody = null;
    try {
      globalThis.fetch = async (_url, init) => {
        capturedBody = JSON.parse(init.body);
        return new Response(
          JSON.stringify({ fallback: false, model: 'gemini-4-hydrogen', reply: 'คำตอบเชื่อม 3 ตำแหน่งชัดเจน' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const st = {
        lang: 'th',
        activeSpreadPreset: 'past_present_future',
        user: { nickname: 'บอม', day: 25, month: 6, year: 1996 },
        natalCards: [],
        remainingDeck: deck.slice(3),
        chatHistory: [],
        sessionArchives: []
      };
      computeNatalProfile(st.user);
      const reply = await requestSatiReading(st, 'ความรักเดือนนี้เป็นไง', [deck[3], deck[4], deck[5]], false);
      assert.equal(reply, 'คำตอบเชื่อม 3 ตำแหน่งชัดเจน');
      assert.deepEqual(capturedBody?.spreadPositions, ['อดีต', 'ปัจจุบัน', 'อนาคต']);
      assert.equal(capturedBody?.spreadPresetTitle, 'อดีต · ปัจจุบัน · อนาคต');

      const bdCustom = buildReadingBreakdown({
        text: reply,
        meta: {
          question: 'ความรักเดือนนี้เป็นไง',
          cards: [deck[3], deck[4], deck[5]],
          spread3Preset: 'past_present_future',
          spreadPositions: ['อดีต', 'ปัจจุบัน', 'อนาคต']
        }
      }, '', st, deck);
      assert.equal(bdCustom.isReading, true);
      assert.deepEqual(bdCustom.primaryCards.map((c) => c.posLabel), ['อดีต', 'ปัจจุบัน', 'อนาคต']);

      // Legacy fallback without spread3Preset metadata remains unaffected
      const bdLegacy = buildReadingBreakdown({
        text: reply,
        meta: { question: 'ถามทั่วไป', cards: [deck[3], deck[4], deck[5]] }
      }, '', st, deck);
      assert.equal(bdLegacy.primaryCards.length, 3);
      assert.notDeepEqual(bdLegacy.primaryCards.map((c) => c.posLabel), ['อดีต', 'ปัจจุบัน', 'อนาคต']);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SC-08-04: buildStoragePayload persists activeSpreadPreset', () => {
    const payload = buildStoragePayload({
      user: { nickname: 'บอม' },
      activeSpreadPreset: 'daily_mindset_guidance'
    });
    assert.equal(payload.activeSpreadPreset, 'daily_mindset_guidance');
  });

  it('SC-08-05: index.html and main.js expose Quick 3-Card entry mode, Stage 2 #ledger-spread3-box presets, and direct #btn-draw-3 from #chat-input without openSpread3Modal', () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
    assert.ok(html.includes('id="btn-entry-mode-3"'));
    assert.ok(html.includes('id="btn-entry-mode-10"'));
    assert.ok(html.includes('id="ledger-spread3-box"'));
    assert.ok(html.includes('id="ledger-spread3-options"'));
    assert.ok(html.includes('id="btn-draw-3"'));
    assert.ok(html.includes('id="chat-input"'));

    const mainJs = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
    assert.ok(mainJs.includes("enterPickingPhase(3, 'quick3')"));
    assert.ok(mainJs.includes("renderSpreadPresetSelector('ledger-spread3-options'"));
    assert.ok(mainJs.includes('inferSpread3PresetForQuestion'));
    assert.ok(mainJs.includes('startSpread3DrawWithOptions'));
    assert.equal(mainJs.includes('openSpread3Modal'), false, '#btn-draw-3 must invoke direct draw rather than openSpread3Modal');

    const draw3SectionIdx = mainJs.indexOf("document.getElementById('btn-draw-3').addEventListener");
    assert.ok(draw3SectionIdx !== -1, 'Expected #btn-draw-3 click listener in src/main.js');
    const draw3Block = mainJs.slice(draw3SectionIdx, draw3SectionIdx + 800);
    assert.ok(draw3Block.includes("document.getElementById('chat-input')"), '#btn-draw-3 must read question from #chat-input');
    assert.ok(draw3Block.includes('startSpread3DrawWithOptions('), '#btn-draw-3 must call startSpread3DrawWithOptions directly');
  });
});
