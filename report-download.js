/* Offline export utility. Content is supplied only by the authenticated reader. */
(function(root){
  'use strict';
  const LEGACY_CHAPTERS=[['sec-overview','总览'],['sec-chart','盘面'],['sec-relation','关系'],['sec-action','行动'],['sec-phase','时间']];
  const STANDALONE_CHAPTERS=[['sec-overview','总览'],['sec-cross','本命双盘合看'],['sec-chart','盘面'],['sec-relation','关系'],['sec-action','行动'],['sec-phase','时间']];
  const TAGS=new Set('article section aside div p h2 h3 h4 h5 h6 header span strong b small ul ol li blockquote table caption thead tbody tr th td br em'.split(' '));
  const SVG_TAGS=new Set('svg g circle line path text rect ellipse polygon polyline'.split(' '));
  const CLASSES=new Set(('report-chapter pad chapter-block chapter-source method-reference src-inline src note warn key key-hot structured-list structured-list-keywords identity-keywords report-guide heading-line heading-eyebrow chart-details chart-details-body skeleton-details chart-table chart-table-scroll chart-hidden chart-hidden-item chart-basis chart-repeat-note chart-table-hint basis gz tg bar track fill ten-god-summary astro-block astro-facts astro-approx wheel relation-levels relation-level-panel action-opening action-pair action-tradeoff action-rule action-rhythm rhythm-steps transition-lead time-window time-period time-ganzhi is-current time-stage dy-meta time-focus time-focus-title time-focus-lead time-focus-decade time-period-label time-key-change time-focus-year time-year-heading time-year-number time-reading-label time-year-why time-year-actions time-key-phrase copy-key-phrase time-focus-basis time-focus-astro').split(' '));
  const DROP=new Set('script style link meta base iframe object embed input textarea select option button form img video audio source canvas template noscript'.split(' '));
  const SVG_NUMBERS=/^[\d.\s,+eE-]+$/;
  const SVG_COLOR=/^(?:#[\da-fA-F]{3,8}|rgba?\([\d.,\s]+\)|none|transparent)$/;
  const urls=new Set();
  let generation=0;
  const escape=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const CSS=`:root{color-scheme:light;--gold:#806326;--mist:#526070}*{box-sizing:border-box}body{margin:0;background:#f4f1e9;color:#242c3a;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;line-height:1.9}main{max-width:960px;margin:auto;padding:36px 24px 70px}header.report-heading{text-align:center;padding:20px 0 32px;border-bottom:1px solid #c8b78c}h1,h2,h3,h4,h5,h6{font-family:"Songti SC","SimSun",serif;line-height:1.55;color:var(--gold);break-after:avoid}h1{font-size:32px}h2{font-size:28px;margin:0 0 28px}h3{font-size:23px;margin:30px 0 14px}h4{font-size:21px;margin:24px 0 12px}h5,h6{font-size:18px;margin:18px 0 8px}p{margin:14px 0;overflow-wrap:anywhere}li{margin:9px 0}.identity{font-size:23px}.judgement{font-size:18px}.as-of,.offline-note{color:var(--mist);font-size:13px}.report-chapter{padding:34px 0;border-bottom:1px solid #c8b78c}.chapter-block+.chapter-block{margin-top:30px}.chapter-source,.method-reference,.src,.src-inline,.note{color:var(--mist);font-size:13px}.chapter-source{margin-top:22px}.src-inline{display:block}.heading-line{display:block}.heading-eyebrow{display:block;font-size:16px}.chart-details{padding:18px 22px;margin:24px 0;border:1px solid #c8b78c;border-radius:12px}.chart-details>h3{margin-top:0}.chart-table-scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;margin:22px 0;font-size:14px}caption{text-align:left;font-weight:600}th,td{padding:10px 7px;text-align:center;border:1px solid #c8b78c}.chart-hidden-item{display:block}.bar{display:flex;align-items:center;gap:12px;margin:12px 0}.bar b{min-width:2em}.track{height:8px;flex:1;background:#dcd7ca}.fill{height:100%}.astro-facts,.identity-keywords{display:flex;flex-wrap:wrap;gap:16px;list-style:none;padding:0}.astro-facts li{display:flex;gap:10px}.wheel{display:block;width:340px;max-width:100%;height:auto;margin:20px auto;background:#0e1220;border-radius:50%}.structured-list li>strong,.report-guide strong{display:block}.action-pair{display:grid;grid-template-columns:1fr 1fr;gap:24px}.action-pair>section,.time-focus-year,.time-focus-decade,.relation-level-panel{padding:16px 20px;border:1px solid #c8b78c;border-radius:12px;margin:24px 0}.action-pair>section{margin:0}.action-rule,.key,.key-hot,.time-key-phrase{font-weight:750;color:var(--gold)}.time-year-number{display:block;font-size:30px;font-weight:700}.time-year-number small{margin-left:14px;font-size:16px}.time-year-heading h4{margin-top:6px}.time-period-label{font-weight:700;color:var(--gold)}.time-year-actions h6{font-family:inherit}.time-key-change{border-left:3px solid #bca266;padding-left:16px}.time-window{padding-left:24px}.time-period{display:block;color:var(--gold)}blockquote{border-left:3px solid #bca266;margin:20px 0;padding:8px 18px;background:#ece7da}footer{margin-top:32px;white-space:pre-line;color:var(--mist);font-size:13px}.offline-directory{display:flex;justify-content:center;gap:20px;flex-wrap:wrap;margin:22px 0}.offline-directory a{color:var(--gold)}@media(max-width:600px){main{padding:24px 18px 50px}h1{font-size:28px}h2{font-size:25px}h3{font-size:21px}.action-pair{grid-template-columns:1fr}.chart-details{padding:14px}.time-focus-year,.time-focus-decade{padding:14px}table{font-size:12px}th,td{padding:7px 4px}}@page{size:A4;margin:18mm 16mm}@media print{body{background:white;color:#17202c}main{max-width:none;padding:0}.report-chapter{break-before:page;border:0;padding:0}.report-chapter:first-of-type{break-before:auto}.offline-directory,.offline-note{display:none}h1{font-size:24pt}h2{font-size:20pt}h3{font-size:15pt}h4{font-size:13pt}h5,h6{font-size:11pt}p,li{font-size:10.5pt;line-height:1.8}.chart-table-scroll{overflow:visible}thead{display:table-header-group}tr,.wheel{break-inside:avoid}.action-pair{display:block}.action-pair>section{margin-top:16px}.chapter-source,.method-reference{font-size:9pt}strong{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
body{background:#fff;color:#242c3a;font-size:17px;line-height:1.9}
main{max-width:760px}h1,h2,h3,h4,h5,h6{letter-spacing:0;break-after:avoid-page}
p,li{orphans:2;widows:2}.chapter-source,.method-reference,.src,.src-inline,.note,footer{font-size:14px}
.chart-details,.action-pair>section,.time-focus-year,.time-focus-decade,.relation-level-panel{border-radius:0;background:none;border:0;border-top:1px solid #c8b78c;padding:20px 0}
.action-pair{display:block}.rhythm-steps{padding-left:28px}.rhythm-steps li{padding-left:8px}
table,.bar,.astro-facts,.wheel{break-inside:avoid-page}blockquote{border:0;background:none;padding:12px 0;font-size:20px}
@media print{p,li{font-size:11.5pt;line-height:1.85}.chapter-source,.method-reference,.src,.src-inline,.note,footer{font-size:9.5pt}.report-chapter{break-before:page}h2,h3,h4,h5,h6{break-after:avoid-page}p,li{orphans:2;widows:2}}
`;

  function clean(node,target){
    if(node.nodeType===3)return target.createTextNode(node.nodeValue);
    if(node.nodeType!==1)return null;
    const tag=node.localName.toLowerCase();
    if(DROP.has(tag)||node.classList.contains('details-cue')||node.classList.contains('relation-level-buttons'))return null;
    // Only the known, freshly rendered relation panels are expanded from hidden state.
    if(node.hasAttribute('hidden')&&!node.classList.contains('relation-level-panel'))return null;
    const svg=SVG_TAGS.has(tag),allowed=svg||TAGS.has(tag)||tag==='details'||tag==='summary'||tag==='a';
    if(!allowed)return null;
    const out=svg?target.createElementNS('http://www.w3.org/2000/svg',tag):target.createElement(tag==='details'?'section':tag==='summary'?'h3':tag==='a'?'span':tag);
    const classes=[...node.classList].filter(value=>CLASSES.has(value));
    if(classes.length)out.setAttribute('class',classes.join(' '));
    if(svg){
      for(const attr of [...node.attributes]){
        const name=attr.name,value=attr.value;
        if(['viewBox','x','y','x1','y1','x2','y2','cx','cy','r','rx','ry','width','height','stroke-width','stroke-dasharray','font-size','opacity','fill-opacity','stroke-opacity','points'].includes(name)&&SVG_NUMBERS.test(value))out.setAttribute(name,value);
        else if(['fill','stroke'].includes(name)&&SVG_COLOR.test(value))out.setAttribute(name,value);
        else if(name==='d'&&/^[MmZzLlHhVvCcSsQqTtAa\d.\s,+eE-]+$/.test(value))out.setAttribute(name,value);
        else if(name==='transform'&&/^(?:(?:rotate|translate|scale|matrix)\([\d.\s,+eE-]+\)\s*)+$/.test(value))out.setAttribute(name,value);
        else if(name==='text-anchor'&&['start','middle','end'].includes(value))out.setAttribute(name,value);
        else if(name==='dominant-baseline'&&['central','middle'].includes(value))out.setAttribute(name,value);
      }
    }else{
      if(['th','td'].includes(tag)&&/^[1-9]$/.test(node.getAttribute('colspan')||''))out.setAttribute('colspan',node.getAttribute('colspan'));
      if(tag==='th'&&['row','col'].includes(node.getAttribute('scope')))out.setAttribute('scope',node.getAttribute('scope'));
      if(node.classList.contains('fill')){
        const width=node.style.width,color=node.style.backgroundColor;
        if(/^(?:100|\d{1,2})(?:\.\d+)?%$/.test(width))out.style.width=width;
        if(SVG_COLOR.test(color))out.style.backgroundColor=color;
      }
    }
    for(const child of [...node.childNodes]){const result=clean(child,target);if(result)out.append(result);}
    return out;
  }
  function makeDocument({identity,judgement,reportTitle,asOfAt,disclaimer,chaptersHtml}){
    if(typeof chaptersHtml!=='string'||chaptersHtml.length>1500000||typeof disclaimer!=='string'||!disclaimer.trim())throw new Error('REPORT_EXPORT_INVALID');
    // Template contents are inert, including resource elements, while we discard them.
    const parsed=root.document.createElement('template');parsed.innerHTML=chaptersHtml;
    const target=root.document.implementation.createHTMLDocument('');
    const hasCross=[...parsed.content.children].some(node=>node.tagName==='ARTICLE'&&node.id==='sec-cross');
    const directory=hasCross?STANDALONE_CHAPTERS:LEGACY_CHAPTERS;
    const chapters=directory.map(([id])=>{
      const candidates=[...parsed.content.children].filter(node=>node.tagName==='ARTICLE'&&node.id===id);
      if(candidates.length!==1)throw new Error('REPORT_EXPORT_INCOMPLETE');
      const article=clean(candidates[0],target);
      if(!article||!article.querySelector('h2'))throw new Error('REPORT_EXPORT_INCOMPLETE');
      article.id=id;return article.outerHTML;
    }).join('\n');
    const asOf=typeof asOfAt==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(asOfAt)?asOfAt.slice(0,10):'';
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; script-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'"><meta name="referrer" content="no-referrer"><title>${escape(reportTitle||'知星 · 深度发展报告')}</title><style>${CSS}</style></head><body><main><header class="report-heading"><p>知星 · 以易理观己，以星盘为证</p><h1>${escape(reportTitle||'深度发展报告')}</h1><p class="identity">${escape(identity)}</p><p class="judgement">${escape(judgement)}</p>${asOf?`<p class="as-of">报告时间基准：${escape(asOf)}</p>`:''}<p class="offline-note">完整${directory.length}章已展开，可离线阅读。需要 PDF 时，请使用浏览器的打印功能并选择“另存为 PDF”。</p></header><nav class="offline-directory" aria-label="报告${directory.length}章">${directory.map(([id,title])=>`<a href="#${id}">${title}</a>`).join('')}</nav>${chapters}<footer>${escape(disclaimer)}</footer></main></body></html>`;
  }
  function clear(){
    ++generation;clearPdf();
    for(const url of urls)root.URL.revokeObjectURL(url);urls.clear();
  }
  function save(html,current){
    if(typeof current!=='function'||!current())throw new Error('REPORT_EXPORT_EXPIRED');
    const url=root.URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));urls.add(url);
    const a=root.document.createElement('a');a.href=url;a.download='知星-深度发展报告.html';
    try{if(!current())throw new Error('REPORT_EXPORT_EXPIRED');root.document.body.append(a);a.click();}
    finally{a.remove();root.setTimeout(()=>{root.URL.revokeObjectURL(url);urls.delete(url);},30000);}
  }
  // Generate a real file in this page; never depend on WebView print/popups.
  const scriptUrl=new URL(root.document.currentScript?.src || './report-download.js',root.location.href);
  const pdfAssets=new URL(/\/v1\//.test(scriptUrl.pathname)?'../vendor/report-pdf/':'./vendor/report-pdf/',scriptUrl);
  let pdfLibraries=null,fontData=null,pdfReady=null;
  function loadScript(name,globalName){
    if(root[globalName])return Promise.resolve(root[globalName]);
    return new Promise((resolve,reject)=>{
      const script=root.document.createElement('script');script.src=new URL(name,pdfAssets).href;script.referrerPolicy='no-referrer';
      const timer=root.setTimeout(()=>{script.remove();reject(new Error('REPORT_PDF_LOAD_FAILED'));},30000);
      script.onload=()=>{root.clearTimeout(timer);root[globalName]?resolve(root[globalName]):reject(new Error('REPORT_PDF_LOAD_FAILED'));};
      script.onerror=()=>{root.clearTimeout(timer);script.remove();reject(new Error('REPORT_PDF_LOAD_FAILED'));};root.document.head.append(script);
    });
  }
  async function pdfDependencies(){
    if(!pdfLibraries)pdfLibraries=Promise.all([loadScript('pdf-lib-1.17.1.min.js','PDFLib'),loadScript('fontkit-1.1.1.min.js','fontkit')]).catch(e=>{pdfLibraries=null;throw e;});
    if(!fontData)fontData=(async()=>{const controller=new AbortController(),timer=root.setTimeout(()=>controller.abort(),45000);try{
      const response=await fetch(new URL('ZhixingPDFSans-Regular.ttf',pdfAssets),{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
      if(!response.ok)throw new Error('REPORT_PDF_LOAD_FAILED');return new Uint8Array(await response.arrayBuffer());
    }catch(_){fontData=null;throw new Error('REPORT_PDF_LOAD_FAILED');}finally{root.clearTimeout(timer);}})();
    const [libs,bytes]=await Promise.all([pdfLibraries,fontData]);return {lib:libs[0],kit:libs[1],bytes};
  }
  function clearPdf(){
    if(pdfReady){root.clearTimeout(pdfReady.timer);root.URL.revokeObjectURL(pdfReady.url);pdfReady=null;}
    const actions=root.document.getElementById('reportPdfActions');if(actions){actions.replaceChildren();actions.hidden=true;}
  }
  async function svgPng(svg){
    const copy=svg.cloneNode(true);copy.setAttributeNS('http://www.w3.org/2000/xmlns/','xmlns','http://www.w3.org/2000/svg');copy.setAttribute('width','680');copy.setAttribute('height','680');
    const url=root.URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml'}));
    try{const img=new Image();await new Promise((resolve,reject)=>{const timer=root.setTimeout(()=>reject(new Error('REPORT_PDF_IMAGE_FAILED')),10000);img.onload=()=>{root.clearTimeout(timer);resolve();};img.onerror=()=>{root.clearTimeout(timer);reject(new Error('REPORT_PDF_IMAGE_FAILED'));};img.src=url;});
      const canvas=root.document.createElement('canvas');canvas.width=canvas.height=680;const context=canvas.getContext('2d');context.fillStyle='#0e1220';context.fillRect(0,0,680,680);context.drawImage(img,0,0);return canvas.toDataURL('image/png');
    }finally{root.URL.revokeObjectURL(url);}
  }
  async function createPdf(html,current,onProgress=()=>{}){
    clearPdf();const epoch=generation;
    const check=()=>{if(epoch!==generation||!current())throw new Error('REPORT_EXPORT_EXPIRED');};check();
    onProgress('正在准备 PDF 字体，首次使用需要片刻…');
    const {lib,kit,bytes}=await pdfDependencies();check();
    const pdf=await lib.PDFDocument.create();pdf.registerFontkit(kit);
    const font=await pdf.embedFont(bytes,{subset:true});check();
    pdf.setTitle('知星 · 深度发展报告');pdf.setAuthor('知星');pdf.setCreator('知星 · 本机导出');
    const doc=new DOMParser().parseFromString(html,'text/html'),articles=[...doc.querySelectorAll('main > article.report-chapter')];
    if(![5,6].includes(articles.length))throw new Error('REPORT_PDF_CONTENT_INVALID');
    const W=595.28,H=841.89,M=48,WIDTH=W-2*M,ink=lib.rgb(.12,.16,.21),gold=lib.rgb(.46,.34,.13),gray=lib.rgb(.36,.4,.45);
    let page,y,chapter='深度发展报告';
    const cleanText=text=>String(text||'').replace(/[\uFE0E\uFE0F]/g,'').replace(/\s+/g,' ').trim();
    const widths=new Map();
    const width=(text,size)=>{const key=size+':'+text;let w=widths.get(key);if(w===undefined){w=font.widthOfTextAtSize(text,size);widths.set(key,w);}return w;};
    const lines=(text,size,max)=>{const out=[];let line='',w=0;for(const char of Array.from(cleanText(text))){const cw=width(char,size);if(line&&w+cw>max){out.push(line);line='';w=0;}line+=char;w+=cw;}if(line)out.push(line);return out;};
    function newPage(){page=pdf.addPage([W,H]);y=H-76;page.drawText('知星  /  '+chapter,{x:M,y:H-35,size:8,font,color:gray});page.drawLine({start:{x:M,y:H-47},end:{x:W-M,y:H-47},thickness:.5,color:lib.rgb(.79,.74,.62)});}
    function room(h){if(!page||y-h<M+20)newPage();}
    function paragraph(text,size=11.5,color=ink,heading=false,keepAfter=0){const rows=lines(text,size,WIDTH);if(!rows.length)return;const step=size*1.85;
      const follow=heading?2*11.5*1.85+9:0;
      room(heading?Math.min(rows.length*step+follow,H-76-M-20):Math.min(rows.length,2)*step+keepAfter);
      let index=0;
      while(index<rows.length){
        let capacity=Math.floor((y-M-20)/step),remaining=rows.length-index;
        if(capacity<Math.min(2,remaining)){newPage();capacity=Math.floor((y-M-20)/step);}
        let count=Math.min(capacity,remaining);
        if(keepAfter&&remaining<=capacity&&remaining*step+keepAfter>y-M-20){
          if(remaining<=2){newPage();continue;}
          count=remaining-2;
        }
        if(remaining-count===1&&count>2)count--;
        for(let i=0;i<count;i++){page.drawText(rows[index++],{x:M,y:y-size,font,size,color});y-=step;}
        if(index<rows.length)newPage();
      }
      y-=heading?8:9;
    }
    function table(node){
      if(node.caption)paragraph(node.caption.textContent,11,gold,true);
      const rows=[...node.querySelectorAll('tr')],cols=Math.max(...rows.map(row=>[...row.cells].reduce((n,c)=>n+(Number(c.getAttribute('colspan'))||1),0)));
      if(!cols)return;const cw=WIDTH/cols,size=8.5,step=14;
      const header=rows.find(row=>row.querySelector('th'));
      function rowDraw(row,repeated=false){const cells=[...row.cells].map(cell=>({cell,span:Number(cell.getAttribute('colspan'))||1}));let rowH=Math.max(...cells.map(c=>lines(c.cell.textContent,size,cw*c.span-12).length))*step+14;
        if(y-rowH<M+20){newPage();if(header&&header!==row&&!repeated)rowDraw(header,true);}
        let x=M;for(const {cell,span} of cells){const w=cw*span;page.drawRectangle({x,y:y-rowH,width:w,height:rowH,borderWidth:.5,borderColor:lib.rgb(.8,.79,.74),...(cell.localName==='th'?{color:lib.rgb(.95,.94,.9)}:{})});
          lines(cell.textContent,size,w-12).forEach((line,i)=>page.drawText(line,{x:x+6,y:y-17-i*step,size,font,color:ink}));x+=w;}
        y-=rowH;
      }
      rows.forEach(row=>rowDraw(row));y-=14;
    }
    const inline=new Set(['span','strong','b','small','em','br']);
    async function walk(node){
      check();if(node.nodeType===3){paragraph(node.textContent);return;}if(node.nodeType!==1)return;
      const tag=node.localName;if(tag==='nav'||node.classList.contains('offline-note'))return;
      if(/^h[1-6]$/.test(tag)){const size={h1:25,h2:22,h3:16,h4:13,h5:11,h6:10.5}[tag];paragraph(node.textContent,size,gold,true);return;}
      if(tag==='p'){
        const note=node.classList.contains('chapter-source')||node.classList.contains('method-reference');
        let next=node.nextElementSibling,parent=node.parentElement;
        while(!next&&parent&&parent.localName!=='article'){next=parent.nextElementSibling;parent=parent.parentElement;}
        const keep=!note&&next?.classList.contains('chapter-source')?lines(next.textContent,9.5,WIDTH).length*9.5*1.85+18:0;
        paragraph(node.textContent,note?9.5:11.5,note?gray:ink,false,Math.min(keep,120));return;
      }
      if(tag==='table'){table(node);return;}
      if(tag==='svg'){room(260);const png=await pdf.embedPng(await svgPng(node));check();page.drawImage(png,{x:(W-248)/2,y:y-248,width:248,height:248});y-=268;return;}
      if(tag==='footer'){paragraph(node.textContent,9.5,gray);return;}
      let pending='';const flush=()=>{if(pending.trim())paragraph(pending);pending='';};
      for(const child of node.childNodes){if(child.nodeType===3||child.nodeType===1&&inline.has(child.localName))pending+=child.textContent;else{flush();await walk(child);}}flush();
    }
    newPage();await walk(doc.querySelector('.report-heading'));
    for(let i=0;i<articles.length;i++){check();chapter=articles[i].querySelector('h2')?.textContent||String(i+1);newPage();onProgress('正在生成 PDF：'+chapter+'（'+(i+1)+'/'+articles.length+'）');await walk(articles[i]);await new Promise(resolve=>root.setTimeout(resolve,0));}
    await walk(doc.querySelector('main > footer'));
    const pages=pdf.getPages();pages.forEach((p,i)=>p.drawText((i+1)+' / '+pages.length,{x:W-M-45,y:30,size:8,font,color:gray}));
    check();onProgress('正在整理 PDF 文件…');const data=await pdf.save();check();
    const file=new File([data],'知星-深度发展报告.pdf',{type:'application/pdf'});
    if(data.length<1000||new TextDecoder().decode(data.slice(0,5))!=='%PDF-')throw new Error('REPORT_PDF_INVALID');
    return {file,pages:pages.length};
  }
  function offerPdf(result,current,notify){
    if(!current())throw new Error('REPORT_EXPORT_EXPIRED');clearPdf();
    const area=root.document.getElementById('reportPdfActions');if(!area)throw new Error('REPORT_PDF_UI_MISSING');
    const state={...result,url:root.URL.createObjectURL(result.file),current,expires:Date.now()+5*60*1000};pdfReady=state;
    const valid=()=>pdfReady===state&&Date.now()<state.expires&&current();
    let shareable=false;try{shareable=!!root.navigator.share&&!!root.navigator.canShare?.({files:[state.file]});}catch(_){}
    if(shareable){const button=root.document.createElement('button');button.type='button';button.textContent='保存或分享 PDF';button.onclick=async()=>{
      if(!valid()){clearPdf();notify('请重新生成 PDF。');return;}button.disabled=true;
      try{await root.navigator.share({files:[state.file],title:'知星 · 深度发展报告'});if(valid())notify('已交给系统处理，请确认 PDF 的保存位置。');}
      catch(e){if(valid())notify(e.name==='AbortError'?'已取消，PDF 仍可保存。':'当前环境未能分享文件，请尝试下方“下载 PDF”。');}
      finally{button.disabled=false;}
    };area.append(button);}
    const link=root.document.createElement('a');link.href=state.url;link.download=state.file.name;link.textContent='下载 PDF';link.className='ghost';link.onclick=event=>{
      if(!valid()){event.preventDefault();clearPdf();notify('请重新生成 PDF。');return;}
      notify('已请求保存真实 PDF 文件。若微信未显示保存选项，可先保留当前页，再尝试系统分享。');
    };area.append(link);area.hidden=false;
    state.timer=root.setTimeout(()=>{if(pdfReady===state){clearPdf();notify('PDF 保存入口已过期，请重新生成。');}},5*60*1000);
    notify('PDF 已生成，共 '+result.pages+' 页。请选择下方按钮保存。');
  }
  // Older WeChat pages can retain inline code while fetching this newer asset.
  // Reload the authenticated reader before exporting, preserving its report ID.
  function preparePrint(current){if(typeof current!=='function'||!current())throw new Error('REPORT_EXPORT_EXPIRED');return null;}
  function cancelPrint(){}
  function print(html,current){
    preparePrint(current);
    const status=root.document.getElementById('reportDownloadStatus');if(status)status.textContent='正在更新报告下载功能…';
    const url=new URL(root.location.href);url.searchParams.set('reader','pdf-file-v2');
    root.location.replace(url.href);
    return new Promise(()=>{});
  }
  root.addEventListener('pagehide',clear);
  root.ZxReportDownload=Object.freeze({document:makeDocument,save,createPdf,offerPdf,clearPdf,clear,preparePrint,cancelPrint,print});
})(window);
