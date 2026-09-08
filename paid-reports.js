/* Private report client. Only server-owned snapshots confer access.
 * The source preview stays local by default. No report text is persisted here.
 */
(function () {
  'use strict';
  var REPORT_RE = /^[a-f0-9]{48}$/;
  var ORDER_RE = /^[a-f0-9]{32}$/;
  var RESUME_KEY = 'zx_private_report_resume_id';
  // The report price is confirmed separately from purchase approval. The old
  // Ask agreement and report candidate cannot authorize a new purchase.
  var APPROVED_REPORT_POLICY = null;
  var generation = 0;
  var accountPending = null;
  function localPage() { return location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); }
  function isPrivate() { return window.ZX_PRIVATE_REPORT_BUILD === true || (localPage() && new URLSearchParams(location.search).get('private-report') === '1'); }
  function error(code) { var e = new Error(code); e.code = code; return e; }
  function checkedId(id) { if (typeof id !== 'string' || !REPORT_RE.test(id)) throw error('REPORT_NOT_FOUND'); return id; }
  function reportId() {
    var values = new URLSearchParams(location.search).getAll('report');
    return values.length === 1 && REPORT_RE.test(values[0]) ? values[0] : '';
  }
  function member() { if (!window.zxMember) throw error('REPORT_SERVICE_UNAVAILABLE'); return window.zxMember; }
  function call(method, args) {
    return Promise.resolve().then(function () {
      if (!isPrivate()) throw error('REPORT_SERVICE_UNAVAILABLE');
      var client = member();
      if (typeof client[method] !== 'function') throw error('REPORT_SERVICE_UNAVAILABLE');
      return client[method].apply(client, args || []);
    });
  }
  function route(file, id, hash) {
    var source = /\/(web|v1)\/[^/]*$/.test(location.pathname);
    var path = source ? (file === 'report' ? '../v1/report.html' : '../web/' + (file === 'home' ? 'index' : file) + '.html') : './' + (file === 'home' ? 'app' : file) + '.html';
    var url = new URL(path, location.href);
    if (id) url.searchParams.set('report', checkedId(id));
    if (localPage() && isPrivate()) {
      url.searchParams.set('private-report', '1');
      ['api','deep'].forEach(function (name) {
        var value = new URLSearchParams(location.search).get(name);
        if (!value) return;
        try {
          var endpoint = new URL(value);
          if (/^https?:$/.test(endpoint.protocol) && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(endpoint.hostname) && !endpoint.username && !endpoint.password && !endpoint.search && !endpoint.hash) url.searchParams.set(name, endpoint.href.replace(/\/$/, ''));
        } catch (_) {}
      });
      if (new URLSearchParams(location.search).get('deepMode') === 'mock') url.searchParams.set('deepMode', 'mock');
    }
    if (hash) url.hash = hash;
    return url.href;
  }
  function reportUrl(id) { return route('report', checkedId(id)); }
  function loginUrl(id) { return route('account', id, 'account-status'); }
  function homeUrl() { return route('home'); }
  function checkoutReport(id) { window.location.assign(route('account', checkedId(id), 'report-purchase')); }
  function checkoutUrl(orderNo, id) {
    if (!ORDER_RE.test(orderNo)) throw error('PAYMENT_ORDER_NOT_FOUND');
    var url = new URL(route('checkout', id)); url.searchParams.set('order', orderNo); return url.href;
  }
  function priceLabel(offer) {
    return offer && offer.currency === 'CNY' && Number.isSafeInteger(offer.amount_fen) && offer.amount_fen > 0 && offer.amount_fen <= 1000000
      ? '¥' + (offer.amount_fen / 100).toFixed(2) : '';
  }
  function purchaseReady() { return APPROVED_REPORT_POLICY !== null; }
  function consent() { return !!(window.ZxPrivacyConsent && window.ZxPrivacyConsent.has('device_account')); }
  function ownedCall(method, args) {
    return Promise.resolve().then(function () {
      if (!isPrivate() || !member().serviceConfigured()) throw error('REPORT_SERVICE_UNAVAILABLE');
      if (!consent()) throw error('PRIVACY_CONSENT_REQUIRED');
      return member().freshAccessToken();
    }).then(function () { return member()[method].apply(member(), args || []); });
  }
  function message(e) {
    var code = String(e && e.code || '');
    if (code === 'PRIVACY_CONSENT_REQUIRED') return '请先确认在当前设备启用账号功能，再登录原微信账号。';
    if (/AUTH|SESSION|TOKEN/.test(code) || e && e.status === 401) return '请登录原微信账号后再查看。';
    if (/NOT_FOUND|NOT_OWNED/.test(code) || e && e.status === 403) return '当前账号无法查看这份报告。';
    if (/SERVICE_UNAVAILABLE|NOT_CONFIGURED/.test(code)) return '报告服务尚未开放，可先返回首页查看基础解读。';
    if (/SALES_NOT_APPROVED/.test(code)) return '购买尚未开放，请稍后再来。';
    return '暂时无法读取，请稍后重试。';
  }
  function $(id) { return document.getElementById(id); }
  function text(id, value) { var n = $(id); if (n) n.textContent = String(value == null ? '' : value); }
  function empty(id) { var n = $(id); if (n) n.replaceChildren(); return n; }
  function hide(id, value) { var n = $(id); if (n) n.hidden = value !== false; }
  function node(tag, value, className) { var n = document.createElement(tag); if (value) n.textContent = value; if (className) n.className = className; return n; }
  function link(label, href) { var n = node('a', label, 'btn'); n.href = href; return n; }
  function button(label, action) { var n = node('button', label, 'btn'); n.type = 'button'; n.addEventListener('click', action); return n; }
  function append(id, child) { if ($(id)) $(id).append(child); }
  function readableState(item) {
    if (item.entitlement_status === 'revoked') return '权益已撤销';
    if (item.entitlement_status !== 'active') return '尚未购买';
    if (item.delivery_status === 'ready' && item.readable) return '可以阅读';
    if (item.delivery_status === 'failed') return '报告待重试';
    return '报告准备中';
  }
  function privacyReset() {
    generation += 1;
    ['reportList','orderList','privatePurchaseActions','checkoutActions','checkoutServiceLinks'].forEach(empty);
    text('reportCount', '—'); text('reportLive', '请重新登录后查看报告。');
    text('orderBadge', '需登录'); text('orderStateTitle', '登录后查看订单'); hide('orderStateTitle', false); text('orderStateBody', '登录后可查询支付与交付状态。');
    text('accountBadge', '未登录'); text('accountTitle', '请登录原微信账号'); text('accountBody', '已退出当前账号，报告内容已从页面清除。');
    text('privatePurchaseBody', '请登录后查看这份报告的状态。');
    ['checkoutProduct','checkoutAmount','checkoutOrderNo','checkoutCreatedAt','checkoutExpiresAt','checkoutCredits'].forEach(function (id) { text(id, ''); });
    hide('checkoutDetails'); text('checkoutTitle', '请登录原微信账号'); text('checkoutBody', '订单详情已从当前页面清除。'); text('checkoutNotice', '登录后可继续查询订单。');
  }
  window.addEventListener('zx-private-session-cleared', privacyReset);
  function authenticated() { var state = member().snapshot(); return state.authenticated === true && state.identityKind === 'wechat' && /^[a-f0-9]{64}$/.test(state.accountRef || ''); }
  async function startLogin(id) {
    if (!consent()) throw error('PRIVACY_CONSENT_REQUIRED');
    if (!/MicroMessenger/i.test(navigator.userAgent || '')) throw error('WECHAT_BROWSER_REQUIRED');
    var config = window.ZX_PUBLIC_CONFIG || {};
    if (!/^wx[0-9a-f]{16}$/i.test(config.wechatOfficialAccountAppId || '') || !member().serviceConfigured()) throw error('REPORT_SERVICE_UNAVAILABLE');
    var data = await member().wechatOAuthStart('/account.html');
    var target, redirect, base;
    try {
      target = new URL(data.authorize_url); redirect = new URL(target.searchParams.get('redirect_uri')); base = new URL(config.accountApiBase);
      if (target.origin !== 'https://open.weixin.qq.com' || target.pathname !== '/connect/oauth2/authorize' || target.username || target.password || target.hash !== '#wechat_redirect' ||
          target.searchParams.get('appid') !== config.wechatOfficialAccountAppId || target.searchParams.get('scope') !== 'snsapi_base' || target.searchParams.get('response_type') !== 'code' ||
          !/^[A-Za-z0-9._~-]{16,512}$/.test(target.searchParams.get('state') || '') || ['appid','redirect_uri','response_type','scope','state'].some(function (key) { return target.searchParams.getAll(key).length !== 1; }) ||
          base.protocol !== 'https:' || !/(^|\.)zhixng\.cn$/.test(base.hostname) || redirect.origin !== base.origin || redirect.pathname !== '/auth/wechat/oauth/callback' || redirect.search || redirect.hash || redirect.username || redirect.password ||
          !Number.isFinite(Number(data.expires_at)) || Number(data.expires_at) <= Date.now()) throw new Error('invalid');
    } catch (_) { throw error('WECHAT_OAUTH_RESPONSE_INVALID'); }
    try { if (id) sessionStorage.setItem(RESUME_KEY, checkedId(id)); else sessionStorage.removeItem(RESUME_KEY); } catch (_) {}
    window.location.assign(target.href);
  }
  function restoreLoginReport() {
    if (reportId() || new URLSearchParams(location.search).get('wechat_bind') !== 'success') return;
    try {
      var id = sessionStorage.getItem(RESUME_KEY); sessionStorage.removeItem(RESUME_KEY);
      if (REPORT_RE.test(id || '')) {
        var url = new URL(location.href); url.searchParams.set('report', id); window.history.replaceState(null, '', url.href);
      }
    } catch (_) {}
  }
  function renderLogin() {
    text('accountBadge', '未登录'); text('accountTitle', '登录原微信账号');
    text('accountBody', '登录后可找回已购报告。返回首页时，请重新确认需要保存的盘面。');
    var actions = empty('accountActions'); if (!actions) return;
    var check;
    if (!consent()) {
      var label = node('label', '', 'confirm-check'); check = node('input'); check.type = 'checkbox';
      label.append(check, node('span', '我同意在当前设备启用账号功能，用于登录和读取我的报告。')); actions.append(label);
    }
    var login = button('微信登录', async function () {
      if (check && !check.checked) return;
      login.disabled = true;
      try {
        if (check) window.ZxPrivacyConsent.grant('device_account');
        await startLogin(reportId());
      } catch (e) { text('accountBody', e.code === 'WECHAT_BROWSER_REQUIRED' ? '请在微信内打开本页，使用原微信账号登录。' : message(e)); }
      finally { login.disabled = !!check && !check.checked; }
    });
    login.disabled = !!check;
    if (check) check.addEventListener('change', function () { login.disabled = !check.checked; });
    actions.append(login, link('返回首页', homeUrl()));
  }
  function purchasePanel() {
    if (!$('profile-summary')) return;
    if (!$('report-purchase')) {
      var panel = node('section', '', 'panel panel-wide'); panel.id = 'report-purchase';
      var title = node('h2', '完整深度报告'); var body = node('p', '', 'state-body'); body.id = 'privatePurchaseBody';
      var actions = node('div', '', 'actions'); actions.id = 'privatePurchaseActions'; panel.append(title, body, actions);
      $('profile-summary').after(panel);
    }
    hide('report-purchase', !reportId());
    text('privatePurchaseBody', '登录后可查看这份报告。'); empty('privatePurchaseActions');
  }
  async function renderPurchase(epoch) {
    var id = reportId(); if (!id) return;
    try {
      var state = await api.status(id); if (epoch !== generation) return;
      text('privatePurchaseBody', readableState(state));
      if (state.entitlement_status === 'active') {
        append('privatePurchaseActions', link('进入这份报告', reportUrl(id)));
        var balance;
        try { balance = await api.balance(id); }
        catch (_) { if (epoch === generation) text('privatePurchaseBody', readableState(state) + ' · 问星次数暂时无法读取'); return; }
        if (epoch !== generation) return;
        var remaining = balance && balance.remaining;
        if (Number.isInteger(remaining) && remaining >= 0) text('privatePurchaseBody', readableState(state) + ' · 本盘可用问星 ' + remaining + ' 次');
      } else if (state.entitlement_status === 'unpaid') {
        var catalog = await api.products(id); if (epoch !== generation) return;
        var report = (catalog.products || []).find(function (item) { return item.product_code === 'deep_report_v1'; });
        var price = priceLabel(report);
        text('privatePurchaseBody', price ? price + ' · 赠送1次问星。根据你的盘面对知星进行任意提问解读。购买暂未开放。'
          : '完整报告尚未开放购买。赠送1次问星，根据你的盘面对知星进行任意提问解读。');
        var closed = button('暂未开放购买', function () {}); closed.disabled = true; append('privatePurchaseActions', closed);
      }
    } catch (e) { if (epoch === generation) text('privatePurchaseBody', message(e)); }
  }
  async function renderReportPage(epoch, before) {
    var result = await api.list(before ? {before:before} : undefined); if (epoch !== generation) return;
    var list = $('reportList'); if (!list) return;
    if (!before) list.replaceChildren();
    (result.items || []).forEach(function (item) {
      if (!REPORT_RE.test(item.report_id || '')) return;
      var row = node('article', '', 'report-item');
      var content = node('div'); content.append(node('strong', item.title || '深度发展报告'), node('p', readableState(item), 'state-body'));
      var actions = node('div', '', 'report-item-actions');
      actions.append(link(item.entitlement_status === 'unpaid' ? '查看报告状态' : '进入报告', item.entitlement_status === 'unpaid' ? route('account', item.report_id, 'report-purchase') : reportUrl(item.report_id)));
      row.append(content, actions); list.append(row);
    });
    text('reportCount', String(list.children.length) + ' 份');
    if (!list.children.length) list.append(node('p', '还没有已购报告。可返回首页选择并确认盘面。', 'report-empty'));
    empty('reportLive');
    if (Number.isSafeInteger(result.next_before) && result.next_before > 0) {
      append('reportLive', button('加载更多', async function () { try { await renderReportPage(epoch, result.next_before); } catch (e) { if (epoch === generation) text('reportLive', message(e)); } }));
    }
  }
  async function renderOrders(epoch) {
    try {
      var result = await ownedCall('paymentOrders'); if (epoch !== generation) return;
      var list = empty('orderList');
      var orders = Array.isArray(result) ? result : result.orders || result.items || [];
      orders.forEach(function (order) {
        if (!list || !ORDER_RE.test(order.order_no || '')) return;
        var row = node('article', '', 'order-item');
        row.append(node('span', (order.product_code === 'deep_report_v1' ? '完整深度报告' : '问星次数') + ' · ' + String(order.order_no)), link('查看订单', checkoutUrl(order.order_no, REPORT_RE.test(order.paid_report_id || '') ? order.paid_report_id : undefined))); list.append(row);
      });
      text('orderBadge', String(orders.length) + ' 笔'); hide('orderStateTitle', orders.length > 0); text('orderStateTitle', orders.length ? '' : '暂无订单'); text('orderStateBody', '支付与交付状态以订单查询结果为准。');
    } catch (e) { if (epoch === generation) text('orderStateBody', message(e)); }
  }
  function mountAccount() {
    if (!isPrivate() || !$('profile-summary')) return Promise.resolve();
    if (accountPending) return accountPending;
    var epoch = ++generation;
    accountPending = (async function () {
      restoreLoginReport();
      ['membership-status','member-upgrade','cloud-sync','daily-qian','qa-archive','local-data','delete-account','saveReportDialog','renameDialog'].forEach(function (id) { hide(id); });
      var identity = document.querySelector('.profile-identity'); if (identity) identity.hidden = true;
      var reportHeading = document.querySelector('#profile-summary .panel-title'); if (reportHeading) reportHeading.textContent = '我的报告';
      hide('reportLibraryTitle'); text('reportLibraryTitle', '我的报告'); text('profileBadge', '账号报告'); text('reportCount', '—'); empty('reportList');
      var back = $('reportLink'); if (back) { back.href = reportId() ? reportUrl(reportId()) : homeUrl(); back.textContent = reportId() ? '返回当前报告' : '返回首页'; }
      if ($('newReportLink')) $('newReportLink').href = homeUrl(); purchasePanel();
      if (!window.zxMember || !member().serviceConfigured()) { text('reportLive', '报告服务尚未开放。'); renderLogin(); return; }
      if (!consent()) { text('reportLive', '登录后查看报告。'); renderLogin(); return; }
      try { await member().whenReady(); } catch (_) {}
      if (epoch !== generation) return;
      if (!authenticated()) { text('reportLive', '登录后查看报告。'); renderLogin(); return; }
      text('accountBadge', '已登录'); text('accountTitle', '微信账号已确认'); text('accountBody', '报告与问星归属当前微信账号。返回首页可继续确认本机盘面。');
      var actions = empty('accountActions'); if (actions) actions.append(link('返回首页', homeUrl()), button('退出登录', async function () { await member().logout(); await mountAccount(); }));
      await Promise.all([renderReportPage(epoch).catch(function (e) { if (epoch === generation) text('reportLive', message(e)); }), renderPurchase(epoch), renderOrders(epoch)]);
    })().finally(function () { accountPending = null; });
    return accountPending;
  }
  async function mountCheckout() {
    if (!isPrivate() || !$('paidCheckoutPage')) return;
    var epoch = ++generation; var params = new URLSearchParams(location.search); var values = params.getAll('order');
    var orderNo = values.length === 1 && ORDER_RE.test(values[0]) ? values[0] : '';
    empty('checkoutActions'); hide('checkoutDetails'); hide('checkoutRefundNotice'); hide('checkoutCountdown'); hide('checkoutRecoveryNote', false);
    text('checkoutNotice', '支付与报告交付以服务端查询结果为准。');
    if (!orderNo) { text('checkoutBadge', '无订单'); text('checkoutTitle', '没有可恢复的订单'); text('checkoutBody', '请到我的订单查看。'); append('checkoutActions', link('返回我的账户', loginUrl(reportId()))); return; }
    try {
      if (!consent()) throw error('PRIVACY_CONSENT_REQUIRED');
      await member().whenReady(); if (epoch !== generation) return;
      if (!authenticated()) throw error('WECHAT_AUTHENTICATION_REQUIRED');
      var result = await ownedCall('paymentOrder', [orderNo]); if (epoch !== generation) return;
      var order = result.order || result;
      if (order.order_no !== orderNo) throw error('ORDER_RESPONSE_INVALID');
      var id = REPORT_RE.test(order.paid_report_id || '') ? order.paid_report_id : '';
      var paid = order.provider_trade_state === 'SUCCESS' && Number(order.paid_at) > 0;
      var done = paid && order.status === 'completed';
      text('checkoutProduct', order.product_code === 'deep_report_v1' ? '完整深度报告' : '本盘问星次数');
      text('checkoutAmount', priceLabel(order) || '—');
      text('checkoutOrderNo', order.order_no); text('checkoutCreatedAt', order.created_at ? new Date(Number(order.created_at)).toLocaleString('zh-CN') : '—'); text('checkoutExpiresAt', order.expires_at ? new Date(Number(order.expires_at)).toLocaleString('zh-CN') : '—');
      text('checkoutCredits', order.status === 'refunded' ? '本单退款已完成' : done ? '以对应报告内可用次数为准' : '等待服务端交付'); hide('checkoutDetails', false);
      if (done && id) {
        text('checkoutBadge', '已完成'); text('checkoutTitle', '支付与交付已确认'); text('checkoutBody', '可返回对应报告继续阅读。');
        append('checkoutActions', link('返回这份报告', reportUrl(id) + (order.product_code === 'deep_report_v1' ? '' : '#sec-deep')));
      } else if (paid && order.status === 'entitlement_pending' && id) {
        text('checkoutBadge', '已付款'); text('checkoutTitle', '报告正在准备'); text('checkoutBody', '已确认收款，请勿重复付款。可进入报告查看交付状态并重试。');
        append('checkoutActions', link('查看报告状态', reportUrl(id)));
      } else {
        text('checkoutBadge', order.status === 'manual_review' ? '人工核验' : order.status === 'refunded' ? '已退款' : '待确认');
        text('checkoutTitle', order.status === 'manual_review' ? '订单需要人工核验' : order.status === 'refunded' ? '退款已完成' : '订单状态待确认');
        text('checkoutBody', order.status === 'refunded' ? '退款已完成，可返回我的订单查看记录。'
          : paid ? '已确认收款，请到订单售后核对当前处理状态。' : '当前购买尚未开放。本页不会发起付款，也不会根据浏览器支付提示发放权益。');
      }
      append('checkoutActions', button('刷新订单状态', mountCheckout)); append('checkoutActions', link('返回我的订单', route('account', id, 'order-center')));
    } catch (e) {
      if (epoch !== generation) return;
      text('checkoutBadge', '暂不可用'); text('checkoutTitle', '暂时无法读取订单'); text('checkoutBody', message(e));
      append('checkoutActions', link('登录并查看订单', loginUrl(reportId())));
    }
  }
  var api = Object.freeze({
    isPrivate:isPrivate, reportId:reportId, reportUrl:reportUrl, loginUrl:loginUrl, homeUrl:homeUrl, checkoutReport:checkoutReport, checkoutUrl:checkoutUrl,
    preview:function (input, confirmation) { return call('paidReportPreview', [input,confirmation]); },
    prepare:function (input, confirmation) { return call('paidReportPrepare', [input,confirmation]); },
    list:function (options) { return call('paidReportList', [options]); },
    read:function (id) { return call('paidReportRead', [id]); },
    status:function (id) { return call('paidReportRead', [id,'status']); },
    retry:function (id) { return call('paidReportRetry', [id]); },
    balance:function (id) { return call('paidReportBalance', [id]); },
    products:function (id,kind) { return call('paidReportProducts', [id,kind || 'report']); },
    priceLabel:priceLabel, purchaseReady:purchaseReady, startLogin:startLogin, mountAccount:mountAccount, mountCheckout:mountCheckout
  });
  window.ZxPaidReports = api;
  window.addEventListener('pageshow', function (event) {
    if (event.persisted && isPrivate()) { privacyReset(); if ($('paidCheckoutPage')) mountCheckout(); else if ($('profile-summary')) mountAccount(); }
  });
})();
