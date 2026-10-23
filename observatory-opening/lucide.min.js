var lucide=(()=>{var p=Object.defineProperty;var y=Object.getOwnPropertyDescriptor;var b=Object.getOwnPropertyNames;var U=Object.prototype.hasOwnProperty;var O=(e,a)=>{for(var r in a)p(e,r,{get:a[r],enumerable:!0})},H=(e,a,r,o)=>{if(a&&typeof a=="object"||typeof a=="function")for(let t of b(a))!U.call(e,t)&&t!==r&&p(e,t,{get:()=>a[t],enumerable:!(o=y(a,t))||o.enumerable});return e};var v=e=>H(p({},"__esModule",{value:!0}),e);var I={};O(I,{createIcons:()=>E});var u={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};var P=([e,a,r])=>{let o=document.createElementNS("http://www.w3.org/2000/svg",e);return Object.keys(a).forEach(t=>{o.setAttribute(t,String(a[t]))}),r?.length&&r.forEach(t=>{let s=P(t);o.appendChild(s)}),o},k=(e,a={})=>{let o={...u,...a};return P(["svg",o,e])};var A=e=>{for(let a in e)if(a.startsWith("aria-")||a==="role"||a==="title")return!0;return!1};var B=(...e)=>e.filter((a,r,o)=>!!a&&a.trim()!==""&&o.indexOf(a)===r).join(" ").trim();var M=e=>e.replace(/^([A-Z])|[\s-_]+(\w)/g,(a,r,o)=>o?o.toUpperCase():r.toLowerCase());var F=e=>{let a=M(e);return a.charAt(0).toUpperCase()+a.slice(1)};var G=e=>Array.from(e.attributes).reduce((a,r)=>(a[r.name]=r.value,a),{}),D=e=>typeof e=="string"?e:!e||!e.class?"":e.class&&typeof e.class=="string"?e.class.split(" "):e.class&&Array.isArray(e.class)?e.class:"",m=(e,{nameAttr:a,icons:r,attrs:o})=>{let t=e.getAttribute(a);if(t==null)return;let s=F(t),f=r[s];if(!f)return console.warn(`${e.outerHTML} icon name was not found in the provided icons object.`);let l=G(e),L=A(l)?{}:{"aria-hidden":"true"},g={...u,"data-lucide":t,...L,...o,...l},R=D(l),T=D(o),w=B("lucide",`lucide-${t}`,...R,...T);w&&Object.assign(g,{class:w});let q=k(f,g);return e.parentNode?.replaceChild(q,e)};var x=[["path",{d:"m12 19-7-7 7-7"}],["path",{d:"M19 12H5"}]];var i=[["path",{d:"M5 12h14"}],["path",{d:"m12 5 7 7-7 7"}]];var n=[["path",{d:"M12 15V3"}],["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}],["path",{d:"m7 10 5 5 5-5"}]];var c=[["rect",{x:"14",y:"3",width:"5",height:"18",rx:"1"}],["rect",{x:"5",y:"3",width:"5",height:"18",rx:"1"}]];var C=[["path",{d:"M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"}]];var d=[["circle",{cx:"12",cy:"8",r:"5"}],["path",{d:"M20 21a8 8 0 0 0-16 0"}]];var h=[["path",{d:"M18 6 6 18"}],["path",{d:"m6 6 12 12"}]];var S=({icons:e={},nameAttr:a="data-lucide",attrs:r={},root:o=document,inTemplates:t}={})=>{if(!Object.values(e).length)throw new Error(`Please provide an icons object.
If you want to use all the icons you can import it like:
 \`import { createIcons, icons } from 'lucide';
lucide.createIcons({icons});\``);if(typeof o>"u")throw new Error("`createIcons()` only works in a browser environment.");if(Array.from(o.querySelectorAll(`[${a}]`)).forEach(f=>m(f,{nameAttr:a,icons:e,attrs:r})),t&&Array.from(o.querySelectorAll("template")).forEach(l=>S({icons:e,nameAttr:a,attrs:r,root:l.content,inTemplates:t})),a==="data-lucide"){let f=o.querySelectorAll("[icon-name]");f.length>0&&(console.warn("[Lucide] Some icons were found with the now deprecated icon-name attribute. These will still be replaced for backwards compatibility, but will no longer be supported in v1.0 and you should switch to data-lucide"),Array.from(f).forEach(l=>m(l,{nameAttr:"icon-name",icons:e,attrs:r})))}};function E(){S({icons:{ArrowRight:i,ArrowLeft:x,UserRound:d,Pause:c,Play:C,X:h,Download:n}})}return v(I);})();
/*! Bundled license information:

lucide/dist/esm/defaultAttributes.js:
lucide/dist/esm/createElement.js:
lucide/dist/esm/shared/src/utils/hasA11yProp.js:
lucide/dist/esm/shared/src/utils/mergeClasses.js:
lucide/dist/esm/shared/src/utils/toCamelCase.js:
lucide/dist/esm/shared/src/utils/toPascalCase.js:
lucide/dist/esm/replaceElement.js:
lucide/dist/esm/icons/arrow-left.js:
lucide/dist/esm/icons/arrow-right.js:
lucide/dist/esm/icons/download.js:
lucide/dist/esm/icons/pause.js:
lucide/dist/esm/icons/play.js:
lucide/dist/esm/icons/user-round.js:
lucide/dist/esm/icons/x.js:
lucide/dist/esm/lucide.js:
  (**
   * @license lucide v1.8.0 - ISC
   *
   * This source code is licensed under the ISC license.
   * See the LICENSE file in the root directory of this source tree.
   *)
*/
