/* Cultural relationship facts and an explicitly experimental type ordering. No compatibility probability. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SynastryEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='synastry-facts-20260910-v1',RANK_VERSION='synastry-type-order-candidate-v1';
  const STEMS=['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'], ELEMENTS=['木','火','土','金','水'];
  const SIGNS=['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼'];
  const COMBINE=['甲己','乙庚','丙辛','丁壬','戊癸'],BRANCH_COMBINE=['子丑','寅亥','卯戌','辰酉','巳申','午未'],BRANCH_OPPOSE=['子午','丑未','寅申','卯酉','辰戌','巳亥'];
  const paired=(table,a,b)=>table.some(pair=>pair===a+b||pair===b+a);
  const element=stem=>ELEMENTS[Math.floor(STEMS.indexOf(stem)/2)];
  function relation(a,b){const x=ELEMENTS.indexOf(a),y=ELEMENTS.indexOf(b);if(x<0||y<0)throw new Error('INVALID_ELEMENT');return ['同气','我生','我克','克我','生我'][(y-x+5)%5];}
  function angle(a,b){if(!Number.isFinite(a)||!Number.isFinite(b))throw new Error('INVALID_LONGITUDE');const d=((a-b)%360+360)%360;return Math.min(d,360-d);}
  function assertChart(c){if(!c||!c.pillars?.day||!STEMS.includes(c.dayMaster?.stem)||element(c.dayMaster.stem)!==c.dayMaster.element)throw new Error('INVALID_CHART');}
  function facts(participants){
    if(!Array.isArray(participants)||participants.length!==2||participants.some(p=>!p||typeof p.id!=='string'||!p.id)||participants[0].id===participants[1].id)throw new Error('INVALID_PARTICIPANTS');
    const ordered=participants.slice().sort((a,b)=>a.id.localeCompare(b.id));ordered.forEach(p=>assertChart(p.chart));
    const [a,b]=ordered,ca=a.chart,cb=b.chart,items=[];
    const add=(id,system,kind,value,label)=>items.push({id,system,kind,participants:[a.id,b.id],value,label});
    add('day-elements','八字','elements',{[a.id]:ca.dayMaster.element,[b.id]:cb.dayMaster.element,forward:relation(ca.dayMaster.element,cb.dayMaster.element),reverse:relation(cb.dayMaster.element,ca.dayMaster.element)},'日主五行关系');
    add('day-stems','八字','stems',{[a.id]:ca.dayMaster.stem,[b.id]:cb.dayMaster.stem,combine:paired(COMBINE,ca.dayMaster.stem,cb.dayMaster.stem)},'日干五合');
    const ba=ca.pillars.day.branch,bb=cb.pillars.day.branch;
    add('day-branches','八字','branches',{[a.id]:ba,[b.id]:bb,combine:paired(BRANCH_COMBINE,ba,bb),oppose:paired(BRANCH_OPPOSE,ba,bb),same:ba===bb},'日支六合与相冲');
    for(const lum of ['sun','moon','asc']){
      const x=ca.astro?.[lum],y=cb.astro?.[lum];
      // Approximate or near-edge Moon and missing ascendant cannot provide precise corroboration.
      if(!x||!y||x.approx||y.approx||x.nearEdge||y.nearEdge)continue;
      if(Number.isFinite(x.lon)&&Number.isFinite(y.lon))add('astro-'+lum,'星盘','angular-separation',{degrees:Math.round(angle(x.lon,y.lon)*100)/100},({sun:'太阳',moon:'月亮',asc:'上升'})[lum]+'黄经最小夹角');
    }
    return {version:VERSION,participants:ordered.map(p=>p.id),items,limits:['五合只记组合，不判合化；六合与相冲不等于关系结局。','当前只覆盖日主、日干、日支及同类光体夹角，不代表完整传统合盘。','星盘夹角仅为位置辅证，不据此计算关系成功率。'],warnings:ordered.flatMap(p=>(p.chart.meta?.warnings||[]).map(w=>({participant:p.id,message:w})))};
  }
  function rank(chart){
    assertChart(chart);const sun=chart.astro?.sun;
    if(!sun||!Number.isFinite(sun.lon))throw new Error('SUN_REQUIRED');
    const ownSign=Math.floor(((sun.lon%360+360)%360)/30),rows=[];
    for(let s=0;s<STEMS.length;s++)for(let z=0;z<12;z++){
      const stem=STEMS[s],rel=relation(chart.dayMaster.element,element(stem));
      // Product exploration heuristic, not a classical claim of better partners. Bazi is primary (0..6), solar corroboration 0..1.
      const primary=({同气:2,我生:4,生我:4,我克:1,克我:1})[rel]+(paired(COMBINE,chart.dayMaster.stem,stem)?2:0);
      const secondary=z%4===ownSign%4?1:0;
      rows.push({id:'type-'+s+'-'+z,stem:stem+element(stem),sun:SIGNS[z],score:primary+secondary,primary,secondary,relation:rel,
        sources:['日主五行·'+rel,...(paired(COMBINE,chart.dayMaster.stem,stem)?['日干五合']:[]),'太阳星座元素·'+(secondary?'同类':'不同类')],
        headline:rel==='同气'?'从相似的表达方式，开始了解彼此':rel==='我生'||rel==='生我'?'从付出与回应，看看彼此的节奏':'从不同的做法，看看如何商量',
        ease:['日主'+chart.dayMaster.stem+chart.dayMaster.element+'与'+stem+element(stem)+'，在传统五行框架中记为“'+rel+'”。','这是相处话题的探索顺序，适合用具体经历核对，不能当作他人的性格结论。'],
        friction:'先问对方需要什么，再确认自己能做到什么；类型不能替代相处中的真实回应。'});
    }
    rows.sort((a,b)=>b.score-a.score||b.primary-a.primary||a.id.localeCompare(b.id,'en',{numeric:true}));
    // Keep five distinct day-master and solar types for exploration diversity.
    const seen=new Set(),suns=new Set(),top=rows.filter(row=>{if(seen.has(row.stem)||suns.has(row.sun))return false;seen.add(row.stem);suns.add(row.sun);return true;}).slice(0,5);
    return {version:RANK_VERSION,space:120,tieBreak:'总序值、八字序值降序；天干与黄道顺序升序；依次保留日主与太阳星座均不同的五种类型',rules:'候选：同气 2、相生 4、相克 1；日干五合加 2；太阳星座同元素加 1。序值只用于探索排序，不是匹配分数。',rows:top};
  }
  return Object.freeze({VERSION,RANK_VERSION,STEMS,SIGNS,element,relation,angle,facts,rank});
});
