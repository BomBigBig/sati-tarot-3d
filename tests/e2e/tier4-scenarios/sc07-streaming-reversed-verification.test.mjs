import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createSatiExpressApp,
  buildSatiPromptBundle,
  isModelOnCooldown,
  resetModelCooldownForTest,
  resetReadRateLimitForTest
} from '../../../backend/geminiProxyServer.js';
import {
  buildFullDeck78,
  hydrateDeckCards,
  applyReversedOrientation
} from '../../../src/data/tarot78.js';
import {
  formatCardOrientationTag,
  formatCardOrientationBadge,
  getReversedEnergyNuance
} from '../../../src/data/tarot78I18n.js';
import {
  analyzeSpreadPatterns,
  buildCrossSessionMemorySummary,
  synthesizeDeepReply,
  requestSatiReading,
  computeNatalProfile
} from '../../../src/engine/satiBrain.js';
import { buildStoragePayload, detectInAppBrowser } from '../../../src/engine/storage.js';
import { createTestCanvas, createMockState, disposalTracker } from '../harness/testHelpers.mjs';
import { createSati3DEngine } from '../../../src/scene/satiScene3D.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

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
  const app = createSatiExpressApp(options);
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

describe('Tier 4 - Scenario 07: SSE Streaming, Reversed Cards, Spread Patterns & UI Verification', () => {
  const deck = buildFullDeck78();

  beforeEach(() => {
    resetModelCooldownForTest();
    resetReadRateLimitForTest();
    disposalTracker.reset();
  });

  it('SC-07-01: POST /api/sati/read/stream streams meta -> chunk -> done, cascades on 429, emits fallback on total failure, and preserves /api/sati/read JSON', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key-sc07';

    try {
      // 1. Happy path SSE stream with markdown stripping
      await withTestServer({
        createAiClient: () => ({
          models: {
            async generateContentStream() {
              async function* gen() {
                yield { text: '**สวัสดี** บอม ' };
                yield { text: 'ไพ่ *The Fool* บอกให้เริ่มอย่างมีสติ' };
              }
              return gen();
            },
            async generateContent() {
              return { text: 'คำตอบ JSON ปกติจากสติ' };
            }
          }
        })
      }, async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/sati/read/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: 'งานช่วงนี้เป็นยังไง',
            lang: 'th',
            cards: [{ ...deck[0], reversed: true }]
          })
        });
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-type') || '', /text\/event-stream/i);
        const body = await res.text();
        const frames = parseSseFrames(body);
        assert.equal(frames[0].event, 'meta');
        assert.equal(frames[0].data.model, 'gemini-4-hydrogen');
        const chunks = frames.filter((f) => f.event === 'chunk');
        assert.ok(chunks.length >= 2, 'Expected multiple chunk events');
        const done = frames.find((f) => f.event === 'done');
        assert.ok(done, 'Expected done event');
        assert.equal(done.data.ok, true);
        assert.equal(done.data.fallback, false);
        assert.ok(!done.data.reply.includes('**'), 'Sanitized reply must not contain markdown **');

        // JSON endpoint compatibility check
        const jsonRes = await fetch(`${baseUrl}/api/sati/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: 'เช็ก JSON', lang: 'th', cards: [deck[0]] })
        });
        assert.equal(jsonRes.status, 200);
        const jsonData = await jsonRes.json();
        assert.equal(jsonData.fallback, false);
        assert.equal(jsonData.model, 'gemini-4-hydrogen');
        assert.ok(jsonData.reply.length > 0);
      });

      // 2. 429 quota cascade to next model & cooldown flag
      let calledModels = [];
      await withTestServer({
        createAiClient: () => ({
          models: {
            async generateContentStream({ model }) {
              calledModels.push(model);
              if (model === 'gemini-4-hydrogen') {
                throw new Error('429 RESOURCE_EXHAUSTED quota exceeded');
              }
              async function* gen() {
                yield { text: 'สลับโมเดลสำรองเรียบร้อยแล้ว' };
              }
              return gen();
            }
          }
        })
      }, async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/sati/read/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: 'การเงิน', lang: 'th', cards: [deck[1]] })
        });
        const frames = parseSseFrames(await res.text());
        assert.equal(calledModels[0], 'gemini-4-hydrogen');
        assert.equal(calledModels[1], 'gemini-3.6-flash');
        assert.equal(isModelOnCooldown('gemini-4-hydrogen'), true);
        const done = frames.find((f) => f.event === 'done');
        assert.equal(done?.data?.model, 'gemini-3.6-flash');
      });

      resetModelCooldownForTest();

      // 3. All models fail -> event: fallback
      await withTestServer({
        createAiClient: () => ({
          models: {
            async generateContentStream() {
              throw new Error('503 backend unavailable');
            }
          }
        })
      }, async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/sati/read/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: 'ความรัก', lang: 'th', cards: [deck[2]] })
        });
        const frames = parseSseFrames(await res.text());
        const fb = frames.find((f) => f.event === 'fallback');
        assert.ok(fb && fb.data.fallback === true);
      });

      // 4. Rate limit returns 429 JSON
      await withTestServer({
        createAiClient: () => ({ models: { async generateContentStream() { async function* g() { yield { text: 'ok' }; } return g(); } } })
      }, async (baseUrl) => {
        let limitedStatus = 200;
        let limitedBody = null;
        for (let i = 0; i < 25; i++) {
          const r = await fetch(`${baseUrl}/api/sati/read/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: 'test', lang: 'th', cards: [deck[0]] })
          });
          if (r.status === 429) {
            limitedStatus = r.status;
            limitedBody = await r.json();
            break;
          }
          await r.text();
        }
        assert.equal(limitedStatus, 429);
        assert.equal(limitedBody?.rateLimited, true);
        assert.equal(limitedBody?.fallback, true);
      });

      // 5. Missing API key returns fallback JSON cleanly before SSE
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      await withTestServer({}, async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/sati/read/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: 'test', lang: 'th', cards: [deck[0]] })
        });
        const data = await res.json();
        assert.equal(data.fallback, true);
      });
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it('SC-07-02: buildSatiPromptBundle marks reversed cards, injects spreadPatterns/pastSessionMemory conditionally, and preserves system invariants', () => {
    const revBundle = buildSatiPromptBundle({
      lang: 'th',
      question: 'ความรักช่วงนี้',
      cards: [{ ...deck[0], reversed: true }, { ...deck[1], reversed: false }],
      spreadPatterns: 'Major สูง 100%',
      pastSessionMemory: 'รอบก่อนถามเรื่องงาน (ได้ไพ่ The Hermit)'
    });
    assert.equal(revBundle.hasReversed, true);
    assert.ok(revBundle.formattedSpread.includes('[กลับหัว / Reversed]'));
    assert.ok(revBundle.userContext.includes('Major สูง 100%'));
    assert.ok(revBundle.userContext.includes('รอบก่อนถามเรื่องงาน'));
    assert.ok(revBundle.systemInstruction.includes('Golden Dawn'));
    assert.ok(revBundle.systemInstruction.includes('ห้ามไล่ชื่อไพ่ทั้ง 10 ใบ'));
    assert.ok(revBundle.systemInstruction.includes('กู'));

    const plainBundle = buildSatiPromptBundle({
      lang: 'en',
      question: 'Career outlook',
      cards: [{ ...deck[2], reversed: false }],
      spreadPatterns: '',
      pastSessionMemory: ''
    });
    assert.equal(plainBundle.hasReversed, false);
    assert.ok(!plainBundle.formattedSpread.includes('[กลับหัว / Reversed]'));
    assert.ok(!plainBundle.userContext.includes('Past-Session Memory'));
  });

  it('SC-07-03: applyReversedOrientation, hydrateDeckCards & orientation helpers work deterministically without mutating originals', () => {
    const sample = [deck[0], deck[1], deck[2], deck[3]];
    const seq = [0.1, 0.9, 0.2, 0.8];
    let idx = 0;
    const oriented = applyReversedOrientation(sample, {
      enabled: true,
      probability: 0.28,
      rng: () => seq[idx++]
    });
    assert.equal(sample[0].reversed, undefined, 'Source cards must not be mutated');
    assert.deepEqual(oriented.map((c) => c.reversed), [true, false, true, false]);

    const disabled = applyReversedOrientation(sample, { enabled: false, rng: () => 0.0 });
    assert.ok(disabled.every((c) => c.reversed === false));

    const hydrated = hydrateDeckCards([{ uid: deck[5].uid, reversed: true }, { uid: deck[6].uid }]);
    assert.equal(hydrated[0].reversed, true);
    assert.equal(hydrated[1].reversed, false);

    for (const lang of ['th', 'en', 'zh']) {
      assert.ok(formatCardOrientationTag(hydrated[0], lang).length > 0);
      assert.ok(formatCardOrientationBadge(hydrated[0], lang).length > 0);
      assert.ok(getReversedEnergyNuance(hydrated[0], lang).length > 0);
      assert.equal(formatCardOrientationTag(hydrated[1], lang), '');
    }
  });

  it('SC-07-04: analyzeSpreadPatterns, buildCrossSessionMemorySummary & offline reversed synthesizeDeepReply stay concise', () => {
    assert.equal(analyzeSpreadPatterns([deck[0]], 'th'), '');
    const patternText = analyzeSpreadPatterns(
      [{ ...deck[0], reversed: true }, { ...deck[1], reversed: false }, { ...deck[2], reversed: true }],
      'th'
    );
    assert.ok(patternText.length > 0 && patternText.length <= 280);

    assert.equal(buildCrossSessionMemorySummary([], 'th'), '');
    const mem = buildCrossSessionMemorySummary([
      {
        endedAt: '2026-11-17T10:00:00Z',
        chatHistory: [
          { role: 'user', text: 'ช่วงนี้จะเปลี่ยนงานดีไหม' },
          { role: 'sati', text: 'ช่วงนี้รอดูจังหวะและเตรียมตัวให้พร้อมก่อน', meta: { cards: [deck[9]] } }
        ]
      }
    ], 'th');
    assert.ok(mem.length > 0 && mem.length <= 240);

    const st = {
      lang: 'th',
      user: { nickname: 'บอม', day: 25, month: 6, year: 1996 },
      chatHistory: [],
      sessionArchives: [],
      natalCards: []
    };
    computeNatalProfile(st.user);
    const offlineReply = synthesizeDeepReply(st, 'งานช่วงนี้ติดขัดอะไรอยู่', [
      { ...deck[7], reversed: true },
      { ...deck[19], reversed: false },
      { ...deck[21], reversed: true }
    ]);
    assert.ok(offlineReply.length > 40 && offlineReply.length < 550, `Expected <550 chars, got ${offlineReply.length}`);
  });

  it('SC-07-05: requestSatiReading streams split SSE chunks progressively and falls back cleanly on SSE fallback', async () => {
    const origFetch = globalThis.fetch;
    const encoder = new TextEncoder();

    try {
      // 1. Stream split mid-JSON/mid-event across chunks
      const rawSse =
        'event: meta\ndata: {"model":"gemini-4-hydrogen"}\n\n' +
        'event: chunk\ndata: {"text":"ไพ่บอกว่า "}\n\n' +
        'event: chunk\ndata: {"text":"ค่อยๆ ตัดสินใจ"}\n\n' +
        'event: done\ndata: {"ok":true,"model":"gemini-4-hydrogen","reply":"ไพ่บอกว่า ค่อยๆ ตัดสินใจอย่างรอบคอบ","fallback":false}\n\n';
      const cut1 = rawSse.slice(0, 48);
      const cut2 = rawSse.slice(48, 92);
      const cut3 = rawSse.slice(92);

      globalThis.fetch = async (url) => {
        if (String(url).includes('/api/sati/read/stream')) {
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(encoder.encode(cut1));
                controller.enqueue(encoder.encode(cut2));
                controller.enqueue(encoder.encode(cut3));
                controller.close();
              }
            }),
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
          );
        }
        throw new Error('Unexpected fetch URL');
      };

      const progressCalls = [];
      const st1 = {
        lang: 'th',
        user: { nickname: 'บอม', day: 25, month: 6, year: 1996 },
        chatHistory: [],
        sessionArchives: [],
        natalCards: []
      };
      computeNatalProfile(st1.user);
      const streamedReply = await requestSatiReading(st1, 'ถามเรื่องงาน', [{ ...deck[0], reversed: true }], false, {
        onChunk: (txt, meta) => progressCalls.push({ txt, model: meta?.model })
      });
      assert.ok(progressCalls.length >= 2);
      assert.equal(streamedReply, 'ไพ่บอกว่า ค่อยๆ ตัดสินใจอย่างรอบคอบ');
      assert.equal(st1.lastReadingOffline, false);
      assert.equal(st1.lastReadingModel, 'gemini-4-hydrogen');

      // 2. Fallback from SSE `event: fallback` -> JSON `/api/sati/read`
      let fallbackJsonHit = false;
      globalThis.fetch = async (url) => {
        if (String(url).includes('/api/sati/read/stream')) {
          return new Response(
            'event: fallback\ndata: {"ok":false,"fallback":true,"reason":"UPSTREAM_DOWN"}\n\n',
            { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
          );
        }
        if (String(url).endsWith('/api/sati/read')) {
          fallbackJsonHit = true;
          return new Response(
            JSON.stringify({ ok: true, model: 'gemini-3.6-flash', reply: 'คำตอบจาก JSON สำรอง', fallback: false }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error('Unexpected URL');
      };

      const st2 = { ...st1 };
      const fbReply = await requestSatiReading(st2, 'ถามเรื่องเงิน', [deck[1], deck[2]], false, {
        onChunk: () => {}
      });
      assert.equal(fallbackJsonHit, true);
      assert.equal(fbReply, 'คำตอบจาก JSON สำรอง');
      assert.equal(st2.lastReadingOffline, false);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('SC-07-06: 3D scene rotates reversed cards by Math.PI on targetRotY and handles missing onSpreadProjection safely', () => {
    const canvas = createTestCanvas();
    const state = createMockState({ remainingDeck: [...deck] });
    const engine = createSati3DEngine({ canvas, state });
    engine.spawn78CardFan();
    const fan = engine.getFanCardMeshes();

    const uprightCard = { ...deck[0], reversed: false };
    const reversedCard = { ...deck[1], reversed: true };
    engine.placeSpreadCardIn3D(fan[0], uprightCard, 0, 3);
    engine.placeSpreadCardIn3D(fan[1], reversedCard, 1, 3);

    assert.equal(fan[0].userData.targetRotY, 0);
    assert.equal(fan[1].userData.targetRotY, Math.PI);
    assert.equal(Math.abs(fan[1].userData.targetRotY - fan[0].userData.targetRotY), Math.PI);

    engine.tuckNatalSpreadAway3D();
    engine.dispose();
  });

  it('SC-07-07: Vite build outputs a separate three-vendor chunk and lean main entry bundle', (t) => {
    const assetsDir = path.join(PROJECT_ROOT, 'dist', 'assets');
    if (!fs.existsSync(assetsDir)) {
      t.skip('dist/assets not built yet — run npm run build before running full verification');
      return;
    }
    const files = fs.readdirSync(assetsDir);
    const threeChunk = files.find((f) => f.startsWith('three-vendor') && f.endsWith('.js'));
    const entryChunk = files.find((f) => f.startsWith('index-') && f.endsWith('.js'));
    assert.ok(threeChunk, `Expected three-vendor chunk in ${assetsDir}`);
    assert.ok(entryChunk, `Expected index-* entry chunk in ${assetsDir}`);
    const entrySizeKb = fs.statSync(path.join(assetsDir, entryChunk)).size / 1024;
    assert.ok(entrySizeKb < 500, `Expected split index chunk < 500 kB, got ${entrySizeKb.toFixed(1)} kB`);
  });

  it('SC-07-08: UI wiring persists allowReversedCards (default true), detects In-App browsers, and declares required DOM hooks', () => {
    const defaultPayload = buildStoragePayload({ user: {}, chatHistory: [], remainingDeck: [], natalCards: [] });
    assert.equal(defaultPayload.allowReversedCards, true);
    const offPayload = buildStoragePayload({ user: {}, allowReversedCards: false });
    assert.equal(offPayload.allowReversedCards, false);

    assert.equal(detectInAppBrowser('Mozilla/5.0 (iPhone) Mobile FBAN/FBIOS FBAV/420.0'), 'facebook');
    assert.equal(detectInAppBrowser('Mozilla/5.0 Instagram 302.0'), 'instagram');
    assert.equal(detectInAppBrowser('Mozilla/5.0 Line/14.1.0 Safari'), 'line');
    assert.equal(detectInAppBrowser('Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36'), '');

    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
    assert.ok(html.includes('id="spread-3d-labels"'));
    assert.ok(html.includes('id="inapp-browser-banner"'));
    assert.ok(html.includes('id="btn-copy-app-link"'));
    assert.ok(html.includes('id="btn-toggle-reversed"'));
    assert.ok(html.includes('id="settings-reversed-status"'));
  });
});
