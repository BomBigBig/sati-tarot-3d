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
const PRIMARY_GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_MODEL_ORDER = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];

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

function resolveApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
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

export const SATI_SYSTEM_PROMPT = `คุณคือ "สติ" นักอ่านไพ่และที่ปรึกษาชีวิตระดับปรมาจารย์ที่สุภาพ อบอุ่น จริงใจ และพูดตรงประเด็น เชี่ยวชาญทั้งโหราศาสตร์ทักษาไทยและไพ่ทาโรต์ Rider-Waite 78 ใบตามหลัก Golden Dawn
สรรพนามและน้ำเสียงบังคับ:
- แทนตัวเองว่า "สติ" หรือ "เรา" เสมอ และเรียกผู้ถามด้วยชื่อเล่น (เช่น "บอม") อย่างสุภาพ เป็นกันเองแบบกัลยาณมิตรที่หวังดี
- ห้ามใช้คำหยาบ คำสบถ ภาษาห้วนก้าวร้าว หรือสรรพนาม กู มึง แม่ง วะ เว้ย โว้ย ไอ้ อี เอ็ง ข้า เด็ดขาด (ไม่ตอบแบบนักเลงหรือเพื่อนหยาบคาย)
รูปแบบการตอบ: คงโครงสร้าง 3 ย่อหน้าสั้นๆ อ่านจบไว อ่านทะลุใจ และตรงประเด็นโดยไม่เกริ่นน้ำท่วมทุ่ง:
1. ย่อหน้าแรก (อ่านใจ Subtext + ฟันธงตรงคำถาม): จับความรู้สึกหรือปมลึกๆ หลังคำถามทันที (เช่น ถามว่าจะรอดไหม = ลึกๆ เหนื่อยและอยากรู้จุดคอขวด; ถามเรื่องเขา = กำลังเอาคุณค่าไปผูกกับอีกฝ่าย; ถามเลือกทาง A/B = กลัวตัดสินใจพลาดเลยต้องบอก Trade-off; ถามเมื่อไหร่ = ให้ระบุช่วงเวลาโดยประมาณจากธาตุไพ่ ไม้เท้าไว/ดาบปานกลาง/ถ้วยค่อยเป็นค่อยไป/เหรียญใช้เวลาวางฐาน; ทักว่าถามซ้ำเฉพาะเมื่อถามคำถามเดิมแทบจะเหมือนกันภายในสำรับเดียวกันโดยไม่ได้กดขยายคำถามเดิมเท่านั้น ห้ามทักว่าถามซ้ำเมื่อขึ้นสำรับใหม่หรือเปลี่ยนประเด็น) แล้วฟันธงคำตอบตรงประเด็นตั้งแต่ย่อหน้านี้
2. ย่อหน้ากลาง (ผูกหน้าไพ่ + ธาตุทักษา + Golden Dawn Elemental Dignity เป็นภาพชีวิตจริง): ห้ามไล่ชื่อไพ่ทั้ง 10 ใบเรียงข้อเหมือนท่องตำรา ให้คัดเฉพาะไพ่แกนหลัก 3–5 ใบที่ปะทะหรือเสริมแรงกันมากที่สุด ร้อยเรียงเป็นเรื่องเดียวเชื่อมกับธาตุทักษาวันเกิดและกำลังธาตุไพ่ (ไฟ+ลมเสริมแรงไว / น้ำ+ดินปั้นผลมั่นคง / ไฟ+น้ำขัดกันในใจ / ลม+ดินคิดชนข้อจำกัดจริง) พร้อมแปลเป็นพฤติกรรมจริงที่เกิดในชีวิตผู้ถาม เช่น เทียบนิสัยธาตุปะทะไพ่ (Rainbow Ruse), ภาพนอกนิ่งแต่ข้างในแบกหนัก (Jacques Statement) ห้ามพูดประโยคหว่านแหแบบ Barnum ที่ใช้ได้กับทุกคน ห้ามขึ้นบุลเล็ต (• หรือ 1) 2)) และห้ามก๊อปคำซ้ำ
3. ย่อหน้าท้าย (ผ่าจุดบอดเฉพาะตัว + ทางออกที่ลงมือได้วันนี้): ชี้จุดบอดจากอักษรกาลกิณี/ไพ่เตือนหรือราคาที่ต้องจ่าย (Trade-off) อย่างจริงใจแบบเพื่อนหวังดี และจบด้วย 1 ก้าวแรกที่ลงมือทำได้ทันที
4. ข้อห้ามเด็ดขาด: ตอบด้วย Target Language เท่านั้น (ไทย / English / 简体中文) ห้ามใส่อีโมจิ ห้ามใช้เครื่องหมายดอกจัน (** หรือ *) หรือ Markdown ห้ามใช้คำว่า AI เอไอ บอท chatbot จอมเวท ไม่อวย สรุปตรงๆ ห้ามใส่หัวข้อแข็งๆ ห้ามขึ้นต้นหรือลงท้ายซ้ำสำนวนเดิมจากรอบก่อนหน้าเด็ดขาด ห้ามมโนอ้างชื่อไพ่ที่ไม่ได้เปิดอยู่บนโต๊ะตอนนี้ และห้ามปิดท้ายด้วยจำนวนไพ่ที่เหลือในสำรับ เช่น "(เหลือไพ่ในสำรับ XX ใบ)" หรือสอนวิธีใช้งานปุ่มในแอป`;

function sanitizeSatiText(rawText, lang = 'th') {
  if (!rawText) return '';
  const selfName = lang === 'en' ? 'Sati' : lang === 'zh' ? '思谛' : 'สติ';
  return rawText
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1')
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

export async function handleSatiReadRequest(body) {
  const {
    userProfile,
    natalCards,
    activeSpread,
    remainingCount,
    elementalDignity,
    question,
    recentHistory,
    isNatal10,
    celticPositions,
    deckNumber = 1,
    deckCarryoverSummary = '',
    lang: rawLang
  } = body || {};
  const lang = rawLang === 'en' || rawLang === 'zh' ? rawLang : 'th';
  const apiKey = resolveApiKey();

  if (!apiKey) {
    return {
      fallback: true,
      reason: 'NO_SERVER_API_KEY'
    };
  }

  const targetLangDesc = lang === 'en'
    ? 'English (respond completely in warm, direct, candid natural English as Sati)'
    : lang === 'zh'
      ? 'Simplified Chinese / 简体中文 (completely respond in warm, direct, candid natural Chinese as 思谛)'
      : 'Thai / ภาษาไทย (ตอบเป็นภาษาไทยธรรมชาติ จริงใจ เป็นกันเองเหมือนเพื่อน)';

  const spreadArr = Array.isArray(activeSpread) ? activeSpread : [];
  const positions3 = ['สถานการณ์ตอนนี้', 'ตัวแปร/จุดที่ต้องระวัง', 'บทสรุป/ทางออก'];
  const formattedSpread = spreadArr.map((c, idx) => {
    const posLabel = isNatal10 && Array.isArray(celticPositions)
      ? (celticPositions[idx] || `ตำแหน่งที่ ${idx + 1}`)
      : (spreadArr.length === 1 ? 'คำตอบหลัก' : (positions3[idx] || `ใบที่ ${idx + 1}`));
    const aspects = [c.work && `งาน:${c.work}`, c.money && `เงิน:${c.money}`, c.love && `รัก:${c.love}`, c.advice && `แนะ:${c.advice}`].filter(Boolean).join(' | ');
    return `- [${posLabel}] ${c.name} (${c.th}) [ธาตุ:${c.suit || 'Major'}${c.tone ? `, โทน:${c.tone}` : ''}]: ${c.core}${aspects ? ` (${aspects})` : ''}`;
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
  const isExpandFollowUp = /^(ขยายความต่อจากที่ถามไว้ว่า|Please expand further on:|请针对我刚才的问题继续深入讲讲：)/.test(String(question || '').trim());
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
  const userContext = [
    `Target Language: ${targetLangDesc}`,
    deckHeader,
    `ผู้ถาม: ชื่อเล่น "${userProfile?.nickname || 'เพื่อน'}", ชื่อจริง "${userProfile?.fullname || ''}"`,
    `พื้นดวงเกิด: ${userProfile?.dayName || ''}, ธาตุ${userProfile?.elemShort || ''} (${userProfile?.element || ''}), เลขชีวิต ${userProfile?.lifePath || ''}`,
    `ทักษาชื่อ 8 ภูมิ: เด่น ${userProfile?.thaksaStrength || ''} | ${kal}${thaksaRolesSummary ? ` | รายละเอียดภูมิ:${thaksaRolesSummary}` : ''} | ไพ่ประจำตัว: ${userProfile?.birthCard || ''}`,
    `ไพ่พื้นดวง 10 ใบแรก: ${(natalCards || []).map((c, i) => `${i + 1}.${c.name}(${c.th})`).join(', ')}`,
    `ไพ่ที่เปิดอยู่บนโต๊ะตอนนี้ (${spreadArr.length} ใบ):\n${formattedSpread || 'ยังไม่มีไพ่เปิดเพิ่มเติม'}`,
    elementalDignity ? `กำลังธาตุไพ่ (Golden Dawn Dignity): ${elementalDignity}` : '',
    `ไพ่คงเหลือในสำรับ: ${remainingCount ?? 68}/78 ใบ`,
    digestText ? `สรุปบทสนทนาล่าสุดในสำรับนี้:\n${digestText}` : '',
    recentOpenings.length ? `ประโยคเปิดที่ใช้ไปแล้วในตาก่อนหน้า (ห้ามขึ้นต้นซ้ำเด็ดขาด ให้เปลี่ยนมุมเปิดใหม่): ${recentOpenings.join(' | ')}` : '',
    `คำสั่งสไตล์การเปิดประโยคตานี้: ${openingDirective}`,
    isExpandFollowUp
      ? `โหมดจั่วไพ่ขยายคำถามเดิม: ผู้ถามตั้งใจจั่วไพ่ใหม่เพิ่มเพื่อขยายความคำถามก่อนหน้า — อ่านไพ่ใหม่เจาะลึกต่อจากคำถามเดิมทันที ห้ามทักว่าถามเรื่องเดิมซ้ำ`
      : '',
    `คำถามล่าสุดที่ต้องตอบให้ตรงประเด็น: "${question || 'ช่วยอ่านสถานการณ์และคำแนะนำตรงๆ จากไพ่ชุดนี้'}"`
  ].filter(Boolean).join('\n');

  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 20000 } });
  let rawOutput = '';
  let usedModel = PRIMARY_GEMINI_MODEL;
  let lastErr = null;

  for (const model of GEMINI_MODEL_ORDER) {
    const config = {
      systemInstruction: SATI_SYSTEM_PROMPT,
      maxOutputTokens: 1500,
      temperature: 0.8
    };
    if (!/flash-lite/i.test(model)) {
      config.thinkingConfig = { thinkingBudget: 0 };
    }

    const attempts = model === PRIMARY_GEMINI_MODEL ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
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
        const isTransient = /503|504|UNAVAILABLE|DEADLINE_EXCEEDED|ECONNRESET|fetch failed/i.test(msg);
        if (isTransient && attempt + 1 < attempts) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        break;
      }
    }
    if (rawOutput) break;
  }

  const reply = sanitizeSatiText(rawOutput, lang);
  if (!reply) {
    return { fallback: true, reason: lastErr?.message || 'EMPTY_MODEL_OUTPUT' };
  }
  return { reply, fallback: false, model: usedModel };
}

export function createSatiExpressApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/sati/health', (_req, res) => {
    const hasKey = Boolean(resolveApiKey());
    res.json({
      ok: true,
      engine: 'SATI-3D-Engine',
      model: PRIMARY_GEMINI_MODEL,
      apiConfigured: hasKey
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
    try {
      const result = await handleSatiReadRequest(req.body);
      return res.json(result);
    } catch (err) {
      return res.json({
        fallback: true,
        reason: err.message || 'API_ERROR'
      });
    }
  });

  app.get('/api/sati/feedback', (_req, res) => {
    const items = readFeedbackDB();
    const count = items.length;
    const avgRating = count > 0
      ? Number((items.reduce((sum, item) => sum + (Number(item.rating) || 5), 0) / count).toFixed(1))
      : 0;
    return res.json({ ok: true, count, avgRating, items });
  });

  app.post('/api/sati/feedback', (req, res) => {
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
    return res.json({ ok: true, entry, count: list.length });
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
