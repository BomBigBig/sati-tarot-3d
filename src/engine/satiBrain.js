/**
 * Sati Astrological (Thai Thaksa 8-Planet + Birthdate) & Deep Tarot Synthesis Engine
 * ผสานการเรียก Gemini Backend Proxy (`/api/sati/read`) เข้ากับสมองสังเคราะห์ทักษาและหน้าไพ่จริง Offline Fallback อัตโนมัติ
 */
import { MAJOR_ARCANA, buildFullDeck78, hydrateDeckCards } from '../data/tarot78.js';
import {
  normalizeLang,
  THAKSA_DAY_I18N,
  THAKSA_ROLE_I18N,
  getLocalizedCardData,
  getLocalizedCardLabelInline,
  getLocalizedCardShortName,
  getLocalizedCelticPositions,
  formatCardOrientationTag,
  formatCardOrientationBadge,
  getReversedEnergyNuance
} from '../data/tarot78I18n.js';

export const THAKSA_GROUPS = [
  { name: 'อาทิตย์', chars: 'ออะาิีึืุูเแโใไ', elem: 'ไฟ', trait: 'กล้านำ กล้าตัดสินใจ รักศักดิ์ศรี แต่บางจังหวะกดดันตัวเองหนักเกินจำเป็น' },
  { name: 'จันทร์', chars: 'กขคฆง', elem: 'ดิน', trait: 'ใส่ใจรายละเอียด อ่อนโยน และอ่านใจคนเก่ง แต่เวลาเลือกเพื่อตัวเองมักเกรงใจคนอื่นมากไป' },
  { name: 'อังคาร', chars: 'จฉชซฌญ', elem: 'ลม', trait: 'คิดไวทำไว กล้าลุย ไม่ชอบรอนาน แต่ต้องระวังใจร้อนหรือพูดตรงจนคนฟังตั้งตัวไม่ทัน' },
  { name: 'พุธ', chars: 'ฎฏฐฑฒณ', elem: 'น้ำ', trait: 'หัวไว ปรับตัวและวิเคราะห์รอบด้านได้ดี แต่บางครั้งคิดซ้อนหลายชั้นจนเหนื่อยเอง' },
  { name: 'พฤหัสบดี', chars: 'บปผฝพฟภม', elem: 'ดิน', trait: 'มีหลักการ วางแผนเป็นระบบและพึ่งพาได้ แต่มักรับภาระคนอื่นมาแบกไว้เอง' },
  { name: 'ศุกร์', chars: 'ศษสหฬฮ', elem: 'น้ำ', trait: 'มีเสน่ห์ รสนิยมดีและจริงใจ แต่เวลามีเรื่องค้างใจจะเก็บไปคิดวนอยู่นาน' },
  { name: 'เสาร์', chars: 'ดตถทธน', elem: 'ไฟ', trait: 'อึด อดทน จริงจังกับเป้าหมายระยะยาว ไม่ยอมแพ้ง่ายๆ แต่ชอบเก็บความเครียดไว้คนเดียว' },
  { name: 'ราหู', chars: 'ยรลว', elem: 'ลม', trait: 'ไหวพริบดี พลิกแพลงเก่ง ไม่ชอบกรอบจำเจ แต่ต้องระวังเบื่อง่ายเวลาเรื่องเดินช้า' }
];

const THAKSA_RING = [0, 1, 2, 3, 6, 4, 7, 5]; // อาทิตย์ -> จันทร์ -> อังคาร -> พุธ -> เสาร์ -> พฤหัส -> ราหู -> ศุกร์
const THAKSA_ROLES = [
  { key: 'บริวาร', desc: 'การจัดการคนและทีมรอบตัว' },
  { key: 'อายุ', desc: 'พลังกายและจังหวะชีวิต' },
  { key: 'เดช', desc: 'อำนาจการตัดสินใจและความน่าเชื่อถือ' },
  { key: 'ศรี', desc: 'เสน่ห์ โอกาส และจังหวะเปิดทาง' },
  { key: 'มูละ', desc: 'ฐานการเงินและทรัพย์สินจับต้องได้' },
  { key: 'อุตสาหะ', desc: 'ความขยันและแรงลุยสร้างผลงาน' },
  { key: 'มนตรี', desc: 'ผู้ใหญ่และแรงหนุนจากคนรอบข้าง' },
  { key: 'กาลกิณี', desc: 'จุดที่ต้องระวังและใจเย็นเป็นพิเศษ' }
];

export const CELTIC_POSITIONS = [
  'สถานการณ์เจ้าชะตาปัจจุบัน',
  'อุปสรรคหรือโจทย์ที่กำลังเผชิญหน้า',
  'รากฐานจิตใต้สำนึกและเป้าหมายลึกๆ',
  'อดีตที่เพิ่งผ่านพ้นและส่งผลถึงตอนนี้',
  'สิ่งที่ปรากฏให้เห็นหรือเป้าหมายตรงหน้า',
  'แนวโน้มที่จะเข้ามาในอนาคตอันใกล้',
  'ท่าทีและวิธีรับมือของตัวเราเอง',
  'อิทธิพลจากคนรอบข้างและสภาพแวดล้อม',
  'ความหวังหรือความกังวลที่ซ่อนอยู่ในใจ',
  'บทสรุปภาพรวมและจุดเปลี่ยนสำคัญ'
];

export function computeNatalProfile(user) {
  const gYear = user.year - 543;
  const dt = new Date(gYear, user.month - 1, user.day);
  const dow = isNaN(dt.getTime()) ? ((user.day + user.month) % 7) : dt.getDay();
  const dayGroup = THAKSA_GROUPS[dow];

  const startIdx = THAKSA_RING.indexOf(dow);
  const fullStr = `${user.fullname || ''}${user.nickname || ''}`;
  const matchedPositive = [];
  const roleMatches = {};
  let kalakiniChars = [];

  THAKSA_ROLES.forEach((role, offset) => {
    const grp = THAKSA_GROUPS[THAKSA_RING[(startIdx + offset) % 8]];
    const foundChars = [...new Set([...fullStr].filter((ch) => grp.chars.includes(ch)))];
    if (foundChars.length > 0) {
      roleMatches[role.key] = foundChars;
      if (role.key === 'กาลกิณี') {
        kalakiniChars = foundChars;
      } else {
        matchedPositive.push(`${role.key} (${role.desc})`);
      }
    }
  });

  const topStrengths = matchedPositive.length >= 2
    ? `${matchedPositive[0]} และ ${matchedPositive[1]}`
    : matchedPositive[0] || 'อุตสาหะ (แรงลุยสร้างด้วยลำแข้ง) และ เดช (การตัดสินใจเด็ดขาด)';

  const sumDigits = (n) => String(n).split('').reduce((a, b) => a + (parseInt(b, 10) || 0), 0);
  let lp = sumDigits(user.day) + sumDigits(user.month) + sumDigits(gYear);
  while (lp > 9) lp = sumDigits(lp);

  const birthIdx = (user.day + user.month + (gYear % 100)) % 22;
  const birthCard = MAJOR_ARCANA[birthIdx];

  user.dayName = `วัน${dayGroup.name}`;
  user.elemShort = dayGroup.elem;
  user.element = `ธาตุ${dayGroup.elem} (${dayGroup.trait})`;
  user.thaksaStrength = topStrengths;
  user.thaksaDetails = {
    roles: roleMatches,
    kalakiniChars,
    hasKalakini: kalakiniChars.length > 0
  };
  user.lifePath = lp;
  user.birthCard = `${birthCard.en} (${birthCard.th})`;
  user.birthCardCore = birthCard.core;
  Object.assign(user, computeExtendedNatalContext(user));
  return user;
}

const WESTERN_ZODIAC_LIST = [
  { key: 'capricorn', th: 'ราศีมังกร', en: 'Capricorn', zh: '摩羯座', elem: 'ดิน' },
  { key: 'aquarius', th: 'ราศีกุมภ์', en: 'Aquarius', zh: '水瓶座', elem: 'ลม' },
  { key: 'pisces', th: 'ราศีมีน', en: 'Pisces', zh: '双鱼座', elem: 'น้ำ' },
  { key: 'aries', th: 'ราศีเมษ', en: 'Aries', zh: '白羊座', elem: 'ไฟ' },
  { key: 'taurus', th: 'ราศีพฤษภ', en: 'Taurus', zh: '金牛座', elem: 'ดิน' },
  { key: 'gemini', th: 'ราศีเมถุน', en: 'Gemini', zh: '双子座', elem: 'ลม' },
  { key: 'cancer', th: 'ราศีกรกฎ', en: 'Cancer', zh: '巨蟹座', elem: 'น้ำ' },
  { key: 'leo', th: 'ราศีสิงห์', en: 'Leo', zh: '狮子座', elem: 'ไฟ' },
  { key: 'virgo', th: 'ราศีกันย์', en: 'Virgo', zh: '处女座', elem: 'ดิน' },
  { key: 'libra', th: 'ราศีตุลย์', en: 'Libra', zh: '天秤座', elem: 'ลม' },
  { key: 'scorpio', th: 'ราศีพิจิก', en: 'Scorpio', zh: '天蝎座', elem: 'น้ำ' },
  { key: 'sagittarius', th: 'ราศีธนู', en: 'Sagittarius', zh: '射手座', elem: 'ไฟ' }
];

const CHINESE_ZODIAC_LIST = [
  { key: 'monkey', th: 'ปีวอก (ลิง)', en: 'Monkey', zh: '猴年' },
  { key: 'rooster', th: 'ปีระกา (ไก่)', en: 'Rooster', zh: '鸡年' },
  { key: 'dog', th: 'ปีจอ (หมา)', en: 'Dog', zh: '狗年' },
  { key: 'pig', th: 'ปีกุน (หมู)', en: 'Pig', zh: '猪年' },
  { key: 'rat', th: 'ปีชวด (หนู)', en: 'Rat', zh: '鼠年' },
  { key: 'ox', th: 'ปีฉลู (วัว)', en: 'Ox', zh: '牛年' },
  { key: 'tiger', th: 'ปีขาล (เสือ)', en: 'Tiger', zh: '虎年' },
  { key: 'rabbit', th: 'ปีเถาะ (กระต่าย)', en: 'Rabbit', zh: '兔年' },
  { key: 'dragon', th: 'ปีมะโรง (งูใหญ่)', en: 'Dragon', zh: '龙年' },
  { key: 'snake', th: 'ปีมะเส็ง (งูเล็ก)', en: 'Snake', zh: '蛇年' },
  { key: 'horse', th: 'ปีมะเมีย (ม้า)', en: 'Horse', zh: '马年' },
  { key: 'goat', th: 'ปีมะแม (แพะ)', en: 'Goat', zh: '羊年' }
];

const LIFE_STAGE_META = {
  student_young: { th: 'วัยเรียน / เริ่มต้นก้าวแรกของชีวิต', en: 'Student / Early adulthood', zh: '求学与起步期' },
  early_career: { th: 'วัยเริ่มทำงาน / ค้นหาและสร้างตัว', en: 'Early career / Foundation building', zh: '职场探索与打拼期' },
  building_prime: { th: 'วัยสร้างฐานะ / ขยับขยายความรับผิดชอบ', en: 'Prime building / Expansion phase', zh: '成家立业与上升期' },
  midlife_steady: { th: 'วัยกลางคน / วางความมั่นคงระยะยาว', en: 'Midlife / Long-term consolidation', zh: '稳健与责任整合期' },
  senior_wisdom: { th: 'วัยผู้ใหญ่เต็มตัว / ตกผลึกประสบการณ์', en: 'Mature / Wisdom & stewardship', zh: '阅历沉淀与传承期' }
};

export function computeExtendedNatalContext(user = {}) {
  const day = parseInt(user?.day, 10);
  const month = parseInt(user?.month, 10);
  const rawYear = parseInt(user?.year, 10);
  if (!day || !month || !rawYear || month < 1 || month > 12 || day < 1 || day > 31) {
    return { age: null, lifeStage: '', lifeStageLabel: null, zodiacSign: null, chineseZodiac: null };
  }
  const gYear = rawYear > 2400 ? rawYear - 543 : rawYear;
  const now = new Date();
  let age = now.getFullYear() - gYear;
  const curMonth = now.getMonth() + 1;
  const curDay = now.getDate();
  if (curMonth < month || (curMonth === month && curDay < day)) {
    age -= 1;
  }
  if (age < 0 || age > 120) age = null;

  let lifeStage = '';
  if (typeof age === 'number') {
    if (age < 23) lifeStage = 'student_young';
    else if (age < 30) lifeStage = 'early_career';
    else if (age < 40) lifeStage = 'building_prime';
    else if (age < 55) lifeStage = 'midlife_steady';
    else lifeStage = 'senior_wisdom';
  }

  let zIdx = 0;
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) zIdx = 1;
  else if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) zIdx = 2;
  else if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) zIdx = 3;
  else if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) zIdx = 4;
  else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) zIdx = 5;
  else if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) zIdx = 6;
  else if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) zIdx = 7;
  else if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) zIdx = 8;
  else if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) zIdx = 9;
  else if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) zIdx = 10;
  else if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) zIdx = 11;

  const czYear = (month === 1 || (month === 2 && day < 5)) ? gYear - 1 : gYear;
  const czIdx = ((czYear % 12) + 12) % 12;

  return {
    age,
    lifeStage,
    lifeStageLabel: lifeStage ? LIFE_STAGE_META[lifeStage] : null,
    zodiacSign: WESTERN_ZODIAC_LIST[zIdx],
    chineseZodiac: CHINESE_ZODIAC_LIST[czIdx]
  };
}

export function extractUserContextFacts(chatHistory = [], prevFacts = []) {
  const factMap = new Map();
  const addFact = (slot, value) => {
    if (value) factMap.set(slot, value);
  };
  (Array.isArray(prevFacts) ? prevFacts : []).forEach((item, idx) => {
    const clean = String(item || '').trim();
    if (!clean) return;
    const colonIdx = clean.indexOf(':');
    const slot = colonIdx > 0 ? clean.slice(0, colonIdx).trim() : `extra_${idx}`;
    addFact(slot, clean);
  });

  const rows = (Array.isArray(chatHistory) ? chatHistory : []).filter(
    (h) => h && (h.role === 'user' || (!h.role && !['สติ', 'Sati', '思谛'].includes(h.speaker))) && !h.isDrawAction && !h.isExpandAction
  );

  rows.forEach((h) => {
    const text = String(h.text || '').replace(/\s+/g, ' ').trim();
    if (!text) return;

    if (/เพิ่งเลิก|เลิกกับแฟน|อกหัก|just broke up|刚分手/i.test(text)) {
      addFact('สถานะความสัมพันธ์', 'สถานะความสัมพันธ์: เพิ่งผ่านช่วงเลิกรา/กำลังฮีลใจ');
    } else if (/โสดอยู่|ยังโสด|เป็นโสด|คนโสด|i.?m single|单身/i.test(text)) {
      addFact('สถานะความสัมพันธ์', 'สถานะความสัมพันธ์: โสด');
    } else if (/มีคนคุย|กำลังคุยกับ|แอบชอบ|situationship|talking stage|暧昧|暗恋/i.test(text)) {
      addFact('สถานะความสัมพันธ์', 'สถานะความสัมพันธ์: มีคนคุย/กำลังดูใจ');
    } else if (/แต่งงานแล้ว|สามี|ภรรยา|มีแฟนแล้ว|คบกับแฟน|อยู่ด้วยกัน|married|my partner|my wife|my husband|结婚|另一半/i.test(text)) {
      addFact('สถานะความสัมพันธ์', 'สถานะความสัมพันธ์: มีคู่/กำลังคบหา');
    }

    if (/เรียนอยู่|นักศึกษา|นักเรียน|มหาลัย|เตรียมสอบ|ทำวิทยานิพนธ์|ป\.ตรี|ป\.โท|university student|grad school|备考|学生/i.test(text)) {
      addFact('บทบาทหลัก', 'บทบาทหลัก: กำลังเรียน/เตรียมสอบ');
    } else if (/เจ้าของกิจการ|ธุรกิจส่วนตัว|เปิดร้าน|ขายของออนไลน์|ค้าขาย|ทำแบรนด์|startup|business owner|self-employed|创业|开店|自己做生意/i.test(text)) {
      addFact('บทบาทหลัก', 'บทบาทหลัก: เจ้าของธุรกิจ/ค้าขายส่วนตัว');
    } else if (/ฟรีแลนซ์|รับงานนอก|อาชีพอิสระ|freelance|contractor|自由职业/i.test(text)) {
      addFact('บทบาทหลัก', 'บทบาทหลัก: ฟรีแลนซ์/อาชีพอิสระ');
    } else if (/ว่างงาน|ตกงาน|กำลังหางาน|เพิ่งลาออก|unemployed|job hunting|待业|找工作/i.test(text)) {
      addFact('บทบาทหลัก', 'บทบาทหลัก: กำลังหางาน/เปลี่ยนผ่านอาชีพ');
    } else if (/พนักงานประจำ|ออฟฟิศ|บริษัท|ข้าราชการ|มนุษย์เงินเดือน|office worker|employee|上班族|打工/i.test(text)) {
      addFact('บทบาทหลัก', 'บทบาทหลัก: ทำงานประจำ/องค์กร');
    }

    if (/ปลดหนี้|มีหนี้|ผ่อนหนี้|หมุนเงิน|debt|pay off loan|负债|还债/i.test(text)) {
      addFact('การเงินสำคัญ', 'การเงินสำคัญ: มีภาระหนี้/ต้องจัดการสภาพคล่อง');
    } else if (/ซื้อบ้าน|ซื้อคอนโด|ซื้อรถ|ย้ายหอ|ย้ายบ้าน|ออมเงินเก็บ|buy a house|mortgage|买房/i.test(text)) {
      addFact('เป้าหมายทรัพย์สิน', 'เป้าหมายทรัพย์สิน: วางแผนเรื่องบ้าน/ที่อยู่/ทรัพย์สินใหญ่');
    }

    if (text.length >= 16 && text.length <= 76 && /(อยาก|ตั้งใจ|กำลังจะ|วางแผน|เครียดเรื่อง|plan to|trying to|准备|打算)/.test(text)) {
      addFact('เป้าหมายล่าสุด', `เป้าหมายล่าสุด: "${text}"`);
    }
  });

  return [...factMap.values()].slice(-8);
}

function getCardMeaningForTopic(card, topic, lang = 'th', subDomain = '') {
  if (!card) return '';
  const data = getLocalizedCardData(card, lang);
  if (subDomain === 'study') return data.work || data.core || '';
  if (subDomain === 'property') return data.money || data.work || data.core || '';
  if (subDomain === 'health' || subDomain === 'family') return data.advice || data.core || '';
  if (topic === 'work' && data.work) return data.work;
  if (topic === 'money' && data.money) return data.money;
  if (topic === 'love' && data.love) return data.love;
  return data.core || '';
}

function resolveLocalizedBirthCard(user, lang) {
  const maj = MAJOR_ARCANA.find((m) => (user.birthCard || '').startsWith(m.en));
  if (!maj) return user.birthCard || '';
  return getLocalizedCardLabelInline({ uid: `M_${maj.id}`, name: maj.en, th: maj.th }, lang);
}

const stripEnEnd = (s) => (s || '').replace(/\.$/, '').trim();
const stripZhEnd = (s) => (s || '').replace(/[。！？]$/, '').trim();

export function buildNatal10Reading(state, rawCards) {
  const lang = normalizeLang(state.lang);
  const cards = hydrateDeckCards(rawCards);
  const nick = state.user.nickname || (lang === 'en' ? 'my friend' : lang === 'zh' ? '朋友' : 'เพื่อน');
  const cPresent = cards[0];
  const cObstacle = cards[1];
  const cGoal = cards[4];
  const cNear = cards[5];
  const cOutcome = cards[9];

  const hasKal = state.user.thaksaDetails?.hasKalakini;
  const dayI18n = THAKSA_DAY_I18N[state.user.dayName]?.[lang];
  const kalChars = (state.user.thaksaDetails?.kalakiniChars || []).join(',');
  const outcomeTone = scoreCardPolarity(cOutcome);

  const revCards = cards.filter((c) => Boolean(c?.reversed));
  const revTitle = (c, d, lng) => {
    const b = formatCardOrientationBadge(c, lng);
    return b ? `${d.title} ${b}` : d.title;
  };

  if (lang === 'en') {
    const dayText = dayI18n?.day || state.user.dayName;
    const elemText = dayI18n?.elem || state.user.elemShort || 'Balanced';
    const traitText = dayI18n?.trait || 'thoughtful and action-oriented';
    const roleKeys = Object.keys(state.user.thaksaDetails?.roles || {}).filter((k) => k !== 'กาลกิณี').slice(0, 2);
    const resolvedKeys = roleKeys.length ? roleKeys : ['อุตสาหะ', 'เดช'];
    const topRoles = resolvedKeys.map((k) => THAKSA_ROLE_I18N[k]?.en || k).join(' and ');
    const kalShort = hasKal ? ` Also watch your tone when worn out, as ${kalChars} touches a sensitive spot in your chart.` : '';

    const p1 = `Good to sit with you, ${nick}. Born on ${dayText} (${elemText}) with ${resolveLocalizedBirthCard(state.user, 'en')}, you’re naturally ${traitText}, with real strength in ${topRoles}.${kalShort}`;

    const dPres = getLocalizedCardData(cPresent, 'en');
    const dObs = getLocalizedCardData(cObstacle, 'en');
    const dGoal = getLocalizedCardData(cGoal, 'en');
    const dNear = getLocalizedCardData(cNear, 'en');
    const dOut = getLocalizedCardData(cOutcome, 'en');

    const revNoteEn = revCards.length > 0
      ? ` ${revCards.length} reversed card${revCards.length > 1 ? 's' : ''} here signal internalized or delayed energy waiting for deliberate alignment.`
      : '';
    const p2 = `Across the 10 cards you pulled, things right now sit on ${revTitle(cPresent, dPres, 'en')} — ${dPres.core} Meanwhile, ${revTitle(cObstacle, dObs, 'en')} shows the friction crossing your path: ${dObs.core} For work, ${revTitle(cGoal, dGoal, 'en')} highlights: ${dGoal.work} On money, ${revTitle(cNear, dNear, 'en')} adds: ${dNear.money}${revNoteEn}`;

    const advice = dOut.advice || dObs.advice || dGoal.advice;
    const outcomeLine = outcomeTone === 'caution'
      ? `Don’t force the pace blindly right now, ${nick}`
      : outcomeTone === 'favorable'
        ? `Momentum is genuinely opening up for you, ${nick}`
        : `How this lands comes down to steady balance, ${nick}`;
    const p3 = `All of this lands at ${revTitle(cOutcome, dOut, 'en')} — ${dOut.core} ${outcomeLine} — ${advice}`;

    return `${p1}\n\n${p2}\n\n${p3}`;
  }

  if (lang === 'zh') {
    const dayText = dayI18n?.day || state.user.dayName;
    const elemText = dayI18n?.elem || state.user.elemShort || '调和';
    const traitText = dayI18n?.trait || '心思清晰、重在实干';
    const roleKeys = Object.keys(state.user.thaksaDetails?.roles || {}).filter((k) => k !== 'กาลกิณี').slice(0, 2);
    const resolvedKeys = roleKeys.length ? roleKeys : ['อุตสาหะ', 'เดช'];
    const topRoles = resolvedKeys.map((k) => THAKSA_ROLE_I18N[k]?.zh || k).join('和');
    const kalShort = hasKal ? `另外名字里带着 ${kalChars}，累或心烦时记得多留意语气。` : '';

    const p1 = `${nick}你好，把你的${dayText}（${elemText}）和本命牌 ${resolveLocalizedBirthCard(state.user, 'zh')} 连起来看，你天生${traitText}，突出优势在${topRoles}。${kalShort}`;

    const dPres = getLocalizedCardData(cPresent, 'zh');
    const dObs = getLocalizedCardData(cObstacle, 'zh');
    const dGoal = getLocalizedCardData(cGoal, 'zh');
    const dNear = getLocalizedCardData(cNear, 'zh');
    const dOut = getLocalizedCardData(cOutcome, 'zh');

    const revNoteZh = revCards.length > 0
      ? ` 牌阵中有 ${revCards.length} 张逆位牌，表示部分能量暂时内收或放缓，需要先把内在顾虑理顺。`
      : '';
    const p2 = `从你选出的这 10 张牌来看，当下主轴落在 ${revTitle(cPresent, dPres, 'zh')}，${dPres.core} 眼前的关键阻力或变量在于 ${revTitle(cObstacle, dObs, 'zh')}，${dObs.core} 事业上 ${revTitle(cGoal, dGoal, 'zh')} 显示${dGoal.work} 财运上 ${revTitle(cNear, dNear, 'zh')} 则提醒${dNear.money}${revNoteZh}`;

    const advice = dOut.advice || dObs.advice || dGoal.advice;
    const outcomeLine = outcomeTone === 'caution'
      ? `现阶段先别急着硬冲，${nick}`
      : outcomeTone === 'favorable'
        ? `眼下顺势已经打开，${nick}`
        : `这段走势关键看你如何拿捏分寸，${nick}`;
    const p3 = `整体走向收在 ${revTitle(cOutcome, dOut, 'zh')}，${dOut.core} ${outcomeLine}——${advice}`;

    return `${p1}\n\n${p2}\n\n${p3}`;
  }

  const dayObj = THAKSA_GROUPS.find((g) => `วัน${g.name}` === state.user.dayName);
  const elemShort = state.user.elemShort || dayObj?.elem || 'พื้นฐาน';
  const kalShort = hasKal
    ? ` อีกจุดที่อยากทักเบาๆ คือในชื่อมีอักษร ${kalChars} เวลาเหนื่อยหรือกดดันให้ระวังคำพูดกับอารมณ์ตัวเองหน่อยนะ`
    : '';
  const topRoles = (state.user.thaksaStrength || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+และ\s+/g, 'กับ');
  const shortTrait = dayObj?.trait || 'คิดจริงทำจริง';

  const p1 = `สวัสดี${nick} พอผูกพื้นดวง${state.user.dayName} (ธาตุ${elemShort}) เข้ากับไพ่ประจำตัว ${state.user.birthCard} แล้ว ภาพของ${nick}ชัดเลยว่าเป็นคน${shortTrait} และมีจุดแข็งเด่นเรื่อง${topRoles}${kalShort}`;

  const thLbl = (c) => getLocalizedCardLabelInline(c, 'th');
  const workVerb = scoreCardPolarity(cGoal) === 'caution' ? 'เตือนตรงๆ ว่า' : 'ชี้ว่า';
  const moneyVerb = scoreCardPolarity(cNear) === 'caution' ? 'ที่ต้องระวังตรงที่' : 'ซึ่ง';
  const revNoteTh = revCards.length > 0
    ? ` โดยมีไพ่กลับหัว ${revCards.length} ใบที่สะท้อนพลังงานที่ยังชะลอหรือติดค้างจากภายใน รอให้จัดจังหวะใหม่`
    : '';
  const p2 = `จากไพ่ 10 ใบที่${nick}เลือกขึ้นมา ตอนนี้เรื่องหลักอยู่ที่ ${thLbl(cPresent)} คือ${cPresent.core} โดยมีโจทย์ตรงหน้าผ่าน ${thLbl(cObstacle)} ตรงที่${cObstacle.core} ส่วนเรื่องงานมี ${thLbl(cGoal)} ${workVerb}${getCardMeaningForTopic(cGoal, 'work')} ขณะที่เรื่องเงินมากับ ${thLbl(cNear)} ${moneyVerb}${getCardMeaningForTopic(cNear, 'money')}${revNoteTh}`;

  const advice = cOutcome.advice || cObstacle.advice || cGoal.advice;
  const p3 = outcomeTone === 'caution'
    ? `ภาพรวมปลายทางไปจบที่ ${thLbl(cOutcome)} ที่เตือนให้ระวังว่า${cOutcome.core} จังหวะนี้${nick}อย่าเพิ่งรีบฝืนดันนะ — ${advice}`
    : outcomeTone === 'favorable'
      ? `ภาพรวมปลายทางเปิดรับสวยที่ ${thLbl(cOutcome)} ชี้ว่า${cOutcome.core} ทิศทางรอบนี้เป็นใจให้ค่อยๆ ไปต่อได้เลย — ${advice}`
      : `ภาพรวมปลายทางมาตกที่ ${thLbl(cOutcome)} ซึ่งสะท้อนว่า${cOutcome.core} จุดชี้ขาดรอบนี้อยู่ที่การปรับสมดุลให้พอดี — ${advice}`;

  return `${p1}\n\n${p2}\n\n${p3}`;
}

export function analyzeCardElementalSynergy(cards, lang = 'th') {
  if (cards.length < 2) return '';
  const target = normalizeLang(lang);
  const suits = cards.map((c) => c.suit);
  const count = (s) => suits.filter((x) => x === s).length;
  const warnCount = cards.filter((c) => scoreCardPolarity(c) === 'caution').length;

  if (target === 'en') {
    if (count('Major') >= 2) return 'Multiple Major Arcana show this chapter carries lasting weight, not just a passing mood.';
    if (count('Wands') >= 2) return 'Strong Wands fire gives you drive, just guard against rushing ahead of details.';
    if (count('Swords') >= 2) return 'Multiple Swords show the real tangle sits in overthinking and conversations needing plain clarity.';
    if (count('Pentacles') >= 2) return 'Strong Pentacles mean results here come down to real numbers, steady execution, and discipline.';
    if (count('Cups') >= 2) return 'Cups lead the spread — feelings and human dynamics outweigh what looks neat on paper.';
    if (suits.includes('Wands') && suits.includes('Pentacles')) {
      return warnCount >= 2
        ? 'Drive (Wands) is rubbing against cash or resource limits (Pentacles) — pushing harder the same way drains energy.'
        : 'Fire (Wands) meets Earth (Pentacles): ideas you actually execute now can turn into real income.';
    }
    if (suits.includes('Swords') && suits.includes('Cups')) return 'Head (Swords) and heart (Cups) are pulling in opposite directions, keeping you hesitant.';
    return '';
  }

  if (target === 'zh') {
    if (count('Major') >= 2) return '连续出现多张大阿卡纳，说明这件事带有阶段转折分量，不只是一时小插曲。';
    if (count('Wands') >= 2) return '权杖火元素偏旺，行动力十足，但要防止心急求快而漏掉关键步骤。';
    if (count('Swords') >= 2) return '宝剑牌偏多，眼下的症结多半在思虑过重，以及需要把话摊开讲清楚。';
    if (count('Pentacles') >= 2) return '星币连排，这件事最终拼的是真金白银、扎实交付与日常自律，没有捷径。';
    if (count('Cups') >= 2) return '圣杯占主导，当事人之间的感受与默契比纸面道理更有决定性。';
    if (suits.includes('Wands') && suits.includes('Pentacles')) {
      return warnCount >= 2
        ? '想冲的劲头（权杖）正撞上资金或人手约束（星币），老方法硬推会很吃力。'
        : '权杖火行动力遇上星币实操土气，这轮想到的事认真做下来很机会变成实实在在的收入。';
    }
    if (suits.includes('Swords') && suits.includes('Cups')) return '脑子想一套（宝剑）、心里感受却是另一套（圣杯），所以一时还拿不定主意。';
    return '';
  }

  if (count('Major') >= 2) return 'ไพ่ใหญ่ขึ้นมาติดกันแบบนี้ แปลว่าเรื่องนี้ส่งผลยาวระดับเปลี่ยนจังหวะชีวิต ไม่ใช่เรื่องผ่านๆ';
  if (count('Wands') >= 2) return 'ธาตุไฟจากไพ่ไม้เท้าหนุนกันชัด ไฟลุยเต็มร้อยแต่ระวังใจร้อนอยากเห็นผลเร็วเกินเหตุ';
  if (count('Swords') >= 2) return 'ไพ่ดาบขึ้นมาหลายใบ บอกชัดว่าปัญหาตอนนี้อยู่ที่ความคิดเยอะและการสื่อสารที่ต้องคุยกันให้เคลียร์';
  if (count('Pentacles') >= 2) return 'ไพ่เหรียญเรียงกันแน่น เรื่องนี้วัดกันที่เงินจริง ผลงานจริง และวินัยล้วนๆ ไม่มีทางลัด';
  if (count('Cups') >= 2) return 'ไพ่ถ้วยนำหน้าชัด ความรู้สึกและใจของคนเกี่ยวข้องมีน้ำหนักกว่าเหตุผลบนกระดาษ';
  if (suits.includes('Wands') && suits.includes('Pentacles')) {
    return warnCount >= 2
      ? 'พลังลุย (ไม้เท้า) กำลังชนกับข้อจำกัดเรื่องฐานเงิน/กำลังคน (เหรียญ) ทำแบบเดิมจะเหนื่อยแต่ไม่คุ้มแรง'
      : 'ไฟจากไม้เท้ามาเจอดินจากเหรียญ แปลว่าสิ่งที่คิดและลงมือทำรอบนี้แปลงเป็นเงินจริงได้';
  }
  if (suits.includes('Swords') && suits.includes('Cups')) return 'ไพ่ดาบชนกับไพ่ถ้วยพอดี หัวคิดอย่างหนึ่งแต่ใจรู้สึกอีกทาง เลยยังลังเลไม่จบ';
  return '';
}

export function computeElementalDignityInsight(cards = [], lang = 'th') {
  const target = normalizeLang(lang);
  const list = hydrateDeckCards(cards);
  if (!list.length) return '';

  const counts = { Major: 0, Wands: 0, Cups: 0, Swords: 0, Pentacles: 0 };
  let early = 0;
  let mid = 0;
  let late = 0;
  let courts = 0;

  list.forEach((c) => {
    counts[c.suit] = (counts[c.suit] || 0) + 1;
    const first = (c.name || '').split(' ')[0];
    if (['Ace', 'Two', 'Three'].includes(first)) early += 1;
    else if (['Four', 'Five', 'Six'].includes(first)) mid += 1;
    else if (['Seven', 'Eight', 'Nine', 'Ten'].includes(first)) late += 1;
    else if (['Page', 'Knight', 'Queen', 'King'].includes(first)) courts += 1;
  });

  const hasFire = counts.Wands > 0;
  const hasAir = counts.Swords > 0;
  const hasWater = counts.Cups > 0;
  const hasEarth = counts.Pentacles > 0;

  let pairLine = '';
  let cycleLine = '';

  if (target === 'en') {
    if (hasFire && hasAir && !hasWater && !hasEarth) {
      pairLine = 'Elemental Dignity (Fire + Air Active Support): sharp clarity feeds bold speed, though impatience can gloss over fine details.';
    } else if (hasWater && hasEarth && !hasFire && !hasAir) {
      pairLine = 'Elemental Dignity (Water + Earth Grounded Support): steady emotional commitment builds into real, lasting material stability.';
    } else if (hasFire && hasWater) {
      pairLine = 'Elemental Dignity (Fire vs Water Friction): outer urgency and quiet inner hesitation are pulling against each other until feelings settle.';
    } else if (hasAir && hasEarth) {
      pairLine = 'Elemental Dignity (Air vs Earth Friction): over-analyzing scenarios collides with practical constraints — verify hard numbers directly.';
    } else if (counts.Major >= 2) {
      pairLine = `Elemental Dignity (${counts.Major} Major Arcana Anchor): weighty turning-point cards signal choices now carry longer-term karma and direction.`;
    } else {
      pairLine = 'Elemental Dignity (Balanced Temperament): contrasting elements show outcomes bend directly with the deliberate pacing you choose next.';
    }
    if (courts >= 2) cycleLine = 'Strong Court card presence shows real people or decisive personal stance steer this chapter.';
    else if (late > early && late >= 1) cycleLine = 'High numbered ranks (7–10) mark a culmination phase where finishing loose ends unlocks the next cycle.';
    else if (early > late && early >= 1) cycleLine = 'Early ranks (Ace–3) point to a fresh opening stage where framing clean boundaries early pays off most.';
    return [pairLine, cycleLine].filter(Boolean).join(' ');
  }

  if (target === 'zh') {
    if (hasFire && hasAir && !hasWater && !hasEarth) {
      pairLine = '元素生克（火风相生）：思路与行动力同频加速，但要防着求快而漏掉落地细节。';
    } else if (hasWater && hasEarth && !hasFire && !hasAir) {
      pairLine = '元素生克（水土相融）：沉稳的心念正一点点沉淀成真实可感的安全感与收益。';
    } else if (hasFire && hasWater) {
      pairLine = '元素生克（火水相冲）：心里既想冲又放不下顾虑，先理顺内在感受再定节奏才不会内耗。';
    } else if (hasAir && hasEarth) {
      pairLine = '元素生克（风土相制）：想得太细易撞上现实条件限制，直接核对实际数字比空想有效。';
    } else if (counts.Major >= 2) {
      pairLine = `元素生克（${counts.Major} 张大阿卡纳压阵）：大牌密度高，代表眼下抉择带有长线转折分量。`;
    } else {
      pairLine = '元素生克（格局均衡）：牌组能量彼此牵制平衡，最终走向看你接下来如何稳住执行。';
    }
    if (courts >= 2) cycleLine = '宫廷牌偏多，关键变量落在具体当事人态度与你自身的处事姿态。';
    else if (late > early && late >= 1) cycleLine = '高数字牌（7–10）占比偏重，说明此事已走到收官或清理旧结的阶段。';
    else if (early > late && early >= 1) cycleLine = '初阶牌（1–3）起势，重点在于尽早立下清晰规则与起点框架。';
    return [pairLine, cycleLine].filter(Boolean).join(' ');
  }

  if (hasFire && hasAir && !hasWater && !hasEarth) {
    pairLine = 'กำลังธาตุไพ่ (ไฟ+ลมเสริมแรงเต็มที่): ความคิดชัดบวกแรงลุยทำให้ขยับไว แต่ต้องเช็กรายละเอียดไม่ให้ใจร้อนเกินจังหวะ';
  } else if (hasWater && hasEarth && !hasFire && !hasAir) {
    pairLine = 'กำลังธาตุไพ่ (น้ำ+ดินหนุนมั่นคง): ความจริงใจและความสม่ำเสมอกำลังปั้นผลลัพธ์เป็นชิ้นเป็นอันจับต้องได้';
  } else if (hasFire && hasWater) {
    pairLine = 'กำลังธาตุไพ่ (ไฟปะทะน้ำ): แรงอยากเดินหน้ากับความรู้สึกค้างใจกำลังดึงกันอยู่ ต้องเคลียร์ใจให้นิ่งก่อนลงมือ';
  } else if (hasAir && hasEarth) {
    pairLine = 'กำลังธาตุไพ่ (ลมปะทะดิน): ความคิดหลายตลบกำลังชนกับข้อจำกัดหรือตัวเลขจริง ให้ยึดหลักฐานตรงหน้ามากกว่าคาดเดา';
  } else if (counts.Major >= 2) {
    pairLine = `กำลังธาตุไพ่ (ไพ่ใหญ่ ${counts.Major} ใบคุมเกม): จังหวะนี้เป็นจุดเปลี่ยนระดับวางทิศทางระยะยาว ไม่ใช่เรื่องชั่วคราว`;
  } else {
    pairLine = 'กำลังธาตุไพ่ (ธาตุสมดุล): พลังในหน้าไพ่ไม่เทไปทางสุดโต่ง ผลลัพธ์ขึ้นกับวินัยและการวางหมากของเราโดยตรง';
  }
  if (courts >= 2) cycleLine = 'มีไพ่บุคคล (Court Cards) เด่นชัด ชี้ว่าตัวแปรสำคัญอยู่ที่ท่าทีของคนจริงหรือบทบาทที่เราต้องคุมเอง';
  else if (late > early && late >= 1) cycleLine = 'เลขไพ่ช่วงปลาย (7–10) เด่น สะท้อนว่าเรื่องนี้อยู่ในช่วงสะสางปิดจบรอบเพื่อขึ้นรอบใหม่';
  else if (early > late && early >= 1) cycleLine = 'เลขไพ่ช่วงต้น (1–3) เด่น บอกว่าเพิ่งเปิดประตูเริ่มต้น เหมาะกับการวางกรอบตั้งแต่ก้าวแรก';
  return [pairLine, cycleLine].filter(Boolean).join(' ');
}

const SUIT_META_PATTERN = {
  Wands: { th: 'ไฟ/ไม้เท้า', en: 'Fire/Wands', zh: '火/权杖', missTh: 'เติมไฟลงมือ', missEn: 'add decisive action', missZh: '补足行动力' },
  Cups: { th: 'น้ำ/ถ้วย', en: 'Water/Cups', zh: '水/圣杯', missTh: 'ฟังใจและคนรอบข้าง', missEn: 'tend feelings & bonds', missZh: '顾及感受与连接' },
  Swords: { th: 'ลม/ดาบ', en: 'Air/Swords', zh: '风/宝剑', missTh: 'เช็กเหตุผลและคุยตรง', missEn: 'verify facts clearly', missZh: '核对逻辑与沟通' },
  Pentacles: { th: 'ดิน/เหรียญ', en: 'Earth/Pentacles', zh: '土/星币', missTh: 'วางแผนและตัวเลขจริง', missEn: 'ground in real numbers', missZh: '落实计划与数字' }
};

const RANK_SHORT = {
  Ace: 'Ace', Two: '2', Three: '3', Four: '4', Five: '5',
  Six: '6', Seven: '7', Eight: '8', Nine: '9', Ten: '10',
  Page: 'Page', Knight: 'Knight', Queen: 'Queen', King: 'King'
};

/**
 * Compute compact spread-level synthesis (Major density >=50%, repeated ranks, dominant/missing suits, reversed ratio).
 */
export function analyzeSpreadPatterns(cards, lang = 'th') {
  const target = normalizeLang(lang);
  const list = hydrateDeckCards(Array.isArray(cards) ? cards : []).filter(Boolean);
  if (list.length < 2) return '';

  const total = list.length;
  const majorCount = list.filter((c) => c.suit === 'Major').length;
  const revCount = list.filter((c) => Boolean(c.reversed)).length;
  const suitCounts = { Wands: 0, Cups: 0, Swords: 0, Pentacles: 0 };
  const rankCounts = new Map();

  list.forEach((c) => {
    if (c.suit && Object.prototype.hasOwnProperty.call(suitCounts, c.suit)) {
      suitCounts[c.suit] += 1;
      const rawRank = String(c.name || '').split(' ')[0];
      if (RANK_SHORT[rawRank]) {
        rankCounts.set(rawRank, (rankCounts.get(rawRank) || 0) + 1);
      }
    }
  });

  const parts = [];

  if (majorCount / total >= 0.5) {
    if (target === 'en') parts.push(`Major Arcana ${majorCount}/${total} (pivotal turning point)`);
    else if (target === 'zh') parts.push(`大阿卡纳 ${majorCount}/${total}（关键转折定调）`);
    else parts.push(`ไพ่ใหญ่ ${majorCount}/${total} ใบ (จุดเปลี่ยนสำคัญคุมเกม)`);
  }

  const repeated = [...rankCounts.entries()].filter(([, cnt]) => cnt >= 2).slice(0, 2);
  if (repeated.length > 0) {
    const repLabel = repeated.map(([rk, cnt]) => `${RANK_SHORT[rk]}×${cnt}`).join(', ');
    if (target === 'en') parts.push(`Repeated rank ${repLabel}`);
    else if (target === 'zh') parts.push(`重复牌阶 ${repLabel}`);
    else parts.push(`เลข/หน้าไพ่ซ้ำ ${repLabel}`);
  }

  const suitEntries = Object.entries(suitCounts);
  const sortedSuits = [...suitEntries].sort((a, b) => b[1] - a[1]);
  const [topSuit, topCnt] = sortedSuits[0];
  const missingSuits = suitEntries.filter(([, cnt]) => cnt === 0).map(([k]) => k);

  if (topCnt >= 2) {
    const domName = SUIT_META_PATTERN[topSuit][target];
    if (total >= 3 && missingSuits.length > 0) {
      const primaryMiss = missingSuits.includes('Pentacles') ? 'Pentacles' : missingSuits[0];
      const missNames = missingSuits.slice(0, 2).map((s) => SUIT_META_PATTERN[s][target]).join('/');
      const missAdvice = SUIT_META_PATTERN[primaryMiss][target === 'en' ? 'missEn' : target === 'zh' ? 'missZh' : 'missTh'];
      if (target === 'en') parts.push(`Dominant ${domName}; missing ${missNames} (${missAdvice})`);
      else if (target === 'zh') parts.push(`主导${domName}，缺${missNames}（宜${missAdvice}）`);
      else parts.push(`เด่น${domName} · ขาด${missNames} (${missAdvice})`);
    } else {
      if (target === 'en') parts.push(`Dominant ${domName} (${topCnt}/${total})`);
      else if (target === 'zh') parts.push(`主导${domName}（${topCnt}/${total}）`);
      else parts.push(`เด่น${domName} (${topCnt}/${total})`);
    }
  } else if (total >= 3 && missingSuits.length > 0 && missingSuits.length <= 2) {
    const primaryMiss = missingSuits[0];
    const missNames = missingSuits.map((s) => SUIT_META_PATTERN[s][target]).join('/');
    const missAdvice = SUIT_META_PATTERN[primaryMiss][target === 'en' ? 'missEn' : target === 'zh' ? 'missZh' : 'missTh'];
    if (target === 'en') parts.push(`Missing ${missNames} (${missAdvice})`);
    else if (target === 'zh') parts.push(`缺${missNames}（宜${missAdvice}）`);
    else parts.push(`ขาด${missNames} (${missAdvice})`);
  }

  if (revCount > 0) {
    const heavyRev = revCount / total >= 0.5;
    if (target === 'en') {
      parts.push(`Reversed ${revCount}/${total} (${heavyRev ? 'blocked/inward energy — clear friction first' : 'localized delay'})`);
    } else if (target === 'zh') {
      parts.push(`逆位 ${revCount}/${total}（${heavyRev ? '内在阻滞较多，先理顺卡点' : '局部放缓需内省'}）`);
    } else {
      parts.push(`กลับหัว ${revCount}/${total} (${heavyRev ? 'พลังติดขัดภายในเยอะ ค่อยๆ คลายก่อนเร่ง' : 'มีจุดชะลอเฉพาะจุด'})`);
    }
  }

  if (parts.length === 0) return '';
  let out = '';
  for (const p of parts) {
    const next = out ? `${out} · ${p}` : p;
    if (next.length <= 280) out = next;
    else break;
  }
  return out || `${parts[0].slice(0, 277)}...`;
}

function cleanChoiceOption(s, isFirst, lang = 'th') {
  if (lang === 'en') {
    return (s || '').replace(/^(should i|choose between|between|is it better to)\s*/i, '').replace(/[?]+$/, '').trim() || (s || '').trim();
  }
  if (lang === 'zh') {
    return (s || '').replace(/^(是|应该|选|要不要)\s*/g, '').replace(/[？?]+$/, '').trim() || (s || '').trim();
  }
  return (s || '')
    .replace(isFirst ? /^(แล้ว|ถ้า|ควร|จะ|เลือก|ระหว่าง|อยากรู้ว่า)\s*/g : /^(ควร|จะ|ค่อย)\s*/g, '')
    .replace(/(ตอนนี้เลย|ดีไหม|ไหม|มั้ย|ดีกว่า|ก่อนดี|ก่อน|มากกว่า|กันแน่|ครับ|ค่ะ|คับ|นะ)+$/g, '')
    .replace(/\s*(ดี|ไหม)$/g, '')
    .trim() || (s || '').trim();
}

function isBadBinaryPredicate(opt) {
  const s = String(opt || '').trim();
  if (!s || s.length < 3) return true;
  if (/^(?:จะ|แค่)?(?:รุ่ง|พัง|เสี่ยง|ดี|ร้าย|ได้|ผ่าน|รอด|คุ้ม|เสีย|มาก|น้อย|ใช่|ไม่|จริง|เล่น|คุยแก้เหงา|จริงจังแค่ไหน|ดีลใหญ่เข้ามา|เดือนหน้าจะมีรายได้พิเศษ)$/i.test(s)) {
    return true;
  }
  return false;
}

export function extractGenuineBinaryChoices(q, lang = 'th') {
  const text = String(q || '').trim();
  if (!text) return null;
  if (lang === 'en') {
    const m = text.match(/(.+?)\s+or\s+(.+?)(\?|$)/i);
    if (!m || !m[1] || !m[2] || /\s+or\s+/i.test(m[2])) return null;
    const optA = cleanChoiceOption(m[1], true, 'en');
    const optB = cleanChoiceOption(m[2], false, 'en');
    if (isBadBinaryPredicate(optA) || isBadBinaryPredicate(optB)) return null;
    return [optA, optB];
  }
  if (lang === 'zh') {
    const m = text.match(/(.+?)\s*还是\s*(.+?)([？?]|$)/);
    if (!m || !m[1] || !m[2] || /还是/.test(m[2])) return null;
    const optA = cleanChoiceOption(m[1], true, 'zh');
    const optB = cleanChoiceOption(m[2], false, 'zh');
    if (isBadBinaryPredicate(optA) || isBadBinaryPredicate(optB)) return null;
    return [optA, optB];
  }
  // Reject 3+ item comma/space lists and non-choice outcome/priority predicates in Thai
  if ((text.match(/หรือ/g) || []).length > 1) return null;
  if (/,/.test(text.split('หรือ')[0] || '')) return null;
  if (/(?:โฟกัส|เน้น|เริ่มจาก|ลำดับ).{2,30}ก่อน/.test(text)) return null;
  const m = text.match(/(.+?)\s*หรือ\s*(?!เปล่า|ป่าว|ปล่าว|ไม่|ยัง)(.+?)(\?|$)/);
  if (!m || !m[1] || !m[2]) return null;
  const optA = cleanChoiceOption(m[1], true, 'th');
  const optB = cleanChoiceOption(m[2], false, 'th');
  if (isBadBinaryPredicate(optA) || isBadBinaryPredicate(optB)) return null;
  const tailClauseA = optA.split(/ควร|โฟกัส|เน้น|เลือก|วางแผน/).pop()?.trim() || '';
  if (/^\S{2,10}\s+\S{2,10}$/.test(tailClauseA)) return null;
  // Require decision framing markers around the Thai options
  const looksActionChoice = /ควร|เลือก|ระหว่าง|ย้าย|ลาออก|รอ|อยู่|ไป|ทำ|เปลี่ยน|คุย|คบ|ถอย|ซื้อ|ถือ|ขาย|should|launch|wait/i.test(text);
  if (!looksActionChoice) return null;
  return [optA, optB];
}

export function detectTopicAndIntent(q, prevTopic) {
  const rawQ = String(q || '').trim();
  const isEllipticalFollowUp = rawQ.length > 0 && rawQ.length < 28 && /^(แล้ว|ส่วน|ต่อ|ขยาย|เรื่องนั้น|เรื่องเขา|แล้วถ้า|and what|what about|then|那|还有)/i.test(rawQ);
  let topic = isEllipticalFollowUp && prevTopic ? prevTopic : 'general';

  if (/ความรัก|แฟน|คนคุย|จีบ|นอกใจ|ง้อ|เลิกกัน|ขอคืนดี|คบกัน|แต่งงาน|มีใจ|คิดถึง|รักเรา|จริงใจ|จริงจัง|เนื้อคู่|คู่รัก|โสด|อกหัก|แอบชอบ|เขารู้สึก|เขาคิด|เธอรู|เค้าคิด|เค้ายัง|เขายัง|มีคนอื่น|love|romance|relationship|partner|crush|dating|marriage|feelings|his heart|her heart|ex\b|感情|爱情|恋爱|对象|另一半|暗恋|前任|分手|复合|喜欢我|在乎|婚姻/i.test(rawQ)) {
    topic = 'love';
  } else if (/งาน|โปรเจกต์|เจ้านาย|หัวหน้า|ลูกน้อง|ทีม|ลูกค้า|ธุรกิจ|บริษัท|ออฟฟิศ|เรียน|สอบ|สมัครงาน|สัมภาษณ์|ลาออก|ย้ายงาน|เปลี่ยนงาน|เลื่อนขั้น|ทำแอป|ออกแบบ|เขียนโค้ด|รับเหมา|อาชีพ|work|job|career|project|boss|manager|team|client|business|company|office|study|exam|interview|resign|quit|promotion|startup|coding|工作|事业|项目|老板|上司|团队|客户|生意|公司|办公室|学习|考试|面试|辞职|跳槽|转行|升职|创业/i.test(rawQ)) {
    topic = 'work';
  } else if (/การเงิน|เงิน|รายได้|รายรับ|รายจ่าย|ลงทุน|หนี้|ค้าขาย|ขายของ|ยอดขาย|ขายได้|ขายดี|กำไร|ต้นทุน|เงินทุน|ขาดทุน|ค่าใช้จ่าย|ร่ำรวย|จะรวย|ซื้อ|ผ่อน|เทรด|ทองคำ|ราคาทอง|เล่นหุ้น|หุ้น|เหรียญ|โบนัส|เงินเดือน|ช็อต|ตึงมือ|สภาพคล่อง|ออมเงิน|ดีล|money|income|salary|revenue|expense|invest|debt|sales|profit|cost|capital|loss|wealth|rich|trade|gold|stock|crypto|bonus|cash|finance|budget|钱|财运|收入|工资|支出|花销|投资|负债|债务|销量|利润|成本|本金|亏损|发财|暴富|贷款|交易|黄金|股票|资金/i.test(rawQ)) {
    topic = 'money';
  } else if (/รัก|เขา|เธอ/.test(rawQ)) {
    topic = 'love';
  } else if (/ครอบครัว|พ่อแม่|พี่น้อง|ญาติ|สุขภาพ|เหนื่อย|ท้อ|เครียด|พักผ่อน|นอนไม่หลับ|หมดไฟ|สับสน|กดดัน|ตัวเอง|ชีวิต|ความฝัน|เป้าหมาย|health|family|tired|stressed|rest|insomnia|burnout|confused|pressure|myself|life\b|dream|goal|健康|家庭|累|疲惫|焦虑|压力|休息|失眠|迷茫|内耗|人生|梦想|目标/i.test(rawQ)) {
    topic = 'self';
  }

  let subDomain = topic;
  if (/ซื้อบ้าน|เช่าบ้าน|คอนโด|ที่ดิน|ย้ายบ้าน|ย้ายหอ|ซื้อรถ|ออกรถ|ต่อเติม|ขายบ้าน|ขายที่|อสังหา|house|condo|apartment|land|move out|relocate|buy a car|property|real estate|买房|租房|公寓|土地|搬家|买车|房产/i.test(rawQ)) {
    subDomain = 'property';
  } else if (/เรียน|สอบ|อ่านหนังสือ|เกรด|มหาลัย|คณะ|จบการศึกษา|วิทยานิพนธ์|ทุน|สมัครเรียน|วิชา|study|exam|grade|university|major|thesis|scholarship|学习|考试|大学|专业|成绩|留学/i.test(rawQ)) {
    subDomain = 'study';
  } else if (/สุขภาพ|ป่วย|โรค|หมอ|โรงพยาบาล|ผ่าตัด|รักษา|หายดีไหม|นอนไม่หลับ|ออฟฟิศซินโดรม|แพนิก|ซึมเศร้า|พักผ่อน|ร่างกาย|health|sick|illness|doctor|hospital|surgery|recover|insomnia|anxiety|mental health|健康|生病|医生|医院|手术|恢复|失眠|焦虑/i.test(rawQ)) {
    subDomain = 'health';
  } else if (/ครอบครัว|พ่อแม่|ญาติ|พี่น้อง|ผู้ใหญ่ในบ้าน|คนในบ้าน|ลูกชาย|ลูกสาว|คุณแม่|คุณพ่อ|family|parents|mom|dad|mother|father|sibling|relative|家庭|父母|爸妈|兄弟姐妹|亲戚/i.test(rawQ)) {
    subDomain = 'family';
  }

  let intent = 'explain';
  if (/คิดยังไง|รู้สึกยังไง|จริงใจ|จริงจัง|มองเรา|เขารู้สึก|กลับมาไหม|มีคนอื่นไหม|รักเรา|ชอบเรา|คิดถึง|how does he feel|how does she feel|feel about me|still love|come back|someone else|sincere|怎么看我|他怎么想|她怎么想|喜欢我吗|还爱我吗|真心吗|会不会回来|有别人吗/i.test(rawQ)) intent = 'other_person';
  else if (extractGenuineBinaryChoices(rawQ, /[\u4E00-\u9FFF]/.test(rawQ) ? 'zh' : /[a-zA-Z]{4}/.test(rawQ) ? 'en' : 'th')) intent = 'decision';
  else if (/เมื่อไหร่|นานไหม|อีกนาน|กี่เดือน|กี่วัน|กี่สัปดาห์|ช่วงไหน|เร็วๆ|ตอนไหน|เดือนไหน|วันไหน|when\b|how long|how soon|which month|which week|什么时候|多久|几个月|几天|几周|哪个月/i.test(rawQ)) intent = 'timing';
  else if (/ดีไหม|ควรไหม|เอาไง|เลือก|ระหว่าง|ไปต่อ|ลาออก|คุ้มไหม|should i|worth it|choose|stay or go|quit|还是选|应该|好不好|值不值得|怎么选|要继续吗/i.test(rawQ)) intent = 'decision';
  else if (/ทำยังไง|แก้ยังไง|เริ่มยังไง|ควรทำ|แนะนำ|ทางออก|รับมือ|ต้องระวังอะไร|แก้ตรงไหน|ยังไงดี|โฟกัส.*ก่อน|ใส่ใจ.*เป็นพิเศษ|how should i|what should i do|advice|fix|handle|start|怎么办|怎么做|怎么解决|建议|需要注意|如何应对/i.test(rawQ)) intent = 'action';
  else if (/ทำไม|เพราะอะไร|ติดอะไร|เกิดจาก|สาเหตุ|why\b|what is blocking|reason|cause|为什么|原因|卡在哪里|怎么会这样/i.test(rawQ)) intent = 'why';
  else if (/สำเร็จไหม|รอดไหม|ได้ไหม|ได้มั้ย|สมหวังไหม|รุ่งหรือเสี่ยง|เสี่ยงไหม|มีโอกาส.*?(?:ไหม|มั้ย|ป่าว|เปล่า|ปล่าว)|ได้หรือ(?:เปล่า|ป่าว|ปล่าว|ไม่)|เป็นไปได้ไหม|จะ.*?(?:ได้ไหม|ได้มั้ย|ได้ป่าว|ได้หรือเปล่า|ได้หรือป่าว|ได้หรือปล่าว)|เก็บเงิน.*?(?:ไหม|มั้ย|ป่าว|เปล่า)|ปังไหม|เวิร์คไหม|ผ่านไหม|ดีขึ้นไหม|จะดีไหม|will it work|will i succeed|chances|possible|achieve|pass|improve|能成吗|顺利吗|有机会吗|做得到吗|实现吗|会变好吗|过得去吗/i.test(rawQ)) intent = 'outcome';

  const isSpecificGeneral = /(จุดบอด|บทเรียน|สรุปสำรับ|โอกาส.*เดือน|ความฝัน|ทิศทางชีวิต|blind spot|biggest lesson)/i.test(rawQ);
  const isBroadOpen = rawQ.length > 0 && rawQ.length <= 36 && !isEllipticalFollowUp && !isSpecificGeneral
    && ((subDomain === 'general' && intent === 'explain')
      || /^(?:ดูดวง(?:ให้หน่อย)?|ช่วยดู(?:ให้หน่อย)?|ช่วงนี้.*(?:เป็นไง|ยังไง)|ชีวิต.*(?:เป็นไง|ยังไง)|ทายให้หน่อย|today|how.?s my life|general reading|看运势|最近怎么样|看看总体)[?!.\s]*$/i.test(rawQ));

  return { topic, subDomain, intent, isBroadOpen, isElliptical: isEllipticalFollowUp };
}

export function scoreCardPolarity(card) {
  let base = 'balanced';
  if (card?.tone === 'warn') base = 'caution';
  else if (card?.tone === 'good') base = 'favorable';
  else if (card?.tone === 'neutral') base = 'balanced';
  else {
    const challenging = ['The Devil', 'The Tower', 'The Moon', 'The Hanged Man', 'Death', 'Three of Swords', 'Five of', 'Seven of', 'Eight of Swords', 'Nine of Swords', 'Ten of Swords', 'Ten of Wands'];
    const strongPositive = ['The Sun', 'The Star', 'The World', 'The Magician', 'The Chariot', 'Wheel of Fortune', 'Ace of', 'Three of Pentacles', 'Six of Wands', 'Nine of Pentacles', 'Ten of Cups', 'Ten of Pentacles', 'King of', 'Queen of'];
    if (challenging.some((k) => (card?.name || '').includes(k))) base = 'caution';
    else if (strongPositive.some((k) => (card?.name || '').includes(k))) base = 'favorable';
  }
  if (card?.reversed && base === 'favorable') {
    return 'balanced';
  }
  return base;
}

export function findMatchingNatalCard(state, topic, outcomeCard) {
  if (!state.natalCards || state.natalCards.length < 10) return null;
  if (topic === 'work') return state.natalCards[4];
  if (topic === 'money') return state.natalCards[5];
  if (topic === 'love') return state.natalCards[7];
  if (outcomeCard && outcomeCard.suit === state.natalCards[1].suit) return state.natalCards[1];
  return state.natalCards[9];
}

function computeSpreadScore(cards) {
  let score = 0;
  cards.forEach((c, idx) => {
    const w = idx === cards.length - 1 ? 1.5 : 1;
    const p = scoreCardPolarity(c);
    if (p === 'favorable') score += w;
    else if (p === 'caution') score -= w;
  });
  return score >= 1 ? 'favorable' : score < 0 ? 'caution' : 'balanced';
}

function estimateTimingFromCard(card, lang = 'th') {
  const n = card.name || '';
  const target = normalizeLang(lang);
  if (target === 'en') {
    if (/Ace|Two|Three|Eight of Wands|Knight of Wands|Knight of Swords/.test(n)) return 'fairly soon — early signs or answers tend to show within 1 to 3 weeks.';
    if (/Eight|Nine|Ten/.test(n)) return 'near the closing stretch of this cycle — roughly 2 to 6 weeks to wrap up or shift phase.';
    if (card.suit === 'Major') return 'less tied to a calendar date than to your move — things unlock within about a month once you commit clearly.';
    if (card.suit === 'Pentacles') return 'takes steady grounding over 2 to 4 months before solid numbers appear.';
    return 'likely becomes noticeably clearer over the next 1 to 2 months as you follow through.';
  }
  if (target === 'zh') {
    if (/Ace|Two|Three|Eight of Wands|Knight of Wands|Knight of Swords/.test(n)) return '节奏比较快，大约 1 到 3 周内就会看到明确信号或回应。';
    if (/Eight|Nine|Ten/.test(n)) return '已接近这波周期的收官阶段，大约 2 到 6 周会有个落点或转换。';
    if (card.suit === 'Major') return '重点不只看日历，而在于你什么时候真正改变做法——通常跨出实际一步后的 1 个月内就能松动。';
    if (card.suit === 'Pentacles') return '属于慢工细活，需要扎实耕耘约 2 到 4 个月才会看见实打实的数字回报。';
    return '随着你持续沟通推进，大概在 1 到 2 个月内就会越来越明朗。';
  }
  if (/Ace|Two|Three|Eight of Wands|Knight of Wands|Knight of Swords/.test(n)) {
    return 'ค่อนข้างไว ประมาณ 1-3 สัปดาห์นี้เริ่มเห็นสัญญาณหรือคำตอบชัดแล้ว';
  }
  if (/Eight|Nine|Ten/.test(n)) {
    return 'อยู่ในช่วงโค้งสุดท้ายของรอบนี้ ประมาณ 2-6 สัปดาห์จะสรุปจบหรือเปลี่ยนเฟส';
  }
  if (card.suit === 'Major') {
    return 'ไม่ได้ขึ้นกับปฏิทินอย่างเดียว แต่จะปลดล็อกทันทีภายใน 1 เดือนนับจากวันที่กล้าเปลี่ยนวิธีคิดหรือลงมือจริง';
  }
  if (card.suit === 'Pentacles') {
    return 'ต้องใช้เวลาวางฐานจริงจังราว 2-4 เดือนถึงจะเห็นผลลัพธ์ที่เป็นตัวเลขชัดเจน';
  }
  return 'ค่อยๆ เห็นชัดภายใน 1-2 เดือนนี้ตามจังหวะที่คุยและลงมือทำ';
}

function selectRelevantNatalIndices(topic, intent, q) {
  if (intent === 'other_person' || /เจ้านาย|หัวหน้า|ลูกค้า|เพื่อนร่วมงาน|คนคุย|แฟน|เขา|เธอ|boss|manager|client|coworker|partner|ex\b|老板|上司|客户|同事|对方|他|她/i.test(q)) {
    return [7, 8, 9];
  }
  if (intent === 'timing') return [5, 4, 9];
  if (intent === 'why') return [1, 2, 3];
  if (intent === 'action') return [1, 6, 9];
  if (topic === 'work') return [4, 1, 9];
  if (topic === 'money') return [5, 2, 9];
  if (topic === 'love') return [7, 8, 9];
  if (topic === 'self') return [0, 2, 6];
  return [0, 1, 9];
}

function pickFreshVariant(variants, seed = 0, recentTexts = []) {
  if (!Array.isArray(variants) || variants.length === 0) return '';
  const recentJoined = (recentTexts || []).join(' ');
  const len = variants.length;
  for (let offset = 0; offset < len; offset += 1) {
    const cand = variants[(Math.abs(seed) + offset) % len];
    const probe = String(cand || '').slice(0, 22).trim();
    if (!probe || !recentJoined.includes(probe)) {
      return cand;
    }
  }
  return variants[Math.abs(seed) % len];
}

function getRecentSatiTexts(state, limit = 2) {
  const hist = Array.isArray(state?.chatHistory) ? state.chatHistory : [];
  const scoped = typeof state?.deckResetAtIndex === 'number' ? hist.slice(state.deckResetAtIndex) : hist;
  return scoped
    .filter((h) => h && (h.role === 'sati' || ['สติ', 'Sati', '思谛'].includes(h.speaker)))
    .slice(-limit)
    .map((h) => String(h.text || ''));
}

function buildConnectedCardStory(refCards, topic, outcomeCard, outcomeTone, natalCard, nick, lang, turnSeed = 0, recentTexts = [], subDomain = '') {
  const lbl = (c) => getLocalizedCardLabelInline(c, lang);
  const mean = (c) => getCardMeaningForTopic(c, topic, lang, subDomain);
  let story = '';

  if (refCards.length === 1) {
    const c0 = refCards[0];
    if (lang === 'en') {
      story = pickFreshVariant([
        `The card on the table is ${lbl(c0)} — ${mean(c0)}`,
        `${lbl(c0)} speaks straight to your point: ${mean(c0)}`,
        `Your draw lands squarely on ${lbl(c0)}, showing ${mean(c0)}`
      ], turnSeed, recentTexts);
    } else if (lang === 'zh') {
      story = pickFreshVariant([
        `眼下这张${lbl(c0)}说得很直白：${mean(c0)}`,
        `手头这张${lbl(c0)}点出核心：${mean(c0)}`,
        `抽出的${lbl(c0)}直接给出回应：${mean(c0)}`
      ], turnSeed, recentTexts);
    } else {
      story = pickFreshVariant([
        `ไพ่ที่หยิบขึ้นมาคือ ${lbl(c0)} ซึ่งสะท้อนเรื่องนี้ตรงๆ ว่า${mean(c0)}`,
        `ใบนี้จับได้ ${lbl(c0)} ที่เปิดมุมชัดว่า${mean(c0)}`,
        `หน้าไพ่ ${lbl(c0)} บอกตรงเป้าเรื่องนี้เลยว่า${mean(c0)}`
      ], turnSeed, recentTexts);
    }
  } else if (refCards.length === 2) {
    const [c0, c1] = refCards;
    const p0 = scoreCardPolarity(c0);
    const p1 = scoreCardPolarity(c1);
    if (lang === 'en') {
      if (p1 === 'caution' && p0 !== 'caution') story = `${lbl(c0)} starts on solid footing (${stripEnEnd(mean(c0))}), yet ${lbl(c1)} follows with a warning: ${mean(c1)}`;
      else if (p0 === 'caution' && p1 === 'favorable') story = `Though ${lbl(c0)} starts heavy (${stripEnEnd(mean(c0))}), ${lbl(c1)} opens the road clearly: ${mean(c1)}`;
      else story = `${lbl(c0)} sets the picture — ${mean(c0)} Right alongside it, ${lbl(c1)} confirms: ${mean(c1)}`;
    } else if (lang === 'zh') {
      if (p1 === 'caution' && p0 !== 'caution') story = `起手看${lbl(c0)}，${stripZhEnd(mean(c0))}；不过紧跟的${lbl(c1)}提醒要留神：${mean(c1)}`;
      else if (p0 === 'caution' && p1 === 'favorable') story = `虽然${lbl(c0)}起步吃力（${stripZhEnd(mean(c0))}），但后面的${lbl(c1)}把路拉开了：${mean(c1)}`;
      else story = `${lbl(c0)}点明眼下态势（${stripZhEnd(mean(c0))}），接着${lbl(c1)}进一步印证：${mean(c1)}`;
    } else {
      if (p1 === 'caution' && p0 !== 'caution') story = `เริ่มจาก ${lbl(c0)} ที่บอกว่า${mean(c0)} แต่มี ${lbl(c1)} ตามมาเตือนไว้ตรงๆ ว่า${mean(c1)}`;
      else if (p0 === 'caution' && p1 === 'favorable') story = `แม้จุดเริ่มต้น ${lbl(c0)} จะตึงตรงที่${mean(c0)} แต่ใบถัดมาอย่าง ${lbl(c1)} เปิดทางให้ชัดว่า${mean(c1)}`;
      else story = `จาก ${lbl(c0)} ที่ชี้ว่า${mean(c0)} แล้วต่อด้วย ${lbl(c1)} ซึ่งย้ำให้เห็นว่า${mean(c1)}`;
    }
  } else {
    const c0 = refCards[0];
    const c1 = refCards[1];
    const c2 = outcomeCard;
    const p1 = scoreCardPolarity(c1);
    const p2 = outcomeTone;
    if (lang === 'en') {
      if (p1 === 'favorable' && p2 === 'caution') {
        story = pickFreshVariant([
          `${lbl(c0)} sets the tone (${stripEnEnd(mean(c0))}). While ${lbl(c1)} tempts you to move fast (${stripEnEnd(mean(c1))}), ${lbl(c2)} cautions at the close: ${mean(c2)}`,
          `Opening with ${lbl(c0)} (${stripEnEnd(mean(c0))}) and active momentum from ${lbl(c1)} (${stripEnEnd(mean(c1))}), watch the closing check in ${lbl(c2)}: ${mean(c2)}`
        ], turnSeed, recentTexts);
      } else if (p1 === 'caution' && p2 === 'favorable') {
        story = pickFreshVariant([
          `${lbl(c0)} opens well (${stripEnEnd(mean(c0))}), and despite ${lbl(c1)} causing friction (${stripEnEnd(mean(c1))}), everything clears at ${lbl(c2)}: ${mean(c2)}`,
          `Right now ${lbl(c0)} points to ${stripEnEnd(mean(c0))}; once you handle the snag in ${lbl(c1)} (${stripEnEnd(mean(c1))}), ${lbl(c2)} brings relief: ${mean(c2)}`
        ], turnSeed, recentTexts);
      } else if (p2 === 'caution') {
        story = pickFreshVariant([
          `${lbl(c0)} shows where things sit (${stripEnEnd(mean(c0))}), and with ${lbl(c1)} (${stripEnEnd(mean(c1))}), ${lbl(c2)} flags caution: ${mean(c2)}`,
          `Between ${lbl(c0)} (${stripEnEnd(mean(c0))}) and ${lbl(c1)} (${stripEnEnd(mean(c1))}), the closing signal ${lbl(c2)} tells you plainly: ${mean(c2)}`
        ], turnSeed, recentTexts);
      } else {
        story = pickFreshVariant([
          `${lbl(c0)} shows the start (${stripEnEnd(mean(c0))}), ${lbl(c1)} shapes the turn (${stripEnEnd(mean(c1))}), leading into ${lbl(c2)}: ${mean(c2)}`,
          `Stepping from ${lbl(c0)} (${stripEnEnd(mean(c0))}) through ${lbl(c1)} (${stripEnEnd(mean(c1))}), the spread lands on ${lbl(c2)} — ${mean(c2)}`
        ], turnSeed, recentTexts);
      }
    } else if (lang === 'zh') {
      if (p1 === 'favorable' && p2 === 'caution') story = `眼下${lbl(c0)}反映${stripZhEnd(mean(c0))}；虽然${lbl(c1)}很让人想冲一把（${stripZhEnd(mean(c1))}），但收尾的${lbl(c2)}提醒：${mean(c2)}`;
      else if (p1 === 'caution' && p2 === 'favorable') story = `从${lbl(c0)}看，${stripZhEnd(mean(c0))}；哪怕中间夹着${lbl(c1)}的纠结（${stripZhEnd(mean(c1))}），最终仍会在${lbl(c2)}转晴：${mean(c2)}`;
      else if (p2 === 'caution') story = `${lbl(c0)}显示${stripZhEnd(mean(c0))}，加上${lbl(c1)}（${stripZhEnd(mean(c1))}），尾牌${lbl(c2)}提示谨慎：${mean(c2)}`;
      else story = `${lbl(c0)}点出起点（${stripZhEnd(mean(c0))}），中间由${lbl(c1)}承接（${stripZhEnd(mean(c1))}），最后落到${lbl(c2)}：${mean(c2)}`;
    } else {
      if (p1 === 'favorable' && p2 === 'caution') {
        story = pickFreshVariant([
          `ตอนนี้ ${lbl(c0)} บอกว่า${mean(c0)} แม้ ${lbl(c1)} จะเปิดมุมให้เห็นว่า${mean(c1)} แต่ปลายทางยังมี ${lbl(c2)} เตือนชัดว่า${mean(c2)}`,
          `ภาพรวมจาก ${lbl(c0)} คือ${mean(c0)} บวกจังหวะใน ${lbl(c1)} ที่ชี้ว่า${mean(c1)} ทว่าไพ่ปิด ${lbl(c2)} เบรกว่า${mean(c2)}`,
          `จังหวะนี้เปิดหัวด้วย ${lbl(c0)} ว่า${mean(c0)} โดยมี ${lbl(c1)} ดันมุมให้เห็นว่า${mean(c1)} ก่อน ${lbl(c2)} จะขีดเส้นเตือนตรงๆ ว่า${mean(c2)}`
        ], turnSeed, recentTexts);
      } else if (p1 === 'caution' && p2 === 'favorable') {
        story = pickFreshVariant([
          `ตอนนี้ ${lbl(c0)} ชี้ว่า${mean(c0)} แม้ตรงกลางยังมีปมจาก ${lbl(c1)} คือ${mean(c1)} ทว่าปลายทางเปิดโล่งที่ ${lbl(c2)} — ${mean(c2)}`,
          `เห็นชัดจาก ${lbl(c0)} ว่า${mean(c0)} ถึงจะต้องผ่านด่าน ${lbl(c1)} ตรงที่${mean(c1)} แต่สุดท้ายไปจบดีที่ ${lbl(c2)} คือ${mean(c2)}`,
          `จุดตั้งต้น ${lbl(c0)} บอกว่า${mean(c0)} ช่วงกลางติดขัดที่ ${lbl(c1)} เพราะ${mean(c1)} ก่อนคลี่คลายด้วย ${lbl(c2)} — ${mean(c2)}`
        ], turnSeed, recentTexts);
      } else if (p2 === 'caution') {
        story = pickFreshVariant([
          `จาก ${lbl(c0)} ตอนนี้ชี้ว่า${mean(c0)} ผสมกับ ${lbl(c1)} ที่บอกว่า${mean(c1)} ปลายทาง ${lbl(c2)} เลยเตือนไว้ว่า${mean(c2)}`,
          `หน้าไพ่ ${lbl(c0)} วางบริบทว่า${mean(c0)} ประกบกับ ${lbl(c1)} ซึ่งสะท้อนว่า${mean(c1)} ส่วนไพ่สรุป ${lbl(c2)} ทักตรงๆ ว่า${mean(c2)}`,
          `เมื่อดูคู่กันระหว่าง ${lbl(c0)} (${mean(c0)}) กับ ${lbl(c1)} (${mean(c1)}) เลยส่งมาถึงจุดที่ ${lbl(c2)} ย้ำว่า${mean(c2)}`
        ], turnSeed, recentTexts);
      } else {
        story = pickFreshVariant([
          `เริ่มจาก ${lbl(c0)} ที่เห็นว่า${mean(c0)} มี ${lbl(c1)} เชื่อมตรงกลางว่า${mean(c1)} ก่อนไปจบที่ ${lbl(c2)} — ${mean(c2)}`,
          `ไพ่เปิดเรื่องด้วย ${lbl(c0)} ชี้ว่า${mean(c0)} ตามด้วยแรงเสริมจาก ${lbl(c1)} ว่า${mean(c1)} และลงตัวที่ ${lbl(c2)} คือ${mean(c2)}`,
          `เส้นเรื่องรอบนี้ไล่จาก ${lbl(c0)} (${mean(c0)}) ผ่านตัวแปรสำคัญอย่าง ${lbl(c1)} (${mean(c1)}) ไปสู่บทสรุป ${lbl(c2)} — ${mean(c2)}`
        ], turnSeed, recentTexts);
      }
    }
  }

  if (natalCard && outcomeCard && natalCard.uid === outcomeCard.uid && refCards.length > 1) {
    if (lang === 'en') story += ` Notably, ${outcomeCard.name} echoes your natal chart — this lesson really matters right now.`;
    else if (lang === 'zh') story += ` 而且${getLocalizedCardShortName(outcomeCard, 'zh')}正好与你最初的本命牌重合，可见这是眼下关键课题。`;
    else story += ` อีกอย่างคือ ${outcomeCard.th} ซ้ำกับไพ่พื้นดวงตอนแรกของ${nick}พอดี แปลว่านี่คือบทเรียนหลักรอบนี้เลย`;
  }
  const revFocus = outcomeCard?.reversed ? outcomeCard : refCards.find((c) => Boolean(c?.reversed));
  if (revFocus) {
    const revNuance = getReversedEnergyNuance(revFocus, lang);
    if (revNuance) {
      if (lang === 'zh') story += `（逆位提示：${stripZhEnd(revNuance)}）`;
      else if (lang === 'en') story += ` (${stripEnEnd(revNuance)})`;
      else story += ` (${revNuance})`;
    }
  }
  return story;
}

const ELEM_I18N = {
  ไฟ: { th: 'ไฟ', en: 'Fire', zh: '火' },
  ดิน: { th: 'ดิน', en: 'Earth', zh: '土' },
  ลม: { th: 'ลม', en: 'Air', zh: '风' },
  น้ำ: { th: 'น้ำ', en: 'Water', zh: '水' }
};

function resolveElemKey(user) {
  const raw = user?.elemShort || '';
  if (ELEM_I18N[raw]) return raw;
  const full = user?.element || '';
  return Object.keys(ELEM_I18N).find((k) => full.includes(k)) || '';
}

function extractTopicFocusTokens(q, lang = 'th') {
  const s = String(q || '').toLowerCase();
  if (!s) return [];
  if (lang === 'th' && typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const seg = new Intl.Segmenter('th', { granularity: 'word' });
    const stop = new Set(['ผม', 'ฉัน', 'เรา', 'คุณ', 'ไหม', 'มั้ย', 'หรือ', 'เปล่า', 'ป่าว', 'ปล่าว', 'กันแน่', 'ตอนนี้', 'ช่วงนี้', 'สรุป', 'ช่วย', 'หน่อย', 'ด้วย', 'ได้', 'จะ', 'คือ', 'อะไร', 'ยังไง', 'เลย', 'นะ', 'มาก', 'ครับ', 'ค่ะ']);
    return [...seg.segment(s)]
      .filter((x) => x.isWordLike && x.segment.length >= 2 && !stop.has(x.segment))
      .map((x) => x.segment);
  }
  return s.split(/\s+/).filter((w) => w.length >= 3);
}

function hasLexicalQuestionOverlap(q1, q2, lang = 'th') {
  const a = new Set(extractTopicFocusTokens(q1, lang));
  const b = new Set(extractTopicFocusTokens(q2, lang));
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  for (const t of a) {
    if (b.has(t)) shared += 1;
  }
  const union = a.size + b.size - shared;
  return shared >= 2 || (union > 0 && shared / union >= 0.35);
}

function isRepeatedTopicIntent(state, currentQ, topic, intent) {
  const hist = Array.isArray(state?.chatHistory) ? state.chatHistory : [];
  if (!currentQ || topic === 'general') return false;
  const curNorm = String(currentQ || '').trim();
  if (/^(ขยายความต่อจากที่ถามไว้ว่า|Please expand further on:|请针对我刚才的问题继续深入讲讲：)/.test(curNorm)) {
    return false;
  }
  const scopedHist = typeof state?.deckResetAtIndex === 'number' ? hist.slice(state.deckResetAtIndex) : hist;
  const allUserMsgs = scopedHist.filter((h) => h && (h.role === 'user' || (!h.role && !['สติ', 'Sati', '思谛'].includes(h.speaker))));
  if (allUserMsgs[allUserMsgs.length - 1]?.isExpandAction) return false;
  const userMsgs = allUserMsgs.filter((h) => !h.isDrawAction && !h.isExpandAction);
  const prior = userMsgs.length > 0 && String(userMsgs[userMsgs.length - 1].text || '').trim() === curNorm
    ? userMsgs.slice(0, -1)
    : userMsgs;
  const lastPrev = prior[prior.length - 1];
  if (!lastPrev?.text) return false;
  const parsedPrev = detectTopicAndIntent(lastPrev.text, '');
  if (parsedPrev.topic !== topic || parsedPrev.intent !== intent) return false;
  // Require real semantic similarity (or shared relational target) so distinct work/life questions do not falsely accuse user
  if (/[\u0E00-\u0E7F]/.test(curNorm)) {
    const bothRomanticOther = topic === 'love' && intent === 'other_person' && /เขา|เธอ|แฟน|คนคุย/.test(curNorm) && /เขา|เธอ|แฟน|คนคุย/.test(lastPrev.text);
    return bothRomanticOther || hasLexicalQuestionOverlap(curNorm, lastPrev.text, 'th');
  }
  return curNorm.toLowerCase() === String(lastPrev.text || '').trim().toLowerCase() || hasLexicalQuestionOverlap(curNorm, lastPrev.text, 'en');
}

function buildSubtextHook(intent, topic, isRepeat, nick, lang) {
  const isPro = topic === 'work' || topic === 'money';
  if (isRepeat) {
    return {
      shortLead: lang === 'en'
        ? `You’re circling back to this again, ${nick}, which says part of you hasn’t accepted it yet — `
        : lang === 'zh'
          ? `你又绕回同一个问题了，${nick}，说明心里其实还没真正放下——`
          : `ถามวนเรื่องเดิมซ้ำอีกแล้วนะ${nick} แปลว่าในใจยังไม่ยอมวางลง — `,
      deepSubtext: lang === 'en'
        ? 'Repeat-Question Signal: Asking about the same issue again shows inner resistance to accepting what the cards already highlighted.'
        : lang === 'zh'
          ? '重复提问信号：反复询问同一核心议题，说明潜意识仍在寻找顺从心意的答案，还没完全接纳牌面提示的现实。'
          : 'สัญญาณถามวนซ้ำ: การกลับมาถามประเด็นเดิมซ้ำสะท้อนว่าในใจยังไม่ยอมวางหรือกำลังมองหาเหตุผลเข้าข้างทางที่อยากได้'
    };
  }

  const hooks = {
    other_person: isPro
      ? {
          shortLead: { th: 'อยากเช็กว่าแรงที่ลงไปมีคนเห็นค่าแค่ไหน — ', en: 'Checking whether your effort is truly valued — ', zh: '想确认自己的付出对方看没看在眼里——' },
          deep: { th: 'อ่านใจหลังคำถาม (Subtext): ต้องการความชัดเจนว่าอีกฝ่ายประเมินคุณค่าและผลงานของเราอย่างไร ก่อนตัดสินใจทุ่มแรงต่อ', en: 'Hidden Subtext: Checking how the other party genuinely values your contribution before committing more energy.', zh: '潜台词洞察：在继续加码付出之前，想看清对方究竟如何评估你的价值。' }
        }
      : {
          shortLead: { th: 'ลึกๆ กำลังผูกใจไว้กับท่าทีเขาอยู่เลย — ', en: 'Your peace is leaning on their next move — ', zh: '你心里正把底气系在对方的态度上——' },
          deep: { th: 'อ่านใจหลังคำถาม (Subtext): กำลังเอาคุณค่าและความมั่นคงทางใจไปผูกไว้กับการกระทำของอีกฝ่าย จึงต้องอ่านความจริงแล้วดึงโฟกัสกลับมาที่เราเองว่าจะมีความสุขจริงไหม', en: 'Hidden Subtext: Your emotional footing is tied to their reaction; read their stance plainly, then center back on whether that dynamic truly serves you.', zh: '潜台词洞察：不知不觉把自我价值绑在了对方回应上，看清对方真心后更要反问自己待在这样的关系里是否真正开心。' }
        },
    decision: {
      shortLead: { th: 'ใจนึงเอนไปทางเลือกหนึ่งแล้ว แค่กลัวพลาด — ', en: 'You lean one way already and weigh the cost — ', zh: '心里已有倾向，只是怕选错代价——' },
      deep: { th: 'อ่านใจหลังคำถาม (Subtext): มีทางที่อยากไปอยู่ในใจ แต่กลัวเสียโอกาสอีกฝั่งหรือกลัวต้องจ่ายราคาแพงทีหลัง', en: 'Hidden Subtext: Weighing an unspoken preference while guarding against hidden trade-offs.', zh: '潜台词洞察：内心已有偏向，真正纠结的是做决定后要承担的机会成本（Trade-off）。' }
    },
    timing: {
      shortLead: { th: 'ดูออกนะว่าเริ่มลุ้นอยากเห็นผลไวๆ — ', en: 'Waiting is wearing your patience thin — ', zh: '感觉得出你正等得焦急，想早见分晓——' },
      deep: { th: 'อ่านใจหลังคำถาม (Subtext): กำลังเริ่มหมดความอดทนจากการรอผล จึงต้องรู้จังหวะเวลาตามธาตุไพ่และสิ่งที่ควรทำระหว่างรอ', en: 'Hidden Subtext: Growing restless with uncertainty; needs both a realistic pace and something productive to focus on while waiting.', zh: '潜台词洞察：长期等待导致心里发急，既需要按牌面元素看节奏，更要知道等待期能主动抓稳什么。' }
    },
    outcome: topic === 'self'
      ? {
          shortLead: { th: 'กำลังชั่งใจว่าเส้นทางนี้ไปได้จริงไหม — ', en: 'Weighing whether this path truly holds — ', zh: '在衡量这条路究竟能不能走通——' },
          deep: { th: 'อ่านใจหลังคำถาม (Subtext): กำลังชั่งน้ำหนักความตั้งใจจริงกับความเป็นไปได้ในชีวิตจริง เพื่อตัดสินใจทุ่มสุดตัว', en: 'Hidden Subtext: Testing conviction against real-world feasibility before going all in.', zh: '潜台词洞察：在把重心和热情全压上去前，想听一次不掺水分的可行性验证。' }
        }
      : {
          shortLead: { th: 'อยากมั่นใจว่าเหนื่อยต่อแล้วคุ้มไหม — ', en: 'Checking if pushing on stays worth it — ', zh: '想确认继续拼下去值不值得——' },
          deep: { th: 'อ่านใจหลังคำถาม (Subtext): เริ่มรู้สึกเหนื่อยหรือเห็นสัญญาณติดขัด จึงอยากเช็กความคุ้มค่าและจุดคอขวดที่ต้องแก้ให้รอด', en: 'Hidden Subtext: Sensing friction or fatigue and checking whether this goal justifies more grit — plus what bottleneck must clear first.', zh: '潜台词洞察：已经感受到阻力和消耗，想确定回报是否值得坚持以及当下最该打通的卡点在哪。' }
        },
    why: {
      shortLead: { th: 'เจอจุดติดซ้ำจนอยากจับต้นชนปลายให้ขาด — ', en: 'Wanting the root cause clear now — ', zh: '想把反复卡住的根由理顺——' },
      deep: { th: 'อ่านใจหลังคำถาม (Subtext): รู้สึกว่าเรื่องสะดุดผิดปกติ อยากรู้ให้ชัดว่าเกิดจากสถานการณ์ภายนอกหรือนิสัยของเราเอง', en: 'Hidden Subtext: Looking past surface symptoms to see whether external blocks or internal habits are causing the loop.', zh: '潜台词洞察：不满足于表面安慰，想看清到底是外部卡点还是自身惯性把事情拖住了。' }
    },
    action: {
      shortLead: { th: 'ใจพร้อมขยับแล้ว แค่ไม่อยากเดินพลาด — ', en: 'Ready to act with a clean next move — ', zh: '准备出手了，只想避开踩坑——' },
      deep: { th: 'อ่านใจหลังคำถาม (Subtext): พร้อมจะลงมือแก้สถานการณ์แล้ว ต้องการทางออกที่เป็นรูปธรรมและคุมความเสี่ยงได้จริง', en: 'Hidden Subtext: Ready to act now — needs concrete leverage over vague comfort.', zh: '潜台词洞察：心态上已准备好行动，最需要的是能立刻落地的务实解法。' }
    },
    explain: {
      shortLead: { th: '', en: '', zh: '' },
      deep: { th: 'อ่านใจหลังคำถาม (Subtext): ต้องการภาพความจริงที่ชัดและตรงที่สุด เพื่อใช้จัดลำดับชีวิตต่อ', en: 'Hidden Subtext: Looking for an honest reality check on where things truly stand.', zh: '潜台词洞察：想听最不绕弯的局势研判，好重新校准下一步重心。' }
    }
  };
  const h = hooks[intent] || hooks.explain;
  return { shortLead: h.shortLead[lang] || '', deepSubtext: h.deep[lang] || '' };
}

function buildPsychMirrorClause(user, refCards, spreadTone, nick, lang, turnSeed = 0, recentTexts = []) {
  const names = (refCards || []).map((c) => c?.name || '');
  const hasAny = (keys) => names.some((n) => keys.some((k) => n.includes(k)));

  const hasAuth = hasAny(['King of', 'Queen of', 'The Emperor', 'The Magician', 'Strength', 'The Chariot', 'Justice']);
  const hasHeavy = hasAny(['The Hanged Man', 'Nine of Swords', 'Ten of Wands', 'Ten of Swords', 'Eight of Cups', 'Five of Pentacles', 'The Moon', 'Four of Pentacles', 'Eight of Swords']);
  if (hasAuth && hasHeavy) {
    return {
      short: lang === 'en'
        ? pickFreshVariant([
            `Outside you look calm and capable, ${nick}, yet inside you’re carrying heavy tension alone`,
            `You keep everything looking composed outside, ${nick}, while quietly absorbing more strain than you admit`
          ], turnSeed, recentTexts)
        : lang === 'zh'
          ? `外人看${nick}稳重扛事，可你心里其实一直独自顶着沉重压力`
          : pickFreshVariant([
              `คนนอกมองว่า${nick}นิ่งและจัดการได้ทุกเรื่อง แต่ข้างในกำลังแบกแรงกดดันอยู่เงียบๆ`,
              `ภายนอก${nick}ยังดูคุมเกมไหว แต่ลึกๆ เหนื่อยจากการกั๊กความกังวลไว้คนเดียว`,
              `ด้านนอก${nick}ดูนิ่งพึ่งได้ ทว่าข้างในกำลังกดดันตัวเองหนักกว่าที่คนรอบตัวเห็น`
            ], turnSeed, recentTexts),
      deep: lang === 'en'
        ? 'Psychological Mirror (Jacques Statement): Composed leadership cards paired with strain cards reveal how well you hold it together outside while absorbing unspoken pressure privately.'
        : lang === 'zh'
          ? '深层心理对照（内外反差效应）：强掌控牌与承压牌同现，说明你习惯把难题吞进肚里自己硬扛，很少向外人流露疲惫。'
          : 'ภาพสะท้อนจิตวิทยา (Jacques Statement): หน้าไพ่ฝั่งคุมเกมประกบกับไพ่กดดัน ฟ้องว่าภายนอกยังดูนิ่งเอาอยู่ทุกเรื่อง แต่ลึกๆ ข้างในกลับไม่ได้พักและแบกความเครียดเงียบๆ คนเดียว'
    };
  }

  const hasSplit = hasAny(['Two of Pentacles', 'Two of Swords', 'Seven of Cups', 'Eight of Cups', 'Death', 'The Lovers']);
  if (hasSplit) {
    return {
      short: lang === 'en'
        ? pickFreshVariant([
            `Part of you sees the old path draining you, and part still hates letting go of sunk effort`,
            `Half of you knows a shift is overdue, ${nick}, while the other half still protects what you’ve built`
          ], turnSeed, recentTexts)
        : lang === 'zh'
          ? `${nick}一边明白老路越来越耗神，另一边又舍不得过去投入的心血`
          : pickFreshVariant([
              `ใจนึง${nick}ก็รู้ว่าแบบเดิมเริ่มฝืน และอีกใจนึงก็ยังเสียดายเวลาที่ลงแรงมา`,
              `ในใจ${nick}ยังดึงกันอยู่ระหว่างความอยากเปลี่ยนให้โล่ง กับความเสียดายสิ่งที่ทุ่มมาแล้ว`,
              `ลึกๆ ${nick}เห็นชัดแล้วว่าต้องปรับทาง แค่ยังตัดใจจากต้นทุนที่ลงแรงไปไม่ได้ขาด`
            ], turnSeed, recentTexts),
      deep: lang === 'en'
        ? 'Psychological Mirror (Double-Sided Reflection): Both halves of your hesitation are real — recognizing what drains you AND honoring what you already built helps you choose without self-blame.'
        : lang === 'zh'
          ? '深层心理对照（双面映照）：内心拉锯的两股情绪都真实存在——用“同时看见”代替自责，才能看清真正该舍弃或保留的部分。'
          : 'ภาพสะท้อนจิตวิทยา (Double-Sided Reflection): สองความรู้สึกในใจเดินคู่กันคือ ใจนึงเห็นชัดว่าต้องเปลี่ยน และอีกใจนึงเสียดายสิ่งที่สร้างมา เมื่อยอมรับทั้งสองฝั่งได้จึงจะตัดสินใจได้คมขึ้น'
    };
  }

  const elemKey = resolveElemKey(user);
  const elemLbl = ELEM_I18N[elemKey]?.[lang] || elemKey;
  const hasPause = refCards.some((c) => scoreCardPolarity(c) === 'caution')
    || hasAny(['The Hanged Man', 'Temperance', 'Four of Pentacles', 'The Hermit', 'Four of Swords', 'Seven of Pentacles']);

  if (elemKey && (elemKey === 'ไฟ' || elemKey === 'ลม') && hasPause) {
    return {
      short: lang === 'en'
        ? pickFreshVariant([
            `${elemLbl} temperament moves fast, yet cards urge checking details first`,
            `Your ${elemLbl} streak wants answers now, though holding one beat prevents a costly miss`
          ], turnSeed, recentTexts)
        : lang === 'zh'
          ? `你${elemLbl}象求快，但牌提示先核实再动`
          : pickFreshVariant([
              `ธาตุ${elemLbl}ของ${nick}คิดไว แต่รอบนี้ต้องชะลอเช็กก่อน`,
              `นิสัยธาตุ${elemLbl}ชอบตัดสินใจฉับไว แต่จังหวะนี้ช้าลงครึ่งก้าวจะได้เปรียบกว่า`,
              `พื้นดวงธาตุ${elemLbl}พาให้ใจร้อนอยากจบไว ลองตั้งหลักตรวจตัวแปรก่อนค่อยลุยนะ${nick}`
            ], turnSeed, recentTexts),
      deep: lang === 'en'
        ? `Natal vs Spread Contrast (Rainbow Ruse): Your ${elemLbl} birth temperament wants swift action, which collides directly with cards calling for deliberate restraint before committing.`
        : lang === 'zh'
          ? `命格元素对照（反差法则）：你本命带${elemLbl}象，遇事讲究效率与立刻推进，但当前牌阵要求反直觉地踩稳刹车、先核对风险再出手。`
          : `จุดปะทะธาตุกำเนิดกับหน้าไพ่ (Rainbow Ruse): พื้นดวงธาตุ${elemLbl}ทำให้เป็นคนตัดสินใจไวและไม่ชอบรอนาน จึงต้องฝืนนิสัยตัวเองด้วยการหยุดตรวจสอบจุดเสี่ยงก่อนรีบขยับ`
    };
  }

  if (elemKey && (elemKey === 'ดิน' || elemKey === 'น้ำ') && hasPause) {
    return {
      short: lang === 'en'
        ? pickFreshVariant([
            `${elemLbl} depth stays cautious, just don’t stall too long`,
            `Your steady ${elemLbl} side protects you well, just watch out not to freeze in place`
          ], turnSeed, recentTexts)
        : lang === 'zh'
          ? `${elemLbl}象求稳，注意别顾虑过久错失时机`
          : pickFreshVariant([
              `ธาตุ${elemLbl}ทำให้คิดลึก แต่อย่าวนในเซฟโซนนานเกิน`,
              `พื้นดวงธาตุ${elemLbl}ของ${nick}รอบคอบอยู่แล้ว แค่ระวังความลังเลจะทำให้พลาดจังหวะ`,
              `ความเป็นธาตุ${elemLbl}ช่วยให้มองละเอียด ทว่าต้องกันตัวเองไม่ให้คิดซ้ำจนค้างเติ่ง`
            ], turnSeed, recentTexts),
      deep: lang === 'en'
        ? `Natal vs Spread Contrast (Rainbow Ruse): Your steady ${elemLbl} temperament values certainty, yet cards here warn against letting over-caution freeze a needed adjustment.`
        : lang === 'zh'
          ? `命格元素对照（反差法则）：${elemLbl}象让你重稳求妥，可这轮牌提醒别因思前想后太久而错过该调整的窗口。`
          : `จุดปะทะธาตุกำเนิดกับหน้าไพ่ (Rainbow Ruse): พื้นดวงธาตุ${elemLbl}ช่วยให้มองลึกและรอบคอบ แต่จังหวะนี้มีแนวโน้มกังวลหรือกอดความคุ้นชินเดิมแน่นเกินไป`
    };
  }

  if (elemKey && spreadTone === 'favorable') {
    return {
      short: lang === 'en'
        ? pickFreshVariant([
            `Your ${elemLbl} nature syncs with this spread to turn intent into results`,
            `Your ${elemLbl} focus matches this opening — steady action converts cleanly here`
          ], turnSeed, recentTexts)
        : lang === 'zh'
          ? `本命${elemLbl}象正好顺应这组顺风牌`
          : pickFreshVariant([
              `พลังธาตุ${elemLbl}ของ${nick}หนุนให้ไพ่ชุดนี้เห็นผลไว`,
              `จังหวะธาตุ${elemLbl}เข้าขากับหน้าไพ่ชุดนี้พอดี ยิ่งทำจริงยิ่งต่อยอดไว`,
              `จุดแข็งธาตุ${elemLbl}ของ${nick}รับส่งกับไพ่ดีชุดนี้ตรงๆ ลงมือตามแผนได้เลย`
            ], turnSeed, recentTexts),
      deep: lang === 'en'
        ? `Personalized Anchoring: Your ${elemLbl} birth element aligns naturally with this supportive spread, turning clear intention into tangible momentum.`
        : lang === 'zh'
          ? `本命特质呼应：你本命的${elemLbl}象特质恰好乘上这组正能量牌阵，行动更容易落地成真实成果。`
          : `จุดยึดโยงเฉพาะบุคคล (Personalized Anchoring): พลังธาตุ${elemLbl}ตามวันเกิดเดินสอดคล้องกับหน้าไพ่ที่เปิดรับ ทำให้สิ่งที่ลงมือทำจริงเห็นผลชัดกว่าปกติ`
    };
  }

  return { short: '', deep: '' };
}

function assembleBalancedReply(verdict, cardStory, actionAdvice, subtext, psychMirror, fallbackPrefix, isRepeat, lang) {
  const sep = lang === 'zh' ? '——' : ' — ';
  const fullP1 = `${subtext.shortLead}${verdict}`;
  const fullP3 = psychMirror.short
    ? `${psychMirror.short}${sep}${actionAdvice}`
    : `${fallbackPrefix}${actionAdvice}`;
  const full = `${fullP1}\n\n${cardStory}\n\n${fullP3}`;
  if (full.length <= 542) return full;

  if (isRepeat) {
    const leadFallback = `${fullP1}\n\n${cardStory}\n\n${fallbackPrefix}${actionAdvice}`;
    if (leadFallback.length <= 545) return leadFallback;
  }

  const noLead = `${verdict}\n\n${cardStory}\n\n${fullP3}`;
  if (noLead.length <= 542) return noLead;

  const compact = `${verdict}\n\n${cardStory}\n\n${fallbackPrefix}${actionAdvice}`;
  if (compact.length <= 545) return compact;
  const hardTail = `${verdict}\n\n${cardStory}\n\n${actionAdvice}`;
  if (hardTail.length < 550) return hardTail;
  const avail = Math.max(60, 545 - verdict.length - actionAdvice.length - 4);
  const clippedStory = cardStory.length > avail ? `${cardStory.slice(0, Math.max(0, avail - 3)).trimEnd()}...` : cardStory;
  const finalStr = `${verdict}\n\n${clippedStory}\n\n${actionAdvice}`;
  return finalStr.length < 550 ? finalStr : `${finalStr.slice(0, 546).trimEnd()}...`;
}

export function synthesizeDeepReply(state, question, cards) {
  const lang = normalizeLang(state.lang);
  const nick = state.user.nickname || (lang === 'en' ? 'my friend' : lang === 'zh' ? '朋友' : 'เพื่อน');
  const q = (question || '').trim();
  const recentTexts = getRecentSatiTexts(state, 2);
  const turnSeed = (Array.isArray(state?.chatHistory) ? state.chatHistory.length : 0) + (Number(state?.deckNumber) || 1);
  const { topic, subDomain, intent, isBroadOpen } = detectTopicAndIntent(q, state.lastTopic);
  const isRepeat = isRepeatedTopicIntent(state, q, topic, intent);
  state.lastTopic = topic;

  let refCards = cards && cards.length > 0 ? hydrateDeckCards(cards) : (state.natalCards.length > 0 ? hydrateDeckCards(state.natalCards.slice(0, 3)) : []);
  if (refCards.length === 10) {
    const pickIdx = selectRelevantNatalIndices(topic, intent, q);
    refCards = pickIdx.map((i) => refCards[i]);
  }

  const outcomeCard = refCards[refCards.length - 1];
  const spreadTone = computeSpreadScore(refCards);
  const outcomeTone = scoreCardPolarity(outcomeCard);
  const natalCard = findMatchingNatalCard(state, topic, outcomeCard);
  const keyWarnCard = (intent === 'outcome' && outcomeTone !== 'caution')
    ? outcomeCard
    : (refCards.find((c) => scoreCardPolarity(c) === 'caution') || outcomeCard);
  const actionAdvice = getLocalizedCardData(keyWarnCard, lang).advice || getLocalizedCardData(outcomeCard, lang).advice;
  const subtext = buildSubtextHook(intent, topic, isRepeat, nick, lang);
  const psychMirror = buildPsychMirrorClause(state.user, refCards, spreadTone, nick, lang, turnSeed, recentTexts);

  if (lang === 'en' || lang === 'zh') {
    const isEn = lang === 'en';
    const pair = intent === 'decision' ? extractGenuineBinaryChoices(q, lang) : null;

    let verdict = '';
    if (pair) {
      const [optA, optB] = pair;
      const warnCount = refCards.filter((c) => scoreCardPolarity(c) === 'caution').length;
      if (spreadTone === 'favorable' && warnCount === 0 && outcomeTone !== 'caution') {
        verdict = isEn
          ? `Between "${optA}" and "${optB}", go with "${optA}", ${nick} — the spread clearly leans that way.`
          : `在“${optA}”和“${optB}”之间，直接选“${optA}”，${nick}——这组牌明显更支持这边。`;
      } else if (spreadTone === 'caution' || warnCount >= Math.ceil(refCards.length / 2)) {
        verdict = isEn
          ? `Between "${optA}" and "${optB}", hold off on rushing into "${optA}", ${nick} — staying grounded with "${optB}" is much safer right now.`
          : `在“${optA}”和“${optB}”之间，先别急着冲向“${optA}”，${nick}——眼下先守住“${optB}”稳妥得多。`;
      } else {
        verdict = isEn
          ? `Between "${optA}" and "${optB}", it’s still close, ${nick} — verify concrete conditions for "${optA}" before letting go of "${optB}".`
          : `在“${optA}”和“${optB}”之间眼下势均力敌，${nick}——先把“${optA}”的条件核对稳，再决定要不要放手“${optB}”。`;
      }
    } else if (intent === 'decision') {
      verdict = (spreadTone === 'caution' || outcomeTone === 'caution')
        ? (isEn ? `Honestly, ${nick}, hold off for now — pushing hard right here carries too much blind risk.` : `说实在的，${nick}，眼下还不宜硬冲，先稳一拍更安全。`)
        : (spreadTone === 'favorable')
          ? (isEn ? `Yes, go for it, ${nick} — the cards give you more backing than risk here.` : `可以去推进，${nick}——这组牌给你的支撑远大于风险。`)
          : (isEn ? `You can move forward, ${nick}, just lock down clear boundaries before committing fully.` : `这件事能做，${nick}，先把防踩坑的边界和条件立清楚就行。`);
    } else if (intent === 'other_person') {
      const midWarn = refCards.find((c) => scoreCardPolarity(c) === 'caution');
      const isFamilyTopic = subDomain === 'family' || /family|parent|mom|dad|家庭|父母|爸妈/i.test(q);
      const isProTopic = !isFamilyTopic && (topic === 'work' || topic === 'money' || /boss|manager|client|coworker|team|partner|老板|上司|客户|同事/i.test(q));
      if (isFamilyTopic) {
        verdict = (outcomeTone === 'caution' || spreadTone === 'caution')
          ? (isEn ? `From your family’s side, ${nick}, worry about your stability makes them cautious rather than cold.` : `家人这边其实多半是担心你走偏或扛太重，${nick}，并不是刻意否定你。`)
          : (isEn ? `Your close circle wants to see your plan stay steady, ${nick}, and warms up quickly once reassured.` : `家里人整体希望你稳妥顺遂，${nick}，把你的把握讲清楚就能得到支持。`);
      } else if (isProTopic) {
        if (outcomeTone === 'caution' || spreadTone === 'caution') {
          verdict = isEn ? `To be candid, ${nick}, they still hold real reservations and aren’t ready to sign off blindly.` : `坦白跟你说，${nick}，对方眼下心里还有顾虑与保留，暂时还没打算彻底点头。`;
        } else if (spreadTone === 'favorable' && outcomeTone === 'favorable') {
          verdict = midWarn
            ? (isEn ? `Overall they appreciate your work, ${nick}, though one lingering question keeps them from full commitment yet.` : `整体上对方认可你的能力，${nick}，只是还有一小块疑虑没解开才没彻底松口。`)
            : (isEn ? `They view your work favorably and are open to backing you directly, ${nick}.` : `对方整体很认可你这边，也愿意直接配合推进，${nick}。`);
        } else {
          verdict = isEn ? `Right now they’re watching your concrete follow-through closely before taking a firm stance, ${nick}.` : `对方目前还在观望你的实际表现和条件，${nick}——既没否定，也还没完全拍板。`;
        }
      } else if (outcomeTone === 'caution' || spreadTone === 'caution') {
        verdict = isEn ? `To be candid, ${nick}, they still keep their guard up and aren’t ready to open up all the way.` : `直白跟你说，${nick}，对方心里还筑着防备或有顾虑，暂时没法完全敞开。`;
      } else if (spreadTone === 'favorable' && outcomeTone === 'favorable') {
        verdict = midWarn
          ? (isEn ? `They genuinely care about you, ${nick}, though one quiet worry makes them hesitate at times.` : `对方心里确实有你，${nick}，只是卡在某个隐忧上才显得时快时慢。`)
          : (isEn ? `They’re sincere about you and want things between you to grow openly, ${nick}.` : `对方对你很真诚，心意也愿意坦荡向你靠近，${nick}。`);
      } else {
        verdict = isEn ? `Right now they’re testing the waters quietly, ${nick} — neither pulling away nor diving all in yet.` : `对方目前处于观望权衡，${nick}——既没抽离，也还没打算全情投入。`;
      }
    } else if (intent === 'outcome') {
      verdict = (spreadTone === 'favorable' && outcomeTone !== 'caution')
        ? (isEn ? `Your odds look genuinely strong here, ${nick} — the momentum leans in your favor.` : `这件事成算很高，${nick}——整体势头站在你这边。`)
        : (spreadTone === 'caution' || outcomeTone === 'caution')
          ? (isEn ? `Keeping the exact same approach is likely to hit friction, ${nick} — something needs adjusting first.` : `如果还按老路硬推很容易卡住，${nick}——必须先把卡点理顺。`)
          : (isEn ? `It’s fifty-fifty right now, ${nick}, and consistent follow-through decides how it lands.` : `眼下五五开，${nick}，最后能不能成主要看你能不能稳稳跟进到底。`);
    } else if (intent === 'timing') {
      verdict = isEn
        ? `On timing, ${nick}: ${estimateTimingFromCard(outcomeCard, 'en')}`
        : `时间上看，${nick}：${estimateTimingFromCard(outcomeCard, 'zh')}`;
    } else if (intent === 'why') {
      verdict = isEn
        ? `If you’re wondering why this keeps snagging, ${nick}, the spread puts its finger right on it.`
        : `如果你想知道这件事究竟卡在哪里，${nick}，这几张牌把根由点得很明。`;
    } else if (intent === 'action') {
      verdict = isEn
        ? `If you’re looking for the cleanest way to handle this next, ${nick}, look at how these cards connect.`
        : `要是问接下来怎么应对最实在，${nick}，这几张牌已经把路数排出来了。`;
    } else {
      const explainTone = (spreadTone === 'favorable' && outcomeTone !== 'caution')
        ? 'favorable'
        : (spreadTone === 'caution' || outcomeTone === 'caution') ? 'caution' : 'balanced';
      const explainMap = isEn
        ? {
            study: {
              favorable: `On your study or exam path right now, ${nick}, clarity and focus are clicking into place.`,
              caution: `On your studies right now, ${nick}, tighten weak spots and double-check deadlines before resting easy.`,
              balanced: `For your study focus now, ${nick}, consistent review beats last-minute cramming.`
            },
            health: {
              favorable: `On vitality and recovery now, ${nick}, steady energy is returning if you protect your sleep.`,
              caution: `For your health right now, ${nick}, rest is overdue — slow down and consult a doctor for lingering symptoms.`,
              balanced: `For your body and mind now, ${nick}, clean daily rhythm restores balance faster than pushing through.`
            },
            family: {
              favorable: `Inside your family circle right now, ${nick}, warmth and mutual support come cleanly through plain talk.`,
              caution: `At home right now, ${nick}, unspoken worries may spark friction — listen gently without absorbing every burden.`,
              balanced: `With family right now, ${nick}, calm boundaries keep care from turning into pressure.`
            },
            property: {
              favorable: `On housing, property, or relocation right now, ${nick}, timing opens for finding a fitting place cleanly.`,
              caution: `For property or moving plans now, ${nick}, inspect contracts, hidden costs, and location limits before signing.`,
              balanced: `On home or vehicle plans now, ${nick}, compare practical options calmly before locking in.`
            },
            work: {
              favorable: `Looking at your work path right now, ${nick}, things are opening up cleanly in your favor.`,
              caution: `On work right now, ${nick}, pause to verify all facts and details before making any big jump.`,
              balanced: `On work right now, ${nick}, steady pacing and clear priorities will carry you furthest.`
            },
            money: {
              favorable: `On finances right now, ${nick}, cash flow and practical opportunities are moving in your favor.`,
              caution: `Looking at your money flow, ${nick}, tighten your numbers and hold back from risky moves right now.`,
              balanced: `With finances right now, ${nick}, balance and disciplined tracking matter more than speed.`
            },
            love: {
              favorable: `In love right now, ${nick}, warmth and honest openness are building naturally between you.`,
              caution: `In your love life right now, ${nick}, lingering doubts need calm clarity before reacting.`,
              balanced: `In relationships right now, ${nick}, gentle patience and honest listening keep things steady.`
            },
            self: {
              favorable: `Looking at your personal balance right now, ${nick}, your energy is steady and supportive.`,
              caution: `For your personal life and close circle right now, ${nick}, protect your peace before absorbing extra stress.`,
              balanced: `For your personal rhythm right now, ${nick}, small intentional boundaries restore clarity fast.`
            },
            general: {
              favorable: `Looking at what’s unfolding, ${nick}, momentum is opening up clearly on your side.`,
              caution: `Looking closely at these cards, ${nick}, take this as a cue to slow down and verify reality before pushing.`,
              balanced: `Looking at what’s unfolding, ${nick}, this is a turning stretch where calm pacing makes the difference.`
            }
          }
        : {
            study: {
              favorable: `看你近期的学业或考试走势，${nick}，思路清晰、掌握度正在稳步拉高。`,
              caution: `学业和考核方面目前有疏漏提醒，${nick}，把薄弱板块和截止细节再核对一遍才稳。`,
              balanced: `眼下学习需要稳扎稳打，${nick}，保持规律节奏比临时抱佛脚更有把握。`
            },
            health: {
              favorable: `从身心恢复来看，${nick}，只要守住作息和饮水睡眠，精力会明显回升。`,
              caution: `健康信号在提醒你歇一拍了，${nick}，长期累或身体有不适记得去正规检查，别硬撑。`,
              balanced: `目前体质和情绪重在调养，${nick}，规律作息就是眼下最好的修复。`
            },
            family: {
              favorable: `家里最近气场温和顺畅，${nick}，坦诚多聊几句就能拿到实在的支持。`,
              caution: `家人之间最近容易因各自憋着担心而误会，${nick}，耐心沟通但别把所有压力全往自己身上揽。`,
              balanced: `与家人相处重在分寸感，${nick}，既表达关心也留出彼此空间会轻松很多。`
            },
            property: {
              favorable: `看你买房、租房或搬迁置业一事，${nick}，近期有望遇到条件合心意的选项。`,
              caution: `置业、签租或买车前务必看清合同和隐性开销，${nick}，别因急着定下来忽略硬伤。`,
              balanced: `居住或大宗资产安排宜货比三家，${nick}，把预算和通勤条件摆平再签字。`
            },
            work: {
              favorable: `看你接下来的事业走势，${nick}，整体正在往明朗顺畅的方向打开。`,
              caution: `从你接下来的工作来看，${nick}，眼下先慢半拍把信息和细节核实清，别急着拍大事。`,
              balanced: `眼下事业正处在换挡期，${nick}，稳住重心、分清主次就能带出好结果。`
            },
            money: {
              favorable: `看你眼下的财运走向，${nick}，资金流和实际进账机会都在往好转。`,
              caution: `财务方面目前得盯紧细节，${nick}，看不透条件前先守好现金、别急着加注。`,
              balanced: `眼下财运需要稳妥配比，${nick}，先把收支守稳再考虑扩张。`
            },
            love: {
              favorable: `看这段感情当前的动向，${nick}，坦诚与温暖正在把距离自然拉近。`,
              caution: `感情眼下还有些没摊开的顾虑，${nick}，先别在心不稳的时候急着下结论。`,
              balanced: `感情上正处于慢慢磨合的阶段，${nick}，放柔步调比急于讨答案更有用。`
            },
            self: {
              favorable: `看你自身与家宅近况，${nick}，气场顺畅且能稳稳顾好重心。`,
              caution: `从你个人状态和身边关系来看，${nick}，先顾好心力边界再帮别人扛事。`,
              balanced: `眼下个人生活与情绪都在调整期，${nick}，先留点喘息空间反而走得更稳。`
            },
            general: {
              favorable: `从目前这组牌来看，${nick}，整体走势正在顺畅打开。`,
              caution: `从桌面这组牌来看，${nick}，眼下有明显需要停一拍、看清事实再行动的提醒。`,
              balanced: `从目前这组牌来看，${nick}，眼下需要稳住分寸、慢慢调整好节奏。`
            }
          };
      verdict = (explainMap[subDomain] || explainMap[topic] || explainMap.general)[explainTone];
      if (isBroadOpen) {
        verdict += isEn ? ' Tell me which area weighs most right now so we can zoom in.' : ' 告诉我眼下最牵挂工作、感情还是哪块，我们继续往深了看。';
      }
    }

    const cardStory = buildConnectedCardStory(refCards, topic, outcomeCard, outcomeTone, natalCard, nick, lang, turnSeed, recentTexts, subDomain);
    const fallbackPrefix = isEn
      ? pickFreshVariant([`My honest advice right now, ${nick} — `, `One grounded step now, ${nick} — `], turnSeed, recentTexts)
      : pickFreshVariant([`眼下最实在的提醒，${nick}——`, `当下最稳的落脚点，${nick}——`], turnSeed, recentTexts);

    return assembleBalancedReply(verdict, cardStory, actionAdvice, subtext, psychMirror, fallbackPrefix, isRepeat, lang);
  }

  // Warm, direct, natural Thai tarot conversation (zero bullet dumps or duplicated meanings)
  let verdict = '';
  const pairTh = intent === 'decision' ? extractGenuineBinaryChoices(q, 'th') : null;

  if (pairTh) {
    const [optA, optB] = pairTh;
    const warnCount = refCards.filter((c) => scoreCardPolarity(c) === 'caution').length;

    if (spreadTone === 'favorable' && warnCount === 0 && outcomeTone !== 'caution') {
      verdict = `ระหว่าง "${optA}" กับ "${optB}" — เลือก "${optA}" ได้เลยนะ${nick} ไพ่เทน้ำหนักมาทางฝั่งนี้ชัดกว่า`;
    } else if (spreadTone === 'caution' || warnCount >= Math.ceil(refCards.length / 2)) {
      verdict = `ระหว่าง "${optA}" กับ "${optB}" — อย่าเพิ่งรีบไปทาง "${optA}" นะ${nick} เซฟตัวเองที่ "${optB}" ก่อนชัวร์กว่า`;
    } else {
      verdict = `ระหว่าง "${optA}" กับ "${optB}" ตอนนี้น้ำหนักยังสูสีกันอยู่${nick} เช็กเงื่อนไขของ "${optA}" ให้ชัวร์ก่อนค่อยขยับจาก "${optB}"`;
    }
  } else if (intent === 'decision') {
    verdict = (spreadTone === 'caution' || outcomeTone === 'caution')
      ? `ถ้าถามตอนนี้เลย สติมองว่ายังไม่ควรรีบลุยนะ${nick} ชะลอจังหวะไว้ก่อนจะปลอดภัยกว่า`
      : (spreadTone === 'favorable')
        ? `ลุยได้เลยนะ${nick} หน้าไพ่ชุดนี้เปิดทางให้มากกว่าความเสี่ยงแล้ว`
        : `ทำได้อยู่นะ${nick} แต่ต้องวางเงื่อนไขกันพลาดให้รัดกุมก่อนค่อยขยับ`;
  } else if (intent === 'other_person') {
    const midWarn = refCards.find((c) => scoreCardPolarity(c) === 'caution');
    const isFamilyTopic = subDomain === 'family' || /ครอบครัว|พ่อแม่|แม่|พ่อ|ญาติ|พี่น้อง/.test(q);
    const isProTopic = !isFamilyTopic && (topic === 'work' || topic === 'money' || /เจ้านาย|หัวหน้า|ลูกค้า|เพื่อนร่วมงาน|ทีม|หุ้นส่วน|บริษัท|ผู้ใหญ่/.test(q));
    if (isFamilyTopic) {
      verdict = (outcomeTone === 'caution' || spreadTone === 'caution')
        ? `มุมของคนในบ้านตอนนี้คือเป็นห่วงและกังวลแทน${nick}มากกว่าจะไม่พอใจนะ แค่สื่อสารให้ชัดขึ้น`
        : `ฝั่งครอบครัวเปิดรับและพร้อมสนับสนุนอยู่แล้วนะ${nick} แค่เล่าความตั้งใจให้เห็นภาพตรงกัน`;
    } else if (isProTopic) {
      if (outcomeTone === 'caution' || spreadTone === 'caution') {
        verdict = `พูดกันตามตรงนะ${nick} ฝั่งนั้นยังมีจุดที่ติดใจหรือกังวลค้างอยู่ เลยยังไม่วางใจเต็มร้อย`;
      } else if (spreadTone === 'favorable' && outcomeTone === 'favorable') {
        verdict = midWarn
          ? `โดยรวมเขายอมรับผลงานของ${nick}อยู่นะ แค่ยังมีจุดที่อยากเห็นชัดขึ้นอีกนิดเลยยังไม่เทเต็มร้อย`
          : `เขามองในแง่ดีและเปิดรับทางฝั่ง${nick}ชัดเจน คุยเจรจากันตรงๆ ได้เลย`;
      } else {
        verdict = `ตอนนี้เขายังรอดูผลงานและประเมินเงื่อนไขอยู่นะ${nick} ไม่ได้ปฏิเสธแต่ก็ยังไม่เทคะแนนให้เต็มตัว`;
      }
    } else if (outcomeTone === 'caution' || spreadTone === 'caution') {
      verdict = `พูดกันตามตรงนะ${nick} ตอนนี้เขายังมีกำแพงและความกังวลซ่อนอยู่ในใจ ยังไม่พร้อมเปิดเต็มร้อย`;
    } else if (spreadTone === 'favorable' && outcomeTone === 'favorable') {
      verdict = midWarn
        ? `เขามีใจและรู้สึกดีกับ${nick}จริง แค่ยังมีเรื่องกังวลติดใจอยู่หน่อยเลยดูไม่สุดในบางจังหวะ`
        : `เขาจริงใจและรู้สึกดีกับ${nick}ชัดเจน เปิดใจอยากพัฒนาความสัมพันธ์ตรงๆ เลย`;
    } else {
      verdict = `ตอนนี้เขายังรอดูท่าทีและชั่งใจอยู่${nick} ไม่ได้ตัดใจแต่ก็ยังไม่พุ่งเข้ามาเต็มตัว`;
    }
  } else if (intent === 'outcome') {
    verdict = (spreadTone === 'favorable' && outcomeTone !== 'caution')
      ? `มีโอกาสสำเร็จสูงเลยนะ${nick} จังหวะเปิดรับความตั้งใจของ${nick}อยู่แล้ว`
      : (spreadTone === 'caution' || outcomeTone === 'caution')
        ? `ถ้าใช้วิธีเดิมมีเกณฑ์สะดุดสูงนะ${nick} ต้องแก้จุดที่ไพ่เตือนก่อนถึงจะผ่าน`
        : `โอกาสยังออก 50/50 นะ${nick} อยู่ที่ความสม่ำเสมอและการคุมจังหวะของ${nick}เอง`;
  } else if (intent === 'timing') {
    verdict = `เรื่องจังหวะเวลาที่${nick}ถาม: ${estimateTimingFromCard(outcomeCard, 'th')}`;
  } else if (intent === 'why') {
    verdict = pickFreshVariant([
      `ถ้าถามว่าเรื่องนี้ติดอยู่ตรงไหน ปมสำคัญสะท้อนชัดผ่านไพ่ชุดนี้เลยนะ${nick}`,
      `ต้นตอที่ทำให้เรื่องนี้ค้างคา โผล่ชัดอยู่ในหน้าไพ่รอบนี้เลยนะ${nick}`,
      `จุดที่สะดุดจริงไม่ได้อยู่ที่โชค แต่อยู่ตรงรายละเอียดในไพ่ชุดนี้แหละ${nick}`
    ], turnSeed, recentTexts);
  } else if (intent === 'action') {
    verdict = pickFreshVariant([
      `ถ้าถามว่าควรขยับยังไงต่อดี ลองดูมุมจากหน้าไพ่ที่เปิดมาตรงนี้เลยนะ${nick}`,
      `แนวทางรับมือที่คุมความเสี่ยงได้จริงตอนนี้ เปิดชัดผ่านไพ่ชุดนี้แล้วนะ${nick}`,
      `วิธีเดินต่อให้ไม่เสียเปรียบในจังหวะนี้ ไพ่ชี้หมุดไว้ตรงๆ เลย${nick}`
    ], turnSeed, recentTexts);
  } else {
    const explainTone = (spreadTone === 'favorable' && outcomeTone !== 'caution')
      ? 'favorable'
      : (spreadTone === 'caution' || outcomeTone === 'caution') ? 'caution' : 'balanced';
    const explainTh = {
      study: {
        favorable: `เรื่องเรียนหรือการสอบช่วงนี้หัวแล่นและจับจุดได้ตรงทางเลยนะ${nick}`,
        caution: `เรื่องเรียนและสอบช่วงนี้ยังประมาทจุดอ่อนไม่ได้นะ${nick} ทวนเนื้อหาที่ยังไม่แม่นก่อนเลย`,
        balanced: `เรื่องเรียนช่วงนี้เน้นความสม่ำเสมอทีละนิดจะเห็นผลชัดกว่าโหมอัดทีเดียวนะ${nick}`
      },
      health: {
        favorable: `ด้านร่างกายและพลังงานช่วงนี้เริ่มฟื้นตัวดีขึ้นนะ${nick} แค่รักษาเวลาพักผ่อนให้สม่ำเสมอ`,
        caution: `เรื่องสุขภาพเตือนชัดว่าอย่านอนดึกหรือฝืนร่างกายเกินไปนะ${nick} ถ้ามีอาการเรื้อรังควรพบหมอตรวจจริงควบคู่ไปด้วย`,
        balanced: `ด้านสุขภาพช่วงนี้โฟกัสที่การพักผ่อนและจังหวะชีวิตให้สมดุลก่อนเป็นหลักนะ${nick}`
      },
      family: {
        favorable: `บรรยากาศในครอบครัวช่วงนี้อบอุ่นและคุยเข้าใจกันง่ายขึ้นนะ${nick}`,
        caution: `เรื่องในครอบครัวช่วงนี้มีความห่วงใยปนความกังวลซ่อนอยู่นะ${nick} ฟังกันให้จบแต่อย่าเก็บทุกอย่างมาแบกคนเดียว`,
        balanced: `ด้านครอบครัวช่วงนี้ค่อยๆ คุยด้วยความใจเย็นและเว้นระยะพอดีจะสบายใจทั้งสองฝ่ายนะ${nick}`
      },
      property: {
        favorable: `เรื่องบ้าน ที่อยู่อาศัย หรือรถช่วงนี้มีเกณฑ์เจอตัวเลือกที่ลงตัวเลยนะ${nick}`,
        caution: `เรื่องซื้อเช่าบ้าน รถ หรือการย้ายที่อยู่รอบนี้ต้องเช็กสัญญาและค่าใช้จ่ายแฝงให้ละเอียดก่อนเซ็นนะ${nick}`,
        balanced: `เรื่องบ้านหรือรถตอนนี้ค่อยๆ เทียบทำเลและงบให้ลงตัวก่อนตัดสินใจจริงนะ${nick}`
      },
      work: {
        favorable: `เรื่องงานต่อจากนี้ทิศทางเปิดให้เดินหน้าได้ชัดขึ้นเลยนะ${nick}`,
        caution: `ถ้าดูเรื่องงานต่อจากนี้เลยนะ${nick} ยังมีจุดต้องระวังและเช็กข้อมูลให้ชัวร์ก่อนตัดสินใจใหญ่`,
        balanced: `เรื่องงานช่วงนี้กำลังปรับจังหวะนะ${nick} ต้องค่อยๆ ประคองและจัดลำดับความสำคัญให้ดี`
      },
      money: {
        favorable: `เรื่องเงินช่วงนี้ทิศทางคล่องตัวและเห็นโอกาสชัดขึ้นนะ${nick}`,
        caution: `เรื่องเงินช่วงนี้ต้องคุมกระเป๋าและเช็กตัวเลขให้ชัวร์นะ${nick} อย่าเพิ่งทุ่มก้อนใหญ่แบบรีบร้อน`,
        balanced: `เรื่องเงินช่วงนี้พอหมุนประคองได้นะ${nick} แค่วางกรอบรับจ่ายให้ชัดอย่าปล่อยไหลตามใจ`
      },
      love: {
        favorable: `เรื่องความสัมพันธ์ช่วงนี้เปิดรับและคุยกันเข้าใจง่ายขึ้นเลยนะ${nick}`,
        caution: `เรื่องความสัมพันธ์ตอนนี้ยังมีปมไม่ชัดหรือความกังวลซ่อนอยู่นะ${nick} อย่าเพิ่งด่วนตัดสินตอนใจไม่นิ่ง`,
        balanced: `เรื่องความสัมพันธ์ช่วงนี้ต้องค่อยๆ ปรับจูนกันไปทีละนิดนะ${nick} อย่ารีบเร่งคำตอบเกินจังหวะ`
      },
      self: {
        favorable: `ด้านชีวิตส่วนตัวและคนใกล้ชิดช่วงนี้จังหวะนิ่งและมีแรงหนุนดีนะ${nick}`,
        caution: `เรื่องส่วนตัวและคนใกล้ตัวตอนนี้เตือนให้ถนอมใจตัวเองก่อนนะ${nick} อย่าแบกทุกความคาดหวังไว้คนเดียว`,
        balanced: `ด้านชีวิตส่วนตัวและคนรอบข้างช่วงนี้ค่อยๆ จัดสมดุลใหม่จะเบาสบายขึ้นเยอะเลย${nick}`
      },
      general: {
        favorable: pickFreshVariant([
          `จากหน้าไพ่ชุดนี้ภาพรวมกำลังเปิดทางให้เดินหน้าได้ชัดเลยนะ${nick}`,
          `หน้าไพ่รอบนี้ส่งสัญญาณบวกให้${nick}ขยับตัวต่อได้มั่นใจขึ้นเลย`
        ], turnSeed, recentTexts),
        caution: pickFreshVariant([
          `จากหน้าไพ่ชุดนี้มีสัญญาณเตือนให้ชะลอและตั้งหลักดูความจริงก่อนจะฝืนไปต่อนะ${nick}`,
          `หน้าไพ่รอบนี้ทักตรงๆ ให้${nick}หยุดเช็กจุดเสี่ยงก่อนรีบตัดสินใจนะ`
        ], turnSeed, recentTexts),
        balanced: pickFreshVariant([
          `จากหน้าไพ่ชุดนี้สถานการณ์กำลังอยู่ในช่วงเปลี่ยนจังหวะนะ${nick} ค่อยๆ ประคองให้พอดี`,
          `จังหวะตรงหน้านี้กำลังหมุนปรับเข้าที่นะ${nick} แค่คุมสติและค่อยๆ เดินทีละขั้น`
        ], turnSeed, recentTexts)
      }
    };
    verdict = (explainTh[subDomain] || explainTh[topic] || explainTh.general)[explainTone];
    if (isBroadOpen) {
      verdict += ` บอกเพิ่มได้นะว่าโฟกัสงาน เงิน หรือรัก`;
    }
  }

  const cardStory = buildConnectedCardStory(refCards, topic, outcomeCard, outcomeTone, natalCard, nick, 'th', turnSeed, recentTexts, subDomain);
  const adviceText = actionAdvice || 'ตั้งหลักดูข้อมูลจริงตรงหน้าแล้วลงมือทีละขั้น';
  const fallbackPrefix = pickFreshVariant([
    `จังหวะนี้สติฝากไว้ตรงๆ นะ${nick} — `,
    `จุดลงมือที่ทำได้วันนี้เลยนะ${nick} — `,
    `โฟกัสสำคัญที่ไพ่ย้ำตอนนี้คือ — `,
    `ถ้าจะแก้เกมรอบนี้ให้คมขึ้นนะ${nick} — `,
    `ก้าวถัดไปที่${nick}คุมเองได้ทันที — `
  ], turnSeed, recentTexts);

  return assembleBalancedReply(verdict, cardStory, adviceText, subtext, psychMirror, fallbackPrefix, isRepeat, 'th');
}

export function buildDeckCarryoverSummary(state, lang = state?.lang || 'th') {
  const target = normalizeLang(lang);
  const hist = Array.isArray(state?.chatHistory) ? state.chatHistory : [];
  const scoped = typeof state?.deckResetAtIndex === 'number' ? hist.slice(state.deckResetAtIndex) : hist;
  const realQs = scoped
    .filter((h) => h && (h.role === 'user' || (!h.role && !['สติ', 'Sati', '思谛'].includes(h.speaker))) && !h.isDrawAction && !h.isExpandAction)
    .map((h) => String(h.text || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const uniqueQs = [...new Set(realQs)].slice(-3);
  const tailCards = (Array.isArray(state?.activeSpread) && state.activeSpread.length > 0 ? state.activeSpread : [])
    .slice(0, 3)
    .map((c) => getLocalizedCardShortName(c, target));
  const deckNo = Number(state?.deckNumber) || 1;
  if (target === 'en') {
    const qPart = uniqueQs.length ? `Topics explored: ${uniqueQs.join(' | ')}` : 'Completed natal + initial cycle';
    return `Deck #${deckNo} summary — ${qPart}${tailCards.length ? ` (last cards: ${tailCards.join(', ')})` : ''}`.slice(0, 220);
  }
  if (target === 'zh') {
    const qPart = uniqueQs.length ? `上一副探讨过：${uniqueQs.join(' | ')}` : '已完成上一副牌本轮推演';
    return `第 ${deckNo} 副牌总结——${qPart}${tailCards.length ? `（收尾牌：${tailCards.join('、')}）` : ''}`.slice(0, 220);
  }
  const qPart = uniqueQs.length ? `เรื่องที่คุยในสำรับ ${deckNo}: ${uniqueQs.join(' | ')}` : `จบสำรับที่ ${deckNo}`;
  return `${qPart}${tailCards.length ? ` (ไพ่ท้ายสำรับ: ${tailCards.join(', ')})` : ''}`.slice(0, 220);
}

const DOMAIN_SHORT_I18N = {
  work: { th: 'งาน', en: 'Work', zh: '事业' },
  money: { th: 'เงิน', en: 'Money', zh: '财运' },
  love: { th: 'รัก', en: 'Love', zh: '感情' },
  self: { th: 'ชีวิต/ตัวเอง', en: 'Self', zh: '个人' },
  study: { th: 'เรียน/สอบ', en: 'Study', zh: '学业' },
  health: { th: 'สุขภาพ', en: 'Health', zh: '健康' },
  family: { th: 'ครอบครัว', en: 'Family', zh: '家庭' },
  property: { th: 'บ้าน/รถ', en: 'Property', zh: '置业' },
  general: { th: 'ภาพรวม', en: 'General', zh: '综合' }
};

/**
 * Digest the latest 2-3 archived sessions into a compact cross-session continuity note (<= 240 chars).
 */
export function buildCrossSessionMemorySummary(sessionArchives = [], lang = 'th') {
  if (!Array.isArray(sessionArchives) || sessionArchives.length === 0) return '';
  const target = normalizeLang(lang);
  const hasTs = sessionArchives.some((s) => Number.isFinite(Date.parse(s?.endedAt)));
  const ordered = hasTs
    ? [...sessionArchives].sort((a, b) => (Date.parse(b?.endedAt || '') || 0) - (Date.parse(a?.endedAt || '') || 0))
    : [...sessionArchives];
  const recent = ordered.slice(0, 3);
  const nonReadingPattern = /(เราชื่อสติ\s+เดี๋ยวรอบแรกนี้หยิบไพ่มา\s*10|ล้างไพ่ใหม่พร้อมแล้ว|ตอนนี้หยิบได้\s+\d+|คลิกไพ่ที่อยากถาม|Now pick 3 cards|Pick 10 cards first|请先抽取|已选\s*\d+\s*张)/i;

  const items = [];
  for (const sess of recent) {
    if (!sess || typeof sess !== 'object') continue;
    const hist = Array.isArray(sess.chatHistory) ? sess.chatHistory : [];
    const userMsgs = hist
      .filter((h) => h && (h.role === 'user' || (!h.role && !['สติ', 'Sati', '思谛'].includes(h.speaker))) && !h.isDrawAction && !h.isExpandAction)
      .map((h) => String(h.text || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const satiMsgs = hist.filter(
      (h) => h && (h.role === 'sati' || ['สติ', 'Sati', '思谛'].includes(h.speaker)) && !h.meta?.isGreeting && !nonReadingPattern.test(String(h.text || ''))
    );

    const lastQ = userMsgs[userMsgs.length - 1] || '';
    const lastSati = satiMsgs[satiMsgs.length - 1] || null;
    const { topic, subDomain } = lastQ ? detectTopicAndIntent(lastQ, '') : { topic: 'general', subDomain: 'general' };
    const domainKey = DOMAIN_SHORT_I18N[subDomain] ? subDomain : (DOMAIN_SHORT_I18N[topic] ? topic : 'general');
    const domainLabel = DOMAIN_SHORT_I18N[domainKey][target];

    let headCard = null;
    const satiWithCards = [...satiMsgs].reverse().find((m) => Array.isArray(m?.meta?.cards) && m.meta.cards.length > 0);
    if (satiWithCards) {
      const hydrated = hydrateDeckCards(satiWithCards.meta.cards);
      headCard = hydrated[hydrated.length - 1] || null;
    } else if (lastSati?.text) {
      const extracted = extractCardsInOrder(lastSati.text);
      headCard = extracted[extracted.length - 1] || null;
    } else if (Array.isArray(sess.natalCards) && sess.natalCards.length > 0) {
      const natal = hydrateDeckCards(sess.natalCards);
      headCard = natal[natal.length - 1] || natal[0] || null;
    }

    const cardShort = headCard
      ? `${getLocalizedCardShortName(headCard, target)}${headCard.reversed ? formatCardOrientationBadge(headCard, target) : ''}`
      : '';
    const qSnippet = lastQ ? `${lastQ.slice(0, 22)}${lastQ.length > 22 ? '...' : ''}` : '';
    const rawTakeaway = String(lastSati?.text || '').replace(/\s+/g, ' ').trim();
    const takeawaySnippet = rawTakeaway ? `${rawTakeaway.slice(0, 26)}${rawTakeaway.length > 26 ? '...' : ''}` : '';

    if (!qSnippet && !cardShort && !takeawaySnippet) continue;

    if (target === 'en') {
      const detail = [qSnippet && `"${qSnippet}"`, cardShort || takeawaySnippet].filter(Boolean).join(' -> ');
      items.push(`${domainLabel}: ${detail}`);
    } else if (target === 'zh') {
      const detail = [qSnippet, cardShort || takeawaySnippet].filter(Boolean).join('→');
      items.push(`${domainLabel}（${detail}）`);
    } else {
      const detail = [qSnippet && `"${qSnippet}"`, cardShort || takeawaySnippet].filter(Boolean).join(' -> ');
      items.push(`${domainLabel}(${detail})`);
    }
  }

  if (items.length === 0) return '';
  const prefix = target === 'en' ? 'Past sessions: ' : target === 'zh' ? '近期记录：' : 'รอบก่อนหน้า: ';
  const sep = target === 'zh' ? '；' : ' ; ';
  let out = prefix;
  for (let i = 0; i < items.length; i += 1) {
    const candidate = i === 0 ? `${prefix}${items[i]}` : `${out}${sep}${items[i]}`;
    if (candidate.length <= 240) {
      out = candidate;
    } else if (i === 0) {
      return `${candidate.slice(0, 237)}...`;
    } else {
      break;
    }
  }
  return out;
}

async function consumeSatiSseStream(res, onChunk) {
  if (!res?.ok || !res.body || typeof res.body.getReader !== 'function') {
    return null;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';
  let currentModel = '';
  let finalReply = null;
  let sawFallback = false;

  const processFrame = (rawFrame) => {
    const normalized = rawFrame.replace(/\r\n/g, '\n');
    if (!normalized.trim()) return;
    let eventName = 'message';
    const dataLines = [];
    for (const line of normalized.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart());
      }
    }
    if (dataLines.length === 0) return;
    let payload = null;
    try {
      payload = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    if (eventName === 'meta') {
      if (payload?.model) currentModel = String(payload.model);
    } else if (eventName === 'chunk') {
      if (typeof payload?.text === 'string' && payload.text.length > 0) {
        accumulatedText += payload.text;
        onChunk(accumulatedText, { model: payload?.model || currentModel });
      }
    } else if (eventName === 'done') {
      if (payload && !payload.fallback && typeof payload.reply === 'string' && payload.reply.trim()) {
        finalReply = {
          reply: payload.reply,
          model: payload.model || currentModel || ''
        };
      } else {
        sawFallback = true;
      }
    } else if (eventName === 'fallback') {
      sawFallback = true;
    }
  };

  const findFrameBoundary = (str) => {
    const lfIdx = str.indexOf('\n\n');
    const crlfIdx = str.indexOf('\r\n\r\n');
    if (lfIdx === -1 && crlfIdx === -1) return null;
    if (lfIdx !== -1 && (crlfIdx === -1 || lfIdx <= crlfIdx)) {
      return { index: lfIdx, len: 2 };
    }
    return { index: crlfIdx, len: 4 };
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep;
      while ((sep = findFrameBoundary(buffer)) !== null) {
        const frame = buffer.slice(0, sep.index);
        buffer = buffer.slice(sep.index + sep.len);
        processFrame(frame);
        if (sawFallback || finalReply) break;
      }
      if (sawFallback || finalReply) break;
    }
    if (!sawFallback && !finalReply) {
      buffer += decoder.decode();
      let sep;
      while ((sep = findFrameBoundary(buffer)) !== null) {
        const frame = buffer.slice(0, sep.index);
        buffer = buffer.slice(sep.index + sep.len);
        processFrame(frame);
      }
      if (!sawFallback && !finalReply && buffer.trim()) {
        processFrame(buffer);
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // ignore cancel errors
    }
  }

  return (!sawFallback && finalReply) ? finalReply : null;
}

/**
 * Call Gemini Proxy (`/api/sati/read/stream` or `/api/sati/read`) with automatic localized Offline Fallback
 */
export async function requestSatiReading(state, question, rawCards, isNatal10 = false, extra = {}) {
  const lang = normalizeLang(state.lang);
  const cards = hydrateDeckCards(rawCards);
  const natalCards = hydrateDeckCards(state.natalCards);
  const qText = isNatal10
    ? 'เปิดไพ่พื้นดวง 10 ใบแรกเชื่อมกับชื่อจริง นามสกุล ชื่อเล่น และวันเดือนปีเกิด'
    : question;
  const questionProfile = isNatal10
    ? { topic: 'self', subDomain: 'self', intent: 'explain', isBroadOpen: false }
    : detectTopicAndIntent(qText, state.lastTopic);
  const hist = Array.isArray(state.chatHistory) ? state.chatHistory : [];
  const scopedHist = typeof state.deckResetAtIndex === 'number' ? hist.slice(state.deckResetAtIndex) : hist;
  const userFacts = extractUserContextFacts(hist, state.userContextFacts);
  state.userContextFacts = userFacts;
  const fallbackReply = isNatal10
    ? buildNatal10Reading(state, cards)
    : synthesizeDeepReply(state, question, cards);

  const spreadPatterns = analyzeSpreadPatterns(cards, lang);
  const pastSessionMemory = buildCrossSessionMemorySummary(state?.sessionArchives || [], lang);

  const requestBody = {
    lang,
    userProfile: state.user,
    natalCards,
    activeSpread: cards,
    cards,
    remainingCount: Array.isArray(state?.remainingDeck) ? state.remainingDeck.length : 0,
    elementalDignity: computeElementalDignityInsight(cards, lang),
    spreadPatterns,
    pastSessionMemory,
    isNatal10,
    celticPositions: getLocalizedCelticPositions(lang),
    deckNumber: Number(state.deckNumber) || 1,
    deckCarryoverSummary: state.deckCarryoverSummary || '',
    questionProfile,
    userFacts,
    topicSwitchedFrom: extra?.topicSwitchedFrom || '',
    isExpandFollowUp: Boolean(extra?.isExpandFollowUp),
    question: qText,
    recentHistory: scopedHist.slice(-6)
  };

  const fetchInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    ...(extra?.signal ? { signal: extra.signal } : {})
  };

  if (typeof extra?.onChunk === 'function' && typeof ReadableStream !== 'undefined') {
    try {
      const streamRes = await fetch('/api/sati/read/stream', fetchInit);
      const streamed = await consumeSatiSseStream(streamRes, extra.onChunk);
      if (streamed?.reply) {
        state.lastReadingOffline = false;
        state.lastReadingModel = streamed.model || '';
        return streamed.reply;
      }
    } catch {
      // Network/stream failure falls back seamlessly to /api/sati/read -> offline
    }
  }

  try {
    const res = await fetch('/api/sati/read', fetchInit);
    if (!res.ok) {
      state.lastReadingOffline = true;
      state.lastReadingModel = 'offline-thaksa';
      return fallbackReply;
    }
    const data = await res.json();
    if (data && !data.fallback && data.reply) {
      state.lastReadingOffline = false;
      state.lastReadingModel = data.model || '';
      return data.reply;
    }
  } catch {
    // Offline or local static preview -> use local Thaksa synthesis seamlessly
  }
  state.lastReadingOffline = true;
  state.lastReadingModel = 'offline-thaksa';
  return fallbackReply;
}

const BREAKDOWN_COPY = {
  polarity: {
    favorable: { th: 'หนุนทางเปิด', en: 'Supportive', zh: '顺势助力' },
    balanced: { th: 'กลาง · คุมจังหวะ', en: 'Balanced · Steady', zh: '中性 · 稳节奏' },
    caution: { th: 'เตือนให้ระวัง', en: 'Caution Signal', zh: '警示提醒' }
  },
  suitHint: {
    Major: { th: 'ไพ่ใหญ่ (จุดเปลี่ยนสำคัญที่มีน้ำหนักระยะยาว)', en: 'Major Arcana (lasting turning point)', zh: '大阿卡纳（影响深远的关键转折）' },
    Wands: { th: 'ธาตุไฟ · ไม้เท้า (แรงผลัก การลงมือ และจังหวะลุย)', en: 'Wands · Fire (drive, momentum, and action)', zh: '权杖 · 火元素（行动力与推进力）' },
    Cups: { th: 'ธาตุน้ำ · ถ้วย (ความรู้สึก จิตใจ และคนเกี่ยวข้อง)', en: 'Cups · Water (feelings and human dynamics)', zh: '圣杯 · 水元素（情感体验与人际互动）' },
    Swords: { th: 'ธาตุลม · ดาบ (ความคิด การตัดสินใจ และความจริงตรงหน้า)', en: 'Swords · Air (analysis, choices, and plain truth)', zh: '宝剑 · 风元素（思维判断与沟通事实）' },
    Pentacles: { th: 'ธาตุดิน · เหรียญ (ตัวเลข เงินจริง และผลงานจับต้องได้)', en: 'Pentacles · Earth (real numbers, cash flow, stability)', zh: '星币 · 土元素（真实收益与稳步落地）' }
  },
  topicLabel: {
    work: { th: 'มุมการงานและโอกาสเติบโต', en: 'Work & Career Angle', zh: '事业与推进维度' },
    money: { th: 'มุมการเงินและผลตอบแทน', en: 'Money & Return Angle', zh: '财运与收益维度' },
    love: { th: 'มุมความสัมพันธ์และความรู้สึก', en: 'Relationship & Feelings Angle', zh: '感情与关系维度' },
    self: { th: 'มุมเป้าหมายชีวิตและตัวตน', en: 'Life Path & Self Angle', zh: '自我状态与目标维度' },
    general: { th: 'แกนความหมายหลักของไพ่', en: 'Core Card Meaning', zh: '牌面核心指向' }
  },
  spreadRole: {
    single: { th: 'คำตอบหลักตรงคำถาม', en: 'Direct Answer Card', zh: '核心回应牌' },
    pair: {
      th: ['ใบที่ 1 · จุดตั้งต้นของเรื่อง', 'ใบที่ 2 · ตัวแปรและคำตอบปิดท้าย'],
      en: ['Card 1 · Starting Point', 'Card 2 · Turning Factor & Close'],
      zh: ['第 1 张 · 当前起点', '第 2 张 · 转折与收尾回应']
    },
    trio: {
      th: ['ใบที่ 1 · จุดตั้งต้นสถานการณ์', 'ใบที่ 2 · ตัวเชื่อมตรงกลาง (แรงส่ง / แรงต้าน)', 'ใบที่ 3 · บทสรุปปลายทางที่ตอบคำถาม'],
      en: ['Card 1 · Starting Ground', 'Card 2 · Bridge & Friction', 'Card 3 · Outcome Answer'],
      zh: ['第 1 张 · 现状起点', '第 2 张 · 中段桥梁与变量', '第 3 张 · 最终落点回应']
    }
  }
};

let cachedCardMatchers = null;
function getCardMatchers() {
  if (cachedCardMatchers) return cachedCardMatchers;
  const fullDeck = buildFullDeck78();
  const entries = [];
  fullDeck.forEach((card) => {
    const zhShort = getLocalizedCardShortName(card, 'zh');
    [card.name, card.th, zhShort].forEach((alias) => {
      if (!alias) return;
      const clean = alias.trim();
      if (clean.length < 2) return;
      entries.push({ alias: clean, card, isAscii: /^[A-Za-z0-9\s'-]+$/.test(clean) });
    });
  });
  entries.sort((a, b) => b.alias.length - a.alias.length);
  cachedCardMatchers = entries;
  return entries;
}

function extractCardsInOrder(text) {
  if (!text) return [];
  const matchers = getCardMatchers();
  const claimed = [];
  const hits = [];

  for (const { alias, card, isAscii } of matchers) {
    let searchFrom = 0;
    while (searchFrom < text.length) {
      const idx = text.indexOf(alias, searchFrom);
      if (idx === -1) break;
      const end = idx + alias.length;
      const overlaps = claimed.some(([s, e]) => idx < e && end > s);
      let validBoundary = true;
      if (!overlaps && isAscii) {
        const prev = idx > 0 ? text[idx - 1] : '';
        const next = end < text.length ? text[end] : '';
        if (/[A-Za-z]/.test(prev) || /[A-Za-z]/.test(next)) validBoundary = false;
      } else if (!overlaps && alias.length <= 3) {
        const prev = idx > 0 ? text[idx - 1] : '';
        const next = end < text.length ? text[end] : '';
        if (/[\u0E00-\u0E7F]/.test(prev) || /[\u0E00-\u0E7F]/.test(next)) validBoundary = false;
      }
      if (!overlaps && validBoundary) {
        claimed.push([idx, end]);
        const tailProbe = text.slice(end, end + 28);
        const isRev = /^\s*(?:\([^)]*\)\s*)?\[(?:กลับหัว|Rev\.|逆位)\]/i.test(tailProbe);
        hits.push({ idx, card: isRev ? { ...card, reversed: true } : card });
        break;
      }
      searchFrom = idx + 1;
    }
  }

  hits.sort((a, b) => a.idx - b.idx);
  const unique = [];
  const seen = new Set();
  for (const h of hits) {
    if (!seen.has(h.card.uid)) {
      seen.add(h.card.uid);
      unique.push(h.card);
    }
  }
  return hydrateDeckCards(unique);
}

function buildWhyCardSpeaksReason(card, posLabel, roleIndex, totalCount, isNatal10, topic, polarity, lang) {
  const data = getLocalizedCardData(card, lang);
  const suitDesc = BREAKDOWN_COPY.suitHint[card.suit]?.[lang] || BREAKDOWN_COPY.suitHint.Major[lang];
  const topicDesc = BREAKDOWN_COPY.topicLabel[topic]?.[lang] || BREAKDOWN_COPY.topicLabel.general[lang];
  const coreClean = (data.core || '').replace(/[.。]+$/, '');
  const revNuance = data.reversedNuance || '';

  if (lang === 'en') {
    const toneClause = polarity === 'favorable'
      ? 'adds upward momentum and clears resistance'
      : polarity === 'caution'
        ? 'raises a deliberate red flag so you verify before pushing'
        : 'keeps the weight balanced and puts control in your discipline';
    const roleLine = isNatal10
      ? `Seated at "${posLabel}", this card frames that exact pillar of your natal baseline.`
      : totalCount === 1
        ? `As your sole direct card, it concentrates the whole answer around "${topicDesc}".`
        : roleIndex === 0
          ? 'At Position 1 (Starting Ground), it reveals where this question begins underneath the surface.'
          : roleIndex === totalCount - 1
            ? 'Closing in the final slot, it shows how the trajectory resolves when you act on this.'
            : 'Sitting in the middle bridge, it acts as the pivot between your starting point and outcome.';
    const revNote = revNuance ? ` Drawn reversed: ${revNuance}` : '';
    return `${suitDesc} — this energy ${toneClause}. ${roleLine} Applied to ${topicDesc.toLowerCase()}, "${coreClean}" translates directly into what you need to see here.${revNote}`;
  }

  if (lang === 'zh') {
    const toneClause = polarity === 'favorable'
      ? '带来明显顺势助力与破局空间'
      : polarity === 'caution'
        ? '明确给出踩刹车与核实细节的信号'
        : '呈现中性权衡格局，成败取决于个人节奏把握';
    const roleLine = isNatal10
      ? `它落在“${posLabel}”这一本命关键位，直接定调你在该领域的底层走势。`
      : totalCount === 1
        ? `作为单张直答牌，它把全部重点聚焦在你的“${topicDesc}”上。`
        : roleIndex === 0
          ? '落在第 1 张起点位，点明这件事当下的真实起手状态与心理底色。'
          : roleIndex === totalCount - 1
            ? '压轴落在最终收尾位，直接决定这轮问题往哪个结果收束。'
            : '处于中段过渡桥梁位，起到连接起点与结果的关键杠杆作用。';
    const revNote = revNuance ? ` 逆位提醒：${revNuance}` : '';
    return `${suitDesc}，这股牌象正${toneClause}。${roleLine}紧扣“${topicDesc}”，核心意象“${coreClean}”因此正好对应到你的问题上。${revNote}`;
  }

  const toneClause = polarity === 'favorable'
    ? 'เปิดแรงส่งด้านบวกและช่วยคลายจุดติดขัด'
    : polarity === 'caution'
      ? 'ส่งสัญญาณเตือนตรงๆ ให้ตั้งหลักเช็กความเสี่ยงก่อนขยับ'
      : 'ให้พลังงานสมดุลที่ผลลัพธ์ขึ้นกับการคุมจังหวะของเจ้าชะตาเอง';
  const roleLine = isNatal10
    ? `เมื่อวางอยู่ในตำแหน่ง "${posLabel}" ของพื้นดวง 10 ใบ จึงสะท้อนภาพจริงในมิตินั้นโดยตรง`
    : totalCount === 1
      ? `ในฐานะไพ่ใบเดียวที่เปิดตอบคำถาม จุดโฟกัสจึงรวมอยู่ที่${topicDesc}`
      : roleIndex === 0
        ? 'เมื่อขึ้นเป็นใบที่ 1 (จุดตั้งต้น) จึงชี้รากของสถานการณ์และสิ่งที่ติดตัวมาก่อนหน้า'
        : roleIndex === totalCount - 1
          ? 'เมื่อมาปิดเป็นใบสุดท้าย (ปลายทางคำตอบ) จึงเป็นตัวฟันธงบทสรุปของเรื่องนี้ตรงๆ'
          : 'เมื่อวางอยู่ตรงกลาง จึงทำหน้าที่เป็นตัวเชื่อมและจุดเปลี่ยนระหว่างจุดเริ่มต้นกับผลลัพธ์ปลายทาง';
  const revNote = revNuance ? ` (หน้าไพ่กลับหัว: ${revNuance})` : '';
  return `ไพ่ใบนี้คือ${suitDesc} ซึ่ง${toneClause} — ${roleLine} เมื่อนำมาจับกับ${topicDesc} ภาพของ "${coreClean}" เลยแปลออกมาตรงกับคำถามนี้พอดี${revNote}`;
}

function buildDetailedConnectionText(primaryCards, isNatal10, question, topic, intent, user, natalCard, nick, lang) {
  if (!primaryCards.length) return '';
  const refCards = primaryCards.map((item) => item.card);
  const outcomeItem = primaryCards[primaryCards.length - 1];
  const outcomeTone = outcomeItem.polarity;
  const spreadTone = computeSpreadScore(refCards);
  const storyLine = isNatal10
    ? (() => {
        const [p0, p1, p4, p5, p9] = [primaryCards[0], primaryCards[1], primaryCards[2], primaryCards[3], outcomeItem];
        if (lang === 'en') {
          return `${p0?.title || ''} sets your present footing while ${p1?.title || ''} marks the immediate friction. Work (${p4?.title || ''}) and finances (${p5?.title || ''}) pull together toward the final landing card ${p9?.title || ''}.`;
        }
        if (lang === 'zh') {
          return `${p0?.title || ''}定出当前基调，${p1?.title || ''}指出眼下阻力，工作线（${p4?.title || ''}）与财运线（${p5?.title || ''}）共同汇聚到收尾牌 ${p9?.title || ''}。`;
        }
        return `${p0?.title || ''} ตั้งฐานสถานการณ์ปัจจุบัน โดยมี ${p1?.title || ''} เป็นโจทย์ที่ต้องแก้ ส่วนแกนงาน (${p4?.title || ''}) และเงิน (${p5?.title || ''}) วิ่งมาบรรจบกันที่ไพ่สรุป ${p9?.title || ''}`;
      })()
    : buildConnectedCardStory(refCards, topic, outcomeItem.card, outcomeTone, natalCard, nick, lang);

  const subtextNote = !isNatal10 ? buildSubtextHook(intent, topic, false, nick, lang).deepSubtext : '';
  const psychNote = buildPsychMirrorClause(user, refCards, spreadTone, nick, lang).deep;
  const synergyNote = analyzeCardElementalSynergy(refCards, lang);
  const patternNote = analyzeSpreadPatterns(refCards, lang);
  const dignityNote = computeElementalDignityInsight(refCards, lang);
  const qEcho = question
    ? (lang === 'en'
        ? `Tied back to your question "${question}": `
        : lang === 'zh'
          ? `回到你问的“${question}”：`
          : `เชื่อมเข้าคำถาม "${question}": `)
    : '';
  return [qEcho + storyLine, subtextNote, psychNote, synergyNote, patternNote, dignityNote].filter(Boolean).join('\n\n');
}

/**
 * Build structured, localized 3-part card breakdown for Chat History (`⋯`) drawer
 */
export function buildReadingBreakdown(entry, prevUserText = '', state = {}, deckCards = []) {
  const text = (entry?.text || '').trim();
  const nonReadingPattern = /(เราชื่อสติ\s+เดี๋ยวรอบแรกนี้หยิบไพ่มา\s*10|ล้างไพ่ใหม่พร้อมแล้ว|ตอนนี้หยิบได้\s+\d+|คลิกไพ่ที่อยากถาม|Now pick 3 cards|Pick 10 cards first|请先抽取|已选\s*\d+\s*张)/i;
  if (!text || entry?.meta?.isGreeting || (nonReadingPattern.test(text) && !entry?.meta?.cards?.length)) {
    return { isReading: false };
  }

  const lang = normalizeLang(state.lang);
  const nick = state.user?.nickname || (lang === 'en' ? 'my friend' : lang === 'zh' ? '朋友' : 'เพื่อน');
  const question = (entry?.meta?.question ?? prevUserText ?? '').trim();
  const isNatal10 = Boolean(
    entry?.meta?.isNatal10
    || /จากไพ่\s*10\s*ใบ|Across the 10 cards|从你选出的这\s*10\s*张牌/i.test(text)
  );

  const natalHydrated = hydrateDeckCards(state.natalCards || []);
  const metaCards = entry?.meta?.cards?.length ? hydrateDeckCards(entry.meta.cards) : [];
  const { topic, intent } = isNatal10
    ? { topic: 'general', intent: 'explain' }
    : detectTopicAndIntent(question, state.lastTopic);

  const celticLabels = getLocalizedCelticPositions(lang);
  let fullSpreadCards = [];
  let primaryCards = [];

  const toDetailedItem = (card, posIndex, posLabel, cardTopic, totalCount, isCited = true, roleIdx = posIndex) => {
    const polarity = scoreCardPolarity(card);
    const data = getLocalizedCardData(card, lang);
    const revBadge = formatCardOrientationBadge(card, lang);
    return {
      card,
      posIndex,
      posLabel,
      polarity,
      polarityLabel: BREAKDOWN_COPY.polarity[polarity][lang],
      reversed: Boolean(card?.reversed),
      orientationTag: formatCardOrientationTag(card, lang),
      orientationBadge: revBadge,
      reversedNuance: data.reversedNuance,
      title: revBadge ? `${data.title} ${revBadge}` : data.title,
      coreMeaning: data.core,
      topicFocusLabel: BREAKDOWN_COPY.topicLabel[cardTopic]?.[lang] || BREAKDOWN_COPY.topicLabel.general[lang],
      topicMeaning: getCardMeaningForTopic(card, cardTopic, lang),
      advice: data.advice,
      whyReason: buildWhyCardSpeaksReason(card, posLabel, roleIdx, totalCount, isNatal10, cardTopic, polarity, lang),
      isCited
    };
  };

  if (isNatal10) {
    const source10 = metaCards.length === 10
      ? metaCards
      : natalHydrated.length === 10
        ? natalHydrated
        : extractCardsInOrder(text.split(/\n\s*\n/).slice(1).join('\n\n') || text);
    if (!source10.length) return { isReading: false };

    const coreNatalIndices = [0, 1, 4, 5, 9];
    const bodyAfterP1 = text.split(/\n\s*\n/).slice(1).join('\n\n') || text;
    const textMatched = extractCardsInOrder(bodyAfterP1);
    const textUids = new Set(textMatched.map((c) => c.uid));
    const topicAtPos = (idx) => (idx === 4 ? 'work' : idx === 5 ? 'money' : idx === 7 ? 'love' : 'general');

    fullSpreadCards = source10.map((card, idx) => {
      const cited = source10.length === 10
        ? (coreNatalIndices.includes(idx) || textUids.has(card.uid))
        : true;
      const posLabel = source10.length === 10 && celticLabels[idx]
        ? `${idx + 1}. ${celticLabels[idx]}`
        : `${idx + 1}. ${getLocalizedCardShortName(card, lang)}`;
      return toDetailedItem(card, idx, posLabel, topicAtPos(idx), source10.length, cited, idx);
    });

    primaryCards = source10.length === 10
      ? fullSpreadCards.filter((item) => item.isCited)
      : fullSpreadCards;
  } else {
    const sourceWasNatal10 = Boolean(entry?.meta?.sourceWasNatal10 || metaCards.length === 10);
    let followCards = [];

    if (sourceWasNatal10) {
      const pool10 = metaCards.length === 10 ? metaCards : natalHydrated;
      const extracted = extractCardsInOrder(text);
      const selectedIdx = selectRelevantNatalIndices(topic, intent, question);
      const fallback3 = pool10.length === 10 ? selectedIdx.map((i) => pool10[i]).filter(Boolean) : [];
      followCards = extracted.length > 0 ? extracted : fallback3;
      const citedSet = new Set(followCards.map((c) => c.uid));
      fullSpreadCards = pool10.map((card, idx) => {
        const posLabel = celticLabels[idx] ? `${idx + 1}. ${celticLabels[idx]}` : `${idx + 1}`;
        return toDetailedItem(card, idx, posLabel, topic, pool10.length, citedSet.has(card.uid), idx);
      });
    } else {
      followCards = metaCards.length > 0 ? metaCards : extractCardsInOrder(text);
    }

    if (!followCards.length) return { isReading: false };

    const roleTable = followCards.length === 1
      ? [BREAKDOWN_COPY.spreadRole.single[lang]]
      : followCards.length === 2
        ? BREAKDOWN_COPY.spreadRole.pair[lang]
        : BREAKDOWN_COPY.spreadRole.trio[lang];

    primaryCards = followCards.map((card, i) => {
      const label = roleTable[i] || `${i + 1}`;
      return toDetailedItem(card, i, label, topic, followCards.length, true, i);
    });

    if (!fullSpreadCards.length) {
      fullSpreadCards = primaryCards;
    }
  }

  const outcomeCard = primaryCards[primaryCards.length - 1]?.card || fullSpreadCards[fullSpreadCards.length - 1]?.card;
  const natalCard = isNatal10 ? null : findMatchingNatalCard({ natalCards: natalHydrated }, topic, outcomeCard);
  const connectionText = buildDetailedConnectionText(primaryCards, isNatal10, question, topic, intent, state.user, natalCard, nick, lang);

  return {
    isReading: true,
    isNatal10,
    question,
    topic,
    intent,
    primaryCards,
    fullSpreadCards,
    connectionText
  };
}
