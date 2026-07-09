/* member.js — 会员/账号前端(Phase B:微信绑定 + 云端同步)
 * ─────────────────────────────────────────────────────────────
 * · 匿名账号(zx_cid)先固化;点「微信登录」走公众号网页授权。回调只回传一次性 bindcode,
 *   由本页凭「本浏览器自己的会话 token」调 /wx/claim 完成绑定/合并 —— 杜绝 OAuth 登录 CSRF。
 * · 「云端同步」是显式开关:开启后才把出生资料上传到你的账号(换设备找回);关闭即停止上传并删除云端已存的盘。
 *   出生数据默认不出设备,只有你主动开同步 / 点问知星时才上传,与隐私弹窗一致。
 * · 账号控件渲染进页面里的 #zxAccount(无此元素则不渲染,不打扰版面)。
 * · API_BASE 留空 = 全部关闭(不影响页面);部署 serverless/api 后填其 URL。
 *   ⚠ 启用即每次加载创建匿名账号(只发随机 device_id,无出生信息);填此值时请给隐私文案补告知,
 *      并确保 /account/init、/collect 已在网关层加 IP 限流(见 serverless/README)。
 * ───────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var API_BASE = '';
  API_BASE = new URLSearchParams(location.search).get('api') || API_BASE;

  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } }
  function del(k) { try { localStorage.removeItem(k); } catch (_) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function cid() { var v = ls('zx_cid'); if (!v) { v = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); ls('zx_cid', v); } return v; }
  function getTok() { return ls('zx_token') || ''; }
  function cloudOn() { return ls('zx_cloud_sync') === '1'; }

  function api(path, opts) {
    if (!API_BASE) return Promise.reject(new Error('no api'));
    opts = opts || {};
    var h = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
    var tok = getTok(); if (tok) h['authorization'] = 'Bearer ' + tok;
    return fetch(API_BASE.replace(/\/$/, '') + path, {
      method: opts.method || 'GET', headers: h,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
        return d;
      });
    });
  }

  // bound 用本地提示做首屏乐观渲染,避免已绑用户先看到「登录」再闪成「已绑定」
  var state = { ready: false, memberUntil: null, bound: (ls('zx_bound') === '1') };

  // 从回调 fragment 接住一次性 bindcode(#bindcode=...),读出并把地址清干净
  function catchCallback() {
    var m = (location.hash || '').match(/bindcode=([a-f0-9]+)/);
    if (!m) return null;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { location.hash = ''; }
    return m[1];
  }

  function readLocalChart() { try { var s = JSON.parse(ls('zx_input') || 'null'); return (s && s.d) ? s : null; } catch (_) { return null; } }

  function refresh() {
    return api('/account/me').then(function (d) {
      state.memberUntil = d.member_until; state.bound = !!d.is_bound;
      ls('zx_bound', state.bound ? '1' : '0');
      render(); return d;
    }).catch(function () { render(); });   // 失败也重渲,避免留下过期状态
  }

  function init() {
    if (!API_BASE) return Promise.resolve(state);
    var bindcode = catchCallback();
    return api('/account/init', { method: 'POST', body: { device_id: cid() } })
      .then(function (d) { if (d.token) ls('zx_token', d.token); state.memberUntil = d.member_until; state.ready = true; })
      .then(function () {
        if (!bindcode) return;
        // 用本浏览器的会话 token 认领绑定;成功后换成合并账号的新 token
        return api('/wx/claim', { method: 'POST', body: { bindcode: bindcode } })
          .then(function (r) { if (r.token) ls('zx_token', r.token); if (window.zxTrack) zxTrack('member_bound'); })
          .catch(function () {});
      })
      .then(refresh)
      .catch(function () { return state; });
  }

  function login() {
    return api('/wx/login-url').then(function (d) { if (d.url) location.href = d.url; })
      .catch(function () { alert('微信登录暂不可用,请稍后再试。'); });
  }

  var M = window.zxMember = {
    ready: function () { return state.ready; },
    isMember: function () { return !!(state.memberUntil && state.memberUntil > Date.now()); },
    isBound: function () { return state.bound; },
    memberUntil: function () { return state.memberUntil; },
    cloudSyncOn: cloudOn,
    login: login,
    me: refresh,
    render: render,
    syncChart: function (payload) { return api('/charts/sync', { method: 'POST', body: { payload: payload } }); },
    loadChart: function () { return api('/charts').then(function (d) { return d.chart; }); },
    deepPeek: function () { return api('/deep/peek', { method: 'POST' }); },          // 只看不扣(前端预闸)
    deepConsume: function () { return api('/deep/consume', { method: 'POST' }); },   // 权威消费(供深问后端调,A 方案)
    deepRefund: function () { return api('/deep/refund', { method: 'POST' }); },     // 深问失败退回额度
    deepSave: function (question, answer) { return api('/deep/save', { method: 'POST', body: { question: question, answer: answer } }); },   // 会员:问答存档
    deepHistory: function () { return api('/deep/history').then(function (d) { return (d && d.items) || []; }); },
    openPaywall: function (r) { return showPaywall(r); },
    showPrivacy: function () { return showPrivacy(); },
    setCloudSync: function (on) {
      if (on) { ls('zx_cloud_sync', '1'); var p = readLocalChart(); if (p) M.syncChart(p).catch(function () {}); }
      else { del('zx_cloud_sync'); api('/charts', { method: 'DELETE' }).catch(function () {}); }   // 关闭即删除云端盘
      render();
    },
  };

  function injectStyle() {
    if (document.getElementById('zxaStyle')) return;
    var st = document.createElement('style'); st.id = 'zxaStyle';
    st.textContent = '.zxa{margin:14px 0;padding:12px 14px;border:1px solid rgba(201,168,92,.25);border-radius:8px;background:rgba(201,168,92,.04)}'
      + '.zxa-row{margin-bottom:8px}'
      + '.zxa-login{background:#07C160;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:13px;cursor:pointer;letter-spacing:.05em}'
      + '.zxa-ok{color:#7FA864;font-size:13px}'
      + '.zxa-sync{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mist,#9aa4b2);cursor:pointer}'
      + '.zxa-sync input{width:16px;height:16px;flex:none}'
      + '.zxa-note{font-size:11px;color:#6B7280;margin-top:6px;line-height:1.55}'
      + '.zxa-cta{display:inline-block;margin-top:10px;color:#C9A85C;font-size:12px;cursor:pointer;text-decoration:underline}'
      + '.zxm-link{color:#C9A85C;cursor:pointer;text-decoration:underline;font-size:12px}'
      + '.zxm-ov{position:fixed;inset:0;z-index:80;background:rgba(8,11,20,.86);display:flex;align-items:center;justify-content:center;padding:22px;overflow:auto}'
      + '.zxm-box{background:#141c30;border:1px solid rgba(201,168,92,.3);border-radius:12px;max-width:420px;width:100%;padding:24px 22px;color:#E8E4D8}'
      + '.zxm-box h3{color:#C9A85C;letter-spacing:.12em;font-size:17px;margin:0 0 8px}'
      + '.zxm-x{margin-top:16px;width:100%;background:transparent;border:1px solid rgba(201,168,92,.35);color:#C9A85C;border-radius:8px;padding:9px;cursor:pointer}'
      + '.zxp-plan{display:flex;gap:10px;margin:14px 0}'
      + '.zxp-card{flex:1;border:1px solid rgba(201,168,92,.3);border-radius:10px;padding:14px 10px;text-align:center;cursor:pointer;background:rgba(201,168,92,.04)}'
      + '.zxp-card.on{border-color:#C9A85C;background:rgba(201,168,92,.12)}'
      + '.zxp-card .p{font-size:24px;color:#C9A85C;font-weight:700}'
      + '.zxp-card .u{font-size:12px;color:#9aa4b2;margin-top:2px}'
      + '.zxp-b{font-size:13px;color:#b9c2d0;line-height:1.9;margin:6px 0 0;padding:0;list-style:none}'
      + '.zxp-go{margin-top:16px;width:100%;background:#C9A85C;color:#0E1220;border:0;border-radius:8px;padding:11px;font-size:15px;font-weight:700;cursor:pointer}';
    document.head.appendChild(st);
  }

  // 极简账号控件;仅在页面存在 #zxAccount 时渲染
  function render() {
    var mount = document.getElementById('zxAccount'); if (!mount) return;
    if (!API_BASE) { mount.innerHTML = ''; return; }
    injectStyle();
    var rows = [];
    if (state.bound) {
      rows.push('<div class="zxa-row"><span class="zxa-ok">✓ 已绑定微信 · 换设备可找回</span></div>');
    } else {
      rows.push('<div class="zxa-row"><button class="zxa-login" type="button">微信登录 · 换设备找回</button></div>');
      rows.push('<div class="zxa-note">微信登录会把你此前的匿名记录与微信身份关联,用于在新设备上找回你的盘;不收集姓名与联系方式。</div>');
    }
    rows.push('<label class="zxa-sync"><input type="checkbox"' + (cloudOn() ? ' checked' : '') + '> 云端同步(换设备也能找回你的盘)</label>');
    rows.push('<div class="zxa-note">开启后你的出生资料会保存到你的账号,仅用于换设备找回;关闭即停止上传并删除云端已存的盘。' + (state.bound ? '' : '建议先微信登录再开启。') + '</div>');
    if (M.isMember()) {
      rows.push('<div class="zxa-row zxa-ok" style="margin-top:10px">★ 会员有效期至 ' + new Date(state.memberUntil).toLocaleDateString() + '</div>');
      rows.push('<div style="margin-top:4px"><span class="zxm-link zxa-hist">我的问答存档</span></div>');
    } else {
      rows.push('<div><span class="zxa-cta zxa-open">开通会员 · 问知星不限次 →</span></div>');
    }
    rows.push('<div style="margin-top:8px"><span class="zxm-link zxa-priv">隐私说明</span></div>');
    mount.innerHTML = '<div class="zxa">' + rows.join('') + '</div>';
    var lb = mount.querySelector('.zxa-login'); if (lb) lb.onclick = function () { if (window.zxTrack) zxTrack('member_login_click'); login(); };
    var cb = mount.querySelector('.zxa-sync input'); if (cb) cb.onchange = function () { if (window.zxTrack) zxTrack('cloud_sync_toggle', { on: cb.checked ? 1 : 0 }); M.setCloudSync(cb.checked); };
    var ob = mount.querySelector('.zxa-open'); if (ob) ob.onclick = function () { showPaywall('cta'); };
    var pb = mount.querySelector('.zxa-priv'); if (pb) pb.onclick = function () { showPrivacy(); };
    var hb = mount.querySelector('.zxa-hist'); if (hb) hb.onclick = function () { showHistory(); };
  }

  // 会员:我的问答存档(列出本人历史问答)
  function showHistory() {
    var m = modal('<h3>我的问答存档</h3><div id="zxh-body" style="font-size:13px;color:#9aa4b2;max-height:52vh;overflow:auto">加载中…</div>');
    M.deepHistory().then(function (items) {
      var body = m.el.querySelector('#zxh-body'); if (!body) return;
      if (!items.length) { body.innerHTML = '还没有存档的问答。开通后每次深问都会自动存下。'; return; }
      body.innerHTML = items.map(function (it) {
        var a = it.answer || {}, d = new Date(it.created_at);
        var adv = (a.advice && a.advice.length) ? '<div style="color:#8f7a45;margin-top:4px">' + a.advice.map(function (x) { return '· ' + esc(x); }).join('<br>') + '</div>' : '';
        return '<div style="padding:12px 0;border-top:1px solid rgba(201,168,92,.15)">'
          + '<div style="color:#6B7280;font-size:11px">' + (d.getMonth() + 1) + '.' + d.getDate() + '</div>'
          + '<div style="color:#cdd3dd;margin-top:2px">你问:' + esc(it.question) + '</div>'
          + '<div style="color:#e9d09a;margin-top:4px">' + esc(a.reply || '') + '</div>' + adv + '</div>';
      }).join('');
    }).catch(function () { var b = m.el.querySelector('#zxh-body'); if (b) b.innerHTML = '加载失败,稍后再试。'; });
  }

  // ── Phase D:会员墙 / 定价 / 隐私说明(前端;支付通道 Phase C 接) ──
  // ⚠ 上线前把 PLANS 价格改成你的真实定价(单位:元)。
  var PLANS = { year: { price: 98, label: '年卡', per: '约 ¥8.2/月' }, month: { price: 18, label: '月卡', per: '' } };
  var BENEFITS = ['问知星 · 不限次深问', '问答自动存档 · 换设备可查'];   // 先聚焦问答;每日签深读暂缓
  var selPlan = 'year';

  function modal(html, onClose) {
    injectStyle();
    var ov = document.createElement('div'); ov.className = 'zxm-ov';
    ov.innerHTML = '<div class="zxm-box">' + html + '<button class="zxm-x" type="button">关闭</button></div>';
    var closed = false;
    function close() { if (closed) return; closed = true; ov.remove(); if (onClose) onClose(); }   // 任意关闭路径(X/点背景)都触发 onClose
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.zxm-x').onclick = close;
    document.body.appendChild(ov);
    return { el: ov, close: close };
  }

  function showPaywall(reason) {
    selPlan = 'year';   // 每次打开重置为默认套餐,保证 paywall_view 时选中态确定
    if (window.zxTrack) zxTrack('paywall_view', { reason: reason || 'cta' });
    var cards = Object.keys(PLANS).map(function (k) {
      var p = PLANS[k];
      return '<div class="zxp-card' + (k === selPlan ? ' on' : '') + '" data-plan="' + k + '"><div class="p">¥' + p.price + '</div><div class="u">' + p.label + (p.per ? ' · ' + p.per : '') + '</div></div>';
    }).join('');
    var benefits = '<ul class="zxp-b">' + BENEFITS.map(function (b) { return '<li>· ' + b + '</li>'; }).join('') + '</ul>';
    var m = modal('<h3>开通会员</h3><div class="zxp-plan">' + cards + '</div>' + benefits
      + '<button class="zxp-go" type="button">开通 ' + PLANS[selPlan].label + '</button>'
      + '<div style="margin-top:10px;text-align:center"><span class="zxm-link zxp-priv">隐私说明</span></div>');
    function refresh() {
      m.el.querySelector('.zxp-go').textContent = '开通 ' + PLANS[selPlan].label;
      var cs = m.el.querySelectorAll('.zxp-card');
      for (var i = 0; i < cs.length; i++) cs[i].classList.toggle('on', cs[i].getAttribute('data-plan') === selPlan);
    }
    var cs = m.el.querySelectorAll('.zxp-card');
    for (var i = 0; i < cs.length; i++) cs[i].onclick = function () {
      var np = this.getAttribute('data-plan');
      if (np === selPlan) return;               // 只在真正切换套餐时上报,避免灌水
      selPlan = np;
      if (window.zxTrack) zxTrack('plan_select', { plan: selPlan });
      refresh();
    };
    m.el.querySelector('.zxp-go').onclick = function () { startCheckout(selPlan, m); };
    m.el.querySelector('.zxp-priv').onclick = function () { showPrivacy(); };
    return m;
  }

  function startCheckout(plan, paywall) {
    if (window.zxTrack) zxTrack('pay_start', { plan: plan });
    if (!API_BASE) { alert('支付通道即将开放,敬请期待。'); return; }
    api('/order/create', { method: 'POST', body: { plan: plan } })
      .then(function (d) { showPayModal(d.code_url, d.out_trade_no, plan, paywall); })
      .catch(function (e) {
        if (/pay not configured|HTTP 503/.test(e.message)) alert('支付通道即将开放,敬请期待。');
        else alert('下单失败:' + e.message);
      });
  }

  // 微信扫码支付:展示 code_url(二维码渲染待接,先给可扫链接)+ 轮询订单状态,paid → pay_success
  function showPayModal(codeUrl, outTradeNo, plan, paywall) {
    var stopped = false;
    var m = modal('<h3>微信扫码支付</h3>'
      + '<p style="font-size:13px;color:#b9c2d0">开通 ' + PLANS[plan].label + ' · ¥' + PLANS[plan].price + '</p>'
      + '<div style="text-align:center;margin:14px 0;padding:16px;border:1px dashed rgba(201,168,92,.4);border-radius:8px;font-size:12px;color:#8f7a45;word-break:break-all">二维码待接;支付链接:<br>' + codeUrl + '</div>'
      + '<div id="zxpay-status" style="text-align:center;color:#9aa4b2;font-size:13px">等待支付…</div>',
      function () { stopped = true; });   // 关闭(X/点背景)即停止轮询
    var tries = 0;
    (function poll() {
      if (stopped) return;
      if (++tries > 60) { var s0 = m.el.querySelector('#zxpay-status'); if (s0) s0.textContent = '已超时;若已支付,稍后刷新页面即可。'; return; }
      api('/order/status?out_trade_no=' + encodeURIComponent(outTradeNo)).then(function (d) {
        if (stopped) return;
        if (d.status === 'paid') {
          if (window.zxTrack) zxTrack('pay_success', { plan: plan });
          var s = m.el.querySelector('#zxpay-status'); if (s) s.textContent = '✓ 支付成功,会员已开通';
          if (paywall) paywall.close();   // 支付成功一并关掉底层会员墙,不再劝购
          refresh(); setTimeout(m.close, 1500);
        } else { setTimeout(poll, 3000); }
      }).catch(function () { setTimeout(poll, 4000); });
    })();
  }

  function deleteAccount() {
    if (!API_BASE) return;
    if (!confirm('确定注销账号并删除全部数据?此操作不可恢复。')) return;
    api('/account', { method: 'DELETE' }).then(function () {
      try { localStorage.removeItem('zx_token'); localStorage.removeItem('zx_bound'); localStorage.removeItem('zx_cloud_sync'); } catch (_) {}
      state.bound = false; state.memberUntil = null;
      alert('账号已注销,数据已删除。'); render();
    }).catch(function (e) { alert('注销失败:' + e.message); });
  }

  function showPrivacy() {
    var del = API_BASE ? '<div style="margin-top:16px;text-align:center"><span class="zxm-link zxp-del" style="color:#C96A4A">注销账号并删除全部数据</span></div>' : '';
    var m = modal('<h3>隐私说明</h3><div style="font-size:13px;line-height:1.75;color:#b9c2d0">'
      + '<p><b>收集什么</b>:你填写的出生资料(日期/时间/城市)、一个随机匿名设备标识;若你微信登录,则含微信 openid。<b>从不收集姓名与联系方式。</b></p>'
      + '<p><b>发去哪</b>:①「问知星」——点击时把命盘与本次问答内容发往云端服务器、交第三方大模型解读,仅用于生成该次回答,不留存;②「云端同步」(需手动开启)——出生资料存到你的账号,用于换设备找回;③匿名埋点——仅记录行为事件与一个随机匿名标识(用于区分会话与去重),不含出生信息与问题原文,不采集 IP 与 User-Agent。</p>'
      + '<p><b>留存与删除</b>:问知星回答不留存;云端同步的盘可在报告页关闭同步即删除;账号信息(随机设备标识、微信 openid、会员到期)会持续保留,可随时在下方自助注销并删除全部数据。</p>'
      + '</div>' + del);
    var db = m.el.querySelector('.zxp-del'); if (db) db.onclick = function () { m.close(); deleteAccount(); };
  }

  init();
})();
