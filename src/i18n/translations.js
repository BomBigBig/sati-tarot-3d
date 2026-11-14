/**
 * Application UI & Dialogue Localization Dictionary (TH / EN / ZH)
 */
import { normalizeLang } from '../data/tarot78I18n.js';

export const UI_TEXT = {
  th: {
    pageTitle: 'SATI — สำรับแห่งสติ',
    loginSubtitle: 'ดูดวงกับหมอดูสติ พื้นที่คุยกันแบบตรงไปตรงมา กันเองและจริงใจ เพื่อให้ทุกท่านได้มุมมองในการใช้ชีวิตอย่างมีคุณค่า ทุกวินาที',
    gmailLoginBtn: 'เริ่มดูดวงกับสติ',
    loginPrivacyNote: 'ข้อมูลชื่อและวันเกิดใช้สำหรับผูกพื้นฐานดวงชะตาเข้ากับหน้าไพ่ในสำรับเท่านั้น',

    ledgerEyebrow: 'สมุดบันทึกพื้นดวง',
    ledgerDeviceBadge: 'บันทึกดวงประจำเครื่องนี้',
    ledgerTitle: 'ลงชื่อก่อนจับไพ่กับสติ',
    btnResumeDeck: 'เข้าสู่สำรับเดิมที่เปิดค้างไว้ทันที',
    resumeDeckInfo: (nick, rem, coins) => `พบข้อมูลสำรับเดิมของ ${nick} (ไพ่คงเหลือ ${rem}/78 ใบ | เหรียญ ${coins})`,
    labelNickname: 'ชื่อเล่น (สติจะใช้เรียกชื่อนี้ตลอดการคุย)',
    placeholderNickname: 'เช่น บอม',
    labelFullname: 'ชื่อจริง - นามสกุล (สำหรับวิเคราะห์พลังทักษา)',
    placeholderFullname: 'เช่น ธนภัทร พิมพ์มากร',
    labelBirthdate: 'วัน เดือน ปีเกิด (พ.ศ.)',
    btnSubmitLedger: 'ประทับตราเริ่มดูดวง',
    months: ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'],
    formatYear: (beYear) => `${beYear}`,

    cleanPickBadge: 'แตะหยิบไพ่บนกระดานได้เลย',
    btnRestoreUi: 'แสดงเมนู',
    hudDeckLabel: 'สำรับ',
    btnDeckGallery: 'สมุดภาพไพ่ 78 ใบ',
    btnNatalDrawer: 'พื้นดวง 10 ใบ',
    hudCoinsCount: (c) => `${c} เหรียญ`,
    hudCoinsUnlimited: 'ไม่จำกัด',
    hudPassBadge: 'เหมาสำรับ',
    hudVipBadge: 'VIP รายเดือน',
    cam1P: 'มุมมอง: สายตา 1P',
    cam2P: 'มุมมอง: โต๊ะไพ่ 2P',
    btnHideUi: 'ดูโต๊ะเต็มจอ',
    titleGallery: 'สมุดภาพไพ่ 78 ใบ',
    titleNatal: 'ดูไพ่พื้นดวง 10 ใบแรก',
    titleCamToggle: 'สลับมุมมอง 1P / 2P',
    titleMute: 'เปิด/ปิดเสียง',
    titleHideUi: 'ซ่อนปุ่มทั้งหมดเพื่อดูโต๊ะและไพ่เต็มจอ',

    satiSpeaker: 'สติ',
    userSpeakerFallback: 'ผู้ถาม',
    moodIdle: 'ประจำโต๊ะ',
    moodChat: 'คุยตรงประเด็น',
    moodGreeting: 'ทักทาย',
    moodResume: 'คุยต่อเนื่อง',
    moodDeckReady: 'สำรับใหม่พร้อม',
    moodCrystal: 'เพ่งลูกแก้วคริสตัล',
    moodNatal10: 'อ่านพื้นดวง 10 ใบ',
    moodReply: 'ตอบตรงประเด็น',
    moodDeep: 'คุยเจาะลึก',
    moodWaitPick: 'รอเลือกไพ่',
    moodShuffle: 'สับสำรับ',
    moodLoadingNatal: 'อ่านพื้นดวง',
    moodLoadingCards: 'อ่านหน้าไพ่',
    moodLoadingThink: 'กำลังอ่านไพ่',

    dialoguePreview: 'แตะเลือกไพ่บนโต๊ะได้เลย...',
    btnChatHistory: 'ดูประวัติการคุย',
    btnCollapseBox: 'ย่อกล่อง',
    btnExpandBox: 'ขยายคำพูด',
    dialogueInitial: 'กำลังเตรียมสำรับ...',

    btnHideDock: 'ซ่อนแผงปุ่ม',
    btnShowDock: 'แสดงแผงปุ่ม',
    pickInstructionDefault: 'แตะเลือกไพ่จากวงพัดบนโต๊ะ',
    pickInstructionFmt: (label, cur, target) => `${label} (${cur} / ${target})`,
    pickSubtext: 'แตะที่ไพ่ในวงพัดโดยตรง หรือกดปุ่มดูโต๊ะเต็มจอด้านบนเพื่อซ่อนเมนู',
    btnAutoPick: 'สุ่มหยิบให้ครบ',
    btnDraw1: 'จั่วเพิ่ม 1 ใบ',
    btnDraw1Cost: '(1 เหรียญ)',
    btnDraw3: 'จั่วเพิ่ม 3 ใบ',
    btnDraw3Cost: '(3 เหรียญ)',
    btnDraw1Ad: 'ดูคลิปสั้น',
    btnDraw1AdFree: 'จั่ว 1 ใบฟรี',
    btnDraw10Opt: 'เปิดผังใหญ่ 10 ใบ',
    btnDraw10Cost: '(8 เหรียญ)',
    btnReshuffle: 'สับสำรับใหม่ 78 ใบ',
    chatPlaceholder: 'พิมพ์ถามสติต่อได้เลย...',
    btnChatSubmit: 'ถามสติ',
    btnChatSubmitFree: (n) => `ถามสติ (ฟรี ${n} ครั้ง)`,
    btnChatSubmitCoin: 'ถามสติ (1 เหรียญ)',

    modalGmailTitle: 'เลือกบัญชี Gmail เพื่อเข้าสู่ระบบ',
    modalGmailSub: 'ระบบจะจำพื้นดวงและประวัติไพ่ผูกกับบัญชีนี้',
    gmailPickLabel: 'เลือก',
    gmailGuestSub: 'บัญชีทดลองใหม่',
    btnCancel: 'ยกเลิก',
    btnClose: 'ปิด',
    btnCardReturn: 'วางกลับลงโต๊ะ',

    modalNatalTitle: 'บันทึกพื้นดวง 10 ใบแรก',
    natalSummaryFmt: (user, elemName, natalCount) =>
      `ทักษา ${user.dayName} (ธาตุ${elemName}) | เลขชีวิต ${user.lifePath} | ไพ่ประจำตัว: ${user.birthCard}`,
    natalCardItemFmt: (idx, pos, label) => `ใบที่ ${idx + 1} (${pos}): ${label}`,

    modalGalleryTitle: 'สมุดภาพหน้าไพ่ทาโรต์ 3D โพลิกอนทั้ง 78 ใบ',
    modalGallerySub: 'แตะที่ไพ่ใบใดก็ได้เพื่อดูภาพขยายและความหมายเตือนสติ',
    filterAll: 'ทั้งหมด (78)',
    filterMajor: 'ไพ่ใหญ่ (22)',
    filterWands: 'ไม้เท้า',
    filterCups: 'ถ้วย',
    filterSwords: 'ดาบ',
    filterPentacles: 'เหรียญ',
    galleryOriginTag: 'สมุดภาพไพ่ 78 ใบ',

    modalHistoryTitle: 'ประวัติการสนทนากับสติ',
    modalShopTitle: 'คลังพลังงาน & สิทธิ์ดูดวงพิเศษ',
    shopBuyCoinsTitle: 'เติม 19 เหรียญเปิดดวง',
    shopBuyCoinsSub: 'ถามขยี้ต่อหรือจั่วไพ่เพิ่ม 1-3 ใบได้ตามต้องการ',
    shopBuyCoinsPrice: '99 บาท',
    shopBuyPassTitle: 'ตั๋วเหมาสำรับ 78 ใบ (คุ้มสุดต่อรอบ)',
    shopBuyPassSub: 'จั่วไพ่ + ถามขยี้ต่อไม่อั้นจนกว่าไพ่สำรับนี้จะหมดกอง',
    shopBuyPassPrice: '299 บาท',
    shopBuyVipTitle: 'Sati VIP รายเดือน (30 วัน)',
    shopBuyVipSub: 'ดูดวงไม่อั้นทุกสำรับ สับไพ่ใหม่และถามเจาะลึกได้ไม่จำกัดตลอด 30 วัน',
    shopBuyVipPrice: '999 บาท',
    shopQrHeader: 'สแกน QR PromptPay เพื่อชำระเงิน',
    shopQrAmountFmt: (amt) => `ยอดชำระ: ${amt}.00 บาท`,
    btnConfirmPayment: 'ยืนยันการชำระเงินสำเร็จ',
    btnBackToTiers: '← เลือกแพ็กเกจอื่น',
    shopNotice: 'ระบบจำลองการสแกนจ่าย PromptPay (กดยืนยันเพื่อรับสิทธิ์ได้ทันที)',

    activeCardLabel: (idx) => `ไพ่ใบที่ ${idx + 1}`,
    pickOrderPos: (count, pos) => (pos ? `ใบที่ ${count}: ${pos}` : `ใบที่ ${count}`),
    cardModalMeaning: (d) => `${d.core}\n\n• การงาน: ${d.work}\n• การเงิน: ${d.money}\n• ความรัก: ${d.love}\n• เตือนสติ: ${d.advice}`,

    shufflingDialogue: (nick) => `กำลังสับไพ่ 78 ใบให้${nick} สักครู่นะ...`,
    loadingNatalDialogue: (fullname) => `กำลังผูกพื้นดวงชื่อ ${fullname} เข้ากับไพ่ทั้ง 10 ใบ...`,
    loadingCardsDialogue: (nick) => `กำลังอ่านหน้าไพ่ที่${nick}เพิ่งหยิบขึ้นมา...`,
    loadingQuestionDialogue: (nick) => `กำลังพิจารณาคำถามของ${nick}เชื่อมกับหน้าไพ่...`,
    fallbackExpandQ: (lastQ) => `ขยายความต่อจากที่ถามไว้ว่า "${lastQ}"`,
    fallbackDefaultQ: 'อ่านสถานการณ์ตรงหน้าจากไพ่ชุดนี้',
    drawFollowUpActionLabel: (count) => `เปิดไพ่เพิ่ม ${count} ใบ`,
    pickFollowUpPrompt: (count) => `แตะเลือกไพ่ขยายความ ${count} ใบ`,
    waitPickFollowUpDialogue: (count) => `เลือกหยิบมา ${count} ใบจากกองเดิมได้เลย เดี๋ยวสติอ่านเชื่อมให้ฟัง`,
    pickInitialPrompt: 'เลือกไพ่พื้นดวง 10 ใบแรก',

    welcomeFirstDialogue: (nick) =>
      `สวัสดีนะ${nick} เราชื่อสติ เดี๋ยวรอบแรกนี้หยิบไพ่มา 10 ใบก่อน เราจะได้ผูกเข้ากับชื่อและวันเกิดของ${nick} เพื่อเช็กสถานการณ์อดีตถึงปัจจุบันให้ชัดๆ (กดสลับมุมมองด้านขวาบนได้แล้วนะ)`,
    welcomeBackDialogue: (nick, rem) =>
      `ยินดีต้อนรับกลับมานะ${nick} สำรับเดิมของเรายังวางอยู่บนโต๊ะ (เหลือ ${rem} ใบ) อยากถามเรื่องไหนต่อหรือจั่วไพ่เพิ่มบอกสติได้เลย`,
    reshuffledDialogue: (nick) =>
      `สับสำรับใหม่ครบ 78 ใบแล้วนะ${nick} รอบนี้ไม่ต้องเปิดพื้นดวง 10 ใบซ้ำแล้ว พิมพ์ถามหรือกดจั่ว 1 ใบ / 3 ใบต่อได้เลย`,
    crystalDialogue: (nick) =>
      `คลื่นแสงในลูกแก้วคริสตัลสว่างรับกับสมาธิของ${nick}มากเลย ถ้ามีคำถามค้างใจพิมพ์ถามหรือจั่วไพ่ต่อได้เลยนะ`,

    toastNoCoins: 'เหรียญเปิดดวงไม่พอ เลือกเติมพลังเหรียญหรือเปิดตั๋วเหมาสำรับได้เลย',
    toastLowDeck: 'ไพ่ในสำรับเหลือน้อยเกินไป กดสับสำรับใหม่ 78 ใบได้เลย',
    toastCrystal: 'พลังงานจากลูกแก้วคริสตัลตอบรับสมาธิแล้ว',
    toastAddCoins: 'เติม 19 เหรียญเรียบร้อย พร้อมดูดวงต่อได้เลย',
    toastUnlockPass: 'เปิดใช้งานตั๋วเหมาสำรับ 78 ใบเรียบร้อย',
    toastUnlockVip: 'เปิดใช้งาน Sati VIP รายเดือน (30 วัน) เรียบร้อย',

    satiPaywallDialogue: (nick, cost) =>
      `เหรียญเปิดดวงของ${nick}ไม่พอสำหรับรอบนี้แล้วนะ (ต้องใช้ ${cost} เหรียญ) เรื่องที่เราคุยกันกำลังเข้าจุดสำคัญเลย ถ้าอยากเจาะให้สุดทาง เลือกเติม 19 เหรียญ (99฿) หรือเปิดตั๋วเหมาสำรับ 78 ใบ (299฿) ในคลังพลังงานได้เลย เดี๋ยวสติช่วยอ่านต่อให้ชัดๆ`,
    satiThankYouPurchase: (nick, label) =>
      `ขอบคุณนะ${nick} เปิดสิทธิ์「${label}」เรียบร้อยแล้ว อยากเจาะลึกเรื่องไหนต่อ หรืออยากหยิบไพ่เพิ่ม ลุยต่อกันได้เลย!`,

    smartPromptsByTopic: {
      work: [
        { label: '⚡ จุดเปลี่ยนงานใน 3 เดือนนี้', question: 'จุดเปลี่ยนสำคัญเรื่องงานในอีก 3 เดือนข้างหน้าคืออะไร และฉันควรตัดสินใจยังไงดี', drawCount: 0 },
        { label: '🧭 งานนี้ไปต่อหรือเปลี่ยนทาง?', question: 'งานหรือโปรเจกต์ที่ทำอยู่ตอนนี้ ควรทุ่มไปต่อหรือมองหาทางใหม่ที่คุ้มกว่า', drawCount: 0 },
        { label: '🔮 เปิดไพ่ 3 ใบ: เส้นทางงาน & โอกาส (3 เหรียญ)', question: 'ขอเปิดไพ่ 3 ใบเจาะลึกเส้นทางงาน โอกาสเติบโต และสิ่งที่ต้องระวังตรงหน้า', drawCount: 3 }
      ],
      money: [
        { label: '💰 จุดรั่วการเงินที่มองไม่เห็น', question: 'ตอนนี้มีจุดรั่วทางการเงินหรือจังหวะเสี่ยงตรงไหนที่สติเห็นว่าต้องรีบอุดบ้าง', drawCount: 0 },
        { label: '📈 โอกาสเก็บก้อนใหญ่ช่วงนี้', question: 'ช่วงนี้จังหวะรายรับและเงินก้อนจะขยับขึ้นจากทางไหนได้ชัดที่สุด', drawCount: 0 },
        { label: '🔮 เปิดไพ่ 3 ใบ: กระแสเงิน & โชคลาภ (3 เหรียญ)', question: 'ขอเปิดไพ่ 3 ใบดูทิศทางกระแสเงิน โอกาสรับทรัพย์ และจุดที่ห้ามประมาท', drawCount: 3 }
      ],
      love: [
        { label: '❤️ ความคิดลึกๆ ของอีกฝ่าย', question: 'ความรู้สึกและความคิดลึกๆ ของอีกฝ่ายที่มีต่อฉันตอนนี้เป็นยังไงกันแน่', drawCount: 0 },
        { label: '⏳ ควรลุยต่อหรือถอยตั้งหลัก?', question: 'ในความสัมพันธ์นี้ ฉันควรเดินหน้าเปิดใจต่อ หรือควรถอยมาตั้งหลักให้ชัดก่อน', drawCount: 0 },
        { label: '🔮 เปิดไพ่ 3 ใบ: ทิศทางใจเราสองคน (3 เหรียญ)', question: 'ขอเปิดไพ่ 3 ใบเจาะลึกความรู้สึกจริง ปมที่ค้างคา และบทสรุปความสัมพันธ์นี้', drawCount: 3 }
      ],
      self: [
        { label: '🎯 ก้าวแรกที่ต้องลงมือทันที', question: 'จากไพ่ตรงหน้า อะไรคือสิ่งแรกที่ฉันควรลงมือเปลี่ยนหรือโฟกัสภายในสัปดาห์นี้', drawCount: 0 },
        { label: '⚠️ อุปสรรคในใจที่ฉุดไว้', question: 'ตอนนี้ความกลัวหรือนิสัยเดิมแบบไหนที่กำลังฉุดไม่ให้ฉันไปข้างหน้า', drawCount: 0 },
        { label: '🔮 เปิดไพ่ 3 ใบ: แนวทางปลดล็อกชีวิต (3 เหรียญ)', question: 'ขอเปิดไพ่ 3 ใบดูทางออกชีวิต จุดแข็งที่ต้องใช้ และคำเตือนสำคัญช่วงนี้', drawCount: 3 }
      ],
      general: [
        { label: '🔎 เรื่องสำคัญสุดที่ไพ่เตือน', question: 'จากไพ่ทั้งหมดตอนนี้ เรื่องไหนเร่งด่วนและสำคัญที่สุดที่ฉันต้องรีบจัดการ', drawCount: 0 },
        { label: '🚀 สิ่งที่ควรทำภายในสัปดาห์นี้', question: 'ในสัปดาห์นี้ ถ้าต้องเลือกโฟกัสเพียง 1 อย่างให้คุ้มแรงที่สุด ควรทำอะไร', drawCount: 0 },
        { label: '🔮 เปิดไพ่ 3 ใบ: เจาะลึกสถานการณ์ (3 เหรียญ)', question: 'ขอเปิดไพ่ 3 ใบเจาะลึกสถานการณ์ตรงหน้า แนวโน้ม และวิธีรับมือที่ดีที่สุด', drawCount: 3 }
      ]
    },

    btnCardBreakdownOpen: 'ดูความเชื่อมโยงและที่มาไพ่',
    btnCardBreakdownClose: 'ซ่อนที่มาไพ่',
    breakdownPart1Title: '1. ไพ่ทั้งหมดในรอบนี้ (คลิกที่ใบไพ่เพื่อขยาย)',
    breakdownCitedTag: 'ใบเด่นที่สรุป',
    breakdownPart2Title: '2. ความเชื่อมโยงของไพ่แต่ละใบกับคำถาม',
    breakdownPart3Title: '3. ทำไมหน้าไพ่ถึงสื่อความหมายแบบนี้',
    breakdownOtherNatalToggle: (n) => `ดูรายละเอียดไพ่อีก ${n} ใบที่เหลือในพื้นดวง`,
    breakdownLabelCore: 'ความหมายแกนหลัก:',
    breakdownLabelWhy: 'ทำไมถึงสื่อตรงคำถามนี้:',
    breakdownLabelAdvice: 'จุดที่ต้องลงมือ / ระวัง:',

    btnFeedbackOpen: '★ รีวิว / ติชม',
    modalFeedbackTitle: 'ส่งฟีดแบ็กช่วยพัฒนาหมอดูสติ',
    feedbackSub: 'ความคิดเห็นของคุณช่วยให้เราปรับปรุงคำทำนายและระบบให้ดียิ่งขึ้น',
    feedbackTabForm: 'เขียนรีวิว / ติชม',
    feedbackTabList: 'ดูฟีดแบ็กทั้งหมด',
    feedbackRatingLabel: 'ความพึงพอใจและความแม่นยำโดยรวม',
    feedbackTags: ['ทักแม่นตรงจุด', 'ภาษาเป็นธรรมชาติ', 'ภาพ 3D สวยลื่นไหล', 'ใช้งานง่าย', 'อยากให้ปรับปรุงเพิ่ม'],
    feedbackCommentPlaceholder: 'เล่าให้ฟังได้เลยว่าชอบอะไร หรืออยากให้ปรับปรุงจุดไหนเพิ่มเติม...',
    btnSubmitFeedback: 'ส่งฟีดแบ็กให้ผู้พัฒนา',
    btnExportFeedbackCsv: 'ดาวน์โหลด CSV',
    toastFeedbackSaved: 'ขอบคุณสำหรับฟีดแบ็ก! บันทึกข้อมูลเรียบร้อยแล้ว',
    feedbackNeedInputToast: 'พิมพ์ข้อความหรือเลือกแท็กสักข้อก่อนส่งฟีดแบ็กนะครับ',
    feedbackStatsFmt: (count, avg) => `ทั้งหมด ${count} รีวิว • คะแนนเฉลี่ย ★ ${avg} / 5.0`,
    feedbackEmpty: 'ยังไม่มีรายการฟีดแบ็กในขณะนี้'
  },

  en: {
    pageTitle: 'SATI — The Deck of Mindfulness',
    loginSubtitle: 'Tarot readings with Master Sati — a candid, warm, and sincere space for real conversation, offering clarity to live every single second with meaning.',
    gmailLoginBtn: 'Enter Reading Room',
    loginPrivacyNote: 'Your name and birthdate are used solely to align your natal chart with the deck.',

    ledgerEyebrow: 'Natal Chart Ledger',
    ledgerDeviceBadge: 'Saved on This Device',
    ledgerTitle: 'Sign the Ledger Before Drawing Cards',
    btnResumeDeck: 'Resume Saved Deck Session',
    resumeDeckInfo: (nick, rem, coins) => `Saved deck found for ${nick} (${rem}/78 cards remaining | ${coins} Coins)`,
    labelNickname: 'Nickname (Sati will address you by this name)',
    placeholderNickname: 'e.g., Bom',
    labelFullname: 'Full Name (Used for Thaksa natal analysis)',
    placeholderFullname: 'e.g., Thanapat Phimmakorn',
    labelBirthdate: 'Date of Birth',
    btnSubmitLedger: 'Seal Ledger & Begin Reading',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    formatYear: (beYear) => `${beYear - 543}`,

    cleanPickBadge: 'Tap cards on the table to draw',
    btnRestoreUi: 'Show Menu',
    hudDeckLabel: 'Deck',
    btnDeckGallery: '78-Card Gallery',
    btnNatalDrawer: 'Natal 10 Cards',
    hudCoinsCount: (c) => `${c} Coins`,
    hudCoinsUnlimited: 'Unlimited',
    hudPassBadge: 'Full Pass',
    hudVipBadge: 'VIP Monthly',
    cam1P: 'View: 1P Eye',
    cam2P: 'View: 2P Table',
    btnHideUi: 'Full Table',
    titleGallery: '78-Card Art Gallery',
    titleNatal: 'View Initial 10 Natal Cards',
    titleCamToggle: 'Switch 1P / 2P View',
    titleMute: 'Mute / Unmute Sound',
    titleHideUi: 'Hide UI controls to view table cleanly',

    satiSpeaker: 'Sati',
    userSpeakerFallback: 'You',
    moodIdle: 'At the Table',
    moodChat: 'Candid Talk',
    moodGreeting: 'Welcome',
    moodResume: 'Continuing',
    moodDeckReady: 'Fresh Deck Ready',
    moodCrystal: 'Crystal Resonance',
    moodNatal10: '10-Card Natal Spread',
    moodReply: 'Direct Insight',
    moodDeep: 'Deeper Reading',
    moodWaitPick: 'Choose Cards',
    moodShuffle: 'Shuffling',
    moodLoadingNatal: 'Reading Natal Chart',
    moodLoadingCards: 'Reading Spread',
    moodLoadingThink: 'Inspecting Cards',

    dialoguePreview: 'Tap a card in the fan on the table...',
    btnChatHistory: 'Chat History',
    btnCollapseBox: 'Minimize',
    btnExpandBox: 'Expand',
    dialogueInitial: 'Preparing the deck...',

    btnHideDock: 'Hide Controls',
    btnShowDock: 'Show Controls',
    pickInstructionDefault: 'Pick cards from the fan on the table',
    pickInstructionFmt: (label, cur, target) => `${label} (${cur} / ${target})`,
    pickSubtext: 'Tap cards directly on the fan, or press Full Table above to clear UI',
    btnAutoPick: 'Auto-Draw Remaining',
    btnDraw1: 'Draw 1 Card',
    btnDraw1Cost: '(1 Coin)',
    btnDraw3: 'Draw 3 Cards',
    btnDraw3Cost: '(3 Coins)',
    btnDraw1Ad: 'Watch Short Clip',
    btnDraw1AdFree: 'Free 1-Card Draw',
    btnDraw10Opt: '10-Card Spread',
    btnDraw10Cost: '(8 Coins)',
    btnReshuffle: 'Reshuffle 78 Cards',
    chatPlaceholder: 'Ask Sati directly...',
    btnChatSubmit: 'Ask Sati',
    btnChatSubmitFree: (n) => `Ask Sati (${n} Free)`,
    btnChatSubmitCoin: 'Ask Sati (1 Coin)',

    modalGmailTitle: 'Choose a Gmail Account to Sign In',
    modalGmailSub: 'Your natal profile and active deck stay saved to this account',
    gmailPickLabel: 'Select',
    gmailGuestSub: 'Guest test account',
    btnCancel: 'Cancel',
    btnClose: 'Close',
    btnCardReturn: 'Return Card to Table',

    modalNatalTitle: 'Initial 10-Card Natal Record',
    natalSummaryFmt: (user, elemName, natalCount, dayI18n) =>
      `${dayI18n?.day || user.dayName} (${dayI18n?.elem || elemName}) | Life Path ${user.lifePath} | Birth Card: ${user.birthCard}`,
    natalCardItemFmt: (idx, pos, label) => `Card ${idx + 1} (${pos}): ${label}`,

    modalGalleryTitle: 'All 78 Low-Poly 3D Tarot Cards',
    modalGallerySub: 'Tap any card to inspect its artwork and grounded meaning',
    filterAll: 'All (78)',
    filterMajor: 'Major (22)',
    filterWands: 'Wands',
    filterCups: 'Cups',
    filterSwords: 'Swords',
    filterPentacles: 'Pentacles',
    galleryOriginTag: '78-Card Gallery',

    modalHistoryTitle: 'Conversation Log with Sati',
    modalShopTitle: 'Energy Coins & Sanctuary Passes',
    shopBuyCoinsTitle: 'Top Up 19 Energy Coins',
    shopBuyCoinsSub: 'Use for deep follow-up questions or 1–3 card draws',
    shopBuyCoinsPrice: '99 THB',
    shopBuyPassTitle: 'Full 78-Card Deck Pass',
    shopBuyPassSub: 'Unlimited draws & follow-up chats until this 78-card deck runs out',
    shopBuyPassPrice: '299 THB',
    shopBuyVipTitle: 'Sati VIP Monthly (30 Days)',
    shopBuyVipSub: 'Unlimited draws, chats & fresh 78-card deck reshuffles for 30 days',
    shopBuyVipPrice: '999 THB',
    shopQrHeader: 'Scan PromptPay QR to Complete Payment',
    shopQrAmountFmt: (amt) => `Amount Due: ${amt}.00 THB`,
    btnConfirmPayment: 'Confirm Payment Completed',
    btnBackToTiers: '← Choose Another Package',
    shopNotice: 'Simulated PromptPay QR checkout — click confirm to activate immediately',

    activeCardLabel: (idx) => `Card ${idx + 1}`,
    pickOrderPos: (count, pos) => (pos ? `Card ${count}: ${pos}` : `Card ${count}`),
    cardModalMeaning: (d) => `${d.core}\n\n• Work: ${d.work}\n• Money: ${d.money}\n• Love: ${d.love}\n• Advice: ${d.advice}`,

    shufflingDialogue: (nick) => `Shuffling all 78 cards for you, ${nick}... give me a second.`,
    loadingNatalDialogue: (fullname) => `Connecting ${fullname}'s birth profile with your 10 natal cards...`,
    loadingCardsDialogue: (nick) => `Looking closely at the cards ${nick} just pulled...`,
    loadingQuestionDialogue: (nick) => `Reading ${nick}'s question alongside the active cards on the table...`,
    fallbackExpandQ: (lastQ) => `Please expand further on: "${lastQ}"`,
    fallbackDefaultQ: 'Read what these new cards show about the current situation.',
    drawFollowUpActionLabel: (count) => `Drew ${count} follow-up card${count > 1 ? 's' : ''}`,
    pickFollowUpPrompt: (count) => `Pick ${count} follow-up card${count > 1 ? 's' : ''}`,
    waitPickFollowUpDialogue: (count) => `Go ahead and pick ${count} card${count > 1 ? 's' : ''} from the same deck — I will connect them for you right away.`,
    pickInitialPrompt: 'Pick your first 10 natal cards',

    welcomeFirstDialogue: (nick) =>
      `Good to see you, ${nick}. I'm Sati. Let's start by pulling 10 cards so I can tie your name and birth date into the spread and map out your past to present clearly. (You can switch the 1P/2P camera view at top right too.)`,
    welcomeBackDialogue: (nick, rem) =>
      `Welcome back, ${nick}. Your previous deck is still right here on the table (${rem} cards left). Ask anything or draw more cards whenever you're ready.`,
    reshuffledDialogue: (nick) =>
      `All 78 cards are freshly shuffled, ${nick}. No need to redo the 10 natal cards this time — just ask a question or draw 1 / 3 cards whenever you want.`,
    crystalDialogue: (nick) =>
      `The light inside the crystal orb responds clearly to your focus, ${nick || 'my friend'}. If something is still on your mind, ask directly or draw another card.`,

    toastNoCoins: 'Not enough coins — top up coins or unlock a pass to continue.',
    toastLowDeck: 'Too few cards left in the deck — reshuffle all 78 cards to continue.',
    toastCrystal: 'Crystal orb energy answered your focus.',
    toastAddCoins: 'Added 19 Coins — ready to continue your reading.',
    toastUnlockPass: 'Full 78-Card Deck Pass activated.',
    toastUnlockVip: 'Sati VIP Monthly Pass (30 Days) activated.',

    satiPaywallDialogue: (nick, cost) =>
      `Your energy coins are running low, ${nick || 'friend'} (this step needs ${cost} coin${cost > 1 ? 's' : ''}). We're right at the heart of the reading — top up 19 coins (99 THB) or unlock the 78-Card Deck Pass (299 THB) so we can trace the next card clearly.`,
    satiThankYouPurchase: (nick, label) =>
      `Thank you, ${nick || 'friend'}. "${label}" is now active — tell me what you'd like to dig into next or pull more cards right away.`,

    smartPromptsByTopic: {
      work: [
        { label: '⚡ 3-Month Career Shift', question: 'What key career shift awaits in the next 3 months, and what move should I make?', drawCount: 0 },
        { label: '🧭 Stay or Pivot Path?', question: 'Should I double down on this current project/job or start pivoting to something new?', drawCount: 0 },
        { label: '🔮 Draw 3 Cards: Career Path (3 Coins)', question: 'Pull 3 cards to reveal my career trajectory, hidden opportunity, and main risk ahead.', drawCount: 3 }
      ],
      money: [
        { label: '💰 Hidden Money Leak', question: 'Where is the blind spot or financial leak the cards warn me to plug right now?', drawCount: 0 },
        { label: '📈 Best Income Channel', question: 'Which channel or strategy brings the clearest cash-flow breakthrough next?', drawCount: 0 },
        { label: '🔮 Draw 3 Cards: Money Flow (3 Coins)', question: 'Pull 3 cards to examine upcoming income, cash traps, and the smartest financial move.', drawCount: 3 }
      ],
      love: [
        { label: '❤️ What They Truly Feel', question: 'How does the other person genuinely feel about me beneath the surface right now?', drawCount: 0 },
        { label: '⏳ Lean In or Step Back?', question: 'In this connection, should I open up and move closer or step back for clarity?', drawCount: 0 },
        { label: '🔮 Draw 3 Cards: Relationship Path (3 Coins)', question: 'Pull 3 cards to unpack real feelings, the unspoken block, and where this bond is heading.', drawCount: 3 }
      ],
      self: [
        { label: '🎯 First Concrete Step Now', question: 'Based on these cards, what is the single most impactful action I must take this week?', drawCount: 0 },
        { label: '⚠️ Inner Block Holding Me Back', question: 'What subtle fear or old habit is quietly holding me back right now?', drawCount: 0 },
        { label: '🔮 Draw 3 Cards: Inner Reset (3 Coins)', question: 'Pull 3 cards to clarify my blind spot, strongest leverage, and practical next move.', drawCount: 3 }
      ],
      general: [
        { label: '🔎 Most Urgent Warning', question: 'Across all cards on the table, what is the single most urgent priority I should handle now?', drawCount: 0 },
        { label: '🚀 Best Focus This Week', question: 'If I can focus on just one decisive move this week, what gives the highest payoff?', drawCount: 0 },
        { label: '🔮 Draw 3 Cards: Deep Situation (3 Coins)', question: 'Pull 3 cards to inspect what happens next, unseen resistance, and the best approach.', drawCount: 3 }
      ]
    },

    btnCardBreakdownOpen: 'View card links & reasoning',
    btnCardBreakdownClose: 'Hide card breakdown',
    breakdownPart1Title: '1. All Cards in This Reading (Click any card to zoom)',
    breakdownCitedTag: 'Key pillar',
    breakdownPart2Title: '2. How These Cards Connect to Your Question',
    breakdownPart3Title: '3. Why Each Card Speaks This Way',
    breakdownOtherNatalToggle: (n) => `Inspect the other ${n} cards in this 10-card spread`,
    breakdownLabelCore: 'Core meaning:',
    breakdownLabelWhy: 'Why it applies here:',
    breakdownLabelAdvice: 'Practical cue:',

    btnFeedbackOpen: '★ Feedback',
    modalFeedbackTitle: 'Share Feedback to Improve Sati',
    feedbackSub: 'Your thoughts help us refine Sati’s readings and experience',
    feedbackTabForm: 'Write Feedback',
    feedbackTabList: 'All Feedback',
    feedbackRatingLabel: 'Overall Accuracy & Experience',
    feedbackTags: ['Spot-On Reading', 'Natural Human Tone', 'Smooth 3D Table', 'Easy to Use', 'Needs Polish'],
    feedbackCommentPlaceholder: 'Tell us what resonated with you or what we should improve next...',
    btnSubmitFeedback: 'Submit Feedback',
    btnExportFeedbackCsv: 'Download CSV',
    toastFeedbackSaved: 'Thank you! Your feedback has been saved.',
    feedbackNeedInputToast: 'Please select a tag or write a short note before submitting.',
    feedbackStatsFmt: (count, avg) => `${count} Reviews • Avg Rating ★ ${avg} / 5.0`,
    feedbackEmpty: 'No feedback entries yet.'
  },

  zh: {
    pageTitle: 'SATI — 思谛塔罗牌阵',
    loginSubtitle: '与占卜师思谛（Sati）面对面——坦诚、亲切而真诚的对话空间，为你的当下带来清醒视角，让每一秒都活得更有分量。',
    gmailLoginBtn: '进入思谛占卜室',
    loginPrivacyNote: '你的姓名与出生日期仅用于将本命命盘与塔罗牌阵建立关联。',

    ledgerEyebrow: '本命星盘登记册',
    ledgerDeviceBadge: '本机独立存档',
    ledgerTitle: '抽牌前请先落名登记',
    btnResumeDeck: '继续上一次尚未用完的牌组',
    resumeDeckInfo: (nick, rem, coins) => `检测到 ${nick} 的存档牌组（剩余 ${rem}/78 张 | 金币 ${coins}）`,
    labelNickname: '常用昵称（思谛在对话中将这样称呼你）',
    placeholderNickname: '例如：阿博 / Bom',
    labelFullname: '真实姓名（用于生辰八字与姓名能量推演）',
    placeholderFullname: '例如：陈思远',
    labelBirthdate: '出生年月日（公历）',
    btnSubmitLedger: '盖印启盘占卜',
    months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    formatYear: (beYear) => `${beYear - 543} 年`,

    cleanPickBadge: '直接在牌桌上点击选牌即可',
    btnRestoreUi: '显示菜单',
    hudDeckLabel: '牌库',
    btnDeckGallery: '78 张牌图鉴',
    btnNatalDrawer: '本命十张牌',
    hudCoinsCount: (c) => `${c} 枚金币`,
    hudCoinsUnlimited: '不限次',
    hudPassBadge: '全副通行证',
    hudVipBadge: '月度 VIP',
    cam1P: '视角：第一人称',
    cam2P: '视角：对坐牌桌',
    btnHideUi: '全屏看牌桌',
    titleGallery: '78 张塔罗牌图鉴',
    titleNatal: '查看最初 10 张本命牌',
    titleCamToggle: '切换第一人称 / 对坐视角',
    titleMute: '开启或静音',
    titleHideUi: '隐藏按钮以清晰观看牌桌',

    satiSpeaker: '思谛',
    userSpeakerFallback: '你',
    moodIdle: '牌桌待命',
    moodChat: '坦诚对话',
    moodGreeting: '初见问候',
    moodResume: '继续占卜',
    moodDeckReady: '新牌组就绪',
    moodCrystal: '水晶球共鸣',
    moodNatal10: '十张本命牌阵',
    moodReply: '直指核心',
    moodDeep: '深度解析',
    moodWaitPick: '等待抽牌',
    moodShuffle: '洗牌中',
    moodLoadingNatal: '推演本命盘',
    moodLoadingCards: '解读牌面',
    moodLoadingThink: '细看牌意',

    dialoguePreview: '请在桌上的扇形牌阵中点击选牌...',
    btnChatHistory: '对话记录',
    btnCollapseBox: '收起',
    btnExpandBox: '展开对话',
    dialogueInitial: '正在整理牌组...',

    btnHideDock: '隐藏操作栏',
    btnShowDock: '显示操作栏',
    pickInstructionDefault: '请在牌桌扇形牌堆中选择塔罗牌',
    pickInstructionFmt: (label, cur, target) => `${label}（${cur} / ${target}）`,
    pickSubtext: '直接点击桌上扇形牌即可抽取，或点击右上角全屏看牌桌',
    btnAutoPick: '一键抽齐余下牌',
    btnDraw1: '加抽 1 张',
    btnDraw1Cost: '（1 金币）',
    btnDraw3: '加抽 3 张',
    btnDraw3Cost: '（3 金币）',
    btnDraw1Ad: '观看短片',
    btnDraw1AdFree: '免费抽 1 张',
    btnDraw10Opt: '十张大牌阵',
    btnDraw10Cost: '（8 金币）',
    btnReshuffle: '重新洗满 78 张',
    chatPlaceholder: '直接向思谛提问...',
    btnChatSubmit: '提问',
    btnChatSubmitFree: (n) => `提问（免费 ${n} 次）`,
    btnChatSubmitCoin: '提问（1 金币）',

    modalGmailTitle: '选择 Gmail 账号登录',
    modalGmailSub: '你的本命信息与当前牌组将保存在此账号下',
    gmailPickLabel: '选择',
    gmailGuestSub: '访客体验账号',
    btnCancel: '取消',
    btnClose: '关闭',
    btnCardReturn: '放回牌桌',

    modalNatalTitle: '初始十张本命牌记录',
    natalSummaryFmt: (user, elemName, natalCount, dayI18n) =>
      `${dayI18n?.day || user.dayName}（${dayI18n?.elem || elemName}）| 生命灵数 ${user.lifePath} | 本命守护牌：${user.birthCard}`,
    natalCardItemFmt: (idx, pos, label) => `第 ${idx + 1} 张（${pos}）：${label}`,

    modalGalleryTitle: '3D 立体低多边形 78 张塔罗全图鉴',
    modalGallerySub: '点击任意卡牌查看细节画面与实用提醒',
    filterAll: '全部 (78)',
    filterMajor: '大阿卡纳 (22)',
    filterWands: '权杖',
    filterCups: '圣杯',
    filterSwords: '宝剑',
    filterPentacles: '星币',
    galleryOriginTag: '78 张牌图鉴',

    modalHistoryTitle: '与思谛的完整对话记录',
    modalShopTitle: '能量金币与专属通行证',
    shopBuyCoinsTitle: '补充 19 枚能量金币',
    shopBuyCoinsSub: '可用于深度追问或随时加抽 1-3 张牌',
    shopBuyCoinsPrice: '99 泰铢',
    shopBuyPassTitle: '78 张全副牌通行证',
    shopBuyPassSub: '当前 78 张牌用完前无限次抽牌与追问',
    shopBuyPassPrice: '299 泰铢',
    shopBuyVipTitle: '思谛 VIP 月卡（30 天）',
    shopBuyVipSub: '30 天内无限次洗牌、抽牌与深度追问',
    shopBuyVipPrice: '999 泰铢',
    shopQrHeader: '扫描 PromptPay 二维码完成支付',
    shopQrAmountFmt: (amt) => `应付金额：${amt}.00 泰铢`,
    btnConfirmPayment: '确认已完成支付',
    btnBackToTiers: '← 返回重选套餐',
    shopNotice: 'PromptPay 模拟扫码支付（点击确认即可立即生效）',

    activeCardLabel: (idx) => `第 ${idx + 1} 张牌`,
    pickOrderPos: (count, pos) => (pos ? `第 ${count} 张：${pos}` : `第 ${count} 张`),
    cardModalMeaning: (d) => `${d.core}\n\n• 事业：${d.work}\n• 财运：${d.money}\n• 感情：${d.love}\n• 提醒：${d.advice}`,

    shufflingDialogue: (nick) => `正在为 ${nick} 洗匀整副 78 张牌，请稍候...`,
    loadingNatalDialogue: (fullname) => `正在将 ${fullname} 的生辰命格与十张本命牌对应起来...`,
    loadingCardsDialogue: (nick) => `正在细看 ${nick} 刚才抽出的牌面...`,
    loadingQuestionDialogue: (nick) => `正在结合桌面牌阵思考 ${nick} 的问题...`,
    fallbackExpandQ: (lastQ) => `请针对我刚才的问题继续深入讲讲：“${lastQ}”`,
    fallbackDefaultQ: '结合新抽出的这组牌看看当下局面。',
    drawFollowUpActionLabel: (count) => `加抽了 ${count} 张牌`,
    pickFollowUpPrompt: (count) => `再抽 ${count} 张牌深入看`,
    waitPickFollowUpDialogue: (count) => `从剩下这副牌里再挑 ${count} 张吧，抽好我立刻帮你连起来解读。`,
    pickInitialPrompt: '抽取最初 10 张本命牌',

    welcomeFirstDialogue: (nick) =>
      `你好，${nick}，我是思谛。我们先抽 10 张牌，把你的名字、生辰和当下处境连起来看一遍，从过去到现在一次看清。（右上角也可以自由切换第一人称和对坐视角。）`,
    welcomeBackDialogue: (nick, rem) =>
      `欢迎回来，${nick}。上次这副牌还摆在桌上（还剩 ${rem} 张），想继续问哪件事或加抽几张都可以直接告诉我。`,
    reshuffledDialogue: (nick) =>
      `78 张新牌已经洗好了，${nick}。这一轮不用重开十张本命牌，直接提问或点击加抽 1 张 / 3 张就能接着聊。`,
    crystalDialogue: (nick) =>
      `水晶球里的微光正呼应着 ${nick || '你'} 当下的专注。如果心里还有拿不准的事，直接问我或加抽一张看看。`,

    toastNoCoins: '金币不足——请补充金币或解锁通行证继续占卜。',
    toastLowDeck: '牌库剩余张数不足，点击重洗 78 张即可继续。',
    toastCrystal: '水晶球回应了你的专注。',
    toastAddCoins: '已补充 19 枚金币，可继续占卜。',
    toastUnlockPass: '已激活 78 张全副通行证。',
    toastUnlockVip: '已激活思谛 VIP 月卡（30 天）。',

    satiPaywallDialogue: (nick, cost) =>
      `${nick || '朋友'}，能量金币已经不够这一步了（需要 ${cost} 枚金币）。我们正好推演到关键节点，点击上方补充 19 枚金币（99 泰铢）或解锁全副通行证（299 泰铢），思谛马上继续为你看透全局。`,
    satiThankYouPurchase: (nick, label) =>
      `谢谢 ${nick || '你'}，「${label}」已经生效——想继续深挖哪个问题，或加抽几张牌，现在直接开始吧！`,

    smartPromptsByTopic: {
      work: [
        { label: '⚡ 未来 3 个月事业转折', question: '未来 3 个月我的事业会迎来什么关键转折，现在该如何抉择？', drawCount: 0 },
        { label: '🧭 坚持现职还是换赛道？', question: '目前的工作或项目应该继续深耕，还是准备转向新赛道更划算？', drawCount: 0 },
        { label: '🔮 加抽 3 张：深挖事业走向（3 金币）', question: '再抽 3 张牌深挖事业前景、隐藏机会以及必须避开的坑。', drawCount: 3 }
      ],
      money: [
        { label: '💰 看不见的财务漏洞', question: '牌面上有没有提醒我必须立刻堵住的漏财点或资金风险？', drawCount: 0 },
        { label: '📈 近期最清晰的进账突破', question: '接下来哪条路最有机会帮我明显提升现金流与收入？', drawCount: 0 },
        { label: '🔮 加抽 3 张：财运与机遇（3 金币）', question: '再抽 3 张牌看清接下来财运走势、进账契机与财务禁忌。', drawCount: 3 }
      ],
      love: [
        { label: '❤️ 对方心底真实想法', question: '对方现在心底对我的真实感受和顾虑究竟是什么？', drawCount: 0 },
        { label: '⏳ 主动推进还是先观望？', question: '这段关系我该主动跨前一步，还是先退后看清局势再决定？', drawCount: 0 },
        { label: '🔮 加抽 3 张：感情心结与结局（3 金币）', question: '再抽 3 张牌深挖双方真实心意、卡住的结以及感情走向。', drawCount: 3 }
      ],
      self: [
        { label: '🎯 本周最该立刻做的事', question: '结合桌上的牌，这周我最应该立刻落地改变的一件事是什么？', drawCount: 0 },
        { label: '⚠️ 暗中拖住我的心态', question: '现在有什么习惯或担忧正在悄悄拖慢我的行动与状态？', drawCount: 0 },
        { label: '🔮 加抽 3 张：破局与行动指南（3 金币）', question: '再抽 3 张牌看清当前盲点、最大优势与实际破局方法。', drawCount: 3 }
      ],
      general: [
        { label: '🔎 牌阵里最紧迫的提醒', question: '结合全部牌面来看，眼下最紧急、最需要优先处理的问题是什么？', drawCount: 0 },
        { label: '🚀 本周最值得专注的一步', question: '如果本周只集中精力做一件事来扭转局面，最该选哪一步？', drawCount: 0 },
        { label: '🔮 加抽 3 张：深度局势拆解（3 金币）', question: '再抽 3 张牌深度推演后续走向、暗藏阻力与最佳应对。', drawCount: 3 }
      ]
    },

    btnCardBreakdownOpen: '查看牌面联动与解读依据',
    btnCardBreakdownClose: '收起牌面详情',
    breakdownPart1Title: '1. 本轮全部牌面（点击单张放大查看）',
    breakdownCitedTag: '总结重点',
    breakdownPart2Title: '2. 牌与牌之间如何呼应你的问题',
    breakdownPart3Title: '3. 每张牌为何如此对应',
    breakdownOtherNatalToggle: (n) => `查看十张牌阵中其余 ${n} 张牌详情`,
    breakdownLabelCore: '核心牌义：',
    breakdownLabelWhy: '为何应此问：',
    breakdownLabelAdvice: '行动提示：',

    btnFeedbackOpen: '★ 评价反馈',
    modalFeedbackTitle: '提交反馈协助优化思谛',
    feedbackSub: '你的建议将帮助我们持续优化解读与体验',
    feedbackTabForm: '填写反馈',
    feedbackTabList: '查看全部反馈',
    feedbackRatingLabel: '整体准度与体验评分',
    feedbackTags: ['直击重点超准', '说话自然像真人', '3D 牌桌流畅好看', '操作简单易懂', '希望继续优化'],
    feedbackCommentPlaceholder: '欢迎分享你觉得准的地方，或希望我们下一步改进的细节...',
    btnSubmitFeedback: '提交反馈',
    btnExportFeedbackCsv: '下载 CSV',
    toastFeedbackSaved: '感谢反馈！你的建议已成功保存。',
    feedbackNeedInputToast: '请至少选择一个标签或填写几句反馈后再提交。',
    feedbackStatsFmt: (count, avg) => `共 ${count} 条反馈 • 平均评分 ★ ${avg} / 5.0`,
    feedbackEmpty: '暂无反馈记录。'
  }
};

export function getTextPack(lang = 'th') {
  return UI_TEXT[normalizeLang(lang)] || UI_TEXT.th;
}

export function t(lang, key, ...args) {
  const pack = getTextPack(lang);
  const val = pack[key] ?? UI_TEXT.th[key];
  if (typeof val === 'function') return val(...args);
  return val ?? '';
}
