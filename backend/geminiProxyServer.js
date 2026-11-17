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
import { GoogleGenAI } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'users_db.json');
const FEEDBACK_FILE = path.join(DB_DIR, 'feedback_db.json');
const DIST_DIR = path.join(__dirname, '..', 'dist');
const ENV_FILE = path.join(__dirname, '..', '.env');
const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
const GEMINI_MODEL_ORDER = [
  'gemini-4-hydrogen',
  'gemini-3.6-flash',
  'gemini-2.5-flash',
  'gemini-3.5-flash-lite'
];
const modelCooldownUntil = new Map();

export function buildModelGenerateConfig(model, systemInstruction = SATI_SYSTEM_PROMPT) {
  const m = String(model || '');
  const config = { systemInstruction };
  if (/^gemini-4/i.test(m)) {
    config.maxOutputTokens = 2600;
    config.thinkingConfig = { thinkingLevel: 'low' };
  } else {
    config.maxOutputTokens = 1800;
    if (!/^gemini-3\.[6-9]/i.test(m)) {
      config.temperature = 0.8;
    }
    if (!/flash-lite/i.test(m)) {
      config.thinkingConfig = { thinkingBudget: 384 };
    }
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
  const isDaily = /perday|daily|rpd/i.test(String(errMsg || ''));
  const ttlMs = isDaily ? 15 * 60_000 : 60_000;
  modelCooldownUntil.set(model, now + ttlMs);
  return now + ttlMs;
}

export function resetModelCooldownForTest() {
  modelCooldownUntil.clear();
}
const READ_RATE_LIMIT_WINDOW_MS = 60_000;
const READ_RATE_LIMIT_MAX = 20;
const readRateBuckets = new Map();

export function checkReadRateLimit(ipKey, now = Date.now(), limit = READ_RATE_LIMIT_MAX, windowMs = READ_RATE_LIMIT_WINDOW_MS) {
  const key = String(ipKey || 'unknown').trim() || 'unknown';
  if (readRateBuckets.size > 500) {
    for (const [k, stamps] of readRateBuckets.entries()) {
      const fresh = stamps.filter((t) => now - t < windowMs);
      if (fresh.length === 0) readRateBuckets.delete(k);
      else readRateBuckets.set(k, fresh);
    }
  }
  const existing = (readRateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (existing.length >= limit) {
    readRateBuckets.set(key, existing);
    return { allowed: false, remaining: 0 };
  }
  existing.push(now);
  readRateBuckets.set(key, existing);
  return { allowed: true, remaining: Math.max(0, limit - existing.length) };
}

export function resetReadRateLimitForTest() {
  readRateBuckets.clear();
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
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: 22000 } });
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

function readUsersDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch {
    // ignore corrupt file and reset
  }
  return {};
}

function writeUsersDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function readFeedbackDB() {
  try {
    if (fs.existsSync(FEEDBACK_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // ignore corrupt feedback file
  }
  return [];
}

function writeFeedbackDB(list) {
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(list, null, 2), 'utf8');
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
หลักความแม่นยำตามประเภทคำถาม (Adaptive Precision):
- ยึดหมวดคำถาม (subDomain) เป็นแกนหลัก:
  * study (เรียน/สอบ/ทุน): โฟกัสการเตรียมตัว วิธีแบ่งเวลา จุดอ่อนเนื้อหา และแรงกดดันในห้องสอบ
  * health (สุขภาพ/พักผ่อน): พูดเรื่องพลังงาน การฟื้นตัว พฤติกรรมเสี่ยง และเตือนตรวจสุขภาพกับแพทย์จริงเมื่อมีอาการ ไม่วินิจฉัยโรคแทนหมอ
  * family (ครอบครัว/พ่อแม่/ญาติ): โฟกัสความห่วงใยและบทบาทในบ้าน ห้ามตีความเป็นเรื่องรักชู้สาวหรือคนคุยเด็ดขาด
  * property (บ้าน/ที่อยู่/รถ): ดูความคุ้มค่า สัญญา ทำเล ค่าใช้จ่ายแฝง และความพร้อมระยะยาว
  * work / money / love / self: วิเคราะห์ตรงตามโลกความจริงของเรื่องนั้นๆ
- ปรับรูปทรงคำตอบตามเจตนาคำถาม (intent):
  * outcome (ได้ไหม/รอดไหม): ฟันธงแนวโน้มความน่าจะเป็นตั้งแต่ย่อหน้าแรก พร้อมเงื่อนไขที่จะทำให้สำเร็จหรือสะดุด
  * decision (A หรือ B): ชี้ฝั่งที่ได้เปรียบกว่าพร้อมเทียบ Trade-off ของทั้งสองทางตรงๆ
  * other_person: แยกให้ออกว่าอีกฝ่ายคือคนรัก เจ้านาย/ลูกค้า หรือคนในบ้าน แล้วอ่านท่าทีอีกฝ่ายควบคู่จุดที่ผู้ถามควรวางตัว
  * timing: ระบุกรอบเวลาโดยประมาณจากธาตุไพ่ (ไม้เท้า=ไวหลักวันถึงสัปดาห์, ดาบ=ตึง 1-2 เดือน, ถ้วย=ค่อยๆ ก่อตัวตามความรู้สึก, เหรียญ=รอผลจริง 2-4 เดือน+, Major=ขึ้นกับจังหวะตัดสินใจเปลี่ยน) พร้อมจุดสังเกตจริง
  * คำถามกว้างเกินไป (isBroadOpen=true): ตอบแกนหลักที่เห็นจากไพ่ตรงหน้าให้เกิดประโยชน์ทันที แล้วปิดท้ายย่อหน้า 3 ด้วยคำถามสั้นๆ 1 ข้อเพื่อให้ผู้ถามเจาะประเด็นต่อ
- ห้ามยัดเยียดสูตรสำเร็จ: ห้ามอ้าง "อักษรกาลกิณีในชื่อ" ในทุกคำถามทั่วไป (อ้างถึงเฉพาะรอบเปิดพื้นดวง 10 ใบแรก หรือเมื่อคำถามและหน้าไพ่ฟ้องปมสื่อสาร/ชื่อเสียง/จุดบอดส่วนตัวจริงๆ) และห้ามยัดประโยค "ภายนอกนิ่งข้างในแบกหนัก" หรือโทนดราม่าหนักเกินจริงให้กับไพ่ Minor ทั่วไป
- กรณีแจ้งว่าเปลี่ยนประเด็น (topicSwitchedFrom): ให้อธิบายสั้นๆ ว่าไพ่บนโต๊ะรอบก่อนเป็นคนละหัวข้อ ระบบจึงดึงไพ่พื้นดวง 10 ใบมาอ่านให้แทน และชวนกดจั่วเพิ่ม 1-3 ใบหากอยากเจาะเรื่องใหม่นี้ให้ลึกขึ้น
- กรณีไพ่กลับหัว (Reversed): เมื่อหน้าไพ่ระบุ [กลับหัว / Reversed] ให้อ่านอย่างสร้างสรรค์ว่าเป็นพลังงานที่ติดขัดหรือเก็บไว้ภายใน จังหวะที่ถูกหน่วง/เลื่อนเวลา หรือจุดบอดที่เจ้าชะตาลงมือปรับแก้ได้ ห้ามทำนายแบบโชคร้ายตายตัวหรือขู่ให้หมดหวังเด็ดขาด
- หากมีข้อมูลโครงสร้างไพ่ทั้งชุด (Spread Patterns) หรือความต่อเนื่องจากรอบก่อน (Cross-Session Memory) ให้ร้อยเรียงเข้ากับการอ่านอย่างเป็นธรรมชาติโดยไม่ทวนรายงานเป็นข้อๆ
รูปแบบการตอบ: คงโครงสร้าง 3 ย่อหน้าสั้นๆ อ่านจบไว อ่านทะลุใจ และตรงประเด็นโดยไม่เกริ่นน้ำท่วมทุ่ง:
1. ย่อหน้าแรก (อ่านใจ Subtext + ฟันธงตรงคำถาม): จับความรู้สึกหรือปมลึกๆ หลังคำถามทันที แล้วฟันธงคำตอบตรงรูปคำถามตั้งแต่ย่อหน้านี้ ทักว่าถามซ้ำเฉพาะเมื่อถามคำถามเดิมแทบจะเหมือนกันภายในสำรับเดียวกันโดยไม่ได้กดขยายคำถามเดิมเท่านั้น ห้ามทักว่าถามซ้ำเมื่อขึ้นสำรับใหม่หรือเปลี่ยนประเด็น
2. ย่อหน้ากลาง (ผูกหน้าไพ่ + พื้นดวง + Golden Dawn Elemental Dignity เป็นภาพชีวิตจริง): ห้ามไล่ชื่อไพ่ทั้ง 10 ใบเรียงข้อเหมือนท่องตำรา ให้คัดเฉพาะไพ่แกนหลัก 2–5 ใบที่ปะทะหรือเสริมแรงกันมากที่สุด ร้อยเรียงเป็นเรื่องเดียวเชื่อมกับธาตุทักษา ช่วงวัย/ข้อเท็จจริงชีวิตจริงที่ผู้ถามเล่า (userFacts) และกำลังธาตุไพ่ (ไฟ+ลมเสริมแรงไว / น้ำ+ดินปั้นผลมั่นคง / ไฟ+น้ำขัดกันในใจ / ลม+ดินคิดชนข้อจำกัดจริง) แปลเป็นพฤติกรรมจริงที่จับต้องได้ ห้ามพูดประโยคหว่านแหแบบ Barnum ที่ใช้ได้กับทุกคน ห้ามขึ้นบุลเล็ต (• หรือ 1) 2)) และห้ามก๊อปคำซ้ำ
3. ย่อหน้าท้าย (จุดระวังเฉพาะเรื่อง + ก้าวแรกที่ลงมือได้วันนี้): ชี้ราคาที่ต้องจ่าย (Trade-off) หรือจุดระวังที่สอดคล้องกับหน้าไพ่จริงอย่างเพื่อนหวังดี ปิดด้วย 1 ก้าวแรกที่เป็นรูปธรรม (หรือ 1 คำถามชวนเจาะจงหากคำถามกว้างมาก)
4. ข้อห้ามเด็ดขาด: ตอบด้วย Target Language เท่านั้น (ไทย / English / 简体中文) ห้ามใส่อีโมจิ ห้ามใช้เครื่องหมายดอกจัน (** หรือ *) หรือ Markdown ห้ามใช้คำว่า AI เอไอ บอท chatbot จอมเวท ไม่อวย สรุปตรงๆ ห้ามใส่หัวข้อแข็งๆ ห้ามขึ้นต้นหรือลงท้ายซ้ำสำนวนเดิมจากรอบก่อนหน้าเด็ดขาด ห้ามมโนอ้างชื่อไพ่ที่ไม่ได้เปิดอยู่บนโต๊ะตอนนี้ และห้ามปิดท้ายด้วยจำนวนไพ่ที่เหลือในสำรับ เช่น "(เหลือไพ่ในสำรับ XX ใบ)" หรือสอนวิธีใช้งานปุ่มในแอป`;

export function sanitizeStreamChunk(chunkText) {
  if (!chunkText) return '';
  return String(chunkText)
    .replace(/\*+/g, '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
}

export function sanitizeSatiText(rawText, lang = 'th') {
  if (!rawText) return '';
  const selfName = lang === 'en' ? 'Sati' : lang === 'zh' ? '思谛' : 'สติ';
  return rawText
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
    .replace(/\*+/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\b(AI|เอไอ|บอท|Bot|chatbot)\b/gi, selfName)
    .replace(/จอมเวท/gi, 'หมอดู')
    .replace(/(^|[\s"'(])กู(?=[\s"'.,!?ๆ]|ก็|ว่า|รู้|เห็น|บอก|ขอ|ไม่|อยาก|มอง|$)/g, `$1${selfName}`)
    .replace(/(^|[\s"'(])มึง(?=[\s"'.,!?ๆ]|ก็|จะ|ต้อง|กำลัง|ควร|ไม่|อยาก|ได้|เลย|น่ะ|ล่ะ|$)/g, '$1คุณ')
    .replace(/(?:แม่ง|เหี้ย|สัส|เชี่ย)/g, '')
    .replace(/\s+(?:นะ)?(?:วะ|เว้ย|โว้ย)(?=[\s.,!?]|$)/g, 'นะ')
    .replace(/(สติขอเตือนแบบไม่อวยนะ|ให้แบบไม่อวยเลยนะ|เอาตรงๆ\s*ไม่อวยนะ|พูดตรงๆ\s*ไม่อวยนะ|คำตอบกลางๆ\s*แบบไม่อวยคือ|ขอสรุปตรงๆ\s*แบบเพื่อนเลยนะ|สรุปตรงๆ\s*เลยนะ|สรุปตรงๆ\s*:|สิ่งที่ควรทำตอนนี้\s*:|ก้าวแรกตอนนี้\s*:|What to do now\s*:|First step now\s*:|眼下建议直接这样做：|眼下建议：|眼下第一步：|\(\s*เหลือไพ่(?:ในสำรับ)?\s*\d+\s*ใบ\s*\))/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildCompressedHistoryDigest(recentHistory = []) {
  const rows = (Array.isArray(recentHistory) ? recentHistory : []).slice(-6);
  const recentOpenings = [];
  const digestLines = rows.map((h) => {
    const cleanText = String(h?.text || '').replace(/\s+/g, ' ').trim();
    const isSati = h?.role === 'sati' || ['สติ', 'Sati', '思谛'].includes(h?.speaker);
    if (isSati) {
      if (cleanText) recentOpenings.push(cleanText.slice(0, 55));
      const cardTag = Array.isArray(h?.meta?.cards) && h.meta.cards.length
        ? ` [ไพ่รอบนั้น: ${h.meta.cards.slice(0, 3).map((c) => c.name).join(', ')}]`
        : '';
      return `${h.speaker || 'สติ'}${cardTag}: ${cleanText.slice(0, 120)}${cleanText.length > 120 ? '...' : ''}`;
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

export function buildSatiPromptBundle(body = {}) {
  const {
    userProfile,
    natalCards,
    activeSpread,
    cards,
    remainingCount,
    elementalDignity,
    spreadPatterns = '',
    pastSessionMemory = '',
    question,
    recentHistory,
    isNatal10,
    celticPositions,
    deckNumber = 1,
    deckCarryoverSummary = '',
    questionProfile = null,
    userFacts = [],
    topicSwitchedFrom = '',
    isExpandFollowUp: bodyIsExpand = false,
    lang: rawLang
  } = body && typeof body === 'object' ? body : {};
  const lang = rawLang === 'en' || rawLang === 'zh' ? rawLang : 'th';

  const targetLangDesc = lang === 'en'
    ? 'English (respond completely in warm, direct, candid natural English as Sati)'
    : lang === 'zh'
      ? 'Simplified Chinese / 简体中文 (completely respond in warm, direct, candid natural Chinese as 思谛)'
      : 'Thai / ภาษาไทย (ตอบเป็นภาษาไทยธรรมชาติ จริงใจ เป็นกันเองเหมือนเพื่อน)';

  const spreadArr = Array.isArray(activeSpread) && activeSpread.length > 0
    ? activeSpread
    : (Array.isArray(cards) ? cards : (Array.isArray(activeSpread) ? activeSpread : []));
  const positions3 = ['สถานการณ์ตอนนี้', 'ตัวแปร/จุดที่ต้องระวัง', 'บทสรุป/ทางออก'];
  const formattedSpread = spreadArr.map((c, idx) => {
    const posLabel = (isNatal10 || (Boolean(topicSwitchedFrom) && spreadArr.length === 10)) && Array.isArray(celticPositions)
      ? (celticPositions[idx] || `ตำแหน่งที่ ${idx + 1}`)
      : (spreadArr.length === 1 ? 'คำตอบหลัก' : (positions3[idx] || `ใบที่ ${idx + 1}`));
    const orientationTag = c?.reversed ? ' [กลับหัว / Reversed]' : '';
    const aspects = [c?.work && `งาน:${c.work}`, c?.money && `เงิน:${c.money}`, c?.love && `รัก:${c.love}`, c?.advice && `แนะ:${c.advice}`].filter(Boolean).join(' | ');
    const namePart = c?.name || 'Unknown';
    const thPart = c?.th ? ` (${c.th})` : '';
    const corePart = c?.core ? `: ${c.core}` : '';
    return `- [${posLabel}] ${namePart}${thPart}${orientationTag} [ธาตุ:${c?.suit || 'Major'}${c?.tone ? `, โทน:${c.tone}` : ''}]${corePart}${aspects ? ` (${aspects})` : ''}`;
  }).join('\n');

  const kal = userProfile?.thaksaDetails?.hasKalakini
    ? `มีอักษรกาลกิณีในชื่อ: ${userProfile.thaksaDetails.kalakiniChars.join(',')}`
    : 'ไม่มีอักษรกาลกิณีในชื่อ';
  const thaksaRolesSummary = userProfile?.thaksaDetails?.roles
    ? Object.entries(userProfile.thaksaDetails.roles)
        .map(([role, chars]) => `${role}:[${(chars || []).join('')}]`)
        .join(' | ')
    : '';

  const { digestText, recentOpenings } = buildCompressedHistoryDigest(recentHistory);
  const isExpandFollowUp = Boolean(bodyIsExpand) || /^(ขยายความต่อจากที่ถามไว้ว่า|Please expand further on:|请针对我刚才的问题继续深入讲讲：)/.test(String(question || '').trim());
  const openingStyles = [
    'เปิดประโยคแรกด้วยการฟันธงคำตอบตรงประเด็นทันที (ห้ามทักทาย "สวัสดี" และห้ามขึ้นด้วยคำว่า "ลึกๆ แล้ว")',
    'เปิดประโยคแรกด้วยการสะท้อนความขัดแย้งหรือจุดหักมุมที่เห็นชัดจากหน้าไพ่ชุดนี้ทันที (ห้ามทักทาย "สวัสดี")',
    'เปิดประโยคแรกด้วยการแตะอารมณ์หรือปมสำคัญหลังคำถามอย่างเป็นธรรมชาติ (ห้ามทักทาย "สวัสดี")',
    'เปิดประโยคแรกด้วยการเปรียบเทียบจังหวะชีวิตตอนนี้กับไพ่แกนหลักบนโต๊ะทันที (ห้ามทักทาย "สวัสดี")'
  ];
  const openingDirective = isNatal10
    ? 'เป็นรอบเปิดไพ่พื้นดวง 10 ใบแรก ทักทายอย่างอบอุ่นครั้งเดียวได้ แล้วเชื่อมเข้าพื้นดวงและหน้าไพ่ทันที'
    : openingStyles[((Array.isArray(recentHistory) ? recentHistory.length : 0) + Number(deckNumber || 1)) % openingStyles.length];
  const deckHeader = Number(deckNumber) > 1
    ? `สถานะสำรับปัจจุบัน: สำรับที่ ${deckNumber} (เพิ่งรีเซ็ตสำรับใหม่ 78 ใบ — อ่านจากไพ่ใหม่บนโต๊ะควบคู่พื้นดวง 10 ใบเดิมเท่านั้น ห้ามเอาไพ่ที่ลงกองทิ้งจากสำรับก่อนมาปน)${deckCarryoverSummary ? `\nบันทึกสั้นๆ จากสำรับก่อนหน้า: ${deckCarryoverSummary}` : ''}`
    : '';
  const extNatal = resolveExtendedNatalInfo(userProfile);
  const extNatalLine = extNatal.age
    ? `ช่วงวัยและจักรราศี: อายุราว ${extNatal.age} ปี (${extNatal.lifeStageText}), ${extNatal.zodiacText}, ${extNatal.animalText}`
    : (extNatal.zodiacText ? `จักรราศี: ${extNatal.zodiacText}, ${extNatal.animalText}` : '');
  const factsLine = Array.isArray(userFacts) && userFacts.length > 0
    ? `บริบทชีวิตจริงที่ผู้ถามเคยเล่าไว้ (ใช้ประกอบคำแนะนำให้ตรงตัวตน): ${userFacts.join(' | ')}`
    : '';
  const profileLine = !isNatal10 && questionProfile
    ? `วิเคราะห์คำถาม: topic=${questionProfile.topic || 'general'}, subDomain=${questionProfile.subDomain || 'general'}, intent=${questionProfile.intent || 'explain'}, isBroadOpen=${Boolean(questionProfile.isBroadOpen)}`
    : '';
  const switchLine = topicSwitchedFrom
    ? `คำสั่งสำคัญเมื่อเปลี่ยนประเด็น: ไพ่ 3 ใบเดิมบนโต๊ะถูกเปิดไว้สำหรับหัวข้อ "${topicSwitchedFrom}" จึงดึงไพ่พื้นดวง 10 ใบมาใช้อ่านให้แทนในรอบนี้ — ให้บอกผู้ถามสั้นๆ อย่างเป็นมิตรว่ากำลังอ่านจากไพ่พื้นดวงหลัก และแนะนำให้กดจั่วไพ่เพิ่ม 1-3 ใบหากอยากเจาะลึกเรื่องใหม่นี้โดยตรง`
    : '';
  const cleanSpreadPatterns = typeof spreadPatterns === 'string' ? spreadPatterns.trim() : '';
  const cleanPastMemory = typeof pastSessionMemory === 'string' ? pastSessionMemory.trim() : '';
  const hasReversed = spreadArr.some((c) => Boolean(c?.reversed));

  const userContext = [
    `Target Language: ${targetLangDesc}`,
    deckHeader,
    `ผู้ถาม: ชื่อเล่น "${userProfile?.nickname || 'เพื่อน'}", ชื่อจริง "${userProfile?.fullname || ''}"`,
    `พื้นดวงเกิด: ${userProfile?.dayName || ''}, ธาตุ${userProfile?.elemShort || ''} (${userProfile?.element || ''}), เลขชีวิต ${userProfile?.lifePath || ''}`,
    extNatalLine,
    `ทักษาชื่อ 8 ภูมิ: เด่น ${userProfile?.thaksaStrength || ''} | ${kal}${thaksaRolesSummary ? ` | รายละเอียดภูมิ:${thaksaRolesSummary}` : ''} | ไพ่ประจำตัว: ${userProfile?.birthCard || ''}`,
    factsLine,
    `ไพ่พื้นดวง 10 ใบแรก: ${(natalCards || []).map((c, i) => `${i + 1}.${c?.name || 'Unknown'}${c?.th ? `(${c.th})` : ''}${c?.reversed ? '[กลับหัว]' : ''}`).join(', ')}`,
    `ไพ่ที่เปิดอยู่บนโต๊ะตอนนี้ (${spreadArr.length} ใบ):\n${formattedSpread || 'ยังไม่มีไพ่เปิดเพิ่มเติม'}`,
    elementalDignity ? `กำลังธาตุไพ่ (Golden Dawn Dignity): ${elementalDignity}` : '',
    cleanSpreadPatterns ? `ภาพรวมโครงสร้างไพ่ทั้งชุด (Spread Patterns): ${cleanSpreadPatterns}` : '',
    `ไพ่คงเหลือในสำรับ: ${remainingCount ?? 68}/78 ใบ`,
    cleanPastMemory ? `ความต่อเนื่องจากรอบก่อนหน้า (Cross-Session Memory): ${cleanPastMemory}` : '',
    digestText ? `สรุปบทสนทนาล่าสุดในสำรับนี้:\n${digestText}` : '',
    recentOpenings.length ? `ประโยคเปิดที่ใช้ไปแล้วในตาก่อนหน้า (ห้ามขึ้นต้นซ้ำเด็ดขาด ให้เปลี่ยนมุมเปิดใหม่): ${recentOpenings.join(' | ')}` : '',
    `คำสั่งสไตล์การเปิดประโยคตานี้: ${openingDirective}`,
    profileLine,
    switchLine,
    isExpandFollowUp
      ? `โหมดจั่วไพ่ขยายคำถามเดิม: ผู้ถามตั้งใจจั่วไพ่ใหม่เพิ่มเพื่อขยายความคำถามก่อนหน้า — อ่านไพ่ใหม่เจาะลึกต่อจากคำถามเดิมทันที ห้ามทักว่าถามเรื่องเดิมซ้ำ`
      : '',
    `คำถามล่าสุดที่ต้องตอบให้ตรงประเด็น: "${question || 'ช่วยอ่านสถานการณ์และคำแนะนำตรงๆ จากไพ่ชุดนี้'}"`
  ].filter(Boolean).join('\n');

  return {
    lang,
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
  const ai = createGeminiClient(apiKey, options);
  let rawOutput = '';
  let usedModel = PRIMARY_GEMINI_MODEL;
  let lastErr = null;

  const candidateModels = getCandidateGeminiModels();

  for (const model of candidateModels) {
    const config = buildModelGenerateConfig(model, systemInstruction);
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
        break;
      }
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err || '');
      if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
        markModelQuotaCooldown(model, msg);
      }
    }
  }

  const reply = sanitizeSatiText(rawOutput, lang);
  if (!reply) {
    return { fallback: true, reason: lastErr?.message || 'EMPTY_MODEL_OUTPUT' };
  }
  return { reply, fallback: false, model: usedModel };
}

export function createSatiExpressApp(options = {}) {
  const app = express();
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
    const db = readUsersDB();
    return res.json({ record: db[email] || null });
  });

  app.post('/api/sati/state', (req, res) => {
    const { email, record } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !record) {
      return res.status(400).json({ error: 'Missing email or state record' });
    }
    const db = readUsersDB();
    db[cleanEmail] = {
      ...record,
      updatedAt: new Date().toISOString()
    };
    writeUsersDB(db);
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

        const config = {
          ...buildModelGenerateConfig(model, systemInstruction),
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
              writeSseEvent(res, 'meta', { model });
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
              writeSseEvent(res, 'meta', { model });
            }
            writeSseEvent(res, 'done', {
              ok: true,
              model,
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
          if (/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
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
    const items = readFeedbackDB();
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
    const list = readFeedbackDB();
    list.unshift(entry);
    writeFeedbackDB(list);
    const emailResult = await sendFeedbackNotificationEmail(entry);
    return res.json({
      ok: true,
      entry,
      count: list.length,
      emailSent: Boolean(emailResult.sent),
      ...(emailResult.sent ? {} : { emailReason: emailResult.reason })
    });
  });

  if (fs.existsSync(DIST_DIR)) {
    const indexHtmlPath = path.join(DIST_DIR, 'index.html');
    app.use(express.static(DIST_DIR));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
      if (fs.existsSync(indexHtmlPath)) return res.sendFile(indexHtmlPath);
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
