/* Account handoff UI only. Never authenticates, accepts consent, or creates orders. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  if (!$('profile-account')) return;
  const key = 'zx_ui_continuation_v1';
  const maxAge = 30 * 60 * 1000;
  let intent = null;
  let observing = false;
  const state = () => window.zxMember?.snapshot?.() || {};
  const available = () => window.zxMember?.serviceConfigured?.() === true;
  const ready = () => available() && state().authenticated === true && state().identityKind === 'wechat' && window.ZxPrivacyConsent?.has?.('device_account') === true;
  function remember(value) {
    intent = value;
    try { if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key); } catch (_) {}
  }
  try {
    const stored = JSON.parse(sessionStorage.getItem(key));
    const validTarget = stored?.kind === 'shared' || /^[a-f0-9]{32}$/.test(stored?.chart || '') || /^[a-f0-9]{48}$/.test(stored?.report || '');
    if (stored && validTarget && ['purchase', 'shared'].includes(stored.kind) && Number.isFinite(stored.at) && Date.now() - stored.at >= 0 && Date.now() - stored.at < maxAge) intent = stored;
  } catch (_) {}
  const params = new URLSearchParams(location.search);
  if (params.getAll('ui-intent').length === 1 && params.get('ui-intent') === 'purchase') {
    const chart = params.getAll('chart').length === 1 && /^[a-f0-9]{32}$/.test(params.get('chart') || '') ? params.get('chart') : '';
    const report = params.getAll('report').length === 1 && /^[a-f0-9]{48}$/.test(params.get('report') || '') ? params.get('report') : '';
    if (!!chart !== !!report) remember({ kind: 'purchase', chart, report, at: Date.now() });
    const url = new URL(location.href);
    url.searchParams.delete('ui-intent');
    history.replaceState(history.state, '', url.href);
  }
  function focusAccount() {
    $('profile-account').open = true;
    const account = $('zx-account-continuation') || $('account-status');
    account.scrollIntoView({ block: 'start', behavior: 'instant' });
    const title = $('accountTitle');
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
  function currentChartMatches() {
    if (intent?.kind !== 'purchase') return true;
    const link = document.querySelector('.chart-library-item.is-current .chart-library-actions a');
    if (!link) return false;
    const target = new URL(link.href).searchParams;
    if (!intent.chart) return !!intent.report && target.get('report') === intent.report;
    if (target.get('chart') === intent.chart) return true;
    // The original local chart may already have become an owned paid report.
    try {
      const linked = window.ZxChartVault?.resolvedPaidLink?.(intent.chart, state().accountRef);
      return !!linked && linked.accountRef === state().accountRef && linked.reportId === target.get('report');
    } catch (_) { return false; }
  }
  function sync() {
    observer.disconnect();
    try {
      const enabled = ready();
      const shared = $('synastry-action');
      let note = $('zx-shared-account-note');
      if (shared && !note) {
        note = document.createElement('p');
        note.id = 'zx-shared-account-note';
        note.className = 'zx-journey-note';
        shared.before(note);
        shared.setAttribute('aria-describedby', note.id);
      }
      if (note) {
        note.hidden = enabled;
        note.textContent = available() ? '登录原微信账号后，查看你已有的共同解读。' : '账号服务暂不可用，请稍后再试。';
      }
      let continuation = $('zx-account-continuation');
      if (intent && Date.now() - intent.at >= maxAge) remember(null);
      if (!intent) { continuation?.remove(); return; }
      if (!continuation) {
        continuation = document.createElement('section');
        continuation.id = 'zx-account-continuation';
        continuation.className = 'zx-account-continuation';
        continuation.setAttribute('aria-labelledby', 'zx-continuation-title');
        continuation.innerHTML = '<h3 id="zx-continuation-title"></h3><p></p><div><button class="button primary" type="button"></button><button class="text-button" type="button">取消继续</button></div>';
        $('account-status').before(continuation);
        continuation.querySelector('.primary').addEventListener('click', () => {
          if (!intent || Date.now() - intent.at >= maxAge || Date.now() < intent.at) { remember(null); sync(); return; }
          if (!ready()) return focusAccount();
          if (intent?.kind === 'purchase') {
            if (!currentChartMatches()) return;
            $('report-action')?.click();
          } else $('synastry-action')?.click();
          remember(null);
          sync();
        });
        continuation.querySelector('.text-button').addEventListener('click', () => { remember(null); sync(); });
      }
      const purchase = intent.kind === 'purchase';
      const matched = !purchase || currentChartMatches();
      continuation.querySelector('h3').textContent = purchase ? '继续购买深度报告' : '继续查看共同解读';
      continuation.querySelector('p').textContent = !enabled
        ? purchase ? '先完成下方账号确认和微信登录。登录后，可在这里继续，不会自动下单或扣费。' : '先完成下方账号确认和微信登录，再继续查看已有的共同解读。不会自动发送邀请或生成新记录。'
        : !matched ? '当前图谱与刚才选择的不一致，请先在“我的图谱”选回原图谱，再继续。'
        : purchase ? '请继续核对当前图谱与购买信息。只有再次确认后，才会进入原有购买流程。' : '账号已就绪，可以继续打开你的共同解读记录。';
      const button = continuation.querySelector('.primary');
      button.hidden = !enabled;
      button.disabled = !matched;
      button.textContent = purchase ? '继续核对购买信息' : '查看共同解读';
    } finally {
      if (observing) observer.observe($('main'), { childList: true, subtree: true });
    }
  }
  const observer = new MutationObserver(sync);
  $('synastry-action')?.addEventListener('click', event => {
    if (ready() || !available()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    remember({ kind: 'shared', at: Date.now() });
    sync();
    focusAccount();
  }, true);
  const brand = document.querySelector('.topbar .brand svg');
  if (brand) {
    const image = document.createElement('img');
    image.src = './media/static-home/approved-symbol.png';
    image.width = 34; image.height = 34; image.alt = '';
    brand.replaceWith(image);
  }
  // Keep native social error handling; normalize only the record-view heading.
  const dialogObserver = new MutationObserver(() => {
    if ($('social-title')?.textContent === '合盘记录') $('social-title').textContent = '共同解读';
  });
  function start() {
    if (observing) return;
    observing = true;
    sync();
    if ($('social-detail')) dialogObserver.observe($('social-detail'), { childList: true, subtree: true });
    if (intent) focusAccount();
  }
  window.addEventListener('pagehide', () => { observing = false; observer.disconnect(); dialogObserver.disconnect(); });
  window.addEventListener('pageshow', () => { start(); if (intent) focusAccount(); });
  window.addEventListener('zx-private-session-cleared', () => { remember(null); sync(); });
  start();
})();
