/**
 * SATI (สำรับแห่งสติ) — Main Application Controller
 * เชื่อมโยงระบบเสียง Web Audio, ข้อมูลไพ่ 78 ใบ, สมองทักษา + Gemini Proxy,
 * เอนจิน 3D Low-Poly (.glb) และระบบบันทึกสถานะผูกกับ Gmail
 */
import {
  buildFullDeck78,
  hydrateDeckCards,
  shuffleArray,
  getCardFrontDataURL,
  applyReversedOrientation
} from './data/tarot78.js';
import {
  normalizeLang,
  getLocalizedCardData,
  getLocalizedCelticPositions,
  getLocalizedCardLabelInline,
  getLocalizedCardShortName,
  formatCardOrientationBadge,
  getReversedEnergyNuance
} from './data/tarot78I18n.js';
import { getTextPack, t } from './i18n/translations.js';
import {
  computeNatalProfile,
  requestSatiReading,
  buildReadingBreakdown,
  buildDeckCarryoverSummary,
  detectTopicAndIntent,
  extractUserContextFacts
} from './engine/satiBrain.js';
import { loadAccountState, saveAccountState, detectInAppBrowser } from './engine/storage.js';
import { generateReadingShareCardDataURL, formatShareTimestamp } from './engine/shareCardCanvas.js';
import { createSati3DEngine, CAM_POS } from './scene/satiScene3D.js';

function readSavedLang() {
  try {
    return normalizeLang(window.localStorage?.getItem('sati_lang') || 'th');
  } catch {
    return 'th';
  }
}

function persistLang(lang) {
  try {
    window.localStorage?.setItem('sati_lang', lang);
  } catch {
    // ignore storage restriction
  }
}

function readSavedAllowReversed() {
  try {
    const raw = window.localStorage?.getItem('sati_allow_reversed');
    if (raw === '0' || raw === 'false') return false;
  } catch {
    // ignore storage restriction
  }
  return true;
}

function persistAllowReversed(enabled) {
  try {
    window.localStorage?.setItem('sati_allow_reversed', enabled ? '1' : '0');
  } catch {
    // ignore storage restriction
  }
}

function serializeSpreadCardMeta(c) {
  return { uid: c.uid, name: c.name, th: c.th, ...(c.reversed ? { reversed: true } : {}) };
}

// =========================================================================
// 1. AUDIO SYNTHESIZER (Web Audio API)
// =========================================================================
const SoundFX = {
  ctx: null,
  muted: false,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  playTone(freq, dur, type = 'sine', vol = 0.08) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  },
  playShuffle() {
    if (this.muted || !this.ctx) return;
    for (let i = 0; i < 6; i++) {
      setTimeout(() => this.playTone(160 + i * 25, 0.05, 'triangle', 0.05), i * 65);
    }
  },
  playPick() {
    this.playTone(320, 0.08, 'triangle', 0.07);
    setTimeout(() => this.playTone(480, 0.12, 'sine', 0.05), 40);
  },
  playFlip() {
    this.playTone(523.25, 0.18, 'sine', 0.06);
    setTimeout(() => this.playTone(659.25, 0.25, 'sine', 0.04), 60);
  },
  playSeal() {
    this.playTone(220, 0.22, 'triangle', 0.09);
    setTimeout(() => this.playTone(330, 0.3, 'sine', 0.07), 80);
  },
  playCrystal() {
    this.playTone(587.33, 0.34, 'sine', 0.06);
    setTimeout(() => this.playTone(880, 0.38, 'sine', 0.05), 70);
    setTimeout(() => this.playTone(1174.66, 0.45, 'triangle', 0.035), 140);
  }
};

// =========================================================================
// 2. APPLICATION STATE
// =========================================================================
const state = {
  lang: readSavedLang(),
  allowReversedCards: readSavedAllowReversed(),
  screen: 'login',
  modelsLoaded: false,
  user: {
    email: '',
    fullname: '',
    nickname: '',
    day: null,
    month: null,
    year: null,
    dayName: '',
    element: '',
    thaksaStrength: '',
    lifePath: 9,
    birthCard: '',
    birthCardCore: ''
  },
  cameraMode: '1P',
  cameraUnlocked: false,
  deckNumber: 1,
  deckResetAtIndex: 0,
  deckCarryoverSummary: '',
  lastReadingOffline: false,
  lastReadingModel: '',
  sessionActive: false,
  remainingDeck: [],
  discardPile: [],
  natalCards: [],
  savedNatalCards: [],
  natalCompleted: false,
  activeSpread: [],
  activeSpreadTopic: '',
  pendingDrawTopic: '',
  pendingDrawIsExpand: false,
  userContextFacts: [],
  pickTargetCount: 10,
  isPicking: false,
  isAnimatingShuffle: false,
  isPlayerShuffling: false,
  isThinking: false,
  isSpeaking: false,
  _speakTimer: null,
  chatHistory: [],
  sessionArchives: [],
  lastTopic: 'general',
  selectedPresetCategory: 'love',
  currentMoodKey: 'moodIdle',
  currentPickMode: 'initial',
  currentGalleryFilter: 'ALL',
  lastLiveShareEntry: null,
  lastLiveShareQuestion: '',
  pendingDrawQuestion: '',
  lastShareDataUrl: '',
  dialogueCollapsed: false,
  dockCollapsed: false,
  uiHidden: false,
  handGrab: null,
  isHoveringCrystal: false
};

let engine3D = null;
let pendingSavedRecord = null;

// =========================================================================
// 3. UI & DIALOG HELPERS
// =========================================================================
function openModal(id) {
  const dlg = document.getElementById(id);
  if (dlg && !dlg.open) dlg.showModal();
}

function closeModal(id) {
  const dlg = document.getElementById(id);
  if (dlg && dlg.open) dlg.close();
}

function setupDialogLightDismissFallback() {
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = outside(e, dialog);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, dialog)) dialog.close();
      });
    }
  }
}

function showToast(msg) {
  const el = document.getElementById('toast-box');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 2600);
}

function appendHistory(roleOrSpeaker, text, explicitRole, extra = {}) {
  const isSati = explicitRole === 'sati' || roleOrSpeaker === 'sati' || ['สติ', 'Sati', '思谛'].includes(roleOrSpeaker);
  const speaker = isSati ? t(state.lang, 'satiSpeaker') : roleOrSpeaker;
  const entry = { speaker, role: isSati ? 'sati' : 'user', text, createdAt: new Date().toISOString(), ...extra };
  state.chatHistory.push(entry);
  return entry;
}

function isSatiEntry(entry) {
  return entry?.role === 'sati' || ['สติ', 'Sati', '思谛'].includes(entry?.speaker);
}

function updateStepCoachBar() {
  const el = document.getElementById('sati-step-guide');
  if (!el) return;
  if (state.isPicking) {
    el.textContent = t(state.lang, state.natalCompleted ? 'stepCoachFollowUp' : 'stepCoachPick10');
  } else if (state.natalCompleted && state.activeSpread.length === 0) {
    el.textContent = t(state.lang, 'stepCoachChatSavedNatal');
  } else {
    el.textContent = t(state.lang, 'stepCoachChat');
  }
}

function updateLiveDialogueActions() {
  const wrap = document.getElementById('dialogue-footer-actions');
  if (!wrap) return;
  const lastEntry = state.lastLiveShareEntry;
  if (!lastEntry || state.isThinking || state.isPicking) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');
}

function setDialogueCollapsed(collapsed) {
  state.dialogueCollapsed = collapsed;
  document.getElementById('dialogue-content').classList.toggle('hidden', collapsed);
  document.getElementById('dialogue-preview').classList.toggle('hidden', !collapsed);
  document.getElementById('btn-toggle-dialogue').textContent = t(
    state.lang,
    collapsed ? 'btnExpandBox' : 'btnCollapseBox'
  );
}

function setSatiDialogue(text, moodKey = 'moodChat', recordHistory = true, isLoading = false, historyMeta = null) {
  state.currentMoodKey = moodKey;
  document.getElementById('sati-mood-tag').textContent = t(state.lang, moodKey) || moodKey;
  const offlineBadge = document.getElementById('sati-offline-badge');
  if (offlineBadge) {
    const showOffline = !isLoading && Boolean(state.lastReadingOffline) && Boolean(historyMeta);
    offlineBadge.classList.toggle('hidden', !showOffline);
  }
  const box = document.getElementById('dialogue-content');
  box.textContent = text;
  document.getElementById('dialogue-preview').textContent = text.replace(/\s+/g, ' ').trim();
  box.scrollTop = isLoading && box.scrollHeight > box.clientHeight ? box.scrollHeight : 0;
  if (recordHistory) {
    const entry = appendHistory('sati', text, 'sati', historyMeta ? { meta: historyMeta } : {});
    if (historyMeta && Array.isArray(historyMeta.cards) && historyMeta.cards.length > 0) {
      state.lastLiveShareEntry = entry;
      state.lastLiveShareQuestion = historyMeta.question || '';
    } else if (!historyMeta) {
      state.lastLiveShareEntry = null;
      state.lastLiveShareQuestion = '';
    }
  } else if (isLoading) {
    state.lastLiveShareEntry = null;
  }
  updateLiveDialogueActions();
  clearTimeout(state._speakTimer);
  if (!isLoading) {
    state.isSpeaking = true;
    const durMs = Math.min(7200, Math.max(2800, text.length * 32));
    state._speakTimer = setTimeout(() => {
      state.isSpeaking = false;
    }, durMs);
  } else {
    state.isSpeaking = false;
  }
}

function syncDonateQrPreviewState() {
  const img = document.getElementById('donate-qr-img');
  const frame = document.getElementById('donate-qr-frame');
  const placeholder = document.getElementById('donate-qr-placeholder');
  const dlBtn = document.getElementById('btn-download-donate-qr');
  if (!img) return;
  const loaded = img.complete && img.naturalWidth > 0;
  frame?.classList.toggle('hidden', !loaded);
  dlBtn?.classList.toggle('hidden', !loaded);
  placeholder?.classList.toggle('hidden', loaded);
}

function openSupportModal() {
  SoundFX.playPick();
  syncDonateQrPreviewState();
  openModal('modal-support');
}

function renderPresetCategoryTabs() {
  const bar = document.getElementById('preset-category-bar');
  if (!bar) return;
  bar.querySelectorAll('.preset-cat-btn').forEach((btn) => {
    const active = btn.dataset.cat === state.selectedPresetCategory;
    btn.classList.toggle('btn-gold', active);
    btn.classList.toggle('btn-slate', !active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function getLastAskedUserQuestion() {
  const found = [...state.chatHistory]
    .reverse()
    .find((h) => !isSatiEntry(h) && !h.isDrawAction && !h.isExpandAction && String(h.text || '').trim().length > 0);
  return found ? String(found.text).trim() : '';
}

function updateDrawQuestionGateUI() {
  const lang = state.lang;
  const typedQ = document.getElementById('chat-input')?.value.trim() || '';
  const busy = Boolean(state.isPicking || state.isThinking || state.isAnimatingShuffle || state.isPlayerShuffling);
  const canDrawNew = typedQ.length > 0 && !busy;

  ['btn-draw-1', 'btn-draw-3', 'btn-draw-10-opt'].forEach((id) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = !canDrawNew;
    btn.classList.toggle('border-[#f3d266]', canDrawNew);
  });

  const hintEl = document.getElementById('draw-gate-hint');
  if (hintEl) {
    hintEl.textContent = t(lang, typedQ.length > 0 ? 'drawGateReadyHint' : 'drawGateLockedHint');
    hintEl.classList.toggle('text-[#6ee7b7]', typedQ.length > 0);
    hintEl.classList.toggle('text-[#f3d266]', typedQ.length === 0);
  }

  const lastQ = getLastAskedUserQuestion();
  const expandBar = document.getElementById('expand-prev-bar');
  const expandText = document.getElementById('expand-prev-text');
  if (expandBar && expandText) {
    const showExpand = Boolean(lastQ) && state.natalCompleted && !busy;
    expandBar.classList.toggle('hidden', !showExpand);
    if (showExpand) {
      expandText.textContent = t(lang, 'expandPrevLabelFmt', lastQ);
    }
  }
}

function renderSmartPromptChips() {
  renderPresetCategoryTabs();
  const container = document.getElementById('smart-prompt-chips');
  if (!container) return;
  if (state.isPicking || state.isThinking || !state.natalCompleted) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  const map = t(state.lang, 'smartPromptsByTopic') || {};
  const cat = state.selectedPresetCategory || 'love';
  const list = map[cat] || map.general || [];
  container.innerHTML = '';
  if (!Array.isArray(list) || list.length === 0) {
    container.classList.add('hidden');
    return;
  }
  list.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-slate chamfer-sm px-2.5 py-1 text-[11px] text-[#f1ede4] hover:border-[#d4af37] hover:text-[#f3d266] transition shrink-0 whitespace-nowrap cursor-pointer';
    btn.textContent = item.label;
    btn.addEventListener('click', () => {
      if (state.isPicking || state.isThinking) return;
      SoundFX.playPick();
      const input = document.getElementById('chat-input');
      if (input) {
        input.value = item.question;
        input.focus();
      }
      updateDrawQuestionGateUI();
    });
    container.appendChild(btn);
  });
  container.classList.remove('hidden');
}

function updateHUD() {
  const lang = state.lang;
  const remCount = state.remainingDeck.length;
  // Req 2: Discard count reflects ONLY replaced/discarded cards sitting in the discard pile
  const usedCount = state.discardPile.length;

  document.getElementById('hud-deck-count').textContent = `${remCount} / 78`;
  const discardEl = document.getElementById('hud-discard-count');
  if (discardEl) discardEl.textContent = t(lang, 'hudDiscardLabel', usedCount);

  const chatSubmitBtn = document.getElementById('btn-chat-submit');
  if (chatSubmitBtn) {
    chatSubmitBtn.textContent = t(lang, 'btnChatSubmit');
  }

  const camBtn = document.getElementById('btn-camera-toggle');
  camBtn.disabled = !state.cameraUnlocked;
  document.getElementById('hud-cam-label').textContent = t(
    lang,
    state.cameraMode === '1P' ? 'cam1P' : 'cam2P'
  );

  document.getElementById('btn-natal-drawer').classList.toggle('hidden', !state.natalCompleted);
  const show10Opt = !(state.deckNumber < 2 && !state.natalCompleted);
  document.getElementById('btn-draw-10-opt').classList.toggle('hidden', !show10Opt);
  const drawRow = document.getElementById('draw-actions-row');
  if (drawRow) {
    drawRow.classList.toggle('grid-cols-3', show10Opt);
    drawRow.classList.toggle('grid-cols-2', !show10Opt);
  }

  // Req 12: Deck Reset button enabled ONLY when 0-9 unused cards remain (remainingDeck.length <= 9)
  const canResetDeck = remCount <= 9 && !state.isPlayerShuffling && !state.isAnimatingShuffle;
  const reshuffleBtn = document.getElementById('btn-reshuffle');
  if (reshuffleBtn) {
    reshuffleBtn.classList.remove('hidden');
    reshuffleBtn.disabled = !canResetDeck;
    reshuffleBtn.textContent = t(lang, 'btnResetDeck9', remCount);
    reshuffleBtn.classList.toggle('btn-gold', canResetDeck);
    reshuffleBtn.classList.toggle('btn-slate', !canResetDeck);
  }

  // Req 11: Self-shuffle remaining unopened cards (always available while >= 2 cards left)
  const canSelfShuffle = remCount > 1 && !state.isPlayerShuffling && !state.isAnimatingShuffle;
  ['btn-self-shuffle', 'btn-self-shuffle-chat'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !canSelfShuffle;
  });

  const soundStatus = document.getElementById('settings-sound-status');
  if (soundStatus) {
    soundStatus.textContent = t(lang, SoundFX.muted ? 'settingsSoundOff' : 'settingsSoundOn');
  }

  engine3D?.syncDiscardPile3D?.(state.discardPile);
  updateStepCoachBar();
  updateLiveDialogueActions();
  updateDrawQuestionGateUI();
}

function updateActiveStrip() {
  // Req 8: Remove bottom #1/#2 card strip — users inspect face-up cards directly on the 3D table
  const strip = document.getElementById('active-cards-strip');
  if (strip) {
    strip.classList.add('hidden');
    strip.innerHTML = '';
  }
}

function createSatiStreamHandler(moodKey) {
  let pendingText = '';
  let rafPending = false;
  let stopped = false;
  const flush = () => {
    rafPending = false;
    if (stopped || !pendingText) return;
    setSatiDialogue(pendingText, moodKey, false, true);
  };
  return {
    onChunk(accumulatedText) {
      if (stopped || !accumulatedText) return;
      pendingText = accumulatedText;
      if (!rafPending) {
        rafPending = true;
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(flush);
        } else {
          flush();
        }
      }
    },
    stop() {
      stopped = true;
    }
  };
}

function getSpreadSlotTitle(slotIdx, totalSlots, lang) {
  if (totalSlots === 10) {
    const pos = getLocalizedCelticPositions(lang);
    return pos[slotIdx] || '';
  }
  if (totalSlots === 3) {
    const pos3 = getTextPack(lang).spreadPos3;
    return Array.isArray(pos3) ? (pos3[slotIdx] || '') : '';
  }
  if (totalSlots === 1) {
    return t(lang, 'spreadPos1');
  }
  return '';
}

const spreadLabelNodes = [];

function renderSpread3DLabels(items = []) {
  const host = document.getElementById('spread-3d-labels');
  if (!host) return;
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0 || state.screen !== 'game') {
    for (let i = 0; i < spreadLabelNodes.length; i++) {
      spreadLabelNodes[i].classList.add('hidden');
    }
    return;
  }

  const lang = state.lang;
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    let el = spreadLabelNodes[i];
    if (!el) {
      el = document.createElement('div');
      el.className = 'hidden -translate-x-1/2 pointer-events-none absolute px-1.5 py-0.5 bg-[#0e1226]/88 border border-[#d4af37]/65 text-[10px] sm:text-[11px] leading-tight text-[#f4efe6] rounded-[3px] shadow-md whitespace-nowrap flex items-center gap-1';
      host.appendChild(el);
      spreadLabelNodes[i] = el;
    }
    if (!item?.visible) {
      el.classList.add('hidden');
      continue;
    }
    const posTitle = getSpreadSlotTitle(item.slotIdx, item.totalSlots, lang);
    const revMark = item.reversed ? (lang === 'en' ? ' [Rev]' : lang === 'zh' ? ' [逆位]' : ' [กลับหัว]') : '';
    el.textContent = posTitle ? `#${item.slotIdx + 1} · ${posTitle}${revMark}` : `#${item.slotIdx + 1}${revMark}`;
    el.style.left = `${item.xPct}%`;
    el.style.top = `${item.yPct}%`;
    el.classList.toggle('border-[#fb7185]/70', Boolean(item.reversed));
    el.classList.toggle('text-[#fecdd3]', Boolean(item.reversed));
    el.classList.remove('hidden');
  }
  for (let i = list.length; i < spreadLabelNodes.length; i++) {
    spreadLabelNodes[i].classList.add('hidden');
  }
}

function syncReversedToggleUI() {
  const statusEl = document.getElementById('settings-reversed-status');
  const btnEl = document.getElementById('btn-toggle-reversed');
  const enabled = state.allowReversedCards !== false;
  if (statusEl) {
    statusEl.textContent = t(state.lang, enabled ? 'settingsReversedOn' : 'settingsReversedOff');
  }
  if (btnEl) {
    btnEl.textContent = t(state.lang, enabled ? 'btnToggleReversedOn' : 'btnToggleReversedOff');
    btnEl.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    btnEl.classList.toggle('btn-gold', enabled);
    btnEl.classList.toggle('btn-slate', !enabled);
  }
}

function initInAppBrowserBanner() {
  const banner = document.getElementById('inapp-browser-banner');
  if (!banner) return;
  const app = detectInAppBrowser(window.navigator?.userAgent || '');
  let dismissed = false;
  try {
    dismissed = window.localStorage?.getItem('sati_inapp_banner_dismissed') === '1';
  } catch {
    dismissed = false;
  }
  banner.classList.toggle('hidden', !app || dismissed);

  document.getElementById('btn-copy-app-link')?.addEventListener('click', async () => {
    const url = window.location.href;
    let copied = false;
    try {
      if (window.navigator?.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        copied = document.execCommand('copy');
      } catch {
        copied = false;
      }
      ta.remove();
    }
    if (copied) showToast(t(state.lang, 'inAppBannerCopied'));
  });

  document.getElementById('btn-dismiss-inapp-banner')?.addEventListener('click', () => {
    banner.classList.add('hidden');
    try {
      window.localStorage?.setItem('sati_inapp_banner_dismissed', '1');
    } catch {
      // ignore storage restriction
    }
  });
}

function openCardModal(card, posLabel) {
  const lang = state.lang;
  const localized = getLocalizedCardData(card, lang);
  const badge = formatCardOrientationBadge(card, lang);
  const reversedNuance = card?.reversed ? getReversedEnergyNuance(card, lang) : '';
  document.getElementById('modal-card-pos').textContent = badge ? `${posLabel} · ${badge}` : posLabel;
  document.getElementById('modal-card-name').textContent = badge ? `${localized.title} ${badge}` : localized.title;
  document.getElementById('modal-card-th').textContent = localized.subtitle !== localized.title ? localized.subtitle : localized.suitLabel;
  const baseNote = t(lang, 'cardModalMeaning', localized);
  document.getElementById('modal-card-note').textContent = reversedNuance ? `${baseNote}\n\n${badge}: ${reversedNuance}` : baseNote;

  const dataUrl = getCardFrontDataURL(card);
  const artBox = document.getElementById('modal-card-art');
  artBox.innerHTML = '';
  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = localized.title;
  img.className = card?.reversed ? 'w-full h-full object-contain rotate-180' : 'w-full h-full object-contain';
  artBox.appendChild(img);

  openModal('modal-card');
}

function updatePickInstruction() {
  const label = state.currentPickMode === 'followup'
    ? t(state.lang, 'pickFollowUpPrompt', state.pickTargetCount)
    : t(state.lang, 'pickInitialPrompt');
  document.getElementById('pick-instruction').textContent = t(
    state.lang,
    'pickInstructionFmt',
    label,
    state.activeSpread.length,
    state.pickTargetCount
  );
}

function updateResumeBannerInfo() {
  if (!pendingSavedRecord || !pendingSavedRecord.user) return;
  const remCount = pendingSavedRecord.remainingDeck?.length ?? 68;
  document.getElementById('resume-deck-info').textContent = t(
    state.lang,
    'resumeDeckInfo',
    pendingSavedRecord.user.nickname,
    remCount
  );
}

// =========================================================================
// 4. GAMEPLAY LOOP CONTROLLERS
// =========================================================================
function moveActiveSpreadToDiscard() {
  if (!Array.isArray(state.activeSpread) || state.activeSpread.length === 0) return;
  state.activeSpread.forEach((card) => {
    if (card && !state.discardPile.some((c) => c.uid === card.uid)) {
      state.discardPile.push(card);
    }
  });
  state.activeSpread = [];
  state.activeSpreadTopic = '';
}

function enterPickingPhase(count, pickMode = 'initial') {
  state.isPicking = true;
  state.pickTargetCount = count;
  state.currentPickMode = pickMode;
  moveActiveSpreadToDiscard();
  engine3D.tuckNatalSpreadAway3D();
  updateHUD();
  updateActiveStrip();

  document.getElementById('dock-picking').classList.remove('hidden');
  document.getElementById('dock-chat').classList.add('hidden');
  renderSmartPromptChips();
  updatePickInstruction();
  updateStepCoachBar();
  setDialogueCollapsed(false);
}

function startShuffleAndFan(onDone) {
  state.isAnimatingShuffle = true;
  state.cameraUnlocked = false;
  updateHUD();
  SoundFX.playShuffle();
  setSatiDialogue(t(state.lang, 'shufflingDialogue', state.user.nickname), 'moodShuffle', false, true);

  setTimeout(() => {
    state.isAnimatingShuffle = false;
    state.cameraUnlocked = true;
    engine3D.spawn78CardFan();
    updateHUD();
    if (onDone) onDone();
  }, 1900);
}

function handlePickCard(mesh) {
  if (!state.isPicking) return;
  SoundFX.playPick();
  state.handGrab = {
    side: mesh.position.x < 0 ? 'left' : 'right',
    pos: mesh.position.clone(),
    startTime: engine3D.getElapsedTime()
  };
  const cardData = applyReversedOrientation([mesh.userData.cardData], {
    enabled: state.allowReversedCards !== false
  })[0];
  mesh.userData.cardData = cardData;

  state.remainingDeck = state.remainingDeck.filter((c) => c.uid !== cardData.uid);
  state.activeSpread.push(cardData);
  const currentCount = state.activeSpread.length;
  const positions = getLocalizedCelticPositions(state.lang);

  const posName = t(
    state.lang,
    'pickOrderPos',
    currentCount,
    state.pickTargetCount === 10 ? positions[currentCount - 1] : ''
  );
  mesh.userData.posLabel = posName;

  engine3D.placeSpreadCardIn3D(mesh, cardData, currentCount - 1, state.pickTargetCount);
  setTimeout(() => SoundFX.playFlip(), 180);

  updateHUD();
  updateActiveStrip();
  updatePickInstruction();

  if (currentCount >= state.pickTargetCount) {
    finishPickingPhase();
  }
}

async function finishPickingPhase() {
  state.isPicking = false;
  if (state.uiHidden) {
    document.getElementById('top-ui-group').classList.remove('hidden');
    document.getElementById('game-footer').classList.remove('hidden');
    document.getElementById('clean-mode-bar').classList.add('hidden');
    state.uiHidden = false;
  }
  document.getElementById('dock-picking').classList.add('hidden');
  document.getElementById('dock-chat').classList.remove('hidden');
  setDialogueCollapsed(false);

  const toCardMeta = (arr) => (arr || []).map((c) => serializeSpreadCardMeta(c));

  state.isThinking = true;
  renderSmartPromptChips();
  if (!state.natalCompleted && state.pickTargetCount === 10) {
    state.natalCompleted = true;
    state.natalCards = [...state.activeSpread];
    state.activeSpreadTopic = '';
    state.savedNatalCards = state.natalCards.map((c) => serializeSpreadCardMeta(c));
    setSatiDialogue(t(state.lang, 'loadingNatalDialogue', state.user.fullname), 'moodLoadingNatal', false, true);
    const streamCtrl = createSatiStreamHandler('moodLoadingNatal');
    const reply = await requestSatiReading(state, '', state.natalCards, true, { onChunk: streamCtrl.onChunk });
    streamCtrl.stop();
    state.isThinking = false;
    setSatiDialogue(reply, 'moodNatal10', true, false, {
      isNatal10: true,
      cards: toCardMeta(state.natalCards)
    });
  } else {
    const typedQ = document.getElementById('chat-input').value.trim();
    const lastRealUserQ = getLastAskedUserQuestion();
    const q = state.pendingDrawQuestion || typedQ || (lastRealUserQ ? t(state.lang, 'fallbackExpandQ', lastRealUserQ) : t(state.lang, 'fallbackDefaultQ'));
    const drawnProfile = detectTopicAndIntent(q, state.lastTopic);
    state.activeSpreadTopic = state.pendingDrawTopic || (drawnProfile.subDomain && drawnProfile.subDomain !== 'general' ? drawnProfile.subDomain : drawnProfile.topic);
    const isExpandFlow = Boolean(state.pendingDrawIsExpand);
    state.pendingDrawQuestion = '';
    state.pendingDrawTopic = '';
    state.pendingDrawIsExpand = false;
    if (!q) {
      appendHistory(state.user.nickname, t(state.lang, 'drawFollowUpActionLabel', state.pickTargetCount), 'user', { isDrawAction: true });
    }
    state.userContextFacts = extractUserContextFacts(state.chatHistory, state.userContextFacts);
    document.getElementById('chat-input').value = '';
    setSatiDialogue(t(state.lang, 'loadingCardsDialogue', state.user.nickname), 'moodLoadingCards', false, true);
    const streamCtrl = createSatiStreamHandler('moodLoadingCards');
    const reply = await requestSatiReading(state, q, state.activeSpread, false, {
      isExpandFollowUp: isExpandFlow,
      onChunk: streamCtrl.onChunk
    });
    streamCtrl.stop();
    state.isThinking = false;
    setSatiDialogue(reply, 'moodReply', true, false, {
      isNatal10: false,
      question: lastRealUserQ || q,
      cards: toCardMeta(state.activeSpread)
    });
  }
  updateHUD();
  renderSmartPromptChips();
  await saveAccountState(state);
}

function triggerFollowUpDraw(count, _freeViaAd = false, expandPrevious = false) {
  if (state.remainingDeck.length < count) {
    showToast(t(state.lang, 'toastLowDeck'));
    document.getElementById('btn-reshuffle').classList.remove('hidden');
    return;
  }

  if (expandPrevious) {
    const lastQ = getLastAskedUserQuestion();
    if (!lastQ) {
      showToast(t(state.lang, 'toastNeedQuestionBeforeDraw'));
      document.getElementById('chat-input')?.focus();
      return;
    }
    const pExp = detectTopicAndIntent(lastQ, state.activeSpreadTopic || state.lastTopic);
    state.pendingDrawTopic = pExp.subDomain && pExp.subDomain !== 'general' ? pExp.subDomain : pExp.topic;
    state.pendingDrawIsExpand = true;
    state.pendingDrawQuestion = t(state.lang, 'fallbackExpandQ', lastQ);
    appendHistory(state.user.nickname, t(state.lang, 'expandPrevActionLogFmt', count, lastQ), 'user', { isExpandAction: true });
  } else {
    const input = document.getElementById('chat-input');
    const q = input?.value.trim() || '';
    if (!q) {
      showToast(t(state.lang, 'toastNeedQuestionBeforeDraw'));
      input?.focus();
      return;
    }
    const pNew = detectTopicAndIntent(q, state.lastTopic);
    state.pendingDrawTopic = pNew.subDomain && pNew.subDomain !== 'general' ? pNew.subDomain : pNew.topic;
    state.pendingDrawIsExpand = false;
    state.pendingDrawQuestion = q;
    appendHistory(state.user.nickname, q, 'user');
    if (input) input.value = '';
  }

  enterPickingPhase(count, 'followup');
  setSatiDialogue(t(state.lang, 'waitPickFollowUpDialogue', count), 'moodWaitPick', false, false);
}

// =========================================================================
// 5. INITIALIZATION & UI EVENT BINDINGS
// =========================================================================
function syncBirthdateLanguageLabels() {
  const lang = state.lang;
  const pack = getTextPack(lang);
  const daySel = document.getElementById('input-day');
  const monthSel = document.getElementById('input-month');
  const yearSel = document.getElementById('input-year');
  if (daySel?.options?.[0]?.value === '') {
    daySel.options[0].textContent = pack.placeholderDay || 'Day';
  }
  if (monthSel && Array.isArray(pack.months)) {
    [...monthSel.options].forEach((opt) => {
      if (opt.value === '') {
        opt.textContent = pack.placeholderMonth || 'Month';
        return;
      }
      const mIdx = parseInt(opt.value, 10) - 1;
      if (!isNaN(mIdx) && pack.months[mIdx]) opt.textContent = pack.months[mIdx];
    });
  }
  if (yearSel && typeof pack.formatYear === 'function') {
    [...yearSel.options].forEach((opt) => {
      if (opt.value === '') {
        opt.textContent = pack.placeholderYear || 'Year';
        return;
      }
      const beYear = parseInt(opt.value, 10);
      if (!isNaN(beYear)) opt.textContent = pack.formatYear(beYear);
    });
  }
}

function populateBirthdateSelectors() {
  const daySel = document.getElementById('input-day');
  const monthSel = document.getElementById('input-month');
  const yearSel = document.getElementById('input-year');
  const pack = getTextPack(state.lang);
  const months = pack.months;

  const appendPlaceholder = (sel, label) => {
    const ph = document.createElement('option');
    ph.value = '';
    ph.textContent = label;
    ph.selected = true;
    ph.disabled = true;
    sel.appendChild(ph);
  };

  appendPlaceholder(daySel, pack.placeholderDay || 'วัน');
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    daySel.appendChild(opt);
  }

  appendPlaceholder(monthSel, pack.placeholderMonth || 'เดือน');
  months.forEach((m, idx) => {
    const opt = document.createElement('option');
    opt.value = idx + 1;
    opt.textContent = m;
    monthSel.appendChild(opt);
  });

  appendPlaceholder(yearSel, pack.placeholderYear || 'ปี พ.ศ.');
  for (let y = 2555; y >= 2495; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = pack.formatYear(y);
    yearSel.appendChild(opt);
  }
}

function applyLanguage(newLang) {
  const lang = normalizeLang(newLang);
  state.lang = lang;
  persistLang(lang);

  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  document.title = t(lang, 'pageTitle');

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const txt = t(lang, key);
    if (typeof txt === 'string' && txt.length > 0) el.textContent = txt;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    const txt = t(lang, key);
    if (typeof txt === 'string') el.setAttribute('placeholder', txt);
  });

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    const txt = t(lang, key);
    if (typeof txt === 'string') {
      el.setAttribute('title', txt);
      if (el.hasAttribute('aria-label')) el.setAttribute('aria-label', txt);
    }
  });

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    const active = btn.dataset.lang === lang;
    btn.classList.toggle('btn-gold', active);
    btn.classList.toggle('btn-slate', !active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  syncBirthdateLanguageLabels();
  updateResumeBannerInfo();

  if (state.screen === 'ledger' && pendingSavedRecord) {
    const savedNatal = hydrateDeckCards(pendingSavedRecord.savedNatalCards || pendingSavedRecord.natalCards || []);
    const archives = Array.isArray(pendingSavedRecord.sessionArchives) ? pendingSavedRecord.sessionArchives : [];
    const infoEl = document.getElementById('returning-natal-info');
    const ledgerHistBtn = document.getElementById('btn-ledger-history');
    const submitBtn = document.querySelector('#ledger-form button[type="submit"]');
    if (infoEl && savedNatal.length === 10 && pendingSavedRecord.user) {
      const tempUser = { ...pendingSavedRecord.user };
      computeNatalProfile(tempUser);
      infoEl.textContent = t(lang, 'returningNatalInfo', pendingSavedRecord.user.nickname || '', tempUser.birthCard, archives.length);
    }
    if (ledgerHistBtn) ledgerHistBtn.textContent = t(lang, 'btnLedgerHistory', archives.length);
    if (submitBtn && savedNatal.length === 10) submitBtn.textContent = t(lang, 'btnDrawNewNatal');
  }

  const toggleDialogueBtn = document.getElementById('btn-toggle-dialogue');
  if (toggleDialogueBtn) {
    toggleDialogueBtn.textContent = t(lang, state.dialogueCollapsed ? 'btnExpandBox' : 'btnCollapseBox');
  }
  const toggleDockBtn = document.getElementById('btn-toggle-dock');
  if (toggleDockBtn) {
    toggleDockBtn.textContent = t(lang, state.dockCollapsed ? 'btnShowDock' : 'btnHideDock');
  }
  syncReversedToggleUI();
  const moodEl = document.getElementById('sati-mood-tag');
  if (moodEl) {
    moodEl.textContent = t(lang, state.currentMoodKey || 'moodIdle');
  }

  if (state.screen === 'game') {
    updateHUD();
    updateActiveStrip();
    renderSmartPromptChips();
    updateDrawQuestionGateUI();
    if (state.isPicking) {
      updatePickInstruction();
    }
  } else {
    const dlgContent = document.getElementById('dialogue-content');
    if (dlgContent && dlgContent.textContent.trim().length < 30) {
      dlgContent.textContent = t(lang, 'dialogueInitial');
    }
  }

  if (document.getElementById('modal-gallery')?.open) {
    window.dispatchEvent(new CustomEvent('sati:rerender-gallery'));
  }
  if (document.getElementById('modal-feedback')?.open) {
    window.dispatchEvent(new CustomEvent('sati:rerender-feedback'));
  }
  if (document.getElementById('modal-natal')?.open) {
    document.getElementById('btn-natal-drawer')?.click();
  }
  if (document.getElementById('modal-discard')?.open) {
    document.getElementById('btn-discard-pile')?.click();
  }
  if (document.getElementById('modal-history')?.open) {
    document.getElementById('btn-chat-history')?.click();
  }
}

function getOrCreateDeviceAccountId() {
  const key = 'sati_device_account_id';
  try {
    let existing = window.localStorage?.getItem(key);
    if (existing) return existing;
    existing = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage?.setItem(key, existing);
    return existing;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}

async function handleSelectEmailAccount(email, defaultFullname, defaultNickname) {
  state.user.email = email;
  document.getElementById('ledger-email-tag').textContent = t(state.lang, 'ledgerDeviceBadge');

  const saved = await loadAccountState(email);
  pendingSavedRecord = saved;
  const resumeBanner = document.getElementById('resume-session-box');
  const returningBox = document.getElementById('returning-natal-box');
  const submitBtn = document.querySelector('#ledger-form button[type="submit"]');

  if (saved && saved.user) {
    document.getElementById('input-fullname').value = saved.user.fullname || defaultFullname;
    document.getElementById('input-nickname').value = saved.user.nickname || defaultNickname;
    if (saved.user.day) document.getElementById('input-day').value = saved.user.day;
    if (saved.user.month) document.getElementById('input-month').value = saved.user.month;
    if (saved.user.year) document.getElementById('input-year').value = saved.user.year;

    const savedNatal = hydrateDeckCards(saved.savedNatalCards || saved.natalCards || []);
    const archives = Array.isArray(saved.sessionArchives) ? saved.sessionArchives : [];
    state.savedNatalCards = savedNatal;
    state.sessionArchives = archives;

    if (saved.sessionActive && saved.natalCompleted) {
      updateResumeBannerInfo();
      resumeBanner.classList.remove('hidden');
      returningBox?.classList.add('hidden');
      if (submitBtn) submitBtn.textContent = t(state.lang, 'btnDrawNewNatal');
    } else if (savedNatal.length === 10 || archives.length > 0) {
      resumeBanner.classList.add('hidden');
      returningBox?.classList.remove('hidden');
      const infoEl = document.getElementById('returning-natal-info');
      const useSavedBtn = document.getElementById('btn-use-saved-natal');
      const ledgerHistBtn = document.getElementById('btn-ledger-history');

      if (savedNatal.length === 10) {
        const tempUser = { ...saved.user };
        computeNatalProfile(tempUser);
        if (infoEl) infoEl.textContent = t(state.lang, 'returningNatalInfo', saved.user.nickname || '', tempUser.birthCard, archives.length);
        useSavedBtn?.classList.remove('hidden');
        if (submitBtn) submitBtn.textContent = t(state.lang, 'btnDrawNewNatal');
      } else {
        if (infoEl) infoEl.textContent = t(state.lang, 'btnLedgerHistory', archives.length);
        useSavedBtn?.classList.add('hidden');
        if (submitBtn) submitBtn.textContent = t(state.lang, 'btnSubmitLedger');
      }

      if (ledgerHistBtn) {
        ledgerHistBtn.classList.toggle('hidden', archives.length === 0);
        ledgerHistBtn.textContent = t(state.lang, 'btnLedgerHistory', archives.length);
      }
    } else {
      resumeBanner.classList.add('hidden');
      returningBox?.classList.add('hidden');
      if (submitBtn) submitBtn.textContent = t(state.lang, 'btnSubmitLedger');
    }
  } else {
    document.getElementById('input-fullname').value = defaultFullname;
    document.getElementById('input-nickname').value = defaultNickname;
    document.getElementById('input-day').value = '';
    document.getElementById('input-month').value = '';
    document.getElementById('input-year').value = '';
    resumeBanner.classList.add('hidden');
    returningBox?.classList.add('hidden');
    if (submitBtn) submitBtn.textContent = t(state.lang, 'btnSubmitLedger');
  }

  closeModal('modal-gmail');
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-ledger').classList.remove('hidden');
  state.screen = 'ledger';
  engine3D.setCameraTarget(CAM_POS.ledger, CAM_POS.ledgerLook);
  SoundFX.playPick();
}

window.addEventListener('DOMContentLoaded', () => {
  setupDialogLightDismissFallback();
  populateBirthdateSelectors();
  initInAppBrowserBanner();
  applyLanguage(state.lang);

  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      SoundFX.playPick();
      applyLanguage(btn.dataset.lang);
    });
  });

  const canvas = document.getElementById('scene-canvas');
  engine3D = createSati3DEngine({
    canvas,
    state,
    onCardPicked: handlePickCard,
    onSpreadProjection: renderSpread3DLabels,
    onSpreadCardInspect: (card, posLabel) => {
      const idx = state.activeSpread.findIndex((c) => c.uid === card.uid);
      const label = state.activeSpread.length === 10 && idx >= 0
        ? t(state.lang, 'pickOrderPos', idx + 1, getLocalizedCelticPositions(state.lang)[idx])
        : (idx >= 0 ? t(state.lang, 'activeCardLabel', idx) : posLabel);
      openCardModal(card, label);
    },
    onCrystalInspect: () => {
      SoundFX.init();
      SoundFX.playCrystal();
      showToast(t(state.lang, 'toastCrystal'));
      if (!state.isPicking && !state.isThinking && !state.isAnimatingShuffle && !state.isPlayerShuffling && state.screen === 'game') {
        setSatiDialogue(
          t(state.lang, 'crystalDialogue', state.user.nickname),
          'moodCrystal',
          true,
          false
        );
      }
    },
    onDiscardInspect: () => {
      SoundFX.init();
      openDiscardModal();
    },
    onModelsLoaded: () => {}
  });

  // Req 3: Show Welcome Intro Popup before entering Ledger
  document.getElementById('btn-gmail-login').addEventListener('click', () => {
    SoundFX.init();
    SoundFX.playPick();
    openModal('modal-welcome-intro');
  });

  document.getElementById('btn-welcome-confirm')?.addEventListener('click', () => {
    SoundFX.playPick();
    closeModal('modal-welcome-intro');
    handleSelectEmailAccount(getOrCreateDeviceAccountId(), '', '');
  });

  document.querySelectorAll('.gmail-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      handleSelectEmailAccount(btn.dataset.email, btn.dataset.name, btn.dataset.nick);
    });
  });

  // Resume existing saved deck session (only if mid-session without clicking Exit Table)
  document.getElementById('btn-resume-deck').addEventListener('click', () => {
    if (!pendingSavedRecord) return;
    SoundFX.playSeal();

    Object.assign(state.user, pendingSavedRecord.user);
    computeNatalProfile(state.user);
    state.deckNumber = pendingSavedRecord.deckNumber || 1;
    state.deckResetAtIndex = typeof pendingSavedRecord.deckResetAtIndex === 'number' ? pendingSavedRecord.deckResetAtIndex : 0;
    state.deckCarryoverSummary = pendingSavedRecord.deckCarryoverSummary || '';
    state.lastReadingOffline = false;
    state.sessionActive = true;
    state.remainingDeck = pendingSavedRecord.remainingDeck?.length > 0
      ? hydrateDeckCards(pendingSavedRecord.remainingDeck)
      : shuffleArray(buildFullDeck78());
    state.natalCards = hydrateDeckCards(pendingSavedRecord.natalCards || []);
    state.savedNatalCards = hydrateDeckCards(pendingSavedRecord.savedNatalCards || pendingSavedRecord.natalCards || []);
    state.natalCompleted = Boolean(pendingSavedRecord.natalCompleted);
    state.activeSpread = hydrateDeckCards(pendingSavedRecord.activeSpread || []);
    if (Array.isArray(pendingSavedRecord.discardPile)) {
      state.discardPile = hydrateDeckCards(pendingSavedRecord.discardPile);
    } else {
      const excluded = new Set([...state.remainingDeck, ...state.activeSpread].map((c) => c.uid));
      state.discardPile = buildFullDeck78().filter((c) => !excluded.has(c.uid));
    }
    state.chatHistory = pendingSavedRecord.chatHistory || [];
    state.sessionArchives = Array.isArray(pendingSavedRecord.sessionArchives) ? pendingSavedRecord.sessionArchives : [];
    state.allowReversedCards = pendingSavedRecord.allowReversedCards !== undefined
      ? Boolean(pendingSavedRecord.allowReversedCards)
      : readSavedAllowReversed();
    persistAllowReversed(state.allowReversedCards);
    syncReversedToggleUI();
    state.activeSpreadTopic = pendingSavedRecord.activeSpreadTopic || '';
    state.pendingDrawTopic = '';
    state.pendingDrawIsExpand = false;
    state.userContextFacts = Array.isArray(pendingSavedRecord.userContextFacts)
      ? pendingSavedRecord.userContextFacts
      : extractUserContextFacts(state.chatHistory);
    state.lastTopic = pendingSavedRecord.lastTopic || 'general';
    if (['love', 'work', 'money', 'general'].includes(state.lastTopic)) {
      state.selectedPresetCategory = state.lastTopic;
    }

    document.getElementById('pregame-lang-bar')?.classList.add('hidden');
    document.getElementById('screen-ledger').classList.add('hidden');
    document.getElementById('top-hud').classList.remove('hidden');
    document.getElementById('sati-speech-wrap').classList.remove('hidden');
    document.getElementById('game-footer').classList.remove('hidden');
    document.getElementById('dock-picking').classList.add('hidden');
    document.getElementById('dock-chat').classList.remove('hidden');

    state.screen = 'game';
    state.cameraMode = '1P';
    state.cameraUnlocked = true;
    engine3D.setCameraTarget(CAM_POS.view1P, CAM_POS.view1PLook);
    engine3D.spawn78CardFan();
    engine3D.syncDiscardPile3D?.(state.discardPile);
    updateHUD();
    updateActiveStrip();
    renderSmartPromptChips();

    const lastSatiMsg = [...state.chatHistory].reverse().find((h) => isSatiEntry(h));
    if (lastSatiMsg?.meta?.cards?.length) {
      state.lastLiveShareEntry = lastSatiMsg;
      state.lastLiveShareQuestion = lastSatiMsg.meta.question || '';
    }
    setSatiDialogue(
      lastSatiMsg
        ? lastSatiMsg.text
        : t(state.lang, 'welcomeBackDialogue', state.user.nickname, state.remainingDeck.length),
      'moodResume',
      false,
      false
    );
  });

  // Req 9.1 / 9.2: Returning User Chooses to Reuse Saved 10 Natal Cards with Full Fresh 78 Deck
  document.getElementById('btn-use-saved-natal')?.addEventListener('click', async () => {
    const saved = pendingSavedRecord;
    const saved10 = hydrateDeckCards(saved?.savedNatalCards || saved?.natalCards || state.savedNatalCards || []);
    if (saved10.length !== 10) return;

    SoundFX.playSeal();
    const formNick = document.getElementById('input-nickname')?.value.trim();
    const formFull = document.getElementById('input-fullname')?.value.trim();
    if (saved?.user) Object.assign(state.user, saved.user);
    if (formNick) state.user.nickname = formNick;
    if (formFull) state.user.fullname = formFull;
    computeNatalProfile(state.user);

    state.deckNumber = 1;
    state.deckResetAtIndex = 0;
    state.deckCarryoverSummary = '';
    state.lastReadingOffline = false;
    state.sessionActive = true;
    state.natalCards = saved10;
    state.savedNatalCards = saved10.map((c) => serializeSpreadCardMeta(c));
    state.natalCompleted = true;
    state.activeSpread = [];
    state.activeSpreadTopic = '';
    state.pendingDrawTopic = '';
    state.pendingDrawIsExpand = false;
    state.userContextFacts = [];
    state.discardPile = [];
    state.chatHistory = [];
    state.pendingDrawQuestion = '';
    const chatInputEl = document.getElementById('chat-input');
    if (chatInputEl) chatInputEl.value = '';
    state.sessionArchives = Array.isArray(saved?.sessionArchives) ? saved.sessionArchives : state.sessionArchives;
    state.remainingDeck = shuffleArray(buildFullDeck78());

    document.getElementById('pregame-lang-bar')?.classList.add('hidden');
    document.getElementById('screen-ledger').classList.add('hidden');
    document.getElementById('top-hud').classList.remove('hidden');
    document.getElementById('sati-speech-wrap').classList.remove('hidden');
    document.getElementById('game-footer').classList.remove('hidden');
    document.getElementById('dock-picking').classList.add('hidden');
    document.getElementById('dock-chat').classList.remove('hidden');

    state.screen = 'game';
    state.cameraMode = '1P';
    engine3D.setCameraTarget(CAM_POS.view1P, CAM_POS.view1PLook);
    engine3D.clearDiscardPile3D?.();
    updateHUD();
    updateActiveStrip();

    startShuffleAndFan(() => {
      renderSmartPromptChips();
      setSatiDialogue(
        t(state.lang, 'welcomeUseSavedNatalDialogue', state.user.nickname),
        'moodResume',
        true,
        false
      );
      saveAccountState(state);
    });
  });

  // Start Fresh Deck (Draw New 10 Natal Cards with Full 78 Deck while preserving account coins/VIP/archives)
  document.getElementById('ledger-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    SoundFX.playSeal();
    state.user.nickname = document.getElementById('input-nickname').value.trim();
    state.user.fullname = document.getElementById('input-fullname').value.trim();
    state.user.day = parseInt(document.getElementById('input-day').value, 10);
    state.user.month = parseInt(document.getElementById('input-month').value, 10);
    state.user.year = parseInt(document.getElementById('input-year').value, 10);
    computeNatalProfile(state.user);

    const prevSaved = pendingSavedRecord;
    if (prevSaved) {
      state.sessionArchives = Array.isArray(prevSaved.sessionArchives) ? prevSaved.sessionArchives : [];
      state.savedNatalCards = Array.isArray(prevSaved.savedNatalCards) ? prevSaved.savedNatalCards : [];
    } else {
      state.sessionArchives = [];
      state.savedNatalCards = [];
    }

    state.sessionActive = true;
    state.natalCompleted = false;
    state.natalCards = [];
    state.activeSpread = [];
    state.activeSpreadTopic = '';
    state.pendingDrawTopic = '';
    state.pendingDrawIsExpand = false;
    state.userContextFacts = [];
    state.discardPile = [];
    state.chatHistory = [];
    state.pendingDrawQuestion = '';
    const chatInputEl = document.getElementById('chat-input');
    if (chatInputEl) chatInputEl.value = '';
    state.deckNumber = 1;
    state.deckResetAtIndex = 0;
    state.deckCarryoverSummary = '';
    state.lastReadingOffline = false;
    state.lastLiveShareEntry = null;

    document.getElementById('pregame-lang-bar')?.classList.add('hidden');
    document.getElementById('screen-ledger').classList.add('hidden');
    document.getElementById('top-hud').classList.remove('hidden');
    document.getElementById('sati-speech-wrap').classList.remove('hidden');
    document.getElementById('game-footer').classList.remove('hidden');

    state.screen = 'game';
    state.cameraMode = '1P';
    engine3D.setCameraTarget(CAM_POS.view1P, CAM_POS.view1PLook);
    engine3D.clearDiscardPile3D?.();

    state.remainingDeck = shuffleArray(buildFullDeck78());
    updateHUD();

    startShuffleAndFan(() => {
      enterPickingPhase(10, 'initial');
      setSatiDialogue(
        t(state.lang, 'welcomeFirstDialogue', state.user.nickname),
        'moodGreeting',
        true,
        false
      );
      saveAccountState(state);
    });
  });

  // Camera Toggle (1P vs 2P)
  document.getElementById('btn-camera-toggle').addEventListener('click', () => {
    if (!state.cameraUnlocked) return;
    SoundFX.playPick();
    if (state.cameraMode === '1P') {
      state.cameraMode = '2P';
      engine3D.setCameraTarget(CAM_POS.view2P, CAM_POS.view2PLook);
    } else {
      state.cameraMode = '1P';
      engine3D.setCameraTarget(CAM_POS.view1P, CAM_POS.view1PLook);
    }
    updateHUD();
  });

  // Mute Toggle (inside Settings Modal)
  document.getElementById('btn-mute').addEventListener('click', () => {
    SoundFX.muted = !SoundFX.muted;
    document.getElementById('icon-sound-on').classList.toggle('hidden', SoundFX.muted);
    document.getElementById('icon-sound-off').classList.toggle('hidden', !SoundFX.muted);
    const soundStatus = document.getElementById('settings-sound-status');
    if (soundStatus) {
      soundStatus.textContent = t(state.lang, SoundFX.muted ? 'settingsSoundOff' : 'settingsSoundOn');
    }
  });

  document.getElementById('btn-toggle-reversed')?.addEventListener('click', () => {
    SoundFX.playPick();
    state.allowReversedCards = state.allowReversedCards === false;
    persistAllowReversed(state.allowReversedCards);
    syncReversedToggleUI();
    saveAccountState(state);
  });

  // Auto-Pick remaining cards in current spread
  document.getElementById('btn-auto-pick').addEventListener('click', () => {
    if (!state.isPicking) return;
    const needed = state.pickTargetCount - state.activeSpread.length;
    for (let i = 0; i < needed; i++) {
      const fan = engine3D.getFanCardMeshes();
      if (fan.length === 0) break;
      const randIdx = Math.floor(Math.random() * fan.length);
      handlePickCard(fan[randIdx]);
    }
  });

  // Req 11: Player Hand Self-Shuffle (shuffles ONLY remaining unopened cards; discard pile stays separate)
  function triggerPlayerSelfShuffle() {
    if (state.isPlayerShuffling || state.isAnimatingShuffle || state.isThinking) return;
    if (state.remainingDeck.length <= 1) return;

    SoundFX.init();
    SoundFX.playShuffle();
    state.remainingDeck = shuffleArray(state.remainingDeck);
    updateHUD();
    setSatiDialogue(t(state.lang, 'selfShufflingDialogue', state.user.nickname), 'moodShuffle', false, true);

    engine3D.playPlayerHandShuffle3D(() => {
      updateHUD();
      saveAccountState(state);
      showToast(t(state.lang, 'toastSelfShuffled'));
      setSatiDialogue(
        t(state.lang, 'selfShuffledDoneDialogue', state.user.nickname, state.remainingDeck.length),
        state.isPicking ? 'moodWaitPick' : 'moodDeckReady',
        false,
        false
      );
    });
  }

  document.getElementById('btn-self-shuffle')?.addEventListener('click', triggerPlayerSelfShuffle);
  document.getElementById('btn-self-shuffle-chat')?.addEventListener('click', triggerPlayerSelfShuffle);

  // Follow-up Draw Buttons (gated by active question in #chat-input)
  document.getElementById('btn-draw-1').addEventListener('click', () => triggerFollowUpDraw(1, false, false));
  document.getElementById('btn-draw-3').addEventListener('click', () => triggerFollowUpDraw(3, false, false));
  document.getElementById('btn-draw-10-opt').addEventListener('click', () => triggerFollowUpDraw(10, false, false));

  // Expand Previous Question Quick Draw Buttons
  document.getElementById('btn-expand-prev-1')?.addEventListener('click', () => triggerFollowUpDraw(1, false, true));
  document.getElementById('btn-expand-prev-3')?.addEventListener('click', () => triggerFollowUpDraw(3, false, true));

  // Unlock draw buttons live as the user types/clears question in #chat-input
  document.getElementById('chat-input')?.addEventListener('input', updateDrawQuestionGateUI);

  // Req 12: Reshuffle Full 78-Card Deck ONLY when 0-9 unused cards remain (remainingDeck.length <= 9)
  document.getElementById('btn-reshuffle').addEventListener('click', () => {
    if (state.remainingDeck.length > 9) {
      showToast(t(state.lang, 'toastResetLocked'));
      return;
    }
    state.deckCarryoverSummary = buildDeckCarryoverSummary(state, state.lang);
    state.deckResetAtIndex = state.chatHistory.length;
    state.lastTopic = 'general';
    state.lastReadingOffline = false;
    state.deckNumber += 1;
    state.remainingDeck = shuffleArray(buildFullDeck78());
    state.discardPile = [];
    state.activeSpread = [];
    state.activeSpreadTopic = '';
    state.pendingDrawTopic = '';
    state.pendingDrawIsExpand = false;
    state.pendingDrawQuestion = '';
    engine3D.tuckNatalSpreadAway3D();
    engine3D.clearDiscardPile3D?.();
    updateActiveStrip();
    updateHUD();
    startShuffleAndFan(() => {
      setSatiDialogue(
        t(state.lang, 'reshuffledDialogue', state.user.nickname),
        'moodDeckReady',
        true,
        false
      );
      renderSmartPromptChips();
      saveAccountState(state);
    });
  });

  // Req 6: Preset Question Category Tabs
  document.querySelectorAll('#preset-category-bar .preset-cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      SoundFX.playPick();
      state.selectedPresetCategory = btn.dataset.cat || 'love';
      renderSmartPromptChips();
    });
  });

  // Help Guide & Settings Gear Modals + Exit Table Flow (Req 4, 7, 9)
  document.getElementById('btn-guide-open')?.addEventListener('click', () => {
    SoundFX.playPick();
    openModal('modal-guide');
  });

  document.getElementById('btn-settings-open')?.addEventListener('click', () => {
    SoundFX.playPick();
    document.getElementById('exit-confirm-box')?.classList.add('hidden');
    const soundStatus = document.getElementById('settings-sound-status');
    if (soundStatus) {
      soundStatus.textContent = t(state.lang, SoundFX.muted ? 'settingsSoundOff' : 'settingsSoundOn');
    }
    syncReversedToggleUI();
    openModal('modal-settings');
  });

  document.getElementById('btn-exit-table-open')?.addEventListener('click', () => {
    SoundFX.playPick();
    document.getElementById('exit-confirm-box')?.classList.remove('hidden');
  });

  document.getElementById('btn-exit-table-cancel')?.addEventListener('click', () => {
    document.getElementById('exit-confirm-box')?.classList.add('hidden');
  });

  document.getElementById('btn-exit-table-confirm')?.addEventListener('click', async () => {
    SoundFX.playSeal();
    const usedCount = state.discardPile.length + state.activeSpread.length;
    if (state.chatHistory.length > 0 || state.natalCompleted) {
      const archiveEntry = {
        id: `sess_${Date.now().toString(36)}`,
        endedAt: new Date().toISOString(),
        user: { ...state.user },
        natalCards: state.natalCards.map((c) => serializeSpreadCardMeta(c)),
        chatHistory: [...state.chatHistory],
        usedCount
      };
      state.sessionArchives = [archiveEntry, ...(state.sessionArchives || [])];
    }
    if (state.natalCards.length === 10) {
      state.savedNatalCards = state.natalCards.map((c) => serializeSpreadCardMeta(c));
    }

    state.sessionActive = false;
    state.isPicking = false;
    state.isThinking = false;
    state.activeSpread = [];
    state.activeSpreadTopic = '';
    state.pendingDrawTopic = '';
    state.pendingDrawIsExpand = false;
    state.userContextFacts = [];
    state.discardPile = [];
    state.pendingDrawQuestion = '';
    state.deckResetAtIndex = 0;
    state.deckCarryoverSummary = '';
    state.lastReadingOffline = false;
    const chatInputEl = document.getElementById('chat-input');
    if (chatInputEl) chatInputEl.value = '';
    state.remainingDeck = shuffleArray(buildFullDeck78());
    state.lastLiveShareEntry = null;

    await saveAccountState(state);
    closeModal('modal-settings');
    document.getElementById('exit-confirm-box')?.classList.add('hidden');

    engine3D.clearDiscardPile3D?.();
    engine3D.clear3DCards?.();

    document.getElementById('top-hud').classList.add('hidden');
    document.getElementById('sati-speech-wrap').classList.add('hidden');
    document.getElementById('game-footer').classList.add('hidden');
    document.getElementById('clean-mode-bar').classList.add('hidden');
    document.getElementById('pregame-lang-bar')?.classList.remove('hidden');

    showToast(t(state.lang, 'toastSessionSavedExit'));
    await handleSelectEmailAccount(state.user.email || getOrCreateDeviceAccountId(), state.user.fullname, state.user.nickname);
  });

  // Chat Form Submit (Free unlimited reading via Backend Proxy + Thaksa Fallback)
  document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const q = input.value.trim();
    if (!q || state.isThinking) return;

    appendHistory(state.user.nickname, q, 'user');
    input.value = '';
    SoundFX.playPick();

    state.userContextFacts = extractUserContextFacts(state.chatHistory, state.userContextFacts);
    const qProfile = detectTopicAndIntent(q, state.activeSpreadTopic || state.lastTopic);
    const qDomain = qProfile.subDomain && qProfile.subDomain !== 'general' ? qProfile.subDomain : qProfile.topic;
    const spreadDomain = state.activeSpreadTopic || '';
    const isTopicSwitch = Boolean(
      state.activeSpread.length > 0 &&
      spreadDomain &&
      spreadDomain !== 'general' &&
      qDomain !== 'general' &&
      !qProfile.isElliptical &&
      qDomain !== spreadDomain
    );
    const refCards = (state.activeSpread.length > 0 && !isTopicSwitch) ? state.activeSpread : state.natalCards;
    const sourceWasNatal10 = state.activeSpread.length === 0 || isTopicSwitch;
    const topicSwitchedFrom = isTopicSwitch ? spreadDomain : '';

    state.isThinking = true;
    renderSmartPromptChips();
    setSatiDialogue(t(state.lang, 'loadingQuestionDialogue', state.user.nickname), 'moodLoadingThink', false, true);
    const streamCtrl = createSatiStreamHandler('moodLoadingThink');
    const reply = await requestSatiReading(state, q, refCards, false, {
      topicSwitchedFrom,
      onChunk: streamCtrl.onChunk
    });
    streamCtrl.stop();
    state.isThinking = false;
    setSatiDialogue(reply, 'moodDeep', true, false, {
      isNatal10: false,
      sourceWasNatal10,
      question: q,
      cards: refCards.map((c) => serializeSpreadCardMeta(c))
    });
    updateHUD();
    renderSmartPromptChips();
    await saveAccountState(state);
  });

  // Full-Table Clean View
  function setCleanTableMode(clean) {
    state.uiHidden = clean;
    document.getElementById('top-ui-group').classList.toggle('hidden', clean);
    document.getElementById('game-footer').classList.toggle('hidden', clean);
    document.getElementById('clean-mode-bar').classList.toggle('hidden', !clean);
    document.getElementById('clean-pick-badge').classList.toggle('hidden', !state.isPicking);
  }

  document.getElementById('btn-hide-ui').addEventListener('click', () => {
    SoundFX.playPick();
    setCleanTableMode(true);
  });

  document.getElementById('btn-restore-ui').addEventListener('click', () => {
    SoundFX.playPick();
    setCleanTableMode(false);
  });

  // Collapse / Expand Bottom Action Dock
  document.getElementById('btn-toggle-dock').addEventListener('click', (e) => {
    state.dockCollapsed = !state.dockCollapsed;
    document.getElementById('action-dock').classList.toggle('hidden', state.dockCollapsed);
    e.target.textContent = t(state.lang, state.dockCollapsed ? 'btnShowDock' : 'btnHideDock');
  });

  // Collapse / Expand Dialogue Box
  document.getElementById('btn-toggle-dialogue').addEventListener('click', () => {
    setDialogueCollapsed(!state.dialogueCollapsed);
  });

  // 78-Card Gallery Modal
  const all78Cards = buildFullDeck78();
  function renderGalleryGrid(filterSuit = state.currentGalleryFilter || 'ALL') {
    state.currentGalleryFilter = filterSuit;
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '';
    const list = filterSuit === 'ALL' ? all78Cards : all78Cards.filter((c) => c.suit === filterSuit);
    list.forEach((card) => {
      const dataUrl = getCardFrontDataURL(card);
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'btn-slate chamfer-sm p-1.5 flex flex-col items-center text-center hover:border-[#d4af37] transition';
      const title = getLocalizedCardShortName(card, state.lang);
      item.innerHTML = `<img src="${dataUrl}" class="w-full aspect-[2/3] object-contain mb-1.5 border border-[#d4af37]/40 rounded-[2px]" alt="${card.name}" /><div class="text-[11px] font-medium text-[#f1ede4] truncate w-full">${title}</div>`;
      item.addEventListener('click', () => openCardModal(card, t(state.lang, 'galleryOriginTag')));
      grid.appendChild(item);
    });
  }
  window.addEventListener('sati:rerender-gallery', () => renderGalleryGrid(state.currentGalleryFilter));

  document.getElementById('btn-deck-gallery').addEventListener('click', () => {
    renderGalleryGrid('ALL');
    openModal('modal-gallery');
  });

  document.querySelectorAll('.gallery-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gallery-filter').forEach((b) => {
        b.classList.remove('btn-gold');
        b.classList.add('btn-slate');
      });
      btn.classList.remove('btn-slate');
      btn.classList.add('btn-gold');
      renderGalleryGrid(btn.dataset.filter);
    });
  });

  // Natal 10 Cards Drawer Modal
  document.getElementById('btn-natal-drawer').addEventListener('click', () => {
    const lang = state.lang;
    const posList = getLocalizedCelticPositions(lang);
    document.getElementById('natal-summary-sub').textContent =
      `${state.user.fullname} | ${state.user.birthCard}`;
    const list = document.getElementById('natal-list');
    list.innerHTML = '';
    state.natalCards.forEach((c, idx) => {
      const data = getLocalizedCardData(c, lang);
      const label = getLocalizedCardLabelInline(c, lang);
      const item = document.createElement('div');
      item.className = 'p-2.5 bg-[#0b0d19]/70 border border-[#d4af37]/25 flex items-start justify-between gap-3';
      item.innerHTML = `<div><div class="text-xs font-medium text-[#d4af37]">${t(lang, 'natalCardItemFmt', idx, posList[idx], label)}</div><div class="text-xs text-[#c5c7d4] mt-0.5">${data.core}</div></div>`;
      list.appendChild(item);
    });
    openModal('modal-natal');
  });

  const POLARITY_BADGE_CLS = {
    favorable: 'bg-[#10b981]/15 text-[#6ee7b7] border border-[#10b981]/35',
    balanced: 'bg-[#d4af37]/15 text-[#f3d478] border border-[#d4af37]/35',
    caution: 'bg-[#fb7185]/15 text-[#fda4af] border border-[#fb7185]/35'
  };

  function createCardThumbTile(item, lang, isWideGrid = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const baseBorder = item.isCited
      ? 'border-[#d4af37]/75 bg-[#182042]/90'
      : 'border-[#4d5785]/45 bg-[#0e1226]/80 opacity-85 hover:opacity-100';
    btn.className = `${isWideGrid ? 'w-full' : 'w-24 sm:w-28 shrink-0'} p-1.5 border ${baseBorder} hover:border-[#d4af37] hover:-translate-y-0.5 transition-all flex flex-col items-center text-center gap-1 cursor-pointer`;
    btn.title = item.title;

    const img = document.createElement('img');
    img.src = getCardFrontDataURL(item.card);
    img.alt = item.title;
    img.className = `${isWideGrid ? 'w-12 sm:w-14' : 'w-14 sm:w-16'} aspect-[2/3] object-cover border border-[#d4af37]/40 bg-[#efe5d2]${item.card?.reversed ? ' rotate-180' : ''}`;

    const posEl = document.createElement('span');
    posEl.className = 'text-[10px] text-[#d4af37] font-semibold leading-tight line-clamp-2';
    posEl.textContent = item.posLabel;

    const nameEl = document.createElement('span');
    nameEl.className = 'text-[11px] text-[#f1ede4] font-medium leading-tight line-clamp-2';
    const orientBadge = formatCardOrientationBadge(item.card, lang);
    nameEl.textContent = orientBadge
      ? `${getLocalizedCardShortName(item.card, lang)} ${orientBadge}`
      : getLocalizedCardShortName(item.card, lang);

    const pill = document.createElement('span');
    pill.className = `text-[9.5px] px-1.5 py-0.5 leading-none ${POLARITY_BADGE_CLS[item.polarity] || POLARITY_BADGE_CLS.balanced}`;
    pill.textContent = item.polarityLabel;

    btn.append(img, posEl, nameEl, pill);
    if (isWideGrid && item.isCited) {
      const tag = document.createElement('span');
      tag.className = 'text-[9px] text-[#f3d478] uppercase tracking-wide';
      tag.textContent = t(lang, 'breakdownCitedTag');
      btn.appendChild(tag);
    }
    btn.addEventListener('click', () => openCardModal(item.card, item.posLabel));
    return btn;
  }

  function createReasonRow(item, lang) {
    const cardBox = document.createElement('div');
    cardBox.className = 'p-2.5 bg-[#10152b]/90 border border-[#d4af37]/25 space-y-1.5';

    const hdr = document.createElement('div');
    hdr.className = 'flex flex-wrap items-center justify-between gap-2';

    const titleBtn = document.createElement('button');
    titleBtn.type = 'button';
    titleBtn.className = 'text-left text-xs font-semibold text-[#f1ede4] hover:text-[#d4af37] underline decoration-[#d4af37]/35 cursor-pointer';
    const orientBadge = formatCardOrientationBadge(item.card, lang);
    titleBtn.textContent = orientBadge
      ? `${item.posLabel} — ${item.title} ${orientBadge}`
      : `${item.posLabel} — ${item.title}`;
    titleBtn.addEventListener('click', () => openCardModal(item.card, item.posLabel));

    const badge = document.createElement('span');
    badge.className = `text-[10px] px-1.5 py-0.5 leading-none ${POLARITY_BADGE_CLS[item.polarity] || POLARITY_BADGE_CLS.balanced}`;
    badge.textContent = item.polarityLabel;
    hdr.append(titleBtn, badge);

    const addField = (label, val, accentClass = 'text-[#c5c7d4]') => {
      if (!val) return;
      const p = document.createElement('p');
      p.className = `text-[11.5px] leading-relaxed ${accentClass}`;
      const lbl = document.createElement('span');
      lbl.className = 'font-semibold text-[#d4af37]/90 mr-1';
      lbl.textContent = label;
      p.append(lbl, document.createTextNode(val));
      cardBox.appendChild(p);
    };

    cardBox.appendChild(hdr);
    addField(t(lang, 'breakdownLabelCore'), item.coreMeaning);
    if (item.topicMeaning && item.topicMeaning !== item.coreMeaning) {
      addField(`${item.topicFocusLabel}:`, item.topicMeaning, 'text-[#e9e4d7]');
    }
    addField(t(lang, 'breakdownLabelWhy'), item.whyReason, 'text-[#f1ede4]');
    addField(t(lang, 'breakdownLabelAdvice'), item.advice, 'text-[#f3d478]');
    return cardBox;
  }

  function renderBreakdownPanel(container, breakdown, lang) {
    container.innerHTML = '';

    // Part 1: Visual Card Flow / Full Spread Strip
    const sec1 = document.createElement('div');
    sec1.className = 'space-y-2';
    const h1 = document.createElement('div');
    h1.className = 'text-[11px] font-semibold text-[#d4af37] tracking-wide';
    h1.textContent = t(lang, 'breakdownPart1Title');
    sec1.appendChild(h1);

    const cardsToShow = breakdown.fullSpreadCards.length > 0 ? breakdown.fullSpreadCards : breakdown.primaryCards;
    if (cardsToShow.length > 3) {
      const grid = document.createElement('div');
      grid.className = 'grid grid-cols-2 sm:grid-cols-5 gap-2';
      cardsToShow.forEach((item) => grid.appendChild(createCardThumbTile(item, lang, true)));
      sec1.appendChild(grid);
    } else {
      const strip = document.createElement('div');
      strip.className = 'flex flex-wrap items-center gap-2';
      cardsToShow.forEach((item, idx) => {
        if (idx > 0) {
          const arrow = document.createElement('span');
          arrow.className = 'text-[#d4af37] text-sm font-bold px-0.5 select-none';
          arrow.setAttribute('aria-hidden', 'true');
          arrow.textContent = '→';
          strip.appendChild(arrow);
        }
        strip.appendChild(createCardThumbTile(item, lang, false));
      });
      sec1.appendChild(strip);
    }
    container.appendChild(sec1);

    // Part 2: Card-to-Card Synergy & Question Link
    if (breakdown.connectionText) {
      const sec2 = document.createElement('div');
      sec2.className = 'space-y-1.5';
      const h2 = document.createElement('div');
      h2.className = 'text-[11px] font-semibold text-[#d4af37] tracking-wide';
      h2.textContent = t(lang, 'breakdownPart2Title');
      const box = document.createElement('div');
      box.className = 'p-2.5 bg-[#121730]/85 border-l-2 border-[#d4af37] text-xs text-[#f1ede4] leading-relaxed whitespace-pre-line';
      box.textContent = breakdown.connectionText;
      sec2.append(h2, box);
      container.appendChild(sec2);
    }

    // Part 3: Per-Card Detailed Meaning & Why It Fits
    const sec3 = document.createElement('div');
    sec3.className = 'space-y-2';
    const h3 = document.createElement('div');
    h3.className = 'text-[11px] font-semibold text-[#d4af37] tracking-wide';
    h3.textContent = t(lang, 'breakdownPart3Title');
    sec3.appendChild(h3);

    breakdown.primaryCards.forEach((item) => sec3.appendChild(createReasonRow(item, lang)));

    const extraCards = breakdown.fullSpreadCards.filter((item) => !item.isCited);
    if (extraCards.length > 0) {
      const details = document.createElement('details');
      details.className = 'pt-1';
      const summary = document.createElement('summary');
      summary.className = 'text-[11px] text-[#d4af37] cursor-pointer hover:underline select-none py-1';
      summary.textContent = t(lang, 'breakdownOtherNatalToggle', extraCards.length);
      const inner = document.createElement('div');
      inner.className = 'space-y-2 mt-2';
      extraCards.forEach((item) => inner.appendChild(createReasonRow(item, lang)));
      details.append(summary, inner);
      sec3.appendChild(details);
    }
    container.appendChild(sec3);
  }

  // Discard Pile Inspector (Req 10)
  function openDiscardModal() {
    SoundFX.playPick();
    const lang = state.lang;
    const discardCards = hydrateDeckCards(state.discardPile || []);
    const remCount = state.remainingDeck.length;
    const subEl = document.getElementById('discard-summary-sub');
    const grid = document.getElementById('discard-grid');
    if (subEl) subEl.textContent = t(lang, 'discardSummaryFmt', discardCards.length, remCount);
    if (grid) {
      grid.innerHTML = '';
      if (discardCards.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'col-span-full text-center text-xs text-[#a6a8b8] py-6';
        empty.textContent = t(lang, 'discardEmpty');
        grid.appendChild(empty);
      } else {
        discardCards.forEach((card, idx) => {
          const dataUrl = getCardFrontDataURL(card);
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'btn-slate chamfer-sm p-1.5 flex flex-col items-center text-center hover:border-[#d4af37] transition cursor-pointer';
          const title = getLocalizedCardShortName(card, lang);
          item.innerHTML = `<img src="${dataUrl}" class="w-full aspect-[2/3] object-contain mb-1 border border-[#d4af37]/40 rounded-[2px]${card.reversed ? ' rotate-180' : ''}" alt="${card.name}" /><div class="text-[10px] text-[#d4af37]">#${idx + 1}</div><div class="text-[11px] font-medium text-[#f1ede4] truncate w-full">${title}</div>`;
          item.addEventListener('click', () => openCardModal(card, `#${idx + 1} · ${t(lang, 'modalDiscardTitle')}`));
          grid.appendChild(item);
        });
      }
    }
    openModal('modal-discard');
  }

  document.getElementById('btn-discard-pile')?.addEventListener('click', openDiscardModal);

  // Share Reading PNG Card Preview & Save/Share Actions (Req 2)
  async function openSharePreview({ entry, question, breakdown, user, timestamp }) {
    if (!entry) return;
    SoundFX.playPick();
    const dataUrl = await generateReadingShareCardDataURL({
      entry,
      question,
      breakdown,
      user: user || state.user,
      lang: state.lang,
      timestamp: timestamp || entry.createdAt || new Date().toISOString()
    });
    if (!dataUrl) return;
    state.lastShareDataUrl = dataUrl;
    const imgEl = document.getElementById('share-preview-img');
    if (imgEl) imgEl.src = dataUrl;
    openModal('modal-share-preview');
  }

  document.getElementById('btn-download-share-png')?.addEventListener('click', () => {
    if (!state.lastShareDataUrl) return;
    const a = document.createElement('a');
    a.href = state.lastShareDataUrl;
    a.download = `sati-reading-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
    showToast(t(state.lang, 'toastShareSaved'));
  });

  document.getElementById('btn-native-share-png')?.addEventListener('click', async () => {
    if (!state.lastShareDataUrl) return;
    try {
      const blobRes = await fetch(state.lastShareDataUrl);
      const blob = await blobRes.blob();
      const file = new File([blob], `sati-reading-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: t(state.lang, 'pageTitle'),
          files: [file]
        });
        return;
      }
    } catch {
      // fallback to download below
    }
    document.getElementById('btn-download-share-png')?.click();
  });

  // Render Chat History Messages List (works for live session & past timestamped archive sessions)
  function renderChatEntriesIntoList(listEl, chatEntries, contextState, timestampHint = '') {
    listEl.innerHTML = '';
    const lang = state.lang;
    let lastUserQuestion = '';
    const detailToggleButtons = [];

    (chatEntries || []).forEach((entry) => {
      const row = document.createElement('div');
      const isSati = isSatiEntry(entry);
      row.className = `p-2.5 border ${isSati ? 'border-[#d4af37]/30 bg-[#141933]/70' : 'border-[#4d5785]/40 bg-[#0b0d19]/80'}`;

      if (!isSati && !entry.isDrawAction && !entry.isExpandAction) {
        lastUserQuestion = entry.text || '';
      }
      const capturedQ = lastUserQuestion;

      const spk = document.createElement('div');
      spk.className = `flex items-center justify-between gap-2 text-xs font-semibold ${isSati ? 'text-[#d4af37]' : 'text-[#9dd2ff]'} mb-1`;
      const spkName = document.createElement('span');
      spkName.textContent = isSati ? t(lang, 'satiSpeaker') : entry.speaker;
      spk.appendChild(spkName);
      if (entry.createdAt) {
        const tsEl = document.createElement('span');
        tsEl.className = 'text-[10px] font-normal text-[#8d90a3]';
        tsEl.textContent = formatShareTimestamp(entry.createdAt, lang);
        spk.appendChild(tsEl);
      }
      const body = document.createElement('div');
      body.className = 'text-xs text-[#f1ede4] leading-relaxed whitespace-pre-line';
      body.textContent = entry.text;
      row.append(spk, body);

      if (isSati) {
        const breakdown = buildReadingBreakdown(entry, capturedQ, contextState, all78Cards);
        if (breakdown.isReading) {
          const footer = document.createElement('div');
          footer.className = 'flex flex-wrap items-center justify-end gap-2 mt-2';

          const shareBtn = document.createElement('button');
          shareBtn.type = 'button';
          shareBtn.className = 'btn-slate chamfer-sm px-2.5 py-0.5 text-[11px] text-[#f1ede4] hover:border-[#f3d266] cursor-pointer';
          shareBtn.textContent = t(lang, 'btnShareReading');
          shareBtn.addEventListener('click', () => openSharePreview({
            entry,
            question: capturedQ || entry?.meta?.question || '',
            breakdown,
            user: contextState.user,
            timestamp: entry.createdAt || timestampHint
          }));

          // Req 5: Replace "⋯" with "รายละเอียดเพิ่มเติม" while retaining .btn-history-dots hook
          const dotsBtn = document.createElement('button');
          dotsBtn.type = 'button';
          dotsBtn.className = 'btn-history-dots chamfer-sm px-2.5 py-0.5 border border-[#d4af37]/50 bg-[#0b0d19]/85 text-[#f3d266] hover:bg-[#d4af37]/20 hover:border-[#d4af37] transition-colors text-[11px] font-medium cursor-pointer';
          dotsBtn.textContent = t(lang, 'btnMoreDetails');
          dotsBtn.title = t(lang, 'btnCardBreakdownOpen');
          dotsBtn.setAttribute('aria-label', t(lang, 'btnCardBreakdownOpen'));
          dotsBtn.setAttribute('aria-expanded', 'false');

          const panel = document.createElement('div');
          panel.className = 'hidden mt-2.5 pt-3 border-t border-[#d4af37]/25 space-y-3 bg-[#090b16]/85 p-3';

          let rendered = false;
          const toggleFn = (forceOpen = null) => {
            if (!rendered) {
              renderBreakdownPanel(panel, breakdown, state.lang);
              rendered = true;
            }
            const willOpen = forceOpen !== null ? forceOpen : panel.classList.contains('hidden');
            panel.classList.toggle('hidden', !willOpen);
            dotsBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            dotsBtn.textContent = t(state.lang, willOpen ? 'btnHideDetails' : 'btnMoreDetails');
            const tip = t(state.lang, willOpen ? 'btnCardBreakdownClose' : 'btnCardBreakdownOpen');
            dotsBtn.title = tip;
            dotsBtn.setAttribute('aria-label', tip);
            dotsBtn.classList.toggle('bg-[#d4af37]/20', willOpen);
            dotsBtn.classList.toggle('border-[#d4af37]', willOpen);
          };
          dotsBtn.addEventListener('click', () => toggleFn());
          detailToggleButtons.push({ entry, toggleFn, row });

          footer.append(shareBtn, dotsBtn);
          row.append(footer, panel);
        }
      }

      listEl.appendChild(row);
    });
    return detailToggleButtons;
  }

  function renderArchivesView() {
    const view = document.getElementById('archive-list-view');
    if (!view) return;
    view.innerHTML = '';
    const lang = state.lang;
    const archives = state.sessionArchives || [];

    if (archives.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-center text-xs text-[#a6a8b8] py-8';
      empty.textContent = t(lang, 'archiveEmpty');
      view.appendChild(empty);
      return;
    }

    archives.forEach((sess) => {
      const card = document.createElement('div');
      card.className = 'p-3 bg-[#0e1328]/85 border border-[#d4af37]/35 space-y-2';
      const hdr = document.createElement('div');
      hdr.className = 'flex flex-wrap items-center justify-between gap-2';

      const title = document.createElement('div');
      title.className = 'text-xs font-semibold text-[#f3d266]';
      title.textContent = t(
        lang,
        'archiveSessionHeaderFmt',
        formatShareTimestamp(sess.endedAt, lang),
        sess.user?.nickname || state.user.nickname || '',
        sess.usedCount ?? 0
      );

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'btn-gold chamfer-sm px-2.5 py-1 text-[11px] font-semibold cursor-pointer';
      openBtn.textContent = t(lang, 'btnViewArchiveSession');
      openBtn.addEventListener('click', () => {
        view.innerHTML = '';
        const backBtn = document.createElement('button');
        backBtn.type = 'button';
        backBtn.className = 'btn-slate chamfer-sm px-3 py-1.5 text-xs mb-2 cursor-pointer';
        backBtn.textContent = t(lang, 'btnBackArchiveList');
        backBtn.addEventListener('click', () => renderArchivesView());
        view.appendChild(backBtn);

        const sessionInner = document.createElement('div');
        sessionInner.className = 'space-y-3';
        const archivedCtx = {
          lang,
          user: sess.user || state.user,
          natalCards: hydrateDeckCards(sess.natalCards || [])
        };
        renderChatEntriesIntoList(sessionInner, sess.chatHistory || [], archivedCtx, sess.endedAt);
        view.appendChild(sessionInner);
      });

      hdr.append(title, openBtn);
      card.appendChild(hdr);

      const previewSati = [...(sess.chatHistory || [])].reverse().find((h) => isSatiEntry(h));
      if (previewSati?.text) {
        const snippet = document.createElement('p');
        snippet.className = 'text-[11px] text-[#c5c7d4] line-clamp-2';
        snippet.textContent = previewSati.text;
        card.appendChild(snippet);
      }
      view.appendChild(card);
    });
  }

  function switchHistoryModalTab(tab = 'current', expandLatest = false) {
    const isCurrent = tab === 'current';
    const listEl = document.getElementById('history-list');
    const archiveEl = document.getElementById('archive-list-view');
    const tabCurBtn = document.getElementById('btn-history-tab-current');
    const tabArcBtn = document.getElementById('btn-history-tab-archives');

    listEl?.classList.toggle('hidden', !isCurrent);
    archiveEl?.classList.toggle('hidden', isCurrent);
    tabCurBtn?.classList.toggle('btn-gold', isCurrent);
    tabCurBtn?.classList.toggle('btn-slate', !isCurrent);
    tabArcBtn?.classList.toggle('btn-gold', !isCurrent);
    tabArcBtn?.classList.toggle('btn-slate', isCurrent);

    if (isCurrent && listEl) {
      const toggles = renderChatEntriesIntoList(listEl, state.chatHistory, state);
      if (expandLatest && toggles.length > 0) {
        const latest = toggles[toggles.length - 1];
        latest.toggleFn(true);
        latest.row?.scrollIntoView?.({ block: 'nearest' });
      }
    } else if (!isCurrent) {
      renderArchivesView();
    }
  }

  document.getElementById('btn-history-tab-current')?.addEventListener('click', () => switchHistoryModalTab('current'));
  document.getElementById('btn-history-tab-archives')?.addEventListener('click', () => switchHistoryModalTab('archives'));

  document.getElementById('btn-ledger-history')?.addEventListener('click', () => {
    SoundFX.playPick();
    switchHistoryModalTab('archives');
    openModal('modal-history');
  });

  document.getElementById('btn-live-more-details')?.addEventListener('click', () => {
    SoundFX.playPick();
    switchHistoryModalTab('current', true);
    openModal('modal-history');
  });

  document.getElementById('btn-live-share-reading')?.addEventListener('click', () => {
    const targetEntry = state.lastLiveShareEntry || [...state.chatHistory].reverse().find((h) => isSatiEntry(h));
    if (!targetEntry) return;
    const q = state.lastLiveShareQuestion || targetEntry?.meta?.question || '';
    const breakdown = buildReadingBreakdown(targetEntry, q, state, all78Cards);
    openSharePreview({ entry: targetEntry, question: q, breakdown, user: state.user });
  });

  // Chat History Modal
  document.getElementById('btn-chat-history').addEventListener('click', () => {
    switchHistoryModalTab('current', false);
    openModal('modal-history');
  });

  // Voluntary Developer Support Modal & Real PromptPay QR Viewer
  const donateQrImg = document.getElementById('donate-qr-img');
  donateQrImg?.addEventListener('load', syncDonateQrPreviewState);
  donateQrImg?.addEventListener('error', syncDonateQrPreviewState);
  document.getElementById('btn-support-open')?.addEventListener('click', openSupportModal);
  document.getElementById('btn-feedback-support-open')?.addEventListener('click', () => {
    closeModal('modal-feedback');
    openSupportModal();
  });
  document.getElementById('btn-exit-support-open')?.addEventListener('click', () => {
    closeModal('modal-settings');
    openSupportModal();
  });
  document.getElementById('btn-download-donate-qr')?.addEventListener('click', () => {
    const img = document.getElementById('donate-qr-img');
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const a = document.createElement('a');
    a.href = img.src;
    a.download = 'sati-promptpay-qr.jpg';
    a.click();
  });

  // In-App Private Feedback Modal (Direct to Developer Email)
  let feedbackRating = 5;
  const feedbackTagsSelected = new Set();

  function renderFeedbackStars() {
    document.querySelectorAll('.feedback-star').forEach((btn) => {
      const star = parseInt(btn.dataset.star, 10);
      const active = star <= feedbackRating;
      btn.classList.toggle('text-[#f3d266]', active);
      btn.classList.toggle('text-[#4d5785]', !active);
    });
  }

  function renderFeedbackTags() {
    const wrap = document.getElementById('feedback-tags');
    if (!wrap) return;
    const tags = t(state.lang, 'feedbackTags') || [];
    wrap.innerHTML = '';
    tags.forEach((tag) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const selected = feedbackTagsSelected.has(tag);
      btn.className = `${selected ? 'btn-gold font-semibold' : 'btn-slate'} chamfer-sm px-2.5 py-1 text-[11px] cursor-pointer transition`;
      btn.textContent = tag;
      btn.addEventListener('click', () => {
        if (feedbackTagsSelected.has(tag)) feedbackTagsSelected.delete(tag);
        else feedbackTagsSelected.add(tag);
        renderFeedbackTags();
      });
      wrap.appendChild(btn);
    });
  }

  function openFeedbackModal() {
    SoundFX.playPick();
    renderFeedbackStars();
    renderFeedbackTags();
    openModal('modal-feedback');
  }

  document.getElementById('btn-feedback-open')?.addEventListener('click', () => openFeedbackModal());
  document.getElementById('btn-speech-feedback')?.addEventListener('click', () => openFeedbackModal());

  document.querySelectorAll('.feedback-star').forEach((btn) => {
    btn.addEventListener('click', () => {
      feedbackRating = parseInt(btn.dataset.star, 10) || 5;
      renderFeedbackStars();
    });
  });

  document.getElementById('feedback-form-view')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const commentEl = document.getElementById('feedback-comment');
    const submitBtn = document.getElementById('btn-submit-feedback');
    const comment = commentEl?.value.trim() || '';
    const tags = [...feedbackTagsSelected];
    if (!comment && tags.length === 0 && !feedbackRating) {
      showToast(t(state.lang, 'feedbackNeedInputToast'));
      return;
    }

    const payload = {
      nickname: state.user.nickname || t(state.lang, 'userSpeakerFallback'),
      rating: feedbackRating,
      tags,
      comment,
      lang: state.lang
    };

    if (submitBtn) submitBtn.disabled = true;
    let savedOk = false;
    try {
      const res = await fetch('/api/sati/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      savedOk = res.ok;
    } catch {
      savedOk = false;
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }

    if (!savedOk) {
      showToast(t(state.lang, 'toastFeedbackError'));
      return;
    }

    if (commentEl) commentEl.value = '';
    feedbackTagsSelected.clear();
    feedbackRating = 5;
    renderFeedbackStars();
    renderFeedbackTags();
    closeModal('modal-feedback');
    showToast(t(state.lang, 'toastFeedbackSaved'));
  });

  window.addEventListener('sati:rerender-feedback', () => {
    renderFeedbackTags();
  });
});
