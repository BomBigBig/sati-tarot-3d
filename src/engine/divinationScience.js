/**
 * SATI Divination Science Engine (Pure Zero-DOM ES Module)
 * Authentic Golden Dawn Book T Tarot Mechanics & Thai Planetary / Domain-Thaksa Synthesis.
 * Shared single source of truth imported by both `src/engine/satiBrain.js` and `backend/geminiProxyServer.js`.
 */
import {
  normalizeLang,
  resolveCardGoldenDawn,
  getLocalizedAstroLabel,
  getLocalizedCardShortName,
  getLocalizedThaksaRole,
  getLocalizedThaksaPlanetLabel,
  getReversedEnergyNuance
} from '../data/tarot78I18n.js';

export const THAI_PLANET_NUMBERS = Object.freeze({
  sun: 1,
  moon: 2,
  mars: 3,
  mercury: 4,
  jupiter: 5,
  venus: 6,
  saturn: 7,
  rahu: 8
});

export const THAI_PLANET_STRENGTHS = Object.freeze({
  sun: 6,
  moon: 15,
  mars: 8,
  mercury: 17,
  jupiter: 19,
  venus: 21,
  saturn: 10,
  rahu: 12
});

const NUMBER_TO_PLANET = Object.freeze({
  1: 'sun',
  2: 'moon',
  3: 'mars',
  4: 'mercury',
  5: 'jupiter',
  6: 'venus',
  7: 'saturn',
  8: 'rahu'
});

const THAI_TEXT_TO_PLANET = Object.freeze({
  อาทิตย์: 'sun',
  วันอาทิตย์: 'sun',
  จันทร์: 'moon',
  วันจันทร์: 'moon',
  อังคาร: 'mars',
  วันอังคาร: 'mars',
  พุธ: 'mercury',
  วันพุธ: 'mercury',
  พุธกลางวัน: 'mercury',
  พฤหัสบดี: 'jupiter',
  พฤหัส: 'jupiter',
  วันพฤหัสบดี: 'jupiter',
  วันพฤหัส: 'jupiter',
  ศุกร์: 'venus',
  วันศุกร์: 'venus',
  เสาร์: 'saturn',
  วันเสาร์: 'saturn',
  ราหู: 'rahu',
  วันราหู: 'rahu',
  พุธกลางคืน: 'rahu',
  วันพุธกลางคืน: 'rahu'
});

/**
 * Classical Thai Planetary Pair Matrices (เลขดาว 1-8).
 * Note: Moon(2)-Jupiter(5) deliberately appears in both `element` (earth) and `enemy` (emotional vs principle tension).
 */
export const THAI_PLANET_PAIRS = Object.freeze({
  friend: Object.freeze([
    {
      pair: ['sun', 'jupiter'],
      nums: [1, 5],
      label: { th: 'คู่มิตร (1-5)', en: 'Allied Pair (1-5)', zh: '益友星对 (1-5)' },
      desc: {
        th: 'ผู้ใหญ่หนุน ปัญญาและหลักการช่วยเปิดทาง',
        en: 'wise backing and steady principle clear hurdles',
        zh: '长辈贵人提携与理性判断助局势顺畅'
      }
    },
    {
      pair: ['moon', 'mercury'],
      nums: [2, 4],
      label: { th: 'คู่มิตร (2-4)', en: 'Allied Pair (2-4)', zh: '益友星对 (2-4)' },
      desc: {
        th: 'เจรจาคล่อง อ่อนโยนและเชื่อมใจคนเก่ง',
        en: 'agile persuasion and warm rapport carry talks smoothly',
        zh: '沟通温和得体且反应机敏，利于谈成合作'
      }
    },
    {
      pair: ['mars', 'venus'],
      nums: [3, 6],
      label: { th: 'คู่มิตร (3-6)', en: 'Allied Pair (3-6)', zh: '益友星对 (3-6)' },
      desc: {
        th: 'ความกล้าบวกเสน่ห์ ขยันทำจริงและดึงดูดโอกาส',
        en: 'bold initiative paired with warmth attracts backing',
        zh: '果断行动力与亲和魅力共振，聚力也聚人心'
      }
    },
    {
      pair: ['saturn', 'rahu'],
      nums: [7, 8],
      label: { th: 'คู่มิตร (7-8)', en: 'Allied Pair (7-8)', zh: '益友星对 (7-8)' },
      desc: {
        th: 'อึดลุยเกมยากและพลิกแพลงเก่งในทางไม่คุ้น',
        en: 'gritty endurance turns unfamiliar pressure into leverage',
        zh: '耐力扛压且善于变通，能在陌生局中突围'
      }
    }
  ]),
  enemy: Object.freeze([
    {
      pair: ['sun', 'mars'],
      nums: [1, 3],
      label: { th: 'คู่ศัตรู (1-3)', en: 'Friction Pair (1-3)', zh: '冲克星对 (1-3)' },
      desc: {
        th: 'ศักดิ์ศรีชนความใจร้อน ระวังปะทะคำพูดแรง',
        en: 'pride clashes with urgency; pause before sharp replies',
        zh: '尊严与急躁相撞，说话与出手切忌太冲'
      }
    },
    {
      pair: ['moon', 'jupiter'],
      nums: [2, 5],
      label: { th: 'คู่ศัตรู (2-5)', en: 'Friction Pair (2-5)', zh: '分歧星对 (2-5)' },
      desc: {
        th: 'ความรู้สึกอ่อนไหวสวนทางกรอบเหตุผลหรือผู้ใหญ่',
        en: 'sensitive feelings pull against strict rules or elders',
        zh: '内心情绪顾虑容易与制度或长辈要求产生拉扯'
      }
    },
    {
      pair: ['mercury', 'rahu'],
      nums: [4, 8],
      label: { th: 'คู่ศัตรู (4-8)', en: 'Friction Pair (4-8)', zh: '冲克星对 (4-8)' },
      desc: {
        th: 'ระวังคำพูดคลาดเคลื่อน สัญญา เอกสาร หรือข่าวลือ',
        en: 'guard against mixed signals, fine-print slips, or rumor',
        zh: '留意信息失真、合同条款漏洞与无谓口舌'
      }
    },
    {
      pair: ['venus', 'saturn'],
      nums: [6, 7],
      label: { th: 'คู่ศัตรู (6-7)', en: 'Friction Pair (6-7)', zh: '冲克星对 (6-7)' },
      desc: {
        th: 'ความสุขและเงินตึงมือชั่วคราว ต้องวางขอบเขตใจเย็น',
        en: 'affection or cash flow feels tight; patience unlocks relief',
        zh: '情感与财务略显紧绷压抑，宜设边界慢慢疏通'
      }
    }
  ]),
  element: Object.freeze([
    {
      pair: ['sun', 'saturn'],
      nums: [1, 7],
      elem: 'fire',
      label: { th: 'คู่ธาตุไฟ (1-7)', en: 'Fire Pair (1-7)', zh: '火象同气 (1-7)' },
      desc: {
        th: 'ไฟนิ่งอึดระยะยาว คุมอำนาจและความรับผิดชอบหนัก',
        en: 'enduring fire carries heavy leadership over distance',
        zh: '火气沉稳持久，扛得住长线重任'
      }
    },
    {
      pair: ['moon', 'jupiter'],
      nums: [2, 5],
      elem: 'earth',
      label: { th: 'คู่ธาตุดิน (2-5)', en: 'Earth Pair (2-5)', zh: '土象同气 (2-5)' },
      desc: {
        th: 'ความใส่ใจบวกความรู้ช่วยปั้นรากฐานมั่นคง',
        en: 'care paired with sound knowledge builds lasting base',
        zh: '细腻关照结合稳健学识，能筑牢实际根基'
      }
    },
    {
      pair: ['mars', 'rahu'],
      nums: [3, 8],
      elem: 'air',
      label: { th: 'คู่ธาตุลม (3-8)', en: 'Air Pair (3-8)', zh: '风象同气 (3-8)' },
      desc: {
        th: 'จังหวะขยับไว พลิกแพลงและเปลี่ยนเกมฉับพลัน',
        en: 'swift wind favors rapid pivots and sharp adaptation',
        zh: '风势迅疾敏锐，利快速调整策略与打破僵局'
      }
    },
    {
      pair: ['mercury', 'venus'],
      nums: [4, 6],
      elem: 'water',
      label: { th: 'คู่ธาตุน้ำ (4-6)', en: 'Water Pair (4-6)', zh: '水象同气 (4-6)' },
      desc: {
        th: 'วาจานุ่มนวลช่วยเชื่อมมิตรภาพและการเงินไหลลื่น',
        en: 'gentle diplomacy eases trust and steady cash flow',
        zh: '言语温润圆融，能顺水推舟促成合作与进账'
      }
    }
  ]),
  somphon: Object.freeze([
    {
      pair: ['sun', 'venus'],
      nums: [1, 6],
      label: { th: 'คู่สมพล (1-6)', en: 'Synergy Pair (1-6)', zh: '等力合旺 (1-6)' },
      desc: {
        th: 'กำลัง 27 เกียรติยศและความน่าเชื่อถือหนุนรายได้',
        en: 'power 27: credibility and charm reinforce material reward',
        zh: '星力合二十七，声望与亲和力直接转化为收益'
      }
    },
    {
      pair: ['moon', 'rahu'],
      nums: [2, 8],
      label: { th: 'คู่สมพล (2-8)', en: 'Synergy Pair (2-8)', zh: '等力合旺 (2-8)' },
      desc: {
        th: 'กำลัง 27 ไหวพริบจับจังหวะและผลประโยชน์นอกกรอบ',
        en: 'power 27: sharp intuition catches non-obvious openings',
        zh: '星力合二十七，敏锐直觉能捕捉意料之外的契机'
      }
    },
    {
      pair: ['mars', 'jupiter'],
      nums: [3, 5],
      label: { th: 'คู่สมพล (3-5)', en: 'Synergy Pair (3-5)', zh: '等力合旺 (3-5)' },
      desc: {
        th: 'กำลัง 27 กล้าลงมือโดยมีหลักการและแผนคุ้มเกม',
        en: 'power 27: courageous action guided by sound strategy',
        zh: '星力合二十七，有谋略托底的果敢行动最易成事'
      }
    },
    {
      pair: ['mercury', 'saturn'],
      nums: [4, 7],
      label: { th: 'คู่สมพล (4-7)', en: 'Synergy Pair (4-7)', zh: '等力合旺 (4-7)' },
      desc: {
        th: 'กำลัง 27 วางแผนละเอียด อดทนตรวจสอบจนจบดีล',
        en: 'power 27: disciplined analysis and grit finish complex work',
        zh: '星力合二十七，缜密核算配足耐力能稳稳收官'
      }
    }
  ])
});

export const ELEMENT_POLARITY = Object.freeze({
  fire: 'active',
  air: 'active',
  water: 'passive',
  earth: 'passive'
});

export const ZODIAC_MODALITY = Object.freeze({
  aries: 'cardinal',
  cancer: 'cardinal',
  libra: 'cardinal',
  capricorn: 'cardinal',
  taurus: 'fixed',
  leo: 'fixed',
  scorpio: 'fixed',
  aquarius: 'fixed',
  gemini: 'mutable',
  virgo: 'mutable',
  sagittarius: 'mutable',
  pisces: 'mutable'
});

const SUIT_FALLBACK_ELEMENT = Object.freeze({
  Wands: 'fire',
  Cups: 'water',
  Swords: 'air',
  Pentacles: 'earth'
});

/**
 * Exact 36 Golden Dawn Decans keyed by `${zodiac}_${decan}`, matching tropical zodiac cusps in satiBrain.js.
 */
const DECAN_RAW = [
  ['aries_1', 'Wands_Two', 'mars', [3, 21, 3, 30], '21-30 มี.ค.', 'Mar 21-30', '3月21-30日', 'แรงริเริ่มกล้าครองเกม แต่ต้องเลือกทิศให้ขาดก่อนก้าว', 'Bold initiative demands picking one clear direction first', '果断占先机，须先定单一主轴再推进'],
  ['aries_2', 'Wands_Three', 'sun', [3, 31, 4, 9], '31 มี.ค.-9 เม.ย.', 'Mar 31-Apr 9', '3月31-4月9日', 'พลังขยายตัวเปิดตลาดและคู่ค้าระยะไกลชัดเจน', 'Solar expansion widens reach and distant partnerships', '阳光势能拉开视野，利跨界协作与外拓'],
  ['aries_3', 'Wands_Four', 'venus', [4, 10, 4, 19], '10-19 เม.ย.', 'Apr 10-19', '4月10-19日', 'งานลงตัวเกิดความยินดีร่วมกันเป็นฐานก้าวต่อไป', 'Warm milestone harmony anchors your next stage', '阶段成果落地欢庆，顺势筑稳下一步'],

  ['taurus_1', 'Pentacles_Five', 'mercury', [4, 20, 4, 29], '20-29 เม.ย.', 'Apr 20-29', '4月20-29日', 'คิดกังวลเรื่องขาดแคลนจนมองข้ามความช่วยเหลือใกล้ตัว', 'Scarcity worry hides practical support waiting beside you', '切莫因紧绷焦虑而忽略身边可借之力'],
  ['taurus_2', 'Pentacles_Six', 'moon', [4, 30, 5, 10], '30 เม.ย.-10 พ.ค.', 'Apr 30-May 10', '4月30-5月10日', 'กระแสรับ-จ่ายหมุนสมดุลเมื่อแบ่งปันอย่างมีขอบเขต', 'Resource flow balances through fair, measured exchange', '收支在有分寸的互助与兑现中重回平衡'],
  ['taurus_3', 'Pentacles_Seven', 'saturn', [5, 11, 5, 20], '11-20 พ.ค.', 'May 11-20', '5月11-20日', 'ผลโตช้าตามจังหวะเสาร์ ต้องตรวจจุดคุ้มทุนแล้วปรับวิธี', 'Slow Saturnian growth calls for trimming low-yield effort', '土星慢工检验成效，须盘点投入并微调方法'],

  ['gemini_1', 'Swords_Eight', 'jupiter', [5, 21, 5, 31], '21-31 พ.ค.', 'May 21-31', '5月21-31日', 'เห็นตัวเลือกกว้างเกินไปจนเผลอสร้างกรอบจำกัดตัวเอง', 'Too many angles breed self-imposed paralysis over facts', '想法太多反而困住自己，拆掉预设即可破局'],
  ['gemini_2', 'Swords_Nine', 'mars', [6, 1, 6, 10], '1-10 มิ.ย.', 'Jun 1-10', '6月1-10日', 'ความกลัวปรุงแต่งเกินจริงจนกัดใจยามเงียบ ต้องแยกข้อเท็จจริง', 'Sharp mental overdrive magnifies fear; anchor in cold facts', '思绪焦灼放大担忧，回到客观事实即可降温'],
  ['gemini_3', 'Swords_Ten', 'sun', [6, 11, 6, 20], '11-20 มิ.ย.', 'Jun 11-20', '6月11-20日', 'จบบทความคิดเก่าแบบเห็นความจริงสว่างชัดเจนเพื่อเริ่มใหม่', 'Harsh illusion ends completely so fresh clarity dawns', '旧执念彻底清零，反而迎来破晓般的清醒'],

  ['cancer_1', 'Cups_Two', 'venus', [6, 21, 7, 1], '21 มิ.ย.-1 ก.ค.', 'Jun 21-Jul 1', '6月21-7月1日', 'ศุกร์ในกรกฎสร้างความเข้าใจจริงใจและดีลที่สมดุลใจ', 'Sincere mutual attraction heals distance into honest bond', '真诚共鸣拉近距离，彼此心意与条件对等'],
  ['cancer_2', 'Cups_Three', 'mercury', [7, 2, 7, 11], '2-11 ก.ค.', 'Jul 2-11', '7月2-11日', 'คำพูดและมิตรภาพหมุนพาข่าวดีและความร่วมมือสบายใจ', 'Warm conversation with allies opens joyful collaboration', '朋友与圈层互通喜讯，氛围轻松而助力多'],
  ['cancer_3', 'Cups_Four', 'moon', [7, 12, 7, 22], '12-22 ก.ค.', 'Jul 12-22', '7月12-22日', 'อารมณ์นิ่งเฉยหรือเบื่อซ้ำจนมองไม่เห็นโอกาสที่ยื่นมา', 'Moody saturation blinds you to a genuine new opening nearby', '情绪倦怠遮蔽视线，其实新机会已在手边'],

  ['leo_1', 'Wands_Five', 'saturn', [7, 23, 8, 1], '23 ก.ค.-1 ส.ค.', 'Jul 23-Aug 1', '7月23-8月1日', 'แรงเสียดทานทดสอบความนิ่ง ต้องแยกเกมแข่งจริงออกจากดราม่า', 'Friction tests composure; organize rules before spending heat', '摩擦与竞争考验定力，先立规则少耗口舌'],
  ['leo_2', 'Wands_Six', 'jupiter', [8, 2, 8, 12], '2-12 ส.ค.', 'Aug 2-12', '8月2-12日', 'ผลงานเข้าตาผู้ใหญ่และคนหมู่มาก ได้แรงส่งต่อทันที', 'Visible recognition rewards effort; ride momentum wisely', '实力获众人与长辈认可，顺势巩固胜果'],
  ['leo_3', 'Wands_Seven', 'mars', [8, 13, 8, 22], '13-22 ส.ค.', 'Aug 13-22', '8月13-22日', 'ยืนหยัดสู้รักษาจุดยืนเหนือแรงกดดันด้วยความกล้าหาญ', 'Hold higher ground calmly rather than yielding to loud noise', '守住自身高地与原则，不因外界施压退让'],

  ['virgo_1', 'Pentacles_Eight', 'sun', [8, 23, 9, 1], '23 ส.ค.-1 ก.ย.', 'Aug 23-Sep 1', '8月23-9月1日', 'เก็บงานละเอียดสม่ำเสมอเปลี่ยนทักษะเป็นผลงานคุณภาพชัด', 'Steady craftsmanship turns daily repetition into real value', '沉心打磨专业细节，功夫自然兑现成口碑'],
  ['virgo_2', 'Pentacles_Nine', 'venus', [9, 2, 9, 11], '2-11 ก.ย.', 'Sep 2-11', '9月2-11日', 'ผลพวงวินัยสร้างความมั่นคงพึ่งตัวเองได้และมีรสนิยม', 'Disciplined self-reliance yields comfortable, earned poise', '自律耕耘换来独立富足与从容底气'],
  ['virgo_3', 'Pentacles_Ten', 'mercury', [9, 12, 9, 22], '12-22 ก.ย.', 'Sep 12-22', '9月12-22日', 'วางระบบทรัพย์สินและเครือข่ายให้มั่งคั่งส่งต่อได้ระยะยาว', 'Structured planning locks in durable wealth and backing', '系统化统筹资源，建立长远稳固的资产盘'],

  ['libra_1', 'Swords_Two', 'moon', [9, 23, 10, 2], '23 ก.ย.-2 ต.ค.', 'Sep 23-Oct 2', '9月23-10月2日', 'อารมณ์ลังเลชั่งใจสองฝั่งทำให้พักรบชั่วคราวแต่ยังไม่จบปม', 'Guarded peace pauses conflict yet leaves the real choice unmade', '情绪与顾虑互相拉锯，暂时的平衡仍需拍板'],
  ['libra_2', 'Swords_Three', 'saturn', [10, 3, 10, 12], '3-12 ต.ค.', 'Oct 3-12', '10月3-12日', 'ความจริงเย็นชาจากเสาร์ตัดภาพลวงตาเพื่อให้ยอมรับและรักษาแผล', 'Stark Saturnian truth cuts illusion so clean healing begins', '冷峻现实戳破幻想，看清痛点反而才能止损'],
  ['libra_3', 'Swords_Four', 'jupiter', [10, 13, 10, 22], '13-22 ต.ค.', 'Oct 13-22', '10月13-22日', 'ถอยพักสมองอย่างมีสติช่วยให้มุมมองกว้างขึ้นก่อนตัดสินใจ', 'Deliberate truce restores perspective before the next move', '有意识地停下来休整，思路自然会重新拉开'],

  ['scorpio_1', 'Cups_Five', 'mars', [10, 23, 11, 1], '23 ต.ค.-1 พ.ย.', 'Oct 23-Nov 1', '10月23-11月1日', 'เสียดายสิ่งที่หกหล่นจนเกือบลืมทรัพยากรที่ยังตั้งอยู่ข้างหลัง', 'Grief over spilled hopes hides two standing cups still intact', '莫只顾懊恼失去的部分，转身仍有可守的底牌'],
  ['scorpio_2', 'Cups_Six', 'sun', [11, 2, 11, 11], '2-11 พ.ย.', 'Nov 2-11', '11月2-11日', 'ความทรงจำหรือคนคุ้นเคยวนกลับมาเตือนถึงความจริงใจดั้งเดิม', 'Warm nostalgia or past ties resurface to ground present intent', '旧情怀或熟人重现，照见初心却也须看清当下'],
  ['scorpio_3', 'Cups_Seven', 'venus', [11, 12, 11, 21], '12-21 พ.ย.', 'Nov 12-21', '11月12-21日', 'ภาพลวงตาเย้ายวนหลายทาง ต้องตัดตัวเลือกฟุ้งเพื่อจับของจริง', 'Seductive illusions scatter focus; pick one grounded option', '诱人幻象太多易分散心力，选定唯一可行项'],

  ['sagittarius_1', 'Wands_Eight', 'mercury', [11, 22, 12, 1], '22 พ.ย.-1 ธ.ค.', 'Nov 22-Dec 1', '11月22-12月1日', 'ข่าวสารและเหตุการณ์พุ่งไวมาก ต้องตอบสนองฉับไวแม่นยำ', 'Rapid messages and swift timing reward quick, clean replies', '讯息与进展加速落到面前，宜果断精准回应'],
  ['sagittarius_2', 'Wands_Nine', 'moon', [12, 2, 12, 11], '2-11 ธ.ค.', 'Dec 2-11', '12月2-11日', 'ล้าและระวังตัวจากแผลเก่า แต่กำลังสำรองยังพอพาข้ามเส้นชัย', 'Weary vigilance lingers near the finish; stamina still holds', '虽带戒备与疲惫，守住最后防线即可过关'],
  ['sagittarius_3', 'Wands_Ten', 'saturn', [12, 12, 12, 21], '12-21 ธ.ค.', 'Dec 12-21', '12月12-21日', 'แบกภาระเสาร์เกินกำลัง ต้องวางบางส่วนลงก่อนไฟมอด', 'Heavy duty exceeds one pair of shoulders; delegate to survive', '责任压身过重，及时卸下冗余才能保住余力'],

  ['capricorn_1', 'Pentacles_Two', 'jupiter', [12, 22, 12, 31], '22-31 ธ.ค.', 'Dec 22-31', '12月22-31日', 'หมุนจัดสมดุลงาน-เงินสองทางให้คล่องตัวท่ามกลางความเปลี่ยนแปลง', 'Juggle shifting priorities smoothly without dropping core rhythm', '在变化中灵活调度双线事务，稳住收支节奏'],
  ['capricorn_2', 'Pentacles_Three', 'mars', [1, 1, 1, 10], '1-10 ม.ค.', 'Jan 1-10', '1月1-10日', 'ลงมือร่วมกับทีมมืออาชีพปั้นงานจริงให้ได้มาตรฐานสูง', 'Active teamwork and skilled execution elevate tangible craft', '与专业团队协同落地，把标准稳稳做高'],
  ['capricorn_3', 'Pentacles_Four', 'sun', [1, 11, 1, 19], '11-19 ม.ค.', 'Jan 11-19', '1月11-19日', 'รักษาฐานมั่นคงได้ดี แต่อย่ากอดแน่นจนปิดโอกาสเติบโต', 'Protect core security without clinging too tightly to grow', '守成稳妥，只是别攥太紧而错失扩张契机'],

  ['aquarius_1', 'Swords_Five', 'venus', [1, 20, 1, 29], '20-29 ม.ค.', 'Jan 20-29', '1月20-29日', 'ชนะโต้เถียงแต่เสียความไว้ใจ ให้เลือกรักษาผลลัพธ์ระยะยาว', 'Empty verbal wins cost goodwill; guard long-term leverage', '赢了口舌却伤了人心，盯紧长远利益更重要'],
  ['aquarius_2', 'Swords_Six', 'mercury', [1, 30, 2, 8], '30 ม.ค.-8 ก.พ.', 'Jan 30-Feb 8', '1月30-2月8日', 'พาตัวเองออกจากคลื่นปั่นป่วนสู่ฝั่งที่สงบกว่าด้วยเหตุผล', 'Reasoned transition steers away from turbulence to calmer ground', '以理性把重心迁离内耗区，驶向平稳水域'],
  ['aquarius_3', 'Swords_Seven', 'moon', [2, 9, 2, 18], '9-18 ก.พ.', 'Feb 9-18', '2月9-18日', 'ระวังทางลัดหรือข้อมูลไม่ครบ ต้องเช็กความโปร่งใสเป็นหลักฐาน', 'Unchecked shortcuts risk backlash; verify terms transparently', '忌走灰色捷径，关键细节务必白纸黑字核清'],

  ['pisces_1', 'Cups_Eight', 'saturn', [2, 19, 2, 28], '19-28 ก.พ.', 'Feb 19-28', '2月19-2月28日', 'ยอมวางสิ่งที่อิ่มตัวแต่ไร้ความหมาย เพื่อเดินหาความจริงใจกว่า', 'Maturely walk away from empty comfort toward deeper purpose', '清醒告别耗神却无意义的现状，轻装寻真义'],
  ['pisces_2', 'Cups_Nine', 'jupiter', [3, 1, 3, 10], '1-10 มี.ค.', 'Mar 1-10', '3月1-10日', 'พฤหัสในมีนให้ความพึงพอใจและผลลัพธ์อิ่มใจเกินคาด', 'Generous fulfillment lands when gratitude stays grounded', '愿望得偿且心境舒展，珍惜成果并守稳本心'],
  ['pisces_3', 'Cups_Ten', 'mars', [3, 11, 3, 20], '11-20 มี.ค.', 'Mar 11-20', '3月11-20日', 'ความสุขลงตัวระดับครอบครัวและทีมงานระยะยาว', 'Full emotional peace aligns family, circle, and shared future', '情感与团体归属圆满落定，共赴长远安稳']
];

export const DECAN_36_METADATA = Object.freeze(
  Object.fromEntries(
    DECAN_RAW.map(([key, uid, planet, range, thWin, enWin, zhWin, thNuance, enNuance, zhNuance]) => {
      const [zodiac, decanStr] = key.split('_');
      return [
        key,
        Object.freeze({
          key,
          uid,
          planet,
          zodiac,
          decan: Number(decanStr),
          modality: ZODIAC_MODALITY[zodiac],
          range,
          dateWindow: { th: thWin, en: enWin, zh: zhWin },
          nuance: { th: thNuance, en: enNuance, zh: zhNuance }
        })
      ];
    })
  )
);

export const DOMAIN_THAKSA_TARGETS = Object.freeze({
  work: Object.freeze({
    annualRoles: ['เดช', 'อุตสาหะ', 'มนตรี'],
    natalRoles: ['เดช', 'อุตสาหะ'],
    specialPlanets: [],
    kalakiniTrigger: 'friction_or_reputation'
  }),
  money: Object.freeze({
    annualRoles: ['มูละ', 'ศรี', 'กาลกิณี'],
    natalRoles: ['มูละ', 'ศรี'],
    specialPlanets: [],
    kalakiniTrigger: 'always_guard'
  }),
  love: Object.freeze({
    annualRoles: ['บริวาร', 'ศรี', 'กาลกิณี'],
    natalRoles: ['บริวาร', 'ศรี'],
    specialPlanets: [],
    kalakiniTrigger: 'relationship_friction'
  }),
  study: Object.freeze({
    annualRoles: ['เดช', 'มนตรี', 'อุตสาหะ'],
    natalRoles: ['เดช', 'มนตรี'],
    specialPlanets: ['mercury', 'jupiter'],
    kalakiniTrigger: 'friction_only'
  }),
  health: Object.freeze({
    annualRoles: ['อายุ', 'กาลกิณี', 'มนตรี'],
    natalRoles: ['อายุ', 'กาลกิณี'],
    specialPlanets: [],
    kalakiniTrigger: 'always_guard'
  }),
  family: Object.freeze({
    annualRoles: ['บริวาร', 'มนตรี', 'มูละ'],
    natalRoles: ['บริวาร', 'มนตรี'],
    specialPlanets: [],
    kalakiniTrigger: 'friction_only'
  }),
  property: Object.freeze({
    annualRoles: ['มูละ', 'ศรี', 'เดช'],
    natalRoles: ['มูละ', 'มนตรี'],
    specialPlanets: [],
    kalakiniTrigger: 'friction_only'
  }),
  self: Object.freeze({
    annualRoles: ['อายุ', 'ศรี', 'กาลกิณี'],
    natalRoles: ['อายุ', 'เดช'],
    specialPlanets: [],
    kalakiniTrigger: 'friction_or_reputation'
  }),
  general: Object.freeze({
    annualRoles: ['ศรี', 'เดช', 'กาลกิณี'],
    natalRoles: ['ศรี', 'เดช'],
    specialPlanets: [],
    kalakiniTrigger: 'friction_only'
  })
});

function clipText(str, maxLen) {
  const clean = String(str || '').replace(/\s+/g, ' ').trim();
  if (!clean || clean.length <= maxLen) return clean;
  return `${clean.slice(0, Math.max(0, maxLen - 3)).trimEnd()}...`;
}

function getCardShort(card, target) {
  return getLocalizedCardShortName(card, target) || card?.name || card?.uid || '';
}

function getCardGd(card) {
  if (!card) return null;
  if (card.gd && card.gd.gdElement) return card.gd;
  return resolveCardGoldenDawn(card);
}

function resolveCardRank(card) {
  const uid = String(card?.uid || '');
  if (uid.includes('_') && !uid.startsWith('M_')) {
    return uid.slice(uid.indexOf('_') + 1);
  }
  const name = String(card?.name || '');
  const m = name.match(/^([A-Za-z]+)\s+of\s+/);
  return m ? m[1] : '';
}

function resolveCardTone(card) {
  if (card?.tone === 'good' || card?.tone === 'warn' || card?.tone === 'neutral') return card.tone;
  const n = String(card?.name || '');
  if (/(The Devil|The Tower|The Moon|The Hanged Man|Death|Three of Swords|Five of|Seven of|Eight of Swords|Nine of Swords|Ten of Swords|Ten of Wands)/.test(n)) {
    return 'warn';
  }
  if (/(The Sun|The Star|The World|The Magician|The Chariot|Wheel of Fortune|Ace of|Three of Pentacles|Six of Wands|Nine of Pentacles|Ten of Cups|Ten of Pentacles|King of|Queen of)/.test(n)) {
    return 'good';
  }
  return 'neutral';
}

function getEffectivePolarity(card) {
  const tone = resolveCardTone(card);
  if (tone === 'warn') return 'caution';
  if (tone === 'good') return card?.reversed ? 'balanced' : 'favorable';
  return 'balanced';
}

/**
 * Normalize English planet key, Thai planet/day string, digit 1..8, or Thaksa house object to `'sun'..'rahu'`.
 */
export function normalizeThaiPlanetKey(input) {
  if (input == null) return null;
  if (typeof input === 'object') {
    return normalizeThaiPlanetKey(input.planet || input.dayKey || input.dayName || input.num || null);
  }
  if (typeof input === 'number' && NUMBER_TO_PLANET[input]) {
    return NUMBER_TO_PLANET[input];
  }
  const raw = String(input).trim();
  if (!raw) return null;
  const low = raw.toLowerCase();
  if (THAI_PLANET_NUMBERS[low]) return low;
  if (/^[1-8]$/.test(raw)) return NUMBER_TO_PLANET[Number(raw)];
  if (THAI_TEXT_TO_PLANET[raw]) return THAI_TEXT_TO_PLANET[raw];
  const noPrefix = raw.replace(/^ดาว/, '').replace(/^วัน/, '').trim();
  return THAI_TEXT_TO_PLANET[noPrefix] || null;
}

/**
 * Resolve canonical Golden Dawn element (`'fire' | 'water' | 'air' | 'earth'`) for any of the 78 cards including Majors.
 */
export function resolveCardElement(card) {
  if (!card) return null;
  const gd = getCardGd(card);
  if (gd?.gdElement && ELEMENT_POLARITY[gd.gdElement]) return gd.gdElement;
  if (card?.suit && SUIT_FALLBACK_ELEMENT[card.suit]) return SUIT_FALLBACK_ELEMENT[card.suit];
  return null;
}

/**
 * Classify positional Golden Dawn elemental interaction between two adjacent elements.
 */
export function classifyElementPair(elemA, elemB) {
  const a = String(elemA || '').toLowerCase();
  const b = String(elemB || '').toLowerCase();
  if (!ELEMENT_POLARITY[a] || !ELEMENT_POLARITY[b]) {
    return { relation: 'neutral', weight: 0, polarityMatch: false };
  }
  if (a === b) {
    return { relation: 'identical', weight: 2, polarityMatch: true };
  }
  if ((a === 'fire' && b === 'air') || (a === 'air' && b === 'fire') || (a === 'water' && b === 'earth') || (a === 'earth' && b === 'water')) {
    return { relation: 'friendly', weight: 1, polarityMatch: true };
  }
  if ((a === 'fire' && b === 'water') || (a === 'water' && b === 'fire') || (a === 'air' && b === 'earth') || (a === 'earth' && b === 'air')) {
    return { relation: 'contrary', weight: -1, polarityMatch: false };
  }
  return { relation: 'neutral', weight: 0, polarityMatch: false };
}

function buildCourtSubElementNote(card, gd, target) {
  if (!gd || gd.category !== 'court' || !gd.subElement) return null;
  const parts = String(gd.subElement).toLowerCase().split(/\s+of\s+/);
  if (parts.length !== 2) return null;
  const cls = classifyElementPair(parts[0], parts[1]);
  const short = getCardShort(card, target);
  return {
    cardUid: card.uid,
    cardName: card.name,
    shortName: short,
    subElement: gd.subElement,
    internalRelation: cls.relation
  };
}

function resolvePairTextTag(elems, pairs, target) {
  const hasFire = elems.includes('fire');
  const hasAir = elems.includes('air');
  const hasWater = elems.includes('water');
  const hasEarth = elems.includes('earth');
  const hasContrary = pairs.some((p) => p.relation === 'contrary');
  const hasFriendly = pairs.some((p) => p.relation === 'friendly');
  const hasIdentical = pairs.some((p) => p.relation === 'identical');

  if (hasFire && hasAir && !hasWater && !hasEarth) {
    return {
      key: 'fire_air',
      th: 'ไฟ+ลมเสริมแรงไว (คิดชัดบวกลุยเร็ว แต่เช็กดีเทลไม่ให้รีบเกิน)',
      en: 'Fire + Air active support (sharp clarity fuels swift drive; verify details)',
      zh: '火风相生（思维与行动力共振加速，防求快漏细节）'
    }[target];
  }
  if (hasWater && hasEarth && !hasFire && !hasAir) {
    return {
      key: 'water_earth',
      th: 'น้ำ+ดินหนุนมั่นคง (ความตั้งใจจริงค่อยๆ ปั้นเป็นผลจับต้องได้)',
      en: 'Water + Earth grounded support (sincere care builds real lasting stability)',
      zh: '水土相融（沉稳心意正一点点沉淀为真实成果）'
    }[target];
  }
  const hasFireWaterClash = pairs.some(
    (p) => (p.elemA === 'fire' && p.elemB === 'water') || (p.elemA === 'water' && p.elemB === 'fire')
  ) || (hasFire && hasWater && !hasAir && !hasEarth);
  if (hasFireWaterClash) {
    return {
      key: 'fire_water',
      th: 'ไฟปะทะน้ำติดกัน (แรงอยากลุยกับความรู้สึกค้างใจดึงกันอยู่)',
      en: 'Fire vs Water friction (urgency collides with unsettled feeling)',
      zh: '火水相冲（急于推进与内心顾虑相互拉扯）'
    }[target];
  }
  const hasAirEarthClash = pairs.some(
    (p) => (p.elemA === 'air' && p.elemB === 'earth') || (p.elemA === 'earth' && p.elemB === 'air')
  ) || (hasAir && hasEarth && !hasFire && !hasWater);
  if (hasAirEarthClash) {
    return {
      key: 'air_earth',
      th: 'ลมปะทะดินติดกัน (คิดวิเคราะห์ชนข้อจำกัดและตัวเลขจริง)',
      en: 'Air vs Earth friction (over-analysis meets hard resource limits)',
      zh: '风土相制（思虑方案撞上现实条件与数字约束）'
    }[target];
  }
  if (hasFire && hasAir && hasFriendly) {
    return {
      key: 'fire_air_mixed',
      th: 'ไฟ+ลมเสริมกำลังในจุดติดกัน แต่มีธาตุอื่นคั่นจังหวะให้คุมความเสถียร',
      en: 'Fire + Air boost nearby flow alongside grounding cross-currents',
      zh: '火风相生局势中带牵制元素，须兼顾收放节奏'
    }[target];
  }
  if (hasIdentical && !hasContrary) {
    const dom = elems[0];
    const domLbl = getLocalizedAstroLabel('e', dom, target);
    return {
      key: 'identical',
      th: `ธาตุ${domLbl}ซ้อนกันแรง (พลังแนวเดียวกันขยายชัดทั้งจุดเด่นและจุดตึง)`,
      en: `Identical ${domLbl} amplification (concentrated momentum on one track)`,
      zh: `${domLbl}元素叠加共振（同向能量显著放大）`
    }[target];
  }
  return {
    key: 'balanced',
    th: hasContrary
      ? 'ธาตุสลับขั้วดึงสมดุล (มีทั้งแรงเสริมและแรงเบรก ผลลัพธ์อยู่ที่คุมจังหวะ)'
      : 'กำลังธาตุเชื่อมประสานกันได้ (ไม่มีขั้วทำลายตรงๆ เดินหมากตามแผนได้เลย)',
    en: hasContrary
      ? 'Mixed elemental polarity (support and friction offset; pacing decides)'
      : 'Balanced elemental bridge (elements pass cleanly with deliberate pacing)',
    zh: hasContrary
      ? '元素正反交错（有推力也有牵制，胜负在节奏把控）'
      : '元素流通均衡（无剧烈相冲，按既定计划推进即可）'
  }[target];
}

/**
 * Evaluate Golden Dawn Positional Elemental Dignity (adjacent pairs, triad modulation/cancellation, Major elements, Court sub-elements).
 */
export function analyzePositionalElementalDignity(cards = [], options = {}) {
  const target = normalizeLang(options?.lang);
  const list = Array.isArray(cards) ? cards.filter(Boolean) : [];
  if (!list.length) {
    return {
      pairs: [],
      triads: [],
      dominantRelation: 'neutral',
      activeCount: 0,
      passiveCount: 0,
      hasMajorElements: false,
      centerModulation: null,
      courtSubElements: [],
      legacyTag: '',
      shortSummary: '',
      promptSummary: ''
    };
  }

  const isNatal10 = Boolean(options?.isNatal10) || list.length >= 10;
  const elems = list.map((c) => resolveCardElement(c));
  let activeCount = 0;
  let passiveCount = 0;
  let hasMajorElements = false;
  const courtSubElements = [];

  list.forEach((c, idx) => {
    const el = elems[idx];
    if (ELEMENT_POLARITY[el] === 'active') activeCount += 1;
    else if (ELEMENT_POLARITY[el] === 'passive') passiveCount += 1;
    const gd = getCardGd(c);
    if (gd?.category === 'major' && el) hasMajorElements = true;
    const courtSub = buildCourtSubElementNote(c, gd, target);
    if (courtSub) courtSubElements.push(courtSub);
  });

  const pairIndices = isNatal10 && list.length >= 10
    ? [[0, 1], [2, 0], [0, 4], [3, 0], [0, 5], [5, 6], [6, 9]]
    : list.slice(0, -1).map((_, idx) => [idx, idx + 1]);

  const pairs = pairIndices.map(([aIdx, bIdx]) => {
    const cls = classifyElementPair(elems[aIdx], elems[bIdx]);
    return {
      fromIndex: aIdx,
      toIndex: bIdx,
      elemA: elems[aIdx],
      elemB: elems[bIdx],
      ...cls
    };
  });

  const triadIndices = isNatal10 && list.length >= 10
    ? [[2, 0, 4], [3, 0, 5], [5, 6, 9]]
    : (list.length >= 3 ? list.slice(0, -2).map((_, idx) => [idx, idx + 1, idx + 2]) : []);

  const triads = triadIndices.map(([lIdx, cIdx, rIdx]) => {
    const relL = classifyElementPair(elems[lIdx], elems[cIdx]);
    const relR = classifyElementPair(elems[cIdx], elems[rIdx]);
    const relFlank = classifyElementPair(elems[lIdx], elems[rIdx]);
    let modulation = 'neutral';
    if (relL.weight >= 1 && relR.weight >= 1) modulation = 'doubly_well_dignified';
    else if (relL.weight < 0 && relR.weight < 0) modulation = 'doubly_ill_dignified';
    else if (relFlank.relation === 'contrary' && (relL.weight < 0 || relR.weight < 0 || relL.weight !== relR.weight)) {
      modulation = 'flanking_cancelled';
    } else if ((relL.weight >= 1 && relR.weight < 0) || (relR.weight >= 1 && relL.weight < 0)) {
      modulation = 'mixed_dignity';
    }
    return {
      indices: [lIdx, cIdx, rIdx],
      centerCard: getCardShort(list[cIdx], target),
      centerElement: elems[cIdx],
      leftRelation: relL.relation,
      rightRelation: relR.relation,
      flankRelation: relFlank.relation,
      modulation
    };
  });

  const centerModulation = triads[0]?.modulation || null;
  const relScores = { identical: 0, friendly: 0, contrary: 0, neutral: 0 };
  pairs.forEach((p) => { relScores[p.relation] += 1; });
  let dominantRelation = 'neutral';
  if (relScores.contrary > 0 && relScores.contrary >= relScores.friendly + relScores.identical) dominantRelation = 'contrary';
  else if (relScores.identical > 0 && relScores.identical >= relScores.friendly) dominantRelation = 'identical';
  else if (relScores.friendly > 0) dominantRelation = 'friendly';

  const legacyTag = resolvePairTextTag(elems.filter(Boolean), pairs, target);
  const modSuffix = (() => {
    if (!centerModulation || list.length < 3) return '';
    const cName = triads[0].centerCard;
    if (centerModulation === 'doubly_well_dignified') {
      return target === 'en'
        ? ` Center ${cName} is well-dignified on both sides.`
        : target === 'zh'
          ? ` 居中${cName}受两侧夹持增旺。`
          : ` ไพ่กลาง ${cName} ถูกหนุนสองฝั่งเต็มกำลัง`;
    }
    if (centerModulation === 'doubly_ill_dignified') {
      return target === 'en'
        ? ` Center ${cName} faces cross-element strain on both flanks.`
        : target === 'zh'
          ? ` 居中${cName}受两侧克制损耗，须先减压。`
          : ` ไพ่กลาง ${cName} โดนธาตุขัดขนาบสองด้าน ต้องคลายแรงตึงก่อน`;
    }
    if (centerModulation === 'flanking_cancelled') {
      return target === 'en'
        ? ` Opposing flanks offset each other, leaving ${cName} as pivot.`
        : target === 'zh'
          ? ` 左右对冲抵消，关键全看中位${cName}。`
          : ` ข้างซ้ายขวาหักล้างกันเอง เหลือ ${cName} เป็นจุดชี้ขาด`;
    }
    return '';
  })();

  const courtTag = courtSubElements.find((cs) => cs.internalRelation === 'contrary');
  const courtNote = courtTag
    ? (target === 'en'
        ? ` (${courtTag.shortName}: ${courtTag.subElement} inner tension)`
        : target === 'zh'
          ? `（${courtTag.shortName}带${courtTag.subElement}内在张力）`
          : ` (${courtTag.shortName}: ${courtTag.subElement} ดึงกันภายใน)`)
    : '';

  const shortSummary = clipText(legacyTag, 135);
  const promptSummary = clipText(`${legacyTag}${modSuffix}${courtNote}`, 300);

  return {
    pairs,
    triads,
    dominantRelation,
    activeCount,
    passiveCount,
    hasMajorElements,
    centerModulation,
    courtSubElements,
    legacyTag,
    shortSummary,
    promptSummary
  };
}

function isDateWithinDecanRange(refDate, range) {
  if (!refDate || !Array.isArray(range) || range.length !== 4) return false;
  const d = refDate instanceof Date ? refDate : new Date(refDate);
  if (Number.isNaN(d.getTime())) return false;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const [sm, sd, em, ed] = range;
  if (sm === em) return m === sm && day >= sd && day <= ed;
  if (sm < em) return (m === sm && day >= sd) || (m === em && day <= ed) || (m > sm && m < em);
  return (m === sm && day >= sd) || (m === em && day <= ed) || m > sm || m < em;
}

/**
 * Compute Golden Dawn 36-Decan timing window, Zodiac Modality pace, and reversal delay nuance.
 */
export function getDecanTimingProfile(card, options = {}) {
  const target = normalizeLang(options?.lang);
  const gd = getCardGd(card);
  const elem = resolveCardElement(card);
  const rank = resolveCardRank(card);
  const zodiac = gd?.zodiac || null;
  const modality = zodiac ? (ZODIAC_MODALITY[zodiac] || null) : null;
  const decanKey = zodiac && gd?.decan ? `${zodiac}_${gd.decan}` : '';
  const decanMeta = decanKey ? DECAN_36_METADATA[decanKey] : null;
  const isDelayedByReversal = Boolean(card?.reversed);
  const isCurrentDecanWindow = decanMeta ? isDateWithinDecanRange(options?.referenceDate, decanMeta.range) : false;

  let paceTier = 'medium';
  if (['Ace', 'Two', 'Three'].includes(rank) && (elem === 'fire' || elem === 'air')) {
    paceTier = 'immediate';
  } else if (['Wands_Eight', 'Wands_Knight', 'Swords_Knight'].includes(card?.uid) || /^(Eight of Wands|Knight of Wands|Knight of Swords)/.test(card?.name || '')) {
    paceTier = 'immediate';
  } else if (gd?.category === 'major') {
    paceTier = modality === 'cardinal' ? 'short' : 'conditional';
  } else if (elem === 'earth' || card?.suit === 'Pentacles' || (modality === 'fixed' && elem !== 'fire')) {
    paceTier = 'slow';
  } else if (modality === 'cardinal' || elem === 'fire') {
    paceTier = 'short';
  }

  if (isDelayedByReversal) {
    if (paceTier === 'immediate') paceTier = 'short';
    else if (paceTier === 'short') paceTier = 'medium';
    else if (paceTier === 'medium') paceTier = 'slow';
  }

  const paceTexts = {
    th: {
      immediate: isDelayedByReversal
        ? 'เดิมไวราว 1-3 สัปดาห์ แต่หน้าไพ่กลับหัวหน่วงเป็น 3-5 สัปดาห์จนกว่าจะคลายจุดติดขัด'
        : 'จังหวะไว ช่วง 1-3 สัปดาห์นี้เริ่มเห็นสัญญาณหรือคำตอบชัดแล้ว',
      short: isDelayedByReversal
        ? 'ปกติขยับใน 2-5 สัปดาห์ แต่ติดกลับหัวจึงต้องบวกเวลาจัดการอุปสรรคอีกราว 2-3 สัปดาห์'
        : 'เห็นความคืบหน้าชัดใน 2-6 สัปดาห์ หรือขยับทันทีเมื่อเปิดรอบใหม่',
      medium: isDelayedByReversal
        ? 'จังหวะถูกหน่วงเป็น 2-3 เดือน รอให้ความรู้สึกและเงื่อนไขสุกงอมพร้อมกัน'
        : 'ค่อยๆ ชัดเจนในกรอบ 1-2 เดือนนี้ตามความสม่ำเสมอที่ลงมือ',
      slow: isDelayedByReversal
        ? 'ฐานดิน/เสาร์ใช้เวลาราว 3-5 เดือน และไพ่กลับหัวเตือนให้รีบอุดรอยรั่วก่อนตัวเลขนิ่ง'
        : 'วางฐานและรอผลจริงจับต้องได้ราว 2-4 เดือน',
      conditional: isDelayedByReversal
        ? 'ไพ่ใหญ่กลับหัวชี้ว่าเวลาขยับขึ้นกับจังหวะที่คุณกล้าปลดล็อกจุดค้างภายในราว 1-2 เดือน'
        : 'ไม่ได้ขึ้นกับปฏิทินอย่างเดียว แต่ปลดล็อกภายใน ~1 เดือนนับจากวันที่กล้าขยับจริง'
    },
    en: {
      immediate: isDelayedByReversal
        ? 'normally swift (1-3 weeks), yet reversed friction stretches it to 3-5 weeks until cleared'
        : 'swift movement — early signs or answers tend to arrive within 1 to 3 weeks',
      short: isDelayedByReversal
        ? 'typically 2-6 weeks, delayed by 2-3 extra weeks while a hidden snag clears'
        : 'visible movement inside 2 to 6 weeks as active energy opens',
      medium: isDelayedByReversal
        ? 'paced slowly over 2 to 3 months until internal alignment catches up'
        : 'grows steadily clearer across 1 to 2 months of follow-through',
      slow: isDelayedByReversal
        ? 'slow-release Earth cycle (3-5 months) requiring structural cleanup first'
        : 'takes 2 to 4 months of steady grounding before hard numbers land',
      conditional: isDelayedByReversal
        ? 'delayed 1 to 2 months until an internal block shifts first'
        : 'unlocks within roughly 1 month once you commit to the needed shift'
    },
    zh: {
      immediate: isDelayedByReversal
        ? '原本只需1至3周，因逆位阻滞会拉长到3至5周才见明朗'
        : '节奏较快，约1到3周内就能看见明确信号或回应',
      short: isDelayedByReversal
        ? '常规2至6周可见转折，逆位提醒需再预留2至3周疏通卡点'
        : '约2到6周内推进提速，顺势推进很快看到阶段结果',
      medium: isDelayedByReversal
        ? '节奏放缓到2至3个月，须等条件与心态同步到位'
        : '大约1到2个月内随着持续推进而逐步明朗',
      slow: isDelayedByReversal
        ? '土象沉淀加逆位延后，约需3至5个月把基础与细节补稳'
        : '属慢工积累周期，约需2到4个月才看到扎实的数字或实体成果',
      conditional: isDelayedByReversal
        ? '大牌逆位表示需先解开内在卡点，大约1至2个月才会松动'
        : '不只看日历，通常在你真正做出关键调整后的1个月内就会松动'
    }
  };

  const windowText = paceTexts[target][paceTier];
  const decanDateWindow = decanMeta ? decanMeta.dateWindow[target] : '';
  const decanNuance = decanMeta ? decanMeta.nuance[target] : '';
  const winTag = decanDateWindow
    ? (target === 'en'
        ? ` (Decan window: ${decanDateWindow})`
        : target === 'zh'
          ? `（星象区间：${decanDateWindow}）`
          : ` (ช่วงองศาดาว: ${decanDateWindow})`)
    : '';
  const summary = clipText(`${windowText}${winTag}`, 210);

  return {
    paceTier,
    modality,
    decan: decanMeta?.decan || null,
    decanDateWindow,
    isCurrentDecanWindow,
    isDelayedByReversal,
    decanNuance,
    windowText,
    summary
  };
}

const LENS_COPY = {
  blocked: {
    label: { th: 'พลังถูกกั้น/ติดคอขวด', en: 'Blocked / Bottleneck', zh: '能量受阻 / 卡点' },
    reframe: {
      th: 'แนวโน้มยังมีอยู่แต่ติดด่านเฉพาะจุดให้ต้องเคลียร์ก่อน',
      en: 'the core drive is real, paused at one specific bottleneck',
      zh: '核心趋势仍在，只是被一处具体卡点暂时挡住'
    },
    action: {
      th: 'ระบุคอขวดตรงหน้าแล้วปลดออกทีละข้อแทนการเร่งฝืน',
      en: 'name and clear that single bottleneck instead of forcing speed',
      zh: '先把眼前这一处卡点拆解疏通，再推进速度'
    }
  },
  internalized: {
    label: { th: 'พลังย้อนเข้าด้านใน/เก็บงำ', en: 'Internalized / Inward', zh: '转向内在 / 蓄积' },
    reframe: {
      th: 'เรื่องนี้กำลังทำงานอยู่ข้างในใจหรือยังไม่แสดงออกภายนอกเต็มที่',
      en: 'this energy is working privately inside before showing outside',
      zh: '这股能量正在内心深处发酵消化，暂未完全外显'
    },
    action: {
      th: 'สังเกตความรู้สึกและเหตุผลที่ยังไม่กล้าพูดออกมาก่อนตัดสินใจ',
      en: 'surface what stays unspoken within before acting outward',
      zh: '先诚实整理未说出口的心意与顾虑，再做表态'
    }
  },
  delayed: {
    label: { th: 'จังหวะถูกหน่วง/ยังไม่สุกงอม', en: 'Delayed / Slow-Release', zh: '节奏延后 / 待成熟' },
    reframe: {
      th: 'ทิศทางไม่ผิดแต่เวลาและเงื่อนไขยังต้องการระยะบ่มเพาะเพิ่ม',
      en: 'direction holds, yet readiness and timing require extra margin',
      zh: '大方向并未走偏，只是火候与现实条件还差一点时间'
    },
    action: {
      th: 'เผื่อเวลาตรวจสอบเงื่อนไขให้ครบก่อนปิดดีลหรือเร่งคำตอบ',
      en: 'build a realistic buffer and finish groundwork before locking in',
      zh: '留出缓冲时间把基础条件核实稳，再求最终落定'
    }
  },
  excessive: {
    label: { th: 'พลังล้นเกิน/ตึงตัวรอคลาย', en: 'Excessive / Calibration Needed', zh: '过载失衡 / 须校准' },
    reframe: {
      th: 'แรงกดดันหรือการเร่งเกินพอดีกำลังเปิดโอกาสให้ปรับสมดุลและคลายปม',
      en: 'over-intensity or strain signals an overdue recalibration rather than doom',
      zh: '过度用力或积压的张力正在提醒你校准节奏、释放内耗'
    },
    action: {
      th: 'ลดแรงฝืนส่วนเกินลงครึ่งหนึ่งเพื่อเปลี่ยนวิกฤตเป็นจุดปรับตัว',
      en: 'dial down excess strain immediately to convert tension into control',
      zh: '减掉一半多余硬撑，把紧绷拉回可控平衡点'
    }
  }
};

/**
 * Diagnose a single reversed card through ONE constructive lens (blocked | internalized | delayed | excessive).
 */
export function diagnoseReversedCard(card, options = {}) {
  if (!card?.reversed) {
    return {
      isReversed: false,
      lens: null,
      lensLabel: '',
      constructiveReframe: '',
      actionTrigger: '',
      shortClause: '',
      promptLine: ''
    };
  }
  const target = normalizeLang(options?.lang);
  const gd = getCardGd(card);
  const rank = resolveCardRank(card);
  const tone = resolveCardTone(card);
  const elem = resolveCardElement(card);
  const posIndex = Number(options?.posIndex || 0);
  const totalCards = Number(options?.totalCards || 1);
  const posLabel = String(options?.posLabel || '').toLowerCase();
  const neighbors = Array.isArray(options?.neighborCards) ? options.neighborCards.filter(Boolean) : [];
  const hasContraryNeighbor = neighbors.some((nb) => classifyElementPair(elem, resolveCardElement(nb)).relation === 'contrary');

  let lens = 'blocked';
  if (/internal|hidden|root|ภายใน|จิตใต้สำนึก|ซ่อน|内在|隐/.test(posLabel)) {
    lens = 'internalized';
  } else if (/obstacle|challenge|อุปสรรค|ติดขัด|ปะทะ|阻碍/.test(posLabel) || hasContraryNeighbor) {
    lens = 'blocked';
  } else if (['Knight', 'Five', 'Seven', 'Nine', 'Ten'].includes(rank) || ['M_15', 'M_16', 'M_7'].includes(card?.uid) || tone === 'warn') {
    lens = (elem === 'water' || ['M_18', 'M_12', 'M_9'].includes(card?.uid)) ? 'internalized' : 'excessive';
  } else if (elem === 'water' || ['M_2', 'M_9', 'M_18'].includes(card?.uid) || ['Queen', 'Page'].includes(rank)) {
    lens = 'internalized';
  } else if (elem === 'earth' || rank === 'Ace' || ['M_10', 'M_12'].includes(card?.uid) || (totalCards > 1 && posIndex === totalCards - 1)) {
    lens = 'delayed';
  }

  const copy = LENS_COPY[lens];
  const shortName = getCardShort(card, target);
  const baseNuance = getReversedEnergyNuance(card, target);
  const lensLabel = copy.label[target];
  const constructiveReframe = copy.reframe[target];
  const actionTrigger = copy.action[target];

  const shortClause = clipText(
    target === 'en'
      ? `${shortName} (${lensLabel}): ${constructiveReframe}`
      : target === 'zh'
        ? `${shortName}（${lensLabel}）：${constructiveReframe}`
        : `${shortName} (${lensLabel}): ${constructiveReframe}`,
    95
  );
  const promptLine = clipText(
    `${shortName} [กลับหัว / Reversed | ${lensLabel}]: ${constructiveReframe}${baseNuance ? ` · ${baseNuance}` : ''} -> ${actionTrigger}`,
    160
  );

  return {
    isReversed: true,
    lens,
    lensLabel,
    constructiveReframe,
    actionTrigger,
    shortClause,
    promptLine
  };
}

function classifyCourtRole(card, idx, total, questionProfile, target) {
  const gd = getCardGd(card);
  if (gd?.category !== 'court') return null;
  const intent = questionProfile?.intent || 'explain';
  const topic = questionProfile?.topic || 'general';
  const subDomain = questionProfile?.subDomain || topic;
  const shortName = getCardShort(card, target);

  let roleType = 'querent_trait';
  if (intent === 'other_person' || (total >= 10 && idx === 7)) {
    roleType = 'other_person';
  } else if (intent === 'action' || intent === 'decision' || (total > 1 && idx === total - 1 && subDomain !== 'love')) {
    roleType = 'needed_stance';
  } else if (topic === 'love' && idx === 0) {
    roleType = 'other_person';
  }

  const roleDesc = {
    other_person: {
      th: `${shortName} แทนท่าที/ตัวตนอีกฝ่าย (${gd.subElement})${card.reversed ? ' ที่ยังกั๊กหรือไม่สม่ำเสมอ' : ' ที่แสดงออกชัด'}`,
      en: `${shortName} reflects the other person's stance (${gd.subElement})${card.reversed ? ' currently guarded or uneven' : ''}`,
      zh: `${shortName}反映对方当下的态度与处事风格（${gd.subElement}）${card.reversed ? '，目前略显保留' : ''}`
    },
    needed_stance: {
      th: `${shortName} คือบทบาทที่เจ้าชะตาควรสวมใส่ (${gd.subElement}) เพื่อคุมเกมรอบนี้`,
      en: `${shortName} marks the posture you should step into (${gd.subElement})`,
      zh: `${shortName}提示你当下最该拿出的行事姿态（${gd.subElement}）`
    },
    querent_trait: {
      th: `${shortName} สะท้อนจังหวะนิสัยหรือวิธีคิดของเจ้าชะตาเอง (${gd.subElement})`,
      en: `${shortName} mirrors your own operating mode (${gd.subElement})`,
      zh: `${shortName}映照你自身此刻的心态与发力方式（${gd.subElement}）`
    }
  };

  return {
    index: idx,
    cardUid: card.uid,
    shortName,
    subElement: gd.subElement,
    roleType,
    summary: roleDesc[roleType][target]
  };
}

/**
 * Analyze Card-Pair / Triad causal narrative arc: Major anchors vs Pip tactical friction, Court roles, and Reversal lenses.
 */
export function analyzeSpreadCausalDynamics(cards = [], options = {}) {
  const target = normalizeLang(options?.lang);
  const list = Array.isArray(cards) ? cards.filter(Boolean) : [];
  if (!list.length) {
    return {
      trajectory: 'single_focus',
      majorAnchors: [],
      pipFrictions: [],
      courtRoles: [],
      reversalDiagnoses: [],
      causalArcText: '',
      shortClause: '',
      promptSummary: ''
    };
  }

  const questionProfile = options?.questionProfile || {};
  const spreadPositions = Array.isArray(options?.spreadPositions) ? options.spreadPositions : null;
  const dignity = analyzePositionalElementalDignity(list, { lang: target, isNatal10: list.length >= 10 });

  const majorAnchors = [];
  const pipFrictions = [];
  const courtRoles = [];
  const reversalDiagnoses = [];

  list.forEach((c, idx) => {
    const gd = getCardGd(c);
    const shortName = getCardShort(c, target);
    const pol = getEffectivePolarity(c);
    if (gd?.category === 'major') {
      majorAnchors.push({ index: idx, uid: c.uid, name: c.name, shortName, polarity: pol, reversed: Boolean(c.reversed) });
    } else if (pol === 'caution' || c.reversed) {
      pipFrictions.push({ index: idx, uid: c.uid, name: c.name, shortName, polarity: pol, reversed: Boolean(c.reversed) });
    }
    const court = classifyCourtRole(c, idx, list.length, questionProfile, target);
    if (court) courtRoles.push(court);
    if (c.reversed) {
      const neighbors = [list[idx - 1], list[idx + 1]].filter(Boolean);
      reversalDiagnoses.push(
        diagnoseReversedCard(c, {
          lang: target,
          posIndex: idx,
          totalCards: list.length,
          posLabel: spreadPositions?.[idx] || '',
          neighborCards: neighbors,
          questionProfile
        })
      );
    }
  });

  const pols = list.map((c) => getEffectivePolarity(c));
  const firstPol = pols[0];
  const lastPol = pols[pols.length - 1];
  let trajectory = 'pivot_crossroads';
  if (list.length === 1) trajectory = 'single_focus';
  else if (firstPol === 'caution' && lastPol === 'favorable') trajectory = 'rising_recovery';
  else if (firstPol !== 'caution' && lastPol === 'caution') trajectory = 'late_check';
  else if (pols.every((p) => p === 'favorable')) trajectory = 'sustained_drive';
  else if (pols.filter((p) => p === 'caution').length >= Math.ceil(list.length / 2)) trajectory = 'compounding_strain';

  let anchorClause = '';
  if (majorAnchors.length > 0 && pipFrictions.length > 0) {
    const mj = majorAnchors[0].shortName;
    const pf = pipFrictions[0].shortName;
    anchorClause = target === 'en'
      ? `${mj} anchors the macro turn while ${pf} pinpoints the daily friction to fix`
      : target === 'zh'
        ? `${mj}定下宏观主轴，而${pf}点出日常最先该解开的阻力`
        : `${mj} คุมจุดเปลี่ยนใหญ่ ส่วน ${pf} ชี้จุดเสียดทานหน้างานที่ต้องแก้`;
  } else if (majorAnchors.length >= 2) {
    anchorClause = target === 'en'
      ? `${majorAnchors.length} Major Arcana anchor a structural turning point`
      : target === 'zh'
        ? `多张大阿卡纳压阵，代表关键转折而非短期插曲`
        : `ไพ่ใหญ่ ${majorAnchors.length} ใบคุมจังหวะเปลี่ยนโครงสร้างระยะยาว`;
  }

  const trajCopy = {
    single_focus: { th: 'โฟกัสตรงจุดเดียว', en: 'single focal point', zh: '单一焦点直指核心' },
    rising_recovery: { th: 'ต้นตึงแต่ปลายคลี่คลายเปิดทาง', en: 'early friction clearing into an open resolution', zh: '先紧后松、后势打开' },
    late_check: { th: 'ต้นมีแรงส่งแต่ปลายเตือนให้เบรกเช็กเงื่อนไข', en: 'early drive meets a closing check before locking in', zh: '前段有冲劲但尾段须停步复核风险' },
    sustained_drive: { th: 'แรงหนุนต่อเนื่องตลอดสาย', en: 'sustained supportive arc across positions', zh: '前后顺势连贯推进' },
    compounding_strain: { th: 'แรงตึงสะสมหลายตำแหน่ง ต้องตัดตัวแปรส่วนเกิน', en: 'compounding pressure calls for trimming excess load', zh: '多重承压叠加，先做减法卸下负荷' },
    pivot_crossroads: { th: 'จุดชั่งใจและปรับหมากระหว่างทาง', en: 'active crossroads pivoting on your next adjustment', zh: '处于平衡调整期，走向取决于下一步取舍' }
  };

  const causalArcText = clipText(
    [trajCopy[trajectory][target], anchorClause].filter(Boolean).join(' · '),
    180
  );
  const firstCourt = courtRoles[0]?.summary || '';
  const firstRev = reversalDiagnoses[0]?.shortClause || '';
  const shortClause = clipText(anchorClause || firstRev || firstCourt || trajCopy[trajectory][target], 135);
  const promptSummary = clipText(
    [causalArcText, firstCourt, firstRev, dignity.shortSummary].filter(Boolean).join(' | '),
    310
  );

  return {
    trajectory,
    majorAnchors,
    pipFrictions,
    courtRoles,
    reversalDiagnoses,
    causalArcText,
    shortClause,
    promptSummary
  };
}

function matchesPair(pairArr, a, b) {
  return (pairArr[0] === a && pairArr[1] === b) || (pairArr[0] === b && pairArr[1] === a);
}

/**
 * Evaluate classical Thai planetary relationship (`คู่มิตร`, `คู่ศัตรู`, `คู่ธาตุ`, `คู่สมพล`, or `same`).
 */
export function evaluateThaiPlanetaryPair(planetA, planetB, options = {}) {
  const target = normalizeLang(options?.lang);
  const a = normalizeThaiPlanetKey(planetA);
  const b = normalizeThaiPlanetKey(planetB);
  if (!a || !b) {
    return {
      a,
      b,
      relations: [],
      primaryRelation: 'none',
      elementTag: null,
      isSupportive: false,
      isFriction: false,
      meaning: '',
      summary: ''
    };
  }

  const lblA = getLocalizedAstroLabel('p', a, target);
  const lblB = getLocalizedAstroLabel('p', b, target);
  if (a === b) {
    const sameMeaning = target === 'en'
      ? `Self-reinforcing ${lblA} return (intensifies natal temperament)`
      : target === 'zh'
        ? `${lblA}星同位共振（本命特质被明显放大）`
        : `ดาว${lblA}ทับเรือนเดิม (พลังนิสัยประจำตัวเด่นชัดขึ้นเท่าตัว)`;
    return {
      a,
      b,
      relations: ['same'],
      primaryRelation: 'same',
      elementTag: null,
      isSupportive: true,
      isFriction: false,
      meaning: sameMeaning,
      summary: sameMeaning
    };
  }

  const relations = [];
  const labels = [];
  const descs = [];
  let elementTag = null;

  for (const relType of ['friend', 'somphon', 'element', 'enemy']) {
    const hit = THAI_PLANET_PAIRS[relType].find((entry) => matchesPair(entry.pair, a, b));
    if (hit) {
      relations.push(relType);
      labels.push(hit.label[target]);
      descs.push(hit.desc[target]);
      if (hit.elem) elementTag = hit.elem;
    }
  }

  const isSupportive = relations.includes('friend') || relations.includes('somphon') || relations.includes('element');
  const isFriction = relations.includes('enemy');
  const primaryRelation = relations.length > 1 ? 'dual' : (relations[0] || 'neutral');

  if (relations.length === 0) {
    const neutralDesc = target === 'en'
      ? `${lblA} & ${lblB}: neutral planetary exchange`
      : target === 'zh'
        ? `${lblA}与${lblB}呈中性呼应`
        : `ดาว${lblA}-${lblB} ส่งแรงกลางๆ ไม่มีขั้วปะทะตรง`;
    return {
      a,
      b,
      relations,
      primaryRelation: 'neutral',
      elementTag: null,
      isSupportive: false,
      isFriction: false,
      meaning: neutralDesc,
      summary: neutralDesc
    };
  }

  const meaning = descs.join(' / ');
  const summary = clipText(`${lblA}-${lblB} [${labels.join(' + ')}]: ${meaning}`, 160);
  return {
    a,
    b,
    relations,
    primaryRelation,
    elementTag,
    isSupportive,
    isFriction,
    meaning,
    summary
  };
}

/**
 * Target ONLY the 2-3 domain-relevant annual Thaksa houses + planetary pairs instead of dumping all 8 roles.
 * Guarantees `|`-delimited `ศรีจร=<...>` and `กาลกิณีจร=<...>` in separate segments for SC-09-01 compatibility.
 */
export function selectDomainThaksaFocus(userProfile = {}, annualThaksa = null, questionProfile = {}, options = {}) {
  const target = normalizeLang(options?.lang);
  const rawDomain = String(questionProfile?.subDomain || questionProfile?.topic || 'general').toLowerCase();
  const domainKey = DOMAIN_THAKSA_TARGETS[rawDomain] ? rawDomain : 'general';
  const spec = DOMAIN_THAKSA_TARGETS[domainKey];
  const annual = annualThaksa && Array.isArray(annualThaksa.roles)
    ? annualThaksa
    : (userProfile?.annualThaksa && Array.isArray(userProfile.annualThaksa.roles) ? userProfile.annualThaksa : null);

  const birthPlanet = normalizeThaiPlanetKey(
    userProfile?.planet || userProfile?.dayName || annual?.roles?.find((r) => r.role === 'บริวาร')?.planet
  );
  const fallingPlanet = normalizeThaiPlanetKey(annual?.fallingHouse?.planet);
  const birthVsFallingPair = (birthPlanet && fallingPlanet)
    ? evaluateThaiPlanetaryPair(birthPlanet, fallingPlanet, { lang: target })
    : null;

  const targetedAnnualHouses = annual
    ? spec.annualRoles
        .map((roleKey) => annual.roles.find((r) => r.role === roleKey))
        .filter(Boolean)
        .map((r) => ({
          role: r.role,
          annualRole: r.annualRole || `${r.role}จร`,
          dayName: r.dayName,
          planet: r.planet,
          elem: r.elem,
          pairWithBirth: birthPlanet ? evaluateThaiPlanetaryPair(birthPlanet, r.planet, { lang: target }) : null
        }))
    : [];

  const cards = Array.isArray(options?.cards) ? options.cards.filter(Boolean) : [];
  const cardPlanetPairs = [];
  const seenKeys = new Set();

  cards.forEach((c) => {
    const gd = getCardGd(c);
    const cPlanet = normalizeThaiPlanetKey(gd?.planet);
    if (!cPlanet) return;
    const cName = getCardShort(c, target);

    const targets = [
      ...(birthPlanet ? [{ targetType: 'birth', planet: birthPlanet, label: target === 'en' ? 'Birth Ruler' : target === 'zh' ? '出生主星' : 'ดาววันเกิด' }] : []),
      ...(annual?.siJon?.planet ? [{ targetType: 'siJon', planet: annual.siJon.planet, label: getLocalizedThaksaRole('ศรี', target, true) }] : []),
      ...(annual?.kalakiniJon?.planet ? [{ targetType: 'kalakiniJon', planet: annual.kalakiniJon.planet, label: getLocalizedThaksaRole('กาลกิณี', target, true) }] : [])
    ];
    if (domainKey === 'study') {
      spec.specialPlanets.forEach((sp) => {
        targets.push({ targetType: 'study_planet', planet: sp, label: getLocalizedAstroLabel('p', sp, target) });
      });
    }

    targets.forEach((t) => {
      const ev = evaluateThaiPlanetaryPair(cPlanet, t.planet, { lang: target });
      if (ev.relations.length > 0 && ev.primaryRelation !== 'neutral') {
        const dedupe = `${c.uid}_${t.targetType}`;
        if (!seenKeys.has(dedupe)) {
          seenKeys.add(dedupe);
          cardPlanetPairs.push({
            cardUid: c.uid,
            cardName: cName,
            targetType: t.targetType,
            targetLabel: t.label,
            ...ev
          });
        }
      }
    });
  });

  const rawQ = String(questionProfile?.rawQuestion || '');
  const hasCardCaution = cards.some((c) => getEffectivePolarity(c) === 'caution' || c?.reversed);
  const kalPlanet = normalizeThaiPlanetKey(annual?.kalakiniJon?.planet);
  const hitsKalakiniCard = Boolean(kalPlanet && cards.some((c) => normalizeThaiPlanetKey(getCardGd(c)?.planet) === kalPlanet));
  const includeKalakiniNote = Boolean(
    options?.isNatal10
    || spec.kalakiniTrigger === 'always_guard'
    || (spec.kalakiniTrigger === 'relationship_friction' && (hasCardCaution || hitsKalakiniCard))
    || (spec.kalakiniTrigger === 'friction_or_reputation' && (hasCardCaution || hitsKalakiniCard || /ชื่อ|สื่อสาร|ชื่อเสียง|เจ้านาย|ผู้ใหญ่/.test(rawQ)))
    || (spec.kalakiniTrigger === 'friction_only' && (hasCardCaution || hitsKalakiniCard || questionProfile?.intent === 'why'))
  );

  let compactPromptBlock = '';
  if (annual?.fallingHouse) {
    const fh = annual.fallingHouse;
    const fhPlanetLbl = getLocalizedThaksaPlanetLabel(fh, target);
    const siPlanetLbl = getLocalizedThaksaPlanetLabel(annual.siJon, target);
    const kalPlanetLbl = getLocalizedThaksaPlanetLabel(annual.kalakiniJon, target);
    const pairTag = birthVsFallingPair && birthVsFallingPair.primaryRelation !== 'neutral'
      ? `(${birthVsFallingPair.relations.join('+')})`
      : '';

    const houseSegs = targetedAnnualHouses
      .filter((h) => h.role !== 'ศรี' && h.role !== 'กาลกิณี')
      .slice(0, 2)
      .map((h) => {
        const pLbl = getLocalizedThaksaPlanetLabel(h, target);
        return target === 'th'
          ? `${h.annualRole}=${h.dayName}(${pLbl})`
          : `${getLocalizedThaksaRole(h.role, target, true)}=${pLbl}`;
      });

    const studyExtra = domainKey === 'study' && target === 'th' ? ['พุธ/พฤหัสหนุนเรียน'] : [];
    const pairExtra = birthVsFallingPair?.summary && birthVsFallingPair.primaryRelation !== 'neutral'
      ? [clipText(birthVsFallingPair.summary, 88)]
      : [];
    const header = target === 'en'
      ? `Thaksa(${domainKey}, age ${annual.ageYung}): House=${fhPlanetLbl}${pairTag}`
      : target === 'zh'
        ? `行年重点(${domainKey}, 虚岁${annual.ageYung}): 落宫=${fhPlanetLbl}${pairTag}`
        : `ทักษา(${domainKey} ${annual.ageYung}ปี): ภูมิ=${fh.dayName}(${fhPlanetLbl})${pairTag}`;

    // Always keep ศรีจร and กาลกิณีจร in isolated `|` segments so SC-09-01 never fails on any domain
    const siSeg = target === 'th'
      ? `ศรีจร=${annual.siJon?.dayName || ''}(${siPlanetLbl})`
      : `${getLocalizedThaksaRole('ศรี', target, true)}=${siPlanetLbl}`;
    const kalSeg = target === 'th'
      ? `กาลกิณีจร=${annual.kalakiniJon?.dayName || ''}(${kalPlanetLbl})`
      : `${getLocalizedThaksaRole('กาลกิณี', target, true)}=${kalPlanetLbl}`;
    const coreSegs = [header, siSeg, kalSeg];
    const optionalSegs = [...houseSegs, ...studyExtra, ...pairExtra];

    const selected = [...coreSegs];
    for (const seg of optionalSegs) {
      const candidate = [...selected.slice(0, 1), seg, ...selected.slice(1)].join(' | ');
      if (candidate.length <= 300) {
        selected.splice(selected.length - 2, 0, seg);
      }
    }
    compactPromptBlock = selected.join(' | ');
    if (compactPromptBlock.length > 300) {
      compactPromptBlock = coreSegs.join(' | ').slice(0, 300);
    }
  }

  let shortOfflineClause = '';
  if (birthVsFallingPair && birthVsFallingPair.relations.length > 0 && birthVsFallingPair.primaryRelation !== 'neutral') {
    shortOfflineClause = clipText(birthVsFallingPair.summary, 110);
  } else if (cardPlanetPairs.length > 0) {
    shortOfflineClause = clipText(cardPlanetPairs[0].summary, 110);
  } else if (targetedAnnualHouses.length > 0) {
    const h0 = targetedAnnualHouses[0];
    const pLbl = getLocalizedThaksaPlanetLabel(h0, target);
    shortOfflineClause = clipText(
      target === 'en'
        ? `${getLocalizedThaksaRole(h0.role, 'en', true)} sits in ${pLbl}`
        : target === 'zh'
          ? `${getLocalizedThaksaRole(h0.role, 'zh', true)}落在${pLbl}`
          : `เกณฑ์${h0.annualRole}ตกดาว${pLbl}รับกับเรื่องนี้โดยตรง`,
      110
    );
  }

  return {
    domainKey,
    targetedAnnualHouses,
    specialPlanets: spec.specialPlanets,
    birthPlanet,
    birthVsFallingPair,
    cardPlanetPairs,
    includeKalakiniNote,
    compactPromptBlock,
    shortOfflineClause
  };
}
