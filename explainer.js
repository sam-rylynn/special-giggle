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

/* ---------- 星盘辅证语料(太阳=外显人格 / 月亮=情绪底色 / 上升=示人剖面) ---------- */
const SIGN_LINE = { 白羊座:'第一反应永远是"上"', 金牛座:'认定之前很慢,认定之后极稳', 双子座:'好奇心过载的旁观者', 巨蟹座:'壳硬心软,记性太好', 狮子座:'可以累,不能狼狈', 处女座:'对自己的标准最狠', 天秤座:'替所有人着想,所以内耗', 天蝎座:'看穿不说穿', 射手座:'困住你的只有"没意思"', 摩羯座:'把野心藏进沉默', 水瓶座:'和谁都聊得来,不属于任何圈', 双鱼座:'别人的情绪会漫进身体' };
const MOON_LINE = { 白羊座:'情绪来得快去得也快,气头上的话别当真', 金牛座:'安全感来自可预期,变动最先惊动你的胃', 双子座:'情绪要说出来才算数,憋着就发酵成焦虑', 巨蟹座:'记得所有人的好,也记得所有人的忘记', 狮子座:'需要被看见,被忽视比被反驳更伤', 处女座:'习惯用"没事"处理所有的事', 天秤座:'不舒服也先照顾场面,回家才算总账', 天蝎座:'信任只有全给和全收,没有中间档', 射手座:'难过的第一反应是逃向远方', 摩羯座:'把情绪当成本,能不动用就不动用', 水瓶座:'要先离开现场,才能承认自己有情绪', 双鱼座:'分不清是自己的情绪,还是替别人吸的' };
const RISE_LINE = { 白羊座:'人群里最先动的那个', 金牛座:'稳到让人误以为没脾气', 双子座:'用聊天打开所有局面', 巨蟹座:'先确认安全,再决定进场', 狮子座:'人未到,气场先到', 处女座:'挑剔,是你的第一层认真', 天秤座:'分寸感好到让人看不出立场', 天蝎座:'安静,但没人敢造次', 射手座:'自来熟,先笑再说', 摩羯座:'端着,直到确认值得', 水瓶座:'疏离感是出厂设置', 双鱼座:'看起来好说话,其实在飘' };
const SIGN_WEST = { 白羊座:'火',狮子座:'火',射手座:'火',金牛座:'土',处女座:'土',摩羯座:'土',双子座:'风',天秤座:'风',水瓶座:'风',巨蟹座:'水',天蝎座:'水',双鱼座:'水' };
const WEST2WX = { 火:'火', 土:'土', 风:'木', 水:'水' };   // 风象取巽木之象(巽为风,属木)

/* 太阳星座 × 日主:两盘交叉读法(同气/相生/张力) */
function sunCross(sign, dmElem){
  const w = SIGN_WEST[sign], e = WEST2WX[w], s2 = sign.slice(0, 2);
  const tag = w === '风' ? `${s2}属风象,易理取巽木之象` : `${s2}属${w}象`;
  if (e === dmElem) return `${tag},与你的日主${dmElem}同气——两套体系在这里互相点头:里外一套系统,你最省力的活法就是不装。`;
  if (GEN5[e] === dmElem) return `${tag},五行上${e}生${dmElem}——外显的气质在给内核供能,越表达越有力气,这是双盘互证出的顺流。`;
  if (GEN5[dmElem] === e) return `${tag},五行上${dmElem}生${e}——内核在给外显供血,人前发光,独处断电,记得给自己留一个充电位。`;
  return `${tag},与日主${dmElem}之间有张力——你常被说"看不透",那不是伪装,是两套都真;这份反差,恰恰是双盘互证要你看见的部分。`;
}

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

  /* overview(太阳星座辅证织入) */
  const ast = chart.astro;
  let ovBody = `${dm.stem}${dm.element}(${dm.yinyang})生于${p.month.branch}月,四柱 ${gz('year')} ${gz('month')} ${gz('day')} ${gz('hour')}。${dm.element}主${ELEM_FLAVOR[dm.element]},这是你能量的底色。来源:四柱·日主`;
  if (ast && ast.sun)
    ovBody += `\n\n同一时刻,天空给出了第二份档案:太阳落${ast.sun.sign}——${SIGN_LINE[ast.sun.sign]}。${sunCross(ast.sun.sign, dm.element)}来源:星盘辅证·太阳${ast.sun.sign}`;
  if (chart.boundaries.length) ovBody = `⚠ 你的出生时刻接近排盘边界(${chart.boundaries.map(b=>b.type).join('、')}),以下结论以精校排盘为准。来源:边界告警\n\n` + ovBody;
  S.push({ id:'overview', title:'命局总览', source:'四柱+日主+太阳星座', body: ovBody });

  /* energy */
  const ranked = Object.entries(fe.counts).sort((a,b)=>b[1]-a[1]);
  const [maxE, minE] = [ranked[0], ranked[ranked.length-1]];
  const st = fe.dayMasterStrength;
  S.push({ id:'energy', title:'五行能量图谱', source:'五行分布+日主强弱',
    body: `你盘中最厚的能量是${maxE[0]}(${maxE[1]}),最薄的是${minE[0]}(${minE[1]})——${ELEM_FLAVOR[maxE[0]]}是你的富矿,${ELEM_FLAVOR[minE[0]]}则往往需要刻意补位。来源:五行分布\n\n按传统"得令、得地、得势"三看,本盘日主${st.label}(${st.basis.join(';')})。这不是定论,而是能量配置的一种读法。来源:日主强弱` });

  /* skeleton */
  const mGod = tg.month && TG[tg.month.stem] ? tg.month.stem : null;
  const mLine = mGod ? `月令天干透出${mGod}:${TG[mGod].core}。` : '';
  const others = pick(tg, Object.keys(TG)).filter(x=>x.pos!=='month').slice(0,2)
    .map(x=>`${POS_CN[x.pos]}${x.god}——${TG[x.god].core}`).join(';');
  S.push({ id:'skeleton', title:'性格骨架', source:'日主+月令+十神',
    body: `${mLine}${others ? others + '。' : ''}月令是性格的主梁,年柱往往写着来处的印记,时柱则倾向指向你晚成的那一面。来源:十神·${mGod || '月令'}` });

  /* relation */
  const relHits = pick(tg, ['正官','七杀','正印','偏印','比肩','劫财']).slice(0,2);
  let relBody = relHits.length
    ? relHits.map(x=>`${POS_CN[x.pos]}${x.god}:${TG[x.god].rel}`).join('。') + '。来源:十神·官杀印比'
    : `你的盘面官杀印比不显,关系里往往更依赖食伤财的方式——用做事和给予来表达在乎。来源:十神分布`;
  if (ast && ast.moon && ast.moon.sign)
    relBody += `\n\n星盘把这一章的辅证交给月亮${ast.moon.approx ? '(按当日正午近似)' : ''}:月亮落${ast.moon.sign},${MOON_LINE[ast.moon.sign]}。太阳是你给世界看的,月亮才是关了门之后的——亲密关系里的你,更接近后者。来源:星盘辅证·月亮${ast.moon.sign}`;
  S.push({ id:'relation', title:'关系与协作', source:'十神+月亮星座', body: relBody });

  /* action */
  const actHits = pick(tg, ['食神','伤官','偏财','正财']).slice(0,2);
  let actBody = actHits.length
    ? actHits.map(x=>`${POS_CN[x.pos]}${x.god}:${TG[x.god].act}`).join('。') + '。来源:十神·食伤财'
    : `食伤财在天干不显,你的行动力更常由${st.label==='偏强'?'比劫的冲劲':'印星的准备感'}驱动——想清楚才动,但动了就不轻易停。来源:十神分布`;
  if (ast && ast.asc)
    actBody += `\n\n星盘辅证落在上升:上升${ast.asc.sign}——${RISE_LINE[ast.asc.sign]}。上升是你启动任何事情时最先亮起的那块界面,别人对你的第一印象,多半是它。来源:星盘辅证·上升${ast.asc.sign}`;
  S.push({ id:'action', title:'行动与决策', source:'十神+上升星座', body: actBody });

  /* phase */
  const phaseMap = {
    偏强: '能量偏盛,更适合"出与泄"——把力气花在表达、创造、带动别人上;憋着不动,反而容易内耗成脾气。',
    偏弱: '能量偏收,更适合"收与养"——少揽不属于你的仗,把睡眠、独处和滋养你的人事往前排。',
    中和: '能量大体平衡,守中即可——别刻意补什么,重点在维持你已经跑通的节奏。'
  };
  S.push({ id:'phase', title:'当前的进与收', source:'日主强弱',
    body: `${phaseMap[st.label]}这是本命静态盘的读法;叠上大运流年的时间轴之后,进与收还会有更细的刻度——那是完整版报告要讲的事。来源:日主强弱` });

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
    body: `得「${name}」:上${TRI_IMG[upper]}下${TRI_IMG[lower]},动在第${moving}爻。${relation}。卦象说的是当下这件事的结构与侧重,不是结局。来源:卦象·${name}`,
    rule: '起卦规则(公开可复算):(年支序+月+日)除以八取余为上卦,再加时辰序与问题字数取余为下卦,总和除以六取余为动爻'
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

const Explainer = { buildSections, castGua, validateSections, TG, SIGN_LINE, MOON_LINE, RISE_LINE, SIGN_WEST, WEST2WX, sunCross };
if (typeof module !== 'undefined' && module.exports) module.exports = Explainer;
if (typeof window !== 'undefined') window.Explainer = Explainer;
