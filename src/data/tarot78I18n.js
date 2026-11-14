/**
 * Multilingual Tarot 78 Cards, Celtic Cross Positions & Thaksa Metadata (TH / EN / ZH)
 */

export function normalizeLang(lang) {
  return lang === 'en' || lang === 'zh' ? lang : 'th';
}

export const CELTIC_POSITIONS_I18N = {
  th: [
    'สถานการณ์ปัจจุบัน',
    'ตัวแปรหรือสิ่งที่ติดขัด',
    'รากฐานในใจที่ซ่อนอยู่',
    'อดีตที่ผ่านมาไม่นาน',
    'เป้าหมายหรือสิ่งที่ตั้งใจ',
    'แนวโน้มระยะใกล้ข้างหน้า',
    'ท่าทีและวิธีรับมือของตัวเอง',
    'คนรอบข้างและบรรยากาศภายนอก',
    'ความหวังหรือความกังวลลึกๆ',
    'ทิศทางสรุปของเรื่องนี้'
  ],
  en: [
    'Present Situation',
    'Challenge or Crossing Factor',
    'Hidden Root & Inner Drive',
    'Recent Past Influence',
    'Conscious Goal & Focus',
    'Near Future Direction',
    'Your Attitude & Stance',
    'People & Environment Around You',
    'Inner Hopes or Quiet Fears',
    'Overall Direction & Outcome'
  ],
  zh: [
    '当下处境',
    '眼前的阻碍或变量',
    '内心深处的根源',
    '近期过去的影响',
    '明确的目标与焦点',
    '近期即将显现的趋势',
    '你自身的态度与应对',
    '周围环境与他人影响',
    '内心的期盼或隐忧',
    '整体走向与最终落点'
  ]
};

export const SUIT_LABELS_I18N = {
  th: {
    Major: 'ไพ่ใหญ่ (จุดเปลี่ยนสำคัญ)',
    Wands: 'ไม้เท้า (ธาตุไฟ / การลงมือทำ)',
    Cups: 'ถ้วย (ธาตุน้ำ / ความรู้สึก)',
    Swords: 'ดาบ (ธาตุลม / ความคิดและคำพูด)',
    Pentacles: 'เหรียญ (ธาตุดิน / การเงินและงานจริง)'
  },
  en: {
    Major: 'Major Arcana (Turning Point)',
    Wands: 'Wands (Fire / Action & Drive)',
    Cups: 'Cups (Water / Heart & Bonds)',
    Swords: 'Swords (Air / Mind & Clarity)',
    Pentacles: 'Pentacles (Earth / Work & Wealth)'
  },
  zh: {
    Major: '大阿卡纳（关键转折）',
    Wands: '权杖（火元素 / 行动力）',
    Cups: '圣杯（水元素 / 情感与直觉）',
    Swords: '宝剑（风元素 / 思虑与沟通）',
    Pentacles: '星币（土元素 / 实务与财务）'
  }
};

export const THAKSA_DAY_I18N = {
  'วันอาทิตย์': {
    en: { day: 'Sunday', elem: 'Fire', trait: 'bold, decisive, and proud, though prone to putting intense pressure on yourself' },
    zh: { day: '星期日', elem: '火元素', trait: '果断敢为、看重尊严，但有时会给自己太大压力' }
  },
  'วันจันทร์': {
    en: { day: 'Monday', elem: 'Earth', trait: 'attentive, gentle, and perceptive with people, though quick to over-accommodate others' },
    zh: { day: '星期一', elem: '土元素', trait: '细腻体贴、善于察言观色，但容易替别人想太多而委屈自己' }
  },
  'วันอังคาร': {
    en: { day: 'Tuesday', elem: 'Air', trait: 'quick-thinking, action-oriented, and fearless, though you should watch impatience and blunt words' },
    zh: { day: '星期二', elem: '风元素', trait: '反应敏捷、敢闯敢拼，不喜拖延，但要留意心急与说话太直' }
  },
  'วันพุธ': {
    en: { day: 'Wednesday', elem: 'Water', trait: 'sharp, adaptable, and analytical, though you can tire yourself out by overthinking layers' },
    zh: { day: '星期三', elem: '水元素', trait: '头脑灵活、适应与分析力强，但常因为想太多层而内耗' }
  },
  'วันพฤหัสบดี': {
    en: { day: 'Thursday', elem: 'Earth', trait: 'principled, methodical, and dependable, though you tend to shoulder other people’s burdens' },
    zh: { day: '星期四', elem: '土元素', trait: '有原则、有条理且值得信赖，但常常把别人的担子扛在自己肩上' }
  },
  'วันศุกร์': {
    en: { day: 'Friday', elem: 'Water', trait: 'charming, sincere, and tasteful, though lingering feelings can replay in your mind' },
    zh: { day: '星期五', elem: '水元素', trait: '有魅力、真诚且注重质感，但心里有疙瘩时会反复琢磨' }
  },
  'วันเสาร์': {
    en: { day: 'Saturday', elem: 'Fire', trait: 'resilient, patient, and serious about long-term goals, though you bottle up stress alone' },
    zh: { day: '星期六', elem: '火元素', trait: '韧性强、有耐力、对长远目标认真执着，只是习惯一个人扛压力' }
  },
  'วันราหู': {
    en: { day: 'Wednesday Night (Rahu)', elem: 'Air', trait: 'resourceful and inventive, disliking rigid routines, though easily restless when progress stalls' },
    zh: { day: '周三夜（罗睺）', elem: '风元素', trait: '机智灵活、善于变通，不喜欢死板框架，但进度慢时容易觉得腻' }
  }
};

export const THAKSA_ROLE_I18N = {
  'บริวาร': { en: 'People & Team Dynamics', zh: '人际与团队统筹（伴侣/下属位）' },
  'อายุ': { en: 'Vitality & Life Rhythm', zh: '精力与生活节奏（寿元位）' },
  'เดช': { en: 'Authority & Decisiveness', zh: '决断力与威信（权势位）' },
  'ศรี': { en: 'Grace, Luck & Opportunities', zh: '贵气、机遇与顺缘（福德位）' },
  'มูละ': { en: 'Financial Foundation & Assets', zh: '财务根基与实际积累（财帛位）' },
  'อุตสาหะ': { en: 'Grit & Relentless Execution', zh: '勤勉行动力与实干（精进位）' },
  'มนตรี': { en: 'Mentors & Senior Backing', zh: '长辈贵人与外部扶持（贵人位）' },
  'กาลกิณี': { en: 'Friction Point Requiring Calm', zh: '需格外留神与沉住气的阻力位' }
};

/**
 * Compact card translation entries:
 * [zhTitle, enCore, enWork, enMoney, enLove, enAdvice, zhCore, zhWork, zhMoney, zhLove, zhAdvice]
 */
const CARDS_I18N = {
  // === 22 MAJOR ARCANA ===
  M_0: ['愚者', 'A fresh start driven by curiosity and trust before all details are settled.', 'Great moment to test a new venture, though set small checkpoints.', 'Avoid putting heavy savings on pure impulse.', 'Lighthearted chemistry with low pressure.', 'Stay playful, yet keep one hand on your parachute.', '凭好奇与勇气迈出全新一步，不必等万事俱备。', '适合尝试新方向或新方案，但要设好阶段止损点。', '别仅凭一股冲动押上大笔积蓄。', '相处轻松自然，适合慢慢了解。', '敢于启程，同时留好退路与基本盘。'],
  M_1: ['魔术师', 'You already hold the tools, skill, and timing needed to act.', 'Strong execution and persuasive communication bring tangible progress.', 'Spot new income channels through your own expertise.', 'Direct, clear conversation clears up confusion fast.', 'Stop rehearsing and turn your plan into real output today.', '你手里已经握有把想法落地的工具与时机。', '行动力与表达力俱佳，容易谈成关键进展。', '靠自身专长与资源整合开辟新收入。', '坦诚直接地沟通比猜测更有用。', '别再停留在计划里，今天就把第一步做出来。'],
  M_2: ['女祭司', 'Quiet intuition sees what loud voices miss; hold back before speaking.', 'Observe office politics calmly before revealing your cards.', 'Protect financial privacy and hold cash in reserve.', 'Deep unspoken feelings exist; let actions prove intent.', 'Wait for clear evidence instead of forcing immediate answers.', '静观其变，直觉往往比表面声响更准确。', '先看清局势再表态，不必急着亮底牌。', '保守财务隐私，手头保留充足现金流。', '双方心里都有细微感受，观察言行胜过追问。', '先收集真实线索，再做决定。'],
  M_3: ['皇后', 'Abundance, warmth, and creative growth flourish naturally.', 'Creative projects and hospitable partnerships yield steady wins.', 'Healthy cash flow arrives when quality takes priority.', 'Caring warmth and nurturing gestures deepen trust.', 'Invest in quality and pace yourself sustainably.', '丰盛、滋养与创造力正在稳步生长。', '创意工作与合作项目只要用心打磨，回报丰厚。', '注重品质与长期价值，财运自然顺畅。', '温柔体贴的陪伴会让关系更稳固。', '看重质感与可持续节奏，不必急功近利。'],
  M_4: ['皇帝', 'Structure, clear rules, and firm leadership hold everything together.', 'Step up with clear boundaries, roles, and accountability.', 'Track numbers strictly and stick to disciplined budgeting.', 'Stability and reliability speak louder than sweet words.', 'Set clear boundaries and enforce your own priorities.', '秩序、原则与稳健的掌控力能把局面撑住。', '明确分工与权责，按制度推进最有效。', '严格管好预算与账目，守住盈利底线。', '踏实守信比甜言蜜语更能给人安全感。', '立好规矩与优先级，别让情绪打乱节奏。'],
  M_5: ['教皇', 'Proven methods, trusted mentors, and shared values guide the way.', 'Follow standard procedures or consult someone seasoned.', 'Stick to conventional, transparent financial moves.', 'Shared principles and sincerity form lasting bonds.', 'Listen carefully to grounded experience before improvising.', '成熟的方法、前辈经验与共同价值观是可靠依据。', '按成熟流程推进或请教资深人士，少走弯路。', '采用稳妥合规的方式理财或合作。', '三观契合、彼此坦诚才是长久基础。', '先虚心听取有实绩的人的建议，再灵活调整。'],
  M_6: ['恋人', 'A defining choice of heart and values — half-measures will not hold.', 'Pick the partner or path that genuinely aligns with your integrity.', 'Check shared terms carefully before signing joint deals.', 'Mutual attraction and honest alignment are strong here.', 'Choose consciously and stand fully behind your decision.', '面对价值与心意的关键抉择，必须真诚选定方向。', '选与自己理念契合的伙伴或路线，别勉强凑合。', '涉及合伙或签约时把权责条款核对清楚。', '彼此有好感与吸引，坦白心意更关键。', '听清自己真正看重什么，选定后专注到底。'],
  M_7: ['战车', 'Focused willpower turns competing forces into forward momentum.', 'Drive the project hard while keeping steering control tight.', 'Active hustle pays off if impulse spending stays locked down.', 'Give the relationship clear direction instead of drifting.', 'Keep your eyes on one target and push through steadily.', '集中意志驾驭拉扯，把阻力变成前进动力。', '盯紧目标全力推进，把握主导权就能拿结果。', '主动开拓能带来进账，注意别乱花。', '感情需要明确方向，别总顺其自然耗着。', '聚焦一个核心目标，稳步冲刺到底。'],
  M_8: ['力量', 'Quiet composure and inner steadiness tame tense situations.', 'Lead difficult people with patience rather than brute force.', 'Build wealth through calm consistency rather than anxious chasing.', 'Patience and empathy melt defensive walls.', 'Master your own temper first; calm control wins the room.', '真正的强韧来自沉稳克制，而非硬碰硬。', '面对棘手的人和事，以耐心和分寸感来引导。', '稳扎稳打积累，别被短期焦虑牵着走。', '包容与克制能让对方放下戒备。', '先稳住自己的情绪，温和而坚定地推进。'],
  M_9: ['隐士', 'Step back from the noise to audit what truly matters.', 'Independent deep work solves puzzles faster than endless meetings.', 'Audit expenses quietly and trim pointless leaks.', 'Space to reflect clarifies what you genuinely want.', 'Slow down, verify facts alone, then move deliberately.', '从喧嚣中抽身沉淀，看清真正重要的事。', '独立沉下心研究细节，比频繁开会更见效。', '静心盘点开销，砍掉不必要的消耗。', '彼此留出思考空间，看清内心真实需求。', '先冷静核对现实条件，再谨慎迈步。'],
  M_10: ['命运之轮', 'External cycles are shifting quickly; stay nimble and ready.', 'New openings appear quickly — adapt faster than old habits.', 'Cash flow shifts with timing; keep liquidity handy.', 'Unexpected encounters or shifts test how adaptable you are.', 'Prepare well so you can catch the turn when it arrives.', '大环境与周期正在转动，关键在于顺势应变。', '新机会很快出现，及时调整做法就能抢占先机。', '收支节奏会有变化，手里多留流动资金。', '可能迎来意外转折或重逢，保持灵活沟通。', '提前做好准备，机会窗口打开时果断抓住。'],
  M_11: ['正义', 'Fairness, truth, and exact cause-and-effect decide the outcome.', 'Review contracts, metrics, and records cleanly; facts win.', 'Every baht/dollar and clause must be transparent and balanced.', 'Honest balance beats silent resentment every time.', 'Decide on verifiable evidence rather than wishful guessing.', '事实、公平与因果对等将决定最后的结果。', '核实数据与合同细节，按规则与证据办事。', '账目分明、条件对等，拒绝模糊不清的承诺。', '有话直说保持平衡，别默默积压委屈。', '用客观事实做判断，别凭想象美化情况。'],
  M_12: ['倒吊人', 'A pause is forcing a fresh angle before the next breakthrough.', 'Wait on final decisions while rethinking your core approach.', 'Liquidity moves slowly for now; avoid locking funds hastily.', 'Seeing things from their side shifts the stalemate.', 'Stop pushing the stuck door and look at the problem sideways.', '暂时的停滞是在逼你换个视角看待全盘。', '若正面强推卡住，先停下来重整策略。', '资金周转偏慢，暂时别急着押注锁定现金。', '换位体谅对方的处境，僵局才好松动。', '别在卡死的地方硬撞，换条思路再走。'],
  M_13: ['死神', 'An outdated chapter must close cleanly so real renewal can start.', 'End drained tasks or broken routines without dragging them out.', 'Cut losing habits or low-return commitments decisively.', 'Let old grievances go or accept a clean transition.', 'Finish closing the old door before knocking on the new one.', '旧阶段必须干脆收尾，真正的新生才会到来。', '果断结束低效消耗的项目或习惯，别再拖泥带水。', '及时止损停掉长期亏耗的支出或投入。', '放下旧心结或顺其自然翻篇。', '先把旧局彻底清算干净，再开启下一章。'],
  M_14: ['节制', 'Balanced pacing and calm integration heal extremes.', 'Coordinate teams smoothly and balance workload realistically.', 'Split funds sensibly between spending, reserve, and growth.', 'Mutual patience and gentle adjustment bring lasting peace.', 'Mix discipline with flexibility; avoid all-or-nothing extremes.', '节制、调和与稳健节奏正在修复失衡。', '做好跨方沟通协调，合理分配精力与工期。', '支出、储蓄与投入按比例平衡配置。', '耐心磨合步调，温和相处最有长久感。', '拿捏好分寸与节奏，别走极端。'],
  M_15: ['恶魔', 'Temptation, obsession, or fear is pulling the strings right now.', 'Beware toxic terms, burnout loops, or ego traps.', 'Watch out for impulse traps, debt illusions, or fast-money hype.', 'Attachment or jealousy blurs clear judgment.', 'Spot what hooks your weakness and cut the slack cleanly.', '欲望、执念或焦虑正在暗中牵制你的选择。', '警惕不平等条约、过度耗竭或面子绑架。', '严防高息诱惑、盲目消费或赌一把心态。', '占有欲或不安感容易让双方喘不过气。', '看清牵绊自己的诱因，果断把主动权拿回来。'],
  M_16: ['高塔', 'A sudden shake-up clears away fragile illusions fast.', 'Weak systems crack under pressure — rebuild on solid ground.', 'Expect an abrupt bill or market jolt; protect cash buffer.', 'Blunt truth lands abruptly, forcing honest clarity.', 'Do not cling to collapsing structures; salvage facts and reset.', '突如其来的震荡正把脆弱的假象彻底震散。', '有漏洞的流程会暴露，趁早用扎实方案重建。', '预留应急现金以防突发账单或波动。', '真相可能直白摊开，虽然刺耳却有助于清醒。', '别死守已经崩塌的旧架构，保留核心马上重来。'],
  M_17: ['星星', 'Quiet hope, healing, and a steady north star guide the road ahead.', 'Long-term creative vision gains quiet credibility.', 'Steady recovery and calmer planning replace financial panic.', 'Sincere kindness restores faith and emotional ease.', 'Keep doing honest, consistent work — clarity grows daily.', '希望回暖与清晰的长期方向正在悄悄点亮。', '长线规划与真诚作品正在积累信任。', '财务从焦虑逐步回稳，适合耐心修整布局。', '真诚善意与坦率会慢慢修复信任。', '按正确方向持续做下去，每天都会更明朗。'],
  M_18: ['月亮', 'Unclear motives or anxiety blur the picture; verify before reacting.', 'Hidden bottlenecks or vague expectations need written confirmation.', 'Do not invest blindly where terms feel foggy.', 'Overthinking fills in blanks that may not be real.', 'Double-check every rumor and fact before acting on fear.', '局面仍有迷雾与隐忧，别在信息不全时急着下结论。', '未说清的条件与隐藏风险务必白纸黑字确认。', '看不透细节的项目或账目绝不盲目投钱。', '容易胡思乱想放大不安，先核实再沟通。', '把怀疑化为核查事实，等看清全貌再行动。'],
  M_19: ['太阳', 'Warm clarity, honest joy, and visible breakthroughs shine through.', 'Recognition, successful launches, and strong momentum arrive.', 'Strong returns from transparent effort and solid confidence.', 'Open warmth, shared laughter, and clear affection flourish.', 'Step forward confidently and share credit generously.', '明朗、真诚与实打实的成果正在清晰显现。', '工作迎来曝光、肯定或项目顺利推进。', '踏实付出带来可喜进账，底气更足。', '彼此坦荡温暖，关系充满正向能量。', '大方展现成果，也别忘了与同行者分享喜悦。'],
  M_20: ['审判', 'A wake-up call asks for honest self-review and a decisive step up.', 'Answers arrive; apply past lessons and claim the upgrade.', 'Reassess value cleanly and collect what is overdue.', 'An honest reckoning clears old weight from the air.', 'Forgive past mistakes, take the lesson, and step up now.', '关键的觉醒时刻已到，用过去经验换取一次升级。', '迎来审核、回复或翻身机会，拿出成熟答卷。', '重新评估资产与回款，该追回的主动处理。', '认真面对心结，说开后才有新开始。', '吸取教训、放下包袱，立刻做出更成熟的决定。'],
  M_21: ['世界', 'A major cycle completes cleanly, opening a broader stage.', 'Finish deliverables thoroughly before launching the next phase.', 'Goals lock in; organize gains for long-term scale.', 'Fulfillment and mutual respect bring deep steadiness.', 'Wrap up loose ends completely so you step higher unburdened.', '一个重要周期圆满收官，更大舞台正在展开。', '把收尾工作做到位，就能顺利跨入新阶段。', '阶段收益逐步落袋，可以规划更长远布局。', '彼此认可与圆满感让关系稳稳落地。', '彻底完成当下闭环，轻装迎向下一程。'],

  // === WANDS (14) ===
  Wands_Ace: ['权杖王牌', 'A fresh spark of drive invites bold action.', 'Launch the pitch or prototype while momentum is fresh.', 'Seed money flows best into practical action.', 'Instant spark and vibrant chemistry.', 'Move within 48 hours before hesitation cools the fire.', '一股鲜活的冲劲出现，适合立刻起手。', '趁热情还在，先把方案或原型做出来。', '资金投入宜小步试水、重在实操。', '很有火花与吸引力，互动热烈。', '别光想不做，尽快踏出第一步。'],
  Wands_Two: ['权杖二', 'Looking beyond current comfort toward a bigger map.', 'Plan expansion and compare two concrete paths.', 'Compare projected returns before committing capital.', 'Deciding whether to open up toward shared future plans.', 'Pick one horizon and schedule the first concrete step.', '站在现有成绩上眺望更大版图。', '规划下一阶段扩张，比较两条可行路线。', '先对比回报周期，再决定是否加码。', '在思考是否共同迈向更长远规划。', '选定目标方向，把第一步排上日程。'],
  Wands_Three: ['权杖三', 'Early groundwork is holding; momentum now looks outward.', 'Partnerships or distant clients start moving.', 'Cash cycles show wider growth when patient.', 'Distance or long-term plans need steady follow-through.', 'Keep scaling while maintaining quality checkpoints.', '前期布局已有基础，正往更远目标推进。', '外部合作或跨界机会开始显现苗头。', '长线收成看好，稳住出货与交付节奏。', '有长远期待或异地联系，保持稳定回应。', '继续向外拓展，同时盯紧细节把关。'],
  Wands_Four: ['权杖四', 'Warm stability, milestone celebration, and welcome grounding.', 'Celebrate a team milestone and solidify morale.', 'Steady income keeps household or baseline bills secure.', 'Joyful warmth, gatherings, or feeling truly at home together.', 'Honor your progress briefly, then keep building calmly.', '阶段成果稳定下来，氛围温暖欢欣。', '团队达成里程碑，适合巩固士气与默契。', '基础收入安稳，日常开支游刃有余。', '关系融洽有安全感，适合见亲友或小聚。', '允许自己庆祝成绩，随后沉稳迈向下一步。'],
  Wands_Five: ['权杖五', 'Competing voices and noisy friction drain energy fast.', 'Clarify scope so team debates turn into healthy testing.', 'Avoid messy bidding wars or scattered small leaks.', 'Petty bickering comes from bruised pride, not real malice.', 'Cut the noise, align one common goal, and set rules.', '各方意见杂乱竞争，容易陷入无谓消耗。', '先统一边界与目标，把争执转成良性测试。', '避免盲目跟风内卷或零碎破财。', '容易因面子斗气起小摩擦，少抬杠多倾听。', '减少无意义内耗，先定下共同规则再谈。'],
  Wands_Six: ['权杖六', 'Earned victory brings recognition and renewed confidence.', 'Take the win graciously and share visibility with supporters.', 'Strong sales or performance rewards arrive.', 'Pride in each other and supportive admiration.', 'Enjoy the milestone without resting on it for too long.', '实力赢得掌声，公开的认可与进展到来。', '项目成绩亮眼，大方接住肯定并感谢队友。', '业绩回馈或奖金机会增强。', '彼此为对方骄傲，互动有面子又甜蜜。', '顺势巩固优势，别因为掌声停下脚步。'],
  Wands_Seven: ['权杖七', 'Hold your ground calmly despite outside pushback.', 'Defend your standards and pricing with calm proof.', 'Protect margins instead of caving to cheap discounts.', 'Protect relationship boundaries from outside interference.', 'Stand firm on essentials without snapping aggressively.', '外界有压力或质疑，稳住立场就能守住阵地。', '用事实与专业度捍卫你的原则与报价。', '守住利润与底线，不随意妥协。', '保护感情边界，不被旁人风言风语带偏。', '坚持关键底线，同时保持冷静语气。'],
  Wands_Eight: ['权杖八', 'Messages, decisions, and travel pick up speed rapidly.', 'Clear pending emails and ship while timing is hot.', 'Quick turnover demands rapid invoicing and tracking.', 'Fast, candid messages spark momentum.', 'Respond promptly before the fast window closes.', '消息、审批与节奏突然全面提速。', '快刀斩乱麻推进待办，趁热度迅速落地。', '资金流动变快，注意及时对账结算。', '沟通频繁且直球，容易快速升温。', '立刻回应重要讯息，别错过快节奏窗口。'],
  Wands_Nine: ['权杖九', 'Battle-worn but still standing — pace your remaining strength.', 'One final push clears the hurdle; watch fatigue errors.', 'Hold your safety reserve tight near the finish line.', 'Old scars make you guarded; distinguish past from present.', 'Protect your rest and guard the last mile carefully.', '虽然有点疲惫，但你仍稳稳守在终点前。', '只差最后一段坚持，警惕疲劳带来的疏漏。', '越靠近收官越要守紧防线与备用金。', '因过往受伤而防备心重，别把旧影投射到现在。', '注意休息分配体力，稳妥走完最后一程。'],
  Wands_Ten: ['权杖十', 'Carrying every burden alone is stalling both quality and joy.', 'Delegate tasks or trim low-value commitments today.', 'Overwork hides thin profit — recalculate effort vs return.', 'One partner carrying all emotional labor breeds quiet fatigue.', 'Put down what isn’t yours so you can actually finish well.', '扛了太多职责在身上，快要压垮节奏与热情。', '立刻把杂事分出去或砍掉低回报任务。', '看似忙碌却可能性价比偏低，重新核算投入产出。', '别一个人包揽所有付出，坦诚分担压力。', '先卸下不必要的负担，才能顺利走到终点。'],
  Wands_Page: ['权杖侍从', 'Fresh curiosity and encouraging news stir new ideas.', 'Great time to test an idea, learn, or pitch lightly.', 'Small new side opportunities deserve low-risk exploration.', 'Playful, enthusiastic energy wants fun shared experiences.', 'Keep promises realistic so excitement turns into follow-through.', '新鲜灵感与好消息出现，让人跃跃欲试。', '适合学新技能、试水小项目或提出新想法。', '有小额新财路苗头，用低成本试错即可。', '互动充满好奇与活力，气氛轻松有趣。', '保持热情的同时把承诺落到实处。'],
  Wands_Knight: ['权杖骑士', 'Bold urgency charges forward — exciting, yet prone to skipping details.', 'Move fast on outreach, but verify execution checklists.', 'Guard against impulsive purchases or all-in bets.', 'Intense pursuit that can cool fast if patience fades.', 'Channel speed with a simple plan so effort doesn’t scatter.', '行动迅猛果敢，有冲劲但容易忽略细节。', '抢进度拓展极佳，但记得核对落地清单。', '冲动消费或重仓冒险是大忌，先算账再动手。', '热度来得快，需要实际承诺才能长久。', '把冲劲装进简单明确的计划里再冲。'],
  Wands_Queen: ['权杖皇后', 'Magnetic confidence and warm independence draw natural allies.', 'Lead openly and trust your creative instinct.', 'Confident negotiation and personal brand attract revenue.', 'Warm, self-assured presence keeps mutual attraction bright.', 'Own your space warmly without dimming anyone else.', '自信明艳、独立笃定的气场自然吸引助力。', '大胆掌舵发挥个人魅力与创意优势。', '个人口碑与自信议价会带来好回报。', '坦然做自己，自信与温暖最有吸引力。', '稳稳站住自己的光彩，坦荡前行。'],
  Wands_King: ['权杖国王', 'Visionary leadership aligns people around a clear bold direction.', 'Make the big strategic call and back it with accountability.', 'Think like an owner — build scalable systems, not odd jobs.', 'Generous, protective passion backs words with action.', 'Lead with big-picture clarity and steady integrity.', '具备格局与决断力，能带领众人朝大方向前行。', '拿出主帅担当拍板核心战略并扛起结果。', '用老板思维做可放大的结构，不纠结小利。', '热情大方且有担当，用行动守护关系。', '看准长远大局，果断又正直地推进。'],

  // === CUPS (14) ===
  Cups_Ace: ['圣杯王牌', 'A gentle wave of emotional clarity, empathy, and genuine warmth.', 'Work rooted in care and true passion flows effortlessly.', 'Financial kindness or joyful value alignment lifts morale.', 'Fresh affection, healing, or deep emotional openness.', 'Open your heart calmly and receive goodwill without cynicism.', '一股真诚流动的情感与灵性滋润缓缓开启。', '发自热爱或关怀他人的工作最易出彩。', '善意交流或合拍的合作带来轻松收益。', '心动、修复或深层情感流动明显。', '柔软打开心门，真诚接受当下善意。'],
  Cups_Two: ['圣杯二', 'Mutual understanding, sincere trust, and win-win alignment.', 'Balanced partnerships and fair agreements click smoothly.', 'Equitable deals benefit both sides cleanly.', 'Warm mutual affection and clear emotional reciprocity.', 'Meet halfway with honesty — collaboration multiplies strength.', '彼此理解、坦诚尊重的双赢契合。', '合作沟通格外顺畅，容易达成对等共识。', '公平合理的交易让双方都受益。', '两情相悦、回应热烈，彼此认真对待。', '真诚以礼相待，联手比单打独斗更有力量。'],
  Cups_Three: ['圣杯三', 'Shared joy, supportive friends, and welcoming community.', 'Team synergy, networking, and group launches bring energy.', 'Group collaborations or social referrals boost income.', 'Playful friendship and shared celebration brighten love.', 'Share good news with trusted allies and stay grateful.', '齐心同乐、挚友相伴与正向社交的喜悦。', '团队配合默契，行业社交带来好机会。', '通过社群口碑或协同合作扩大进账。', '与好友或伴侣相处轻松欢快，重温默契。', '多和同频的人联结，共享这份轻快好运。'],
  Cups_Four: ['圣杯四', 'Quiet apathy or selective boredom misses what is right beside you.', 'Routine feels stale; re-examine an overlooked option nearby.', 'Discontent clouds good-enough stability; don’t ignore steady assets.', 'Taking goodwill for granted cools warm ties.', 'Look up from frustration and notice one real opportunity offering help.', '心里略感提不起劲，容易忽略身旁已有的好机会。', '若觉得工作乏味，先看看身边是不是有被忽略的方案。', '别因不知足而忽视稳健收益，盲目折腾反倒吃亏。', '警惕因习以为常而冷落了真正关心你的人。', '抬头看一眼眼前递来的机会，先别急着拒绝。'],
  Cups_Five: ['圣杯五', 'Grief over spilled cups blinds you to the two still standing behind you.', 'Learn cleanly from one setback without writing off the whole plan.', 'One loss stings, yet solid assets remain untouched.', 'Dwelling on hurt hides existing care nearby.', 'Acknowledge disappointment, turn around, and work with what remains.', '过度盯着已经失去的三只杯子，忘了身后还有两只完好。', '从单次失误中总结经验即可，别全盘否定努力。', '虽有部分损失，核心本金与资源仍在，可重整再来。', '别一直困在遗憾里，看看还在身边支持你的人。', '允许失落一瞬，随后转身善用手里剩下的筹码。'],
  Cups_Six: ['圣杯六', 'Warm nostalgia, sincere kindness, or familiar roots bring comfort.', 'Old clients, past skills, or trusted teammates return to help.', 'Past goodwill pays back quietly today.', 'Sweet memories or a familiar person crosses paths warmly.', 'Value sincerity from the past without living backward.', '温暖的怀旧情怀、纯粹善意或故人重逢。', '老客户、老同事或旧日特长会在这波派上用场。', '过往积累的好口碑带来意外回报或关照。', '可能回忆起昔日情谊，或与熟人互动温暖。', '珍惜真诚的旧缘与初心，但脚步依然向前走。'],
  Cups_Seven: ['圣杯七', 'Too many tempting illusions scatter focus before reality is tested.', 'Narrow ten shiny ideas down to one measurable step.', 'Distrust glossy get-rich promises with fuzzy numbers.', 'Daydreaming about ideal versions hides the real person.', 'Test every bright promise against hard facts before picking one.', '眼花缭乱的选择与幻想太多，反而不容易下决心。', '别同时开太多摊子，先筛出一个能验证的小目标。', '警惕听起来很美却账目含糊的赚钱画饼。', '多看对方真实行为，少停留在浪漫想象里。', '做减法逐一验证现实条件，挑最扎实的一个。'],
  Cups_Eight: ['圣杯八', 'Outgrowing what no longer fulfills you and walking toward deeper truth.', 'Walk away gracefully from dead-end roles to seek real growth.', 'Release drained low-yield work to protect your future earning power.', 'Quietly moving on when emotional growth stalls.', 'Leave cleanly with dignity when you know a chapter is truly done.', '即使表面还能过，你心里已经明白是时候转身寻找更深意义。', '优雅告别缺乏成长空间的位置，去寻找真正适合的舞台。', '果断离开消耗精力却难有前景的赚苦钱模式。', '若情感早已没有回应或成长，成熟放手反而体面。', '想清楚就要转身，别在已没营养的关系里耗光力气。'],
  Cups_Nine: ['圣杯九', 'Quiet satisfaction, earned comfort, and personal wishes landing well.', 'Enjoy a confident win, yet check ego at the door.', 'Pleasant financial ease — keep saving amidst treats.', 'Warm contentment and appreciative affection.', 'Appreciate how far you’ve come and share warmth lightly.', '如愿以偿的满足感与踏实的好心情。', '工作迎来顺心成果，保持谦逊会让福气延续。', '手头宽松顺畅，享受成果的同时记得留存。', '彼此相处满足自在，心情舒畅。', '坦然欢喜自己的收获，并大方释放善意。'],
  Cups_Ten: ['圣杯十', 'Lasting harmony at home, deep belonging, and shared peace.', 'Healthy culture and aligned purpose turn work into real pride.', 'Shared household stability lets everyone breathe easier.', 'Deep commitment, warmth, and peaceful togetherness.', 'Protect the relationships that truly hold you up.', '家庭与亲密关系圆满和睦，内心感到深层安稳。', '工作氛围融洽、团队有归属感，做事更有底气。', '家庭或生活财务稳健幸福，后顾无忧。', '感情有归宿感、彼此信任支持，适合谈长久未来。', '用心维护那些真正让你感到安心的人与家。'],
  Cups_Page: ['圣杯侍从', 'Gentle curiosity, heartfelt messages, and soft intuition emerge.', 'Creative ideas and thoughtful gestures break the ice well.', 'Listen to soft intuition, though verify budgets formally.', 'Sweet, earnest affection or a heartfelt apology arrives.', 'Express feelings simply and stay open to gentle surprises.', '柔软的直觉、善意的讯息或温柔的新开始。', '适合创意表达与真诚示好，更容易拉近距离。', '灵光一闪不错，但落实投资前要查清数据。', '可能会收到真诚表白、关心讯息或温和示好。', '保留这份赤诚与温柔，简单直接表达心里话。'],
  Cups_Knight: ['圣杯骑士', 'Sincere idealism and diplomatic grace move hearts smoothly.', 'Lead pitches with empathy and refined storytelling.', 'Follow worthwhile passions, backed by solid contracts.', 'Romantic warmth and heartfelt invitations.', 'Back poetic promises with steady follow-through.', '浪漫真诚、风度翩翩地以柔克刚。', '用有温度的故事与共情力打动合作方。', '关注自己看重价值的领域，同时盯住合约保障。', '温柔主动的邀请与情感表达让人心动。', '让美好心意配合实际行动，别只停在氛围里。'],
  Cups_Queen: ['圣杯皇后', 'Deep empathy, calm emotional wisdom, and caring intuition.', 'Trust calm intuition around people while keeping firm work boundaries.', 'Give and spend from warmth, not guilt.', 'Deep listening creates rare safety and tenderness.', 'Hold space for others without absorbing every storm as yours.', '温润洞察人心的共情力与安静的内在智慧。', '敏锐读懂团队与客户情绪，同时守好工作边界。', '凭良知与直觉判断即可，别被同情心绑架买单。', '细腻的倾听与包容能带来极深的安全感。', '照顾别人的同时，记得把自己的情绪守在稳妥处。'],
  Cups_King: ['圣杯国王', 'Emotional maturity balances compassion with steady composure.', 'Steady diplomatic leadership settles storms calmly.', 'Generous yet measured stewardship keeps wealth steady.', 'Calm devotion and wise emotional stability.', 'Stay steady under emotional waves; respond rather than react.', '情绪成熟稳重，能兼顾温柔体谅与大局原则。', '老练周全地调和各方立场，定海神针般化解冲突。', '宽厚而不失分寸的资源管理，让人放心。', '深沉稳重的守护与沟通，值得托付。', '遇事沉得住气，用体谅与清醒共同处理情绪波动。'],

  // === SWORDS (14) ===
  Swords_Ace: ['宝剑王牌', 'Sharp mental breakthrough cuts cleanly through confusion.', 'Define the core truth, sign clearly, and state decisions concisely.', 'Analyze contracts and numbers with razor objectivity.', 'An honest, direct talk clears stale fog.', 'Speak clearly and act on the crisp insight you now hold.', '一把斩断迷雾的清醒利刃，事实终于清晰。', '立下清晰原则、抓准重点拍板推进。', '用冷静理性核对每一行条款与利润表。', '坦诚说清真实想法，比含糊拖延更健康。', '看清核心真相后，果断干脆地做出决定。'],
  Swords_Two: ['宝剑二', 'Deliberate stalemate avoids a painful choice you already sense.', 'Stop stalling between two safe options; gather the missing metric.', 'Frozen funds or indecision costs quiet opportunity.', 'Guarded silence protects pride while keeping both stuck.', 'Take off the blindfold, review two hard facts, and pick a side.', '陷入两难僵持，不愿正视眼前必须选边的现实。', '停止左右观望，补齐一个关键数据就动手拍板。', '资金或决断卡着不动反而错失时机。', '各自竖起心防沉默以对，问题只会一直悬着。', '摘下回避的眼罩，看清客观事实做出取舍。'],
  Swords_Three: ['宝剑三', 'Sharp disappointment hurts now, yet frees you from false illusions.', 'Accept honest critical feedback and fix the flaw cleanly.', 'Cut an unexpectedly poor deal cleanly rather than bleeding more.', 'A sting or misunderstanding needs gentle truth, not silence.', 'Face the painful truth briefly so real healing can begin.', '真话或失望刺痛人心，但也帮你打破不切实际的幻想。', '正视坦率的批评与问题所在，立刻补齐短板。', '遇到不如预期的亏损果断认赔，别越套越深。', '刺痛与误会已摊开，借此看清关系真实模样。', '允许痛一会儿，把教训看清楚就往前走。'],
  Swords_Four: ['宝剑四', 'Deliberate rest restores mental clarity before the next round.', 'Pause heated debates; step back to recharge your brain.', 'Hold major spending still while reviewing calmly.', 'Cool off tensions with quiet space instead of texting while upset.', 'Rest intentionally today — exhausted minds make costly mistakes.', '主动休整与沉默沉淀，是下一战前的必须充电。', '先暂停高强度争论或连轴转，给大脑恢复冷静。', '暂缓重大投资与大额开销，静心复盘账本。', '先各自冷静休息，别在疲惫或气头上硬聊。', '今天就给自己留出休整时间，精力回来了决策才会准。'],
  Swords_Five: ['宝剑五', 'Winning an argument at the cost of trust leaves everyone poorer.', 'Walk out of petty ego wars; protect real deliverables instead.', 'Beware sharp-tongued deals where one side walks away bitter.', 'Scoring points in a fight hurts the bond more than losing.', 'Pick peace and long-term dignity over winning a petty point.', '赢了口舌争执却输了信任，最终得不偿失。', '立刻退出无意义的意气之争，把精力留给正事。', '避开勾心斗角、互相算计的不体面合作。', '吵架非要压倒对方，只会把两颗心推得更远。', '别争一时口舌高低，保全长远局面与体面更重要。'],
  Swords_Six: ['宝剑六', 'Quietly sailing away from rough waters toward calmer shores.', 'Transition out of chaotic workflows toward orderly tools.', 'Gradual recovery after tight weeks — steady navigation wins.', 'Calm distance helps emotions settle down peacefully.', 'Move forward calmly even if your heart still misses the familiar.', '平静划离风浪区，逐步迈向更安稳的水域。', '整理交接混乱业务，过渡到更有序的新轨道。', '财务压力正慢慢退潮，循序稳住现金流就好。', '拉出适当空间降温沉淀，情绪逐渐恢复平稳。', '带着经历沉稳前行，不必回头纠结已经翻页的风浪。'],
  Swords_Seven: ['宝剑七', 'Shortcuts, half-truths, or quiet maneuvers carry hidden risk.', 'Watch quiet leaks, uncredited ideas, or vague excuses.', 'Check every fee and hidden clause — don’t trust verbal claims.', 'Mixed signals or hidden agendas erode trust fast.', 'Operate openly and verify other people’s actions independently.', '小心投机取巧、隐瞒实情或暗度陈仓的风险。', '留神工作中的推诿、甩锅或不够透明的私下动作。', '仔细核查隐藏手续费与条款漏洞，口头承诺不算数。', '觉得对方言行有矛盾或藏着事时，先冷静观察。', '自己做事堂堂正正，对别人的做法多核实几分。'],
  Swords_Eight: ['宝剑八', 'You feel boxed in, yet the bindings are mostly self-imposed fear.', 'Challenge "no other option" thinking — ask someone neutral.', 'Anxious scarcity mindset hides practical exits already open.', 'Fear of rejection locks honest words inside.', 'Identify one assumption you treated as an unbreakable wall and test it.', '感觉四面受困，其实束缚你的大半是自己脑中的恐惧。', '打破“没得选”的死胡同，找局外前辈聊聊就能看到出口。', '过度焦虑缺钱反而看不见手头还能变现或省下的路。', '害怕受伤而自我封闭，其实对方未必那么拒人于千里。', '挑出一条你以为“绝不可能”的假设，去亲手试探一次。'],
  Swords_Nine: ['宝剑九', '3 AM worry magnifies risks way beyond daylight reality.', 'Write worries down with real numbers so panic loses power.', 'Anxious catastrophizing creates rash decisions; inspect real balances.', 'Unspoken fear spirals internally — talk kindly in daylight.', 'Separate real facts from nightmare loops and prioritize sleep.', '深夜的过度焦虑把问题放大了好几倍，天亮其实没那么糟。', '把担心的事逐条列出对应数据与对策，恐慌立刻减半。', '别在焦虑情绪最重时盲目割肉或乱做财务决定。', '闷在心里胡思乱想最伤神，白天心平气和沟通清楚。', '先把事实和脑补分开，今晚先好好睡一觉。'],
  Swords_Ten: ['宝剑十', 'Rock bottom is finally over — the worst has hit, so dawn begins.', 'Close out broken plans completely rather than patching corpses.', 'Accept a settled loss cleanly and reset from zero.', 'An exhausting tension ends decisively; relief follows honesty.', 'Do not mourn a dead pattern; stand up and face morning light.', '最沉重低谷已触底结束，从此刻起只会慢慢好转。', '彻底翻篇不再挽救已经失败的旧路，才能迎来新光。', '明确清零已成定局的损失，调整姿势重新出发。', '长期拉锯耗尽心力的局面终于到头，说散就轻松了。', '别再盯着过去疼，站起身迎接下一段亮光。'],
  Swords_Page: ['宝剑侍从', 'Alert curiosity, quick observation, and sharp questioning lead well.', 'Verify facts fast and keep your notes crisp.', 'Compare terms and read fine print like a hawk.', 'Over-analyzing texts can start unnecessary sparks; ask gently.', 'Stay alert and curious without slipping into petty suspicion.', '思绪敏锐、善于观察搜证，说话直指要点。', '快速核实资料与市场动向，用清晰逻辑沟通。', '货比三家精查细节条款，不容易吃暗亏。', '别过度解读只言片语，好奇时直接温和问清楚。', '保持敏锐与求知欲，同时注意说话别带刺。'],
  Swords_Knight: ['宝剑骑士', 'Fast, incisive charge cuts through delay — just watch collateral damage.', 'Speak plainly and execute fast while ensuring allies can keep up.', 'Move decisively on clear data, never on hot temper.', 'Sharp honesty solves things fast if wrapped in basic care.', 'Pair sharp speed with one pause to check tone before hitting send.', '言行极其犀利迅猛，破局力强但容易误伤旁人。', '快准狠推进决策，同时顾及队友能否跟上步伐。', '认准客观数据可果断下单，但切忌在火气上冲动。', '有话直说虽然痛快，注意语气分寸才不伤感情。', '出招前先停两秒确认表达温度，效率会更高。'],
  Swords_Queen: ['宝剑皇后', 'Independent clarity, crisp boundaries, and fair objectivity shine.', 'Cut fluff from meetings and uphold clean standards.', 'Evaluate purchases and deals on strict merit alone.', 'Clear communication and healthy boundaries win respect.', 'Be honest, fair, and direct without growing cold.', '清醒独立、边界明晰，用客观与阅历看透本质。', '砍掉虚头巴脑的客套，直接抓重点立标准。', '仅凭实际价值做财务判断，不吃人情绑架。', '温柔而清晰地讲明底线，反而赢得真尊重。', '做到坦荡公正又留有余地，不把客观变成冷漠。'],
  Swords_King: ['宝剑国王', 'Strategic clarity, ethical judgement, and cool command.', 'Seek specialist advice or analyze rules strictly before signing.', 'Use clear legal and financial logic to protect long-term interests.', 'Calm fairness keeps difficult conversations constructive.', 'Think three moves ahead and let solid reason lead.', '冷静睿智、逻辑严密，擅长站在高处公正裁断。', '审慎运用专业规则与长线战略，把控全局风险。', '依靠扎实财务结构与法务保障守住权益。', '沟通理性稳重，能用道理化解情绪对立。', '多想三步再下子，让清晰理性牵引每一步。'],

  // === PENTACLES (14) ===
  Pentacles_Ace: ['星币王牌', 'A concrete seed of wealth, health, or real opportunity lands in hand.', 'Say yes to tangible offers, solid projects, or steady upgrades.', 'Real earning potential opens up — nurture it steadily.', 'Grounded reliability and sincere practical gestures build trust.', 'Plant this solid seed diligently instead of chasing flashier mirage.', '实打实的机会、财源或健康根基正在落到手中。', '接住手头实在的新任务、新邀约或扎实机会。', '正财运与稳定增收苗头明显，踏实经营能滚大。', '务实可靠的行动与贴心关照让感情更有安全感。', '好好耕耘这颗摆在面前的稳妥种子，别三心二意。'],
  Pentacles_Two: ['星币二', 'Juggling time, cash, and shifting priorities takes nimble rhythm.', 'Balance two workflows smoothly without dropping core deadlines.', 'Manage cash-flow timing tightly; track inflows and due dates.', 'Make real time for each other amid busy schedules.', 'Simplify one commitment before the juggling rhythm slips.', '同时兼顾多件事务与资金周转，全靠节奏调配。', '灵活统筹手头多线任务，别让重要死线脱手。', '精打细算收支时间差，按优先级排好付款与回款。', '再忙也别只顾着赶路，抽空好好回复与陪伴。', '节奏吃紧时先砍掉一件次要事务，稳住平衡。'],
  Pentacles_Three: ['星币三', 'Craftsmanship, respected teamwork, and visible skill pay off.', 'Collaborate closely with specialists; quality builds reputation.', 'Consistent craft earns reliable clients and fair pricing.', 'Building everyday life together through practical teamwork.', 'Refine details patiently and value every skilled contributor.', '凭扎实手艺与专业分工打磨出叫好又叫座的成果。', '多和靠谱专业的人配合打磨细节，口碑自然立住。', '靠真本事与稳定品质赢得客户复购和合理报酬。', '像搭档一样分工协作把日子过好，感情越处越稳。', '认真打磨手头每处细节，尊重团队里每一份专业。'],
  Pentacles_Four: ['星币四', 'Holding too tightly brings safety now, yet risks stagnation later.', 'Share key knowledge and adapt rather than hoarding control.', 'Good discipline on saving, yet avoid fear-driven stinginess.', 'Guarded possession stiffens natural closeness.', 'Keep core reserves safe while loosening grip where growth wants flow.', '守成意识很强，手里稳妥但抓太紧容易僵化停滞。', '别把所有东西攥在自己手里死守，适当授权与更新思路。', '储蓄风控很好，但别因过度抠门错失合理投入机会。', '占有欲或害怕失去会让相处紧绷，放松些才更自在。', '保住底线备用金，把多余的焦虑与控制欲松一松。'],
  Pentacles_Five: ['星币五', 'Temporary scarcity or feeling left out asks you to seek real help.', 'Do not struggle silently; ask peers or rework pricing.', 'Trim non-essentials promptly and pause risky outflows.', 'Cold distance improves the moment pride stops blocking honesty.', 'Step inside the warm door — practical support is closer than pride admits.', '经历暂时的紧张期或孤立感，切忌硬扛不吭声。', '主动向团队或前辈求助并调整做法，别独自死撑。', '果断缩减非必要开支，暂停高风险消耗。', '冷战与疏离感往往来自各自赌气，先开口示好就有暖意。', '放下没用的面子去借力，帮助其实就在身旁。'],
  Pentacles_Six: ['星币六', 'Generous balance where giving and receiving stay fair and dignified.', 'Share credit and fair pay cleanly; mutual investment works.', 'Balanced cash flow — settle debts or negotiate fair terms.', 'Give and receive care equally so neither burns out.', 'Keep every exchange fair and transparent, with clear terms.', '有来有往、施受平衡的良性资源流动。', '利益与功劳分配公道，合作方彼此愿意持续付出。', '收支流通健康，适合清偿往来或谈妥合理条件。', '付出与被爱保持对等，才不会一方累另一方习惯。', '保持互惠公平与账目清楚，好运才会循环不断。'],
  Pentacles_Seven: ['星币七', 'Quiet patience lets planted effort ripen — inspect, adjust, wait.', 'Audit progress calmly; tweak weak spots without uprooting everything.', 'Compounding returns take time; review asset mix thoughtfully.', 'Relationship growth shows in slow steady patience.', 'Check real results soberly, prune dead effort, and let good seeds mature.', '已播下汗水与成本，现在需要耐心等待、复盘修枝。', '冷静评估阶段回报，微调方法但别轻易推翻重来。', '复利与口碑都要时间发酵，定期检视配置即可。', '感情沉淀需要时间观察真实磨合度，急不得。', '认真审视哪些投入真的见效，耐心养大优质成果。'],
  Pentacles_Eight: ['星币八', 'Deep focus, daily craft, and steady repetition turn skill into mastery.', 'Put your head down and build solid repeatable quality every day.', 'Steady, reliable income grows through honing high-value craft.', 'Showing up reliably in small everyday ways builds deep love.', 'Master the daily reps — consistent quality beats shortcuts.', '沉下心来反复打磨手艺，专注每一天的基础功。', '少看热闹多做事，每天精进一小步就能拉开差距。', '正财与副业靠稳定交付与过硬本领持续增收。', '把爱意藏在踏实的日常小事里，远胜虚浮承诺。', '耐住性子把基本功做到极致，时间一定会回报你。'],
  Pentacles_Nine: ['星币九', 'Self-made abundance, quiet elegance, and independent peace.', 'Independent expertise commands premium respect.', 'Healthy savings and lifestyle freedom built on your own grit.', 'Secure, self-reliant warmth makes closeness healthier.', 'Enjoy what your discipline built without neglecting genuine connection.', '靠自身实力赢来的从容富足、体面与独立自信。', '个人专业力足够站稳脚跟，值得争取更高价值定位。', '收支有余、财务自主，生活质感明显提升。', '各自精神经济独立，在一起是锦上添花。', '大方享受努力换来的安稳，同时保持与人的真诚连接。'],
  Pentacles_Ten: ['星币十', 'Generational stability, lasting assets, and solid shared legacy.', 'Build durable systems, family/team wealth, and long-horizon value.', 'Long-term wealth, property, or family assets settle securely.', 'Deep commitment backed by shared daily life and family warmth.', 'Invest for the multi-year arc rather than quick applause.', '基业稳固、长远传承与看得见的富足安康。', '打造能持续多年的平台、系统与稳健团队班底。', '适合着眼长期资产、房产或家庭财务的厚实积累。', '感情走入现实扎根与双方家庭接纳的安稳阶段。', '多做三五年后还会感谢自己的长期选择。'],
  Pentacles_Page: ['星币侍从', 'Grounded learning, practical study, and careful first steps.', 'Learn a concrete tool or build a clean pilot before scaling.', 'Start steady saving or learn sound financial basics carefully.', 'Sincere, careful gestures speak louder than big promises.', 'Treat every small task like solid groundwork for bigger wins.', '踏实好学、注重实际细节，把第一步踩得极稳。', '认真钻研一门实用技能或先把最小样板做精细。', '从记账储蓄与小步稳投开始打好财富基本盘。', '真诚憨厚地用实际关心慢慢拉近距离。', '珍惜每个看似不起眼的小任务，它们正是未来的底座。'],
  Pentacles_Knight: ['星币骑士', 'Slow, methodical grit finishes what flashy sprints abandon.', 'Stick to the daily checklist cleanly; unglamorous consistency wins.', 'Slow, low-risk growth beats dramatic gambles every time.', 'Loyal, predictable dependability brings lasting reassurance.', 'Keep honoring every step of your plan even when pace feels slow.', '虽然节奏不算飞快，但一步一脚印绝不半途而废。', '老老实实照计划把细节做完，稳健度碾压三分钟热度。', '坚持低风险长期稳赚路线，远离浮躁投机。', '慢热却极其靠谱守信，能用时间证明真心。', '沉住气按清单稳步推进，稳健本身就是最快。'],
  Pentacles_Queen: ['星币皇后', 'Warm practicality, nurturing stewardship, and grounded calm.', 'Manage budgets, people, and comfort with calm hands-on skill.', 'Nurture steady income while keeping home and reserves cozy.', 'Warm, attentive care makes partners feel genuinely cherished.', 'Care for your body, space, and finances like a fertile garden.', '务实温柔、把生活与账目都打理得井井有条的智慧。', '统筹预算与日常运营游刃有余，给人稳稳的后方支撑。', '开源节流兼顾品质生活，钱包与生活都很舒服。', '用贴心周全的陪伴与实在的照料呵护感情。', '像照料花园一样照顾好身体、居所与存款。'],
  Pentacles_King: ['星币国王', 'Seasoned mastery, rock-solid reliability, and lasting prosperity.', 'Lead with calm commercial judgment, quality, and long-term patience.', 'Strong wealth stewardship — compound reliable assets prudently.', 'Quietly protective loyalty that backs commitment with real stability.', 'Build tangible value patiently and honor every word you give.', '成熟稳健的掌舵者，用实力与信用筑起长久财富。', '展现成熟的商业眼光与耐性，专注打造长青成果。', '财务掌控力强，适合稳健放大优质资产。', '踏实有担当、言出必行，带来极强的安稳与信任。', '继续沉淀硬实力与口碑，说话算话自然成大事。']
};

/**
 * Resolve card meanings localized to 'th' | 'en' | 'zh'
 */
export function getLocalizedCardData(card, lang = 'th') {
  const target = normalizeLang(lang);
  if (!card) {
    return {
      title: '',
      subtitle: '',
      suitLabel: '',
      core: '',
      work: '',
      money: '',
      love: '',
      advice: ''
    };
  }
  const arr = CARDS_I18N[card.uid];
  const zhTitle = arr?.[0] || card.name;
  if (target === 'en') {
    return {
      title: card.name,
      subtitle: card.suit === 'Major' ? 'Major Arcana' : `${card.suit}`,
      suitLabel: getLocalizedSuitLabel(card.suit, 'en'),
      core: arr?.[1] || card.core,
      work: arr?.[2] || card.work,
      money: arr?.[3] || card.money,
      love: arr?.[4] || card.love,
      advice: arr?.[5] || card.advice
    };
  }
  if (target === 'zh') {
    return {
      title: zhTitle,
      subtitle: card.name,
      suitLabel: getLocalizedSuitLabel(card.suit, 'zh'),
      core: arr?.[6] || card.core,
      work: arr?.[7] || card.work,
      money: arr?.[8] || card.money,
      love: arr?.[9] || card.love,
      advice: arr?.[10] || card.advice
    };
  }
  return {
    title: card.name,
    subtitle: card.th,
    suitLabel: getLocalizedSuitLabel(card.suit, 'th'),
    core: card.core,
    work: card.work,
    money: card.money,
    love: card.love,
    advice: card.advice
  };
}

export function getLocalizedSuitLabel(suit, lang = 'th') {
  const target = normalizeLang(lang);
  return SUIT_LABELS_I18N[target]?.[suit] || suit;
}

export function getLocalizedCelticPositions(lang = 'th') {
  return CELTIC_POSITIONS_I18N[normalizeLang(lang)] || CELTIC_POSITIONS_I18N.th;
}

export function getLocalizedCardLabelInline(card, lang = 'th') {
  const target = normalizeLang(lang);
  if (!card) return '';
  if (target === 'en') return card.name;
  if (target === 'zh') {
    const zh = CARDS_I18N[card.uid]?.[0];
    return zh ? `${zh} (${card.name})` : card.name;
  }
  return `${card.name} (${card.th})`;
}

export function getLocalizedCardShortName(card, lang = 'th') {
  const target = normalizeLang(lang);
  if (!card) return '';
  if (target === 'zh') return CARDS_I18N[card.uid]?.[0] || card.name;
  if (target === 'en') return card.name;
  return card.th || card.name;
}
