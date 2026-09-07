/* 知星行动与时间文案。段落按盘面选择；起运、大运、流年只取计算结果。 */
(function (root, factory) {
  'use strict';
  const engine = typeof module === 'object' && module.exports ? require('./bazi-engine.js') : null;
  const api = factory(function () { return engine || (root && root.BaziEngine); });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZhixingActionTimeContentV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (getEngine) {
  'use strict';
  const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const BRANCHES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const SIGNS = ['白羊座','金牛座','双子座','巨蟹座','狮子座','处女座','天秤座','天蝎座','射手座','摩羯座','水瓶座','双鱼座'];
  const ELEMENT = {甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水'};

  // 每个字段都是完整中文；相邻内容按作用分开，不轮转半句制造差异。
  const DAY = {
    甲:{title:'认准要做的事，给方法留出变化', opening:'日主甲木让你在动手前先认目标。你需要知道这件事为什么值得做；认定以后，辛苦本身很难把你劝退。', phase:'日主甲木看重多年以后能留下什么。短暂的称赞很难代替你对自身成长的判断；有些事做得顺，你仍会问自己是否还在往想去的地方走。'},
    乙:{title:'会转弯，也要说清自己的选择', opening:'日主乙木擅长利用手边的条件。工具不齐、人手没到，你也能先找一处做起来，再边做边补。', phase:'日主乙木重视自己与环境能否相处得久。经历增加以后，你会更清楚哪些迁就是值得的，哪些安排已经让自己长期委屈。'},
    丙:{title:'起步有热情，做下去要有回应', opening:'日主丙火会先讲出这件事最让人期待的地方。你把意思说透，别人有了反应，自己也会更想立刻动手。', phase:'日主丙火在意自己有没有被看见。随着经历增加，你会重新衡量掌声的分量：热闹过后，哪些认可仍然让你觉得值得。'},
    丁:{title:'抓得住细处，也要让整体成形', opening:'日主丁火会先盯住最影响感受的一处。别人已经觉得差不多，你还听得出一句话的别扭，看得见一个细节的不妥。', phase:'日主丁火对自己认定的人和事投入得深。时间会让你分清，哪些牵挂一直滋养着你，哪些已经只剩下舍不得放手。'},
    戊:{title:'基础搭稳以后，允许自己往前走', opening:'日主戊土要先确认基础牢不牢。你会查遗漏、补准备，让后来每一步都能接在前一步上。', phase:'日主戊土看重生活能否安定下来。你愿意花时间积累，但也会因此迟迟不动那些已经不合用的旧安排。'},
    己:{title:'照顾细节，也看见整件事的轻重', opening:'日主己土会把一件大事拆成手边能处理的小事。你记得缺什么、谁还没收到，也能把零散的后续照顾到。', phase:'日主己土容易用生活是否井然有序来评价自己。随着承担增多，你需要重新看见自己的喜好，别让照料所有人占满了全部生活。'},
    庚:{title:'出手干脆，遇到新事实也能转向', opening:'日主庚金会直接找出挡路的地方。你愿意处理别人绕开的麻烦，尤其受不了同一个问题一直谈、一直没解决。', phase:'日主庚金看重自己能不能独当一面。经验增加以后，值得重新衡量的是：哪些坚持成了本事，哪些只是在替旧判断争一口气。'},
    辛:{title:'标准要清楚，成品也要见人', opening:'日主辛金对完成的样子有要求。你在乎分寸、质感和准确，愿意花时间把粗糙的地方一点点修好。', phase:'日主辛金在意自己的水准是否站得住。眼光越来越高以后，你也会对过去的自己更挑剔，忘了当时已经尽了怎样的努力。'},
    壬:{title:'办法想得快，让手上的东西跟上', opening:'日主壬水习惯把问题放回整件事里想。眼前一处走不通，你会去找别的办法，也能把不同地方的经验接起来用。', phase:'日主壬水重视自己是否还有选择。经历越多，越需要分清哪些选择真的让生活变宽，哪些只是让你舍不得在任何地方久留。'},
    癸:{title:'看出问题以后，把改动做出来', opening:'日主癸水善于从细小的不对劲里找到问题。你会发现一句解释少了什么，一个步骤哪里不顺，再从那一点动手。', phase:'日主癸水会记住许多别人已经忘了的感受。时间往前走时，你也在重新理解过去；有些旧事需要一个新解释，才不再牵动今天的决定。'}
  };

  const ASC = {
    白羊座:{opening:'上升白羊通常先行动。遇到新事，别人还在讨论要不要试，你已经发出消息，或把第一份草稿做出来了。', close:'开工时补一句：“这一步我先试，后面还会调整。”别人知道你在试什么，就不必靠猜测配合。'},
    金牛座:{opening:'上升金牛通常先看时间和手边的东西够不够。你不轻易开头，一旦开始，别人会发现你能按同一种做法持续很久。', close:'结束前把下次要用的东西留在顺手的位置。少一道重新准备的手续，第二天更容易接着做。'},
    双子座:{opening:'上升双子通常从提问开始。你边问边试，很快找出几种入口；别人还在回答上一问，你已经想到下一处怎么做。', close:'向人请教时说明眼下最想解决的那一处。问得集中，得到的回答才接得上手里的动作。'},
    巨蟹座:{opening:'上升巨蟹通常先留意现场的人。谁不太愿意、谁还没听懂，你会调整开场，照顾对方能接受的说法。', close:'需要配合时，直接说出希望对方做的那件事。留给别人一句明确的请求，比反复试探他的态度更省力。'},
    狮子座:{opening:'上升狮子通常先把方向说出来。你愿意站到前面，让别人知道接下来往哪里走，也会认真对待自己公开说过的话。', close:'修改已经说出的做法时，讲清你新发现了什么。别人更容易跟上变化，你也不必为了维持最初的姿态硬撑。'},
    处女座:{opening:'上升处女通常先找缺口。你会把步骤拆开，马上看见哪里还没准备好；事情经过你手里，遗漏会明显减少。', close:'给人看成果时，先让他完整用一遍。实际卡住的地方，往往比你预先列出的担心更值得改。'},
    天秤座:{opening:'上升天秤通常先听几方意见。有人争执时，你会把彼此的理由重新说一遍，找出能够先商量的那一部分。', close:'收集完意见，再单独留一点时间作决定。那段时间里先写自己的选择，不继续替每个人补充理由。'},
    天蝎座:{opening:'上升天蝎通常先弄清真正的阻力。你不急着亮出全部判断，会先看谁能决定、哪里最难动，再选择出手的位置。', close:'进展停住时，说清卡在哪里。你不必把全部思考摊开，但一起做事的人需要知道下一步还缺什么。'},
    射手座:{opening:'上升射手通常先看事情有没有意思、能带自己去哪里。你愿意边走边学，陌生环境反而能让你很快进入状态。', close:'把枯燥的练习接到一次实际使用上。知道学会以后能做什么，你更愿意把重复的部分练熟。'},
    摩羯座:{opening:'上升摩羯通常先排顺序。你会看看哪些事今天必须处理、哪些可以往后放，别人常在还没理清头绪时就开始跟着你的安排走。', close:'向人说明安排时，把最难的那一步先说出来。配合的人知道哪里需要帮忙，日程才不只是你一个人的负担。'},
    水瓶座:{opening:'上升水瓶通常先问现成做法为什么这样定。你会换个角度试，尤其愿意改掉那些大家沿用很久、却没人说得清缘由的步骤。', close:'介绍新方法时，先演示它比旧方法少了哪一步。别人亲眼看懂，才更愿意一起改变习惯。'},
    双鱼座:{opening:'上升双鱼通常先进入事情的氛围。一个画面、一段音乐或别人的情绪，都能帮你找到开头，外界的打断也会很快带走你的注意力。', close:'需要专心时，把聊天和待办提醒暂时收起来。让眼前只剩正在做的东西，思路更容易接成完整的一段。'}
  };

  const FORCE = {
    偏弱:{body:'日主偏弱，连续处理太多要求会很快耗掉你的力气。最费劲的常是来回切换：刚进入一件事，又被叫去回应另一件事，忙了很久却没有做完的踏实感。', rhythm:['把最需要专注的部分放在精神最好的时候。','一次停下来以前，给下次留一句“接下来先做什么”。']},
    中和:{body:'日主中和，熟悉的部分你能独立做，新情况来了也肯调整。难处在于每次多接一点都觉得还行，几天后才发现原本宽松的安排已经塞满。', rhythm:['给临时插进来的事留一点空当，别提前排满。','结束一天时，划掉已经不值得继续的小事。']},
    偏强:{body:'日主偏强，决定以后你能自己推很久。别人慢一点，你就顺手多做一点；久而久之，连本来可以交给别人的部分也都留在自己手里。', rhythm:['让一起做事的人完整接手一部分，等他做完再评价。','连续投入以后留出休息，不把还能撑当成必须继续。']}
  };

  // 双盘合成句说明同一人的内在判断与外在动作怎样相接。
  const FUSION = {
    木:['动手的速度走在长远判断前面，先迈出的一步还需要回头问自己是否愿意继续。','一旦方向认定，你会把它做成稳定的日常，临时改变也因此更难进来。','你先把多种办法聊开，随后才从里面挑出值得继续长下去的一种。','你会先照顾大家的接受程度，心里却仍有自己的方向，两者不一致时容易晚一点才表态。','你愿意把想走的方向公开说出来，得到回应以后更有力量继续。','你的远处目标会被拆成眼前小步，但也要留意细节是否已经偏离了最初想做的事。','你会先为不同意见找接点，最后仍需要自己认定一个能长期接受的方向。','你认准的方向往往留得很深，外面看着谨慎，心里却已经在替后面的路做准备。','对远处的期待能让你很快起步，走下去以后还要看这条路是否真能让自己成长。','你会把长远愿望放进现实次序里，先处理最能支撑以后的一步。','你愿意换方法保住自己在意的方向，新办法也因此有明确的用处。','你会跟着现场寻找合适的入口，心里认定的方向要等做了一阵才逐渐显出来。'],
    火:['兴趣一起，你很快就会动手，先让人看见一点，再借着回应继续。','内在的热情先经过时间与资源的衡量，开头慢一点，做起来反而更能耐住重复。','你会边讲边试，把热情转成不同表达，也容易在讨论最热闹的时候忘了真正动手。','你想把东西做得有感染力，开口却会先顾及别人感受，最有热情的话未必最先说出来。','你愿意把热情放到台前，清楚的表达能带动别人，也会提高你对自己表现的要求。','热情会先落到一个具体细节上，你愿意反复调整，直到眼前的东西接近想象。','你希望让人喜欢，也愿意为此调整表达，最后要留住自己最初想说的那一句。','你对在意的东西投入很深，外在动作却相当克制，常等有把握才让别人看见。','新的见闻会很快点燃你，亲身试过带来的兴奋又会继续带动表达。','你会把兴致排进可执行的次序里，有明确进展时，热情更容易留得住。','你喜欢把熟悉的东西做出新样子，个人表达会借由方法上的变化显出来。','气氛很容易点燃你的想象，真正要完成时需要把最打动自己的画面留住。'],
    土:['外在动作比内在放心来得快，你会先做起来，再不断回头补那些担心遗漏的地方。','你心里和动作上都重视稳妥，准备充分以后能持续很久，也容易迟迟不肯试新做法。','你先问出许多可能，最后却会回到最实在的条件，一句好点子还不足以让你投入。','你会把照顾人的需要放进实际安排，事情做得周全，也容易多接本不属于自己的部分。','你愿意站出来承担，再把说过的话一项项做实，公开的姿态会成为继续投入的动力。','你会把基础拆成可检查的步骤，遗漏越来越少，也需要允许自己在准备够用时开始。','你既想让事情稳，也想让大家接受，决定容易卡在还没听到的那一个意见上。','你先把真正影响安稳的地方弄清，再用很少的动作处理最重要的一处。','你会被更远的可能吸引，真正投入以前仍要确认它怎样接上眼前生活。','你会把承担变成清楚的次序，很能维持日常，也容易把自己的安排放到最后。','你会问旧安排是否还管用，新方法只有确实让生活省事，才留得下来。','你会照着现场的感受调整小处，但一旦牵动基础安排，心里就需要更充分的理由。'],
    金:['你发现问题以后会很快出手，判断和动作连得紧，也容易不给解释留时间。','你会先把条件准备齐，再按认定的标准持续做，完成质量比开头的速度更重要。','你先从提问里找出问题，接着会迅速缩小选择，留下最经得起推敲的做法。','你的判断往往比说出口的话更直接，顾及现场感受时，会把决定重新包进商量的语气里。','你愿意为自己的标准站出来，公开表达以后，也更难轻易承认最初还没想周全。','你对问题和细节都看得很准，反复检查能提高质量，也容易把拿给人看拖得太久。','你会认真听意见，却不会轻易降低标准，真正要练习的是让别人听懂坚持的理由。','你会把力气留给最影响结果的一处，少说多做的背后通常已经有明确判断。','你愿意试陌生做法，但亲身经历以后，会很快决定哪些值得保留、哪些到此为止。','你会先找出最难的一步，再按顺序处理，明确标准让你的行动显得干脆可靠。','你敢质疑旧办法，也愿意亲手改好，新意需要经得起真正使用。','你能感到细微的不妥，随后想把它处理准确，难处常是把心里的感觉说成别人听得懂的要求。'],
    水:['你先把第一步做出来，心里却还在比较后面的走法，别人容易把尝试误读成定案。','你想得到多种办法，外在动作却会压慢一些，等自己真正放心再把时间投进去。','你会边问边把线索接起来，谈话走得很快，也需要把已经有用的一点真正做成东西。','你已经想到了办法，仍在寻找一个好开口的时机；别人看见的犹豫，有时只是你还在调整说法。','你会先把最值得试的方向说出来，后续还会吸收新线索，公开表态未必意味着想法已经停住。','你会把模糊的感觉拆成具体步骤，一边试一边改，让想法逐渐成为别人也能使用的办法。','你听得懂不同人的理由，决定却容易被下一条意见重新打开，需要给自己一点不继续征询的时间。','你会先在心里把线索连起来，确定阻力在哪里以后才出手，外面看到的动作比思考过程少得多。','你愿意从新的经历里找答案，眼前走不通就去看别处，也容易把已经能做好的事留在半路。','你会把多种设想排出先后，先走最有把握的一步，其他可能不必同时展开。','你善于把不相关的经验接到一起，再试出新的做法，真正的难处是让别人跟得上中间的几步。','你对现场变化接收得很快，想法也跟着流动，需要在感受最清楚时先留下一个具体表达。']
  };

  // 月干：具体推进。时干：制作过程。年干：取舍。相同十神也使用不同角度。
  const GOD = {
    比肩:{
      month:'比肩让你想亲自试过再采用。接触新办法时，你会先从最基本的步骤做起，弄明白它哪里管用，才愿意把手里的事交给它。',
      methods:['听到不同做法，让对方完整演示一次，再比较哪里更省力。'],
      hour:'比肩让你在制作中形成自己的手感。同一道工序做熟以后，你知道哪里该快、哪里值得多停一会儿，不喜欢别人不断插手。',
      practice:['请人帮忙时交出一件完整的小事，别一边交给他一边替他做。'],
      year:'比肩让你更愿意保留熟悉的做法。一个办法已经顺手，你会低估换新方法能省下多少力气；哪怕常要返工，也觉得自己再熟练一点就好了。',
      question:'我是在发挥长处，还是已经习惯了这件事的麻烦？',
      change:'找出最费力的一步，只替换那一步的方法，再看整件事是否轻松了。'
    },
    劫财:{
      month:'劫财让你在有人同行时动得更快。一起练习、互相展示进展，会让原本拖着的事很快开始；对方一个新尝试也能给你新的办法。',
      methods:['各自做完一遍再交流，不在每一步上互相等候。'],
      hour:'劫财让你在交流里越做越有劲。比较一旦变成较劲，你会急着赶上对方，跳过本来需要练熟的部分。',
      practice:['请对方讲一次失败的过程，比只比较最后的成果更有用。'],
      year:'劫财让你很难在熟人兴头上说扫兴的话。大家说一起试，你就跟着投入；时间花下去，才发现自己没有那么喜欢。',
      question:'离开这群人，我还愿意继续做这件事吗？',
      change:'热闹过去以后，重新按自己的兴趣分配时间。'
    },
    食神:{
      month:'食神适合从一小段完整制作进入正题。把一句话写顺、一道做法试完，手感会带着你继续往前，比开头反复设想更容易找到办法。',
      methods:['每次练习先做完一个小成品，再看哪里最值得改。'],
      hour:'食神让你在实际动手中长出细节。开头没有想过的一个转折、一种搭配，会因为做着顺手而出现，成品也因此有自己的味道。',
      practice:['作品交出去以后，听听别人最记得哪一处。'],
      year:'食神容易把喜欢的部分反复做，把麻烦的整理留到最后。你对过程已经很满足，别人却还看不到一个完整的结果。',
      question:'眼前还差哪一步，才能让别人真正看到或用到它？',
      change:'收好散落的部分，给这一次制作一个完整的结尾。'
    },
    伤官:{
      month:'伤官适合先改最妨碍使用的一处。把旧做法的不便拿出来，做一个替代版本，比一开始说服所有人接受新想法更容易推进。',
      methods:['提出异议时，把替代做法放在旁边，让人能直接比较。'],
      hour:'伤官让你敢于重做，也愿意试有个人味道的表达。新效果刚出现，你又想改另一处，最后很难分清究竟哪次改动真正有用。',
      practice:['留一份改动前的版本，做完以后放在一起看。'],
      year:'伤官不喜欢没有理由的限制。你会把力气花在争论谁说得对，却忘了自己原本只是想把事情做好。',
      question:'我现在争的这件事，会改变实际做出的东西吗？',
      change:'值得改的地方继续做，纯粹争输赢的话题就停在这里。'
    },
    偏财:{
      month:'偏财擅长把人和现成的东西用到一起。推进一件事时，你会很快想到谁懂这一块、哪里有合适材料，不必每一步都从头摸索。',
      methods:['先了解具体缺什么，再找最合适的人帮那一处忙。'],
      hour:'偏财让你擅长把不同来源的东西接起来。各部分单看都不错，放到一起却还要统一轻重、顺序和用法，这一步决定别人最后用起来顺不顺。',
      practice:['从头用一遍拼好的成果，专门检查不同部分接合的地方。'],
      year:'偏财容易高估自己能同时照顾多少机会。每个都只占一点，叠在一起却让你不断赶场，最值得投入的那一个反而分不到足够时间。',
      question:'这次答应以后，我必须减少哪件事的投入？',
      change:'看清要挪出的时间，再给对方答复。'
    },
    正财:{
      month:'正财适合从实际使用往回安排。先问清做给谁、他最困扰哪一步，你就能把精力用到最需要扎实处理的地方。',
      methods:['把经常要做的动作练熟，让后面的重复越来越省力。'],
      hour:'正财在制作中看重可靠。同一件事做第二遍，你会记得上次哪里浪费了时间，也愿意把经常出错的小地方逐个修掉。',
      practice:['把反复出错的一步单独练好，再放回整个过程。'],
      year:'正财容易舍不得已经花下去的时间。东西明明不再好用，你还想着再补一点，总觉得现在停下来就白做了。',
      question:'从今天开始，这件事还值得我继续花这些力气吗？',
      change:'把已经付出的留在过去，用接下来要花的时间作决定。'
    },
    正官:{
      month:'正官适合先听清对方期待的样子。要求听明白以后，按次序一件件处理，你会比边猜边补更稳，也更少在最后重做。',
      methods:['遇到不懂的要求，尽早问清，别靠揣测补齐。'],
      hour:'正官让你做完以后回头查一遍，尤其不愿让一个疏漏影响别人使用。你习惯从头检查，也要让第一次接触的人试试。',
      practice:['请没参与制作的人用一遍，留意他在哪一步停住。'],
      year:'正官容易把让人失望看得很重。为了维持可靠的样子，你会答应超出自己安排的事，然后独自把困难补上。',
      question:'这次答应以后，我能按自己说的做到吗？',
      change:'把做不到的部分提前说清，比到了最后独自着急更负责。'
    },
    七杀:{
      month:'七杀能在急事里迅速挑出轻重。先处理影响最大的一处，让局面不再继续恶化，剩下的事才有余地慢慢排开。',
      methods:['把最难的那一步尽早拿出来处理，给反复尝试留出余地。'],
      hour:'七杀让你敢碰难题，也能在不顺的时候继续试。压力一高，你会倾向于加快所有动作，跳过那些平时不会省掉的检查。',
      practice:['越赶时间，越把最容易出错的一步单独看一遍。'],
      year:'七杀容易把求助当作自己没扛住。明明有人可以分担，你还想再撑一会儿，直到开口时事情已经很紧。',
      question:'眼前这份困难，有哪一部分别人其实更擅长？',
      change:'把那一部分交出去，让自己的力气用在真正需要你出手的地方。'
    },
    正印:{
      month:'正印适合先学会一个完整例子，再回头补原理。遇到生疏的地方，照着可靠的方法亲手做一遍，比同时收集很多教程更容易学懂。',
      methods:['把不懂的地方写成具体问题，向懂的人请教。'],
      hour:'正印善于把做过的过程整理清楚。你记得为什么先做这一步，也能把经验留成后来能用的方法；真正熟悉以后，很适合带着新手一起做。',
      practice:['把一道熟悉的步骤讲给别人听，讲不顺的地方再亲手做一遍。'],
      year:'正印容易让准备不断延长。资料收得齐，心里会踏实一些；真正动手仍然陌生，于是又想先多看一点。',
      question:'我正在找的这份资料，能回答手里哪一个具体问题？',
      change:'找不到对应问题的内容先放下，把已经学会的用一次。'
    },
    偏印:{
      month:'偏印适合带着一个具体疑问往深处查。先把最想弄懂的事写清，遇到有趣的岔路记下位置，再回到手里的问题。',
      methods:['拿一个实际例子试新解释，看看还有哪里说不通。'],
      hour:'偏印擅长独自试出新方法。你对其中的曲折很熟，讲给别人听时却容易跳过几步，自己觉得顺理成章，对方还没跟上。',
      practice:['让第一次接触的人照着做一遍，看看哪里需要补说明。'],
      year:'偏印容易舍不得一个漂亮的解释。实际使用已经不顺，你仍想把理论修得更完整，花在说明上的力气超过了改进本身。',
      question:'这个办法放到实际使用里，究竟帮人省了什么麻烦？',
      change:'回到那一处麻烦，把办法改到真正顺手为止。'
    }
  };

  const TIME = {
    比肩:{
      title:'自己的选择，开始有了更重的分量',
      explain:'比肩大运强调自主。你会更在意一件事是否出于自己愿意，也会重新审视那些为了省事、习惯或别人的期待而接受的安排。',
      strength:{偏弱:'比肩对日主偏弱有扶助。有人与自己立场相近，你会更敢表达选择，也更能从共同经历里找回信心。',中和:'比肩遇到日主中和，自主与商量之间还有回旋。你能坚持重要的部分，也能承认别人的经验确实有用。',偏强:'比肩遇到日主偏强，会加重不愿让步的一面。别人只是提出不同意见，你也容易先听成了对自己判断的否定。'},
      amplify:['重新拾起一件自己真正喜欢、曾经搁下的事。','重要选择亲自作决定，把理由说给需要知道的人。'],
      pitfall:'比肩的难处是把独立活成了凡事亲自扛。事情越来越多，别人却无从加入，你也难以从自己的做法里退开来看。',
      action:'选一件已经做熟的事，请人用他的方式处理。关注他怎样完成，别急着教他重复自己的步骤。',
      year:'比肩流年会让同伴的选择成为比较的对象。看见别人往前走，你也会想重新决定自己要往哪里去。',
      branch:'地支主气比肩，还会让同辈之间的支持更贴近日常。',
      next:'下一步比肩大运，你会更愿意为自己的选择出面。过去借用别人的判断来省心的地方，会逐渐想亲自拿主意。',
      row:'自主意识加深，重新选择与自己相称的生活。'
    },
    劫财:{
      title:'和谁同行，会改变你的步子',
      explain:'劫财大运把同伴、竞争和共同投入放到前面。与什么人相处，会明显影响你想做什么，也会改变你对自己能力的评价。',
      strength:{偏弱:'劫财对日主偏弱有扶助。有人带着一起做，你更容易动起来；同伴走得太急时，也会跟着忽略自己的疲惫。',中和:'劫财遇到日主中和，你能从同行者身上借到劲，也有能力保留自己的步速。关键在于是否敢说出与大家不同的想法。',偏强:'劫财遇到日主偏强，竞争心会更鲜明。你愿意带头，也容易在互相较劲时不断加码，最后谁都不肯先停。'},
      amplify:['靠近能互相提醒、也容得下不同意见的人。','一起投入以前，谈清各自愿意付出的东西。'],
      pitfall:'劫财容易让你为义气省略难说的话。投入不一致时，委屈会积下来；等到忍不住才开口，小事已经变成对人的失望。',
      action:'找一次气氛平和的时候，把往来中一直没说出口的不公平讲出来，具体说是哪件事、希望怎样调整。',
      year:'劫财流年里，朋友的邀请、同伴的进展更容易打动你。一起尝试能带来活力，也会考验你能否在热闹里保留自己的节奏。',
      branch:'地支主气劫财，让共同花费和熟人之间的人情往来更值得留意。',
      next:'下一步劫财大运，同伴的影响会加深。你会从人与人的往来中看见自己的竞争心，也学着把亲近和彼此的付出说清。',
      row:'同伴与竞争带来推动，也考验投入是否平衡。'
    },
    食神:{
      title:'把日子过出自己的滋味',
      explain:'食神大运强调表达、手艺和生活的满足。你会更在意一天里有没有真正喜欢的时刻，也愿意让日常安排贴近自己的兴致。',
      strength:{偏弱:'食神会消耗日主偏弱的力气。喜欢的事情也会让你忘记疲惫，连续输出以后，需要安静下来让感受重新积累。',中和:'食神遇到日主中和，表达与休息较容易接续。做一点、消化一点，个人风格会在反复实践里慢慢清楚。',偏强:'食神给日主偏强一个向外表达的出口。原本留在心里的坚持，能通过手艺、作品或教学变成别人愿意接近的东西。'},
      amplify:['给一项喜欢的手艺留出常常接触的机会。','认真安排一件能让自己享受过程的小事。'],
      pitfall:'食神容易让舒服的习惯变成拖延。你很会把准备过得有滋味，真正需要咬牙练熟的一步却一直往后放。',
      action:'挑一处总被绕开的基本功，单独练到顺手。后面的自由发挥，会因此少很多掣肘。',
      year:'食神流年更重视分享。你会想把熟悉的东西讲给别人、做给别人看，日常兴趣也更容易找到愿意欣赏的人。',
      branch:'地支主气食神，把这种表达带回饮食、兴趣和细小的日常乐趣。',
      next:'下一步食神大运，你会更重视生活有没有自己的味道。长久积累的经验，开始需要一个可亲、可见的表达方式。',
      row:'表达与手艺生长，生活乐趣逐渐具体。'
    },
    伤官:{
      title:'让自己的声音占一个位置',
      explain:'伤官大运强调个人表达。你会逐渐不满足于把事情照样办妥，更想留下自己的说法、审美和选择，让人知道你怎样看待眼前的生活。',
      strength:{偏弱:'伤官大运中，日主偏弱，频繁表达和争论更容易消耗精力。话越说越多，真正想做的改变反而被挤到后面。',中和:'日主中和，进入伤官大运后，你有心力指出问题，也有余力动手修正。把不满意说具体，改进会更容易接着发生。',偏强:'日主偏强，走到伤官大运时，你更愿意把自己的判断讲出来。你敢推翻旧做法，但说话太快、太满时，别人容易先忙着防备。'},
      amplify:['认真写下一个和周围人不同的判断，说清自己的经历与理由。','接触一种愿意反复练习的表达方式。'],
      pitfall:'伤官容易让与众不同也变成一种负担。大家喜欢的东西，你反而不好意思承认自己也喜欢，总想再找一句更特别的话。',
      action:'讲一段只有你亲自经历过的事，保留当时的细节和自己的感受。个人声音会从这些经历里长出来，不必每句话都刻意惊人。',
      year:'伤官流年让你的话更有锋芒。以前一笑带过的不满，今年更想说出来；适合把积累的想法讲透，也要听见别人真正回应了什么。',
      branch:'地支主气伤官，使这种不满更多落在反复发生的小事上。',
      next:'下一步伤官大运，个人表达会更鲜明。你会逐渐不满足于照着已有说法生活，想拿出自己认可的解释与做法。',
      row:'个人表达增强，旧规则开始接受重新审视。'
    },
    偏财:{
      title:'见到更大的世界，也认清自己的兴趣',
      explain:'偏财大运强调人与机会的流动。陌生领域更能吸引你，你会从不同人的经历里看见新的用途，也更愿意把手里的东西拿出去交换、合作。',
      strength:{偏弱:'偏财会加重日主偏弱的奔忙。认识的人、答应的事一多，你容易把时间分得太碎，连原本喜欢的生活都顾不上。',中和:'偏财遇到日主中和，你能在新机会里灵活转身。判断新鲜事物时，亲自试过的感受比周围的热度更重要。',偏强:'偏财让日主偏强更愿意把能力用到外面。你敢调动人和资源，也要看见别人有自己的意愿与步速。'},
      amplify:['接触一个熟悉圈子之外的领域，了解它怎样运作。','重新利用一项闲置的经验、技能或物品。'],
      pitfall:'偏财容易把认识得多当成了解得深。人刚聊得投缘，你就替后面许多事想好了，真正一起做才发现彼此期待不同。',
      action:'把最吸引你的一个机会了解透，问清实际每天要做什么，再判断自己是否仍然喜欢。',
      year:'偏财流年让邀约与新用途更显眼。闲置的技能、过去认识的人，都容易重新进入你的视线，带来一次新的尝试。',
      branch:'地支主气偏财，常把机会带进熟人的介绍、一次临时邀约，或闲置物品的新用法里。',
      next:'下一步偏财大运，你的注意力会更多投向外部世界。新的圈子会让你接触不同的人，已有的本领也会找到新的用处。',
      row:'向外接触新机会，学会看懂人与资源。'
    },
    正财:{
      title:'看得见的积累，让你逐渐踏实',
      explain:'正财大运强调日常经营与积累。你会更在意付出的时间最后留下什么，也会认真考虑怎样把喜欢的生活维持下去。',
      strength:{偏弱:'正财会增加日主偏弱的操心。每件事都想照顾周全，容易把休息挤掉，踏实感反而变成了总怕还有遗漏。',中和:'正财遇到日主中和，投入与所得更容易被你看清。你愿意慢慢来，也能及时调整那些一直耗力、少有回报的安排。',偏强:'正财让日主偏强的力气有了具体去处。持续经营能带来满足，但替所有人兜底，会让别人的依赖越来越重。'},
      amplify:['整理一项长期反复支出的时间或费用，看它是否仍值得。','维护已经拥有、却因忙碌疏于照顾的东西。'],
      pitfall:'正财容易让你只看见还有多少没做。明明已经积累了不少，一坐下来休息，心里又开始算今天是不是不够勤快。',
      action:'完整享用一次自己已经积累出的成果。留出不急着处理下一件事的时间，感受这些努力究竟为了什么。',
      year:'正财流年把注意力带回日常收支与使用。你会更关心东西是否耐用、投入是否值得，也更愿意把一项生活习惯慢慢整理好。',
      branch:'地支主气正财，让细小但持续的投入更影响你的踏实感。',
      next:'下一步正财大运，你会更看重能长期维持的生活。许多决定会从有没有意思，逐渐转向值不值得一直花时间。',
      row:'日常经营加深，积累与生活安排成为重点。'
    },
    正官:{
      title:'你开始更在意，别人怎样信任你',
      explain:'正官大运强调秩序、名分与承诺。你会更在意自己在别人心中究竟是怎样的人；一句答应过的话，会比从前更长久地留在心里。',
      strength:{偏弱:'日主偏弱，进入正官大运后，适应新要求会更费力。规矩还没熟悉，你就想每一步都做对，常要反复确认别人究竟期待什么，原本简单的事也变得紧张。',中和:'日主中和，进入正官大运后，你能认真对待要求，也能保留自己的分寸。稳定的做事习惯，会让可靠不再全靠临时用力。',偏强:'日主偏强，正官大运为你的坚持加上了规矩。你仍有主见，也开始看见一群人遵守同一套规矩，能怎样把事情做好。'},
      amplify:['认真对待一个自己愿意长期拥有的身份。','把说过却一直拖着的小承诺兑现。'],
      pitfall:'正官容易让外界的评价变成心里的评分。别人一句不满意，你就反复回想自己哪里做得不够，已经做好的部分却很快被忘掉。',
      action:'事情出错时，把“哪一步没做好”和“我这个人怎样”分开说。改好那一步，让这次经历结束在改进上。',
      year:'正官流年里，答应的事和公开的身份会更受重视。一次正式表达、一个被认真托付的安排，都容易让你开始重新要求自己。',
      branch:'地支主气正官，把这种要求放进相处规则和日常承诺里。',
      next:'下一步正官大运，你会更愿意在一个身份里扎下去。被别人信任会变得重要，如何兑现承诺也会成为对自己的要求。',
      row:'身份与承诺加重，学习承担也学习自我评价。'
    },
    七杀:{
      title:'压力逼近时，学会挑最重要的事',
      explain:'七杀大运强调挑战与应对。你会更常关注自己能否站住、能否处理难题，遇到要求明确的事，也会更快看见自己的胆量与短处。',
      strength:{偏弱:'七杀对日主偏弱的压力更直接。你会把别人的急迫先接到自己身上，长时间处在随时要回应的状态里，难以真正松下来。',中和:'七杀遇到日主中和，压力能帮你挑出轻重。事情紧的时候，你更容易看清哪些本事值得练，哪些担心可以先放下。',偏强:'七杀遇到日主偏强，竞争会激起斗志。你敢接难题，但也容易为了证明能做到，把本来可以从容处理的事做成硬碰硬。'},
      amplify:['练一项遇到难事时能真正派上用场的本领。','认识自己受压时的第一反应，及时向可靠的人求助。'],
      pitfall:'七杀容易让你习惯紧绷。没有人催时反而不安心，总想再找一件难事证明自己还能扛，生活里很难有真正结束的一刻。',
      action:'在一件难事处理完以后，留出一段不用证明什么的时间。让身体和情绪都知道，这一次已经过去了。',
      year:'七杀流年让竞争、紧迫感和难题更容易进入视线。你会想尽快作出反应，今年也更能看清自己在压力下依赖哪些习惯。',
      branch:'地支主气七杀，使催促与紧张更容易藏在日常的小反应里。',
      next:'下一步七杀大运，你会更认真地面对挑战。过去可以绕开的难处会开始值得正视，处理压力的方式也需要随经验一起长大。',
      row:'挑战与竞争突出，练习应对压力的本领。'
    },
    正印:{
      title:'把过去的经历，慢慢理解明白',
      explain:'正印大运强调学习、理解与支持。你会更愿意寻找可靠的知识，也会重新认识一路帮助过自己的人，以及过去经历留下的影响。',
      strength:{偏弱:'正印对日主偏弱有生扶。稳定的陪伴、清楚的方法会让你慢慢安心，也帮助你从一味应付外界转回照顾自己。',中和:'正印遇到日主中和，你能把新知识接到已有经验里。理解越来越深，也需要给亲自尝试留位置，才能知道哪些真正适合自己。',偏强:'正印遇到日主偏强，会加重对熟悉解释的依赖。一个道理已经足够自洽，你就容易少听那些让自己不舒服的新事实。'},
      amplify:['系统学懂一件长期好奇的事。','回看一段旧经历，把当时没想明白的部分重新说清。'],
      pitfall:'正印容易让安全感停在被理解、被照顾里。遇到陌生的决定，你会想再等一个肯定，自己的想法一直没走到前面。',
      action:'选一件可以自己作主的小事，听完建议以后亲自决定。让支持成为起点，继续积累自己的经验。',
      year:'正印流年会增加你对学习与安定的重视。一位愿意指点的人、一本恰好读懂的书，都容易让积压的问题找到新的解释。',
      branch:'地支主气正印，让居处、家人和熟悉的生活更能影响安心程度。',
      next:'下一步正印大运，你会更想安静地理解自己。知识、师长和熟悉的支持，会帮助你把散落的经验连成完整的认识。',
      row:'学习与支持成为滋养，旧经验得到重新理解。'
    },
    偏印:{
      title:'留一点安静，把真正好奇的事钻深',
      explain:'偏印大运强调独立思考与专门兴趣。你会更愿意离开热闹的答案，研究少有人耐心解释的问题，也会重新认识自己与多数人的不同。',
      strength:{偏弱:'偏印对日主偏弱有生扶。独处和研究能让你恢复精神，但长时间只在脑子里活动，也容易忘记身体需要吃饭、睡觉和走动。',中和:'偏印遇到日主中和，你能在独自钻研与外界交流之间转换。一个新解释经过实际接触，会逐渐长成真正的见识。',偏强:'偏印遇到日主偏强，会让自己的解释更难被动摇。你越想得深，越容易把不同意见当成对方还没理解，交流也就慢慢变少。'},
      amplify:['给一个真正好奇的问题留出安静研究的时间。','接触一种不同于熟悉圈子的知识或表达。'],
      pitfall:'偏印容易把想得深变成越想越远。解释越来越复杂，原本只是想弄明白的一件小事，反而难以说给别人听。',
      action:'用日常语言讲清最近学懂的一件事。讲给一个愿意认真听的人，看看哪些部分还需要回到实际经验里补足。',
      year:'偏印流年会让冷门知识与独处更有吸引力。你会想重新解释一些熟悉的事，也更容易注意到大众说法没有回答的细节。',
      branch:'地支主气偏印，让这种思考在安静、独处的日常里持续展开。',
      next:'下一步偏印大运，注意力会从广泛接触转向深入研究。那些反复勾起好奇的问题，会比热闹的新话题更值得你长久停留。',
      row:'专门兴趣加深，独立思考需要与实际经验相接。'
    }
  };

  function text(value) { return String(value == null ? '' : value).trim(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function unique(values) { return values.filter(function (value, i) { return value && values.indexOf(value) === i; }); }
  function strengthLabel(chart) { return text(chart && chart.fiveElements && chart.fiveElements.dayMasterStrength && chart.fiveElements.dayMasterStrength.label); }
  function pillarText(pillar) { return pillar && pillar.stem && pillar.branch ? pillar.stem + pillar.branch : ''; }
  function godAt(chart, position) { return text(chart && chart.tenGods && chart.tenGods[position] && chart.tenGods[position].stem); }

  // 保留旧诊断 API；实际文案不再按分钟命中特稿。
  function isExactSampleV2(chart) {
    const input = chart && chart.input || {};
    const pillars = chart && chart.pillars || {};
    return input.y === 1992 && input.m === 6 && input.d === 15 && input.hh === 8 && input.mm === 30
      && text(input.city || input.c).replace(/市$/, '') === '贵阳' && text(input.gender || input.g) === '男'
      && pillarText(pillars.year) === '壬申' && pillarText(pillars.month) === '丙午'
      && pillarText(pillars.day) === '壬戌' && pillarText(pillars.hour) === '甲辰';
  }

  function buildAction(chart) {
    const stem = text(chart && chart.dayMaster && chart.dayMaster.stem), day = DAY[stem];
    const asc = text(chart && chart.astro && chart.astro.asc && chart.astro.asc.sign), outward = ASC[asc];
    const strength = strengthLabel(chart), force = FORCE[strength] || {body:'日主强弱资料待补充。', rhythm:[]};
    const month = godAt(chart, 'month'), hour = godAt(chart, 'hour'), year = godAt(chart, 'year');
    const motive = GOD[month], craft = GOD[hour], choice = GOD[year];
    return {
      title:day ? day.title : '行动解读',
      total:[day ? day.opening : '日主资料待补充。', outward ? outward.opening : '上升位置未计算，补充出生时间后可查看开场方式。', day && outward ? '双盘合成看，' + FUSION[ELEMENT[stem]][SIGNS.indexOf(asc)] : ''].filter(Boolean),
      basis:force.body,
      strategy:{title:'怎样开始更顺手', body:motive ? '月干' + motive.month : '月干十神资料待补充。', itemsLead:'试试这样做：', items:motive ? clone(motive.methods) : []},
      experiment:{title:'怎样把东西做出来', body:craft ? '时干' + craft.hour : '时干十神未计算，补充出生时间后可查看制作习惯。', itemsLead:'动手时：', items:craft ? clone(craft.practice) : [], close:''},
      tradeoff:{title:'作决定时容易卡在哪里', ruleLead:'', rule:choice ? '年干' + choice.year : '年干十神资料待补充。', questionsLead:'问自己：', questions:choice ? [choice.question] : [], close:choice ? choice.change : ''},
      rhythm:clone(force.rhythm),
      close:outward ? outward.close : '',
      source:['日主·' + (day ? stem + ELEMENT[stem] : '待补充'), '强弱·' + (strength || '待核对'), month ? '月干·' + month : '', hour ? '时干·' + hour : '', year ? '年干·' + year : '', '上升·' + (outward ? asc : '待核对')].filter(Boolean).join('｜')
    };
  }

  function sexagenaryYear(year) {
    const stem = STEMS[((year - 4) % 10 + 10) % 10], branch = BRANCHES[((year - 4) % 12 + 12) % 12];
    return {stem:stem, branch:branch, text:stem + branch};
  }

  function referenceClock(options) {
    // 只传 referenceYear 表示查看该干支年度；referenceDate/default 表示具体时点。
    if (options.referenceDate == null && options.referenceYear != null && Number.isInteger(Number(options.referenceYear))) {
      return {year:Number(options.referenceYear), ms:null};
    }
    let supplied = options.referenceDate;
    if (typeof supplied === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(supplied)) supplied += 'T12:00:00+08:00';
    else if (typeof supplied === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(supplied)) supplied += '+08:00';
    const ms = supplied == null ? Date.now() : new Date(supplied).getTime();
    if (!Number.isFinite(ms)) throw new RangeError('referenceDate 必须是有效日期或时间');
    return {year:new Date(ms + 8 * 3600000).getUTCFullYear(), ms:ms};
  }

  function annualFacts(dayStem, clock, options) {
    const engine = getEngine(), supplied = options.annualPillar;
    let pillar = null;
    if (typeof supplied === 'string' && STEMS.includes(supplied.charAt(0)) && BRANCHES.includes(supplied.charAt(1))) {
      pillar = {stem:supplied.charAt(0), branch:supplied.charAt(1), text:supplied.slice(0, 2)};
    } else if (supplied && STEMS.includes(supplied.stem) && BRANCHES.includes(supplied.branch)) {
      pillar = {stem:supplied.stem, branch:supplied.branch, text:supplied.stem + supplied.branch};
    } else if (clock.ms == null) {
      pillar = sexagenaryYear(clock.year);
    } else if (engine && typeof engine.jieTime === 'function') {
      const liChun = engine.jieTime(clock.year, engine.JIE[0]);
      pillar = sexagenaryYear(clock.ms < liChun ? clock.year - 1 : clock.year);
    }
    const canReadGods = pillar && engine && STEMS.includes(dayStem);
    const gods = canReadGods ? unique([engine.tenGod(dayStem, pillar.stem)].concat((engine.HIDDEN[pillar.branch] || []).map(function (stem) { return engine.tenGod(dayStem, stem); }))) : [];
    const suppliedGods = Array.isArray(options.annualGods) ? options.annualGods.filter(function (god) { return !!TIME[god]; }) : null;
    return {pillar:pillar, gods:unique(suppliedGods || gods), main:canReadGods ? engine.tenGod(dayStem, pillar.stem) : suppliedGods && suppliedGods[0], branch:canReadGods ? engine.tenGod(dayStem, (engine.HIDDEN[pillar.branch] || [])[0]) : ''};
  }

  function normalizeSteps(chart, options) {
    const raw = Array.isArray(options.steps) ? options.steps : chart && chart.daYun && Array.isArray(chart.daYun.steps) ? chart.daYun.steps : [];
    return raw.map(function (step) {
      return {stem:text(step.stem), branch:text(step.branch), god:text(step.god), yearFrom:step.yearFrom == null ? NaN : Number(step.yearFrom), yearTo:step.yearTo == null ? NaN : Number(step.yearTo)};
    }).filter(function (step) { return step.stem && step.branch && Number.isFinite(step.yearFrom) && Number.isFinite(step.yearTo); });
  }
  function rangeText(step) { return step.yearFrom + '—' + step.yearTo; }
  function stepTitle(step) { return rangeText(step) + ' ' + step.stem + step.branch + '·' + step.god; }
  function startText(chart) {
    const daYun = chart && chart.daYun || {};
    const raw = text(daYun.startText).replace(/起运$/, '');
    const direction = daYun.forward === false ? '逆排' : daYun.forward === true ? '顺排' : '';
    return raw ? raw + (direction ? '，' + direction : '') : '起运资料待补充';
  }

  function buildTime(chart, options) {
    options = options || {};
    const clock = referenceClock(options), steps = normalizeSteps(chart, options);
    const currentIndex = steps.findIndex(function (step) { return clock.year >= step.yearFrom && clock.year <= step.yearTo; });
    const current = currentIndex >= 0 ? steps[currentIndex] : null;
    const next = current ? steps[currentIndex + 1] : steps.find(function (step) { return step.yearFrom > clock.year; });
    const copy = current && TIME[current.god], nextCopy = next && TIME[next.god];
    const stem = text(chart && chart.dayMaster && chart.dayMaster.stem), day = DAY[stem];
    const strength = strengthLabel(chart), annual = annualFacts(stem, clock, options);
    const annualCopy = TIME[annual.main], branchCopy = TIME[annual.branch];
    const yearText = annual.pillar ? clock.year + ' ' + annual.pillar.text + (annual.gods.length ? '对应' + annual.gods.join('、') : '') + '。' : clock.year + ' 年度资料待计算。';
    const yearBody = yearText + (annualCopy ? annualCopy.year : '') + (branchCopy && annual.branch !== annual.main ? branchCopy.branch : '');
    return {
      title:copy ? copy.title : '大运资料待补充',
      stageLead:'当前大运｜',
      stage:current ? stepTitle(current) : clock.year + '｜未落入已计算的大运范围',
      explanation:copy ? [copy.explain, day ? day.phase : '', copy.strength[strength] || ''].filter(Boolean) : ['补充出生时间与性别后，可查看起运和大运解读。'],
      amplify:copy ? clone(copy.amplify) : [],
      pitfall:copy ? copy.pitfall : '',
      action:copy ? copy.action : '',
      yearTitle:clock.year + ' 年落点',
      year:yearBody,
      startLead:'起运：',
      start:startText(chart),
      timelineTitle:'完整时间轴',
      rows:steps.map(function (step) { return [rangeText(step), step.stem + step.branch, step.god, TIME[step.god] ? TIME[step.god].row : '']; }),
      nextLead:'下一阶段｜',
      nextTitle:next ? stepTitle(next) : '已计算时间轴至此结束',
      next:nextCopy ? nextCopy.next : '',
      source:['起运·' + startText(chart), '日主·' + (day ? stem + ELEMENT[stem] : '待补充'), '强弱·' + (strength || '待核对'), '当前大运·' + (current ? current.stem + current.branch + ' ' + rangeText(current) + '·' + current.god : '待核对'), clock.year + ' 流年·' + (annual.pillar ? annual.pillar.text + '·' + annual.gods.join('、') : '待计算'), '下一大运·' + (next ? next.stem + next.branch + ' ' + rangeText(next) + '·' + next.god : '未列出')].join('｜')
    };
  }

  return Object.freeze({
    SCHEMA_VERSION:'action-time-v1', COPY_SYSTEM_VERSION:'copy-reviewed-2026-09-07',
    STEMS:STEMS.slice(), SIGNS:SIGNS.slice(),
    buildAction:buildAction, buildTime:buildTime,
    buildActionTime:function (chart, options) { return {action:buildAction(chart, options), time:buildTime(chart, options)}; },
    isExactSampleV2:isExactSampleV2
  });
});
