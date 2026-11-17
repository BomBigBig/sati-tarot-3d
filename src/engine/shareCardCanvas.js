/**
 * SATI Luxury Shareable Reading Card Generator (.png)
 * วาดการ์ดสรุปคำทำนายพร้อมหน้าไพ่ทาโรต์จริงในธีม Obsidian & Antique Gold สำหรับบันทึกเก็บในเครื่องและแชร์
 */
import { createCardFrontTexture, hydrateDeckCards } from '../data/tarot78.js';
import { normalizeLang, getLocalizedCardShortName, formatCardOrientationBadge } from '../data/tarot78I18n.js';

function segmentTextWords(text, lang = 'th') {
  const str = String(text || '');
  if (!str) return [];
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      const locale = lang === 'en' ? 'en' : lang === 'zh' ? 'zh' : 'th';
      const seg = new Intl.Segmenter(locale, { granularity: 'word' });
      const tokens = [];
      for (const part of seg.segment(str)) {
        tokens.push(part.segment);
      }
      return tokens;
    }
  } catch {
    // Fallback below
  }
  return str.split(/(\s+)/);
}

function wrapLines(ctx, text, maxWidth, lang = 'th') {
  const paragraphs = String(text || '').split(/\r?\n/);
  const lines = [];
  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }
    const tokens = segmentTextWords(trimmed, lang);
    let current = '';
    for (const tok of tokens) {
      const candidate = current + tok;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current.trimEnd());
        current = tok.trimStart();
      } else {
        current = candidate;
      }
    }
    if (current.trim()) lines.push(current.trimEnd());
  }
  return lines;
}

function drawChamferRect(ctx, x, y, w, h, cut = 18) {
  ctx.beginPath();
  ctx.moveTo(x + cut, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h - cut);
  ctx.lineTo(x + w - cut, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.lineTo(x, y + cut);
  ctx.closePath();
}

function drawStarEmblem(ctx, cx, cy, outerR, innerR, points = 8, color = '#f3d266') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function formatShareTimestamp(isoOrDate, lang = 'th') {
  const dt = isoOrDate ? new Date(isoOrDate) : new Date();
  const safeDt = Number.isNaN(dt.getTime()) ? new Date() : dt;
  const locale = lang === 'en' ? 'en-US' : lang === 'zh' ? 'zh-CN' : 'th-TH';
  return safeDt.toLocaleString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const SHARE_COPY = {
  th: {
    brandSub: 'บันทึกคำทำนายเฉพาะบุคคล · โดยหมอดูสติ',
    seekerPrefix: 'เจ้าชะตา:',
    natalBadge: 'ผังพื้นดวง 10 ใบแรก (อดีต - ปัจจุบัน - อนาคต)',
    questionPrefix: 'คำถาม:',
    cardsTitle: 'หน้าไพ่ที่เปิดได้ในรอบนี้',
    readingTitle: 'คำทำนายและคำแนะนำจากสติ',
    footerLeft: 'SATI 3D TAROT & THAKSA',
    footerRight: (ts) => `บันทึกเมื่อ ${ts}`
  },
  en: {
    brandSub: 'Personal Tarot & Thaksa Reading Archive · Master Sati',
    seekerPrefix: 'Seeker:',
    natalBadge: 'Initial 10-Card Natal Spread (Past – Present – Future)',
    questionPrefix: 'Question:',
    cardsTitle: 'Cards Drawn in This Reading',
    readingTitle: "Sati's Reading & Practical Guidance",
    footerLeft: 'SATI 3D TAROT & THAKSA',
    footerRight: (ts) => `Saved ${ts}`
  },
  zh: {
    brandSub: '思谛（SATI）个人专属塔罗命理记录卡',
    seekerPrefix: '问卜者：',
    natalBadge: '最初十张本命牌阵（过去 · 现在 · 未来）',
    questionPrefix: '所问问题：',
    cardsTitle: '本轮抽出的牌面',
    readingTitle: '思谛解读与行动建议',
    footerLeft: 'SATI 3D TAROT & THAKSA',
    footerRight: (ts) => `记录于 ${ts}`
  }
};

const SHORT_NATAL_POS = {
  th: ['1. ปัจจุบัน', '2. อุปสรรค', '3. รากฐาน', '4. อดีต', '5. เป้าหมาย', '6. อนาคต', '7. ท่าทีเรา', '8. รอบข้าง', '9. ในใจ', '10. บทสรุป'],
  en: ['1. Present', '2. Challenge', '3. Root', '4. Past', '5. Goal', '6. Near Future', '7. Self', '8. Surroundings', '9. Hope/Fear', '10. Outcome'],
  zh: ['1. 现状', '2. 阻力', '3. 根基', '4. 过去', '5. 目标', '6. 近期', '7. 态度', '8. 环境', '9. 隐忧', '10. 结局']
};

/**
 * Draw a single tarot card slot (rotated 180deg when reversed + localized reversed badge)
 */
function drawShareTarotCardSlot(ctx, {
  cx,
  cy,
  cardW,
  cardH,
  card,
  posShort,
  targetLang,
  fontFamily,
  borderColor,
  borderWidth,
  shadowBlur,
  shadowOffsetY,
  posFontSize,
  titleFontSize,
  posOffsetY,
  titleOffsetY,
  maxTextWidth
}) {
  const isReversed = Boolean(card?.reversed);

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetY = shadowOffsetY;
  ctx.fillStyle = '#efe5d2';
  ctx.fillRect(cx, cy, cardW, cardH);
  ctx.restore();

  const tex = createCardFrontTexture(card);
  if (tex?.image) {
    if (isReversed) {
      ctx.save();
      ctx.translate(cx + cardW / 2, cy + cardH / 2);
      ctx.rotate(Math.PI);
      ctx.drawImage(tex.image, -cardW / 2, -cardH / 2, cardW, cardH);
      ctx.restore();
    } else {
      ctx.drawImage(tex.image, cx, cy, cardW, cardH);
    }
  }

  ctx.strokeStyle = isReversed ? '#fda4af' : borderColor;
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(cx, cy, cardW, cardH);

  const titleShort = getLocalizedCardShortName(card, targetLang);
  const revBadge = formatCardOrientationBadge(card, targetLang);
  const titleWithBadge = revBadge ? `${titleShort} ${revBadge}` : titleShort;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#d4af37';
  ctx.font = `600 ${posFontSize}px ${fontFamily}`;
  ctx.fillText(posShort, cx + cardW / 2, cy + cardH + posOffsetY, maxTextWidth);
  ctx.fillStyle = isReversed ? '#fecdd3' : '#f4efe6';
  ctx.font = `600 ${titleFontSize}px ${fontFamily}`;
  ctx.fillText(titleWithBadge, cx + cardW / 2, cy + cardH + titleOffsetY, maxTextWidth);
}

/**
 * Render a styled luxury Reading Card PNG Data URL (containing actual card artwork)
 */
export async function generateReadingShareCardDataURL({
  entry,
  question = '',
  breakdown = null,
  user = {},
  lang = 'th',
  timestamp = new Date().toISOString()
}) {
  if (typeof document === 'undefined') return '';
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // continue with available fonts
    }
  }

  const targetLang = normalizeLang(lang);
  const copy = SHARE_COPY[targetLang] || SHARE_COPY.th;
  const W = 1080;
  const PAD = 64;
  const INNER_W = W - PAD * 2;
  const fontFamily = '"Noto Serif Thai", "Noto Serif SC", Georgia, serif';

  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d');

  // Resolve cards to render
  const rawList = breakdown?.fullSpreadCards?.length
    ? breakdown.fullSpreadCards
    : breakdown?.primaryCards?.length
      ? breakdown.primaryCards
      : [];
  const cardsList = rawList.length > 0
    ? rawList.slice(0, 10)
    : hydrateDeckCards(entry?.meta?.cards || []).slice(0, 10).map((card, i) => ({
        card,
        posLabel: `#${i + 1}`,
        polarity: 'balanced'
      }));

  // Measure Question plaque height
  const cleanQ = (question || entry?.meta?.question || '').trim();
  const isNatal10 = Boolean(breakdown?.isNatal10 || entry?.meta?.isNatal10);
  const qText = isNatal10 ? copy.natalBadge : `${copy.questionPrefix} ${cleanQ || copy.natalBadge}`;
  mCtx.font = `600 28px ${fontFamily}`;
  const qLines = wrapLines(mCtx, qText, INNER_W - 60, targetLang);
  const qBoxH = Math.max(76, 36 + qLines.length * 40);

  // Measure Cards section height
  const isGrid10 = cardsList.length > 3;
  let cardsSectionH = 0;
  if (cardsList.length > 0) {
    if (isGrid10) {
      const rows = Math.ceil(cardsList.length / 5);
      cardsSectionH = 54 + rows * 324;
    } else {
      cardsSectionH = 54 + 382;
    }
  }

  // Measure Reading text height
  const readingText = (entry?.text || '').trim();
  mCtx.font = `400 26px ${fontFamily}`;
  const rLines = wrapLines(mCtx, readingText, INNER_W - 64, targetLang);
  const rLineHeight = 41;
  const readingBoxH = Math.max(180, 96 + rLines.reduce((acc, l) => acc + (l === '' ? 18 : rLineHeight), 0));

  const headerH = 214;
  const footerH = 92;
  const gaps = 26 + (cardsList.length > 0 ? 30 : 0) + 30 + 26;
  const H = Math.max(1080, headerH + qBoxH + cardsSectionH + readingBoxH + footerH + gaps);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 1. Deep Obsidian & Midnight Velvet Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#090b16');
  bgGrad.addColorStop(0.45, '#13172e');
  bgGrad.addColorStop(1, '#0b0d19');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle Radial Candlelight / Arcane Glow behind cards
  const radGlow = ctx.createRadialGradient(W / 2, 340, 40, W / 2, 340, 560);
  radGlow.addColorStop(0, 'rgba(212, 175, 55, 0.14)');
  radGlow.addColorStop(0.6, 'rgba(110, 72, 196, 0.08)');
  radGlow.addColorStop(1, 'rgba(9, 11, 22, 0)');
  ctx.fillStyle = radGlow;
  ctx.fillRect(0, 0, W, H);

  // 2. Luxury Double Chamfered Antique Gold Border
  ctx.save();
  drawChamferRect(ctx, 22, 22, W - 44, H - 44, 24);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.85)';
  ctx.lineWidth = 3;
  ctx.stroke();

  drawChamferRect(ctx, 32, 32, W - 64, H - 64, 20);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.32)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Corner Stars
  [[52, 52], [W - 52, 52], [52, H - 52], [W - 52, H - 52]].forEach(([sx, sy]) => {
    drawStarEmblem(ctx, sx, sy, 9, 3.5, 4, '#d4af37');
  });

  // 3. Top Header
  drawStarEmblem(ctx, W / 2, 80, 18, 6.5, 8, '#f3d266');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f4ecda';
  ctx.font = `700 42px ${fontFamily}`;
  ctx.fillText('SATI · สำรับแห่งสติ', W / 2, 134);

  ctx.fillStyle = '#d4af37';
  ctx.font = `500 22px ${fontFamily}`;
  ctx.fillText(copy.brandSub, W / 2, 168);

  const seekerLabel = [
    user?.nickname ? `${copy.seekerPrefix} ${user.nickname}` : '',
    user?.dayName || '',
    user?.elemShort ? `ธาตุ${user.elemShort}` : '',
    user?.birthCard || ''
  ].filter(Boolean).join('  ·  ');

  if (seekerLabel) {
    ctx.fillStyle = '#c5c7d4';
    ctx.font = `400 20px ${fontFamily}`;
    ctx.fillText(seekerLabel, W / 2, 200);
  }

  // Divider line
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, 222);
  ctx.lineTo(W / 2 - 22, 222);
  ctx.moveTo(W / 2 + 22, 222);
  ctx.lineTo(W - PAD, 222);
  ctx.stroke();
  drawStarEmblem(ctx, W / 2, 222, 8, 3, 4, '#d4af37');

  let curY = 248;

  // 4. Question / Subject Plaque
  ctx.save();
  drawChamferRect(ctx, PAD, curY, INNER_W, qBoxH, 12);
  ctx.fillStyle = 'rgba(20, 25, 48, 0.9)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Left gold ribbon
  ctx.fillStyle = '#d4af37';
  ctx.fillRect(PAD + 4, curY + 12, 5, qBoxH - 24);
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#f3d266';
  ctx.font = `600 28px ${fontFamily}`;
  let qY = curY + 46;
  for (const ql of qLines) {
    ctx.fillText(ql, PAD + 28, qY);
    qY += 40;
  }
  curY += qBoxH + 30;

  // 5. Tarot Card Front Artwork Showcase
  if (cardsList.length > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d4af37';
    ctx.font = `600 22px ${fontFamily}`;
    ctx.fillText(copy.cardsTitle, W / 2, curY + 20);

    const gridTop = curY + 42;
    if (isGrid10) {
      const cols = 5;
      const cardW = 166;
      const cardH = 249;
      const gapX = 24;
      const rowStep = 324;
      const totalRowW = cols * cardW + (cols - 1) * gapX;
      const startX = (W - totalRowW) / 2;

      cardsList.forEach((item, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const cx = startX + col * (cardW + gapX);
        const cy = gridTop + row * rowStep;

        const shortList = SHORT_NATAL_POS[targetLang] || SHORT_NATAL_POS.th;
        const posShort = (isNatal10 || cardsList.length === 10) && shortList[idx]
          ? shortList[idx]
          : String(item.posLabel || `${idx + 1}`).split(':')[0];

        drawShareTarotCardSlot(ctx, {
          cx,
          cy,
          cardW,
          cardH,
          card: item.card,
          posShort,
          targetLang,
          fontFamily,
          borderColor: item.isCited ? '#f3d266' : 'rgba(212, 175, 55, 0.65)',
          borderWidth: item.isCited ? 3 : 2,
          shadowBlur: 14,
          shadowOffsetY: 6,
          posFontSize: 17,
          titleFontSize: 18,
          posOffsetY: 24,
          titleOffsetY: 49,
          maxTextWidth: cardW + 10
        });
      });
    } else {
      const count = cardsList.length;
      const cardW = count === 1 ? 228 : count === 2 ? 216 : 204;
      const cardH = Math.round(cardW * 1.5);
      const gapX = count === 3 ? 64 : 74;
      const totalW = count * cardW + (count - 1) * gapX;
      const startX = (W - totalW) / 2;

      cardsList.forEach((item, idx) => {
        const cx = startX + idx * (cardW + gapX);
        const cy = gridTop;

        if (idx > 0) {
          ctx.textAlign = 'center';
          ctx.fillStyle = '#d4af37';
          ctx.font = `700 32px ${fontFamily}`;
          ctx.fillText('→', cx - gapX / 2, cy + cardH / 2 + 10);
        }

        const posShort = String(item.posLabel || `${idx + 1}`).split('·')[0].trim().slice(0, 26);

        drawShareTarotCardSlot(ctx, {
          cx,
          cy,
          cardW,
          cardH,
          card: item.card,
          posShort,
          targetLang,
          fontFamily,
          borderColor: '#f3d266',
          borderWidth: 3,
          shadowBlur: 18,
          shadowOffsetY: 8,
          posFontSize: 19,
          titleFontSize: 22,
          posOffsetY: 28,
          titleOffsetY: 58,
          maxTextWidth: cardW + 28
        });
      });
    }
    curY += cardsSectionH + 30;
  }

  // 6. Sati Reading Scroll Box
  ctx.save();
  drawChamferRect(ctx, PAD, curY, INNER_W, readingBoxH, 14);
  ctx.fillStyle = 'rgba(14, 17, 34, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#d4af37';
  ctx.font = `600 21px ${fontFamily}`;
  ctx.fillText(copy.readingTitle, PAD + 32, curY + 42);

  ctx.fillStyle = '#f4efe6';
  ctx.font = `400 26px ${fontFamily}`;
  let ry = curY + 86;
  for (const rl of rLines) {
    if (rl === '') {
      ry += 18;
    } else {
      ctx.fillText(rl, PAD + 32, ry);
      ry += rLineHeight;
    }
  }

  // 7. Footer Stamp
  const formattedTs = formatShareTimestamp(timestamp, targetLang);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, H - 72);
  ctx.lineTo(W - PAD, H - 72);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#d4af37';
  ctx.font = `600 19px ${fontFamily}`;
  ctx.fillText(copy.footerLeft, PAD, H - 42);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#b0a999';
  ctx.font = `400 19px ${fontFamily}`;
  ctx.fillText(copy.footerRight(formattedTs), W - PAD, H - 42);

  return canvas.toDataURL('image/png');
}
