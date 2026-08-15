/* 知星关系章内容模块 V1
 * 数据合同：classic script + CommonJS。
 * 只根据确定性盘面生成关系内容，不假定婚恋、职业或家庭状态。
 */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZhixingRelationContentV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const OPTIMIZED_COPY = (typeof module === 'object' && module.exports)
    ? require('./content-copy-optimized-v3.js')
    : (root && root.ZhixingCopyOptimizedV3);

  const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const MOON_SIGNS = ['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座'];

  const STEM_META = {
    甲: {
      element:'木', title:'先守住方向', approach:'你靠近一个人时，会先确认彼此要往哪里走，再用持续回应和实际承担表达在意。', approachNoun:'持续承担',
      trigger:'对方反复改变说法，或临时推翻已经讲定的事时', conflictAction:'先把共同确认过的部分守住', goal:'把约定定住', misread:'你不肯商量',
      withdraw:'停止重复解释，按自己认定的做法先往前走', returnCondition:'分清哪些可以调整、哪些仍要保留', returnAction:'主动说明自己守住的是什么，也听对方要改哪一处',
      value:'不轻易丢掉共同做过的决定', cost:'停下时没有说明压力，对方会把坚持听成拒绝', withdrawMisread:'你已经决定不再谈'
    },
    乙: {
      element:'木', title:'先绕开锋芒', approach:'你靠近一个人时，会先看对方是否自在，再调整说法和距离，让两个人都有继续说话的位置。', approachNoun:'留出的余地',
      trigger:'语气越来越硬，或每个可以转圜的入口都被堵住时', conflictAction:'先换一种说法，避开正面顶撞', goal:'让话还能继续', misread:'你没有明确意见',
      withdraw:'减少回应，绕开当下最尖锐的那句话', returnCondition:'找到不伤人又能说清要求的表达', returnAction:'从一个双方都能做到的小改动谈起',
      value:'给双方留下转身和修正的位置', cost:'调整得太多时，自己的要求会被藏掉', withdrawMisread:'你把真正意见收了回去'
    },
    丙: {
      element:'火', title:'先把话照亮', approach:'你靠近一个人时，会主动回应、说出欣赏，也愿意把正在发生的事摆到明面上一起处理。', approachNoun:'主动表达',
      trigger:'你的用意被误解，或热情只得到含糊回应时', conflictAction:'把话说得更响亮，希望尽快澄清', goal:'让对方明白你的本意', misread:'你只想压过别人',
      withdraw:'收回主动，不再替谈话补气氛或找台阶', returnCondition:'确认彼此还愿意把真实想法说出来', returnAction:'直接说明自己为什么受伤，也重新给出回应',
      value:'让关心和认可清楚可见', cost:'突然变冷时，对方会把失望听成惩罚', withdrawMisread:'你的热情已经全部撤走'
    },
    丁: {
      element:'火', title:'先收住情绪', approach:'你靠近一个人时，会留意停顿、语气和小变化，再用一句合时宜的话或一个细小动作回应。', approachNoun:'细致关心',
      trigger:'一句话轻轻带过你的感受，或同样的刺反复出现时', conflictAction:'先把情绪压低，反复确认那句话是什么意思', goal:'把真正的刺找准', misread:'你在为小事计较',
      withdraw:'安静下来，在心里来回推敲那句话', returnCondition:'把感受整理成不会伤人的具体表达', returnAction:'指出是哪句话让自己难受，并说出希望怎样重讲',
      value:'很少拿未经整理的气话伤人', cost:'开口太晚时，对方会以为事情早已过去', withdrawMisread:'这件事对你并不重要'
    },
    戊: {
      element:'土', title:'先接住局面', approach:'你靠近一个人时，会用守约、按时回应和处理实际问题表达在意，很少只靠一时热闹。', approachNoun:'可靠安排',
      trigger:'约定不断变动，或责任被临时推到你这里时', conflictAction:'先稳住必须完成的部分，把情绪放到后面', goal:'让事情不要失控', misread:'你只顾事情不顾感受',
      withdraw:'少说话，把能处理的部分独自接下来', returnCondition:'把事实、责任和能做到的范围列清楚', returnAction:'逐项说明自己接什么、不接什么，再邀请对方回应',
      value:'让关系在混乱里仍有可靠的落点', cost:'接得太久才停，对方看不到你何时已经超出负荷', withdrawMisread:'你愿意继续一个人扛'
    },
    己: {
      element:'土', title:'先照顾细处', approach:'你靠近一个人时，会记住对方提过的小事，调整相处中的细节，让日常往来更省力。', approachNoun:'细节照顾',
      trigger:'零碎要求不断增加，真正问题却一直没说清时', conflictAction:'先逐件补漏，希望别让任何一处掉下来', goal:'把每个人的需要都照顾到', misread:'你答应了所有要求',
      withdraw:'继续做小事，却避开最需要说明的那一句', returnCondition:'找出当前最要紧的一件事和自己的真实要求', returnAction:'先说一个具体请求，再商量谁来完成哪一步',
      value:'能把关心放进日常可见的小事', cost:'自己的请求省略太久，照顾会慢慢变成委屈', withdrawMisread:'只要小事照常就没有问题'
    },
    庚: {
      element:'金', title:'先切清问题', approach:'你靠近一个人时，会把问题说清、给出可行办法，也愿意在关键时刻直接站出来处理。', approachNoun:'直接帮助',
      trigger:'事实被反复混淆，或讨论从事情转向人身评价时', conflictAction:'迅速指出问题所在，删掉无关说法', goal:'把问题切清', misread:'你只认自己的答案',
      withdraw:'停止当下对话，不再接住绕圈或攻击', returnCondition:'确认双方可以只谈事实和下一步', returnAction:'从最关键的一件事实重新谈，并允许方案被修正',
      value:'能让混乱迅速回到可以处理的事情', cost:'语气过快过硬时，正确的话也会让人难以接住', withdrawMisread:'你要把人和问题一起切断'
    },
    辛: {
      element:'金', title:'先把话磨准', approach:'你靠近一个人时，会斟酌措辞、记住分寸，也会用一件做得周到的小事代替夸张表态。', approachNoun:'分寸和周到',
      trigger:'承诺说得随便，或粗糙的表达一再碰到你在意之处时', conflictAction:'先检查每个字，希望指出得准确又体面', goal:'把标准和感受都说准', misread:'你在挑字眼',
      withdraw:'把没说出口的话一遍遍修改，暂时不交出去', returnCondition:'找到既真实又不会越界的说法', returnAction:'点出具体言行和自己的要求，不把判断扩大到整个人',
      value:'很少用笼统指责代替真实问题', cost:'表达磨得太久，真实需要会迟到', withdrawMisread:'你已经默认接受这件事'
    },
    壬: {
      element:'水', title:'先退开整理', approach:'你靠近一个人时，会先听进不同立场，给彼此留空间，再决定自己真正要回应什么。', approachNoun:'倾听和空间',
      trigger:'对方要求你立刻解释，或逼你当场给出答案时', conflictAction:'先收回表达，把事情在心里完整走一遍', goal:'交出自己认可的答案', misread:'你根本不在乎',
      withdraw:'关上当下的对话，独自整理事实和感受', returnCondition:'形成一个自己认可、也能讲完整的答案', returnAction:'把介意之处、可商量之处和决定分别说清',
      value:'不想拿气话伤人', cost:'没有说明返回时间时，对方会把整理听成退出', withdrawMisread:'你不会再回来'
    },
    癸: {
      element:'水', title:'先读懂变化', approach:'你靠近一个人时，会先注意语气、停顿和没有说完的话，再用安静而具体的回应接住对方。', approachNoun:'对细微信号的留意',
      trigger:'说法和行动互相矛盾，或对方让你反复猜意思时', conflictAction:'继续观察细节，暂时不急着下结论', goal:'确认真实意思', misread:'你什么都没有表态',
      withdraw:'减少主动，等后续行动给出更多证据', returnCondition:'把观察到的差异变成一个可以回答的问题', returnAction:'说出具体哪两件事对不上，并请对方解释',
      value:'能接到别人还没说完整的不舒服', cost:'等对方自己发现你的难受，误会会越积越多', withdrawMisread:'你已经默许当前做法'
    }
  };

  const MOON_META = {
    白羊座:{ short:'白羊', title:'再直接回应', need:'关系里有即时、坦白的回应', closeAction:'当场接住对方的话，并很快给出下一步', pressure:'受压时会把第一反应立刻说出来', effect:'话就越快、越直', repair:'不愿让分歧长期悬着，冷静后想尽快谈完', returnStyle:'直接回应和明确结论' },
    金牛座:{ short:'金牛', title:'再用行动确认', need:'相处有连续而可靠的回应', closeAction:'用一件能反复做到的小事回应，而不是临时表态', pressure:'受压时会放慢回应，并抓住已经确认的做法', effect:'回应就越慢，立场也越难松动', repair:'要先确认相处还能稳定，才愿意重新开口', returnStyle:'可执行的安排和持续行动' },
    双子座:{ short:'双子', title:'再把疑问说开', need:'疑问能被说出来，也能得到来回讨论', closeAction:'提问、接话和及时交换新信息', pressure:'受压时会连续提问，也会很快切换说法', effect:'问题就越多，话题也越容易岔开', repair:'会从一个新角度重开话题，不愿停在单一结论', returnStyle:'解释、追问和新的说法' },
    巨蟹座:{ short:'巨蟹', title:'再确认感受', need:'情绪被认真接住，回应里带着关心', closeAction:'先问对方现在好不好，再处理事情本身', pressure:'受压时会先听语气，确认自己是否还被在意', effect:'语气变化就越容易盖过事情本身', repair:'要先确认彼此没有把关心撤走，才愿意继续谈', returnStyle:'对感受的确认和照顾' },
    狮子座:{ short:'狮子', title:'再把尊重说清', need:'态度里有明确认可，分歧中也保留尊重', closeAction:'公开回应和清楚表达欣赏', pressure:'受压时会先守住体面，不愿在轻视中退让', effect:'姿态就越明显，语气也越难放软', repair:'愿意重谈，但要先听见真实认可和基本尊重', returnStyle:'坦荡表态和清楚认可' },
    处女座:{ short:'处女', title:'再对准细节', need:'问题有具体说法，承诺能落到步骤', closeAction:'记住细节、补上遗漏并说明下一步', pressure:'受压时会检查细节，追问哪一句、哪一步出了错', effect:'细节就越密，主问题也越容易被拆散', repair:'会带着更准确的说法回来，逐项确认怎样修正', returnStyle:'具体事实和可检查的改法' },
    天秤座:{ short:'天秤', title:'再让双方说完', need:'两边都有完整说话的位置，决定也尽量公平', closeAction:'先听完不同说法，再找双方都能接受的入口', pressure:'受压时会软化语气，也会迟迟不愿替任何一方拍板', effect:'顾虑就越多，真正立场也越晚出现', repair:'想让双方重新说完整，再找一个可共同执行的版本', returnStyle:'对等表达和共同确认' },
    天蝎座:{ short:'天蝎', title:'再交出实情', need:'说法和行动一致，重要的事不被含糊带过', closeAction:'持续而专注地回应，并留意前后是否一致', pressure:'受压时会盯住矛盾处，不接受轻描淡写的解释', effect:'追问就越深，沉默也越有分量', repair:'只有确认对方愿意讲实情，才会把自己的真实反应交出来', returnStyle:'直指要害的事实和坦白' },
    射手座:{ short:'射手', title:'再回来讲明白', need:'坦率和呼吸空间同时存在', closeAction:'直说真实想法，也允许彼此保留不同意见', pressure:'受压时想离开逼迫，又不愿让真相一直没说清', effect:'退开的动作就越快，回来说明的冲动也越强', repair:'会想回来把真相讲明白，不愿让关系停在猜测里', returnStyle:'坦率说明和可以商量的空间' },
    摩羯座:{ short:'摩羯', title:'再给明确安排', need:'承诺有期限、有责任人，也能被实际完成', closeAction:'明确时间、责任和能做到的结果', pressure:'受压时会收紧表达，先问最后由谁负责', effect:'话就越像结论，情绪也越晚被说出', repair:'会在责任和时间重新清楚以后继续谈', returnStyle:'期限、责任和可兑现的安排' },
    水瓶座:{ short:'水瓶', title:'再换角度重谈', need:'彼此可以独立思考，也能讨论不同做法', closeAction:'换一个角度提问，并保留不马上认同的空间', pressure:'受压时会拉开距离，用分析代替当下情绪', effect:'说法就越冷静，真实感受也越难被听见', repair:'会带着新角度回来，重新讨论规则是否合理', returnStyle:'新的解释和更合适的相处办法' },
    双鱼座:{ short:'双鱼', title:'再轻一点开口', need:'语气温和，难受能被体谅而不被催促', closeAction:'先回应情绪，再慢慢问清真正需要什么', pressure:'受压时会吸收现场情绪，把自己的不舒服先吞回去', effect:'说话就越轻，真正介意之处也越容易消失', repair:'等情绪缓下来以后，仍想用温和方式恢复靠近', returnStyle:'体谅、感受和不带攻击的请求' }
  };

  const RELATION_GOD_META = {
    比肩:{
      trigger:'对方替你下结论',
      conflict:'你会先守住自己的判断，不愿顺着别人的答案表态',
      returnAction:'先说明哪些决定要由自己做，再讲哪些部分可以商量'
    },
    劫财:{
      trigger:'双方开始比较谁付出更多，或对方抢着替彼此做决定',
      conflict:'你会马上争回主动，语气和动作都随之加快',
      returnAction:'先分清谁决定哪一件事，再约好各自要回应什么'
    },
    食神:{
      trigger:'谈话只剩指责，没有一点缓和',
      conflict:'你会先放轻语气或换个话题，真正介意之处反而没说',
      returnAction:'先说真实的不舒服，再给一个双方都能做到的小动作'
    },
    伤官:{
      trigger:'对方的说法前后不一',
      conflict:'你会直接指出矛盾，语气比自己预想的更尖',
      returnAction:'只谈那一句或那件事，不把判断扩大到整个人'
    },
    偏财:{
      trigger:'一个问题同时出现几种解决办法',
      conflict:'你会迅速换路线，原来的分歧却没有真正收口',
      returnAction:'选定一个办法和停止时间，其他选项先不展开'
    },
    正财:{
      trigger:'说好的事反复没有做到',
      conflict:'你会把承诺和实际行动逐项对照，越说越具体',
      returnAction:'重新讲清各自答应什么、何时做到，做不到怎样提前说明'
    },
    七杀:{
      trigger:'对方用命令、逼迫或强硬语气要求马上表态',
      conflict:'你会立刻进入应对，先处理压力，真实想法晚一步出现',
      returnAction:'先把要求和威胁分开，说明愿意谈什么、遇到什么行为会停止'
    },
    正官:{
      trigger:'双方开始争论谁该负责、什么才算说到做到',
      conflict:'你会先按约定判断对错，语气也变得像在定规则',
      returnAction:'把共同约定、自己的责任和希望对方回应的部分分别说清'
    },
    偏印:{
      trigger:'一句话里有矛盾，或还有意思没有说完',
      conflict:'你会退回心里重新推演，对方很难跟上结论从哪里来',
      returnAction:'把中间最关键的一步说出来，再问对方是否同意这个前提'
    },
    正印:{
      trigger:'对方只要答案，不愿听来龙去脉',
      conflict:'你会不断补充解释，希望先被理解，重点反而越说越散',
      returnAction:'先复述自己听懂的部分，再只说一个需要回应的请求'
    }
  };

  const COMMON_STRENGTHS = [
    {
      id:'mild', label:'轻微不适', title:'先确认，不靠猜',
      scene:'一句话让你不舒服，但对方没有反复攻击，双方还在听。',
      quote:'你刚才那句话我听着有点不舒服，我怕自己理解错了。你能再说具体一点吗？',
      why:'先请对方把意思说完整，再判断问题出在哪一句；普通分歧不需要立刻退出谈话。'
    },
    {
      id:'pause', label:'需要暂停', title:'停止升级，也明确会回来',
      scene:'你已经连续解释两次，语气开始变重，或双方不断打断。',
      quote:'我现在再说下去，话肯定会变重。我先停一会儿，今晚八点我主动找你，把这件事说完。',
      why:'「今晚八点」只是示例，换成双方确认、而且你能做到的时间；说出时间以后，暂停才不会被听成退出。'
    },
    {
      id:'return', label:'主动返回', title:'按约定回来，把分歧说清',
      scene:'你已经按约定停下，也能说清自己介意什么、哪些部分还能商量。',
      quote:'刚才那件事我想清楚了。我介意的是被逼着当场给答案。时间可以再商量，但没想清楚之前，我不会先答应。',
      why:'不要等对方追问；由你按约定主动重新开口，谈清介意之处和仍可商量的部分。'
    },
    {
      id:'abuse', label:'对话越界', title:'保留沟通，但停止攻击',
      scene:'已经出现辱骂、威胁或其他人身攻击。',
      quote:'这件事我愿意谈，但你再骂人或威胁我，我就先走。等能只谈事情的时候，我们再继续。',
      why:'这不是普通分歧的日常话术，只在对话方式已经越过底线时使用。'
    }
  ];

  const EXACT_V2 = {
    title:'先退开，再回来，别让对方猜',
    lead:'你进入关系时会先照顾气氛。上升巨蟹让你注意对方的情绪，壬水让你先听进不同立场。你愿意留空间，但空间给得太多，对方就分不清你是不在乎，还是还没开口。',
    friction:'真正的冲突往往不是吵架，而是对方要求你立刻解释。',
    synthesis:[
      '月亮射手在难受时想把真相说清；壬水和比肩却要先把事情在心里走一遍，才愿意交出答案。一个想尽快说清，一个需要先整理，这就是时间差。',
      '你的反应顺序通常是：先照顾气氛，受到催促时退开整理，再回来把话说清。问题不在退开，而在那段沉默里，对方只看见你关上了门。',
      '你的长处是通常不愿拿气话伤人；风险是没有说出返回时间时，对方会以为这次谈话不会继续。',
      '双盘融合类型：场景切换 + 反向补偿。壬水先退开整理，月亮射手随后要回来坦率；一个先退，一个再进，最容易被误解的正是这段时间差。'
    ],
    strengths:COMMON_STRENGTHS,
    source:'日主·壬水｜年干·比肩｜月亮·射手座｜上升·巨蟹座'
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeMoonSign(value) {
    const raw = text(value).replace(/^月亮[·・]?/, '');
    if (!raw) return '';
    return /座$/.test(raw) ? raw : raw + '座';
  }

  function pillarText(pillar) {
    return pillar && pillar.stem && pillar.branch ? pillar.stem + pillar.branch : '';
  }

  function strengthLabel(chart) {
    return text(chart && chart.fiveElements && chart.fiveElements.dayMasterStrength && chart.fiveElements.dayMasterStrength.label);
  }

  function isExactV2Chart(chart) {
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

  function relationGodFromChart(chart) {
    const gods = chart && chart.tenGods ? chart.tenGods : {};
    if (gods.year && gods.year.stem && gods.year.stem !== '日主') return text(gods.year.stem);
    if (gods.month && gods.month.stem && gods.month.stem !== '日主') return text(gods.month.stem);
    return '';
  }

  function flag(value, fallback) {
    return value == null ? fallback === true : value === true;
  }

  function resolveInput(input) {
    const source = input || {};
    const chart = source.chart || (source.pillars && source.astro ? source : null);
    const suppliedMoon = source.moon && typeof source.moon === 'object' ? source.moon : null;
    const astroMoon = chart && chart.astro && chart.astro.moon ? chart.astro.moon : null;
    const stem = text(source.stem || source.dayStem || (chart && chart.pillars && chart.pillars.day && chart.pillars.day.stem));
    const moonSign = normalizeMoonSign(source.moonSign || (suppliedMoon && suppliedMoon.sign) || source.moon || (astroMoon && astroMoon.sign));
    const relationGod = text(source.relationGod || (chart && relationGodFromChart(chart)));
    const moonApprox = flag(source.moonApprox, flag(suppliedMoon && suppliedMoon.approx, astroMoon && astroMoon.approx));
    const moonNearEdge = flag(source.moonNearEdge, flag(suppliedMoon && suppliedMoon.nearEdge, astroMoon && astroMoon.nearEdge));
    return {
      source:source, chart:chart, stem:stem, moonSign:moonSign, relationGod:relationGod,
      moonApprox:moonApprox, moonNearEdge:moonNearEdge
    };
  }

  function moonSource(data) {
    if (data.moonNearEdge) {
      return data.moonApprox
        ? '月亮·待核对（按正午近似，靠近换座分界）'
        : '月亮·待核对（靠近换座分界）';
    }
    return '月亮·' + data.moonSign + (data.moonApprox ? '（按正午近似）' : '');
  }

  function buildPendingMoon(data, stem, god, sourceParts) {
    const synthesis = [
      '谈话继续打转时，你会' + stem.withdraw + '。月亮靠近换座分界，本段不猜某个星座会怎样；先观察你是否会在能' + stem.returnCondition + '以后，说明何时回来。'
    ];
    if (god) {
      synthesis.push(god.trigger + '时，' + god.conflict + '。能' + stem.returnCondition + '，' + god.returnAction + '；月亮位置核准前，不把重新开口的方式归到某个星座。');
    }
    synthesis.push('重新开口时，你会' + stem.returnAction + '。你的长处是：' + stem.value + '；代价是：' + stem.cost + '。月亮位置核准后，再补充你更需要怎样的回应。');

    return {
      title:stem.title + '，再核对需要',
      lead:stem.approach + '月亮靠近换座分界，具体需要暂不下结论；先观察你是否仍会把' + stem.approachNoun + '放进真实互动，再等月亮位置核准。',
      friction:stem.trigger + '，你会' + stem.conflictAction + '。月亮位置尚未确定，这里不补写某个星座的受压反应；先记下当时发生了什么、你说了什么，以及对方怎样回应。',
      synthesis:synthesis,
      strengths:clone(COMMON_STRENGTHS),
      source:sourceParts.join('｜')
    };
  }

  function build(input) {
    const data = resolveInput(input);
    if (data.source.exactV2 === true || isExactV2Chart(data.chart)) return clone(EXACT_V2);
    if (!STEM_META[data.stem]) throw new RangeError('未知日主：' + (data.stem || '空'));
    if (data.moonSign && !MOON_META[data.moonSign]) throw new RangeError('未知月亮星座：' + data.moonSign);
    if (!data.moonNearEdge && !MOON_META[data.moonSign]) throw new RangeError('未知月亮星座：' + (data.moonSign || '空'));
    if (data.relationGod && !RELATION_GOD_META[data.relationGod]) throw new RangeError('未知关系十神：' + data.relationGod);

    if (!data.moonNearEdge && OPTIMIZED_COPY && OPTIMIZED_COPY.relation) {
      const relationKey = data.stem + '×' + data.moonSign + '×' + (data.relationGod || '未提供');
      const optimized = OPTIMIZED_COPY.relation[relationKey];
      if (optimized) {
        const result = clone(optimized);
        if (data.moonApprox) result.source += '（按正午近似）';
        return result;
      }
    }

    const stem = STEM_META[data.stem];
    const god = RELATION_GOD_META[data.relationGod];
    const sourceParts = ['日主·' + data.stem + stem.element];
    if (data.relationGod) sourceParts.push('关系十神·' + data.relationGod);
    sourceParts.push(moonSource(data));
    if (data.moonNearEdge) return buildPendingMoon(data, stem, god, sourceParts);

    const moon = MOON_META[data.moonSign];
    const stemIndex = STEMS.indexOf(data.stem);

    const leadVariants = [
      stem.approach + '你还会在意' + moon.need + '，所以常常' + moon.closeAction + '。这是月亮' + moon.short + '在关系里的直接反应，也让关心不只停在心里。',
      stem.approach + '月亮' + moon.short + '在意的是：' + moon.need + '。落到相处里，你会' + moon.closeAction + '；这是你确认彼此还愿意靠近的方式。',
      stem.approach + '相处时，你也希望' + moon.need + '，常会' + moon.closeAction + '。这部分更接近月亮' + moon.short + '的反应，也和你原本的靠近方式接得上。',
      stem.approach + '当你想让对方感到安心，还会在意' + moon.need + '，通常会' + moon.closeAction + '。这些做法延续了原本的' + stem.approachNoun + '，也在表达在意。'
    ];

    const synthesis = [
      '谈话继续打转时，你会' + stem.withdraw + '；月亮' + moon.short + moon.repair + '。两种反应都需要一点停顿，但若没有交代什么时候再谈，对方只会看见“' + stem.withdrawMisread + '”，很难判断这次停顿意味着什么。'
    ];
    if (god) {
      synthesis.push(god.trigger + '时，' + god.conflict + '。这时别急着解释全部；' + god.returnAction + '。先处理眼前这一件事，对方更容易知道该回应哪一处，话题也不易散开。');
    }
    const returnVariants = [
      '能' + stem.returnCondition + '以后，你会' + stem.returnAction + '。重谈时，月亮' + moon.short + '更容易带出' + moon.returnStyle + '。' + stem.value + '是你的长处；不过，' + stem.cost + '。',
      '等你' + stem.returnCondition + '，你会' + stem.returnAction + '。重谈时，你偏向' + moon.returnStyle + '，这是月亮' + moon.short + '较自然的表达。' + stem.value + '是你的长处；不过，' + stem.cost + '。',
      '等到可以' + stem.returnCondition + '，你会' + stem.returnAction + '。这次重谈带着' + moon.returnStyle + '，也符合月亮' + moon.short + '的需要。' + stem.value + '是你的长处；不过，' + stem.cost + '。',
      '回到谈话时，你会' + stem.returnAction + '。你也会带着' + moon.returnStyle + '继续，这是月亮' + moon.short + '较自然的方式。你的长处是' + stem.value + '；需要留意的是' + stem.cost + '。'
    ];
    synthesis.push(returnVariants[stemIndex % returnVariants.length]);

    return {
      title:stem.title + '，' + moon.title,
      lead:leadVariants[stemIndex % leadVariants.length],
      friction:stem.trigger + '，你会' + stem.conflictAction + '；月亮' + moon.short + moon.pressure + '。你越想' + stem.goal + '，' + moon.effect + '；对方先听见“' + stem.misread + '”。',
      synthesis:synthesis,
      strengths:clone(COMMON_STRENGTHS),
      source:sourceParts.join('｜')
    };
  }

  function fromChart(chart) {
    return build(chart);
  }

  return Object.freeze({
    version:'1.0.0',
    STEMS:Object.freeze(STEMS.slice()),
    MOON_SIGNS:Object.freeze(MOON_SIGNS.slice()),
    build:build,
    fromChart:fromChart,
    isExactV2Chart:isExactV2Chart
  });
});
