/**
 * Procedural Studio Textures for SATI 3D Low-Poly Sanctuary & Fortune-Teller
 * สร้าง CanvasTexture ความละเอียดสูงสำหรับ:
 * - ลายปักทองพระจันทร์-ดวงดาวบนเสื้อคลุมหมอดูสติ
 * - ผ้ากำมะหยี่ปูโต๊ะแปดเหลี่ยมขอบทอง
 * - พรมแขวนผนังกระโจม 3 ผืน (ดวงตาแห่งแสง, เรขาคณิตศักดิ์สิทธิ์, ดวงดาวแปดแฉก)
 * - เนื้อไม้โอ๊คแกะสลักและผ้าใบกระโจม
 */
import * as THREE from 'three';

function drawStar8(ctx, cx, cy, outerR, innerR, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawCrescent(ctx, cx, cy, r, rot, bgColor, fgColor) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.fillStyle = fgColor;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(r * 0.42, -r * 0.1, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function createRobeEmbroideryTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // Deep Burgundy Velvet Base
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#591d2d');
  grad.addColorStop(0.65, '#4b1625');
  grad.addColorStop(1, '#3b101c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle geometric low-poly weave facets
  ctx.fillStyle = 'rgba(255, 220, 180, 0.03)';
  for (let y = 0; y < 512; y += 64) {
    for (let x = 0; x < 512; x += 64) {
      if (((x + y) / 64) % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 64, y);
        ctx.lineTo(x + 32, y + 64);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Golden border trim along bottom hem
  ctx.fillStyle = '#d4a63a';
  ctx.fillRect(0, 446, 512, 54);
  ctx.fillStyle = '#b38222';
  ctx.fillRect(0, 496, 512, 16);
  ctx.strokeStyle = '#f2d379';
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 446, 512, 54);

  // Gold embroidered Stars & Crescent Moons scattered across lower skirt
  const motifs = [
    { type: 'moon', x: 75, y: 315, r: 24, rot: -0.3 },
    { type: 'star', x: 145, y: 270, r: 18 },
    { type: 'star', x: 120, y: 385, r: 22 },
    { type: 'moon', x: 205, y: 345, r: 20, rot: 0.4 },
    { type: 'star', x: 265, y: 280, r: 16 },
    { type: 'moon', x: 325, y: 375, r: 24, rot: -0.2 },
    { type: 'star', x: 385, y: 300, r: 21 },
    { type: 'moon', x: 445, y: 365, r: 22, rot: 0.5 },
    { type: 'star', x: 60, y: 215, r: 14 },
    { type: 'star', x: 256, y: 395, r: 15 },
    { type: 'star', x: 448, y: 230, r: 16 }
  ];

  motifs.forEach((m) => {
    if (m.type === 'star') {
      drawStar8(ctx, m.x, m.y, m.r, m.r * 0.35, '#e2b64b');
    } else {
      drawCrescent(ctx, m.x, m.y, m.r, m.rot, '#4b1625', '#e2b64b');
    }
  });

  // Small gold star sparkles
  ctx.fillStyle = '#f5d87e';
  [[95, 250], [175, 410], [235, 240], [310, 295], [375, 400], [420, 275]].forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function drawCardBracket(ctx, cx, cy, w, h, goldColor) {
  ctx.save();
  ctx.strokeStyle = goldColor;
  ctx.lineWidth = 1.5;
  const hw = w / 2;
  const hh = h / 2;
  const corner = 7;
  // Corner L-brackets
  ctx.beginPath();
  // Top-left
  ctx.moveTo(cx - hw, cy - hh + corner);
  ctx.lineTo(cx - hw, cy - hh);
  ctx.lineTo(cx - hw + corner, cy - hh);
  // Top-right
  ctx.moveTo(cx + hw - corner, cy - hh);
  ctx.lineTo(cx + hw, cy - hh);
  ctx.lineTo(cx + hw, cy - hh + corner);
  // Bottom-right
  ctx.moveTo(cx + hw, cy + hh - corner);
  ctx.lineTo(cx + hw, cy + hh);
  ctx.lineTo(cx + hw - corner, cy + hh);
  // Bottom-left
  ctx.moveTo(cx - hw + corner, cy + hh);
  ctx.lineTo(cx - hw, cy + hh);
  ctx.lineTo(cx - hw, cy + hh - corner);
  ctx.stroke();

  // Subtle center crosshair
  ctx.strokeStyle = 'rgba(224, 179, 71, 0.20)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 3, cy);
  ctx.lineTo(cx + 3, cy);
  ctx.moveTo(cx, cy - 3);
  ctx.lineTo(cx, cy + 3);
  ctx.stroke();
  ctx.restore();
}

export function createVelvetTableClothTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');

  // 1. Deep Plum-Burgundy Velvet Radial Shading
  const grad = ctx.createRadialGradient(256, 256, 25, 256, 256, 258);
  grad.addColorStop(0, '#501c37');
  grad.addColorStop(0.35, '#42162d');
  grad.addColorStop(0.7, '#341023');
  grad.addColorStop(1, '#220816');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // 2. Directional Plush Velvet Microfiber Sheen (Anisotropic nap at ~35 deg)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 230, 245, 0.022)';
  ctx.lineWidth = 1.2;
  for (let offset = -512; offset < 1024; offset += 6) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + 512 * 0.7, 512);
    ctx.stroke();
  }
  // Cross-grain velvet micro-weave
  ctx.strokeStyle = 'rgba(15, 3, 12, 0.035)';
  ctx.lineWidth = 1.0;
  for (let offset = -256; offset < 768; offset += 8) {
    ctx.beginPath();
    ctx.moveTo(offset, 512);
    ctx.lineTo(offset + 512 * 0.7, 0);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Ornate Outer Octagonal Rim with Gold Filigree Double Border
  ctx.save();
  ctx.strokeStyle = '#d4a63a';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const x = 256 + Math.cos(a) * 242;
    const y = 256 + Math.sin(a) * 242;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Inner octagonal hairline
  ctx.strokeStyle = 'rgba(224, 179, 71, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const x = 256 + Math.cos(a) * 232;
    const y = 256 + Math.sin(a) * 232;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Corner gold florets at the 8 vertices
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const x = 256 + Math.cos(a) * 237;
    const y = 256 + Math.sin(a) * 237;
    drawStar8(ctx, x, y, 6, 2.5, '#f0cf74');
  }
  ctx.restore();

  // 4. Gold Thai Thaksa Celestial Compass & Astrological Wheel
  // Concentric astrological degree rings
  const ringRadii = [218, 198, 154, 112, 70];
  ctx.save();
  ringRadii.forEach((r, idx) => {
    ctx.strokeStyle = idx === 0 || idx === 1 ? 'rgba(224, 179, 71, 0.42)' : 'rgba(224, 179, 71, 0.24)';
    ctx.lineWidth = idx === 0 ? 2.2 : 1.2;
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // Astrological degree ticks between radii 198 and 218 (32 ticks)
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI * 2) / 32;
    const isMajor = i % 4 === 0;
    const rIn = isMajor ? 198 : 206;
    const rOut = 218;
    ctx.strokeStyle = isMajor ? '#e5be54' : 'rgba(224, 179, 71, 0.35)';
    ctx.lineWidth = isMajor ? 1.8 : 1.0;
    ctx.beginPath();
    ctx.moveTo(256 + Math.cos(a) * rIn, 256 + Math.sin(a) * rIn);
    ctx.lineTo(256 + Math.cos(a) * rOut, 256 + Math.sin(a) * rOut);
    ctx.stroke();
  }

  // 8 Sacred Thai Thaksa Directional Compass Rays (ทักษา 8 ทิศ)
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const cosA = Math.cos(a);
    const sinA = Math.sin(a);
    // Ray from inner circle to outer ring
    ctx.strokeStyle = 'rgba(240, 207, 116, 0.48)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(256 + cosA * 42, 256 + sinA * 42);
    ctx.lineTo(256 + cosA * 196, 256 + sinA * 196);
    ctx.stroke();

    // Sacred directional diamond / arrowhead at radius 176
    const dx = 256 + cosA * 176;
    const dy = 256 + sinA * 176;
    ctx.fillStyle = '#f0cf74';
    ctx.beginPath();
    ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Intersecting Sacred Geometry Arcs (Vesica Piscis / Celestial Harmony)
  ctx.strokeStyle = 'rgba(224, 179, 71, 0.15)';
  ctx.lineWidth = 1.0;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.arc(256 + Math.cos(a) * 70, 256 + Math.sin(a) * 70, 70, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Center 8-pointed Thaksa Astrological Star
  drawStar8(ctx, 256, 256, 38, 14, 'rgba(230, 185, 75, 0.32)');
  drawStar8(ctx, 256, 256, 22, 9, '#f0cf74');
  ctx.restore();

  // 5. Celtic Cross Tarot Card Placement Marks
  // Position 1: Present (Center)
  const goldBracketColor = 'rgba(224, 179, 71, 0.42)';
  drawCardBracket(ctx, 256, 256, 44, 68, goldBracketColor);
  // Position 2: Challenge (Crossing Present)
  ctx.save();
  ctx.translate(256, 256);
  ctx.rotate(Math.PI / 2);
  drawCardBracket(ctx, 0, 0, 44, 68, 'rgba(224, 179, 71, 0.30)');
  ctx.restore();
  // Position 3: Below / Foundation (South)
  drawCardBracket(ctx, 256, 332, 42, 64, goldBracketColor);
  // Position 4: Past (West)
  drawCardBracket(ctx, 182, 256, 42, 64, goldBracketColor);
  // Position 5: Goal / Above (North)
  drawCardBracket(ctx, 256, 180, 42, 64, goldBracketColor);
  // Position 6: Future (East)
  drawCardBracket(ctx, 330, 256, 42, 64, goldBracketColor);
  // Staff Column (Positions 7, 8, 9, 10 on the right side)
  const staffX = 404;
  [156, 222, 288, 354].forEach((sy) => {
    drawCardBracket(ctx, staffX, sy, 36, 56, 'rgba(224, 179, 71, 0.36)');
  });

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTapestryTexture(variant = 'sun_eye') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const ctx = c.getContext('2d');

  const palettes = {
    sun_eye: { bg: '#631d2b', border: '#c99733', accent: '#dfa93f', sub: '#3e111b', gem: '#9e2a45' },
    sacred_orb: { bg: '#4e2766', border: '#d4a33d', accent: '#2f727d', sub: '#29123a', gem: '#6f1f3d' },
    star_night: { bg: '#182849', border: '#d4a53d', accent: '#e5b94c', sub: '#0e1830', gem: '#2c487a' }
  };
  const pal = palettes[variant] || palettes.sun_eye;

  const grad = ctx.createLinearGradient(0, 0, 0, 384);
  grad.addColorStop(0, pal.bg);
  grad.addColorStop(0.55, pal.bg);
  grad.addColorStop(1, pal.sub);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 384);

  // Subtle woven diamond low-poly facet grain matching hero tunic
  ctx.fillStyle = 'rgba(255, 224, 178, 0.038)';
  for (let gy = 0; gy < 384; gy += 32) {
    for (let gx = 0; gx < 256; gx += 32) {
      if (((gx + gy) / 32) % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.lineTo(gx + 32, gy);
        ctx.lineTo(gx + 16, gy + 32);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // Ornamental gold frame + inner beaded chain line
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 7;
  ctx.strokeRect(12, 12, 232, 344);
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, 208, 320);

  // Top & bottom geometric tapestry frieze band + hanging gold fringe tassels
  ctx.fillStyle = pal.sub;
  ctx.fillRect(24, 24, 208, 22);
  ctx.fillRect(24, 322, 208, 22);
  ctx.fillStyle = pal.border;
  for (let fx = 36; fx < 224; fx += 20) {
    ctx.beginPath();
    ctx.moveTo(fx, 29);
    ctx.lineTo(fx + 6, 35);
    ctx.lineTo(fx, 41);
    ctx.lineTo(fx - 6, 35);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(fx, 327);
    ctx.lineTo(fx + 6, 333);
    ctx.lineTo(fx, 339);
    ctx.lineTo(fx - 6, 333);
    ctx.closePath();
    ctx.fill();
  }
  // Bottom gold fringe comb along lower hem
  for (let tx = 14; tx <= 242; tx += 10) {
    ctx.fillStyle = pal.border;
    ctx.fillRect(tx - 1, 356, 3, 24);
  }

  // Corner filigree scrollwork
  [[24, 46, 1, 1], [232, 46, -1, 1], [24, 322, 1, -1], [232, 322, -1, -1]].forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * 26, y);
    ctx.lineTo(x, y + dy * 26);
    ctx.closePath();
    ctx.fill();
  });

  if (variant === 'sun_eye') {
    drawStar8(ctx, 128, 186, 86, 40, pal.accent);
    ctx.fillStyle = pal.bg;
    ctx.beginPath();
    ctx.arc(128, 186, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(96, 186);
    ctx.quadraticCurveTo(128, 162, 160, 186);
    ctx.quadraticCurveTo(128, 210, 96, 186);
    ctx.stroke();
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(128, 186, 11, 0, Math.PI * 2);
    ctx.fill();
    drawCrescent(ctx, 68, 76, 17, -0.4, pal.bg, pal.accent);
    drawCrescent(ctx, 188, 76, 17, 0.4, pal.bg, pal.accent);
    drawStar8(ctx, 128, 294, 16, 6, pal.accent);
  } else if (variant === 'sacred_orb') {
    // 3-lobed geometric mandala crest (inspired by left-center sanctuary tapestry)
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(128, 184, 76, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(128, 184, 68, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 - Math.PI / 2;
      const lx = 128 + Math.cos(a) * 34;
      const ly = 184 + Math.sin(a) * 34;
      ctx.fillStyle = pal.gem;
      ctx.beginPath();
      ctx.arc(lx, ly, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.fillStyle = pal.border;
    ctx.beginPath();
    ctx.arc(128, 184, 21, 0, Math.PI * 2);
    ctx.fill();
    drawStar8(ctx, 128, 76, 18, 7, pal.border);
    drawStar8(ctx, 128, 292, 18, 7, pal.border);
  } else {
    drawStar8(ctx, 128, 184, 92, 38, pal.accent);
    ctx.fillStyle = pal.sub;
    ctx.beginPath();
    ctx.arc(128, 184, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.border;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 184, 28, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(128, 184, 12, 0, Math.PI * 2);
    ctx.fill();
    drawCrescent(ctx, 64, 76, 16, -0.3, pal.bg, pal.accent);
    drawCrescent(ctx, 192, 294, 16, 0.3, pal.bg, pal.accent);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTentWallTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5a3a2c');
  grad.addColorStop(0.5, '#6b4736');
  grad.addColorStop(1, '#442a20');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = 'rgba(40, 20, 14, 0.25)';
  ctx.lineWidth = 4;
  for (let x = 0; x < 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
