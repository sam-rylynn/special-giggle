/* An included pair uses confirmed self data, never a partner's private report. */
(function(root){
  'use strict';
  const ACCESS_MODEL='included-pair-v1',CONSENT_VERSION='synastry-included-pair-consent-20261013-v1';
  const OPAQUE=/^[a-f0-9]{64}$/;
  const error=code=>Object.assign(new Error(code),{code});
  function input(value){
    if(!value||typeof value!=='object'||Array.isArray(value)||typeof value.d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value.d)||typeof value.c!=='string'||!value.c.trim()||value.c.length>60||/[<>\u0000-\u001f\u007f-\u009f]/u.test(value.c))throw error('PARTICIPANT_INPUT_INVALID');
    const [y,m,d]=value.d.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));
    if(y<1940||y>2100||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw error('PARTICIPANT_INPUT_INVALID');
    const t=value.t||null,g=value.g||null;
    if(t!==null&&(typeof t!=='string'||! /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t))||!['男','女',null].includes(g))throw error('PARTICIPANT_INPUT_INVALID');
    const city=value.c.normalize('NFKC').trim(),resolver=root.BaziEngine?.resolveCity;
    let c=city;if(typeof resolver==='function'){const hit=resolver(city);if(!hit||hit.complete!==true||!['city','district'].includes(hit.src))throw error('PARTICIPANT_INPUT_INVALID');c=hit.key;}
    return {d:value.d,t,c,g};
  }
  function adultBirthDate(asOf){
    const today=asOf||root.ZxMinimumAge?.currentDate?.();
    return typeof today==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(today)?String(Number(today.slice(0,4))-18)+today.slice(4):'';
  }
  function isAdult(value,asOf){const cutoff=adultBirthDate(asOf);try{return !!cutoff&&input(value).d<=cutoff;}catch(_){return false;}}
  function equalInput(a,b){try{return JSON.stringify(input(a))===JSON.stringify(input(b));}catch(_){return false;}}
  function safeName(value,fallback='知星用户'){
    const text=String(value||'').normalize('NFC').trim();
    return text&&Array.from(text).length<=80&&!/[<>{}\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(text)?text:fallback;
  }
  function participant(result){
    const p=result?.participant;
    if(!p||!OPAQUE.test(p.id||'')||!OPAQUE.test(p.revision||'')||p.status!=='confirmed'||p.consentVersion!==CONSENT_VERSION)throw error('PARTICIPANT_RECONFIRM_REQUIRED');
    return {...p,input:input(p.input),name:safeName(p.name)};
  }
  const helpers={ACCESS_MODEL,CONSENT_VERSION,input,equalInput,isAdult,safeName,participant,isIncluded:value=>value?.accessModel===ACCESS_MODEL};
  if(typeof module==='object'&&module.exports)module.exports=helpers;
  if(typeof document==='undefined')return;
  const node=(tag,text,cls)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=String(text??'');if(cls)element.className=cls;return element;};
  function rules(parent,{expiresAt,owner=false}={}){
    const summary=node('p',owner?'这份已交付报告包含1个固定配对名额。对方无需购买报告，仍须本人登录并确认资料。':'你无需购买个人报告。本人确认资料并同意后，双方可以阅读这份共同解读。','social-note');
    const detail=node('details',undefined,'social-note');detail.append(node('summary','共享内容、保存与撤回说明'));
    detail.append(node('p','知星后台保存你本人确认的出生资料并由程序排盘，用于生成心动、亲密、冲突、长久四章共同解读。双方显示称呼仅用于呈现，不参与计算。对方只看到共同解读及你的显示称呼，看不到你的出生详情、个人报告或私人问星。'));
    detail.append(node('p','共同阅读随付款方报告到期停止；退款处理中、资料更正或任一方撤回时停止访问。名额绑定这个固定配对，解除或撤回不返还名额；另一方不会因此获得个人报告或问星权益。'));
    detail.append(node('p','你可以在“我的资料 · 本人合盘资料”查看自己确认的资料并撤回。撤回会清除这份合盘出生资料并停止当前共同阅读。本人确认的出生资料以加密形式保留至你主动撤回或注销账号；共同解读内容随付款方报告到期清理。'));
    if(Number.isSafeInteger(expiresAt)&&expiresAt>0)detail.append(node('p','本次共同阅读最长至 '+new Date(expiresAt).toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})+'。'));
    parent.append(summary,detail);return detail;
  }
  async function form(options){
    const {parent,call,guard}=options;guard();
    const result=await call('/synastry/participants/self');guard();
    let previous=null;try{if(result?.participant?.status==='confirmed')previous=participant(result);}catch(_){}
    const initial=options.input?input(options.input):previous?.input||null,locked=!!options.input;
    const wrap=node('div',undefined,'social-form sponsored-participant-form');
    const title=node('h3',locked?'确认这份报告是你本人的资料':'确认你本人的出生资料','social-heading');wrap.append(title);
    if(locked)wrap.append(node('p','资料来自你选定的已交付报告。若不是你本人的资料，请返回选择自己的报告。','social-note'));
    else wrap.append(node('p','请由你本人填写，出生地点只需省市区县，不需详细地址。不知道出生时刻可以明确选择未知。','social-note'));
    const field=(label,type,value)=>{const outer=node('label',label,'social-field'),control=node('input');control.type=type;control.value=value||'';outer.append(control);wrap.append(outer);return control;};
    const date=field('出生日期','date',initial?.d);date.required=true;
    date.max=adultBirthDate();date.min='1940-01-01';
    const time=field('出生时刻','time',initial?.t);time.step='60';
    const missingLabel=node('label',undefined,'social-check'),missing=node('input');missing.type='checkbox';missing.checked=initial?.t===null;missingLabel.append(missing,node('span','出生时刻未知，使用已知资料并显示精度提示'));wrap.append(missingLabel);
    const city=field('出生地点','text',initial?.c);city.maxLength=60;city.required=true;city.autocomplete='off';if(!locked)city.setAttribute('data-birth-location','');
    const genderLabel=node('label','排盘性别（可不提供）','social-field'),gender=node('select');gender.setAttribute('aria-label','排盘性别');
    for(const [value,text]of [['','不提供'],['男','男'],['女','女']]){const option=node('option',text);option.value=value;gender.append(option);}gender.value=initial?.g||'';genderLabel.append(gender);wrap.append(genderLabel);
    if(previous)wrap.append(node('p','已确认称呼：'+previous.name+'。称呼仅用于显示，资料仍请你本人核对。','social-note'));
    const correctionLabel=node('label',undefined,'social-check'),correction=node('input');correction.type='checkbox';correctionLabel.append(correction,node('span','我知悉本次资料与之前确认不同，更正会停止原共同阅读，已使用的固定配对名额不返还。'));correctionLabel.hidden=true;wrap.append(correctionLabel);
    const selfLabel=node('label',undefined,'social-check'),self=node('input');self.type='checkbox';selfLabel.append(self,node('span','我已满18周岁，以上是我本人的出生资料，已核对并确认。'));wrap.append(selfLabel);
    const consentLabel=node('label',undefined,'social-check'),consent=node('input');consent.type='checkbox';consentLabel.append(consent,node('span','我已阅读共享内容、保存与撤回说明，同意保存本人合盘资料并参与本次共同解读。'));wrap.append(consentLabel);
    parent.append(wrap);if(!locked)root.ZxBirthLocationPicker?.attachAll?.(wrap);
    let submitted=null,disabled=false;const changes=[];
    const read=()=>{if(!missing.checked&&!time.value)throw error('PARTICIPANT_INPUT_INVALID');return input({d:date.value,t:missing.checked?null:time.value,c:city.value,g:gender.value});};
    function change(){submitted=null;self.checked=false;consent.checked=false;correction.checked=false;update();changes.forEach(fn=>fn());}
    function update(){time.disabled=disabled||locked||missing.checked;date.readOnly=locked;city.readOnly=locked;gender.disabled=disabled||locked;missing.disabled=disabled||locked;date.disabled=disabled;city.disabled=disabled;
      let changed=false;try{changed=!!previous&&!equalInput(read(),previous.input);}catch(_){}correctionLabel.hidden=!changed;
    }
    for(const control of [date,time,city,gender,missing])control.addEventListener('change',change);
    for(const control of [date,time,city])control.addEventListener('input',change);
    for(const control of [self,consent,correction])control.addEventListener('change',()=>{submitted=null;changes.forEach(fn=>fn());});
    update();
    return {
      change:fn=>changes.push(fn),
      disable(value){disabled=!!value;self.disabled=disabled;consent.disabled=disabled;correction.disabled=disabled;update();},
      async confirm(){
        guard();const value=read();
        if(!isAdult(value))throw error('PARTICIPANT_INELIGIBLE');
        if(!self.checked)throw error('SELF_CONFIRMATION_REQUIRED');
        if(!consent.checked)throw error('CONSENT_REQUIRED');
        if(previous&&!equalInput(value,previous.input)&&!correction.checked)throw error('PARTICIPANT_CORRECTION_CONFIRMATION_REQUIRED');
        if(submitted&&equalInput(submitted.input,value))return {participantId:submitted.id,participantRevision:submitted.revision,consent:{confirmed:true,version:CONSENT_VERSION},accessModel:ACCESS_MODEL};
        const saved=participant(await call('/synastry/participants',{input:value,selfConfirmed:true,consent:{confirmed:true,version:CONSENT_VERSION}}));guard();
        if(!equalInput(saved.input,value))throw error('PARTICIPANT_RECONFIRM_REQUIRED');
        previous=saved;submitted=saved;correctionLabel.hidden=true;
        return {participantId:saved.id,participantRevision:saved.revision,consent:{confirmed:true,version:CONSENT_VERSION},accessModel:ACCESS_MODEL};
      }
    };
  }
  root.ZxSponsoredPair=Object.freeze({...helpers,rules,form});
})(typeof window==='object'?window:globalThis);
