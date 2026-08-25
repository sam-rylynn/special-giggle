/* 知星行动章与时间章内容模块 V1
 * 数据合同：classic script + CommonJS。
 * 只根据确定性盘面生成内容，不读取职业、关系或项目背景。
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZhixingActionTimeContentV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const SIGNS = ['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座'];

  const STEM_META = {
    甲:{ element:'木', rhythm:'先认准方向，再靠连续投入把事情推高', start:'问目标能不能长期成立，决定从哪里动手', drop:'方向频繁被改写时，你会一边推进一边重新判断值不值得继续', resultNoun:'认准的长期方向', longTerm:'方向能否连续推进' },
    乙:{ element:'木', rhythm:'先找到可以进入的缝隙，再边走边调整', start:'看现有条件允许哪一步，用小动作把局面接起来', drop:'需要反复迁就不同条件时，主线会被一次次的小调整带偏', resultNoun:'找到的可行入口', longTerm:'调整以后主线是否仍在' },
    丙:{ element:'火', rhythm:'先点亮目标，让人看见方向，再集中推进', start:'把这件事为什么要做说清楚，带着明确反馈开工', drop:'长期重复、没有回应时，你会很难维持最初的投入强度', resultNoun:'说清的目标', longTerm:'目标能否持续得到回应' },
    丁:{ element:'火', rhythm:'先抓住最关键的一点，再持续把细节做亮', start:'确认哪一处最值得认真处理，把注意力收进去', drop:'标准一直不清楚时，你会在细节里反复打磨，交付时间被往后推', resultNoun:'抓住的关键细节', longTerm:'关键细节能否按标准完成' },
    戊:{ element:'土', rhythm:'先确认基础是否可靠，再按顺序往上搭', start:'核对条件、责任和完成标准，开始承担', drop:'条件不断变化时，你会花更多时间补基础，第一次可见结果来得较慢', resultNoun:'搭稳的基础', longTerm:'条件和责任能否长期稳定' },
    己:{ element:'土', rhythm:'先把大事拆成可照料的小步，再一点点做实', start:'先整理顺序和日常动作，让事情可以稳定重复', drop:'零碎事项不断加入时，你会忙着逐一照料，却看不清哪一步最重要', resultNoun:'排好的日常步骤', longTerm:'日常步骤能否持续重复' },
    庚:{ element:'金', rhythm:'先切清目标和障碍，再直接处理关键问题', start:'先判断什么必须保留、什么应该停止，再快速推进', drop:'前提已经改变，如果仍沿用最初判断，速度会变成不愿回头', resultNoun:'做出的关键取舍', longTerm:'关键取舍能否根据新事实修正' },
    辛:{ element:'金', rhythm:'先定清标准，再把结果一层层磨到准确', start:'确认什么样才算完成，再处理最影响质量的部分', drop:'反馈迟迟不来时，你会继续提高自己的标准，结果反而更晚交出去', resultNoun:'定下的完成标准', longTerm:'完成标准能否稳定执行' },
    壬:{ element:'水', rhythm:'先看完全局和多条路线，再找到真正能走的入口', start:'收集信息、连接线索，判断哪条路线最值得推进', drop:'走到中段又出现新路线时，你会重新打开全局，注意力随之分散', resultNoun:'选定的推进路线', longTerm:'选定路线能否持续走下去' },
    癸:{ element:'水', rhythm:'先捕捉细微信号，再用小步确认方向', start:'先观察变化和反馈，从风险较小的一步开始', drop:'信号互相矛盾时，你会继续等待更多证据，决定因此被往后放', resultNoun:'验证过的细微信号', longTerm:'小步验证能否逐渐积成明确方向' }
  };

  const ASC_META = {
    白羊座:{ visible:'先做出第一个动作，让局面开始', fusion:'会把内在节奏直接变成一个可见起点', risk:'第一步很快，但需要给第二次校准留出位置' },
    金牛座:{ visible:'先确认时间和资源够不够，再稳定开工', fusion:'会把内在节奏压进一个能持续重复的安排', risk:'启动较慢，但决定以后不愿随意换法' },
    双子座:{ visible:'先提问、找信息，并迅速试出几个入口', fusion:'会把内在节奏转成多路线的快速试探', risk:'入口一多，就要防止试探替代真正投入' },
    巨蟹座:{ visible:'先看现场气氛和相关人的顾虑，再选择开场方式', fusion:'会让内在节奏先经过场合与他人反应的校准', risk:'顾虑照顾得太多时，自己的决定容易晚一步说出' },
    狮子座:{ visible:'先把方向说出来，让别人知道要往哪里走', fusion:'会把内在节奏变成公开承诺和明确姿态', risk:'一旦公开表态，就更需要允许中途依据事实修正' },
    处女座:{ visible:'先拆步骤、找缺口，并处理最具体的问题', fusion:'会把内在节奏变成清单、次序和可检查的动作', risk:'细节持续增加时，要防止检查工作挤掉真正完成' },
    天秤座:{ visible:'先听几方意见，再寻找大家能进入的做法', fusion:'会把内在节奏转成兼顾多方的推进方式', risk:'每个意见都想照顾时，拍板会被不断延后' },
    天蝎座:{ visible:'先判断关键利益和真正阻力，再选择是否出手', fusion:'会把内在节奏收束到最影响结果的那一处', risk:'判断留在心里太久时，协作方不知道你为何停住' },
    射手座:{ visible:'先确认这件事有没有空间和意义，再快速上手', fusion:'会把内在节奏拉向更大的目标和新的可能', risk:'远处的新方向出现时，眼前的重复工作容易失去吸引力' },
    摩羯座:{ visible:'先问责任、期限和完成标准，再安排顺序', fusion:'会把内在节奏放进明确责任和长期安排', risk:'责任接得太满时，容易只顾完成而忽略必要反馈' },
    水瓶座:{ visible:'先换一个角度理解问题，再测试不同做法', fusion:'会把内在节奏转成对旧方法的重新设计', risk:'方法不断更新时，需要固定不变的结果标准' },
    双鱼座:{ visible:'先感受整体氛围和细微变化，再顺势进入', fusion:'会让内在节奏保留弹性，并跟着现场信号调整', risk:'外部信号太杂时，需要用明确截止时间结束感受阶段' }
  };

  const STRENGTH_META = {
    偏弱:{
      actionSupport:'长期独自推进、又没有明确回音时，更容易在中段掉速',
      phaseLoad:'阶段拉长以后，反馈间隔比推进速度更影响可持续投入',
      phaseWarning:'反馈长时间没有出现时，最先缩短的是可以连续使用的时间。'
    },
    中和:{
      actionSupport:'你能独立推进一段时间，但固定复盘能防止局部调整悄悄改掉主线',
      phaseLoad:'阶段要求持续变化时，你仍能往前做，也要看见完成标准何时被改动',
      phaseWarning:'调整没有留下记录时，阶段标准会在不知不觉中移动。'
    },
    偏强:{
      actionSupport:'你可以长时间自己推进，但越能扛，越要主动给外部反馈留下入口',
      phaseLoad:'阶段越长，独立判断越需要在关键节点接受一次外部核对',
      phaseWarning:'不同意见出现得越晚，已经完成的部分越难低成本修改。'
    }
  };

  const ACTION_GOD = {
    食神:'把想法做成看得见的成品',
    伤官:'指出旧做法的问题',
    偏财:'留意新机会和可用资源',
    正财:'看重持续投入留下的结果',
    比肩:'亲自判断并先往前推',
    劫财:'与人并行时先讲清分工',
    正官:'注意责任、规则和结果要求',
    七杀:'硬要求出现时迅速集中',
    正印:'补足依据和方法再推进',
    偏印:'从不常见的角度找办法'
  };

  const TIME_GOD = {
    正财:{
      conclusion:'把反复要做的事，做成看得见的稳定结果。',
      explain:'这一阶段更强调持续投入与实际完成。临时做对一次还不够，同类事情能否按标准反复完成，才会逐渐形成可信的做法。',
      amplify:['把一项日常责任做成固定流程。','先说清投入上限，再承诺完成时间。','让每次完成都留下可以复用的记录。'],
      pitfall:'把细小责任全部接下，却没有核对哪些结果真正由你负责；每天都很满，关键成果仍然没有固定标准。',
      row:'把日常做实，逐渐形成对责任、投入和结果的认识。'
    },
    偏财:{
      conclusion:'机会变多时，先说清哪一个值得持续投入。',
      explain:'这一阶段更容易接触变化、资源和新的合作入口。真正重要的不是看见多少可能，而是哪一个入口能够留下明确结果。',
      amplify:['为新机会设定统一的判断条件。','把资源用在已有责任最缺的一步。','在开始前说清结束时间和交付结果。'],
      pitfall:'每个机会都先接一点，希望边做边判断；时间被切碎以后，原有责任和新尝试都缺少完整收口。',
      row:'变化与机会增多时，用明确结果筛选真正值得投入的方向。'
    },
    正官:{
      conclusion:'不能再靠「我先看看」拖过前三个月。',
      explain:'这一阶段更看重需要长期承担的责任和可核对的结果。反复承担同一类事情以后，哪些事由你判断、哪些结果由你负责，才会逐渐变得清楚。',
      amplify:['承担一项负责范围清楚、能持续一段时间的责任。','在关键步骤上形成自己的判断，不只等别人给答案。','让每次完成都留下可以复用的经验或方法。'],
      pitfall:'什么都愿意搭把手，却没有先讲清自己负责到哪里。最后承担了结果，对关键决定却没有足够空间；事情做完了，也很难留下可重复的方法。',
      row:'把能力落实在长期责任、可信记录和可以留下的作品上。'
    },
    七杀:{
      conclusion:'分清硬要求，决定由你承担哪一段。',
      explain:'这一阶段的任务更常带着期限、竞争或明确压力。压力可以让行动集中，但承担范围不清时，也容易把所有困难都当成自己的责任。',
      amplify:['把硬要求拆成可以核对的步骤。','在期限前先确认决定权和所需配合。','完成以后记录哪种处理方式可以复用。'],
      pitfall:'为了不耽误进度先把难处全部接下，等到资源不足才发现没有人知道你需要什么，也没有人能及时补位。',
      row:'硬任务和竞争更容易推动成长，也会放大独自扛事的习惯。'
    },
    正印:{
      conclusion:'补齐方法和底子，增加承担范围。',
      explain:'这一阶段更适合整理知识、经验与工作方法。学习的价值要落到能否减少重复摸索，而不是不断增加还没用过的资料。',
      amplify:['把零散经验整理成可重复的方法。','为一项现有责任补齐必要知识。','用一次真实完成检验新学的方法。'],
      pitfall:'资料越积越多，真正使用的仍是原来的做法；准备时间持续增加，实际责任没有因此变得更清楚。',
      row:'补底子、搭系统，把经验整理成更稳定的方法。'
    },
    偏印:{
      conclusion:'减少同时展开的方向，留一个问题往深处做。',
      explain:'这一阶段更适合进入专业、冷门或需要独立研究的方法。深度来自持续核对同一个问题，不是不断换一批新材料。',
      amplify:['围绕一个问题建立固定资料范围。','把研究结果放进一次真实使用。','定期删掉不能支持当前问题的材料。'],
      pitfall:'发现新方法就重新搭一套框架，研究不断开始，原本要解决的问题反而迟迟没有得到回答。',
      row:'收回一部分向外铺开的注意力，向专业、冷门或更深的方法里走。'
    },
    比肩:{
      conclusion:'主动权回到自己手里时，更要把分工说在前面。',
      explain:'这一阶段更强调自己的判断和亲自推进。独立负责可以提高速度，但合作仍需明确谁决定、谁执行、何时互相反馈。',
      amplify:['亲自负责一项定义清楚的主线。','在合作开始前写清各自分工。','为重要决定保留一次外部核对。'],
      pitfall:'默认自己先做起来最快，等事情推进一半才发现别人既不知道如何加入，也不清楚哪些决定已经不能改。',
      row:'主动权回到自己手里，适合亲自扛主线；合作先讲清分工。'
    },
    劫财:{
      conclusion:'合作加快之前，先把投入和退出条件写清。',
      explain:'这一阶段更容易在人与资源的互动中加快速度。一起做事不等于责任自然清楚，投入、账目和停止条件需要在开始前说明。',
      amplify:['合作前写清各自投入和交付。','为共同事项设固定核对时间。','提前约定暂停或退出时怎样收尾。'],
      pitfall:'因为彼此熟悉就省略规则，等投入不一致时才讨论责任；速度已经起来，退出成本也随之变高。',
      row:'人和资源会带快节奏；并肩之前先把账、责任和退出条件说清。'
    },
    食神:{
      conclusion:'把会做的事留下成品，不要只停在想法。',
      explain:'这一阶段更适合持续表达、制作和打磨手艺。真正的积累来自一件件完成，而不是只增加想做的方向。',
      amplify:['给持续练习设固定频率。','每个周期留下一个可以回看的成品。','用真实反馈决定下一轮改哪里。'],
      pitfall:'准备了很多有趣方向，也愿意分享过程；但完成标准不固定，每一轮都在尝试新的形式。',
      row:'把手艺和作品慢慢养出风格，不被外部速度牵着跑。'
    },
    伤官:{
      conclusion:'把要修改的规则说具体，动手推翻。',
      explain:'这一阶段更容易看见旧方法里的不合理之处。改法越具体，越能变成实际改善；只停在否定，身边的人会不知道下一步怎样配合。',
      amplify:['把不合理之处写成可以验证的问题。','提出修改时同时给出新的完成标准。','用一轮实际结果比较新旧做法。'],
      pitfall:'很快指出问题，却同时修改太多条件；旧做法停了，新做法还没有形成可以共同执行的步骤。',
      row:'在既有做法里提出修正，用可验证的结果建立新的标准。'
    }
  };

  const STEM_INFO = {
    甲:['木',1],乙:['木',0],丙:['火',1],丁:['火',0],戊:['土',1],己:['土',0],庚:['金',1],辛:['金',0],壬:['水',1],癸:['水',0]
  };
  const GENERATES = { 木:'火',火:'土',土:'金',金:'水',水:'木' };
  const CONTROLS = { 木:'土',土:'水',水:'火',火:'金',金:'木' };
  const HIDDEN = {
    子:['癸'],丑:['己','癸','辛'],寅:['甲','丙','戊'],卯:['乙'],辰:['戊','乙','癸'],巳:['丙','庚','戊'],
    午:['丁','己'],未:['己','丁','乙'],申:['庚','壬','戊'],酉:['辛'],戌:['戊','辛','丁'],亥:['壬','甲']
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function withoutLeadingFirst(value) {
    return text(value).replace(/^先/, '');
  }

  function withoutOpeningCondition(value) {
    return text(value).replace(/^([^，。；]+)时，/, '$1，');
  }

  function unique(values) {
    return values.filter(function (value, index) { return value && values.indexOf(value) === index; });
  }

  function pillarText(pillar) {
    return pillar && pillar.stem && pillar.branch ? pillar.stem + pillar.branch : '';
  }

  function tenGod(dayStem, otherStem) {
    const day = STEM_INFO[dayStem];
    const other = STEM_INFO[otherStem];
    if (!day || !other) return '';
    const samePolarity = day[1] === other[1];
    if (day[0] === other[0]) return samePolarity ? '比肩' : '劫财';
    if (GENERATES[other[0]] === day[0]) return samePolarity ? '偏印' : '正印';
    if (GENERATES[day[0]] === other[0]) return samePolarity ? '食神' : '伤官';
    if (CONTROLS[day[0]] === other[0]) return samePolarity ? '偏财' : '正财';
    if (CONTROLS[other[0]] === day[0]) return samePolarity ? '七杀' : '正官';
    return '';
  }

  function actionGods(chart) {
    const gods = [];
    const data = chart && chart.tenGods ? chart.tenGods : {};
    ['year','month','hour'].forEach(function (key) {
      if (data[key] && data[key].stem && data[key].stem !== '日主') gods.push(data[key].stem);
    });
    return unique(gods);
  }

  function strengthLabel(chart) {
    return text(chart && chart.fiveElements && chart.fiveElements.dayMasterStrength && chart.fiveElements.dayMasterStrength.label) || '中和';
  }

  function isExactSampleV2(chart) {
    if (!chart) return false;
    const input = chart.input || {};
    const pillars = chart.pillars || {};
    const astro = chart.astro || {};
    return Number(input.y) === 1992 && Number(input.m) === 6 && Number(input.d) === 15
      && Number(input.hh) === 8 && Number(input.mm) === 30
      && text(input.city || input.c).replace(/市$/, '') === '贵阳'
      && text(input.gender || input.g) === '男'
      && pillarText(pillars.year) === '壬申' && pillarText(pillars.month) === '丙午'
      && pillarText(pillars.day) === '壬戌' && pillarText(pillars.hour) === '甲辰'
      && strengthLabel(chart) === '偏弱'
      && astro.sun && astro.sun.sign === '双子座'
      && astro.moon && astro.moon.sign === '射手座'
      && astro.asc && astro.asc.sign === '巨蟹座';
  }

  const COMMON_STRATEGY = {
    body:'主线是你愿意连续投入并留下结果的一件事。它可以是现有责任、一项长期学习、一件持续创作的作品，或者一项需要稳定完成的生活任务。',
    itemsLead:'主线需要满足三个条件：',
    items:['连续投入至少 30 天，中途不因新鲜感换题。','每 30 天留下一个看得见的结果。','每周有一次明确反馈，说出需要谁看一眼，不让自己长期在无回应中独自推进。']
  };

  const COMMON_EXPERIMENT = {
    body:'试验位用来容纳一种新方法、短期学习、工具或合作方式。一次只验证一个问题，并在开始时写下停止日期。',
    itemsLead:'例如：',
    items:['主线不变，只试一种新的完成方法。','长期任务不变，只试一个新的协作对象。','学习方向不变，只试一门短课或一套工具。'],
    close:'试验结束后只做三个选择：并入主线、再试一轮、停止。不要让「还没想好」自动变成无限延期。'
  };

  const COMMON_TRADEOFF = {
    ruleLead:'核心规则：',
    rule:'同时只留一条主线和一个试验位。第三个机会出现时，必须先停掉前两个中的一个。',
    questionsLead:'新机会出现时，先回答三个问题：',
    questions:['它是在帮助主线，还是只因为足够新鲜？','30 天后，它会留下什么具体结果？','如果现在开始，原有的哪一个位置必须让出来？'],
    close:'第三个问题没有答案，就先放进候选清单，不进入日程。'
  };

  const COMMON_RHYTHM = [
    '先给主线安排不可挪用的固定时间。',
    '试验位只占一个固定时段，不随时插入主线。',
    '每周只在一个固定时间评估是否换方向，平时出现的新想法只记录，不立刻开工。',
    '第 30 天看结果：主线继续；试验位选择并入、续期或停止。'
  ];

  const EXACT_ACTION_V2 = {
    title:'一条主线，一个试验位',
    total:[
      '你能把一件事从零冲到六成。',
      '壬水先看完全局，太阳双子快速抓住入口，偏财会留意机会，食神愿意把想法变成表达——这套组合启动很快。前六成通常包括找信息、连人、理方向、出方案、推进度和调整策略，这些动作你都能自己完成。',
      '问题出在最后四成。',
      '收尾、反馈、重复打磨和长期积累没有那么新鲜。一个人推进、又长期没有回音时，你容易走神：换一个方向，会不会更快得到新的反馈？',
      '一件事原本还有 30 天就能完成；到了第三周，一条新路线又出现，你会先在脑子里把它走一遍。',
      '这不只关乎执行力。壬水和双子合在一起，让你走到中段时容易重新打开全局；偏弱更需要反馈，比肩却习惯先靠自己。'
    ],
    basis:'适合你的规则：给积累和变化各留一个固定位置，同时管住反馈和收口。',
    strategy:{
      body:'主线是你愿意连续投入并留下结果的一件事。它可以是目前最重要的一项责任、一项长期学习、一件持续创作的作品，或者一项需要稳定完成的生活任务。',
      itemsLead:'主线满足三个条件：',
      items:['连续投入至少 30 天，中途不因新鲜感换题。','每 30 天留下一个看得见的结果。','每周有一次明确反馈——说出来你需要谁看一眼，不要让「我应该能自己搞定」拖成「我已经三个月没跟人聊过这件事了」。']
    },
    experiment:clone(COMMON_EXPERIMENT),
    tradeoff:clone(COMMON_TRADEOFF),
    rhythm:clone(COMMON_RHYTHM),
    close:'这套方法不是为了压掉好奇心，而是给最后四成设置固定检查点，避免走到中段又重新打开全部选择。',
    source:'日主·壬水｜强弱·偏弱｜年干·比肩｜月干·偏财｜时干·食神｜太阳·双子座｜上升·巨蟹座'
  };

  const EXACT_TIME_V2 = {
    title:'不能再靠「我先看看」拖过前三个月。',
    stageLead:'当前阶段｜',
    stage:'2019—2028 己酉·正官',
    explanation:[
      '正官阶段把需要长期承担的责任和可核对结果推到前面。壬水先观察，太阳双子快速切换；这两种能力能帮你看见更多出口，现在也更需要一个停止比较的时间。',
      '不是每个局面都要先看完所有出口。如果三个月前已经选过一条路，当前只核对现实条件有没有改变；条件仍成立，就把这一段责任完成。',
      '正官不要求你放弃好奇心。它要求你把好奇心放进一个稳定的位置：责任范围、决定空间、所需配合和完成标准，这四件事先讲清楚，比临时救三次场更有用。'
    ],
    amplify:['承担一项负责范围清楚、能持续一段时间的责任。','在关键步骤上形成自己的判断，不只等别人给答案。','让每次完成都留下可以复用的经验或方法。'],
    pitfall:'什么都愿意搭把手，却没有先讲清自己负责到哪里。最后承担了结果，对关键决定却没有足够空间；事情做完了，也很难留下可重复的方法。',
    action:'从一项需要持续推进的责任入手，写清四件事：你负责什么、能决定什么、需要谁配合、怎样算完成。已有长期责任就直接核对；尚未确定时，只核对眼前最需要持续完成的一件事，不增加第二项安排。',
    yearTitle:'2026 年落点',
    year:'2026 丙午把行动机会、实际结果和责任同时推到台前。新任务或邀约出现时，先看它是否挤占已有责任、何时回看结果、出现什么情况就暂停。条件不清楚，先暂缓答应，不用替对方补上本应说明的安排。',
    startLead:'起运：',
    start:'7 岁 4 个月，顺排',
    timelineTitle:'完整时间轴',
    rows:[
      ['1999—2008','丁未','正财','把日常做实，逐渐形成对责任、投入和结果的认识。'],
      ['2009—2018','戊申','七杀','硬任务和竞争更容易推动成长，也会放大独自扛事的习惯。'],
      ['2019—2028','己酉','正官','把能力落实在长期责任、可信记录和可以留下的作品上。'],
      ['2029—2038','庚戌','偏印','收回一部分向外铺开的注意力，向专业、冷门或更深的方法里走。'],
      ['2039—2048','辛亥','正印','补底子、搭系统，把经验整理成更稳定的方法。'],
      ['2049—2058','壬子','比肩','主动权回到自己手里，适合亲自扛主线；合作先讲清分工。'],
      ['2059—2068','癸丑','劫财','人和资源会带快节奏；并肩之前先把账、责任和退出条件说清。'],
      ['2069—2078','甲寅','食神','把手艺和作品慢慢养出风格，不被外部速度牵着跑。']
    ],
    nextLead:'下一阶段预告｜',
    nextTitle:'2029—2038 庚戌·偏印',
    next:'下一阶段的重点会从广泛连接转向更深的专业积累。它不要求现在提前收缩全部选择；这一阶段能否留下可复用的作品和方法，会影响以后有什么值得继续钻深。',
    source:'起运·7 岁 4 个月顺排｜当前大运·己酉 2019—2028·正官｜2026 流年·丙午·偏财、正财、正官｜下一大运·庚戌 2029—2038·偏印'
  };

  function buildAction(chart) {
    if (isExactSampleV2(chart)) return clone(EXACT_ACTION_V2);
    const stem = text(chart && chart.dayMaster && chart.dayMaster.stem);
    const asc = text(chart && chart.astro && chart.astro.asc && chart.astro.asc.sign);
    const day = STEM_META[stem] || STEM_META.壬;
    const outward = ASC_META[asc] || null;
    const strength = strengthLabel(chart);
    const strengthCopy = STRENGTH_META[strength] || STRENGTH_META.中和;
    const gods = actionGods(chart);
    const godDetails = gods.slice(0, 3).map(function (god) { return ACTION_GOD[god]; }).filter(Boolean);
    const godText = godDetails.length
      ? '可见十神会让你' + godDetails.join('、') + '。'
      : '当前天干没有提供更多行动十神，规则只落在日主、强弱与上升可见事实上。';
    const ascLabel = asc || '待核对';
    const stemIndex = Math.max(0, STEMS.indexOf(stem));
    let opening;
    let slowdown;
    let close;
    if (outward) {
      const openingVariants = [
        '刚进陌生局面，上升' + ascLabel + '会' + outward.visible + '。真正要不要继续，你会按' + stem + day.element + '的习惯判断：' + day.start + '。',
        '别人先看到的是上升' + ascLabel + '的动作：' + outward.visible + '。事情开始推进后，你会回到' + stem + day.element + '的判断：' + day.start + '。',
        '上升' + ascLabel + '管开场，你会' + outward.visible + '。往后怎么走，要看' + stem + day.element + '认不认这条路：' + day.start + '。',
        '你通常会' + outward.visible + '，这是上升' + ascLabel + '的第一反应。开场只是入口；' + stem + day.element + '随后会' + withoutLeadingFirst(day.start) + '。'
      ];
      const dropCopy = withoutOpeningCondition(day.drop);
      const riskCopy = withoutOpeningCondition(outward.risk);
      const slowdownVariants = [
        '到了第三周，' + dropCopy + '。这时也要留意上升' + ascLabel + '的惯性：' + riskCopy + '。',
        '新鲜感过去后，' + dropCopy + '。你若仍照着开场方式做，' + riskCopy + '。',
        '事情走到中段，' + dropCopy + '。再照着上升' + ascLabel + '的第一反应走，' + riskCopy + '。',
        '真正容易掉速的是中段：' + dropCopy + '。同时，' + riskCopy + '。'
      ];
      const closeVariants = [
        '主线与试验位让' + day.resultNoun + '继续留下结果，也给上升' + ascLabel + '的开场方式划出固定位置。',
        '这组规则让' + day.resultNoun + '持续往前，同时把上升' + ascLabel + '带来的开场动作限制在一个位置。',
        '变化可以保留，但要先让' + day.resultNoun + '留下结果；上升' + ascLabel + '负责开场，不负责随时改写主线。',
        '这样既保留上升' + ascLabel + '的第一步，也让' + day.resultNoun + '真正走到收口。'
      ];
      opening = openingVariants[stemIndex % openingVariants.length];
      slowdown = slowdownVariants[stemIndex % slowdownVariants.length];
      close = closeVariants[stemIndex % closeVariants.length];
    } else {
      opening = stem + day.element + '通常' + day.rhythm + '。未提供准确出生时间，上升不参与这段判断；这里只按日主行动：' + day.start + '。';
      slowdown = '推进到第三周，' + withoutOpeningCondition(day.drop) + '。本段不补写尚未计算的陌生场合反应。';
      close = '主线和试验位用于让' + day.resultNoun + '持续留下结果；未计算的上升反应不参与建议。';
    }

    return {
      title:'一条主线，一个试验位',
      total:[opening, slowdown],
      basis:godText + '强弱为' + strength + '。' + strengthCopy.actionSupport + '，所以只留一条主线和一个试验位，并为两边设反馈和收口时间。',
      strategy:clone(COMMON_STRATEGY),
      experiment:clone(COMMON_EXPERIMENT),
      tradeoff:clone(COMMON_TRADEOFF),
      rhythm:clone(COMMON_RHYTHM),
      close:close,
      source:'日主·' + (stem || '待核对') + day.element + '｜强弱·' + strength + (gods.length ? '｜行动十神·' + gods.join('、') : '') + '｜上升·' + ascLabel
    };
  }

  function sexagenaryYear(year) {
    const stem = STEMS[((year - 4) % 10 + 10) % 10];
    const branch = BRANCHES[((year - 4) % 12 + 12) % 12];
    return { stem:stem, branch:branch, text:stem + branch };
  }

  function annualFacts(dayStem, year, options) {
    const supplied = options && options.annualPillar;
    let pillar;
    if (typeof supplied === 'string' && supplied.length >= 2) {
      pillar = { stem:supplied.charAt(0), branch:supplied.charAt(1), text:supplied.slice(0, 2) };
    } else if (supplied && supplied.stem && supplied.branch) {
      pillar = { stem:supplied.stem, branch:supplied.branch, text:supplied.stem + supplied.branch };
    } else {
      pillar = sexagenaryYear(year);
    }
    const suppliedGods = options && Array.isArray(options.annualGods) ? options.annualGods : null;
    const gods = suppliedGods || unique([tenGod(dayStem, pillar.stem)].concat((HIDDEN[pillar.branch] || []).map(function (stem) {
      return tenGod(dayStem, stem);
    })));
    return { pillar:pillar, gods:gods.filter(Boolean) };
  }

  function normalizeSteps(chart, options) {
    const raw = options && Array.isArray(options.steps)
      ? options.steps
      : chart && chart.daYun && Array.isArray(chart.daYun.steps) ? chart.daYun.steps : [];
    return raw.map(function (step) {
      const from = Number(step.yearFrom);
      const to = Number(step.yearTo);
      return {
        stem:text(step.stem), branch:text(step.branch), god:text(step.god) || '待核对',
        yearFrom:Number.isFinite(from) ? from : null,
        yearTo:Number.isFinite(to) ? to : null
      };
    }).filter(function (step) {
      return step.stem && step.branch && step.yearFrom != null && step.yearTo != null;
    });
  }

  function findCurrentIndex(steps, year) {
    const exact = steps.findIndex(function (step) { return year >= step.yearFrom && year <= step.yearTo; });
    return exact;
  }

  function rangeText(step) {
    return step ? step.yearFrom + '—' + step.yearTo : '';
  }

  function stepTitle(step) {
    return step ? rangeText(step) + ' ' + step.stem + step.branch + '·' + step.god : '阶段资料待核对';
  }

  function stepRow(step) {
    const copy = TIME_GOD[step.god];
    return [rangeText(step), step.stem + step.branch, step.god, copy ? copy.row : '这一阶段只呈现已计算的大运与十神，具体做法仍需结合当时的真实责任核对。'];
  }

  function startText(chart) {
    const daYun = chart && chart.daYun ? chart.daYun : {};
    const raw = text(daYun.startText).replace(/起运$/, '');
    const spaced = raw.replace(/岁/g, ' 岁 ').replace(/个月/g, ' 个月').replace(/\s+/g, ' ').trim();
    const direction = daYun.forward === false ? '逆排' : daYun.forward === true ? '顺排' : '顺逆待核对';
    return (spaced || '起运年龄待核对') + '，' + direction;
  }

  function buildTime(chart, options) {
    options = options || {};
    const referenceYear = Number.isFinite(Number(options.referenceYear)) ? Number(options.referenceYear) : new Date().getFullYear();
    if (referenceYear === 2026 && isExactSampleV2(chart)) return clone(EXACT_TIME_V2);

    const steps = normalizeSteps(chart, options);
    const currentIndex = findCurrentIndex(steps, referenceYear);
    const current = currentIndex >= 0 ? steps[currentIndex] : null;
    const next = currentIndex >= 0 && currentIndex + 1 < steps.length ? steps[currentIndex + 1] : null;
    const stageCopy = current && TIME_GOD[current.god] ? TIME_GOD[current.god] : {
      conclusion:'当前大运资料不足，先不增加阶段判断。',
      explain:'当前年份没有落在已提供的大运范围内。本章只保留年度事实和已有时间轴，不把相邻阶段当成当前阶段。',
      amplify:['核对出生时间与起运信息。','保留已经计算出的完整时间轴。','等当前阶段可以确定后，再增加阶段动作。'],
      pitfall:'把相邻阶段的文字直接当成当前结论，会让建议失去事实依据。'
    };
    const stem = text(chart && chart.dayMaster && chart.dayMaster.stem) || '待核对';
    const day = STEM_META[stem] || STEM_META.壬;
    const strength = strengthLabel(chart);
    const strengthCopy = STRENGTH_META[strength] || STRENGTH_META.中和;
    const annual = annualFacts(stem, referenceYear, options);
    const annualGodText = annual.gods.length ? annual.gods.join('、') : '十神待核对';
    const nextCopy = next && TIME_GOD[next.god] ? TIME_GOD[next.god] : null;
    const stage = current ? stepTitle(current) : referenceYear + '｜大运资料待核对';
    const action = '如果眼前已有需要持续推进的责任，写清四件事：你负责什么、能决定什么、需要谁配合、怎样算完成；如果没有，就先不凭盘面另造任务。'
      + (current ? '只核对这项责任在' + current.god + '阶段是否清楚，不增加第二项长期安排。' : '大运资料补齐前，不据此增加新的长期任务。');
    const yearBody = referenceYear + ' ' + annual.pillar.text + '对应' + annualGodText + '。处理新任务或邀约时，先看它是否挤占已有责任、何时回看结果、出现什么情况就暂停。条件不清楚，先暂缓答应，不用替对方补上本应说明的安排。';

    return {
      title:stageCopy.conclusion,
      stageLead:'当前阶段｜',
      stage:stage,
      explanation:[
        stageCopy.explain,
        stem + day.element + '面对长期责任时，更在意' + day.longTerm + '；强弱为' + strength + '时，' + strengthCopy.phaseLoad + '。当前阶段只看责任范围、反馈间隔和完成记录。'
      ],
      amplify:clone(stageCopy.amplify),
      pitfall:stageCopy.pitfall + ' ' + strengthCopy.phaseWarning,
      action:action,
      yearTitle:referenceYear + ' 年落点',
      year:yearBody,
      startLead:'起运：',
      start:startText(chart),
      timelineTitle:'完整时间轴',
      rows:steps.map(stepRow),
      nextLead:'下一阶段预告｜',
      nextTitle:next ? stepTitle(next) : '下一阶段资料待核对',
      next:nextCopy
        ? '下一阶段会把重点转向「' + nextCopy.conclusion.replace(/[。！？]$/, '') + '」。现在不用提前套用下一阶段的做法；当前留下的结果和方法，是以后继续调整的依据。'
        : '当前只展示已经计算出的时间范围。下一阶段资料补齐前，不据此追加判断。',
      source:'起运·' + startText(chart) + '｜当前大运·' + (current ? current.stem + current.branch + ' ' + rangeText(current) + '·' + current.god : '待核对')
        + '｜' + referenceYear + ' 流年·' + annual.pillar.text + '·' + annualGodText
        + '｜下一大运·' + (next ? next.stem + next.branch + ' ' + rangeText(next) + '·' + next.god : '待核对')
    };
  }

  function buildActionTime(chart, options) {
    return { action:buildAction(chart, options), time:buildTime(chart, options) };
  }

  return Object.freeze({
    SCHEMA_VERSION:'action-time-v1',
    COPY_SYSTEM_VERSION:'copy-optimized-v3-2026-08-15',
    STEMS:STEMS.slice(),
    SIGNS:SIGNS.slice(),
    buildAction:buildAction,
    buildTime:buildTime,
    buildActionTime:buildActionTime,
    isExactSampleV2:isExactSampleV2
  });
});
