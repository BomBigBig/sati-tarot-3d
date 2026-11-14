/**
 * Persistent Account & Deck State Storage (LocalStorage + Backend JSON Sync)
 * ผูกข้อมูลสำรับไพ่ 78 ใบ (remainingDeck), ไพ่พื้นดวง 10 ใบแรก (natalCards),
 * เหรียญ (coins), ตั๋วเหมาสำรับ (hasDeckPass) และประวัติการสนทนาเข้ากับบัญชี Gmail
 */
const STORAGE_PREFIX = 'sati_account_v1_';

export function buildStoragePayload(state) {
  return {
    user: state.user,
    coins: state.coins,
    hasDeckPass: Boolean(state.hasDeckPass),
    hasVipPass: Boolean(state.hasVipPass),
    vipExpiresAt: state.vipExpiresAt || null,
    freeChatQuota: typeof state.freeChatQuota === 'number' ? state.freeChatQuota : 1,
    deckNumber: state.deckNumber,
    remainingDeck: state.remainingDeck,
    natalCards: state.natalCards,
    natalCompleted: state.natalCompleted,
    activeSpread: state.activeSpread,
    chatHistory: state.chatHistory,
    lastTopic: state.lastTopic
  };
}

export async function loadAccountState(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  // 1. Try Backend DB first
  try {
    const res = await fetch(`/api/sati/state?email=${encodeURIComponent(cleanEmail)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.record && data.record.natalCompleted) {
        localStorage.setItem(STORAGE_PREFIX + cleanEmail, JSON.stringify(data.record));
        return data.record;
      }
    }
  } catch {
    // Fallback to localStorage
  }

  // 2. Fallback to LocalStorage
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + cleanEmail);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.natalCompleted) return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function saveAccountState(state) {
  const cleanEmail = String(state.user?.email || '').trim().toLowerCase();
  if (!cleanEmail) return;

  const record = buildStoragePayload(state);
  try {
    localStorage.setItem(STORAGE_PREFIX + cleanEmail, JSON.stringify(record));
  } catch {
    // ignore quota error
  }

  try {
    await fetch('/api/sati/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, record })
    });
  } catch {
    // ignore offline error
  }
}

export async function clearAccountState(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return;
  localStorage.removeItem(STORAGE_PREFIX + cleanEmail);
  try {
    await fetch('/api/sati/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, record: { natalCompleted: false } })
    });
  } catch {
    // ignore
  }
}
