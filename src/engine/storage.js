/**
 * Persistent Account & Deck State Storage (LocalStorage + Backend JSON Sync)
 * ผูกข้อมูลสำรับไพ่ 78 ใบ (remainingDeck), ไพ่พื้นดวง 10 ใบแรก (natalCards),
 * เหรียญ (coins), ตั๋วเหมาสำรับ (hasDeckPass) และประวัติการสนทนาเข้ากับบัญชี Gmail
 */
const STORAGE_PREFIX = 'sati_account_v1_';

export function buildStoragePayload(state) {
  return {
    user: state.user,
    deckNumber: state.deckNumber,
    deckResetAtIndex: typeof state.deckResetAtIndex === 'number' ? state.deckResetAtIndex : 0,
    deckCarryoverSummary: state.deckCarryoverSummary || '',
    sessionActive: Boolean(state.sessionActive),
    remainingDeck: state.remainingDeck,
    discardPile: state.discardPile || [],
    natalCards: state.natalCards,
    savedNatalCards: state.savedNatalCards || [],
    natalCompleted: state.natalCompleted,
    activeSpread: state.activeSpread,
    activeSpreadTopic: state.activeSpreadTopic || '',
    userContextFacts: Array.isArray(state.userContextFacts) ? state.userContextFacts : [],
    chatHistory: state.chatHistory,
    sessionArchives: state.sessionArchives || [],
    lastTopic: state.lastTopic
  };
}

function hasUsableRecord(rec) {
  return Boolean(
    rec &&
      (rec.sessionActive ||
        rec.natalCompleted ||
        (Array.isArray(rec.savedNatalCards) && rec.savedNatalCards.length === 10) ||
        (Array.isArray(rec.sessionArchives) && rec.sessionArchives.length > 0))
  );
}

export async function loadAccountState(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return null;

  // 1. Try Backend DB first
  try {
    const res = await fetch(`/api/sati/state?email=${encodeURIComponent(cleanEmail)}`);
    if (res.ok) {
      const data = await res.json();
      if (hasUsableRecord(data?.record)) {
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
      if (hasUsableRecord(parsed)) return parsed;
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

export async function clearAccountState(email, preserveMeta = null) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail) return;
  const clearedRecord = preserveMeta
    ? {
        ...preserveMeta,
        sessionActive: false,
        natalCompleted: false,
        natalCards: [],
        activeSpread: [],
        activeSpreadTopic: '',
        userContextFacts: [],
        discardPile: [],
        chatHistory: [],
        deckResetAtIndex: 0,
        deckCarryoverSummary: ''
      }
    : { natalCompleted: false, sessionActive: false };

  if (!preserveMeta) {
    localStorage.removeItem(STORAGE_PREFIX + cleanEmail);
  } else {
    try {
      localStorage.setItem(STORAGE_PREFIX + cleanEmail, JSON.stringify(clearedRecord));
    } catch {
      // ignore quota error
    }
  }
  try {
    await fetch('/api/sati/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, record: clearedRecord })
    });
  } catch {
    // ignore
  }
}
