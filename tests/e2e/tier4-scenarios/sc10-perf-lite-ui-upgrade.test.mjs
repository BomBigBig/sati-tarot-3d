import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { setupHeadlessEnv } from '../harness/headlessEnv.mjs';
import { createTestCanvas, createMockState, simulatePointerEvent, simulateResize, spyOn, disposalTracker } from '../harness/testHelpers.mjs';
import { createSati3DEngine, CAM_POS } from '../../../src/scene/satiScene3D.js';
import { buildFullDeck78 } from '../../../src/data/tarot78.js';
import * as storage from '../../../src/engine/storage.js';
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

async function withTestServer(options, fn) {
  const app = geminiProxy.createSatiExpressApp(options);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('Tier 4 - Scenario 10: Perf-Lite AI Routing, 3D Optimization & UI Upgrade Verification', () => {
  const deck = buildFullDeck78();

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

  it('SC-10-01: Backend free-tier model order, health response, 16s timeout, and 503/DEADLINE_EXCEEDED cascade behave accurately', async () => {
    assert.equal(geminiProxy.PRIMARY_GEMINI_MODEL, 'gemini-3.5-flash-lite');
    assert.deepEqual(geminiProxy.GEMINI_MODEL_ORDER, [
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-4-hydrogen',
      'gemini-3.6-flash'
    ]);
    assert.equal(geminiProxy.GEMINI_MODEL_ORDER.includes('gemini-2.5-flash'), false);

    assert.ok(geminiProxy.SATI_SYSTEM_PROMPT.includes('subDomain'));
    assert.ok(geminiProxy.SATI_SYSTEM_PROMPT.includes('topicSwitchedFrom'));
    assert.ok(geminiProxy.SATI_SYSTEM_PROMPT.includes('Golden Dawn'));
    assert.ok(geminiProxy.SATI_SYSTEM_PROMPT.includes('Direct 3-Card Spread'));

    const backendSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'backend', 'geminiProxyServer.js'), 'utf8');
    assert.ok(backendSrc.includes('timeout: 16000'), 'Expected reduced 16000ms timeout in createGeminiClient');

    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key-sc10';
    const triedModels = [];

    try {
      await withTestServer({
        createAiClient: () => ({
          models: {
            async generateContent({ model }) {
              triedModels.push(model);
              if (model === 'gemini-3.5-flash-lite') {
                throw new Error('503 UNAVAILABLE high demand');
              }
              if (model === 'gemini-3.8-flash') {
                throw new Error('DEADLINE_EXCEEDED upstream timeout');
              }
              return { text: 'คำทำนายจากโมเดลสำรองผ่านเรียบร้อย' };
            }
          }
        })
      }, async (baseUrl) => {
        const health = await fetch(`${baseUrl}/api/sati/health`).then((r) => r.json());
        assert.equal(health.ok, true);
        assert.equal(health.model, 'gemini-3.5-flash-lite');

        const res = await fetch(`${baseUrl}/api/sati/read`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lang: 'th',
            question: 'ควรเน้นงานไหนก่อนดี',
            cards: [deck[0], deck[1], deck[2]]
          })
        }).then((r) => r.json());

        assert.equal(res.fallback, false);
        assert.equal(res.model, 'gemini-4-hydrogen');
        assert.deepEqual(triedModels, ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-4-hydrogen']);
        assert.equal(geminiProxy.isModelOnCooldown('gemini-3.5-flash-lite'), true);
        assert.equal(geminiProxy.isModelOnCooldown('gemini-3.8-flash'), true);
        assert.equal(geminiProxy.isModelOnCooldown('gemini-4-hydrogen'), false);
      });
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
      else delete process.env.GEMINI_API_KEY;
    }
  });

  it('SC-10-02: 3D Engine limits active lights to <=4, removes per-flame PointLights, avoids getBoundingClientRect in animate3D, throttles pointer raycasts, culls fan shadows, and switches qualityMode', async () => {
    const prevDocElement = globalThis.document.documentElement;
    const prevWinRaf = globalThis.window.requestAnimationFrame;
    const prevWinCancelRaf = globalThis.window.cancelAnimationFrame;
    const prevGlobalRaf = globalThis.requestAnimationFrame;
    const prevGlobalCancelRaf = globalThis.cancelAnimationFrame;

    const rafQueue = new Map();
    let rafSeq = 1;
    const manualRaf = (cb) => {
      const id = rafSeq++;
      rafQueue.set(id, cb);
      return id;
    };
    const manualCancelRaf = (id) => {
      rafQueue.delete(id);
    };
    const stepOneFrame = () => {
      const first = rafQueue.entries().next().value;
      if (!first) return false;
      const [id, cb] = first;
      rafQueue.delete(id);
      cb(performance.now());
      return true;
    };

    const addedLights = [];
    const raycastSpy = spyOn(THREE.Raycaster.prototype, 'intersectObjects');

    const origSceneAdd = THREE.Scene.prototype.add;
    THREE.Scene.prototype.add = function (...objs) {
      if (this?.constructor === THREE.Scene && this.background?.isColor && this.fog?.isFogExp2) {
        for (const o of objs) {
          if (o && o.isLight && !addedLights.includes(o)) {
            addedLights.push(o);
          }
        }
      }
      return origSceneAdd.apply(this, objs);
    };

    let bcrCalls = 0;
    const canvas = createTestCanvas(1920, 1080);
    canvas.getBoundingClientRect = () => {
      bcrCalls += 1;
      return { left: 0, top: 0, width: 1920, height: 1080 };
    };

    let engine = null;
    try {
      globalThis.document.documentElement = { dataset: {} };
      globalThis.window.requestAnimationFrame = manualRaf;
      globalThis.window.cancelAnimationFrame = manualCancelRaf;
      globalThis.requestAnimationFrame = manualRaf;
      globalThis.cancelAnimationFrame = manualCancelRaf;

      const state = createMockState({
        screen: 'game',
        isPicking: true,
        remainingDeck: [...deck],
        discardPile: [],
        graphicsQuality: 'high'
      });

      let loadedDone = false;
      engine = createSati3DEngine({
        canvas,
        state,
        qualityMode: 'high',
        onModelsLoaded: () => {
          loadedDone = true;
        }
      });

      for (let i = 0; i < 60 && !loadedDone; i += 1) {
        await new Promise((r) => setTimeout(r, 15));
      }
      assert.equal(loadedDone, true, 'All 4 GLB models should load in headless environment');

      // 1. Lights <= 4 and only 1 PointLight (no per-flame PointLights)
      assert.ok(addedLights.length <= 4, `Expected <= 4 active lights in scene, got ${addedLights.length}`);
      const pointLights = addedLights.filter((l) => l.isPointLight);
      assert.equal(pointLights.length, 1, `Expected only 1 tabletop crystal PointLight (no per-flame PointLights), got ${pointLights.length}`);

      // 2. Quality Mode API + documentElement.dataset.satiPerf
      assert.equal(engine.getQualityMode(), 'high');
      assert.equal(globalThis.document.documentElement.dataset.satiPerf, 'high');
      assert.equal(engine.setQualityMode('low'), 'low');
      assert.equal(engine.getQualityMode(), 'low');
      assert.equal(globalThis.document.documentElement.dataset.satiPerf, 'low');
      assert.equal(engine.setQualityMode('invalid-mode'), 'auto');
      assert.equal(engine.getQualityMode(), 'auto');
      assert.equal(globalThis.document.documentElement.dataset.satiPerf, 'auto');

      // Ensure headless safety when documentElement is undefined
      delete globalThis.document.documentElement;
      assert.doesNotThrow(() => engine.setQualityMode('low'));
      globalThis.document.documentElement = { dataset: {} };
      engine.setQualityMode('auto');

      // 3. Fan & discard shadow culling vs spread cards
      engine.spawn78CardFan();
      const fanMeshes = engine.getFanCardMeshes();
      assert.equal(fanMeshes.length, 78);
      assert.ok(fanMeshes.every((m) => m.castShadow === false && m.receiveShadow === true), 'Fan cards must set castShadow=false');

      engine.syncDiscardPile3D(deck.slice(0, 6));
      const discardMeshes = engine.getDiscardCardMeshes();
      assert.equal(discardMeshes.length, 6);
      assert.ok(discardMeshes.every((m) => m.castShadow === false), 'Discard pile meshes must set castShadow=false');

      engine.placeSpreadCardIn3D(fanMeshes[0], deck[0], 0, 3);
      assert.equal(fanMeshes[0].castShadow, true, 'Active spread card must restore castShadow=true');

      // 4. Zero getBoundingClientRect() inside animate3D & emitSpreadProjection, and rAF-throttled raycasting
      bcrCalls = 0;
      raycastSpy.calls.length = 0;

      // Multiple pointermove events before rAF frame must NOT synchronously trigger raycaster.intersectObjects
      for (let i = 0; i < 5; i += 1) {
        simulatePointerEvent(canvas, 'pointermove', 500 + i * 20, 420);
      }
      assert.equal(raycastSpy.calls.length, 0, 'onPointerMove must NOT call raycaster.intersectObjects synchronously');

      // Step 1 animation frame -> raycast executes for that frame, getBoundingClientRect stays 0
      assert.equal(stepOneFrame(), true);
      const callsAfterFrame1 = raycastSpy.calls.length;
      assert.ok(callsAfterFrame1 >= 1, 'Expected raycast to run inside rAF frame after pointermove');
      assert.equal(bcrCalls, 0, 'animate3D and emitSpreadProjection must NEVER call getBoundingClientRect()');

      // Step 2nd animation frame with NO new pointermove -> raycast is skipped
      assert.equal(stepOneFrame(), true);
      assert.equal(raycastSpy.calls.length, callsAfterFrame1, 'Subsequent rAF frame without pointermove must skip raycasting');
      assert.equal(bcrCalls, 0, 'No getBoundingClientRect() across subsequent animate3D frames');

      // Structural guard in src/scene/satiScene3D.js
      const sceneSrc = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'scene', 'satiScene3D.js'), 'utf8');
      const animStart = sceneSrc.indexOf('function animate3D()');
      const animEnd = sceneSrc.indexOf('createArcaneParticles();', animStart);
      assert.ok(animStart !== -1 && animEnd > animStart);
      assert.equal(sceneSrc.slice(animStart, animEnd).includes('getBoundingClientRect'), false);
    } finally {
      if (engine) engine.dispose();
      THREE.Scene.prototype.add = origSceneAdd;
      raycastSpy.restore();
      if (prevDocElement === undefined) delete globalThis.document.documentElement;
      else globalThis.document.documentElement = prevDocElement;
      globalThis.window.requestAnimationFrame = prevWinRaf;
      globalThis.window.cancelAnimationFrame = prevWinCancelRaf;
      globalThis.requestAnimationFrame = prevGlobalRaf;
      globalThis.cancelAnimationFrame = prevGlobalCancelRaf;
    }
  });

  it('SC-10-03: UI upgrades deliver textarea #chat-input, direct #btn-draw-3, #modal-settings quality selector, storage persistence, chunked gallery/rAF streaming, and zero Unicode emojis', async () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
    const mainJs = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');

    // 1. Multi-line <textarea id="chat-input"> + auto-resize + Enter/Shift+Enter
    assert.match(html, /<textarea[^>]*id="chat-input"[^>]*rows="1"/);
    assert.equal(/<input[^>]*id="chat-input"/.test(html), false, '#chat-input must be <textarea>, not <input>');
    assert.ok(html.includes('max-h-[140px]') && html.includes('resize-none'));
    assert.ok(mainJs.includes('function autoResizeChatInput('));
    assert.ok(mainJs.includes('Math.min(el.scrollHeight, 140)'));
    assert.ok(mainJs.includes("e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229"));

    // 2. Direct #btn-draw-3 without modal popup + Stage 2 presets intact
    assert.ok(html.includes('id="btn-draw-3"'));
    assert.ok(html.includes('id="ledger-spread3-box"'));
    assert.ok(html.includes('id="ledger-spread3-options"'));
    assert.equal(mainJs.includes('openSpread3Modal'), false);
    assert.ok(mainJs.includes('inferSpread3PresetForQuestion'));
    assert.ok(mainJs.includes('startSpread3DrawWithOptions'));

    // 3. Settings 3D Graphics Quality selector + backdrop-filter low-perf CSS
    const settingsStart = html.indexOf('id="modal-settings"');
    const settingsEnd = html.indexOf('</dialog>', settingsStart);
    assert.ok(settingsStart !== -1 && settingsEnd > settingsStart);
    const settingsHtml = html.slice(settingsStart, settingsEnd);
    for (const q of ['auto', 'high', 'low']) {
      assert.match(settingsHtml, new RegExp(`class="quality-btn[^"]*"|data-quality="${q}"`));
      assert.ok(settingsHtml.includes(`data-quality="${q}"`), `#modal-settings must include data-quality="${q}" button`);
    }
    assert.ok(html.includes('html[data-sati-perf="low"] .panel-glass'));
    assert.ok(html.includes('backdrop-filter: none'));

    // 4. Chunked gallery & rAF-coalesced SSE streaming in main.js
    assert.ok(mainJs.includes('galleryRenderToken') && mainJs.includes('CHUNK_SIZE = 8'));
    assert.ok(mainJs.includes('createSatiStreamHandler') && mainJs.includes('scheduleRaf'));

    // 5. Storage persistence for graphicsQuality
    assert.equal(storage.normalizeGraphicsQuality('high'), 'high');
    assert.equal(storage.normalizeGraphicsQuality('low'), 'low');
    assert.equal(storage.normalizeGraphicsQuality('unknown'), 'auto');
    assert.equal(storage.readSavedGraphicsQuality(), 'auto');
    assert.equal(storage.persistGraphicsQuality('low'), 'low');
    assert.equal(storage.readSavedGraphicsQuality(), 'low');
    assert.equal(storage.buildStoragePayload({ user: {} }).graphicsQuality, 'auto');
    assert.equal(storage.buildStoragePayload({ user: {}, graphicsQuality: 'high' }).graphicsQuality, 'high');

    const origFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => {
        throw new Error('offline');
      };
      const st = createMockState({
        sessionActive: true,
        graphicsQuality: 'high',
        user: { email: 'sc10@example.com', nickname: 'บอม' }
      });
      await storage.saveAccountState(st);
      const loaded = await storage.loadAccountState('sc10@example.com');
      assert.equal(loaded?.graphicsQuality, 'high');
      await storage.clearAccountState('sc10@example.com');
    } finally {
      globalThis.fetch = origFetch;
    }

    // 6. Localized i18n keys for th/en/zh
    for (const lang of ['th', 'en', 'zh']) {
      for (const key of ['settingsQualityLabel', 'qualityAuto', 'qualityHigh', 'qualityLow', 'btnDraw3', 'drawGateLockedHint']) {
        const val = translations.t(lang, key);
        assert.ok(typeof val === 'string' && val.trim().length > 0, `Missing ${lang}.${key}`);
        assert.equal(EMOJI_RE.test(val), false, `Translation ${lang}.${key} must not contain Unicode emojis`);
      }
    }

    // 7. Strict Zero-Emoji Check across upgraded production files
    const targetFiles = [
      'index.html',
      'src/main.js',
      'src/i18n/translations.js',
      'src/engine/storage.js',
      'src/scene/satiScene3D.js',
      'backend/geminiProxyServer.js'
    ];
      for (const relPath of targetFiles) {
      const content = fs.readFileSync(path.join(PROJECT_ROOT, relPath), 'utf8');
      const hits = findEmojiLines(content, relPath);
      assert.deepEqual(hits, [], `${relPath} must contain zero Unicode emojis, found:\n${hits.join('\n')}`);
    }
  });

  it('SC-10-04: Unified 4x19 random question picker, single-row #expand-prev-bar, and removed #table-tap-hint work cleanly with zero emojis', () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
    const mainJs = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');

    // 1. Removed #table-tap-hint & single-row inline #expand-prev-bar
    assert.equal(html.includes('id="table-tap-hint"'), false, '#table-tap-hint must be removed per user feedback');
    assert.match(html, /id="expand-prev-bar"[^>]*flex-row items-center justify-between/);
    assert.match(html, /id="expand-prev-text"[^>]*min-w-0 flex-1/);

    // 2. Unified Random Question Picker + Collapsible Drawer + Re-roll
    assert.ok(html.includes('id="random-prompt-wrap"'));
    assert.ok(html.includes('id="preset-category-drawer"'));
    assert.ok(html.includes('id="btn-random-prompt-toggle"'));
    assert.ok(html.includes('id="btn-reroll-prompt"'));
    assert.ok(mainJs.includes('rollRandomQuestionForCategory'));
    assert.ok(mainJs.includes('syncRandomPromptUI'));

    // 3. 19 unique curated questions per category across th / en / zh (zero emojis)
    for (const lang of ['th', 'en', 'zh']) {
      const pack = translations.getTextPack(lang);
      const map = pack.smartPromptsByTopic || {};
      for (const cat of ['love', 'work', 'money', 'general']) {
        const list = map[cat] || [];
        assert.ok(list.length >= 19, `Expected >= 19 prompts for ${lang}.${cat}, got ${list.length}`);
        const uniqueQuestions = new Set(list.map((q) => String(q.question || '').trim()).filter(Boolean));
        assert.equal(uniqueQuestions.size, list.length, `All questions in ${lang}.${cat} must be unique and non-empty`);
        for (const item of list) {
          assert.equal(EMOJI_RE.test(item.label), false, `Emoji found in label ${lang}.${cat}: ${item.label}`);
          assert.equal(EMOJI_RE.test(item.question), false, `Emoji found in question ${lang}.${cat}: ${item.question}`);
        }
      }
      for (const key of ['btnRandomPromptMenu', 'btnRerollPrompt', 'archiveModeQuick3Badge', 'archiveModeNatal10Badge', 'toastQuick3Archived']) {
        const val = translations.t(lang, key);
        assert.ok(typeof val === 'string' && val.trim().length > 0, `Missing ${lang}.${key}`);
        assert.equal(EMOJI_RE.test(val), false);
      }
    }
  });

  it('SC-10-05: Daily Quick 3-Card mode saves archive history on exit/reload, prevents resume, and preserves pre-existing 10-card savedNatalCards', async () => {
    const saved10 = deck.slice(0, 10).map((c) => ({ uid: c.uid, name: c.name, suit: c.suit, th: c.th }));
    const quick3Record = {
      user: { email: 'q3@example.com', nickname: 'บอม', day: 25, month: 6, year: 1996 },
      sessionActive: true,
      sessionMode: 'quick3',
      activeSessionId: 'sess_q3_test_1',
      natalCompleted: false,
      natalCards: [],
      savedNatalCards: saved10,
      activeSpread: [{ uid: deck[15].uid, name: deck[15].name }, { uid: deck[16].uid, name: deck[16].name }, { uid: deck[17].uid, name: deck[17].name }],
      discardPile: [{ uid: deck[12].uid, name: deck[12].name }],
      chatHistory: [
        { speaker: 'บอม', role: 'user', text: 'วันนี้การเงินเป็นยังไง' },
        { speaker: 'สติ', role: 'sati', text: 'ภาพรวมคล่องตัวดีมาก', createdAt: '2026-11-27T03:00:00Z' }
      ],
      sessionArchives: [],
      updatedAt: '2026-11-27T03:05:00Z'
    };

    // Quick 3-Card must NEVER resume
    assert.equal(storage.shouldResumeSavedSession(quick3Record), false);

    // 10-Card completed natal session resumes normally
    const natal10Record = {
      ...quick3Record,
      sessionMode: 'natal10',
      natalCompleted: true,
      natalCards: saved10
    };
    assert.equal(storage.shouldResumeSavedSession(natal10Record), true);

    // Archiving Quick 3-Card stores history entry with mode 'quick3', clears active session, preserves savedNatalCards, and stays idempotent
    const { record: archivedOnce, archived } = storage.archiveQuick3SessionIfNeeded(quick3Record);
    assert.equal(archived, true);
    assert.equal(archivedOnce.sessionActive, false);
    assert.equal(archivedOnce.chatHistory.length, 0);
    assert.equal(archivedOnce.activeSpread.length, 0);
    assert.equal(archivedOnce.savedNatalCards.length, 10, 'Pre-existing 10-card savedNatalCards must remain intact');
    assert.equal(archivedOnce.sessionArchives.length, 1);
    assert.equal(archivedOnce.sessionArchives[0].id, 'sess_q3_test_1');
    assert.equal(archivedOnce.sessionArchives[0].mode, 'quick3');
    assert.equal(archivedOnce.sessionArchives[0].usedCount, 4);

    // Repeating on already archived record does not duplicate
    const { record: archivedTwice, archived: secondFlag } = storage.archiveQuick3SessionIfNeeded(archivedOnce);
    assert.equal(secondFlag, false);
    assert.equal(archivedTwice.sessionArchives.length, 1);

    // buildStoragePayload preserves sessionMode & activeSessionId
    const pQ3 = storage.buildStoragePayload({ user: {}, sessionMode: 'quick3', activeSessionId: 'abc_123' });
    assert.equal(pQ3.sessionMode, 'quick3');
    assert.equal(pQ3.activeSessionId, 'abc_123');
    assert.equal(storage.buildStoragePayload({ user: {} }).sessionMode, 'natal10');

    // Quick 3-Card daily mode must hide & guard #btn-draw-10-opt ("เปิดผังใหญ่ 10 ใบ")
    const mainJs = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
    assert.ok(mainJs.includes("const show10Opt = state.sessionMode !== 'quick3'"));
    assert.ok(mainJs.includes("const canDraw10 = state.sessionMode !== 'quick3'"));
    assert.ok(mainJs.includes("if (state.sessionMode === 'quick3') return;"));
  });

  it('SC-10-06: Window resize updates cached viewport after renderer.setSize and transparent HUD containers do not block 3D card clicks', async () => {
    const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');

    const extractClassAttr = (id) => {
      const m = html.match(new RegExp(`id="${id}"[^>]*class="([^"]*)"`));
      return m ? m[1] : '';
    };

    const speechWrapCls = extractClassAttr('sati-speech-wrap');
    const dialogueBoxCls = extractClassAttr('dialogue-box');
    const footerCls = extractClassAttr('game-footer');
    const stripCls = extractClassAttr('active-cards-strip');
    const toggleDockCls = extractClassAttr('btn-toggle-dock');
    const actionDockCls = extractClassAttr('action-dock');

    assert.equal(/\bpointer-auto\b/.test(speechWrapCls), false, '#sati-speech-wrap wrapper must NOT have pointer-auto');
    assert.ok(/\bpointer-events-none\b/.test(speechWrapCls), '#sati-speech-wrap must pass pointer events through padding');
    assert.ok(/\bpointer-auto\b/.test(dialogueBoxCls), '#dialogue-box must keep pointer-auto');

    assert.equal(/\bpointer-auto\b/.test(footerCls), false, '#game-footer must NOT have pointer-auto over empty fan space');
    assert.ok(/\bpointer-events-none\b/.test(footerCls), '#game-footer must use pointer-events-none');
    assert.ok(/\bpointer-auto\b/.test(stripCls), '#active-cards-strip must keep pointer-auto');
    assert.ok(/\bpointer-auto\b/.test(toggleDockCls), '#btn-toggle-dock must keep pointer-auto');
    assert.ok(/\bpointer-auto\b/.test(actionDockCls), '#action-dock must keep pointer-auto');

    const prevW = globalThis.window.innerWidth;
    const prevH = globalThis.window.innerHeight;
    const prevDocElement = globalThis.document.documentElement;
    const prevWinRaf = globalThis.window.requestAnimationFrame;
    const prevWinCancelRaf = globalThis.window.cancelAnimationFrame;
    const prevGlobalRaf = globalThis.requestAnimationFrame;
    const prevGlobalCancelRaf = globalThis.cancelAnimationFrame;

    const rafQueue = new Map();
    let rafSeq = 1;
    const manualRaf = (cb) => {
      const id = rafSeq++;
      rafQueue.set(id, cb);
      return id;
    };
    const manualCancelRaf = (id) => {
      rafQueue.delete(id);
    };
    const stepOneFrame = () => {
      const first = rafQueue.entries().next().value;
      if (!first) return false;
      const [id, cb] = first;
      rafQueue.delete(id);
      cb(performance.now());
      return true;
    };

    const capturedSetCamera = [];
    const origSetFromCamera = THREE.Raycaster.prototype.setFromCamera;
    THREE.Raycaster.prototype.setFromCamera = function (coords, cam) {
      capturedSetCamera.push({ x: coords.x, y: coords.y, cam });
      return origSetFromCamera.call(this, coords, cam);
    };
    const raycastSpy = spyOn(THREE.Raycaster.prototype, 'intersectObjects');

    let engine = null;
    try {
      globalThis.document.documentElement = { dataset: {} };
      globalThis.window.requestAnimationFrame = manualRaf;
      globalThis.window.cancelAnimationFrame = manualCancelRaf;
      globalThis.requestAnimationFrame = manualRaf;
      globalThis.cancelAnimationFrame = manualCancelRaf;
      globalThis.window.innerWidth = 800;
      globalThis.window.innerHeight = 600;

      const canvas = createTestCanvas(800, 600);
      canvas.getBoundingClientRect = () => {
        const sw = parseFloat(canvas.style.width);
        const sh = parseFloat(canvas.style.height);
        return {
          left: 0,
          top: 0,
          width: Number.isFinite(sw) ? sw : 800,
          height: Number.isFinite(sh) ? sh : 600
        };
      };

      const state = createMockState({
        screen: 'game',
        isPicking: true,
        cameraMode: '2P',
        remainingDeck: [...deck]
      });

      const picked = [];
      engine = createSati3DEngine({
        canvas,
        state,
        onCardPicked: (mesh) => picked.push(mesh)
      });
      engine.setCameraTarget(CAM_POS.view2P, CAM_POS.view2PLook);
      engine.spawn78CardFan();

      // Resize window from 800x600 -> 1600x900 (THREE renderer.setSize updates style.width/height inside resize)
      simulateResize(1600, 900);
      for (let i = 0; i < 6; i += 1) stepOneFrame();

      capturedSetCamera.length = 0;
      simulatePointerEvent(canvas, 'pointerdown', 1200, 675);
      assert.ok(capturedSetCamera.length >= 1, 'Expected raycaster.setFromCamera call on pointerdown');
      const lastCall = capturedSetCamera[capturedSetCamera.length - 1];
      assert.ok(Math.abs(lastCall.x - 0.5) < 1e-6, `Expected NDC x=0.5 after 1600x900 resize, got ${lastCall.x}`);
      assert.ok(Math.abs(lastCall.y - (-0.5)) < 1e-6, `Expected NDC y=-0.5 after 1600x900 resize, got ${lastCall.y}`);

      // Project center fan card into 1600x900 pixel coordinates and click it directly
      const fanMeshes = engine.getFanCardMeshes();
      fanMeshes.forEach((m) => m.updateMatrixWorld(true));
      const targetCard = fanMeshes[39];
      const projected = targetCard.position.clone().project(lastCall.cam);
      const cardPxX = (projected.x * 0.5 + 0.5) * 1600;
      const cardPxY = (-projected.y * 0.5 + 0.5) * 900;

      picked.length = 0;
      simulatePointerEvent(canvas, 'pointerdown', cardPxX, cardPxY);
      assert.equal(picked.length, 1, 'Clicking projected 3D fan card position after resize must invoke onCardPicked');

      // Hover over card then move onto a .pointer-auto UI element: hover clears and skips synchronous/rAF raycasts
      simulatePointerEvent(canvas, 'pointermove', cardPxX, cardPxY);
      assert.equal(stepOneFrame(), true);
      const callsBeforeUiHover = raycastSpy.calls.length;

      globalThis.window.dispatchEvent({
        type: 'pointermove',
        clientX: cardPxX,
        clientY: cardPxY,
        target: { closest: (sel) => (sel === '.pointer-auto' ? {} : null) },
        preventDefault: () => {},
        stopPropagation: () => {}
      });
      assert.equal(raycastSpy.calls.length, callsBeforeUiHover, 'Blocked pointermove must not synchronously raycast');
      assert.equal(stepOneFrame(), true);
      assert.equal(raycastSpy.calls.length, callsBeforeUiHover, 'rAF hover raycast must skip when pointer is over .pointer-auto UI');
    } finally {
      if (engine) engine.dispose();
      THREE.Raycaster.prototype.setFromCamera = origSetFromCamera;
      raycastSpy.restore();
      globalThis.window.innerWidth = prevW;
      globalThis.window.innerHeight = prevH;
      if (prevDocElement === undefined) delete globalThis.document.documentElement;
      else globalThis.document.documentElement = prevDocElement;
      globalThis.window.requestAnimationFrame = prevWinRaf;
      globalThis.window.cancelAnimationFrame = prevWinCancelRaf;
      globalThis.requestAnimationFrame = prevGlobalRaf;
      globalThis.cancelAnimationFrame = prevGlobalCancelRaf;
    }
  });
});
