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
  getLocalizedCelticPositions
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
  return user;
}

function getCardMeaningForTopic(card, topic, lang = 'th') {
  if (!card) return '';
  const data = getLocalizedCardData(card, lang);
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

    const p2 = `Across the 10 cards you pulled, things right now sit on ${dPres.title} — ${dPres.core} Meanwhile, ${dObs.title} shows the friction crossing your path: ${dObs.core} For work, ${dGoal.title} highlights: ${dGoal.work} On money, ${dNear.title} adds: ${dNear.money}`;

    const advice = dOut.advice || dObs.advice || dGoal.advice;
    const outcomeLine = outcomeTone === 'caution'
      ? `Don’t force the pace blindly right now, ${nick}`
      : outcomeTone === 'favorable'
        ? `Momentum is genuinely opening up for you, ${nick}`
        : `How this lands comes down to steady balance, ${nick}`;
    const p3 = `All of this lands at ${dOut.title} — ${dOut.core} ${outcomeLine} — ${advice}`;

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

    const p2 = `从你选出的这 10 张牌来看，当下主轴落在 ${dPres.title}，${dPres.core} 眼前的关键阻力或变量在于 ${dObs.title}，${dObs.core} 事业上 ${dGoal.title} 显示${dGoal.work} 财运上 ${dNear.title} 则提醒${dNear.money}`;

    const advice = dOut.advice || dObs.advice || dGoal.advice;
    const outcomeLine = outcomeTone === 'caution'
      ? `现阶段先别急着硬冲，${nick}`
      : outcomeTone === 'favorable'
        ? `眼下顺势已经打开，${nick}`
        : `这段走势关键看你如何拿捏分寸，${nick}`;
    const p3 = `整体走向收在 ${dOut.title}，${dOut.core} ${outcomeLine}——${advice}`;

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

  const workVerb = scoreCardPolarity(cGoal) === 'caution' ? 'เตือนตรงๆ ว่า' : 'ชี้ว่า';
  const moneyVerb = scoreCardPolarity(cNear) === 'caution' ? 'ที่ต้องระวังตรงที่' : 'ซึ่ง';
  const p2 = `จากไพ่ 10 ใบที่${nick}เลือกขึ้นมา ตอนนี้เรื่องหลักอยู่ที่ ${cPresent.name} (${cPresent.th}) คือ${cPresent.core} โดยมีโจทย์ตรงหน้าผ่าน ${cObstacle.name} (${cObstacle.th}) ตรงที่${cObstacle.core} ส่วนเรื่องงานมี ${cGoal.name} (${cGoal.th}) ${workVerb}${getCardMeaningForTopic(cGoal, 'work')} ขณะที่เรื่องเงินมากับ ${cNear.name} (${cNear.th}) ${moneyVerb}${getCardMeaningForTopic(cNear, 'money')}`;

  const advice = cOutcome.advice || cObstacle.advice || cGoal.advice;
  const p3 = outcomeTone === 'caution'
    ? `ภาพรวมปลายทางไปจบที่ ${cOutcome.name} (${cOutcome.th}) ที่เตือนให้ระวังว่า${cOutcome.core} จังหวะนี้${nick}อย่าเพิ่งรีบฝืนดันนะ — ${advice}`
    : outcomeTone === 'favorable'
      ? `ภาพรวมปลายทางเปิดรับสวยที่ ${cOutcome.name} (${cOutcome.th}) ชี้ว่า${cOutcome.core} ทิศทางรอบนี้เป็นใจให้ค่อยๆ ไปต่อได้เลย — ${advice}`
      : `ภาพรวมปลายทางมาตกที่ ${cOutcome.name} (${cOutcome.th}) ซึ่งสะท้อนว่า${cOutcome.core} จุดชี้ขาดรอบนี้อยู่ที่การปรับสมดุลให้พอดี — ${advice}`;

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

export function detectTopicAndIntent(q, prevTopic) {
  let topic = prevTopic || 'general';
  if (/ความรัก|แฟน|คนคุย|จีบ|นอกใจ|ง้อ|เลิกกัน|ขอคืนดี|คบกัน|แต่งงาน|มีใจ|คิดถึง|รักเรา|จริงใจ|เนื้อคู่|คู่รัก|โสด|อกหัก|แอบชอบ|เขารู้สึก|เขาคิด|เธอรู|เค้าคิด|เค้ายัง|เขายัง|มีคนอื่น|love|romance|relationship|partner|crush|dating|marriage|feelings|his heart|her heart|ex\b|感情|爱情|恋爱|对象|另一半|暗恋|前任|分手|复合|喜欢我|在乎|婚姻/i.test(q)) {
    topic = 'love';
  } else if (/งาน|โปรเจกต์|เจ้านาย|หัวหน้า|ลูกน้อง|ทีม|ลูกค้า|ธุรกิจ|บริษัท|ออฟฟิศ|เรียน|สอบ|สมัครงาน|สัมภาษณ์|ลาออก|ย้ายงาน|เปลี่ยนงาน|เลื่อนขั้น|ทำแอป|ออกแบบ|เขียนโค้ด|รับเหมา|อาชีพ|work|job|career|project|boss|manager|team|client|business|company|office|study|exam|interview|resign|quit|promotion|startup|coding|工作|事业|项目|老板|上司|团队|客户|生意|公司|办公室|学习|考试|面试|辞职|跳槽|转行|升职|创业/i.test(q)) {
    topic = 'work';
  } else if (/การเงิน|เงิน|รายได้|รายรับ|รายจ่าย|ลงทุน|หนี้|ค้าขาย|ขายของ|ยอดขาย|ขายได้|ขายดี|กำไร|ต้นทุน|เงินทุน|ขาดทุน|ค่าใช้จ่าย|ร่ำรวย|จะรวย|ซื้อ|ผ่อน|เทรด|ทองคำ|ราคาทอง|เล่นหุ้น|หุ้น|เหรียญ|โบนัส|เงินเดือน|ช็อต|ตึงมือ|money|income|salary|revenue|expense|invest|debt|sales|profit|cost|capital|loss|wealth|rich|trade|gold|stock|crypto|bonus|cash|finance|budget|钱|财运|收入|工资|支出|花销|投资|负债|债务|销量|利润|成本|本金|亏损|发财|暴富|贷款|交易|黄金|股票|资金/i.test(q)) {
    topic = 'money';
  } else if (/รัก|เขา|เธอ/.test(q)) {
    topic = 'love';
  } else if (/สุขภาพ|เหนื่อย|ท้อ|เครียด|พักผ่อน|นอนไม่หลับ|หมดไฟ|สับสน|กดดัน|ตัวเอง|ชีวิต|ความฝัน|เป้าหมาย|health|tired|stressed|rest|insomnia|burnout|confused|pressure|myself|life\b|dream|goal|健康|累|疲惫|焦虑|压力|休息|失眠|迷茫|内耗|人生|梦想|目标/i.test(q)) {
    topic = 'self';
  }

  let intent = 'explain';
  if (/คิดยังไง|รู้สึกยังไง|จริงใจ|มองเรา|เขารู้สึก|กลับมาไหม|มีคนอื่นไหม|รักเรา|ชอบเรา|คิดถึง|how does he feel|how does she feel|feel about me|still love|come back|someone else|sincere|怎么看我|他怎么想|她怎么想|喜欢我吗|还爱我吗|真心吗|会不会回来|有别人吗/i.test(q)) intent = 'other_person';
  else if (/เมื่อไหร่|นานไหม|กี่เดือน|กี่วัน|กี่สัปดาห์|ช่วงไหน|เร็วๆ|ตอนไหน|ปีนี้|เดือนนี้|วันไหน|when\b|how long|how soon|which month|this year|this month|什么时候|多久|几个月|几天|几周|哪个月|今年|近期/i.test(q)) intent = 'timing';
  else if ((/หรือ(?!เปล่า|ป่าว|ปล่าว|ไม่|ยัง|ไหม|มั้ย|คะ|ครับ|นะ|$)/.test(q) && /(.{2,})\s*หรือ\s*(?!เปล่า|ป่าว|ปล่าว|ไม่|ยัง)(.{2,})/.test(q) && !/จริงใจกับเรา|รักเรา|ชอบเรา|คิดถึงเรา/.test(q))
    || /\s+or\s+/i.test(q)
    || /还是/.test(q)) intent = 'decision';
  else if (/ดีไหม|ควรไหม|เอาไง|เลือก|ระหว่าง|ไปต่อ|ลาออก|เสี่ยง|คุ้มไหม|ควรทำ|should i|worth it|choose|stay or go|quit|还是选|应该|好不好|值不值得|怎么选|要继续吗/i.test(q)) intent = 'decision';
  else if (/ทำยังไง|แก้ยังไง|เริ่มยังไง|ควรทำ|แนะนำ|ทางออก|รับมือ|ต้องระวังอะไร|แก้ตรงไหน|ยังไงดี|how should i|what should i do|advice|fix|handle|start|怎么办|怎么做|怎么解决|建议|需要注意|如何应对/i.test(q)) intent = 'action';
  else if (/ทำไม|เพราะอะไร|ติดอะไร|เกิดจาก|สาเหตุ|why\b|what is blocking|reason|cause|为什么|原因|卡在哪里|怎么会这样/i.test(q)) intent = 'why';
  else if (/สำเร็จไหม|รอดไหม|ได้ไหม|ได้มั้ย|สมหวังไหม|มีโอกาส.*?(?:ไหม|มั้ย|ป่าว|เปล่า|ปล่าว)|ได้หรือ(?:เปล่า|ป่าว|ปล่าว|ไม่)|เป็นไปได้ไหม|จะ.*?(?:ได้ไหม|ได้มั้ย|ได้ป่าว|ได้หรือเปล่า|ได้หรือป่าว|ได้หรือปล่าว)|เก็บเงิน.*?(?:ไหม|มั้ย|ป่าว|เปล่า)|ปังไหม|เวิร์คไหม|ผ่านไหม|ดีขึ้นไหม|จะดีไหม|will it work|will i succeed|chances|possible|achieve|pass|improve|能成吗|顺利吗|有机会吗|做得到吗|实现吗|会变好吗|过得去吗/i.test(q)) intent = 'outcome';

  return { topic, intent };
}

export function scoreCardPolarity(card) {
  if (card?.tone === 'warn') return 'caution';
  if (card?.tone === 'good') return 'favorable';
  if (card?.tone === 'neutral') return 'balanced';
  const challenging = ['The Devil', 'The Tower', 'The Moon', 'The Hanged Man', 'Death', 'Three of Swords', 'Five of', 'Seven of', 'Eight of Swords', 'Nine of Swords', 'Ten of Swords', 'Ten of Wands'];
  const strongPositive = ['The Sun', 'The Star', 'The World', 'The Magician', 'The Chariot', 'Wheel of Fortune', 'Ace of', 'Three of Pentacles', 'Six of Wands', 'Nine of Pentacles', 'Ten of Cups', 'Ten of Pentacles', 'King of', 'Queen of'];
  if (challenging.some((k) => card.name.includes(k))) return 'caution';
  if (strongPositive.some((k) => card.name.includes(k))) return 'favorable';
  return 'balanced';
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

function buildConnectedCardStory(refCards, topic, outcomeCard, outcomeTone, natalCard, nick, lang) {
  const lbl = (c) => getLocalizedCardLabelInline(c, lang);
  const mean = (c) => getCardMeaningForTopic(c, topic, lang);
  let story = '';

  if (refCards.length === 1) {
    const c0 = refCards[0];
    if (lang === 'en') story = `The card on the table is ${lbl(c0)} — ${mean(c0)}`;
    else if (lang === 'zh') story = `眼下这张${lbl(c0)}说得很直白：${mean(c0)}`;
    else story = `ไพ่ที่หยิบขึ้นมาคือ ${lbl(c0)} ซึ่งสะท้อนเรื่องนี้ตรงๆ ว่า${mean(c0)}`;
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
      if (p1 === 'favorable' && p2 === 'caution') story = `${lbl(c0)} sets the tone (${stripEnEnd(mean(c0))}). While ${lbl(c1)} tempts you to move fast (${stripEnEnd(mean(c1))}), ${lbl(c2)} cautions at the close: ${mean(c2)}`;
      else if (p1 === 'caution' && p2 === 'favorable') story = `${lbl(c0)} opens well (${stripEnEnd(mean(c0))}), and despite ${lbl(c1)} causing friction (${stripEnEnd(mean(c1))}), everything clears at ${lbl(c2)}: ${mean(c2)}`;
      else if (p2 === 'caution') story = `${lbl(c0)} shows where things sit (${stripEnEnd(mean(c0))}), and with ${lbl(c1)} (${stripEnEnd(mean(c1))}), ${lbl(c2)} flags caution: ${mean(c2)}`;
      else story = `${lbl(c0)} shows the start (${stripEnEnd(mean(c0))}), ${lbl(c1)} shapes the turn (${stripEnEnd(mean(c1))}), leading into ${lbl(c2)}: ${mean(c2)}`;
    } else if (lang === 'zh') {
      if (p1 === 'favorable' && p2 === 'caution') story = `眼下${lbl(c0)}反映${stripZhEnd(mean(c0))}；虽然${lbl(c1)}很让人想冲一把（${stripZhEnd(mean(c1))}），但收尾的${lbl(c2)}提醒：${mean(c2)}`;
      else if (p1 === 'caution' && p2 === 'favorable') story = `从${lbl(c0)}看，${stripZhEnd(mean(c0))}；哪怕中间夹着${lbl(c1)}的纠结（${stripZhEnd(mean(c1))}），最终仍会在${lbl(c2)}转晴：${mean(c2)}`;
      else if (p2 === 'caution') story = `${lbl(c0)}显示${stripZhEnd(mean(c0))}，加上${lbl(c1)}（${stripZhEnd(mean(c1))}），尾牌${lbl(c2)}提示谨慎：${mean(c2)}`;
      else story = `${lbl(c0)}点出起点（${stripZhEnd(mean(c0))}），中间由${lbl(c1)}承接（${stripZhEnd(mean(c1))}），最后落到${lbl(c2)}：${mean(c2)}`;
    } else {
      if (p1 === 'favorable' && p2 === 'caution') story = `ตอนนี้ ${lbl(c0)} บอกว่า${mean(c0)} แม้ ${lbl(c1)} จะเปิดมุมให้เห็นว่า${mean(c1)} แต่ปลายทางยังมี ${lbl(c2)} เตือนชัดว่า${mean(c2)}`;
      else if (p1 === 'caution' && p2 === 'favorable') story = `ตอนนี้ ${lbl(c0)} ชี้ว่า${mean(c0)} แม้ตรงกลางยังมีปมจาก ${lbl(c1)} คือ${mean(c1)} ทว่าปลายทางเปิดโล่งที่ ${lbl(c2)} — ${mean(c2)}`;
      else if (p2 === 'caution') story = `จาก ${lbl(c0)} ตอนนี้ชี้ว่า${mean(c0)} ผสมกับ ${lbl(c1)} ที่บอกว่า${mean(c1)} ปลายทาง ${lbl(c2)} เลยเตือนไว้ว่า${mean(c2)}`;
      else story = `เริ่มจาก ${lbl(c0)} ที่เห็นว่า${mean(c0)} มี ${lbl(c1)} เชื่อมตรงกลางว่า${mean(c1)} ก่อนไปจบที่ ${lbl(c2)} — ${mean(c2)}`;
    }
  }

  if (natalCard && outcomeCard && natalCard.uid === outcomeCard.uid && refCards.length > 1) {
    if (lang === 'en') story += ` Notably, ${outcomeCard.name} echoes your natal chart — this lesson really matters right now.`;
    else if (lang === 'zh') story += ` 而且${getLocalizedCardShortName(outcomeCard, 'zh')}正好与你最初的本命牌重合，可见这是眼下关键课题。`;
    else story += ` อีกอย่างคือ ${outcomeCard.th} ซ้ำกับไพ่พื้นดวงตอนแรกของ${nick}พอดี แปลว่านี่คือบทเรียนหลักรอบนี้เลย`;
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

function isRepeatedTopicIntent(state, currentQ, topic, intent) {
  const hist = Array.isArray(state?.chatHistory) ? state.chatHistory : [];
  if (!currentQ || topic === 'general') return false;
  const userMsgs = hist.filter((h) => h && (h.role === 'user' || (!h.role && !['สติ', 'Sati', '思谛'].includes(h.speaker))) && !h.isDrawAction);
  const curNorm = String(currentQ || '').trim();
  const prior = userMsgs.length > 0 && String(userMsgs[userMsgs.length - 1].text || '').trim() === curNorm
    ? userMsgs.slice(0, -1)
    : userMsgs;
  const lastPrev = prior[prior.length - 1];
  if (!lastPrev?.text) return false;
  const parsedPrev = detectTopicAndIntent(lastPrev.text, '');
  return parsedPrev.topic === topic && parsedPrev.intent === intent;
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

function buildPsychMirrorClause(user, refCards, spreadTone, nick, lang) {
  const names = (refCards || []).map((c) => c?.name || '');
  const hasAny = (keys) => names.some((n) => keys.some((k) => n.includes(k)));

  const hasAuth = hasAny(['King of', 'Queen of', 'The Emperor', 'The Magician', 'Strength', 'The Chariot', 'Justice']);
  const hasHeavy = hasAny(['The Hanged Man', 'Nine of Swords', 'Ten of Wands', 'Ten of Swords', 'Eight of Cups', 'Five of Pentacles', 'The Moon', 'Four of Pentacles', 'Eight of Swords']);
  if (hasAuth && hasHeavy) {
    return {
      short: lang === 'en'
        ? `Outside you look calm and capable, ${nick}, yet inside you’re carrying heavy tension alone`
        : lang === 'zh'
          ? `外人看${nick}稳重扛事，可你心里其实一直独自顶着沉重压力`
          : `คนนอกมองว่า${nick}นิ่งและจัดการได้ทุกเรื่อง แต่ข้างในกำลังแบกแรงกดดันอยู่เงียบๆ`,
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
        ? `Part of you sees the old path draining you, and part still hates letting go of sunk effort`
        : lang === 'zh'
          ? `${nick}一边明白老路越来越耗神，另一边又舍不得过去投入的心血`
          : `ใจนึง${nick}ก็รู้ว่าแบบเดิมเริ่มฝืน และอีกใจนึงก็ยังเสียดายเวลาที่ลงแรงมา`,
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
        ? `${elemLbl} temperament moves fast, yet cards urge checking details first`
        : lang === 'zh'
          ? `你${elemLbl}象求快，但牌提示先核实再动`
          : `ธาตุ${elemLbl}ของ${nick}คิดไว แต่รอบนี้ต้องชะลอเช็กก่อน`,
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
        ? `${elemLbl} depth stays cautious, just don’t stall too long`
        : lang === 'zh'
          ? `${elemLbl}象求稳，注意别顾虑过久错失时机`
          : `ธาตุ${elemLbl}ทำให้คิดลึก แต่อย่าวนในเซฟโซนนานเกิน`,
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
        ? `Your ${elemLbl} nature syncs with this spread to turn intent into results`
        : lang === 'zh'
          ? `本命${elemLbl}象正好顺应这组顺风牌`
          : `พลังธาตุ${elemLbl}ของ${nick}หนุนให้ไพ่ชุดนี้เห็นผลไว`,
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

  return `${verdict}\n\n${cardStory}\n\n${fallbackPrefix}${actionAdvice}`;
}

export function synthesizeDeepReply(state, question, cards) {
  const lang = normalizeLang(state.lang);
  const nick = state.user.nickname || (lang === 'en' ? 'my friend' : lang === 'zh' ? '朋友' : 'เพื่อน');
  const q = (question || '').trim();
  const { topic, intent } = detectTopicAndIntent(q, state.lastTopic);
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
  const psychMirror = buildPsychMirrorClause(state.user, refCards, spreadTone, nick, lang);

  if (lang === 'en' || lang === 'zh') {
    const isEn = lang === 'en';
    const orSplit = intent === 'decision'
      ? (isEn ? q.match(/(.+?)\s+or\s+(.+?)(\?|$)/i) : q.match(/(.+?)\s*还是\s*(.+?)([？?]|$)/))
      : null;

    let verdict = '';
    if (orSplit && orSplit[1] && orSplit[2]) {
      const cleanChoice = (s) => s.replace(/^(should i|choose between|between|is it better to|还是|选|要不要)\s*/i, '').replace(/[?？]+$/, '').trim() || s.trim();
      const optA = cleanChoice(orSplit[1]);
      const optB = cleanChoice(orSplit[2]);
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
      const isProTopic = topic === 'work' || topic === 'money' || /boss|manager|client|coworker|team|partner|老板|上司|客户|同事/i.test(q);
      if (isProTopic) {
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
            general: {
              favorable: `Looking at what’s unfolding, ${nick}, momentum is opening up clearly on your side.`,
              caution: `Looking closely at these cards, ${nick}, take this as a cue to slow down and verify reality before pushing.`,
              balanced: `Looking at what’s unfolding, ${nick}, this is a turning stretch where calm pacing makes the difference.`
            }
          }
        : {
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
            general: {
              favorable: `从目前这组牌来看，${nick}，整体走势正在顺畅打开。`,
              caution: `从桌面这组牌来看，${nick}，眼下有明显需要停一拍、看清事实再行动的提醒。`,
              balanced: `从目前这组牌来看，${nick}，眼下需要稳住分寸、慢慢调整好节奏。`
            }
          };
      verdict = (explainMap[topic] || explainMap.general)[explainTone];
    }

    const cardStory = buildConnectedCardStory(refCards, topic, outcomeCard, outcomeTone, natalCard, nick, lang);
    const fallbackPrefix = isEn
      ? `My honest advice right now, ${nick} — `
      : `眼下最实在的提醒，${nick}——`;

    return assembleBalancedReply(verdict, cardStory, actionAdvice, subtext, psychMirror, fallbackPrefix, isRepeat, lang);
  }

  // Warm, direct, natural Thai tarot conversation (zero bullet dumps or duplicated meanings)
  let verdict = '';
  const orMatch = intent === 'decision' ? q.match(/(.+?)\s*หรือ\s*(.+?)(\?|$)/) : null;

  if (orMatch && orMatch[1] && orMatch[2]) {
    const cleanOpt = (s, isFirst) => s
      .replace(isFirst ? /^(แล้ว|ถ้า|ควร|จะ|เลือก|ระหว่าง|อยากรู้ว่า)\s*/g : /^(ควร|จะ|ค่อย)\s*/g, '')
      .replace(/(ตอนนี้เลย|ดีไหม|ไหม|มั้ย|ดีกว่า|ก่อนดี|ก่อน|มากกว่า|กันแน่|ครับ|ค่ะ|คับ|นะ)+$/g, '')
      .replace(/\s*(ดี|ไหม)$/g, '')
      .trim() || s.trim();
    const optA = cleanOpt(orMatch[1], true);
    const optB = cleanOpt(orMatch[2], false);
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
    const isProTopic = topic === 'work' || topic === 'money' || /เจ้านาย|หัวหน้า|ลูกค้า|เพื่อนร่วมงาน|ทีม|หุ้นส่วน|บริษัท|ผู้ใหญ่/.test(q);
    if (isProTopic) {
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
    verdict = `ถ้าถามว่าเรื่องนี้ติดอยู่ตรงไหน ปมสำคัญสะท้อนชัดผ่านไพ่ชุดนี้เลยนะ${nick}`;
  } else if (intent === 'action') {
    verdict = `ถ้าถามว่าควรขยับยังไงต่อดี ลองดูมุมจากหน้าไพ่ที่เปิดมาตรงนี้เลยนะ${nick}`;
  } else {
    const explainTone = (spreadTone === 'favorable' && outcomeTone !== 'caution')
      ? 'favorable'
      : (spreadTone === 'caution' || outcomeTone === 'caution') ? 'caution' : 'balanced';
    const explainTh = {
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
      general: {
        favorable: `จากหน้าไพ่ชุดนี้ภาพรวมกำลังเปิดทางให้เดินหน้าได้ชัดเลยนะ${nick}`,
        caution: `จากหน้าไพ่ชุดนี้มีสัญญาณเตือนให้ชะลอและตั้งหลักดูความจริงก่อนจะฝืนไปต่อนะ${nick}`,
        balanced: `จากหน้าไพ่ชุดนี้สถานการณ์กำลังอยู่ในช่วงเปลี่ยนจังหวะนะ${nick} ค่อยๆ ประคองให้พอดี`
      }
    };
    verdict = (explainTh[topic] || explainTh.general)[explainTone];
  }

  const cardStory = buildConnectedCardStory(refCards, topic, outcomeCard, outcomeTone, natalCard, nick, 'th');
  const adviceText = actionAdvice || 'ตั้งหลักดูข้อมูลจริงตรงหน้าแล้วลงมือทีละขั้น';
  const fallbackPrefix = `จังหวะนี้สติฝากไว้ตรงๆ นะ${nick} — `;

  return assembleBalancedReply(verdict, cardStory, adviceText, subtext, psychMirror, fallbackPrefix, isRepeat, 'th');
}

/**
 * Call Gemini Proxy (`/api/sati/read`) with automatic localized Offline Fallback
 */
export async function requestSatiReading(state, question, rawCards, isNatal10 = false) {
  const lang = normalizeLang(state.lang);
  const cards = hydrateDeckCards(rawCards);
  const natalCards = hydrateDeckCards(state.natalCards);
  const fallbackReply = isNatal10
    ? buildNatal10Reading(state, cards)
    : synthesizeDeepReply(state, question, cards);

  try {
    const res = await fetch('/api/sati/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lang,
        userProfile: state.user,
        natalCards,
        activeSpread: cards,
        remainingCount: state.remainingDeck.length,
        isNatal10,
        celticPositions: getLocalizedCelticPositions(lang),
        question: isNatal10
          ? 'เปิดไพ่พื้นดวง 10 ใบแรกเชื่อมกับชื่อจริง นามสกุล ชื่อเล่น และวันเดือนปีเกิด'
          : question,
        recentHistory: state.chatHistory.slice(-6)
      })
    });

    if (!res.ok) return fallbackReply;
    const data = await res.json();
    if (data && !data.fallback && data.reply) {
      return data.reply;
    }
  } catch {
    // Offline or local static preview -> use local Thaksa synthesis seamlessly
  }
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
        hits.push({ idx, card });
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
    return `${suitDesc} — this energy ${toneClause}. ${roleLine} Applied to ${topicDesc.toLowerCase()}, "${coreClean}" translates directly into what you need to see here.`;
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
    return `${suitDesc}，这股牌象正${toneClause}。${roleLine}紧扣“${topicDesc}”，核心意象“${coreClean}”因此正好对应到你的问题上。`;
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
  return `ไพ่ใบนี้คือ${suitDesc} ซึ่ง${toneClause} — ${roleLine} เมื่อนำมาจับกับ${topicDesc} ภาพของ "${coreClean}" เลยแปลออกมาตรงกับคำถามนี้พอดี`;
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
  const qEcho = question
    ? (lang === 'en'
        ? `Tied back to your question "${question}": `
        : lang === 'zh'
          ? `回到你问的“${question}”：`
          : `เชื่อมเข้าคำถาม "${question}": `)
    : '';
  return [qEcho + storyLine, subtextNote, psychNote, synergyNote].filter(Boolean).join('\n\n');
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
    return {
      card,
      posIndex,
      posLabel,
      polarity,
      polarityLabel: BREAKDOWN_COPY.polarity[polarity][lang],
      title: data.title,
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
