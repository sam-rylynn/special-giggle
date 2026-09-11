/* Display names are separate from birth data and paid-report identity. Local session only. */
(function(root){
  'use strict';
  const KEY='zx_display_profile_v1';
  const clean=value=>String(value??'').normalize('NFC').trim();
  const count=value=>typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('zh',{granularity:'grapheme'}).segment(value)].length:Array.from(value).length;
  const validate=value=>{const name=clean(value);return /[<>\{\}\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(name)?'称呼不能包含控制符或尖括号。':count(name)>20?'称呼最多 20 个字。':'';};
  const read=()=>{try{const name=clean(JSON.parse(sessionStorage.getItem(KEY)||'{}').name);return validate(name)?'':name;}catch{return '';}};
  const write=value=>{const name=clean(value),error=validate(name);if(error)throw new Error(error);sessionStorage.setItem(KEY,JSON.stringify({name}));return name;};
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api={KEY,clean,validate,read,write,escape};root.ZxDisplayProfile=api;
  if(typeof module==='object')module.exports=api;
  if(typeof document==='undefined')return;
  function mount(){
    const card=document.getElementById('formCard'), result=document.getElementById('result');if(!card||!result)return;
    const style=document.createElement('style');style.textContent='.zx-name-field{display:block;margin:20px 0}.zx-name-field input{display:block;width:100%;height:50px;margin-top:8px;padding:10px 14px;background:#131c2c;color:#e8e4d8;border:1px solid #716345;border-radius:8px;font:inherit;box-sizing:border-box}.zx-name-help{font:12px/1.7 sans-serif;color:#aeb4c0}.zx-name-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;margin-bottom:24px;border-bottom:1px solid #665534}.zx-name-bar strong{font-size:18px;overflow-wrap:anywhere}.zx-name-bar button,.zx-name-dialog button{min-height:44px;color:#dfc185;background:#192233;border:1px solid #716345;border-radius:8px;padding:8px 14px;cursor:pointer}.zx-name-dialog{background:#0e1220;color:#e8e4d8;border:1px solid #716345;border-radius:14px;padding:24px;width:min(88vw,420px);box-sizing:border-box}.zx-name-dialog::backdrop{background:#0009}.zx-name-dialog h2{margin-top:0}.zx-name-error{color:#f0b6a2;font-size:13px}';document.head.appendChild(style);
    const label=document.createElement('label');label.className='zx-name-field';label.htmlFor='bDisplayName';label.innerHTML='显示称呼 <small>（选填）</small><input id="bDisplayName" autocomplete="nickname" placeholder="怎么称呼你" maxlength="80" aria-describedby="display-name-help display-name-error"><span id="display-name-help" class="zx-name-help">用于你的日主页和邀请署名，可随时修改。</span><span id="display-name-error" class="zx-name-error" role="alert"></span>';
    card.querySelector('.field')?.before(label);if(!label.isConnected)card.querySelector('#goBtn').before(label);
    const field=label.querySelector('input');field.value=read();
    const bar=document.createElement('div');bar.className='zx-name-bar';bar.innerHTML='<div><small class="zx-name-help">我的日主页</small><br><strong id="day-display-name"></strong></div><button type="button" id="edit-day-name">设置称呼</button>';result.prepend(bar);
    const update=()=>{const name=read();document.getElementById('day-display-name').textContent=name||'欢迎，先认识自己';document.getElementById('edit-day-name').textContent=name?'修改称呼':'设置称呼';field.value=name;};update();
    document.getElementById('goBtn').addEventListener('click',e=>{const error=validate(field.value);document.getElementById('display-name-error').textContent=error;if(error){e.stopImmediatePropagation();field.focus();return;}try{write(field.value);update();}catch{document.getElementById('display-name-error').textContent='浏览器未允许暂存称呼，请检查隐私设置。';}},true);
    document.getElementById('edit-day-name').onclick=()=>{const dialog=document.createElement('dialog');dialog.className='zx-name-dialog';dialog.setAttribute('aria-labelledby','day-name-title');dialog.innerHTML='<form><h2 id="day-name-title">怎么称呼你</h2><label class="zx-name-field">显示称呼<input name="name" autocomplete="nickname" maxlength="80" placeholder="填写你喜欢的称呼"></label><p class="zx-name-help">仅修改显示称呼，不修改出生资料，不消耗报告更正次数。当前仅保存在这个标签页。</p><p class="zx-name-error" role="alert"></p><button type="submit">保存称呼</button> <button type="button" data-cancel>取消</button></form>';document.body.appendChild(dialog);dialog.querySelector('input').value=read();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.onclose=()=>dialog.remove();dialog.querySelector('form').onsubmit=e=>{e.preventDefault();try{write(dialog.querySelector('input').value);update();dialog.close();}catch(err){dialog.querySelector('[role=alert]').textContent=err.message;}};dialog.showModal();};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})(typeof window==='object'?window:globalThis);
