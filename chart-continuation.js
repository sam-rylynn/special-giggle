/* Explicit, temporary handoff between this browser and WeChat. No birth data enters a URL. */
(function(root){
  'use strict';
  const VERSION='chart-resume-consent-20261013-v1',TOKEN=/^[a-f0-9]{64}$/,TTL=15*60*1000;
  const TOKEN_KEY='zx_chart_resume_token_v1',INPUT_KEY='zx_chart_resume_input_v1';
  let active=null,revision=0;
  const sdk=()=>root.zxMember;
  const consent=()=>!!root.ZxPrivacyConsent?.has('device_account');
  const wechat=()=>/MicroMessenger/i.test(navigator.userAgent);
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
  function button(text,action){const el=node('button',text);el.type='button';el.className='chart-resume-button';el.addEventListener('click',action);return el;}
  function checked(input){return input&&typeof input.d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(input.d)&&
    (input.t==null||input.t===''||typeof input.t==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(input.t))&&
    typeof input.c==='string'&&input.c.trim()&&input.c.length<=60&&[null,'','男','女'].includes(input.g);}
  function read(key){try{const value=JSON.parse(sessionStorage.getItem(key)||'null');if(!value||!Number.isFinite(value.expiresAt)||value.expiresAt<=Date.now()){sessionStorage.removeItem(key);return null;}return value;}catch(_){return null;}}
  function write(key,value){sessionStorage.setItem(key,JSON.stringify(value));}
  function remove(key){try{sessionStorage.removeItem(key);}catch(_){}}
  function clear(){revision++;remove(TOKEN_KEY);remove(INPUT_KEY);document.getElementById('chart-resume-pending')?.remove();}
  function accountLink(){const link=node('a','微信登录与账号确认');link.href='./profile.html#account-status';return link;}
  function api(path,body){if(!sdk()?.chartContinuationCall)return Promise.reject(new Error('CHART_RESUME_UNAVAILABLE'));return sdk().chartContinuationCall(path,body);}
  function errorText(error){const code=String(error?.code||error?.message||'');if(/GONE/.test(code))return '续接凭证已使用、撤回或到期，请回原浏览器重新生成。';if(/AUTH|ACCOUNT|SESSION|PRIVACY/.test(code))return '请先在微信中登录并确认账号功能，再取回这张图谱。';if(/RATE_LIMIT/.test(code))return '续接生成过于频繁，请稍后重试。';if(/INPUT|CITY|BIRTH|MINIMUM_AGE/.test(code))return '请先核对完整出生地点及资料；仅支持已满14周岁的资料。';return '续接服务暂不可用，请保留原浏览器中的图谱，稍后重试。';}
  async function open(entry){
    if(!checked(entry?.input))return;
    if(active)active.close();
    const focus=document.activeElement,dialog=node('dialog');dialog.className='chart-resume-dialog';dialog.setAttribute('aria-labelledby','chart-resume-title');
    const title=node('h2','在微信中继续这张图谱');title.id='chart-resume-title';
    const body=node('div'),close=button('关闭并撤回续接',()=>dialog.close());dialog.append(title,body,close);document.body.append(dialog);
    const view={dialog,token:'',close:()=>dialog.close(),busy:false};active=view;
    body.append(node('p','微信登录、支付需要在微信浏览器中完成。请用自己的微信扫描续接二维码，登录后取回资料，再核对购买。'));
    body.append(node('p',[entry.input.d,entry.input.t||'时间待补',entry.input.c,entry.input.g||'排盘性别待补'].join(' · ')));
    const label=node('label'),check=node('input');check.type='checkbox';label.className='chart-resume-check';label.append(check,node('span','我同意把以上出生日期、时间、地点和排盘性别加密暂存到知星服务端（api.zhixng.cn），用于此次微信续接。凭证15分钟有效，取回一次后删除；到期停止取回并由定时任务清理。'));
    const live=node('p');live.setAttribute('role','status');const output=node('div');
    const create=button('生成微信续接二维码',async()=>{
      if(!check.checked||view.busy||!dialog.open)return;view.busy=true;create.disabled=true;live.textContent='正在生成续接凭证…';
      try{
        const input={d:entry.input.d,t:entry.input.t||null,c:entry.input.c,g:entry.input.g||null};
        const result=await api('/chart-continuations',{input,consent:{confirmed:true,version:VERSION}});
        if(!TOKEN.test(result?.token||'')||!Number.isFinite(result.expiresAt)||result.expiresAt<=Date.now())throw new Error('CHART_RESUME_RESPONSE_INVALID');
        view.token=result.token;
        if(!dialog.open){await api('/chart-continuations/revoke',{token:view.token});return;}
        const url=new URL('./app.html',location.href);url.search='';url.hash='zx-continue='+view.token;
        const link=node('a','打开这张图谱的微信续接链接');link.href=url.href;link.className='chart-resume-link';link.rel='noreferrer';
        if(typeof root.qrcode==='function'){const qr=root.qrcode(0,'M');qr.addData(url.href);qr.make();const image=node('img');image.src=qr.createDataURL(5,16);image.alt='用自己的微信扫一扫，继续当前图谱';image.className='chart-resume-qr';output.append(image);}
        output.append(link,button('复制续接链接',async()=>{try{await navigator.clipboard.writeText(url.href);live.textContent='已复制。链接一次有效，请仅交给自己的微信。';}catch(_){live.textContent='请长按上方链接复制，用自己的微信打开。';}}));
        live.textContent='凭证15分钟内有效、仅可取回一次。关闭此窗口会撤回续接；原浏览器图谱仍保留。';check.disabled=true;create.hidden=true;
      }catch(error){if(dialog.open)live.textContent=errorText(error);}
      finally{view.busy=false;if(dialog.open&&!view.token)create.disabled=!check.checked;}
    });
    create.disabled=true;check.addEventListener('change',()=>{create.disabled=!check.checked||view.busy;});body.append(label,create,live,output);
    dialog.addEventListener('close',()=>{if(view.token)api('/chart-continuations/revoke',{token:view.token}).catch(()=>{});if(active===view)active=null;dialog.remove();focus?.focus?.();});
    dialog.showModal();
  }
  function prefill(){
    const pending=read(INPUT_KEY);if(!pending||!checked(pending.input)||!root.ZxHomeChartBridge)return;
    remove(INPUT_KEY);root.ZxHomeChartBridge.reset();root.ZxHomeChartBridge.setForm(pending.input);root.ZxHomeChartBridge.showNew(true);
    const summary=document.getElementById('formReadiness');if(summary)summary.textContent='已取回续接资料。请核对这张图谱，确认本机处理同意后再继续。';
    document.getElementById('bDate')?.focus({preventScroll:true});
  }
  function pendingPanel(){
    const pending=read(TOKEN_KEY);if(!pending||!TOKEN.test(pending.token||'')||document.getElementById('chart-resume-pending'))return;
    const panel=node('section');panel.id='chart-resume-pending';panel.className='chart-resume-panel';
    panel.append(node('h2','继续原浏览器中的图谱'),node('p','仅取回此次续接资料，不自动保存、购买或开放报告。取回后请核对出生日期、时间、地点和排盘性别。'));
    const label=node('label'),check=node('input');check.type='checkbox';label.className='chart-resume-check';label.append(check,node('span','这是我从原浏览器发起的续接；我同意将其中的出生资料取回当前微信浏览器。'));
    const live=node('p');live.setAttribute('role','status');const consume=button('取回并核对这张图谱',async()=>{
      if(!check.checked)return;
      if(!wechat()||!consent()){live.textContent='请用微信打开本链接，先完成微信登录与账号确认，再取回资料。';return;}
      const account=sdk()?.snapshot?.();if(account?.authenticated!==true||account.identityKind!=='wechat'){live.textContent='请先完成微信登录，之后再点击取回。';return;}
      consume.disabled=true;const requestRevision=revision;
      try{
        const result=await api('/chart-continuations/consume',{token:pending.token,confirmed:true});
        if(!checked(result?.input))throw new Error('CHART_RESUME_RESPONSE_INVALID');
        // Do not render data returned after logout or consent withdrawal.
        const after=sdk()?.snapshot?.();if(!panel.isConnected||requestRevision!==revision||!consent()||after?.accountRef!==account.accountRef||after?.authenticated!==true){clear();throw new Error('ACCOUNT_CHANGED');}
        remove(TOKEN_KEY);write(INPUT_KEY,{input:{d:result.input.d,t:result.input.t,c:result.input.c,g:result.input.g},expiresAt:Date.now()+TTL});panel.remove();
        if(root.ZxHomeChartBridge)prefill();else location.assign(new URL('./app.html',location.href).href);
      }catch(error){live.textContent=errorText(error);consume.disabled=!check.checked;}
    });
    consume.disabled=true;check.addEventListener('change',()=>{consume.disabled=!check.checked;});panel.append(label,accountLink(),consume,button('放弃此次续接',()=>{api('/chart-continuations/revoke',{token:pending.token}).catch(()=>{});clear();}),live);
    (document.querySelector('main')||document.body).prepend(panel);
  }
  function init(){
    const match=/^#zx-continue=([a-f0-9]{64})$/.exec(location.hash);
    if(match){history.replaceState(null,'',location.pathname+location.search);try{write(TOKEN_KEY,{token:match[1],expiresAt:Date.now()+TTL});}catch(_){return;}}
    prefill();pendingPanel();
  }
  ['zx-birth-local-cleared','zx-local-data-cleared','zx-account-consent-revoked','zx-private-session-cleared'].forEach(name=>root.addEventListener(name,()=>{clear();if(active)active.close();}));
  root.ZxChartContinuation=Object.freeze({open,prefill});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
