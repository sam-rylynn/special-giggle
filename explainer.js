/* =============================================================================
 * 知星 V1 · 解释层 v0(规则模板)+ 一问一卦(简化时间卦)
 * 定位:AI 解释层接入前的可测替身。输出结构与 prompts.md §1 完全一致
 * ({sections:[{id,title,source,body}]}),AI 接入后按 section 平滑替换。
 * 合规:全部"倾向/往往/容易"措辞;每段带「来源:」;零吉凶断语。
 * ========================================================================== */
'use strict';

/* ---------- 十神语料(倾向措辞,三个语境) ---------- */
const TG = {
  比肩: { core:'自成坐标,不太依赖外部认可', rel:'与人并肩时舒服,被指挥时容易起反骨', act:'倾向自己上手,不爱层层汇报' },
  劫财: { core:'行动带冲劲,分享欲与胜负欲并存', rel:'对自己人大方,边界感往往后知后觉', act:'起步快,收尾容易交给热情的余温' },
  食神: { core:'表达松弛,能把日子过出滋味', rel:'用照顾和分享靠近人,不太用言语表忠心', act:'享受过程,节奏被催会明显失速' },
  伤官: { core:'聪明外露,规则面前先问一句凭什么', rel:'欣赏聪明人,容易对平庸失去耐心', act:'点子多,落地常需要一个收口的人' },
  偏财: { core:'机会嗅觉灵,资源在手上是流动的', rel:'人缘广而轻,深交名单其实很短', act:'多线并行,单线深耕容易觉得闷' },
  正财: { core:'一分耕耘一分收获是底层信条', rel:'靠稳定付出建立信任,慢热但持久', act:'按部就班,突发变更会先皱眉再消化' },
  七杀: { core:'压力驱动型,越难越清醒', rel:'敬强者,带人偏严,温柔藏在结果里', act:'目标导向,过程可以硬扛,情绪后置' },
  正官: { core:'自律与秩序感刻在出厂设置里', rel:'重承诺守边界,失约的人很难有第二次', act:'先定规则再动手,弹性是刻意练出来的' },
  偏印: { core:'思路偏锋,常在冷门处看见东西', rel:'慢热敏感,靠近你的人需要通过时间考验', act:'研究型选手,兴趣是唯一持久的燃料' },
  正印: { core:'吸收与庇护型,天生学得进也照顾得住', rel:'习惯当靠山,索取这件事反而不熟练', act:'谋定后动,准备不足时宁可不出手' },
  日主: { core:'', rel:'', act:'' }
};
const ELEM_FLAVOR = { 木:'生长与展开', 火:'表达与照亮', 土:'承载与稳定', 金:'裁断与结构', 水:'流动与感知' };

function pick(tenGods, keys){
  const out = [];
  for (const k of ['year','month','hour']){
    const g = tenGods[k];
    if (g && TG[g.stem] && keys.includes(g.stem)) out.push({ pos:k, god:g.stem });
  }
  return out;
}
const POS_CN = { year:'年柱', month:'月柱', hour:'时柱' };

/* ---------- 八章规则模板 ---------- */
function buildSections(chart){
  const p = chart.pillars, dm = chart.dayMaster, fe = chart.fiveElements, tg = chart.tenGods;
  const S = [];
  const gz = k => p[k] ? p[k].stem + p[k].branch : '—';

  /* overview */
  let ovBody = `${dm.stem}${dm.element}(${dm.yinyang})生于${p.month.branch}月,四柱 ${gz('year')} ${gz('month')} ${gz('day')} ${gz('hour')}。${dm.element}主${ELEM_FLAVOR[dm.element]},这是你能量的底色。来源:四柱·日主`;
  if (chart.boundaries.length) ovBody = `⚠ 你的出生时刻接近排盘边界(${chart.boundaries.map(b=>b.type).join('、')}),以下结论以精校排盘为准。来源:边界告警\n\n` + ovBody;
  S.push({ id:'overview', title:'命局总览', source:'四柱+日主', body: ovBody });

  /* energy */
  const ranked = Object.entries(fe.counts).sort((a,b)=>b[1]-a[1]);
  const [maxE, minE] = [ranked[0], ranked[ranked.length-1]];
  const st = fe.dayMasterStrength;
  S.push({ id:'energy', title:'五行能量图谱', source:'五行计数+强弱依据',
    body: `你盘中最厚的能量是${maxE[0]}(${maxE[1]}),最薄的是${minE[0]}(${minE[1]})——${ELEM_FLAVOR[maxE[0]]}是你的富矿,${ELEM_FLAVOR[minE[0]]}则往往需要刻意补位。来源:五行计数\n\n本盘计分显示日主${st.label}(${st.score}),依据:${st.basis.join(';')}。这不是定论,而是能量配置的一种读法。来源:强弱计分 v0` });

  /* skeleton */
  const mGod = tg.month && TG[tg.month.stem] ? tg.month.stem : null;
  const mLine = mGod ? `月令天干透出${mGod}:${TG[mGod].core}。` : '';
  const others = pick(tg, Object.keys(TG)).filter(x=>x.pos!=='month').slice(0,2)
    .map(x=>`${POS_CN[x.pos]}${x.god}——${TG[x.god].core}`).join(';');
  S.push({ id:'skeleton', title:'性格骨架', source:'日主+月令+十神',
    body: `${mLine}${others ? others + '。' : ''}月令是性格的主梁,年柱往往写着来处的印记,时柱则倾向指向你晚成的那一面。来源:十神·${mGod || '月令'}` });

  /* relation */
  const relHits = pick(tg, ['正官','七杀','正印','偏印','比肩','劫财']).slice(0,2);
  const relBody = relHits.length
    ? relHits.map(x=>`${POS_CN[x.pos]}${x.god}:${TG[x.god].rel}`).join('。') + '。来源:十神·官杀印比'
    : `你的盘面官杀印比不显,关系里往往更依赖食伤财的方式——用做事和给予来表达在乎。来源:十神分布`;
  S.push({ id:'relation', title:'关系与协作', source:'十神·官杀印比', body: relBody });

  /* action */
  const actHits = pick(tg, ['食神','伤官','偏财','正财']).slice(0,2);
  const actBody = actHits.length
    ? actHits.map(x=>`${POS_CN[x.pos]}${x.god}:${TG[x.god].act}`).join('。') + '。来源:十神·食伤财'
    : `食伤财在天干不显,你的行动力更常由${st.label==='偏强'?'比劫的冲劲':'印星的准备感'}驱动——想清楚才动,但动了就不轻易停。来源:十神分布`;
  S.push({ id:'action', title:'行动与决策', source:'十神·食伤财', body: actBody });

  /* phase */
  const phaseMap = {
    偏强: '能量偏盛,更适合"出与泄"——把力气花在表达、创造、带动别人上;憋着不动,反而容易内耗成脾气。',
    偏弱: '能量偏收,更适合"收与养"——少揽不属于你的仗,把睡眠、独处和滋养你的人事往前排。',
    中和: '能量大体平衡,守中即可——别刻意补什么,重点在维持你已经跑通的节奏。'
  };
  S.push({ id:'phase', title:'当前的进与收', source:'强弱计分(大运 V1.1 接入)',
    body: `${phaseMap[st.label]}这只是静态盘的读法,叠加大运流年的时间轴是 V1.1 的事。来源:强弱计分 v0` });

  return S;
}

/* ---------- 一问一卦:简化时间卦 v0 ----------
 * 规则(公开可复算):上卦 =(年支序 + 公历月 + 公历日)% 8;
 * 下卦 =(上卦和 + 时辰序 + 问题字数)% 8;动爻 = 下卦和 % 6。余 0 取 8/6。
 * 系公历近似的梅花时间卦变体,V1 接农历精算;只解结构与侧重,不做吉凶断语。 */
const TRIGRAMS = ['乾','兑','离','震','巽','坎','艮','坤'];          // 序 1..8
const TRI_LINES = { 乾:[1,1,1], 兑:[1,1,0], 离:[1,0,1], 震:[1,0,0], 巽:[0,1,1], 坎:[0,1,0], 艮:[0,0,1], 坤:[0,0,0] }; // 自下而上
const TRI_ELEM = { 乾:'金', 兑:'金', 离:'火', 震:'木', 巽:'木', 坎:'水', 艮:'土', 坤:'土' };
const TRI_IMG  = { 乾:'天', 兑:'泽', 离:'火', 震:'雷', 巽:'风', 坎:'水', 艮:'山', 坤:'地' };
const HEX_NAME = { /* [上][下] */
  乾:{乾:'乾为天',兑:'天泽履',离:'天火同人',震:'天雷无妄',巽:'天风姤',坎:'天水讼',艮:'天山遁',坤:'天地否'},
  兑:{乾:'泽天夬',兑:'兑为泽',离:'泽火革',震:'泽雷随',巽:'泽风大过',坎:'泽水困',艮:'泽山咸',坤:'泽地萃'},
  离:{乾:'火天大有',兑:'火泽睽',离:'离为火',震:'火雷噬嗑',巽:'火风鼎',坎:'火水未济',艮:'火山旅',坤:'火地晋'},
  震:{乾:'雷天大壮',兑:'雷泽归妹',离:'雷火丰',震:'震为雷',巽:'雷风恒',坎:'雷水解',艮:'雷山小过',坤:'雷地豫'},
  巽:{乾:'风天小畜',兑:'风泽中孚',离:'风火家人',震:'风雷益',巽:'巽为风',坎:'风水涣',艮:'风山渐',坤:'风地观'},
  坎:{乾:'水天需',兑:'水泽节',离:'水火既济',震:'水雷屯',巽:'水风井',坎:'坎为水',艮:'水山蹇',坤:'水地比'},
  艮:{乾:'山天大畜',兑:'山泽损',离:'山火贲',震:'山雷颐',巽:'山风蛊',坎:'山水蒙',艮:'艮为山',坤:'山地剥'},
  坤:{乾:'地天泰',兑:'地泽临',离:'地火明夷',震:'地雷复',巽:'地风升',坎:'地水师',艮:'地山谦',坤:'坤为地'}
};
const GEN5 = { 木:'火', 火:'土', 土:'金', 金:'水', 水:'木' };

function castGua(now, question){
  const BR = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate(), hh = now.getHours();
  const yearBranchIdx = ((y - 4) % 12 + 12) % 12;            // 甲子纪年:公元4年为甲子
  const hourIdx = Math.floor(((hh + 1) % 24) / 2);           // 子=0…
  const qLen = (question || '').replace(/\s/g, '').length;
  const s1 = yearBranchIdx + 1 + m + d;
  const upper = TRIGRAMS[(s1 % 8 || 8) - 1];
  const s2 = s1 + hourIdx + 1 + qLen;
  const lower = TRIGRAMS[(s2 % 8 || 8) - 1];
  const moving = (s2 % 6 || 6);                               // 1..6,自下而上
  const name = HEX_NAME[upper][lower];
  /* 体用:动爻在下卦(1-3)→ 下卦为用、上卦为体;在上卦(4-6)→ 反之 */
  const movingInLower = moving <= 3;
  const ti = movingInLower ? upper : lower, yong = movingInLower ? lower : upper;
  const tiE = TRI_ELEM[ti], yongE = TRI_ELEM[yong];
  let relation;
  if (tiE === yongE) relation = '体用同气,事在自己节奏里,内外一致时推进最顺';
  else if (GEN5[yongE] === tiE) relation = '用生体,外境在给你输送养分,适合顺势承接';
  else if (GEN5[tiE] === yongE) relation = '体生用,这件事在消耗你的投入,留意付出的度';
  else if ((tiE==='木'&&yongE==='土')||(tiE==='土'&&yongE==='水')||(tiE==='水'&&yongE==='火')||(tiE==='火'&&yongE==='金')||(tiE==='金'&&yongE==='木')) relation = '体克用,主动权倾向在你,难在坚持而不在阻力';
  else relation = '用克体,外部约束感偏强,宜先稳住节奏再图进';
  const lines = [...TRI_LINES[lower], ...TRI_LINES[upper]];   // 六爻自下而上
  return {
    name, upper, lower, moving, lines,
    upperImg: TRI_IMG[upper], lowerImg: TRI_IMG[lower],
    body: `得「${name}」:上${TRI_IMG[upper]}下${TRI_IMG[lower]},动在第${moving}爻。${relation}。卦象说的是当下这件事的结构与侧重,不是结局。来源:卦象·${name}(简化时间卦 v0)`,
    rule: '起卦规则:(年支序+月+日)%8 为上卦,加时辰序与问题字数 %8 为下卦,总和 %6 为动爻(公历近似,V1 接农历精算)'
  };
}

/* ---------- 校验器(prompts.md §4 的客户端版) ---------- */
const BANNED = /算命|测吉凶|改运|消灾|破财|血光|灾祸|克夫|克妻|寿命|一定|注定|必然|必将/;
function validateSections(sections, chart){
  const gzPairs = new Set();
  Object.values(chart.pillars).filter(Boolean).forEach(p => gzPairs.add(p.stem + p.branch));
  return sections.map(s => {
    const issues = [];
    if (BANNED.test(s.body)) issues.push('禁词/断言');
    if (!/来源:/.test(s.body)) issues.push('缺来源标注');
    /* 幻觉干支检测:扫"天干+地支"相邻对(如"乙亥"),必须属于本盘四柱 */
    const pairs = s.body.match(/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/g) || [];
    for (const pr of pairs) if (!gzPairs.has(pr)) { issues.push('干支越界:' + pr); break; }
    return { ...s, issues };
  });
}

const Explainer = { buildSections, castGua, validateSections, TG };
if (typeof module !== 'undefined' && module.exports) module.exports = Explainer;
if (typeof window !== 'undefined') window.Explainer = Explainer;
