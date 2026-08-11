/* 知星首页与双盘分享内容模块 V1
 * 数据合同：classic script + CommonJS。
 * 首页只用日主×太阳得出融合结论；上升只补充第一印象。
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZhixingHomeContentV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SCHEMA_VERSION = 'home-content-v1';
  const DAY_STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const SUN_SIGNS = ['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座'];
  const FUSION_TYPES = ['双重确认','内外反差','场景切换','反向补偿'];
  const DOUBLE_CONFIRM_PAIRS = new Set([
    '甲×金牛座','甲×摩羯座','乙×巨蟹座','乙×双鱼座',
    '丙×白羊座','丙×狮子座','丁×处女座','丁×天蝎座',
    '戊×金牛座','戊×摩羯座','己×巨蟹座','己×处女座',
    '庚×白羊座','庚×狮子座','辛×处女座','辛×天蝎座',
    '壬×天秤座','壬×双鱼座','癸×天蝎座','癸×双鱼座'
  ]);
  const FAST_PUBLIC_SIGNS = new Set(['白羊座','双子座','狮子座','射手座','水瓶座']);
  const STEADY_PUBLIC_SIGNS = new Set(['金牛座','处女座','摩羯座']);
  const DELIBERATE_STEMS = new Set(['甲','乙','丁','戊','己','辛','壬','癸']);
  const FAST_STEMS = new Set(['丙','庚']);
  const RELATIONAL_PUBLIC_SIGNS = new Set(['巨蟹座','天秤座','双鱼座']);

  const STEM = {
    甲:{
      element:'木', image:'参天之木', core:'先判断方向能不能长期成立', observe:'看清哪条线值得一直做下去',
      decide:'认准主线后连续投入', target:'散乱的事项', result:'回到一条可持续的主线',
      judge:'你先确认方向值不值得长做', strength:'把复杂局面带回长期方向', ability:'长期方向', resolve:'看清长期方向',
      risk:'方向频繁变化时，你会反复重定主线', keyword:'定主线', share:'立意生长'
    },
    乙:{
      element:'木', image:'藤蔓之木', core:'先看现实条件允许从哪里进入', observe:'寻找眼前还能往前走的缝隙',
      decide:'沿着可行入口边走边调整', target:'卡住的局面', result:'出现一条能继续走的路',
      judge:'你先找现实里还能进入的缝隙', strength:'让僵住的局面重新有路可走', ability:'可行入口', resolve:'找准可行入口',
      risk:'照顾的条件太多时，你会把主线让到后面', keyword:'找入口', share:'因势成形'
    },
    丙:{
      element:'火', image:'太阳之火', core:'先说清为什么值得开始', observe:'辨认什么最该被摆到明面上',
      decide:'把方向公开说清再集中推进', target:'含混的讨论', result:'出现人人看得懂的重点',
      judge:'你先把事情为什么重要说清楚', strength:'让模糊方向很快变得可见', ability:'公开重点', resolve:'说清公开重点',
      risk:'长时间没有回应时，你会很难维持最初的投入', keyword:'亮重点', share:'明朗开阔'
    },
    丁:{
      element:'火', image:'灯烛之火', core:'先抓住最值得认真处理的一点', observe:'从杂音里找到决定结果的细节',
      decide:'把注意力收进一个关键细节', target:'杂乱的信息', result:'显出真正影响结果的细处',
      judge:'你先从杂音里认出最关键的一点', strength:'把决定结果的细节照得很清楚', ability:'关键细节', resolve:'抓住关键细节',
      risk:'标准迟迟不清时，你会继续打磨已经够用的部分', keyword:'照细处', share:'微光见真'
    },
    戊:{
      element:'土', image:'高山之土', core:'先确认条件、责任和完成标准', observe:'检查脚下的条件是否足够可靠',
      decide:'把顺序排稳后再往上搭', target:'不断变化的条件', result:'形成可以依靠的基本做法',
      judge:'你先确认脚下的条件够不够稳', strength:'让变化里的事情有可靠落脚处', ability:'可靠条件', resolve:'核对可靠条件',
      risk:'条件不断变动时，你会一直补基础而推迟结果', keyword:'稳条件', share:'厚实有序'
    },
    己:{
      element:'土', image:'田园之土', core:'先把大事拆成能照料的小步', observe:'梳理零碎事项之间的先后顺序',
      decide:'按日常可以重复的方式一点点做实', target:'堆在一起的琐碎', result:'变成可以持续重复的安排',
      judge:'你先把大事拆成眼前能做的小步', strength:'把零散事情照料成稳定安排', ability:'日常次序', resolve:'理清日常次序',
      risk:'零碎要求不断加入时，你会忙着逐一照料而忘了轻重', keyword:'理次序', share:'细作成田'
    },
    庚:{
      element:'金', image:'刀剑之金', core:'先切清目标、障碍和该停的部分', observe:'判断什么必须保留、什么应该停止',
      decide:'对关键问题直接做取舍', target:'纠缠的选择', result:'变成可以执行的决定',
      judge:'你先分清什么该留、什么该停', strength:'把纠缠的选择切成明确决定', ability:'明确取舍', resolve:'确定怎样取舍',
      risk:'前提改变以后，你仍可能沿用第一次判断', keyword:'做取舍', share:'决断成章'
    },
    辛:{
      element:'金', image:'珠玉之金', core:'先定清什么样才算完成', observe:'找到最影响准确度的那一处',
      decide:'按清楚标准一层层修到准确', target:'粗糙的结果', result:'成为可以核对的完成品',
      judge:'你先定清什么样才算真正完成', strength:'把粗糙结果修成可核对的成品', ability:'完成标准', resolve:'核对完成标准',
      risk:'反馈一直不来时，你会悄悄提高自己的标准', keyword:'定标准', share:'精研成器'
    },
    壬:{
      element:'水', image:'江海之水', core:'先看全局和几条可能路线', observe:'把分散线索连成一张完整图',
      decide:'连接信息以后再选真正能走的入口', target:'分散的线索', result:'显出场面里缺的那一块',
      judge:'你先看全局里还缺了哪一块', strength:'从分散信息里看见隐含连接', ability:'隐含连接', resolve:'连起隐含线索',
      risk:'中途出现新路线时，你会重新打开全部选择', keyword:'补缺口', share:'海纳百川'
    },
    癸:{
      element:'水', image:'雨露之水', core:'先捕捉细微信号，再用小步确认', observe:'留意别人尚未说出的细小变化',
      decide:'从风险较小的一步开始验证', target:'不确定的信号', result:'变成可以继续核实的线索',
      judge:'你先注意别人还没说出的微小变化', strength:'在变化刚出现时就捕捉到信号', ability:'细微信号', resolve:'抓住细微信号',
      risk:'信号互相矛盾时，你会继续等更多证据', keyword:'察微变', share:'润物知微'
    }
  };

  const SUN = {
    白羊座:{ element:'火', core:'先动手试出答案', judge:'催你立刻摆出第一步', move:'把第一步直接摆出来', result:'一个能马上验证的起点', scene:'大家还在等谁先开始时', trigger:'现场迟迟没有人起头', pressure:'第一步会先于取舍出现', keyword:'先起步', title:'率先启程', public:'把判断变成清楚的第一步' },
    金牛座:{ element:'土', core:'先把节奏和实际条件稳住', judge:'让你先守住能持续的做法', move:'把时间和条件先安排稳', result:'一套可以持续重复的做法', scene:'条件反复变化、做法还没定时', trigger:'安排不断变化', pressure:'已经够稳的做法可能被继续拖着不改', keyword:'稳节奏', title:'稳中成事', public:'让好判断成为可持续的做法' },
    双子座:{ element:'风', core:'快速接住分散信息', judge:'让你迅速把线索连起来', move:'接住几种说法并找出连接', result:'一句让话题继续往前的话', scene:'几个人同时抛出不同说法时', trigger:'信息突然变多', pressure:'可比较的说法会越来越多', keyword:'快连接', title:'触类旁通', public:'在不同信息之间找出连接' },
    巨蟹座:{ element:'水', core:'先留意谁还没有被接住', judge:'让你先照顾现场的真实顾虑', move:'把没被说出的顾虑放进考虑', result:'一种让人愿意继续说下去的方式', scene:'有人沉默、现场开始变僵时', trigger:'现场有人明显退后', pressure:'别人的顾虑会不断排到你的判断前面', keyword:'接顾虑', title:'体察入微', public:'让重要顾虑得到温和回应' },
    狮子座:{ element:'火', core:'把最重要的判断公开说清', judge:'让你把重点堂堂正正说出来', move:'用明确姿态把重点说清', result:'一个人人看得见的共同重点', scene:'说法很多、却没人肯定重点时', trigger:'大家都在等一个明确说法', pressure:'已经说出口的重点会变得很难收回', keyword:'亮主张', title:'明心立意', public:'把共同重点说得明朗有力' },
    处女座:{ element:'土', core:'找到具体缺口并拆成步骤', judge:'让你追问细节能不能真正落下', move:'把缺口拆成可以核对的小步', result:'一条能照着完成的具体路径', scene:'方向听起来不错、细节却空着时', trigger:'细节开始影响完成', pressure:'需要核对的细节会越列越长', keyword:'查细节', title:'细察成章', public:'把好想法整理成可核对的步骤' },
    天秤座:{ element:'风', core:'比较不同人的位置和理由', judge:'让你先找各方都能进入的说法', move:'把几种立场放到同一张桌面上', result:'一个多数人都知道怎样参与的安排', scene:'几种意见各有道理、互不相让时', trigger:'意见开始彼此顶住', pressure:'每一种立场都会变成必须照顾的条件', keyword:'理位置', title:'和而有则', public:'让不同立场找到共同进入方式' },
    天蝎座:{ element:'水', core:'盯住没有说出口的关键', judge:'让你直抵表面之下的真正原因', move:'越过表面说法追到关键原因', result:'一个不再绕开的核心问题', scene:'表面都说可以、行动却迟迟不动时', trigger:'话和行动对不上', pressure:'原因没有查清以前，你会迟迟不表态', keyword:'看关键', title:'洞见幽微', public:'穿过表面看见真正关键' },
    射手座:{ element:'火', core:'先看更远的意义和可能', judge:'让你把眼前一步连到更远方向', move:'把当前选择放进更长的路上衡量', result:'一个既能起步又不困住未来的方向', scene:'眼前方案都能做、意义却不清时', trigger:'新的可能突然出现', pressure:'远处的新方向会不断拉走眼前的注意', keyword:'看长路', title:'远见开途', public:'让眼前选择连到更远方向' },
    摩羯座:{ element:'土', core:'把责任、期限和标准排清', judge:'让你先问谁负责、何时完成', move:'把责任和截止点明确写下来', result:'一个责任清楚、时间可查的安排', scene:'大家都答应了、责任却还含糊时', trigger:'承诺开始没有下文', pressure:'责任和期限会被越排越满', keyword:'定责任', title:'笃行有成', public:'把复杂责任整理成可靠安排' },
    水瓶座:{ element:'风', core:'换一个角度重看旧办法', judge:'让你从常规之外重新拆题', move:'先改变看问题的角度再试办法', result:'一个避开旧卡点的新解法', scene:'旧办法重复几次仍然卡住时', trigger:'同一种做法反复失效', pressure:'新解法会一个接一个替换旧解法', keyword:'换角度', title:'别开新径', public:'从旧问题里找到新的解法' },
    双鱼座:{ element:'水', core:'捕捉现场细微的情绪变化', judge:'让你顺着气氛找到合适说法', move:'先接住气氛，再换一种说法进入', result:'一种不硬推也能继续前进的方式', scene:'道理已经说清、现场却仍不愿动时', trigger:'气氛和说法明显不一致', pressure:'现场反应会不断改变你准备说的话', keyword:'顺气氛', title:'通感成意', public:'把细微感受转成恰当表达' }
  };

  const ASC = {
    白羊座:{ entry:'先往前一步问清第一件事', visible:'直接、愿意开场' },
    金牛座:{ entry:'先等场面稳定，再选择位置', visible:'沉稳、不急着表态' },
    双子座:{ entry:'先接一句话，顺手问出更多信息', visible:'好聊、反应很快' },
    巨蟹座:{ entry:'先看谁紧张、谁还没有接上话', visible:'好接近、会照顾气氛' },
    狮子座:{ entry:'先把姿态站稳，让人知道你在场', visible:'大方、有明确存在感' },
    处女座:{ entry:'先看规则和细节有没有遗漏', visible:'细致、做事有分寸' },
    天秤座:{ entry:'先照顾每个人当下的位置', visible:'客气、愿意听不同说法' },
    天蝎座:{ entry:'先少说几句，观察真正关键的人和事', visible:'安静、判断很深' },
    射手座:{ entry:'先找到可以展开的新入口', visible:'开朗、愿意谈更远的可能' },
    摩羯座:{ entry:'先看规则、责任和时间要求', visible:'可靠、对事情有准备' },
    水瓶座:{ entry:'先保留一点距离，观察整体结构', visible:'独立、看法不落俗套' },
    双鱼座:{ entry:'先接住现场气氛和细微反应', visible:'柔和、容易理解别人' }
  };

  const SUN_SHORT = {
    白羊座:{ judge:'会先动手', move:'摆出第一步' },
    金牛座:{ judge:'会先稳住', move:'稳住做法' },
    双子座:{ judge:'会快速连接', move:'连起线索' },
    巨蟹座:{ judge:'会先接顾虑', move:'接住顾虑' },
    狮子座:{ judge:'会亮出重点', move:'说亮重点' },
    处女座:{ judge:'会追到细节', move:'拆清步骤' },
    天秤座:{ judge:'会比较立场', move:'摆明各方位置' },
    天蝎座:{ judge:'会追问原因', move:'追到真正原因' },
    射手座:{ judge:'会望向更远', move:'连向更远方向' },
    摩羯座:{ judge:'会排清责任', move:'排清责任期限' },
    水瓶座:{ judge:'会换个角度', move:'换个角度拆题' },
    双鱼座:{ judge:'会顺着气氛', move:'接住现场气氛' }
  };

  const SHARE_TITLE_FIRST = {
    甲:'立意生长',乙:'因势成形',丙:'明朗开阔',丁:'微光见真',戊:'厚实有序',己:'细作成田',庚:'决断成章',辛:'精研成器',壬:'海纳百川',癸:'润物知微'
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function signName(value) {
    const name = text(value && value.sign ? value.sign : value);
    if (!name) return '';
    return name.endsWith('座') ? name : name + '座';
  }

  function shortSign(value) {
    return signName(value).replace(/座$/, '');
  }

  function contextOf(value) {
    const supplied = value || {};
    const chart = supplied.chart || supplied;
    const astro = chart.astro || supplied.astro || {};
    const pillars = chart.pillars || {};
    const dayMaster = chart.dayMaster || {};
    const input = Object.assign({}, chart.input || {}, supplied.input || {});
    return {
      stem:text(supplied.stem || supplied.dayStem || dayMaster.stem || (pillars.day && pillars.day.stem)),
      sun:signName(supplied.sun || supplied.sunSign || (astro.sun && astro.sun.sign)),
      asc:signName(supplied.asc || supplied.ascSign || (astro.asc && astro.asc.sign)),
      input:input
    };
  }

  function requirePair(stem, sun) {
    if (!STEM[stem]) throw new TypeError('未知日主：' + (stem || '空'));
    if (!SUN[sun]) throw new TypeError('未知太阳星座：' + (sun || '空'));
  }

  function combinationKey(stem, sun) {
    const normalizedSun = signName(sun);
    requirePair(text(stem), normalizedSun);
    return text(stem) + '×' + normalizedSun;
  }

  function fusionTypeFor(stem, sun) {
    const key = combinationKey(stem, sun);
    if (DOUBLE_CONFIRM_PAIRS.has(key)) return '双重确认';
    if ((DELIBERATE_STEMS.has(stem) && FAST_PUBLIC_SIGNS.has(sun)) ||
        (FAST_STEMS.has(stem) && STEADY_PUBLIC_SIGNS.has(sun))) return '内外反差';
    if (RELATIONAL_PUBLIC_SIGNS.has(sun)) return '场景切换';
    return '反向补偿';
  }

  function outcome(day, sun, type) {
    const solarShort = SUN_SHORT[sun];
    if (type === '双重确认') return '先' + day.resolve + '，再' + solarShort.move;
    if (type === '内外反差') return '先' + solarShort.move + '；最后' + day.resolve + '，再定案';
    if (type === '场景切换') return '在共同讨论时' + solarShort.move + '，独自选择时' + day.resolve;
    return '先' + solarShort.move + '，再' + day.resolve + '，定下下一步';
  }

  function fusionDetail(day, solar, type) {
    if (type === '双重确认') return '方向和外在动作指向同一处，别人通常很快知道你准备怎样推进';
    if (type === '内外反差') return '别人先看到的是你会' + solar.move + '，真正决定是否继续的，是你能否' + day.decide;
    if (type === '场景切换') return '你能随场合换动作，但最后衡量的仍是' + day.target + '能否' + day.result;
    return '太阳的做法替日主补了一步，原本容易卡住的判断因此有了可验证的出口';
  }

  function secondStepBody(day, solar, type) {
    const opening = '别人容易先看见你' + solar.public + '。';
    if (type === '双重确认') return opening + '外在动作和内在判断指向同一处，别人较容易跟上你的推进。';
    if (type === '内外反差') return opening + '看起来已经开始，真正的决定却要等你' + day.resolve + '；把这段时间差说出来，事情才不容易走偏。';
    if (type === '场景切换') return opening + '共同讨论时先接住现场，独自选择时再' + day.resolve + '；两种动作不要互相替代。';
    return opening + '太阳先打开入口，日主再判断是否继续；前者解决起步，后者负责收口。';
  }

  function buildGenericPair(stem, sun) {
    const day = STEM[stem];
    const solar = SUN[sun];
    const solarShort = SUN_SHORT[sun];
    const type = fusionTypeFor(stem, sun);
    const fused = outcome(day, sun, type);
    const judgement = day.judge + '；太阳' + shortSign(sun) + solarShort.judge + '。合在一起，' + fused + '。';
    const explanation = '日主·' + stem + day.element + day.core + '，太阳·' + sun + '则' + solar.core + '。两者合在一起，你会' + fused + '；' + fusionDetail(day, solar, type) + '。';
    const stepOneTitle = solar.keyword + '时，也在' + day.keyword;
    const stepTwoTitle = day.resolve + '，再给出下一步';
    const stepThreeTitle = '最后决定要有截止点';
    const source = '日主·' + stem + day.element + '｜太阳·' + sun;
    const contrast = type === '双重确认' ? undefined : fusionDetail(day, solar, type);

    const home = {
      identity:stem + day.element + ' × 太阳' + shortSign(sun),
      fusionType:type,
      judgement:judgement,
      explanation:explanation,
      keywords:[day.keyword, solar.keyword, type === '双重确认' ? '同向推进' : '先动后定'],
      steps:[
        {
          title:stepOneTitle,
          body:'在' + solar.scene + '，你先' + day.observe + '，再' + solarShort.move + '。这一步常让' + day.target + day.result + '。'
        },
        {
          title:stepTwoTitle,
          body:secondStepBody(day, solar, type)
        },
        {
          title:stepThreeTitle,
          body:'当' + solar.trigger + '，你会' + solar.move + '，同时又想' + day.observe + '。' + solar.pressure + '，最后的决定因此需要一个明确截止点。'
        }
      ],
      firstImpression:'刚进入陌生场合时，你通常先' + day.observe + '。熟悉以后，别人会发现你更在意' + day.target + '能否' + day.result + '。',
      drive:'当' + solar.trigger + '，太阳' + shortSign(sun) + '会让你' + solar.move + '；日主' + stem + '又想' + day.observe + '。第一步有回音、主线没有被改掉时，你最容易持续投入。',
      scenes:[
        { title:'共同讨论', body:'几种说法同时出现时，你会' + day.observe + '，再' + solarShort.move + '，让下一步不只停在口头。' },
        { title:'独自选择', body:'需要从两个方向里选一个时，你先' + day.resolve + '，判断哪条更值得继续，再给比较设一个停止时间。' }
      ],
      overuse:{
        title:'用过头时',
        body:day.risk + '；当' + solar.trigger + '，' + solar.pressure + '。这时越需要先停一次，确认最后要保留的判断。',
        action:'先停下继续比较，把' + day.ability + '对应的结果写清楚；等这一步有了回音，再决定是否换方向。'
      },
      reportQuestions:[
        '和重要的人相处时，你会不会' + solar.move + '，却把自己真正想要的答复放到最后？',
        '一件事走到中段又出现新做法时，是该' + day.decide + '，还是重新选择？',
        '接下来一年，哪一项安排最需要你先' + day.resolve + '，再' + solarShort.move + '，并写下完成期限？'
      ],
      source:source
    };
    if (contrast) home.contrast = contrast;

    const dualShare = {
      identity:stem + day.element + ' × 太阳' + shortSign(sun),
      title:SHARE_TITLE_FIRST[stem] + ' · ' + solar.title,
      body:stem + day.element + '擅长' + day.strength + '，太阳' + shortSign(sun) + '则会' + solar.public + '。两者放在一起，常能让' + day.target + day.result + '，并留下' + solar.result + '。',
      source:'双盘印证｜八字·' + stem + day.element + '：' + day.strength + '｜星盘·太阳' + shortSign(sun) + '：' + solar.public,
      button:'生成我的双盘印证卡',
      a11y:'知星双盘印证卡，' + stem + day.element + '与太阳' + shortSign(sun) + '，标题' + SHARE_TITLE_FIRST[stem] + '、' + solar.title + '。'
    };

    return { key:combinationKey(stem, sun), home:home, dualShare:dualShare };
  }

  const COMBINATIONS = {};
  DAY_STEMS.forEach(function (stem) {
    SUN_SIGNS.forEach(function (sun) {
      const pair = buildGenericPair(stem, sun);
      COMBINATIONS[pair.key] = pair;
    });
  });

  const EXACT_V2 = {
    key:'壬×双子座',
    home:{
      identity:'壬水 × 太阳双子',
      fusionType:'内外反差',
      judgement:'别人还没开始讨论，你已经看见了场面里缺的那一块。',
      explanation:'壬水先观察局势，太阳双子快速接住信息。两张盘放在一起——你不只是反应快；在别人开口之前，你已经把缺口补上了。',
      keywords:['补缺口快','能接住不同声音','决定比话慢'],
      steps:[
        {
          title:'别人还在各说各的，你已连成一条线。',
          body:'多人讨论时，几个人各讲各的，你已经把三句话串成一条线——谁在说目标、谁在说风险、谁已经跑题。你不会急着打断，但心里已经画完了这张图。'
        },
        {
          title:'你开口的时候，话题才开始转。',
          body:'你不一定最先发言。但你说完以后，场面会安静一小会儿——不是因为你说得多，是因为你把刚才散落的信息拼成了一个完整的方向，讨论也会沿着这条线重新检查。'
        },
        {
          title:'五个方案都能提，最后只能走一个。',
          body:'不是因为其他四个不对——是你把五个都推演了一遍之后，自己选了最稳的那一个。别人看见的是你点头说「可以试试」，没看见你在水里已经把其他四条暗流全游完了。'
        }
      ],
      firstImpression:'刚进陌生场合时，上升巨蟹让你先看谁紧张、谁还没接上话；壬水已经开始补缺口。别人先觉得你好接近，后来才发现你一直在看全场。',
      drive:'信息刚变多时，太阳双子让你立刻去连接；壬水又想把全局看完。第一轮回应来得快、目标没有反复改写时，你最容易一路做到底。',
      scenes:[
        { title:'多人讨论', body:'三种说法同时出现时，你会先找它们共同漏掉的问题，再用一句话让讨论换方向。' },
        { title:'两路选择', body:'两个方向都能成立时，你会继续补资料，希望选出更稳的一条；真正需要的是给比较设截止点。' }
      ],
      overuse:{
        title:'用过头时',
        body:'面前只有两个方向，你又补出了第三个方案，每个都有道理。两个月后回头看——三个都开了头，却没有一个走完第二个月。',
        action:'不是贪心。是你怕那条没选的路，哪天被证明是对的。对你更有效的做法：先决定哪条路值得连续投入 30 天，再让其他信息为这条主线服务——不是关掉其他入口，是先把一个入口走到底。'
      },
      reportQuestions:[
        '在关系里，你退开不是因为不在乎——而是因为你退开之后还想回来，但对方已经猜错了。怎样让对方知道你会回来，并把话说完？',
        '你能把一件事从零冲到六成。剩下的四成——收尾、反馈、重复打磨——你很容易在中段掉速。怎么让主线不被新鲜感带走？',
        '2019—2028 这一阶段在逼你一件事：不能再靠「我先看看」拖过前三个月。稳定的位置需要你把眼光从一千条路线，收回来，盯住一条。'
      ],
      source:'日主·壬水｜太阳·双子座｜上升·巨蟹座',
      contrast:'外面看见的是反应快、能接话，真正的取舍却要等壬水把全局看完。'
    },
    dualShare:{
      identity:'壬水 × 太阳双子',
      title:'海纳百川 · 触类旁通',
      body:'壬水取其广，双子取其通。能容不同的声音，也能从万象之间看见相连之处。',
      source:'双盘印证｜八字·壬水：观势应变｜星盘·太阳双子：博闻善联',
      button:'生成我的双盘印证卡',
      a11y:'知星双盘印证卡，壬水与太阳双子，标题海纳百川、触类旁通。'
    }
  };

  function inputNumber(input, longName, shortName) {
    const raw = input[longName] != null ? input[longName] : input[shortName];
    return Number(raw);
  }

  function isExactV2Sample(value) {
    const ctx = contextOf(value);
    const input = ctx.input || {};
    const city = text(input.city || input.c).replace(/市$/, '');
    const gender = text(input.gender || input.g).toUpperCase();
    return ctx.stem === '壬' && ctx.sun === '双子座' && ctx.asc === '巨蟹座'
      && inputNumber(input, 'year', 'y') === 1992
      && inputNumber(input, 'month', 'm') === 6
      && inputNumber(input, 'day', 'd') === 15
      && inputNumber(input, 'hour', 'hh') === 8
      && inputNumber(input, 'minute', 'mm') === 30
      && city === '贵阳'
      && (gender === '男' || gender === 'M' || gender === 'MALE');
  }

  function getPair(stem, sun) {
    const key = combinationKey(stem, sun);
    return clone(COMBINATIONS[key]);
  }

  function firstImpressionWithAsc(home, ctx) {
    if (!ctx.asc) return;
    const asc = ASC[ctx.asc];
    if (!asc) throw new TypeError('未知上升星座：' + ctx.asc);
    const day = STEM[ctx.stem];
    home.firstImpression = '刚进入陌生场合时，上升' + shortSign(ctx.asc) + '让你' + asc.entry + '；日主' + ctx.stem + '仍在' + day.observe + '。别人先看到的是' + asc.visible + '，熟悉后才发现你一直在判断' + day.target + '能否' + day.result + '。';
    home.source += '｜上升·' + ctx.asc;
  }

  function buildHome(value) {
    const ctx = contextOf(value);
    requirePair(ctx.stem, ctx.sun);
    if (isExactV2Sample(value)) return clone(EXACT_V2.home);
    const home = getPair(ctx.stem, ctx.sun).home;
    firstImpressionWithAsc(home, ctx);
    return home;
  }

  function buildShare(value) {
    const ctx = contextOf(value);
    requirePair(ctx.stem, ctx.sun);
    if (isExactV2Sample(value)) return clone(EXACT_V2.dualShare);
    return getPair(ctx.stem, ctx.sun).dualShare;
  }

  function buildContent(value) {
    const ctx = contextOf(value);
    requirePair(ctx.stem, ctx.sun);
    return {
      key:combinationKey(ctx.stem, ctx.sun),
      home:buildHome(value),
      dualShare:buildShare(value)
    };
  }

  return {
    SCHEMA_VERSION:SCHEMA_VERSION,
    DAY_STEMS:DAY_STEMS.slice(),
    SUN_SIGNS:SUN_SIGNS.slice(),
    COMBINATIONS:COMBINATIONS,
    combinationKey:combinationKey,
    getPair:getPair,
    buildHome:buildHome,
    buildShare:buildShare,
    buildContent:buildContent,
    isExactV2Sample:isExactV2Sample
  };
});
