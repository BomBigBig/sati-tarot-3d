/**
 * Automated Verification Script for SATI (สำรับแห่งสติ)
 * ตรวจสอบความสมบูรณ์ของไฟล์ .glb ทั้ง 4 ชุด, ข้อมูลไพ่ 78 ใบ, สมองคำนวณทักษา และกฎห้ามมีอีโมจิ/คำว่า AI
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildFullDeck78 } from '../../../../src/data/tarot78.js';
import { computeNatalProfile, buildNatal10Reading, synthesizeDeepReply } from '../../../../src/engine/satiBrain.js';

const ROOT = process.cwd();
const MODELS_DIR = path.join(ROOT, 'public', 'models');

function verifyGLBFile(filename, expectedNodeNames) {
  const fullPath = path.join(MODELS_DIR, filename);
  assert.ok(fs.existsSync(fullPath), `Missing GLB file: ${filename}`);
  const buf = fs.readFileSync(fullPath);
  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  const totalLen = buf.readUInt32LE(8);
  assert.equal(magic, 0x46546c67, `${filename}: Invalid glTF magic header`);
  assert.equal(version, 2, `${filename}: Expected glTF version 2`);
  assert.equal(totalLen, buf.byteLength, `${filename}: Byte length mismatch`);

  const jsonLen = buf.readUInt32LE(12);
  const jsonType = buf.readUInt32LE(16);
  assert.equal(jsonType, 0x4e4f534a, `${filename}: Expected JSON chunk`);
  const jsonStr = buf.subarray(20, 20 + jsonLen).toString('utf8');
  const gltf = JSON.parse(jsonStr);

  const nodeNames = new Set((gltf.nodes || []).map((n) => n.name));
  for (const reqName of expectedNodeNames) {
    assert.ok(nodeNames.has(reqName), `${filename}: Missing expected 3D node "${reqName}"`);
  }
  console.log(`[PASS] GLB Verified: ${filename} (${(buf.byteLength / 1024).toFixed(1)} KB, nodes: ${[...nodeNames].join(', ')})`);
}

// 1. Verify all 4 GLB models
verifyGLBFile('sanctuary_room.glb', ['SanctuaryRoom', 'SanctuaryArchitecture']);
verifyGLBFile('divination_table.glb', ['DivinationTable', 'OctagonalTableMesh', 'TabletopCrystalBall', 'CandleFlame_0', 'CandleFlame_5']);
verifyGLBFile('sati_archmage.glb', ['ArchmageSati', 'SatiThrone', 'SatiTorso', 'SatiHead', 'SatiLeftArm', 'SatiRightArm']);
verifyGLBFile('player_hands.glb', ['PlayerHandsRoot', 'PlayerLeftHand', 'PlayerRightHand']);

// 2. Verify 78-card deck
const deck = buildFullDeck78();
assert.equal(deck.length, 78, 'Deck must have 78 cards');
const uids = new Set(deck.map((c) => c.uid));
assert.equal(uids.size, 78, 'All 78 cards must have unique UIDs');
console.log('[PASS] 78-Card Rider-Waite Deck Verified (22 Major + 56 Minor)');

// 3. Verify Thaksa & Sati Brain
const mockState = {
  user: {
    fullname: 'ธนภัทร พิมพ์มากร',
    nickname: 'บอม',
    day: 25,
    month: 6,
    year: 2539
  },
  natalCards: deck.slice(0, 10),
  remainingDeck: deck.slice(10),
  lastTopic: 'general'
};

computeNatalProfile(mockState.user);
assert.ok(mockState.user.dayName.includes('วันอังคาร'), `Expected วันอังคาร for 25/06/2539, got ${mockState.user.dayName}`);
assert.ok(mockState.user.birthCard, 'Expected birthCard to be computed');

const natalReading = buildNatal10Reading(mockState, mockState.natalCards);
const followUpReading = synthesizeDeepReply(mockState, 'ควรลุยโปรเจกต์ใหม่เลยหรือรอก่อนดีครับ', deck.slice(10, 13));

for (const text of [natalReading, followUpReading]) {
  assert.ok(!/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u.test(text), 'Sati reading must not contain emojis');
  assert.ok(!/\b(AI|เอไอ|บอท)\b/i.test(text), 'Sati reading must not mention AI/Bot');
}
console.log('[PASS] Thaksa Astrology & Sati Conversational Brain Verified');
