/**
 * SATI Backend Proxy Server & State Persistence (Node.js / Express + @google/genai Interactions API)
 * - ใช้โมเดลปัจจุบัน `gemini-3.8-flash` ผ่าน `ai.interactions.create()` ตามมาตรฐาน SDK ล่าสุด
 * - เก็บ GEMINI_API_KEY ไว้ฝั่งเซิร์ฟเวอร์อย่างปลอดภัย (ผู้ใช้ไม่ต้องกรอก API Key เอง)
 * - หากยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ จะส่งสัญญาณ fallback ให้ฝั่ง Client ใช้สมองทักษา satiBrain.js อัตโนมัติ
 * - มีระบบบันทึกข้อมูลผูกกับ Gmail ลงฐานข้อมูลไฟล์ (backend/data/users_db.json) พร้อมซิงค์กับ LocalStorage
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { GoogleGenAI } from '@google/genai';
import { hydrateDeckCards } from '../src/data/tarot78.js';
import { getLocalizedCardData } from '../src/data/tarot78I18n.js';
import { computeAnnualThaksa, computeAstroCardIntersection, detectTopicAndIntent } from '../src/engine/satiBrain.js';
import {
  analyzePositionalElementalDignity,
  getDecanTimingProfile,
  diagnoseReversedCard,
  analyzeSpreadCausalDynamics,
  selectDomainThaksaFocus
} from '../src/engine/divinationScience.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'users_db.json');
const FEEDBACK_FILE = path.join(DB_DIR, 'feedback_db.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const ENV_FILE = path.join(__dirname, '..', '.env');
export const PRIMARY_GEMINI_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_MODEL_ORDER = [
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-4-hydrogen',
  'gemini-3.6-flash'
];
const COOLDOWN_ERROR_RE = /429|RESOURCE_EXHAUSTED|quota|503|UNAVAILABLE|DEADLINE_EXCEEDED|high[\s-]+demand/i;
const modelCooldownUntil = new Map();

export function resolveThinkingConfigForRequest(body = {}, model = PRIMARY_GEMINI_MODEL) {
  const safeBody = body && typeof body === 'object' ? body : {};
  const spreadArr = Array.isArray(safeBody.activeSpread) && safeBody.activeSpread.length > 0
    ? safeBody.activeSpread
    : (Array.isArray(safeBody.cards) ? safeBody.cards : []);
  const isTenCard = Boolean(safeBody.isNatal10) || spreadArr.length >= 10;
  const qText = String(safeBody.question || '').trim();
  const intent = safeBody.questionProfile?.intent || '';
  const isDecision = intent === 'decision'
    || /(ควร.*หรือ|ดีไหม\s*หรือ|ย้าย.*หรือ.*อยู่ต่อ|ลาออก.*หรือ|เลือกทางไหน|ระหว่าง.*กับ|should i .* or |stay or |switch or |还是|或者)/i.test(qText);
  const hasCalibCorrection = Array.isArray(safeBody.calibrationFeedback)
    && safeBody.calibrationFeedback.some((c) => c && c.verdict === 'inaccurate');
  const isComplexQuery = qText.length >= 110 && /(และ|แต่|เพราะ|หรือ|ส่วน|ขณะที่|however|because|although)/i.test(qText);

  const thinkingLevel = (isTenCard || isDecision || hasCalibCorrection || isComplexQuery) ? 'medium' : 'low';
  const isMedium = thinkingLevel === 'medium';
  const m = String(model || PRIMARY_GEMINI_MODEL);
  const isGemini4 = /^gemini-4/i.test(m);
  const isFlashLite = /flash-lite/i.test(m);
  const maxOutputTokens = isGemini4
    ? (isMedium ? 4096 : 2600)
    : isFlashLite
      ? (isMedium ? 3600 : 2400)
      : (isMedium ? 3200 : 1800);
  const thinkingBudget = isGemini4 ? undefined : (isMedium ? 1024 : 384);
  const reason = isTenCard
    ? '10_card_spread'
    : isDecision
      ? 'major_decision'
      : hasCalibCorrection
        ? 'calibration_correction'
        : isComplexQuery
          ? 'complex_query'
          : 'fast_query';

  return {
    tier: thinkingLevel,
    thinkingLevel,
    maxOutputTokens,
    ...(thinkingBudget !== undefined ? { thinkingBudget } : {}),
    reason
  };
}

export function buildModelGenerateConfig(model = PRIMARY_GEMINI_MODEL, systemInstruction = SATI_SYSTEM_PROMPT, routingOptions = undefined) {
  const m = String(model || PRIMARY_GEMINI_MODEL);
  const config = { systemInstruction };
  const hasRouting = Boolean(routingOptions && typeof routingOptions === 'object');
  const level = hasRouting && (routingOptions.thinkingLevel === 'high' || routingOptions.thinkingLevel === 'medium')
    ? routingOptions.thinkingLevel
    : 'low';
  const isDeep = level === 'medium' || level === 'high';

  if (/^gemini-4/i.test(m)) {
    config.maxOutputTokens = hasRouting
      ? (Number(routingOptions.maxOutputTokens) || (level === 'high' ? 6144 : isDeep ? 4096 : 2600))
      : 2600;
    config.thinkingConfig = { thinkingLevel: level };
  } else {
    const isFlashLite = /flash-lite/i.test(m);
    const defaultMaxTokens = isFlashLite
      ? (isDeep ? 3600 : 2400)
      : (isDeep ? 3200 : 1800);
    config.maxOutputTokens = hasRouting
      ? (Number(routingOptions.maxOutputTokens) || defaultMaxTokens)
      : defaultMaxTokens;
    if (!/^gemini-3\.[5-9]/i.test(m)) {
      config.temperature = 0.8;
    }
    config.thinkingConfig = {
      thinkingBudget: hasRouting
        ? (Number(routingOptions.thinkingBudget) || (isDeep ? 1024 : 384))
        : 384
    };
  }
  return config;
}

export function isModelOnCooldown(model, now = Date.now()) {
  const until = modelCooldownUntil.get(model) || 0;
  if (until > now) return true;
  if (until > 0) modelCooldownUntil.delete(model);
  return false;
}

export function markModelQuotaCooldown(model, errMsg = '', now = Date.now()) {
  const msg = String(errMsg || '');
  const isDaily = /perday|daily|rpd/i.test(msg);
  const isTransient = /503|UNAVAILABLE|DEADLINE_EXCEEDED|high[\s-]+demand/i.test(msg);
  const ttlMs = isDaily ? 15 * 60_000 : (isTransient ? 30_000 : 60_000);
  modelCooldownUntil.set(model, now + ttlMs);
  return now + ttlMs;
}

export function resetModelCooldownForTest() {
  modelCooldownUntil.clear();
}
const READ_RATE_LIMIT_WINDOW_MS = 60_000;
const READ_RATE_LIMIT_MAX = 20;
const STATE_RATE_LIMIT_MAX = 60;
const FEEDBACK_RATE_LIMIT_MAX = 8;
const MAX_STATE_RECORD_BYTES = 350_000;
const MAX_STATE_ARCHIVES = 25;
const MAX_STATE_CHAT_HISTORY = 120;
const MAX_DB_ACCOUNTS = 500;
const MAX_FEEDBACK_ENTRIES = 500;

function createSlidingWindowLimiter(defaultLimit, defaultWindowMs) {
  const buckets = new Map();
  return {
    check(ipKey, now = Date.now(), limit = defaultLimit, windowMs = defaultWindowMs) {
      const key = String(ipKey || 'unknown').trim() || 'unknown';
      if (buckets.size > 500) {
        for (const [k, stamps] of buckets.entries()) {
          const fresh = stamps.filter((t) => now - t < windowMs);
          if (fresh.length === 0) buckets.delete(k);
          else buckets.set(k, fresh);
        }
      }
      const existing = (buckets.get(key) || []).filter((t) => now - t < windowMs);
      if (existing.length >= limit) {
        buckets.set(key, existing);
        return { allowed: false, remaining: 0 };
      }
      existing.push(now);
      buckets.set(key, existing);
      return { allowed: true, remaining: Math.max(0, limit - existing.length) };
    },
    reset() {
      buckets.clear();
    }
  };
}

const readLimiter = createSlidingWindowLimiter(READ_RATE_LIMIT_MAX, READ_RATE_LIMIT_WINDOW_MS);
const stateLimiter = createSlidingWindowLimiter(STATE_RATE_LIMIT_MAX, READ_RATE_LIMIT_WINDOW_MS);
const feedbackLimiter = createSlidingWindowLimiter(FEEDBACK_RATE_LIMIT_MAX, READ_RATE_LIMIT_WINDOW_MS);

export function checkReadRateLimit(ipKey, now = Date.now(), limit = READ_RATE_LIMIT_MAX, windowMs = READ_RATE_LIMIT_WINDOW_MS) {
  return readLimiter.check(ipKey, now, limit, windowMs);
}

export function resetReadRateLimitForTest() {
  readLimiter.reset();
}

export function checkStateRateLimit(ipKey, now = Date.now(), limit = STATE_RATE_LIMIT_MAX, windowMs = READ_RATE_LIMIT_WINDOW_MS) {
  return stateLimiter.check(ipKey, now, limit, windowMs);
}

export function resetStateRateLimitForTest() {
  stateLimiter.reset();
}

export function checkFeedbackRateLimit(ipKey, now = Date.now(), limit = FEEDBACK_RATE_LIMIT_MAX, windowMs = READ_RATE_LIMIT_WINDOW_MS) {
  return feedbackLimiter.check(ipKey, now, limit, windowMs);
}

export function resetFeedbackRateLimitForTest() {
  feedbackLimiter.reset();
}

fs.mkdirSync(DB_DIR, { recursive: true });

function loadProjectEnv() {
  try {
    if (!fs.existsSync(ENV_FILE)) return;
    const raw = fs.readFileSync(ENV_FILE, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
      if (k && v && !process.env[k]) {
        process.env[k] = v;
      }
    }
  } catch {
    // ignore malformed .env file
  }
}

loadProjectEnv();

export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function createGeminiClient(apiKey, options = {}) {
  if (typeof options?.createAiClient === 'function') {
    return options.createAiClient(apiKey);
  }
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: 16000 } });
}

function getCandidateGeminiModels() {
  const activeOrder = GEMINI_MODEL_ORDER.filter((m) => !isModelOnCooldown(m));
  return activeOrder.length > 0 ? activeOrder : GEMINI_MODEL_ORDER;
}

function resolveClientIp(req) {
  const fwd = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.ip || req.socket?.remoteAddress || 'unknown';
}

function writeSseEvent(res, eventName, payload) {
  if (!res || res.writableEnded || res.destroyed) return false;
  try {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeStateRecordForStorage(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return {};
  const clean = { ...record };
  if (Array.isArray(clean.sessionArchives) && clean.sessionArchives.length > MAX_STATE_ARCHIVES) {
    clean.sessionArchives = clean.sessionArchives.slice(0, MAX_STATE_ARCHIVES);
  }
  if (Array.isArray(clean.chatHistory) && clean.chatHistory.length > MAX_STATE_CHAT_HISTORY) {
    clean.chatHistory = clean.chatHistory.slice(-MAX_STATE_CHAT_HISTORY);
  }
  return clean;
}

export function pruneUsersDbMap(db, maxAccounts = MAX_DB_ACCOUNTS) {
  if (!db || typeof db !== 'object') return {};
  const entries = Object.entries(db);
  if (entries.length <= maxAccounts) return db;
  entries.sort((a, b) => {
    const ta = Date.parse(a[1]?.updatedAt || 0) || 0;
    const tb = Date.parse(b[1]?.updatedAt || 0) || 0;
    return tb - ta;
  });
  return Object.fromEntries(entries.slice(0, maxAccounts));
}

function readJsonFileSafe(targetFile, fallback) {
  try {
    if (fs.existsSync(targetFile)) {
      return JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    }
  } catch {
    // ignore corrupt file and return fallback
  }
  return fallback;
}

async function atomicWriteJsonFile(targetFile, data) {
  const json = JSON.stringify(data, null, 2);
  const dir = path.dirname(targetFile);
  await fs.promises.mkdir(dir, { recursive: true });
  const tmpFile = `${targetFile}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(tmpFile, json, 'utf8');
  try {
    await fs.promises.rename(tmpFile, targetFile);
  } catch {
    await fs.promises.writeFile(targetFile, json, 'utf8');
    await fs.promises.unlink(tmpFile).catch(() => {});
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function resolveFeedbackEmailConfig() {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const to = String(process.env.FEEDBACK_NOTIFY_EMAIL || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || 'SATI Tarot <onboarding@resend.dev>').trim();
  const adminKey = String(process.env.FEEDBACK_ADMIN_KEY || '').trim();
  return { apiKey, to, from, adminKey };
}

export async function sendFeedbackNotificationEmail(entry, fetchImpl = fetch) {
  const { apiKey, to, from } = resolveFeedbackEmailConfig();
  if (!apiKey || !to) {
    return { sent: false, reason: 'EMAIL_NOT_CONFIGURED' };
  }

  const stars = '★'.repeat(entry.rating) + '☆'.repeat(5 - entry.rating);
  const bkkTime = new Date(entry.createdAt || Date.now()).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const tagsText = entry.tags?.length ? entry.tags.join(', ') : '-';
  const subject = `[SATI Feedback ${stars} ${entry.rating}/5] จาก "${entry.nickname}"`;
  const text = [
    `มีฟีดแบ็กใหม่จากเว็บ SATI — สำรับแห่งสติ`,
    `ผู้ส่ง: ${entry.nickname} (${entry.lang})`,
    `คะแนน: ${stars} (${entry.rating}/5)`,
    `หัวข้อ/แท็ก: ${tagsText}`,
    `เวลา: ${bkkTime}`,
    '',
    `ข้อความ:`,
    entry.comment || '(ไม่ได้พิมพ์ข้อความเพิ่มเติม)'
  ].join('\n');

  const tagsHtml = entry.tags?.length
    ? entry.tags.map((tg) => `<span style="display:inline-block;padding:4px 10px;margin:2px 4px 2px 0;border-radius:4px;background:#fef3c7;color:#92400e;font-size:12px;">#${escapeHtml(tg)}</span>`).join('')
    : '<span style="color:#6b7280;font-size:12px;">ไม่ได้เลือกแท็ก</span>';

  const html = `
    <div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:560px;margin:0 auto;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#0f172a;">
      <div style="border-bottom:2px solid #d4af37;padding-bottom:12px;margin-bottom:16px;">
        <h2 style="margin:0;font-size:18px;color:#1e293b;">SATI — ฟีดแบ็กใหม่จากผู้ใช้งาน</h2>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">${escapeHtml(bkkTime)} (เวลาไทย)</div>
      </div>
      <p style="margin:0 0 8px;"><strong>ผู้ส่ง:</strong> ${escapeHtml(entry.nickname)} <span style="color:#64748b;font-size:12px;">(${escapeHtml(entry.lang)})</span></p>
      <p style="margin:0 0 12px;"><strong>คะแนน:</strong> <span style="color:#b45309;font-size:16px;letter-spacing:1px;">${stars}</span> (${entry.rating}/5)</p>
      <div style="margin:0 0 14px;"><strong>หมวดที่เลือก:</strong><div style="margin-top:6px;">${tagsHtml}</div></div>
      <div style="padding:14px;background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;white-space:pre-line;line-height:1.6;">${escapeHtml(entry.comment || '(ไม่ได้พิมพ์ข้อความเพิ่มเติม)')}</div>
      <p style="margin:16px 0 0;font-size:11px;color:#94a3b8;">ส่งอัตโนมัติจากระบบ SATI Feedback Notification</p>
    </div>
  `.trim();

  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text
      })
    });
    const resBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { sent: false, reason: resBody?.message || `HTTP_${res.status}` };
    }
    return { sent: true, id: resBody?.id || '' };
  } catch (err) {
    return { sent: false, reason: err?.message || 'EMAIL_NETWORK_ERROR' };
  }
}

export const SATI_SYSTEM_PROMPT = `คุณคือ "สติ" นักอ่านไพ่และที่ปรึกษาชีวิตระดับปรมาจารย์ที่สุภาพ อบอุ่น จริงใจ และพูดตรงประเด็น เชี่ยวชาญทั้งโหราศาสตร์ทักษาไทย จักรราศี และไพ่ทาโรต์ Rider-Waite 78 ใบตามหลัก Golden Dawn
สรรพนามและน้ำเสียงบังคับ:
- แทนตัวเองว่า "สติ" หรือ "เรา" เสมอ และเรียกผู้ถามด้วยชื่อเล่น (เช่น "บอม") อย่างสุภาพ เป็นกันเองแบบกัลยาณมิตรที่หวังดี
- คงบุคลิกเป็นกลางทางเพศด้วยคำลงท้ายธรรมชาติอย่าง "นะ" หรือ "เลย" (หลีกเลี่ยงการใช้คำลงท้าย "ครับ" หรือ "ค่ะ" สลับเพศผิดกับผู้ถาม เพื่อความสม่ำเสมอสำหรับทุกคน)
- ห้ามใช้คำหยาบ คำสบถ ภาษาห้วนก้าวร้าว หรือสรรพนาม กู มึง แม่ง วะ เว้ย โว้ย ไอ้ อี เอ็ง ข้า เด็ดขาด (ไม่ตอบแบบนักเลงหรือเพื่อนหยาบคาย)
- ปรับน้ำเสียงและมุมมองให้สมวัยและเข้ากับบริบทจริงของผู้ถาม (อายุ ช่วงวัย และข้อเท็จจริงชีวิตที่ผู้ถามเล่า) อย่าใช้บทผู้ใหญ่วัยกลางคนคุยกับเด็กมหาลัย หรือกลับกัน

หลักความแม่นยำตามคำถามและกรอบคำตอบ (Question-First & Sub-Domain Lock):
- อ่าน <question_focus> และกรอบคำตอบบังคับก่อนเสมอ แล้วโฟกัสให้ตรงหมวดคำถาม (subDomain) เพียงเรื่องเดียว ห้ามหลุดไปเรื่องอื่น:
  * study (เรียน/สอบ/ทุน): โฟกัสการเตรียมตัว วิธีแบ่งเวลา จุดอ่อนเนื้อหา และแรงกดดันในห้องสอบ
  * health (สุขภาพ/พักผ่อน): พูดเรื่องพลังงาน การฟื้นตัว พฤติกรรมเสี่ยง และเตือนตรวจสุขภาพกับแพทย์จริงเมื่อมีอาการ ไม่วินิจฉัยโรคแทนหมอ
  * family (ครอบครัว/พ่อแม่/ญาติ): โฟกัสความห่วงใยและบทบาทในบ้าน ห้ามตีความเป็นเรื่องรักชู้สาวหรือคนคุยเด็ดขาด
  * property (บ้าน/ที่อยู่/รถ): ดูความคุ้มค่า สัญญา ทำเล ค่าใช้จ่ายแฝง และความพร้อมระยะยาว
  * work / money / love / self: วิเคราะห์ตรงตามโลกความจริงและเงื่อนไขชีวิตของเรื่องนั้นๆ
- ปรับรูปทรงคำตอบตามเจตนาคำถาม (intent) ให้คมตั้งแต่ประโยคแรก:
  * outcome (ได้ไหม/รอดไหม/ทักมาไหม): ฟันธงแนวโน้มความน่าจะเป็นตั้งแต่ย่อหน้าแรก พร้อมระบุเงื่อนไขจริงที่จะทำให้สำเร็จหรือสะดุด
  * decision (A หรือ B / ควรไหม): เทียบ Trade-off ของทั้งสองทางตรงๆ แล้วชี้ฝั่งที่ได้เปรียบกว่าอย่างชัดเจน
  * other_person (เขาคิดยังไง): แยกให้ออกว่าอีกฝ่ายคือคนรัก/คนคุย เจ้านาย/ลูกค้า หรือคนในบ้าน แล้วอ่านท่าทีอีกฝ่ายควบคู่จุดที่ผู้ถามควรวางตัว
  * timing (เมื่อไหร่/อีกนานไหม): ระบุกรอบเวลาโดยประมาณจาก Decan/ธาตุไพ่และแรงหน่วงกลับหัว พร้อมจุดสังเกตที่เกิดขึ้นจริง
  * why / action: ชี้ต้นตอคอขวดที่ขวางอยู่จริงหรือลำดับก้าวที่ลงมือแล้วเห็นผลทันที
  * คำถามกว้างเกินไป (isBroadOpen=true): ตอบแกนหลักที่เห็นจากไพ่บนโต๊ะให้เกิดประโยชน์ทันที แล้วปิดท้ายย่อหน้า 3 ด้วยคำถามสั้นๆ 1 ข้อเพื่อให้ผู้ถามเจาะประเด็นต่อ

กระบวนการวิเคราะห์ศาสตร์พยากรณ์เชิงลึก (คิดวิเคราะห์อย่างเป็นระบบในใจ แล้วถ่ายทอดออกมาเป็นภาษามนุษย์ที่อบอุ่นเข้าใจง่าย ห้ามเขียนเป็นรายงานหรือตำรา):
1. Golden Dawn Positional Elemental Dignity & Causal Arc: ห้ามแปลไพ่ทีละใบแยกขาดจากกัน ให้ดูลำดับเหตุ-ผลข้ามตำแหน่ง (เช่น ใบแรกกดดันหรือตั้งฐาน -> ใบกลางเป็นตัวเชื่อมหรือจุดขัด -> ใบท้ายชี้ผลลัพธ์), สังเกตธาตุไพ่ที่อยู่ติดกัน (ไฟ+ลมเสริมแรงไว / น้ำ+ดินปั้นผลมั่นคง / ไฟ+น้ำขัดกันในใจ / ลม+ดินคิดชนข้อจำกัดจริง), ไพ่ใหญ่ (Major) ที่คุมจุดเปลี่ยนระดับโครงสร้างเทียบกับไพ่ Pip ที่ชี้แรงเสียดทานหน้างาน
2. Court Card Role Clarity: หากคำถามเกี่ยวกับคนอื่น (other_person) ให้ตีความ Court Card เป็นท่าทีและลักษณะจริงของอีกฝ่าย แต่หากถามเรื่องการตัดสินใจหรือลงมือทำ ให้อ่านเป็นบทบาทหรือจุดแข็งที่ผู้ถามต้องหยิบมาใช้
3. 4-Lens Reversed Diagnosis ([กลับหัว / Reversed]): อ่านไพ่กลับหัวอย่างสร้างสรรค์ตามเลนส์จริงของตำแหน่งนั้น (พลังถูกกั้นติดคอขวด / เก็บงำไว้ภายใน / จังหวะถูกหน่วงต้องวางฐานเพิ่ม / หรือแรงตึงล้นเกินที่ปรับลดได้) ชี้ทางแก้ไขที่เจ้าชะตาคุมได้ ห้ามทำนายแบบโชคร้ายตายตัวหรือขู่ให้หมดหวังเด็ดขาด
4. Thai Astrology & Planetary Pair Fusion: ผูกภูมิทักษาจร คู่ดาวไทย (คู่มิตรหนุนทาง / คู่ศัตรูที่ต้องระวังอารมณ์หรือเอกสาร / คู่ธาตุ / คู่สมพล) และเรือนทักษาที่ตรงหมวดคำถาม (ศรีจร เดชจร มูละจร บริวารจร กาลกิณีจร) เข้ากับจังหวะไพ่บนโต๊ะอย่างเป็นธรรมชาติ ห้ามอ้าง "อักษรกาลกิณีในชื่อ" ในทุกคำถามทั่วไป (อ้างถึงเฉพาะรอบเปิดพื้นดวง 10 ใบแรก หรือเมื่อคำถามและหน้าไพ่ฟ้องปมสื่อสาร/ชื่อเสียง/ความขัดแย้งเฉพาะจุดจริงๆ)
5. Anti-Barnum Diagnostic Specificity: ห้ามใช้ประโยคหว่านแหที่ฟังดูตรงกับทุกคนได้หมด (เช่น "ช่วงนี้มีเรื่องให้คิดเยอะ", "ระวังคนรอบข้างพูดไม่จริง", "ภายนอกนิ่งข้างในแบกหนัก", "อดทนรอเดี๋ยวดีเอง") เว้นแต่จะระบุกลไกพฤติกรรมจริงจากหน้าไพ่ที่เชื่อมกับบริบทชีวิตผู้ถาม (userFacts) และการปรับจูน (Calibration) อย่างชัดเจน
6. ห้ามสับสนระหว่างไพ่บนโต๊ะ (<drawn_cards>) กับไพ่พื้นดวง 10 ใบใน <background_context>: เมื่อเปิดไพ่ใหม่ 1-3 ใบ ให้ยึดไพ่ที่เพิ่งจั่วเป็นแกนหลักเสมอ (ใช้พื้นดวงเป็นเพียงพื้นหลังเสริมเบาๆ เท่านั้น)
- กรณีแจ้งว่าเปลี่ยนประเด็น (topicSwitchedFrom): ให้อธิบายสั้นๆ ว่าไพ่บนโต๊ะรอบก่อนเป็นคนละหัวข้อ ระบบจึงดึงไพ่พื้นดวง 10 ใบมาอ่านให้แทน และชวนกดจั่วเพิ่ม 1-3 ใบหากอยากเจาะเรื่องใหม่นี้ให้ลึกขึ้น
- หากมีข้อมูลโครงสร้างไพ่ทั้งชุด (Spread Patterns) หรือความต่อเนื่องจากรอบก่อน (Cross-Session Memory) ให้ร้อยเรียงเข้ากับการอ่านอย่างเป็นธรรมชาติโดยไม่ทวนรายงานเป็นข้อๆ
- กรณีเปิดไพ่ 3 ใบสำหรับคำถามเฉพาะของผู้ถาม (Direct 3-Card Spread): ให้ปรับมุมมองไพ่ 3 ใบให้สอดคล้องกับคำถามนั้นโดยตรง ถ่ายทอดด้วยภาษาที่อบอุ่น เข้าใจความรู้สึกอย่างเป็นธรรมชาติ (เช่น ภาษาไทยที่สุภาพอบอุ่นเมื่อ Target Language เป็นภาษาไทย) พร้อมแนวทางและก้าวถัดไปที่ลงมือทำได้จริง

การปรับความยาวและจังหวะตามโหมดคำถาม (Response Mode Pacing):
- โหมด main_spread (เปิดไพ่ชุดใหม่ + คำถามหลัก หรือพื้นดวง 10 ใบ): คงโครงสร้าง 3 ย่อหน้าสั้นกระชับครบถ้วนตามมาตรฐานด้านล่าง
- โหมด expand_draw (กดจั่วไพ่ขยาย 1 ใบ หรือ 3 ใบจากคำถามเดิม): ตอบสั้นกระชับเพียง 1-2 ย่อหน้าสั้นๆ เจาะเฉพาะมุมใหม่หรือความคืบหน้าที่ไพ่ชุดขยายเปิดเพิ่มทันที ไม่ต้องทวนเกริ่นเรื่องเดิมยาวเหมือนตอนเปิดคำถามหลักรอบแรก
- โหมด same_spread_chat (ถามเจาะต่อบนหน้าไพ่เดิมโดยไม่ได้จั่วไพ่เพิ่ม): ให้ใช้ไพ่ทุกใบบนโต๊ะ ดวงทักษา และบริบททั้งหมดเป็นฐานสังเคราะห์อยู่เบื้องหลังเพื่อความแม่นยำ แต่ตอบสั้นคมแบบคุยแชทสดกับหมอดูเพียง 1 ย่อหน้า (1-3 ประโยคเท่านั้น) เข้าคำตอบของคำถามเจาะจงทันที ห้ามไล่อธิบายความหมายหน้าไพ่ซ้ำ และไม่ต้องเอ่ยชื่อไพ่ (เว้นแต่ผู้ถามถามเจาะตรงๆ ว่าไพ่ใบไหนบอก) ไม่ต้องแถมคำแนะนำยาวหากไม่ได้ถามวิธีแก้ และค่อยตบท้ายเบาๆ 1 ประโยคว่ากดจั่วเพิ่มได้เฉพาะเมื่อคำถามลึกเกินขอบเขตไพ่เดิมหรือระบบแจ้งรอบเจาะลึก

รูปแบบการตอบ: คงโครงสร้าง 3 ย่อหน้าสั้นๆ สำหรับโหมด main_spread (และย่อลงตามโหมด expand_draw / same_spread_chat ที่ระบุใน <question_focus> และ <answer_now>) อ่านจบไว อ่านทะลุใจ และตรงประเด็นโดยไม่เกริ่นน้ำท่วมทุ่ง:
1. ย่อหน้าแรก (อ่านใจ Subtext + ฟันธงตรงคำถาม): จับความรู้สึกหรือปมลึกๆ หลังคำถามอย่างเข้าใจ แล้วฟันธงคำตอบตรงรูปคำถามตั้งแต่ย่อหน้านี้ ทักว่าถามซ้ำเฉพาะเมื่อถามคำถามเดิมแทบจะเหมือนกันภายในสำรับเดียวกันโดยไม่ได้กดขยายคำถามเดิมหรือไม่ได้ถามเจาะต่อเท่านั้น ห้ามทักว่าถามซ้ำเมื่อขึ้นสำรับใหม่หรือเปลี่ยนประเด็น
2. ย่อหน้ากลาง (สำหรับ main_spread — ผูกหน้าไพ่ + กลไกพฤติกรรมจริง + ศาสตร์ทักษาและ Golden Dawn): ห้ามไล่ชื่อไพ่ทั้ง 10 ใบเรียงข้อเหมือนท่องตำรา ให้คัดเฉพาะไพ่แกนหลัก 2–5 ใบที่ส่งแรงปะทะหรือเกื้อหนุนกันมากที่สุด ร้อยเรียงเป็นภาพเหตุ-ผลเดียวเชื่อมกับจังหวะดาวทักษาและข้อเท็จจริงชีวิตที่ผู้ถามเล่า (userFacts) แปลเป็นกลไกที่เกิดขึ้นจริงและจับต้องได้ ห้ามขึ้นบุลเล็ต (• หรือ 1) 2)) และห้ามก๊อปคำซ้ำ (สำหรับ same_spread_chat ให้ข้ามการไล่อธิบายหน้าไพ่ซ้ำทั้งหมด)
3. ย่อหน้าท้าย (ราคาที่ต้องจ่าย + ก้าวแรกที่ลงมือได้วันนี้ — ใช้ใน main_spread หรือเมื่อถามวิธีแก้): ชี้จุดระวังหรือ Trade-off ที่สอดคล้องกับหน้าไพ่จริงอย่างเพื่อนสนิทที่หวังดี ปิดด้วย 1 ก้าวแรกที่เป็นรูปธรรมชัดเจน (หรือ 1 คำถามสั้นชวนเจาะจงหากคำถามกว้างมาก)
4. ข้อห้ามเด็ดขาด: ตอบด้วย Target Language เท่านั้น (ไทย / English / 简体中文) ห้ามใส่อีโมจิ ห้ามใช้เครื่องหมายดอกจัน (** หรือ *) หรือ Markdown ห้ามพิมพ์แท็ก XML ของระบบ ห้ามใช้คำว่า AI เอไอ บอท chatbot จอมเวท ไม่อวย สรุปตรงๆ ห้ามใส่หัวข้อแข็งๆ ห้ามขึ้นต้นหรือลงท้ายซ้ำสำนวนเดิมจากรอบก่อนหน้าเด็ดขาด ห้ามมโนอ้างชื่อไพ่ที่ไม่ได้เปิดอยู่บนโต๊ะตอนนี้ และห้ามปิดท้ายด้วยจำนวนไพ่ที่เหลือในสำรับ เช่น "(เหลือไพ่ในสำรับ XX ใบ)" หรือสอนวิธีใช้งานปุ่มในแอป`;

export function sanitizeStreamChunk(chunkText) {
  if (!chunkText) return '';
  return String(chunkText)
    .replace(/<\/?(?:question_focus|drawn_cards|divination_synthesis|background_context|answer_now)>/gi, '')
    .replace(/\*+/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
}

export function sanitizeSatiText(rawText, lang = 'th') {
  if (!rawText) return '';
  const selfName = lang === 'en' ? 'Sati' : lang === 'zh' ? '思谛' : 'สติ';
  return rawText
    .replace(/<\/?(?:question_focus|drawn_cards|divination_synthesis|background_context|answer_now)>/gi, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/\*+/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\b(AI|เอไอ|บอท|Bot|chatbot)\b/gi, selfName)
    .replace(/จอมเวท/gi, 'หมอดู')
    .replace(/(^|[\s"'(])กู(?=[\s"'.,!?ๆ]|ก็|ว่า|รู้|เห็น|บอก|ขอ|ไม่|อยาก|มอง|$)/g, `$1${selfName}`)
    .replace(/(^|[\s"'(])มึง(?=[\s"'.,!?ๆ]|ก็|จะ|ต้อง|กำลัง|ควร|ไม่|อยาก|ได้|เลย|น่ะ|ล่ะ|$)/g, '$1คุณ')
    .replace(/(?:แม่ง|เหี้ย|สัส|เชี่ย(?!ว))/g, '')
    .replace(/\s+(?:นะ)?(?:วะ|เว้ย|โว้ย)(?=[\s.,!?]|$)/g, 'นะ')
    .replace(/(สติขอเตือนแบบไม่อวยนะ|ให้แบบไม่อวยเลยนะ|เอาตรงๆ\s*ไม่อวยนะ|พูดตรงๆ\s*ไม่อวยนะ|คำตอบกลางๆ\s*แบบไม่อวยคือ|ขอสรุปตรงๆ\s*แบบเพื่อนเลยนะ|สรุปตรงๆ\s*เลยนะ|สรุปตรงๆ\s*:|สิ่งที่ควรทำตอนนี้\s*:|ก้าวแรกตอนนี้\s*:|What to do now\s*:|First step now\s*:|眼下建议直接这样做：|眼下建议：|眼下第一步：|\(\s*เหลือไพ่(?:ในสำรับ)?\s*\d+\s*ใบ\s*\))/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildCompressedHistoryDigest(recentHistory = []) {
  const rows = (Array.isArray(recentHistory) ? recentHistory : []).slice(-16);
  const recentOpenings = [];
  let satiSeen = 0;
  const totalSati = rows.filter((h) => h?.role === 'sati' || ['สติ', 'Sati', '思谛'].includes(h?.speaker)).length;
  const digestLines = rows.map((h) => {
    const cleanText = String(h?.text || '').replace(/\s+/g, ' ').trim();
    const isSati = h?.role === 'sati' || ['สติ', 'Sati', '思谛'].includes(h?.speaker);
    if (isSati) {
      satiSeen += 1;
      if (cleanText) recentOpenings.push(cleanText.slice(0, 55));
      const cardTag = Array.isArray(h?.meta?.cards) && h.meta.cards.length
        ? ` [ไพ่รอบนั้น: ${h.meta.cards.slice(0, 3).map((c) => c.name).join(', ')}]`
        : '';
      const isRecentSati = satiSeen > Math.max(0, totalSati - 2);
      const maxLen = isRecentSati ? 240 : 120;
      return `${h.speaker || 'สติ'}${cardTag}: ${cleanText.slice(0, maxLen)}${cleanText.length > maxLen ? '...' : ''}`;
    }
    return `${h.speaker || 'ผู้ถาม'}: ${cleanText.slice(0, 140)}`;
  }).filter(Boolean);
  return {
    digestText: digestLines.join('\n'),
    recentOpenings: recentOpenings.slice(-2)
  };
}

function resolveExtendedNatalInfo(userProfile = {}) {
  if (userProfile?.age && userProfile?.zodiacSign?.th && userProfile?.chineseZodiac?.th) {
    return {
      age: userProfile.age,
      lifeStageText: userProfile.lifeStageLabel?.th || userProfile.lifeStage || '',
      zodiacText: `${userProfile.zodiacSign.th} (${userProfile.zodiacSign.en}, ธาตุ${userProfile.zodiacSign.elem || ''})`,
      animalText: userProfile.chineseZodiac.th
    };
  }
  const day = parseInt(userProfile?.day, 10);
  const month = parseInt(userProfile?.month, 10);
  const rawYear = parseInt(userProfile?.year, 10);
  if (!day || !month || !rawYear) {
    return { age: null, lifeStageText: '', zodiacText: '', animalText: '' };
  }
  const gYear = rawYear > 2400 ? rawYear - 543 : rawYear;
  const now = new Date();
  let age = now.getFullYear() - gYear;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  const lifeStageText = age < 23
    ? 'วัยเรียน / เริ่มต้นก้าวแรกของชีวิต'
    : age < 30
      ? 'วัยเริ่มทำงาน / ค้นหาและสร้างตัว'
      : age < 40
        ? 'วัยสร้างฐานะ / ขยับขยายความรับผิดชอบ'
        : age < 55
          ? 'วัยกลางคน / วางความมั่นคงระยะยาว'
          : 'วัยผู้ใหญ่เต็มตัว / ตกผลึกประสบการณ์';
  const signs = ['ราศีมังกร', 'ราศีกุมภ์', 'ราศีมีน', 'ราศีเมษ', 'ราศีพฤษภ', 'ราศีเมถุน', 'ราศีกรกฎ', 'ราศีสิงห์', 'ราศีกันย์', 'ราศีตุลย์', 'ราศีพิจิก', 'ราศีธนู'];
  let zIdx = 0;
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) zIdx = 1;
  else if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) zIdx = 2;
  else if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) zIdx = 3;
  else if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) zIdx = 4;
  else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) zIdx = 5;
  else if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) zIdx = 6;
  else if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) zIdx = 7;
  else if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) zIdx = 8;
  else if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) zIdx = 9;
  else if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) zIdx = 10;
  else if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) zIdx = 11;
  const animals = ['ปีวอก', 'ปีระกา', 'ปีจอ', 'ปีกุน', 'ปีชวด', 'ปีฉลู', 'ปีขาล', 'ปีเถาะ', 'ปีมะโรง', 'ปีมะเส็ง', 'ปีมะเมีย', 'ปีมะแม'];
  const czYear = (month === 1 || (month === 2 && day < 5)) ? gYear - 1 : gYear;
  return {
    age: age >= 0 && age <= 120 ? age : null,
    lifeStageText,
    zodiacText: signs[zIdx],
    animalText: animals[((czYear % 12) + 12) % 12]
  };
}

const TH_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];
const EN_MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const TH_WEEKDAYS = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];

function formatRealTimeDateContext(rawNow) {
  const parsed = rawNow ? new Date(rawNow) : new Date();
  const dt = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const yearCE = dt.getUTCFullYear();
  const yearBE = yearCE + 543;
  const monthIdx = dt.getUTCMonth();
  const monthNum = monthIdx + 1;
  const dayNum = dt.getUTCDate();
  const dow = dt.getUTCDay();
  const thMonth = TH_MONTHS_FULL[monthIdx] || '';
  const enMonth = EN_MONTHS_FULL[monthIdx] || '';
  const thWeekday = TH_WEEKDAYS[dow] || '';
  const quarter = Math.floor(monthIdx / 3) + 1;
  return {
    dt,
    line: `วันที่ปัจจุบัน (Real-Time Current Date): ${thWeekday}ที่ ${dayNum} ${thMonth} พ.ศ. ${yearBE} (ค.ศ. ${yearCE}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}, ${enMonth} ${dayNum}, ${yearCE}, ไตรมาส Q${quarter})`
  };
}

function resolveRelevantAspectForDomain(card, loc, topic, subDomain, isNatal10, posIdx, lang = 'th') {
  const pick = (field) => String(loc?.[field] || card?.[field] || '').replace(/\r?\n/g, ' ').trim();
  const labels = lang === 'en'
    ? { work: 'Work', money: 'Money', love: 'Love', advice: 'Advice', study: 'Study', property: 'Property', health: 'Health', family: 'Family' }
    : lang === 'zh'
      ? { work: '事业', money: '财运', love: '感情', advice: '建议', study: '学业', property: '置业', health: '健康', family: '家庭' }
      : { work: 'งาน', money: 'เงิน', love: 'รัก', advice: 'แนะ', study: 'เรียน/งาน', property: 'ทรัพย์/เงิน', health: 'ดูแลตัว', family: 'ครอบครัว' };

  if (isNatal10) {
    if (posIdx === 4) return pick('work') ? `${labels.work}:${pick('work')}` : '';
    if (posIdx === 5) return pick('money') ? `${labels.money}:${pick('money')}` : '';
    if (posIdx === 7) return pick('love') ? `${labels.love}:${pick('love')}` : '';
    return pick('advice') ? `${labels.advice}:${pick('advice')}` : '';
  }
  if (subDomain === 'study') {
    const val = pick('work') || pick('advice');
    return val ? `${labels.study}:${val}` : '';
  }
  if (subDomain === 'property') {
    const val = pick('money') || pick('work');
    return val ? `${labels.property}:${val}` : '';
  }
  if (subDomain === 'health') {
    const val = pick('advice');
    return val ? `${labels.health}:${val}` : '';
  }
  if (subDomain === 'family') {
    const val = pick('advice');
    return val ? `${labels.family}:${val}` : '';
  }
  if (topic === 'work' && pick('work')) return `${labels.work}:${pick('work')}`;
  if (topic === 'money' && pick('money')) return `${labels.money}:${pick('money')}`;
  if (topic === 'love' && pick('love')) return `${labels.love}:${pick('love')}`;
  return pick('advice') ? `${labels.advice}:${pick('advice')}` : '';
}

function selectCompactNatalIndices(topic, intent, qText) {
  if (intent === 'other_person' || /เจ้านาย|หัวหน้า|ลูกค้า|เพื่อนร่วมงาน|คนคุย|แฟน|เขา|เธอ|boss|manager|client|coworker|partner|ex\b|老板|上司|客户|同事|对方|他|她/i.test(qText)) {
    return [7, 8, 9];
  }
  if (intent === 'timing') return [5, 4, 9];
  if (intent === 'why') return [1, 2, 3];
  if (intent === 'action') return [1, 6, 9];
  if (topic === 'work') return [4, 1, 9];
  if (topic === 'money') return [5, 2, 9];
  if (topic === 'love') return [7, 8, 9];
  if (topic === 'self') return [0, 2, 6];
  return [0, 1, 9];
}

function formatCompactNatalBaseline(natalCards, resolvedProfile, qText, isNatal10, celticPositions) {
  if (isNatal10) return '';
  if (!Array.isArray(natalCards) || natalCards.length === 0) {
    return 'ยังไม่เปิดผังพื้นดวง 10 ใบ (ผู้ถามเลือกโหมดเปิดเร็ว — ให้อ่านจากไพ่บนโต๊ะเชื่อมกับข้อมูลเกิดและทักษาชื่อเต็มที่)';
  }
  const indices = natalCards.length >= 10
    ? selectCompactNatalIndices(resolvedProfile.topic, resolvedProfile.intent, qText)
    : natalCards.slice(0, 3).map((_, idx) => idx);
  const uniqueIdx = [...new Set(indices)].filter((i) => i >= 0 && i < natalCards.length && natalCards[i]);
  const parts = uniqueIdx.map((i) => {
    const c = natalCards[i];
    const pos = Array.isArray(celticPositions) && celticPositions[i] ? `${i + 1}.${celticPositions[i]}` : `${i + 1}`;
    return `${pos}=${c?.name || 'Unknown'}${c?.th ? `(${c.th})` : ''}${c?.reversed ? '[กลับหัว]' : ''}`;
  });
  return parts.length
    ? `พื้นดวงเดิมเฉพาะจุดที่เกี่ยว (อ้างอิงเสริมเท่านั้น ห้ามนำมาปนกับไพ่ที่เพิ่งจั่วด้านบน): ${parts.join(', ')}`
    : '';
}

function buildQuestionAnswerContract(profile, isNatal10, spreadCount, hasCustomPositions3, positions3) {
  if (isNatal10) {
    return 'กรอบคำตอบบังคับ: สังเคราะห์ภาพรวมพื้นดวง 10 ใบเป็นเรื่องเดียวกัน (จุดแข็งประจำตัว + ปมอุปสรรค + งาน/เงิน/ปลายทาง) ห้ามไล่เรียง 1-10';
  }
  const sub = profile?.subDomain || profile?.topic || 'general';
  const intent = profile?.intent || 'explain';
  const domainGuards = {
    study: 'โฟกัสการเรียน/สอบ/เตรียมตัว ห้ามหลุดไปเรื่องรักหรือออฟฟิศทั่วไป',
    health: 'โฟกัสพลังกาย การฟื้นตัว พฤติกรรมเสี่ยง และเตือนพบแพทย์หากมีอาการจริง',
    family: 'โฟกัสความห่วงใยและบทบาทในครอบครัว ห้ามตีความเป็นเรื่องชู้สาวหรือคนคุยเด็ดขาด',
    property: 'โฟกัสความคุ้มค่า ทำเล สัญญา และภาระค่าใช้จ่ายแฝงของบ้าน/ที่อยู่/รถ',
    work: 'โฟกัสเนื้องาน บทบาท ความก้าวหน้า และเงื่อนไขจริงในสายงาน',
    money: 'โฟกัสกระแสเงิน รายรับ-รายจ่าย ความเสี่ยง และตัวเลขจริง',
    love: 'โฟกัสความสัมพันธ์ ความรู้สึก และท่าทีจริงระหว่างกัน',
    self: 'โฟกัสสมดุลชีวิต เป้าหมาย และมุมมองส่วนตัวของผู้ถาม',
    general: 'โฟกัสประเด็นหลักตามไพ่ตรงหน้าให้ชัดและตรงคำถาม'
  };
  const intentShapes = {
    outcome: 'ฟันธงแนวโน้มความน่าจะเป็นตั้งแต่ย่อหน้าแรก พร้อมระบุ 1 เงื่อนไขชี้ขาดจากไพ่',
    decision: 'เทียบข้อดี-ข้อเสียและราคาที่ต้องจ่าย (Trade-off) ของสองทางตรงๆ แล้วชี้ฝั่งที่ได้เปรียบกว่า',
    other_person: 'ระบุให้ชัดว่าอีกฝ่ายคือใครในคำถาม อ่านท่าที/แรงจูงใจของอีกฝ่ายควบคู่จุดวางตัวของผู้ถาม',
    timing: 'ระบุกรอบเวลาโดยประมาณจาก Decan/ธาตุไพ่ (รวมแรงหน่วงกลับหัวถ้ามี) พร้อมสัญญาณสังเกตจริง',
    why: 'ชี้ต้นตอคอขวดหรือปมที่ซ่อนอยู่จากกลไกไพ่และนิสัยจริง หลีกเลี่ยงคำปลอบลอยๆ',
    action: 'ชี้จุดที่ต้องหยุดหรือปรับก่อน แล้วให้ 1 ก้าวแรกที่เป็นรูปธรรมทำได้ทันทีวันนี้',
    explain: profile?.isBroadOpen
      ? 'ตอบแกนหลักให้เกิดประโยชน์ทันที และปิดท้ายย่อหน้า 3 ด้วยคำถามสั้นๆ 1 ข้อเพื่อเจาะเรื่องที่ผู้ถามกังวลที่สุด'
      : 'อธิบายกลไกสถานการณ์ตรงคำถามอย่างกระชับและตรงจุด'
  };
  const spreadScope = spreadCount === 1
    ? 'ไพ่เดี่ยว 1 ใบ (เจาะแกนตรงประเด็น)'
    : (spreadCount === 3 && hasCustomPositions3
        ? `เชื่อม 3 ตำแหน่งตามผัง [${positions3.join(' -> ')}]`
        : (spreadCount > 1 ? `เชื่อมเหตุ-ผลข้ามตำแหน่งทั้ง ${spreadCount} ใบ` : ''));
  return `กรอบคำตอบบังคับ: ${domainGuards[sub] || domainGuards.general} | ${intentShapes[intent] || intentShapes.explain}${spreadScope ? ` | ${spreadScope}` : ''}`;
}

export function buildSatiPromptBundle(body = {}) {
  const {
    userProfile,
    annualThaksa: bodyAnnualThaksa = null,
    natalCards,
    activeSpread,
    cards,
    elementalDignity,
    astroIntersection: bodyAstroIntersection = '',
    spreadPatterns = '',
    pastSessionMemory = '',
    question,
    recentHistory,
    earlierContextDigest = '',
    calibrationFeedback = [],
    isNatal10,
    celticPositions,
    spreadPositions = null,
    spreadPresetTitle = '',
    deckNumber = 1,
    deckCarryoverSummary = '',
    questionProfile = null,
    userFacts = [],
    topicSwitchedFrom = '',
    isExpandFollowUp: bodyIsExpand = false,
    isSameSpreadFollowUp: bodyIsSameSpread = false,
    sameSpreadFollowUpDepth: bodyFollowUpDepth = 0,
    now: bodyNow,
    currentDate: bodyCurrentDate,
    lang: rawLang
  } = body && typeof body === 'object' ? body : {};
  const lang = rawLang === 'en' || rawLang === 'zh' ? rawLang : 'th';
  const nick = userProfile?.nickname || (lang === 'en' ? 'my friend' : lang === 'zh' ? '朋友' : 'เพื่อน');
  const qText = String(question || '').trim() || 'ช่วยอ่านสถานการณ์และคำแนะนำตรงๆ จากไพ่ชุดนี้';

  const targetLangDesc = lang === 'en'
    ? 'English (respond completely in warm, direct, candid natural English as Sati)'
    : lang === 'zh'
      ? 'Simplified Chinese / 简体中文 (completely respond in warm, direct, candid natural Chinese as 思谛)'
      : 'Thai / ภาษาไทย (ตอบเป็นภาษาไทยธรรมชาติ จริงใจ เป็นกันเองเหมือนเพื่อน)';

  const { dt: refNowDate, line: currentDateLine } = formatRealTimeDateContext(bodyNow || bodyCurrentDate);
  const resolvedAnnualThaksa = (bodyAnnualThaksa && Array.isArray(bodyAnnualThaksa.roles))
    ? bodyAnnualThaksa
    : ((userProfile?.annualThaksa && Array.isArray(userProfile.annualThaksa.roles))
        ? userProfile.annualThaksa
        : computeAnnualThaksa(userProfile || {}, refNowDate));

  const rawSpreadArr = Array.isArray(activeSpread) && activeSpread.length > 0
    ? activeSpread
    : (Array.isArray(cards) ? cards : (Array.isArray(activeSpread) ? activeSpread : []));
  const hydratedSpread = hydrateDeckCards(rawSpreadArr);
  const spreadArr = rawSpreadArr.map((raw, idx) => {
    const hyd = hydratedSpread[idx] || {};
    return {
      ...hyd,
      ...raw,
      gd: raw?.gd || hyd?.gd || null,
      reversed: Boolean(raw?.reversed ?? hyd?.reversed)
    };
  });

  const resolvedProfile = isNatal10
    ? { topic: 'self', subDomain: 'self', intent: 'explain', isBroadOpen: false }
    : (questionProfile && typeof questionProfile === 'object'
        ? {
            topic: questionProfile.topic || 'general',
            subDomain: questionProfile.subDomain || questionProfile.topic || 'general',
            intent: questionProfile.intent || 'explain',
            isBroadOpen: Boolean(questionProfile.isBroadOpen)
          }
        : detectTopicAndIntent(qText, ''));
  const profileWithRawQ = { ...resolvedProfile, rawQuestion: qText };

  const customPos3 = Array.isArray(spreadPositions) && spreadPositions.length === 3
    ? spreadPositions.map((p) => String(p || '').trim())
    : null;
  const positions3 = customPos3 || ['สถานการณ์ตอนนี้', 'ตัวแปร/จุดที่ต้องระวัง', 'บทสรุป/ทางออก'];
  const effectiveIsNatal10 = Boolean(isNatal10) || (Boolean(topicSwitchedFrom) && spreadArr.length === 10);

  const formattedSpread = spreadArr.map((c, idx) => {
    const posLabel = effectiveIsNatal10 && Array.isArray(celticPositions)
      ? (celticPositions[idx] || `ตำแหน่งที่ ${idx + 1}`)
      : (spreadArr.length === 1 ? 'คำตอบหลัก' : (positions3[idx] || `ใบที่ ${idx + 1}`));
    const orientationTag = c?.reversed ? ' [กลับหัว / Reversed]' : '';
    const loc = c?.uid ? getLocalizedCardData(c, lang) : null;
    const gdParts = [
      c?.gd?.planet ? `planet:${c.gd.planet}` : '',
      c?.gd?.zodiac ? `zodiac:${c.gd.zodiac}` : '',
      c?.gd?.decan ? `decan:${c.gd.decan}` : '',
      c?.gd?.subElement ? `subElement:${c.gd.subElement}` : '',
      loc?.gdAttribution || '',
      typeof loc?.courtPersonality === 'string' ? loc.courtPersonality : ''
    ].filter(Boolean).join(', ').replace(/\r?\n/g, ' ');
    const gdBracket = gdParts ? ` [GD: ${gdParts}]` : '';
    const relevantAspect = resolveRelevantAspectForDomain(
      c,
      loc,
      resolvedProfile.topic,
      resolvedProfile.subDomain,
      effectiveIsNatal10,
      idx,
      lang
    );
    let revDiagClause = '';
    if (c?.reversed) {
      const neighbors = [spreadArr[idx - 1], spreadArr[idx + 1]].filter(Boolean);
      const diag = diagnoseReversedCard(c, {
        lang,
        posIndex: idx,
        totalCards: spreadArr.length,
        posLabel,
        neighborCards: neighbors,
        questionProfile: profileWithRawQ
      });
      const baseNuance = String(loc?.reversedNuance || '').replace(/\r?\n/g, ' ').trim();
      const parts = [
        diag?.lensLabel ? `ทิศทางกลับหัว(${diag.lensLabel}): ${diag.constructiveReframe}` : '',
        baseNuance,
        diag?.actionTrigger ? `แนวปรับ->${diag.actionTrigger}` : ''
      ].filter(Boolean);
      revDiagClause = parts.join(' · ').replace(/\r?\n/g, ' ');
    }
    const detailItems = [relevantAspect, revDiagClause].filter(Boolean).join(' | ');
    const namePart = c?.name || 'Unknown';
    const thPart = c?.th ? ` (${c.th})` : '';
    const rawCore = String(loc?.core || c?.core || '').replace(/\r?\n/g, ' ').trim();
    const corePart = rawCore ? `: ${rawCore}` : '';
    return `- [${posLabel}] ${namePart}${thPart}${orientationTag} [ธาตุ:${c?.suit || 'Major'}${c?.tone ? `, โทน:${c.tone}` : ''}]${gdBracket}${corePart}${detailItems ? ` (${detailItems})` : ''}`;
  }).join('\n');

  const thaksaFocus = selectDomainThaksaFocus(userProfile || {}, resolvedAnnualThaksa, profileWithRawQ, {
    lang,
    cards: spreadArr,
    isNatal10: Boolean(isNatal10)
  });

  const posDignity = spreadArr.length > 0
    ? analyzePositionalElementalDignity(spreadArr, { lang, isNatal10: effectiveIsNatal10 })
    : null;
  const rawDignity = String(elementalDignity || '').trim();
  const posDignityText = posDignity?.promptSummary || '';
  const dignityLine = rawDignity
    ? (posDignityText && !rawDignity.includes(posDignityText.slice(0, 26))
        ? `กำลังธาตุไพ่ (Golden Dawn Dignity): ${rawDignity} | ${posDignityText}`
        : `กำลังธาตุไพ่ (Golden Dawn Dignity): ${rawDignity}`)
    : (posDignityText ? `กำลังธาตุไพ่ (Golden Dawn Dignity): ${posDignityText}` : '');

  const causalDynamics = spreadArr.length > 0
    ? analyzeSpreadCausalDynamics(spreadArr, {
        lang,
        questionProfile: profileWithRawQ,
        spreadPositions: effectiveIsNatal10 ? celticPositions : positions3
      })
    : null;
  const causalParts = causalDynamics
    ? [
        causalDynamics.causalArcText,
        causalDynamics.courtRoles?.[0]?.summary || '',
        causalDynamics.reversalDiagnoses?.[0]?.shortClause || ''
      ].filter(Boolean)
    : [];
  const causalText = causalParts.length > 0 ? causalParts.join(' | ') : (causalDynamics?.promptSummary || '');
  const causalLine = causalText && (spreadArr.length >= 2 || spreadArr.some((c) => c?.reversed))
    ? `พลวัตไพ่และจุดหักเห (Causal Arc): ${causalText}`
    : '';

  const needsTiming = ['timing', 'outcome', 'decision'].includes(resolvedProfile.intent) && spreadArr.length > 0;
  const timingProfile = needsTiming
    ? getDecanTimingProfile(spreadArr[spreadArr.length - 1], { lang, referenceDate: refNowDate })
    : null;
  const timingLine = timingProfile?.summary
    ? `กรอบจังหวะเวลาจาก Decan/ธาตุ (Timing Lens): ${timingProfile.summary}`
    : '';

  const computedInter = computeAstroCardIntersection(
    userProfile ? { ...userProfile, annualThaksa: resolvedAnnualThaksa } : { annualThaksa: resolvedAnnualThaksa },
    spreadArr,
    lang
  );
  const spreadCardSignature = spreadArr
    .map((c) => `${c?.name || c?.uid || 'Card'}(${c?.gd?.planet || c?.gd?.zodiac || c?.gd?.subElement || c?.suit || 'Major'})`)
    .join(', ');
  const primaryInter = String(bodyAstroIntersection || computedInter?.summary || '').trim();
  const hlText = String(computedInter?.highlights?.join(' · ') || '').trim();
  const includeHl = hlText && (!primaryInter || !primaryInter.includes(hlText.slice(0, 24)));
  const astroIntersectionLine = spreadArr.length > 0
    ? `จุดตัดดวงชะตากับไพ่ Golden Dawn (Astrological Intersection): ${[primaryInter, includeHl ? hlText : '', spreadCardSignature ? `ไพ่ชุดนี้: ${spreadCardSignature}` : ''].filter(Boolean).join(' | ')}`
    : '';

  const showKalakini = Boolean(thaksaFocus?.includeKalakiniNote && userProfile?.thaksaDetails?.hasKalakini);
  const kalLine = showKalakini
    ? ` | มีอักษรกาลกิณีในชื่อ: ${userProfile.thaksaDetails.kalakiniChars.join(',')} (ใช้เตือนเฉพาะจุดสื่อสาร/เอกสาร)`
    : '';
  const natalThaksaLine = (userProfile?.thaksaStrength || showKalakini || userProfile?.birthCard)
    ? `จุดแข็งทักษาชื่อและไพ่ประจำตัว: ${userProfile?.thaksaStrength || '-'}${kalLine}${userProfile?.birthCard ? ` | ไพ่ประจำตัว: ${userProfile.birthCard}` : ''}`
    : '';

  const { digestText, recentOpenings } = buildCompressedHistoryDigest(recentHistory);
  const isExpandFollowUp = Boolean(bodyIsExpand) || /^(ขยายความต่อจากที่ถามไว้ว่า|Please expand further on:|请针对我刚才的问题继续深入讲讲：)/.test(qText);
  const readingMode = (Boolean(isNatal10) || Boolean(topicSwitchedFrom))
    ? 'main_spread'
    : (isExpandFollowUp
        ? 'expand_draw'
        : (bodyIsSameSpread ? 'same_spread_chat' : 'main_spread'));
  const followUpDepth = readingMode === 'same_spread_chat' ? Math.max(1, Number(bodyFollowUpDepth) || 1) : 0;
  const asksForCardName = /(ไพ่ใบไหน|ใบไหนบอก|ใบไหนชี้|ดูจากใบไหน|ไพ่ชื่อ|which card|what card|name the card|哪张牌)/i.test(qText);
  const asksForAction = resolvedProfile.intent === 'action' || /(?:ควร|ต้อง|จะ|แก้|รับมือ|ทำ|เริ่ม).{0,12}(?:ยังไง|อย่างไร|ไง)|แนะน[ำา]|วิธีแก้|ทางออก|what should i do|how should i|怎么办|怎么做/i.test(qText);
  const openingStyles = [
    'เปิดประโยคแรกด้วยการฟันธงคำตอบตรงประเด็นทันที (ห้ามทักทาย "สวัสดี" และห้ามขึ้นด้วยคำว่า "ลึกๆ แล้ว")',
    'เปิดประโยคแรกด้วยการสะท้อนความขัดแย้งหรือจุดหักมุมที่เห็นชัดจากหน้าไพ่ชุดนี้ทันที (ห้ามทักทาย "สวัสดี")',
    'เปิดประโยคแรกด้วยการแตะอารมณ์หรือปมสำคัญหลังคำถามอย่างเป็นธรรมชาติ (ห้ามทักทาย "สวัสดี")',
    'เปิดประโยคแรกด้วยการเปรียบเทียบจังหวะชีวิตตอนนี้กับไพ่แกนหลักบนโต๊ะทันที (ห้ามทักทาย "สวัสดี")'
  ];
  const openingDirective = isNatal10
    ? 'เป็นรอบเปิดไพ่พื้นดวง 10 ใบแรก ทักทายอย่างอบอุ่นครั้งเดียวได้ แล้วเชื่อมเข้าพื้นดวงและหน้าไพ่ทันที'
    : (readingMode === 'same_spread_chat'
        ? 'เปิดประโยคแรกด้วยการตอบคำถามเจาะจงตรงประเด็นทันทีแบบคุยแชทสด (ห้ามทักทาย และห้ามเกริ่นสรุปหน้าไพ่ซ้ำ)'
        : openingStyles[((Array.isArray(recentHistory) ? recentHistory.length : 0) + Number(deckNumber || 1)) % openingStyles.length]);
  const deckHeader = Number(deckNumber) > 1
    ? `สถานะสำรับปัจจุบัน: สำรับที่ ${deckNumber} (เพิ่งรีเซ็ตสำรับใหม่ 78 ใบ — อ่านจากไพ่ใหม่บนโต๊ะควบคู่พื้นดวงเดิมเท่านั้น ห้ามเอาไพ่ที่ลงกองทิ้งจากสำรับก่อนมาปน)${deckCarryoverSummary ? `\nบันทึกสั้นๆ จากสำรับก่อนหน้า: ${deckCarryoverSummary}` : ''}`
    : '';
  const extNatal = resolveExtendedNatalInfo(userProfile);
  const extNatalLine = extNatal.age
    ? `ช่วงวัยและจักรราศี: อายุราว ${extNatal.age} ปี (${extNatal.lifeStageText}), ${extNatal.zodiacText}, ${extNatal.animalText}`
    : (extNatal.zodiacText ? `จักรราศี: ${extNatal.zodiacText}, ${extNatal.animalText}` : '');
  const factsLine = Array.isArray(userFacts) && userFacts.length > 0
    ? `บริบทชีวิตจริงที่ผู้ถามเคยเล่าไว้ (ใช้ประกอบคำแนะนำให้ตรงตัวตน): ${userFacts.join(' | ')}`
    : '';
  const profileLine = !isNatal10
    ? `วิเคราะห์คำถาม: topic=${resolvedProfile.topic}, subDomain=${resolvedProfile.subDomain}, intent=${resolvedProfile.intent}, isBroadOpen=${Boolean(resolvedProfile.isBroadOpen)}`
    : '';
  const answerContractLine = buildQuestionAnswerContract(
    resolvedProfile,
    Boolean(isNatal10),
    spreadArr.length,
    Boolean(customPos3),
    positions3
  );
  const switchLine = topicSwitchedFrom
    ? `คำสั่งสำคัญเมื่อเปลี่ยนประเด็น: ไพ่ 3 ใบเดิมบนโต๊ะถูกเปิดไว้สำหรับหัวข้อ "${topicSwitchedFrom}" จึงดึงไพ่พื้นดวง 10 ใบมาใช้อ่านให้แทนในรอบนี้ — ให้บอกผู้ถามสั้นๆ อย่างเป็นมิตรว่ากำลังอ่านจากไพ่พื้นดวงหลัก และแนะนำให้กดจั่วไพ่เพิ่ม 1-3 ใบหากอยากเจาะลึกเรื่องใหม่นี้โดยตรง`
    : '';
  const cleanSpreadPatterns = typeof spreadPatterns === 'string' ? spreadPatterns.trim() : '';
  const cleanPastMemory = typeof pastSessionMemory === 'string' ? pastSessionMemory.trim() : '';
  const hasReversed = spreadArr.some((c) => Boolean(c?.reversed));

  const cleanSpreadPresetTitle = typeof spreadPresetTitle === 'string' ? spreadPresetTitle.trim() : '';
  const compactNatalLine = formatCompactNatalBaseline(natalCards, resolvedProfile, qText, Boolean(isNatal10), celticPositions);

  const cleanEarlierDigest = typeof earlierContextDigest === 'string' ? earlierContextDigest.trim() : '';
  const calibEntries = Array.isArray(calibrationFeedback) ? calibrationFeedback.filter((c) => c && typeof c === 'object') : [];
  const calibrationLine = calibEntries.length > 0
    ? `ผลปรับจูนความแม่นยำจากผู้ถาม (Calibration Loop Feedback): ${calibEntries.map((c) => {
        const note = String(c.note || '').trim();
        const qRef = String(c.question || '').trim();
        const cardsRef = String(c.cardsSummary || '').trim();
        return c.verdict === 'inaccurate'
          ? `[ยังไม่ตรง/ต้องปรับสมมติฐานใหม่: ${note || 'ผู้ถามแจ้งว่ายังไม่ตรง'}${qRef ? ` (คำถาม: ${qRef})` : ''}]`
          : `[ทายตรงจุดแล้ว/ยึดเป็นแกนต่อยอด: ${note || qRef || 'ผู้ถามยืนยันว่าตรงประเด็น'}${cardsRef ? ` (ไพ่: ${cardsRef})` : ''}]`;
      }).join(' | ')}`
    : '';

  const modeDirective = readingMode === 'same_spread_chat'
    ? `โหมดตอบ (readingMode=same_spread_chat, รอบเจาะลึกบนไพ่เดิมที่ ${followUpDepth}): สังเคราะห์จากไพ่ทุกใบบนโต๊ะ (${spreadArr.length} ใบ) และทักษาด้านล่างอยู่เบื้องหลังเพื่อความแม่นยำ แต่ตอบสั้นคมแบบคุยแชทสดเพียง 1 ย่อหน้า (1-3 ประโยคเท่านั้น) ตรงเข้าคำตอบของ "${qText}" ทันที ห้ามไล่อธิบายความหมายหน้าไพ่ซ้ำ${asksForCardName ? ' (ผู้ถามถามหาชื่อไพ่ ให้ระบุเฉพาะชื่อไพ่ที่ชี้จุดนี้สั้นๆ ได้)' : ' และไม่ต้องเอ่ยชื่อไพ่ในคำตอบ'} ${asksForAction ? 'สรุปวิธีรับมือสั้นๆ 1 ประโยคให้ตรงคำถาม' : 'ไม่ต้องแถมคำแนะนำยาวต่อท้ายเพราะผู้ถามไม่ได้ถามวิธีแก้'} ${followUpDepth >= 3 ? 'และหากคำถามนี้เจาะลึกเกินขอบเขตไพ่เดิมแล้ว ให้ตบท้ายเบาๆ 1 ประโยคว่ากดจั่วเพิ่ม 1-3 ใบได้' : 'รอบนี้ยังไม่ต้องชวนจั่วไพ่เพิ่มเว้นแต่คำถามแตกออกนอกขอบเขตไพ่เดิมชัดเจน'}`
    : (readingMode === 'expand_draw'
        ? `โหมดตอบ (readingMode=expand_draw) — โหมดจั่วไพ่ขยายคำถามเดิม: ผู้ถามตั้งใจจั่วไพ่ใหม่เพิ่มเพื่อขยายความคำถามก่อนหน้า — ตอบสั้นกระชับเพียง 1-2 ย่อหน้าสั้นๆ เจาะเฉพาะมุมใหม่ที่ไพ่ชุดนี้เปิดเพิ่มทันที ไม่ต้องทวนคำอธิบายยาวเหมือนรอบแรก และห้ามทักว่าถามเรื่องเดิมซ้ำ`
        : '');

  const questionFocusBlock = [
    '<question_focus>',
    `Target Language: ${targetLangDesc}`,
    currentDateLine,
    deckHeader,
    `โหมดการตอบ (Response Mode): ${readingMode}`,
    `คำถามล่าสุดที่ต้องตอบให้ตรงประเด็น: "${qText}"`,
    profileLine,
    answerContractLine,
    modeDirective,
    switchLine,
    calibrationLine,
    factsLine,
    '</question_focus>'
  ].filter(Boolean).join('\n');

  const drawnCardsBlock = [
    '<drawn_cards>',
    !isNatal10 && spreadArr.length === 3 && (cleanSpreadPresetTitle || customPos3)
      ? `กรอบผัง 3 ใบที่ผู้ถามเลือก (${cleanSpreadPresetTitle || positions3.join(' · ')}): ตีความแต่ละใบให้ตรงตามบทบาท [${positions3.join(' -> ')}] อย่างชัดเจน`
      : '',
    `ไพ่ที่เปิดอยู่บนโต๊ะตอนนี้ (${spreadArr.length} ใบ):\n${formattedSpread || 'ยังไม่มีไพ่เปิดเพิ่มเติม'}`,
    '</drawn_cards>'
  ].filter(Boolean).join('\n');

  const domainThaksaLine = thaksaFocus?.compactPromptBlock || '';
  const baseElemText = userProfile?.elemShort
    ? `ธาตุ${userProfile.elemShort}${userProfile?.element && !String(userProfile.element).startsWith('ธาตุ') ? ` (${userProfile.element})` : (userProfile?.element && userProfile.element !== `ธาตุ${userProfile.elemShort}` ? ` (${userProfile.element})` : '')}`
    : (userProfile?.element || '');
  const natalBaseParts = [
    userProfile?.dayName || '',
    baseElemText,
    userProfile?.lifePath ? `เลขชีวิต ${userProfile.lifePath}` : ''
  ].filter(Boolean);
  const natalBaseLine = natalBaseParts.length ? `พื้นดวงเกิด: ${natalBaseParts.join(', ')}` : '';
  const synthesisBlock = [
    '<divination_synthesis>',
    dignityLine,
    causalLine,
    timingLine,
    cleanSpreadPatterns ? `ภาพรวมโครงสร้างไพ่ทั้งชุด (Spread Patterns): ${cleanSpreadPatterns}` : '',
    `ผู้ถาม: ชื่อเล่น "${nick}"${userProfile?.fullname ? `, ชื่อจริง "${userProfile.fullname}"` : ''}`,
    natalBaseLine,
    extNatalLine,
    natalThaksaLine,
    // Keep domainThaksaLine before astroIntersectionLine so isolated `|` segments for ศรีจร / กาลกิณีจร always resolve cleanly first
    domainThaksaLine,
    astroIntersectionLine,
    '</divination_synthesis>'
  ].filter(Boolean).join('\n');

  const backgroundItems = [
    compactNatalLine,
    cleanPastMemory ? `ความต่อเนื่องจากรอบก่อนหน้า (Cross-Session Memory): ${cleanPastMemory}` : '',
    cleanEarlierDigest ? `สรุปบริบทช่วงต้นของการสนทนา (Earlier Context Digest): ${cleanEarlierDigest}` : '',
    digestText ? `สรุปบทสนทนาล่าสุดในสำรับนี้:\n${digestText}` : '',
    recentOpenings.length ? `ประโยคเปิดที่ใช้ไปแล้วในตาก่อนหน้า (ห้ามขึ้นต้นซ้ำเด็ดขาด ให้เปลี่ยนมุมเปิดใหม่): ${recentOpenings.join(' | ')}` : '',
    `คำสั่งสไตล์การเปิดประโยคตานี้: ${openingDirective}`
  ].filter(Boolean);

  const backgroundBlock = backgroundItems.length > 0
    ? ['<background_context>', ...backgroundItems, '</background_context>'].join('\n')
    : '';

  const answerNowInstruction = readingMode === 'same_spread_chat'
    ? `โหมดแชทถามต่อ (same_spread_chat): ตอบคำถามเจาะจง "${qText}" ให้ตรงจุดทันทีสำหรับ${nick} โดยใช้ไพ่ทุกใบบนโต๊ะ (${spreadArr.length} ใบ) เป็นฐานคิดเบื้องหลัง แต่เขียนสั้นกระชับเพียง 1 ย่อหน้า (1-3 ประโยคเท่านั้น) ห้ามไล่อธิบายหน้าไพ่ซ้ำ${asksForCardName ? '' : ' และไม่ต้องเอ่ยชื่อไพ่'} อบอุ่น จริงใจ ตามภาษาเป้าหมาย ไร้ Markdown ไร้อีโมจิ`
    : (readingMode === 'expand_draw'
        ? `โหมดขยายไพ่ (expand_draw): ตอบคำถาม "${qText}" สำหรับ${nick} โดยเจาะตรงสิ่งที่ไพ่ที่เพิ่งจั่ว (${spreadArr.length} ใบ) เปิดเพิ่มอย่างกระชับ 1-2 ย่อหน้าสั้นๆ อบอุ่น จริงใจ ตามภาษาเป้าหมาย ไร้ Markdown ไร้อีโมจิ`
        : `ตอบคำถาม "${qText}" ให้ตรงจุดตั้งแต่อย่อหน้าแรก สำหรับ${nick} โดยยึดไพ่บนโต๊ะ ${spreadArr.length} ใบ ข้อเท็จจริงจริง และกำลังดาวด้านบน (3 ย่อหน้า อบอุ่น จริงใจ ตามภาษาเป้าหมาย ไร้ Markdown ไร้อีโมจิ)`);

  const answerNowBlock = [
    '<answer_now>',
    answerNowInstruction,
    '</answer_now>'
  ].join('\n');

  const userContext = [
    questionFocusBlock,
    drawnCardsBlock,
    synthesisBlock,
    backgroundBlock,
    answerNowBlock
  ].filter(Boolean).join('\n\n');

  return {
    lang,
    readingMode,
    systemInstruction: SATI_SYSTEM_PROMPT,
    userContext,
    formattedSpread,
    hasReversed
  };
}

export async function handleSatiReadRequest(body, options = {}) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    return {
      fallback: true,
      reason: 'NO_SERVER_API_KEY'
    };
  }

  const { lang, systemInstruction, userContext } = buildSatiPromptBundle(body);
  const primaryRouting = resolveThinkingConfigForRequest(body, PRIMARY_GEMINI_MODEL);
  const ai = createGeminiClient(apiKey, options);
  let rawOutput = '';
  let usedModel = PRIMARY_GEMINI_MODEL;
  let usedThinkingLevel = primaryRouting.thinkingLevel;
  let lastErr = null;

  const candidateModels = getCandidateGeminiModels();

  for (const model of candidateModels) {
    const routing = resolveThinkingConfigForRequest(body, model);
    const config = buildModelGenerateConfig(model, systemInstruction, routing);
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userContext,
        config
      });
      const text = (response?.text || '').trim();
      if (text) {
        rawOutput = text;
        usedModel = model;
        usedThinkingLevel = routing.thinkingLevel;
        break;
      }
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err || '');
      if (COOLDOWN_ERROR_RE.test(msg)) {
        markModelQuotaCooldown(model, msg);
      }
    }
  }

  const reply = sanitizeSatiText(rawOutput, lang);
  if (!reply) {
    return { fallback: true, reason: lastErr?.message || 'EMPTY_MODEL_OUTPUT' };
  }
  return { reply, fallback: false, model: usedModel, thinkingLevel: usedThinkingLevel };
}

export function createSatiExpressApp(options = {}) {
  const app = express();
  const usersDbFile = options.usersDbFile || DB_FILE;
  const feedbackDbFile = options.feedbackDbFile || FEEDBACK_FILE;
  let usersDbCache = null;
  let feedbackDbCache = null;
  let usersWriteQueue = Promise.resolve();
  let feedbackWriteQueue = Promise.resolve();

  const getUsersDb = () => {
    if (!usersDbCache) {
      const loaded = readJsonFileSafe(usersDbFile, {});
      usersDbCache = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? loaded : {};
    }
    return usersDbCache;
  };
  const persistUsersDb = (snapshot) => {
    usersDbCache = snapshot;
    usersWriteQueue = usersWriteQueue
      .catch(() => {})
      .then(() => atomicWriteJsonFile(usersDbFile, snapshot));
    return usersWriteQueue;
  };

  const getFeedbackDb = () => {
    if (!feedbackDbCache) {
      const loaded = readJsonFileSafe(feedbackDbFile, []);
      feedbackDbCache = Array.isArray(loaded) ? loaded : [];
    }
    return feedbackDbCache;
  };
  const persistFeedbackDb = (snapshot) => {
    feedbackDbCache = snapshot;
    feedbackWriteQueue = feedbackWriteQueue
      .catch(() => {})
      .then(() => atomicWriteJsonFile(feedbackDbFile, snapshot));
    return feedbackWriteQueue;
  };

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(compression({
    filter: (req, res) => {
      if (req.path === '/api/sati/read/stream' || req.path.endsWith('/stream')) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/sati/health', (_req, res) => {
    const hasKey = Boolean(getGeminiApiKey());
    const emailCfg = resolveFeedbackEmailConfig();
    res.json({
      ok: true,
      engine: 'SATI-3D-Engine',
      model: PRIMARY_GEMINI_MODEL,
      apiConfigured: hasKey,
      feedbackEmailConfigured: Boolean(emailCfg.apiKey && emailCfg.to)
    });
  });

  app.get('/api/sati/state', (req, res) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Missing email parameter' });
    const db = getUsersDb();
    return res.json({ record: db[email] || null });
  });

  app.post('/api/sati/state', async (req, res) => {
    const clientIp = resolveClientIp(req);
    const rl = checkStateRateLimit(clientIp);
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        rateLimited: true
      });
    }
    const { email, record } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 120);
    if (!cleanEmail || !record || typeof record !== 'object' || Array.isArray(record)) {
      return res.status(400).json({ error: 'Missing email or state record' });
    }
    const cleanRecord = sanitizeStateRecordForStorage(record);
    if (Buffer.byteLength(JSON.stringify(cleanRecord), 'utf8') > MAX_STATE_RECORD_BYTES) {
      return res.status(413).json({ error: 'STATE_TOO_LARGE' });
    }
    const db = pruneUsersDbMap({
      ...getUsersDb(),
      [cleanEmail]: {
        ...cleanRecord,
        updatedAt: new Date().toISOString()
      }
    });
    await persistUsersDb(db);
    return res.json({ ok: true });
  });

  app.post('/api/sati/read', async (req, res) => {
    const clientIp = resolveClientIp(req);
    const rl = checkReadRateLimit(clientIp);
    if (!rl.allowed) {
      return res.status(429).json({
        fallback: true,
        rateLimited: true,
        reason: 'RATE_LIMITED'
      });
    }
    try {
      const result = await handleSatiReadRequest(req.body, options);
      return res.json(result);
    } catch (err) {
      return res.json({
        fallback: true,
        reason: err.message || 'API_ERROR'
      });
    }
  });

  app.post('/api/sati/read/stream', async (req, res) => {
    const clientIp = resolveClientIp(req);
    const rl = checkReadRateLimit(clientIp);
    if (!rl.allowed) {
      return res.status(429).json({
        fallback: true,
        rateLimited: true,
        reason: 'RATE_LIMITED',
        error: 'RATE_LIMITED'
      });
    }

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return res.json({
        fallback: true,
        reason: 'NO_SERVER_API_KEY'
      });
    }

    let promptBundle;
    try {
      promptBundle = buildSatiPromptBundle(req.body);
    } catch (err) {
      return res.json({
        fallback: true,
        reason: err?.message || 'PROMPT_BUILD_ERROR'
      });
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const abortController = new AbortController();
    let clientClosed = false;
    const handleDisconnect = () => {
      if (res.writableEnded || res.writableFinished) return;
      clientClosed = true;
      if (!abortController.signal.aborted) {
        abortController.abort();
      }
    };
    const handleReqClose = () => {
      if (!req.complete) handleDisconnect();
    };
    res.on('close', handleDisconnect);
    req.on('aborted', handleDisconnect);
    req.on('close', handleReqClose);

    const { lang, systemInstruction, userContext } = promptBundle;
    const ai = createGeminiClient(apiKey, options);
    const candidateModels = getCandidateGeminiModels();

    let streamedToClient = false;
    let completed = false;
    let lastErr = null;

    try {
      for (const model of candidateModels) {
        if (clientClosed || abortController.signal.aborted || res.writableEnded) break;

        const routing = resolveThinkingConfigForRequest(req.body, model);
        const config = {
          ...buildModelGenerateConfig(model, systemInstruction, routing),
          abortSignal: abortController.signal
        };
        let modelRawOutput = '';
        let metaSentForModel = false;

        try {
          const stream = await ai.models.generateContentStream({
            model,
            contents: userContext,
            config
          });

          for await (const chunk of stream) {
            if (clientClosed || abortController.signal.aborted || res.writableEnded) break;
            const rawChunkText = typeof chunk?.text === 'string' ? chunk.text : '';
            if (!rawChunkText) continue;

            modelRawOutput += rawChunkText;
            const safeChunk = sanitizeStreamChunk(rawChunkText);
            if (!safeChunk) continue;

            if (!metaSentForModel) {
              writeSseEvent(res, 'meta', { model, thinkingLevel: routing.thinkingLevel });
              metaSentForModel = true;
            }
            writeSseEvent(res, 'chunk', { text: safeChunk });
            streamedToClient = true;
          }

          if (clientClosed || abortController.signal.aborted || res.writableEnded) {
            break;
          }

          const sanitizedReply = sanitizeSatiText(modelRawOutput, lang);
          if (sanitizedReply) {
            if (!metaSentForModel) {
              writeSseEvent(res, 'meta', { model, thinkingLevel: routing.thinkingLevel });
            }
            writeSseEvent(res, 'done', {
              ok: true,
              model,
              thinkingLevel: routing.thinkingLevel,
              reply: sanitizedReply,
              fallback: false
            });
            completed = true;
            break;
          }

          if (streamedToClient) {
            lastErr = new Error('EMPTY_MODEL_OUTPUT');
            break;
          }
        } catch (err) {
          if (clientClosed || abortController.signal.aborted) {
            break;
          }
          lastErr = err;
          const msg = String(err?.message || err || '');
          if (COOLDOWN_ERROR_RE.test(msg)) {
            markModelQuotaCooldown(model, msg);
          }
          if (streamedToClient) {
            break;
          }
        }
      }

      if (!completed && !clientClosed && !abortController.signal.aborted && !res.writableEnded) {
        writeSseEvent(res, 'fallback', {
          ok: false,
          fallback: true,
          reason: lastErr?.message || 'EMPTY_MODEL_OUTPUT'
        });
      }
    } finally {
      res.off('close', handleDisconnect);
      req.off('aborted', handleDisconnect);
      req.off('close', handleReqClose);
      if (!res.writableEnded) {
        res.end();
      }
    }
  });

  app.get('/api/sati/feedback', (req, res) => {
    const items = getFeedbackDb();
    const count = items.length;
    const avgRating = count > 0
      ? Number((items.reduce((sum, item) => sum + (Number(item.rating) || 5), 0) / count).toFixed(1))
      : 0;
    const { adminKey } = resolveFeedbackEmailConfig();
    const providedKey = String(req.query?.key || req.headers?.['x-admin-key'] || '').trim();
    if (adminKey && providedKey === adminKey) {
      return res.json({ ok: true, count, avgRating, items });
    }
    return res.json({ ok: true, count, avgRating, private: true });
  });

  app.post('/api/sati/feedback', async (req, res) => {
    const clientIp = resolveClientIp(req);
    const rl = checkFeedbackRateLimit(clientIp);
    if (!rl.allowed) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        rateLimited: true
      });
    }
    const { nickname, rating, tags, comment, lang } = req.body || {};
    const cleanComment = String(comment || '').trim().slice(0, 1000);
    const cleanTags = Array.isArray(tags) ? tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 6) : [];
    const hasRating = rating !== undefined && rating !== null && !Number.isNaN(Number(rating));
    if (!cleanComment && cleanTags.length === 0 && !hasRating) {
      return res.status(400).json({ error: 'Missing feedback rating, tags, or comment' });
    }
    const numRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 5)));
    const entry = {
      id: `fb_${Date.now()}`,
      nickname: String(nickname || 'ผู้ทดสอบ').trim().slice(0, 60) || 'ผู้ทดสอบ',
      rating: numRating,
      tags: cleanTags,
      comment: cleanComment,
      lang: String(lang || 'th').slice(0, 8),
      createdAt: new Date().toISOString()
    };
    const nextList = [entry, ...getFeedbackDb()].slice(0, MAX_FEEDBACK_ENTRIES);
    await persistFeedbackDb(nextList);
    const emailResult = await sendFeedbackNotificationEmail(entry);
    return res.json({
      ok: true,
      entry,
      count: nextList.length,
      emailSent: Boolean(emailResult.sent),
      ...(emailResult.sent ? {} : { emailReason: emailResult.reason })
    });
  });

  if (fs.existsSync(DIST_DIR)) {
    const indexHtmlPath = path.join(DIST_DIR, 'index.html');
    app.use(express.static(DIST_DIR, {
      setHeaders: (res, filePath) => {
        const norm = filePath.replace(/\\/g, '/');
        if (norm.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (norm.includes('/models/') || norm.includes('/images/') || norm.endsWith('/icon.svg')) {
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        } else if (norm.endsWith('.html') || norm.endsWith('.webmanifest')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      if (fs.existsSync(indexHtmlPath)) {
        res.setHeader('Cache-Control', 'no-cache');
        return res.sendFile(indexHtmlPath);
      }
      return next();
    });
  }

  return app;
}

// Allow running standalone via `node backend/geminiProxyServer.js`
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const PORT = process.env.PORT || 8080;
  const app = createSatiExpressApp();
  app.listen(PORT, () => {
    console.log(`SATI Production Server running on port ${PORT} (static=${fs.existsSync(DIST_DIR)})`);
  });
}
