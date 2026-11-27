import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { setupHeadlessEnv } from '../harness/headlessEnv.mjs';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';
import { generateReadingShareCardDataURL } from '../../../src/engine/shareCardCanvas.js';
import * as translations from '../../../src/i18n/translations.js';
import * as geminiProxy from '../../../backend/geminiProxyServer.js';

setupHeadlessEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const EMOJI_RE = /\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u20E3|\uFE0F/u;

function findEmojiLines(text, label) {
  const hits = [];
  String(text || '').split(/\r?\n/).forEach((line, idx) => {
    if (EMOJI_RE.test(line)) {
      hits.push(`${label}:${idx + 1}: ${line.trim().slice(0, 100)}`);
    }
  });
  return hits;
}

function rawHttpRequest(port, reqPath, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks)
      }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function withIsolatedServer(options, fn) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sati-sc11-'));
  const usersDbFile = path.join(tmpDir, 'users_db.json');
  const feedbackDbFile = path.join(tmpDir, 'feedback_db.json');
  const app = geminiProxy.createSatiExpressApp({
    usersDbFile,
    feedbackDbFile,
    ...options
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = server.address().port;
  try {
    return await fn({ port, tmpDir, usersDbFile, feedbackDbFile });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('Tier 4 - Scenario 11: P0-P2 Production Optimization, Security, Portability & Growth Upgrade', () => {
  const deck = buildFullDeck78();

  beforeEach(() => {
    geminiProxy.resetReadRateLimitForTest();
    geminiProxy.resetStateRateLimitForTest();
    geminiProxy.resetFeedbackRateLimitForTest();
    globalThis.localStorage?.clear();
  });

  afterEach(() => {
    geminiProxy.resetReadRateLimitForTest();
    geminiProxy.resetStateRateLimitForTest();
    geminiProxy.resetFeedbackRateLimitForTest();
    globalThis.localStorage?.clear();
  });

  it('SC-11-01: P0 removes Tailwind CDN, builds CSS bundle, configures Open Graph card & meta tags, enables gzip, sets Cache-Control, and skips SSE compression', async () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
    const mainJs = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');

    assert.equal(html.includes('cdn.tailwindcss.com'), false, 'Runtime Tailwind Play CDN script must be removed');
    assert.equal(html.includes('user-scalable=no'), false, 'Viewport meta must allow accessible zoom');
    assert.ok(html.includes('meta name="description"'));
    assert.ok(html.includes('property="og:title"'));
    assert.ok(html.includes('property="og:description"'));
    assert.ok(html.includes('property="og:image"'));
    assert.ok(html.includes('name="twitter:card"'));
    assert.ok(mainJs.includes("import './styles/tailwind.css';"));

    assert.ok(fs.existsSync(path.join(PROJECT_ROOT, 'tailwind.config.js')));
    assert.ok(fs.existsSync(path.join(PROJECT_ROOT, 'postcss.config.js')));
    assert.ok(fs.existsSync(path.join(PROJECT_ROOT, 'src', 'styles', 'tailwind.css')));

    const ogImgPath = path.join(PROJECT_ROOT, 'public', 'images', 'og-sati.jpg');
    assert.ok(fs.existsSync(ogImgPath), 'Open Graph image public/images/og-sati.jpg must exist');
    const ogStat = fs.statSync(ogImgPath);
    assert.ok(ogStat.size > 10_000 && ogStat.size < 500_000, `Unexpected og-sati.jpg size: ${ogStat.size}`);

    const distAssetsDir = path.join(PROJECT_ROOT, 'dist', 'assets');
    let builtCssFile = '';
    if (fs.existsSync(distAssetsDir)) {
      const files = fs.readdirSync(distAssetsDir);
      builtCssFile = files.find((f) => f.endsWith('.css')) || '';
      assert.ok(builtCssFile, 'Built CSS asset must exist under dist/assets');
    }

    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key-sc11';
    try {
      await withIsolatedServer({
        createAiClient: () => ({
          models: {
            generateContentStream: async () => (async function* () {
              yield { text: 'ไพ่ใบนี้เตือนสติให้ค่อยๆ ตัดสินใจอย่างรอบคอบนะ' };
            })()
          }
        })
      }, async ({ port }) => {
        if (fs.existsSync(distAssetsDir) && builtCssFile) {
          const htmlRes = await rawHttpRequest(port, '/', { headers: { 'Accept-Encoding': 'gzip' } });
          assert.equal(htmlRes.status, 200);
          assert.equal(htmlRes.headers['cache-control'], 'no-cache');
          assert.equal(htmlRes.headers['content-encoding'], 'gzip');

          const cssRes = await rawHttpRequest(port, `/assets/${builtCssFile}`, { headers: { 'Accept-Encoding': 'gzip' } });
          assert.equal(cssRes.status, 200);
          assert.equal(cssRes.headers['cache-control'], 'public, max-age=31536000, immutable');
          assert.equal(cssRes.headers['content-encoding'], 'gzip');

          const ogRes = await rawHttpRequest(port, '/images/og-sati.jpg');
          assert.equal(ogRes.status, 200);
          assert.equal(ogRes.headers['cache-control'], 'public, max-age=86400, stale-while-revalidate=604800');
        }

        const payload = JSON.stringify({
          lang: 'th',
          userProfile: { nickname: 'บอม', fullname: 'ธนพัฒน์', dayName: 'วันอังคาร', element: 'ลม', elemShort: 'ลม', lifePath: 9 },
          question: 'งานเดือนนี้เป็นอย่างไรบ้าง',
          activeSpread: [deck[0]]
        });
        const sseRes = await rawHttpRequest(port, '/api/sati/read/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip',
            'Content-Length': Buffer.byteLength(payload)
          },
          body: payload
        });
        assert.equal(sseRes.status, 200);
        assert.ok(String(sseRes.headers['content-type'] || '').includes('text/event-stream'));
        assert.equal(sseRes.headers['content-encoding'], undefined, 'SSE stream must never be gzip compressed/buffered');
      });
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it('SC-11-02: P1 enforces security headers, state/feedback rate limits, payload capping/413, and atomic DB consistency', async () => {
    const now = 1_750_000_000_000;
    for (let i = 0; i < 60; i += 1) {
      assert.equal(geminiProxy.checkStateRateLimit('203.0.113.10', now + i * 10).allowed, true);
    }
    assert.equal(geminiProxy.checkStateRateLimit('203.0.113.10', now + 1000).allowed, false);

    for (let i = 0; i < 8; i += 1) {
      assert.equal(geminiProxy.checkFeedbackRateLimit('203.0.113.11', now + i * 10).allowed, true);
    }
    assert.equal(geminiProxy.checkFeedbackRateLimit('203.0.113.11', now + 1000).allowed, false);

    // pruneUsersDbMap keeps newest entries up to maxAccounts
    const oversizedDb = {};
    for (let i = 0; i < 510; i += 1) {
      oversizedDb[`u_${i}`] = { updatedAt: new Date(now + i * 1000).toISOString() };
    }
    const pruned = geminiProxy.pruneUsersDbMap(oversizedDb, 500);
    assert.equal(Object.keys(pruned).length, 500);
    assert.equal(Boolean(pruned.u_0), false);
    assert.equal(Boolean(pruned.u_509), true);

    await withIsolatedServer({}, async ({ port }) => {
      const health = await rawHttpRequest(port, '/api/sati/health');
      assert.equal(health.status, 200);
      assert.equal(health.headers['x-content-type-options'], 'nosniff');
      assert.equal(health.headers['referrer-policy'], 'strict-origin-when-cross-origin');
      assert.equal(health.headers['x-frame-options'], 'SAMEORIGIN');
      assert.ok(String(health.headers['permissions-policy'] || '').includes('camera=()'));

      // Oversized state -> 413
      const hugeRes = await fetch(`http://127.0.0.1:${port}/api/sati/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'big@sati.test',
          record: { deckCarryoverSummary: 'x'.repeat(360_000) }
        })
      });
      assert.equal(hugeRes.status, 413);

      // Capped archives (30 -> 25) + chatHistory (150 -> 120) + read-after-write cache consistency
      const manyArchives = Array.from({ length: 30 }, (_, i) => ({ id: `arch_${i}`, mode: 'quick3', usedCount: 3 }));
      const manyChats = Array.from({ length: 150 }, (_, i) => ({ speaker: 'บอม', role: 'user', text: `msg_${i}` }));
      const saveRes = await fetch(`http://127.0.0.1:${port}/api/sati/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'bom@sati.test',
          record: {
            user: { nickname: 'บอม' },
            sessionArchives: manyArchives,
            chatHistory: manyChats
          }
        })
      });
      assert.equal(saveRes.status, 200);

      const loadRes = await fetch(`http://127.0.0.1:${port}/api/sati/state?email=bom@sati.test`).then((r) => r.json());
      assert.equal(loadRes.record.sessionArchives.length, 25);
      assert.equal(loadRes.record.chatHistory.length, 120);
      assert.equal(loadRes.record.chatHistory[0].text, 'msg_30');
    });
  });

  it('SC-11-03: P2 delivers 9:16 1080x1920 story share cards, 1-tap daily 3-card CTA, haptics, clean single-device flow (no profile/backup UI), and zero Unicode emojis', async () => {
    // 1. 9:16 Story Share Card (1080x1920) generation
    const origCreateElement = globalThis.document.createElement.bind(globalThis.document);
    const createdCanvases = [];
    globalThis.document.createElement = (tag) => {
      const el = origCreateElement(tag);
      if (tag === 'canvas') createdCanvases.push(el);
      return el;
    };
    try {
      const storyUrl = await generateReadingShareCardDataURL({
        entry: {
          speaker: 'สติ',
          role: 'sati',
          text: 'นี่คือคำทำนายตัวอย่างที่ยาวพอสมควรเพื่อทดสอบการตัดบรรทัดในโหมดสตอรี่แนวตั้งเก้าต่อสิบหก\n'.repeat(12),
          meta: { cards: deck.slice(0, 3) }
        },
        question: 'ช่วงนี้งานและความรักจะเดินหน้าไปทางไหนดี',
        breakdown: {
          isNatal10: false,
          primaryCards: deck.slice(0, 3).map((card, i) => ({ card, posLabel: `#${i + 1}`, isCited: i === 0 }))
        },
        user: { nickname: 'บอม', dayName: 'วันอังคาร', birthCard: 'The Hermit' },
        lang: 'th',
        format: 'story9x16'
      });
      assert.ok(storyUrl.startsWith('data:image/png;base64,'));
      const storyCanvas = createdCanvases.find((c) => c.width === 1080 && c.height === 1920);
      assert.ok(storyCanvas, `Expected a 1080x1920 story canvas, saw: ${createdCanvases.map((c) => `${c.width}x${c.height}`).join(', ')}`);
    } finally {
      globalThis.document.createElement = origCreateElement;
    }

    // 2. UI & Controller hooks (multi-profile removed cleanly) + i18n + strict zero Unicode emojis
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
    const mainJs = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
    assert.equal(html.includes('id="profile-switcher-bar"'), false, 'Multi-profile switcher UI must be removed');
    assert.equal(html.includes('id="btn-add-profile"'), false, 'Add-profile button must be removed');
    assert.equal(html.includes('id="btn-copy-backup-code"'), false, 'Backup code button must be removed');
    assert.equal(html.includes('id="ledger-restore-box"'), false, 'Backup restore box must be removed');
    for (const id of [
      'server-warmup-status',
      'btn-quick-daily-3',
      'btn-share-fmt-standard',
      'btn-share-fmt-story'
    ]) {
      assert.ok(html.includes(`id="${id}"`), `Missing #${id} in index.html`);
    }
    for (const sym of ['triggerHaptic', 'story9x16']) {
      assert.ok(mainJs.includes(sym), `Missing ${sym} in src/main.js`);
    }

    for (const lang of ['th', 'en', 'zh']) {
      for (const key of [
        'serverWarmupPending',
        'btnQuickDaily3Now',
        'btnShareFmtStandard',
        'btnShareFmtStory9x16'
      ]) {
        const val = translations.t(lang, key);
        assert.ok(typeof val === 'string' && val.trim().length > 0, `Missing ${lang}.${key}`);
        assert.equal(EMOJI_RE.test(val), false, `Emoji found in ${lang}.${key}`);
      }
    }

    const targetFiles = [
      'index.html',
      'src/main.js',
      'src/i18n/translations.js',
      'src/engine/storage.js',
      'src/engine/shareCardCanvas.js',
      'src/scene/satiScene3D.js',
      'backend/geminiProxyServer.js',
      'vite.config.js'
    ];
    for (const relPath of targetFiles) {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf8');
      assert.deepEqual(findEmojiLines(content, relPath), [], `Unicode emoji detected in ${relPath}`);
    }
  });
});
