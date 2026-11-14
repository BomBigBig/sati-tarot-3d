/**
 * SATI (สำรับแห่งสติ) — Main Application Controller
 * เชื่อมโยงระบบเสียง Web Audio, ข้อมูลไพ่ 78 ใบ, สมองทักษา + Gemini Proxy,
 * เอนจิน 3D Low-Poly (.glb) และระบบบันทึกสถานะผูกกับ Gmail
 */
import { buildFullDeck78, hydrateDeckCards, shuffleArray, getCardFrontDataURL } from './data/tarot78.js';
import {
  normalizeLang,
  getLocalizedCardData,
  getLocalizedCelticPositions,
  getLocalizedCardLabelInline,
  getLocalizedCardShortName
} from './data/tarot78I18n.js';
import { getTextPack, t } from './i18n/translations.js';
import { computeNatalProfile, requestSatiReading, buildReadingBreakdown } from './engine/satiBrain.js';
import { loadAccountState, saveAccountState, clearAccountState } from './engine/storage.js';
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
  screen: 'login',
  modelsLoaded: false,
  user: {
    email: '',
    fullname: '',
    nickname: '',
    day: 25,
    month: 6,
    year: 2539,
    dayName: '',
    element: '',
    thaksaStrength: '',
    lifePath: 9,
    birthCard: '',
    birthCardCore: ''
  },
  cameraMode: '1P',
  cameraUnlocked: false,
  coins: 3,
  hasDeckPass: false,
  hasVipPass: false,
  vipExpiresAt: null,
  freeChatQuota: 1,
  selectedShopPkg: null,
  deckNumber: 1,
  remainingDeck: [],
  natalCards: [],
  natalCompleted: false,
  activeSpread: [],
  pickTargetCount: 10,
  isPicking: false,
  isAnimatingShuffle: false,
  isThinking: false,
  isSpeaking: false,
  _speakTimer: null,
  chatHistory: [],
  lastTopic: 'general',
  currentMoodKey: 'moodIdle',
  currentPickMode: 'initial',
  currentGalleryFilter: 'ALL',
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
  state.chatHistory.push({ speaker, role: isSati ? 'sati' : 'user', text, ...extra });
}

function isSatiEntry(entry) {
  return entry?.role === 'sati' || ['สติ', 'Sati', '思谛'].includes(entry?.speaker);
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
  const box = document.getElementById('dialogue-content');
  box.textContent = text;
  document.getElementById('dialogue-preview').textContent = text.replace(/\s+/g, ' ').trim();
  box.scrollTop = 0;
  if (recordHistory) {
    appendHistory('sati', text, 'sati', historyMeta ? { meta: historyMeta } : {});
  }
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

const SHOP_PACKAGES = {
  coins: { id: 'coins', price: 99, titleKey: 'shopBuyCoinsTitle', toastKey: 'toastAddCoins' },
  pass: { id: 'pass', price: 299, titleKey: 'shopBuyPassTitle', toastKey: 'toastUnlockPass' },
  vip: { id: 'vip', price: 999, titleKey: 'shopBuyVipTitle', toastKey: 'toastUnlockVip' }
};

function hasUnlimitedAccess() {
  const vipActive = Boolean(state.hasVipPass && (!state.vipExpiresAt || state.vipExpiresAt > Date.now()));
  return vipActive || Boolean(state.hasDeckPass);
}

function openShopQrCheckout(pkgId) {
  const pkg = SHOP_PACKAGES[pkgId];
  if (!pkg) return;
  state.selectedShopPkg = pkgId;
  document.getElementById('shop-qr-pkg-title').textContent = t(state.lang, pkg.titleKey);
  document.getElementById('shop-qr-pkg-amount').textContent = t(state.lang, 'shopQrAmountFmt', pkg.price);
  document.getElementById('shop-tier-list')?.classList.add('hidden');
  document.getElementById('shop-qr-checkout')?.classList.remove('hidden');
}

function openShopModal() {
  state.selectedShopPkg = null;
  document.getElementById('shop-tier-list')?.classList.remove('hidden');
  document.getElementById('shop-qr-checkout')?.classList.add('hidden');
  openModal('modal-shop');
}

function renderSmartPromptChips() {
  const container = document.getElementById('smart-prompt-chips');
  if (!container) return;
  if (state.isPicking || state.isThinking || !state.natalCompleted) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  const map = t(state.lang, 'smartPromptsByTopic') || {};
  const list = map[state.lastTopic] || map.general || [];
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
      const input = document.getElementById('chat-input');
      if (input) input.value = item.question;
      if (item.drawCount > 0) {
        triggerFollowUpDraw(item.drawCount, false);
      } else {
        document.getElementById('chat-form')?.requestSubmit();
      }
    });
    container.appendChild(btn);
  });
  container.classList.remove('hidden');
}

function updateHUD() {
  const lang = state.lang;
  const unlimited = hasUnlimitedAccess();
  document.getElementById('hud-deck-count').textContent = `${state.remainingDeck.length} / 78`;
  document.getElementById('hud-coins').textContent = unlimited
    ? t(lang, 'hudCoinsUnlimited')
    : t(lang, 'hudCoinsCount', state.coins);

  const badge = document.getElementById('hud-pass-badge');
  badge.classList.toggle('hidden', !unlimited);
  if (unlimited) {
    badge.textContent = t(lang, state.hasVipPass ? 'hudVipBadge' : 'hudPassBadge');
  }

  const chatSubmitBtn = document.getElementById('btn-chat-submit');
  if (chatSubmitBtn) {
    if (unlimited) {
      chatSubmitBtn.textContent = t(lang, 'btnChatSubmit');
    } else if (state.freeChatQuota > 0) {
      chatSubmitBtn.textContent = t(lang, 'btnChatSubmitFree', state.freeChatQuota);
    } else {
      chatSubmitBtn.textContent = t(lang, 'btnChatSubmitCoin');
    }
  }

  const camBtn = document.getElementById('btn-camera-toggle');
  camBtn.disabled = !state.cameraUnlocked;
  document.getElementById('hud-cam-label').textContent = t(
    lang,
    state.cameraMode === '1P' ? 'cam1P' : 'cam2P'
  );

  document.getElementById('btn-natal-drawer').classList.toggle('hidden', !state.natalCompleted);
  document.getElementById('btn-draw-10-opt').classList.toggle('hidden', state.deckNumber < 2 && !state.natalCompleted);

  const needReshuffle = state.remainingDeck.length < 3;
  document.getElementById('btn-reshuffle').classList.toggle('hidden', !needReshuffle && state.remainingDeck.length > 0);
}

function updateActiveStrip() {
  const strip = document.getElementById('active-cards-strip');
  if (state.activeSpread.length === 0) {
    strip.classList.add('hidden');
    strip.innerHTML = '';
    return;
  }
  strip.classList.remove('hidden');
  strip.innerHTML = '';
  state.activeSpread.forEach((c, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-slate chamfer-sm px-2.5 py-1 text-[11px] shrink-0 flex items-center gap-1.5';
    btn.innerHTML = `<span class="text-[#d4af37]">#${idx + 1}</span><span>${getLocalizedCardShortName(c, state.lang)}</span>`;
    btn.addEventListener('click', () => openCardModal(c, t(state.lang, 'activeCardLabel', idx)));
    strip.appendChild(btn);
  });
}

function openCardModal(card, posLabel) {
  const lang = state.lang;
  const localized = getLocalizedCardData(card, lang);
  document.getElementById('modal-card-pos').textContent = posLabel;
  document.getElementById('modal-card-name').textContent = localized.title;
  document.getElementById('modal-card-th').textContent = localized.subtitle !== localized.title ? localized.subtitle : localized.suitLabel;
  document.getElementById('modal-card-note').textContent = t(lang, 'cardModalMeaning', localized);

  const dataUrl = getCardFrontDataURL(card);
  const artBox = document.getElementById('modal-card-art');
  artBox.innerHTML = '';
  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = localized.title;
  img.className = 'w-full h-full object-contain';
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
    remCount,
    pendingSavedRecord.coins ?? 3
  );
}

// =========================================================================
// 4. GAMEPLAY LOOP CONTROLLERS
// =========================================================================
function enterPickingPhase(count, pickMode = 'initial') {
  state.isPicking = true;
  state.pickTargetCount = count;
  state.currentPickMode = pickMode;
  state.activeSpread = [];
  engine3D.tuckNatalSpreadAway3D();
  updateActiveStrip();

  document.getElementById('dock-picking').classList.remove('hidden');
  document.getElementById('dock-chat').classList.add('hidden');
  renderSmartPromptChips();
  updatePickInstruction();
  setDialogueCollapsed(true);
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
  const cardData = mesh.userData.cardData;

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

  const toCardMeta = (arr) => (arr || []).map((c) => ({ uid: c.uid, name: c.name, th: c.th }));

  state.isThinking = true;
  renderSmartPromptChips();
  if (!state.natalCompleted && state.pickTargetCount === 10) {
    state.natalCompleted = true;
    state.natalCards = [...state.activeSpread];
    setSatiDialogue(t(state.lang, 'loadingNatalDialogue', state.user.fullname), 'moodLoadingNatal', false, true);
    const reply = await requestSatiReading(state, '', state.natalCards, true);
    state.isThinking = false;
    setSatiDialogue(reply, 'moodNatal10', true, false, {
      isNatal10: true,
      cards: toCardMeta(state.natalCards)
    });
  } else {
    const typedQ = document.getElementById('chat-input').value.trim();
    const lastRealUserQ = [...state.chatHistory]
      .reverse()
      .find((h) => !isSatiEntry(h) && !h.isDrawAction)?.text;
    const q = typedQ || (lastRealUserQ ? t(state.lang, 'fallbackExpandQ', lastRealUserQ) : t(state.lang, 'fallbackDefaultQ'));
    if (!typedQ) {
      appendHistory(state.user.nickname, t(state.lang, 'drawFollowUpActionLabel', state.pickTargetCount), 'user', { isDrawAction: true });
    }
    document.getElementById('chat-input').value = '';
    setSatiDialogue(t(state.lang, 'loadingCardsDialogue', state.user.nickname), 'moodLoadingCards', false, true);
    const reply = await requestSatiReading(state, q, state.activeSpread, false);
    state.isThinking = false;
    setSatiDialogue(reply, 'moodReply', true, false, {
      isNatal10: false,
      question: lastRealUserQ || q,
      cards: toCardMeta(state.activeSpread)
    });
  }
  state.freeChatQuota = 1;
  updateHUD();
  renderSmartPromptChips();
  await saveAccountState(state);
}

function spendCoins(amount) {
  if (hasUnlimitedAccess()) return true;
  if (state.coins < amount) {
    const nick = state.user.nickname || t(state.lang, 'userSpeakerFallback');
    setSatiDialogue(t(state.lang, 'satiPaywallDialogue', nick, amount), 'moodChat', false, false);
    showToast(t(state.lang, 'toastNoCoins'));
    openShopModal();
    return false;
  }
  state.coins -= amount;
  updateHUD();
  saveAccountState(state);
  return true;
}

function triggerFollowUpDraw(count, freeViaAd = false) {
  if (state.remainingDeck.length < count) {
    showToast(t(state.lang, 'toastLowDeck'));
    document.getElementById('btn-reshuffle').classList.remove('hidden');
    return;
  }
  if (!freeViaAd && !spendCoins(count === 10 ? 8 : count)) return;

  const q = document.getElementById('chat-input').value.trim();
  if (q) appendHistory(state.user.nickname, q, 'user');

  enterPickingPhase(count, 'followup');
  setSatiDialogue(t(state.lang, 'waitPickFollowUpDialogue', count), 'moodWaitPick', false, false);
}

// =========================================================================
// 5. INITIALIZATION & UI EVENT BINDINGS
// =========================================================================
function syncBirthdateLanguageLabels() {
  const lang = state.lang;
  const pack = getTextPack(lang);
  const monthSel = document.getElementById('input-month');
  const yearSel = document.getElementById('input-year');
  if (monthSel && Array.isArray(pack.months)) {
    [...monthSel.options].forEach((opt, idx) => {
      if (pack.months[idx]) opt.textContent = pack.months[idx];
    });
  }
  if (yearSel && typeof pack.formatYear === 'function') {
    [...yearSel.options].forEach((opt) => {
      const beYear = parseInt(opt.value, 10);
      if (!isNaN(beYear)) opt.textContent = pack.formatYear(beYear);
    });
  }
}

function populateBirthdateSelectors() {
  const daySel = document.getElementById('input-day');
  const monthSel = document.getElementById('input-month');
  const yearSel = document.getElementById('input-year');
  const months = getTextPack(state.lang).months;

  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    if (d === 25) opt.selected = true;
    daySel.appendChild(opt);
  }
  months.forEach((m, idx) => {
    const opt = document.createElement('option');
    opt.value = idx + 1;
    opt.textContent = m;
    if (idx === 5) opt.selected = true;
    monthSel.appendChild(opt);
  });
  for (let y = 2555; y >= 2495; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = getTextPack(state.lang).formatYear(y);
    if (y === 2539) opt.selected = true;
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

  const toggleDialogueBtn = document.getElementById('btn-toggle-dialogue');
  if (toggleDialogueBtn) {
    toggleDialogueBtn.textContent = t(lang, state.dialogueCollapsed ? 'btnExpandBox' : 'btnCollapseBox');
  }
  const toggleDockBtn = document.getElementById('btn-toggle-dock');
  if (toggleDockBtn) {
    toggleDockBtn.textContent = t(lang, state.dockCollapsed ? 'btnShowDock' : 'btnHideDock');
  }
  const moodEl = document.getElementById('sati-mood-tag');
  if (moodEl) {
    moodEl.textContent = t(lang, state.currentMoodKey || 'moodIdle');
  }

  if (state.screen === 'game') {
    updateHUD();
    updateActiveStrip();
    renderSmartPromptChips();
    if (state.isPicking) {
      updatePickInstruction();
    }
  } else {
    const dlgContent = document.getElementById('dialogue-content');
    if (dlgContent && dlgContent.textContent.trim().length < 30) {
      dlgContent.textContent = t(lang, 'dialogueInitial');
    }
  }

  if (document.getElementById('modal-shop')?.open && state.selectedShopPkg) {
    openShopQrCheckout(state.selectedShopPkg);
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

  if (saved && saved.user) {
    document.getElementById('input-fullname').value = saved.user.fullname || defaultFullname;
    document.getElementById('input-nickname').value = saved.user.nickname || defaultNickname;
    if (saved.user.day) document.getElementById('input-day').value = saved.user.day;
    if (saved.user.month) document.getElementById('input-month').value = saved.user.month;
    if (saved.user.year) document.getElementById('input-year').value = saved.user.year;

    updateResumeBannerInfo();
    resumeBanner.classList.remove('hidden');
  } else {
    document.getElementById('input-fullname').value = defaultFullname;
    document.getElementById('input-nickname').value = defaultNickname;
    resumeBanner.classList.add('hidden');
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
      if (!state.isPicking && !state.isThinking && !state.isAnimatingShuffle && state.screen === 'game') {
        setSatiDialogue(
          t(state.lang, 'crystalDialogue', state.user.nickname),
          'moodCrystal',
          true,
          false
        );
      }
    },
    onModelsLoaded: () => {}
  });

  // Direct No-Email Device Session Entry
  document.getElementById('btn-gmail-login').addEventListener('click', () => {
    SoundFX.init();
    handleSelectEmailAccount(getOrCreateDeviceAccountId(), '', '');
  });

  document.querySelectorAll('.gmail-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      handleSelectEmailAccount(btn.dataset.email, btn.dataset.name, btn.dataset.nick);
    });
  });

  // Resume existing saved deck session
  document.getElementById('btn-resume-deck').addEventListener('click', () => {
    if (!pendingSavedRecord) return;
    SoundFX.playSeal();

    Object.assign(state.user, pendingSavedRecord.user);
    computeNatalProfile(state.user);
    state.coins = pendingSavedRecord.coins ?? 3;
    state.hasDeckPass = Boolean(pendingSavedRecord.hasDeckPass);
    const savedVip = Boolean(pendingSavedRecord.hasVipPass);
    const savedVipExp = pendingSavedRecord.vipExpiresAt || null;
    state.hasVipPass = savedVip && (!savedVipExp || savedVipExp > Date.now());
    state.vipExpiresAt = state.hasVipPass ? savedVipExp : null;
    state.freeChatQuota = typeof pendingSavedRecord.freeChatQuota === 'number' ? pendingSavedRecord.freeChatQuota : 1;
    state.deckNumber = pendingSavedRecord.deckNumber || 1;
    state.remainingDeck = pendingSavedRecord.remainingDeck?.length > 0
      ? hydrateDeckCards(pendingSavedRecord.remainingDeck)
      : shuffleArray(buildFullDeck78());
    state.natalCards = hydrateDeckCards(pendingSavedRecord.natalCards || []);
    state.natalCompleted = Boolean(pendingSavedRecord.natalCompleted);
    state.activeSpread = hydrateDeckCards(pendingSavedRecord.activeSpread || []);
    state.chatHistory = pendingSavedRecord.chatHistory || [];
    state.lastTopic = pendingSavedRecord.lastTopic || 'general';

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
    updateHUD();
    updateActiveStrip();
    renderSmartPromptChips();

    const lastSatiMsg = [...state.chatHistory].reverse().find((h) => isSatiEntry(h));
    setSatiDialogue(
      lastSatiMsg
        ? lastSatiMsg.text
        : t(state.lang, 'welcomeBackDialogue', state.user.nickname, state.remainingDeck.length),
      'moodResume',
      false,
      false
    );
  });

  // Start Fresh Deck via Natal Ledger Submit
  document.getElementById('ledger-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    SoundFX.playSeal();
    state.user.nickname = document.getElementById('input-nickname').value.trim();
    state.user.fullname = document.getElementById('input-fullname').value.trim();
    state.user.day = parseInt(document.getElementById('input-day').value, 10);
    state.user.month = parseInt(document.getElementById('input-month').value, 10);
    state.user.year = parseInt(document.getElementById('input-year').value, 10);
    computeNatalProfile(state.user);

    await clearAccountState(state.user.email);
    state.coins = 3;
    state.hasDeckPass = false;
    state.hasVipPass = false;
    state.vipExpiresAt = null;
    state.freeChatQuota = 1;
    state.natalCompleted = false;
    state.natalCards = [];
    state.activeSpread = [];
    state.chatHistory = [];
    state.deckNumber = 1;

    document.getElementById('pregame-lang-bar')?.classList.add('hidden');
    document.getElementById('screen-ledger').classList.add('hidden');
    document.getElementById('top-hud').classList.remove('hidden');
    document.getElementById('sati-speech-wrap').classList.remove('hidden');
    document.getElementById('game-footer').classList.remove('hidden');

    state.screen = 'game';
    state.cameraMode = '1P';
    engine3D.setCameraTarget(CAM_POS.view1P, CAM_POS.view1PLook);

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

  // Mute Toggle
  document.getElementById('btn-mute').addEventListener('click', () => {
    SoundFX.muted = !SoundFX.muted;
    document.getElementById('icon-sound-on').classList.toggle('hidden', SoundFX.muted);
    document.getElementById('icon-sound-off').classList.toggle('hidden', !SoundFX.muted);
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

  // Follow-up Draw Buttons
  document.getElementById('btn-draw-1').addEventListener('click', () => triggerFollowUpDraw(1, false));
  document.getElementById('btn-draw-3').addEventListener('click', () => triggerFollowUpDraw(3, false));
  document.getElementById('btn-draw-10-opt').addEventListener('click', () => triggerFollowUpDraw(10, false));

  // Reshuffle New 78-Card Deck
  document.getElementById('btn-reshuffle').addEventListener('click', () => {
    state.deckNumber += 1;
    if (state.hasDeckPass && !state.hasVipPass) {
      state.hasDeckPass = false;
    }
    state.remainingDeck = shuffleArray(buildFullDeck78());
    state.activeSpread = [];
    engine3D.tuckNatalSpreadAway3D();
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

  // Chat Form Submit (Quota / Coin-gated deep follow-up via Backend Proxy + Fallback)
  document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const q = input.value.trim();
    if (!q || state.isThinking) return;

    if (!hasUnlimitedAccess()) {
      if (state.freeChatQuota > 0) {
        state.freeChatQuota -= 1;
        updateHUD();
      } else if (!spendCoins(1)) {
        return;
      }
    }

    appendHistory(state.user.nickname, q, 'user');
    input.value = '';
    SoundFX.playPick();

    const refCards = state.activeSpread.length > 0 ? state.activeSpread : state.natalCards;
    state.isThinking = true;
    renderSmartPromptChips();
    setSatiDialogue(t(state.lang, 'loadingQuestionDialogue', state.user.nickname), 'moodLoadingThink', false, true);
    const reply = await requestSatiReading(state, q, refCards, false);
    state.isThinking = false;
    setSatiDialogue(reply, 'moodDeep', true, false, {
      isNatal10: false,
      sourceWasNatal10: state.activeSpread.length === 0,
      question: q,
      cards: refCards.map((c) => ({ uid: c.uid, name: c.name, th: c.th }))
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
    img.className = `${isWideGrid ? 'w-12 sm:w-14' : 'w-14 sm:w-16'} aspect-[2/3] object-cover border border-[#d4af37]/40 bg-[#efe5d2]`;

    const posEl = document.createElement('span');
    posEl.className = 'text-[10px] text-[#d4af37] font-semibold leading-tight line-clamp-2';
    posEl.textContent = item.posLabel;

    const nameEl = document.createElement('span');
    nameEl.className = 'text-[11px] text-[#f1ede4] font-medium leading-tight line-clamp-2';
    nameEl.textContent = getLocalizedCardShortName(item.card, lang);

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
    titleBtn.textContent = `${item.posLabel} — ${item.title}`;
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

  // Chat History Modal
  document.getElementById('btn-chat-history').addEventListener('click', () => {
    const list = document.getElementById('history-list');
    list.innerHTML = '';
    const lang = state.lang;
    let lastUserQuestion = '';

    state.chatHistory.forEach((entry) => {
      const row = document.createElement('div');
      const isSati = isSatiEntry(entry);
      row.className = `p-2.5 border ${isSati ? 'border-[#d4af37]/30 bg-[#141933]/70' : 'border-[#4d5785]/40 bg-[#0b0d19]/80'}`;

      if (!isSati && !entry.isDrawAction) {
        lastUserQuestion = entry.text || '';
      }

      const spk = document.createElement('div');
      spk.className = `text-xs font-semibold ${isSati ? 'text-[#d4af37]' : 'text-[#9dd2ff]'} mb-1`;
      spk.textContent = isSati ? t(lang, 'satiSpeaker') : entry.speaker;
      const body = document.createElement('div');
      body.className = 'text-xs text-[#f1ede4] leading-relaxed whitespace-pre-line';
      body.textContent = entry.text;
      row.append(spk, body);

      if (isSati) {
        const breakdown = buildReadingBreakdown(entry, lastUserQuestion, state, all78Cards);
        if (breakdown.isReading) {
          const footer = document.createElement('div');
          footer.className = 'flex justify-end mt-2';

          const dotsBtn = document.createElement('button');
          dotsBtn.type = 'button';
          dotsBtn.className = 'btn-history-dots px-2.5 py-0.5 rounded-sm border border-[#d4af37]/35 bg-[#0b0d19]/80 text-[#d4af37] hover:bg-[#d4af37]/15 hover:border-[#d4af37]/80 transition-colors text-base leading-none tracking-widest cursor-pointer';
          dotsBtn.textContent = '⋯';
          dotsBtn.title = t(lang, 'btnCardBreakdownOpen');
          dotsBtn.setAttribute('aria-label', t(lang, 'btnCardBreakdownOpen'));
          dotsBtn.setAttribute('aria-expanded', 'false');

          const panel = document.createElement('div');
          panel.className = 'hidden mt-2.5 pt-3 border-t border-[#d4af37]/25 space-y-3 bg-[#090b16]/85 p-3';

          let rendered = false;
          dotsBtn.addEventListener('click', () => {
            if (!rendered) {
              renderBreakdownPanel(panel, breakdown, state.lang);
              rendered = true;
            }
            const willOpen = panel.classList.contains('hidden');
            panel.classList.toggle('hidden', !willOpen);
            dotsBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            const tip = t(state.lang, willOpen ? 'btnCardBreakdownClose' : 'btnCardBreakdownOpen');
            dotsBtn.title = tip;
            dotsBtn.setAttribute('aria-label', tip);
            dotsBtn.classList.toggle('bg-[#d4af37]/20', willOpen);
            dotsBtn.classList.toggle('border-[#d4af37]', willOpen);
          });

          footer.appendChild(dotsBtn);
          row.append(footer, panel);
        }
      }

      list.appendChild(row);
    });
    openModal('modal-history');
  });

  // Shop Modal & PromptPay QR Checkout
  document.getElementById('btn-shop-open').addEventListener('click', () => {
    openShopModal();
  });
  document.getElementById('btn-buy-coins').addEventListener('click', () => openShopQrCheckout('coins'));
  document.getElementById('btn-buy-pass').addEventListener('click', () => openShopQrCheckout('pass'));
  document.getElementById('btn-buy-vip').addEventListener('click', () => openShopQrCheckout('vip'));
  document.getElementById('btn-back-to-tiers').addEventListener('click', () => {
    state.selectedShopPkg = null;
    document.getElementById('shop-qr-checkout')?.classList.add('hidden');
    document.getElementById('shop-tier-list')?.classList.remove('hidden');
  });
  document.getElementById('btn-confirm-payment').addEventListener('click', () => {
    const pkgId = state.selectedShopPkg;
    const pkg = SHOP_PACKAGES[pkgId];
    if (!pkg) return;

    if (pkgId === 'coins') {
      state.coins += 19;
    } else if (pkgId === 'pass') {
      state.hasDeckPass = true;
    } else if (pkgId === 'vip') {
      state.hasVipPass = true;
      state.vipExpiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    }

    SoundFX.playSeal();
    state.selectedShopPkg = null;
    updateHUD();
    saveAccountState(state);
    closeModal('modal-shop');
    showToast(t(state.lang, pkg.toastKey));

    if (state.screen === 'game') {
      const nick = state.user.nickname || t(state.lang, 'userSpeakerFallback');
      setSatiDialogue(t(state.lang, 'satiThankYouPurchase', nick, t(state.lang, pkg.titleKey)), 'moodChat', false, false);
    }
  });

  // In-App Feedback & Tester Summary Modal
  let feedbackRating = 5;
  const feedbackTagsSelected = new Set();
  let cachedFeedbackData = { count: 0, avgRating: 0, items: [] };

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

  function renderFeedbackList() {
    const statsEl = document.getElementById('feedback-summary-stats');
    const listEl = document.getElementById('feedback-entries-list');
    if (!statsEl || !listEl) return;

    const { count, avgRating, items } = cachedFeedbackData;
    statsEl.textContent = t(state.lang, 'feedbackStatsFmt', count, count > 0 ? avgRating.toFixed(1) : '0.0');
    listEl.innerHTML = '';

    if (!items || items.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-center text-[#a6a8b8] py-4';
      empty.textContent = t(state.lang, 'feedbackEmpty');
      listEl.appendChild(empty);
      return;
    }

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'p-2.5 bg-[#0e1328]/85 border border-[#d4af37]/25 space-y-1';

      const hdr = document.createElement('div');
      hdr.className = 'flex items-center justify-between gap-2';
      const who = document.createElement('span');
      who.className = 'font-semibold text-[#f1ede4]';
      who.textContent = `${item.nickname || 'Tester'} · ${'★'.repeat(Math.max(1, Math.min(5, item.rating || 5)))}`;
      const dateEl = document.createElement('span');
      dateEl.className = 'text-[10px] text-[#8d90a3]';
      dateEl.textContent = item.createdAt ? new Date(item.createdAt).toLocaleString() : '';
      hdr.append(who, dateEl);
      card.appendChild(hdr);

      if (Array.isArray(item.tags) && item.tags.length > 0) {
        const tagLine = document.createElement('div');
        tagLine.className = 'text-[11px] text-[#f3d266]';
        tagLine.textContent = item.tags.map((tg) => `#${tg}`).join(' ');
        card.appendChild(tagLine);
      }

      if (item.comment) {
        const msg = document.createElement('p');
        msg.className = 'text-[#d6cfc2] whitespace-pre-line leading-relaxed';
        msg.textContent = item.comment;
        card.appendChild(msg);
      }

      listEl.appendChild(card);
    });
  }

  async function switchFeedbackTab(tab) {
    const isForm = tab === 'form';
    document.getElementById('feedback-form-view')?.classList.toggle('hidden', !isForm);
    document.getElementById('feedback-list-view')?.classList.toggle('hidden', isForm);

    const tabFormBtn = document.getElementById('btn-feedback-tab-form');
    const tabListBtn = document.getElementById('btn-feedback-tab-list');
    tabFormBtn?.classList.toggle('btn-gold', isForm);
    tabFormBtn?.classList.toggle('btn-slate', !isForm);
    tabListBtn?.classList.toggle('btn-gold', !isForm);
    tabListBtn?.classList.toggle('btn-slate', isForm);

    if (!isForm) {
      try {
        const res = await fetch('/api/sati/feedback');
        if (res.ok) {
          cachedFeedbackData = await res.json();
        }
      } catch {
        // retain local cache if offline
      }
      renderFeedbackList();
    }
  }

  function openFeedbackModal(defaultTab = 'form') {
    SoundFX.playPick();
    renderFeedbackStars();
    renderFeedbackTags();
    switchFeedbackTab(defaultTab);
    openModal('modal-feedback');
  }

  document.getElementById('btn-feedback-open')?.addEventListener('click', () => openFeedbackModal('form'));
  document.getElementById('btn-speech-feedback')?.addEventListener('click', () => openFeedbackModal('form'));
  document.getElementById('btn-feedback-tab-form')?.addEventListener('click', () => switchFeedbackTab('form'));
  document.getElementById('btn-feedback-tab-list')?.addEventListener('click', () => switchFeedbackTab('list'));

  document.querySelectorAll('.feedback-star').forEach((btn) => {
    btn.addEventListener('click', () => {
      feedbackRating = parseInt(btn.dataset.star, 10) || 5;
      renderFeedbackStars();
    });
  });

  document.getElementById('feedback-form-view')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const commentEl = document.getElementById('feedback-comment');
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

    try {
      const res = await fetch('/api/sati/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.entry) {
          cachedFeedbackData.items = [data.entry, ...(cachedFeedbackData.items || [])];
          cachedFeedbackData.count = cachedFeedbackData.items.length;
        }
      }
    } catch {
      // ignore offline save error
    }

    if (commentEl) commentEl.value = '';
    feedbackTagsSelected.clear();
    feedbackRating = 5;
    renderFeedbackStars();
    renderFeedbackTags();
    showToast(t(state.lang, 'toastFeedbackSaved'));
    await switchFeedbackTab('list');
  });

  document.getElementById('btn-export-feedback-csv')?.addEventListener('click', () => {
    const items = cachedFeedbackData.items || [];
    const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const rows = [
      ['CreatedAt', 'Nickname', 'Rating', 'Tags', 'Comment', 'Lang'].join(','),
      ...items.map((it) => [
        esc(it.createdAt),
        esc(it.nickname),
        esc(it.rating),
        esc((it.tags || []).join(' | ')),
        esc(it.comment),
        esc(it.lang)
      ].join(','))
    ];
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sati-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  window.addEventListener('sati:rerender-feedback', () => {
    renderFeedbackTags();
    if (!document.getElementById('feedback-list-view')?.classList.contains('hidden')) {
      renderFeedbackList();
    }
  });
});
