/* analytics.js — 轻量埋点(无 PII)
 * ─────────────────────────────────────────────────────────────
 * 事件同时:①本地缓存到 localStorage(供 ?stats=1 自查)②POST 到收集端点。
 * 收集端点复用你的腾讯 SCF 后端:部署一个 HTTP 触发的收集函数后,把它的 URL
 * 填进下面的 ANALYTICS_ENDPOINT(或用 ?collect=<url> 临时覆盖测试)。
 * 留空 = 只本地缓存、不外发(现状:先能采、先能自查,填了 URL 即上报)。
 *
 * 只采「行为事件 + 匿名 cid」——从不采出生日期/时间/城市/姓名/问题原文等任何 PII。
 * ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // ← 部署 SCF 收集函数后填它的 URL(与问知星后端同法,需允许跨域 POST)。
  var ANALYTICS_ENDPOINT = '';

  var qs = new URLSearchParams(location.search);
  var EP = qs.get('collect') || ANALYTICS_ENDPOINT;

  // 用户主动退出(可在控制台 localStorage.setItem('zx_optout','1') 关闭上报)
  var OPTOUT = false;
  try { OPTOUT = localStorage.getItem('zx_optout') === '1'; } catch (_) {}

  // 匿名客户端 id:把 landing → report 串成一条漏斗;首次随机生成,非 PII。
  function cid() {
    var k = 'zx_cid', v = null;
    try { v = localStorage.getItem(k); } catch (_) {}
    if (!v) {
      v = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      try { localStorage.setItem(k, v); } catch (_) {}
    }
    return v;
  }

  var CID = cid();
  var SID = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);   // 本次会话
  var PAGE = /report/.test(location.pathname.split('/').pop() || '') ? 'report' : 'landing';

  var BUF_KEY = 'zx_ev', BUF_MAX = 300;
  function buf() { try { return JSON.parse(localStorage.getItem(BUF_KEY) || '[]'); } catch (_) { return []; } }
  function pushBuf(e) {
    try {
      var a = buf(); a.push(e);
      if (a.length > BUF_MAX) a = a.slice(-BUF_MAX);
      localStorage.setItem(BUF_KEY, JSON.stringify(a));
    } catch (_) {}
  }

  function send(e) {
    if (OPTOUT || !EP) return;
    var body = JSON.stringify(e);
    try {
      // 用 text/plain 让它成为 CORS「简单请求」——跨域时免预检。
      // (若用 application/json 会触发 OPTIONS 预检,而 sendBeacon 无法预检 → 被静默丢弃。)
      // 收集端把请求体当纯文本 JSON.parse 即可。
      if (navigator.sendBeacon) {
        navigator.sendBeacon(EP, new Blob([body], { type: 'text/plain' }));
      } else {
        fetch(EP, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: body, keepalive: true }).catch(function () {});
      }
    } catch (_) {}
  }

  // track(event, props?) — props 仅放非 PII 的行为维度(如 mode/turn/stem/hex)。
  function track(event, props) {
    var e = {
      t: Date.now(),
      ev: String(event || ''),
      page: PAGE,
      cid: CID,
      sid: SID,
      ref: document.referrer ? 1 : 0,   // 是否有来源页(不存全 URL)
      w: window.innerWidth,             // 视口宽,用于设备粗分
      props: props || {}
    };
    pushBuf(e);
    send(e);
  }

  // 稳定分桶(未来做真 A/B 时用):同一 cid + 实验名 → 恒定 'A'/'B'
  function variant(exp) {
    var s = CID + '|' + String(exp || ''), h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return (h & 1) ? 'B' : 'A';
  }

  // ?stats=1:内测自查面板——直接看本地缓存的漏斗计数,不依赖后端
  function showStats() {
    var a = buf(), counts = {};
    a.forEach(function (e) { counts[e.ev] = (counts[e.ev] || 0) + 1; });
    var rows = Object.keys(counts).sort().map(function (k) { return '  ' + k + ' × ' + counts[k]; }).join('\n');
    var recent = a.slice(-14).map(function (e) {
      var p = e.props && Object.keys(e.props).length ? '  ' + JSON.stringify(e.props) : '';
      return '  ' + new Date(e.t).toLocaleTimeString() + '  ' + e.ev + p;
    }).join('\n');
    var box = document.createElement('pre');
    box.style.cssText = 'position:fixed;left:0;right:0;bottom:0;max-height:55vh;overflow:auto;margin:0;z-index:99999;background:rgba(11,15,26,.94);color:#C9A85C;font:12px/1.55 ui-monospace,Menlo,monospace;padding:14px 16px;border-top:1px solid rgba(201,168,92,.55);white-space:pre-wrap';
    box.textContent = '📊 本地事件缓存 · cid ' + CID + ' · 端点 ' + (EP || '(未配置,仅本地)') + '\n共 ' + a.length + ' 条\n———— 计数 ————\n' + rows + '\n———— 最近 ————\n' + recent + '\n\n(点此关闭)';
    box.onclick = function () { box.remove(); };
    document.body.appendChild(box);
  }

  window.zxTrack = track;
  window.zxVariant = variant;

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  onReady(function () {
    track('page_view', { page: PAGE });
    if (qs.get('stats') === '1') showStats();
  });
})();
