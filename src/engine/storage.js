/**
 * Persistent Account & Deck State Storage (LocalStorage + Backend JSON Sync)
 * ผูกข้อมูลสำรับไพ่ 78 ใบ (remainingDeck), ไพ่พื้นดวง 10 ใบแรก (natalCards),
 * เหรียญ (coins), ตั๋วเหมาสำรับ (hasDeckPass) และประวัติการสนทนาเข้ากับบัญชี Gmail
 */
const STORAGE_PREFIX = 'sati_account_v1_';
const GRAPHICS_QUALITY_KEY = 'sati_graphics_quality';

export function normalizeGraphicsQuality(mode) {
  return mode === 'high' || mode === 'low' ? mode : 'auto';
}

export function readSavedGraphicsQuality() {
  try {
    const raw = globalThis.localStorage?.getItem(GRAPHICS_QUALITY_KEY);
    return normalizeGraphicsQuality(raw);
  } catch {
    return 'auto';
  }
}

export function persistGraphicsQuality(mode) {
  const clean = normalizeGraphicsQuality(mode);
  try {
    globalThis.localStorage?.setItem(GRAPHICS_QUALITY_KEY, clean);
  } catch {
    // ignore storage restriction
  }
  return clean;
}

export function normalizeSessionMode(mode) {
  return mode === 'quick3' ? 'quick3' : 'natal10';
}

export function buildStoragePayload(state) {
  return {
    user: state.user,
    deckNumber: state.deckNumber,
    deckResetAtIndex: typeof state.deckResetAtIndex === 'number' ? state.deckResetAtIndex : 0,
    deckCarryoverSummary: state.deckCarryoverSummary || '',
    sessionActive: Boolean(state.sessionActive),
    sessionMode: normalizeSessionMode(state.sessionMode),
    activeSessionId: String(state.activeSessionId || ''),
    remainingDeck: state.remainingDeck,
    discardPile: state.discardPile || [],
    natalCards: state.natalCards,
    savedNatalCards: state.savedNatalCards || [],
    natalCompleted: state.natalCompleted,
    activeSpread: state.activeSpread,
    activeSpreadTopic: state.activeSpreadTopic || '',
    activeSpreadPreset: state.activeSpreadPreset || 'past_present_future',
    userContextFacts: Array.isArray(state.userContextFacts) ? state.userContextFacts : [],
    calibrationFeedback: Array.isArray(state.calibrationFeedback) ? state.calibrationFeedback : [],
    earlierContextDigest: state.earlierContextDigest || '',
    chatHistory: state.chatHistory,
    sessionArchives: state.sessionArchives || [],
    lastTopic: state.lastTopic,
    allowReversedCards: state.allowReversedCards !== false,
    graphicsQuality: normalizeGraphicsQuality(state.graphicsQuality)
  };
}

export function shouldResumeSavedSession(rec) {
  if (!rec || !rec.sessionActive) return false;
  if (rec.sessionMode === 'quick3') return false;
  if (!rec.natalCompleted) return false;
  return true;
}

export function archiveQuick3SessionIfNeeded(rec) {
  if (!rec) return { record: rec, archived: false };
  const isQuick3OrIncomplete = rec.sessionActive && (rec.sessionMode === 'quick3' || !rec.natalCompleted);
  if (!isQuick3OrIncomplete) return { record: rec, archived: false };

  const prevArchives = Array.isArray(rec.sessionArchives) ? [...rec.sessionArchives] : [];
  const hasChat = Array.isArray(rec.chatHistory) && rec.chatHistory.length > 0;
  let archived = false;

  if (hasChat) {
    const archiveId = String(rec.activeSessionId || '').trim() || `sess_q3_${Date.now().toString(36)}`;
    if (!prevArchives.some((a) => a && a.id === archiveId)) {
      const usedCount =
        (Array.isArray(rec.discardPile) ? rec.discardPile.length : 0) +
        (Array.isArray(rec.activeSpread) ? rec.activeSpread.length : 0);
      prevArchives.unshift({
        id: archiveId,
        mode: 'quick3',
        endedAt: rec.updatedAt || new Date().toISOString(),
        user: { ...(rec.user || {}) },
        natalCards: [],
        chatHistory: [...rec.chatHistory],
        usedCount
      });
      archived = true;
    }
  }

  return {
    archived,
    record: {
      ...rec,
      sessionActive: false,
      sessionMode: 'natal10',
      activeSessionId: '',
      natalCompleted: false,
      natalCards: [],
      activeSpread: [],
      activeSpreadTopic: '',
      discardPile: [],
      chatHistory: [],
      userContextFacts: [],
      earlierContextDigest: '',
      deckResetAtIndex: 0,
      deckCarryoverSummary: '',
      savedNatalCards: Array.isArray(rec.savedNatalCards) ? [...rec.savedNatalCards] : [],
      sessionArchives: prevArchives
    }
  };
}

export function detectInAppBrowser(userAgent = '') {
  const ua = String(userAgent || '');
  if (!ua) return '';
  if (/Line\//i.test(ua)) return 'line';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|Messenger/i.test(ua)) return 'facebook';
  return '';
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
        calibrationFeedback: [],
        earlierContextDigest: '',
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
