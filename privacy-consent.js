/* privacy-consent.js — 知星前端隐私选择与本机资料控制
 * 只记录用户在当前浏览器中的选择；不把同意本身上传到服务端。
 */
(function () {
  'use strict';

  var NOTICE_VERSION = 'privacy-2026.08.25-free-ask-v3';
  var CHOICES_KEY = 'zx_privacy_choices_v1';
  var SUPPORT_EMAIL = 'wuyh@sg1798.wecome.work';
  var DOCK_SUPPRESSED = false;
  var EXPORT_KEYS = [
    'zx_input',
    'zx_saved_reports_v1',
    'zx_profile_name_v1',
    'zx_report_share_unlock_v2',
    CHOICES_KEY
  ];
  var SCOPES = ['birth_local', 'device_account', 'ai_processing', 'product_analytics'];

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) { return null; }
  }

  function writeChoices(value) {
    try {
      localStorage.setItem(CHOICES_KEY, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function readChoices() {
    var saved = readJson(CHOICES_KEY);
    if (!saved || saved.version !== NOTICE_VERSION || !saved.scopes) {
      return { version: NOTICE_VERSION, updatedAt: null, scopes: {} };
    }
    return saved;
  }

  function has(scope) {
    return SCOPES.indexOf(scope) >= 0 && !!readChoices().scopes[scope];
  }

  function grant(scopes) {
    var list = Array.isArray(scopes) ? scopes : [scopes];
    var saved = readChoices();
    var now = new Date().toISOString();
    list.forEach(function (scope) {
      if (SCOPES.indexOf(scope) >= 0) saved.scopes[scope] = { grantedAt: now };
    });
    saved.updatedAt = now;
    if (!writeChoices(saved)) throw new Error('privacy choice unavailable');
    return saved;
  }

  function revoke(scope) {
    var saved = readChoices();
    if (scope) delete saved.scopes[scope];
    else saved.scopes = {};
    saved.updatedAt = new Date().toISOString();
    if (!writeChoices(saved)) throw new Error('privacy choice unavailable');
    return saved;
  }

  function exportLocalData() {
    var data = {
      product: '知星',
      exportedAt: new Date().toISOString(),
      noticeVersion: NOTICE_VERSION,
      data: {}
    };
    EXPORT_KEYS.forEach(function (key) {
      var value = null;
      try { value = localStorage.getItem(key); } catch (_) {}
      if (value === null) return;
      try { data.data[key] = JSON.parse(value); } catch (_) { data.data[key] = value; }
    });
    return data;
  }

  function clearZxStorage(storage) {
    var keys = [];
    if (!storage) return keys;
    for (var i = 0; i < storage.length; i += 1) {
      var key = storage.key(i);
      if (key && key.indexOf('zx_') === 0) keys.push(key);
    }
    keys.forEach(function (key) {
      storage.removeItem(key);
      if (storage.getItem(key) !== null) throw new Error('local data clear incomplete');
    });
    return keys;
  }

  function clearAllLocalData() {
    var cleared = clearZxStorage(localStorage);
    if (typeof sessionStorage !== 'undefined') cleared = cleared.concat(clearZxStorage(sessionStorage));
    return cleared;
  }

  function privacyPageHref() {
    var path = String(window.location && window.location.pathname || '');
    if (/\/v1\/report\.html$/.test(path)) return '../web/first-test-privacy.html';
    if (/\/web\//.test(path)) return './first-test-privacy.html';
    return './privacy.html';
  }

  function currentChoiceText(scope) {
    return has(scope) ? '已同意' : '未同意或已撤回';
  }

  function setDockSuppressed(suppressed) {
    DOCK_SUPPRESSED = !!suppressed;
    if (typeof document === 'undefined') return;
    var dock = document.getElementById('zxPrivacyDock');
    var center = document.getElementById('zxPrivacyCenter');
    if (dock) dock.hidden = DOCK_SUPPRESSED || !!(center && !center.hidden);
  }

  function mountPrivacyDock() {
    if (typeof document === 'undefined' || !document.body || document.getElementById('zxPrivacyDock')) return;

    var style = document.createElement('style');
    style.id = 'zx-privacy-center-style';
    style.textContent = [
      '#zxPrivacyDock{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));z-index:46;display:flex;gap:8px;align-items:center;padding:6px;border:1px solid rgba(201,168,92,.3);border-radius:999px;background:rgba(14,18,32,.94);box-shadow:0 8px 28px rgba(0,0,0,.35);font:12px/1.2 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}',
      '#zxPrivacyDock[hidden],#zxPrivacyCenter[hidden]{display:none!important}',
      '#zxPrivacyDock a,#zxPrivacyDock button{min-height:38px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:#e8e4d8;font:inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}',
      '#zxPrivacyDock a{color:#c9a85c}',
      '#zxPrivacyDock a:focus-visible,#zxPrivacyDock button:focus-visible,#zxPrivacyCenter a:focus-visible,#zxPrivacyCenter button:focus-visible{outline:2px solid #f0d695;outline-offset:2px}',
      '#zxPrivacyCenter{position:fixed;inset:0;z-index:140;display:grid;place-items:center;padding:20px;background:rgba(8,11,20,.9);font:14px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}',
      '#zxPrivacyCenterPanel{width:min(100%,480px);max-height:calc(100vh - 40px);overflow:auto;padding:24px 20px;border:1px solid rgba(201,168,92,.34);border-radius:12px;background:#1a2233;color:#e8e4d8;box-shadow:0 18px 55px rgba(0,0,0,.52)}',
      '#zxPrivacyCenterPanel h2{margin:0 0 10px;color:#c9a85c;font:700 20px/1.5 "Songti SC","STSong",serif}',
      '#zxPrivacyCenterPanel p{margin:0 0 12px;color:#bcc4d0}',
      '#zxPrivacyCenterPanel .zx-privacy-state{padding:11px 13px;border-left:2px solid #c9a85c;background:rgba(201,168,92,.07)}',
      '#zxPrivacyCenterPanel .zx-privacy-actions{display:grid;gap:10px;margin:16px 0}',
      '#zxPrivacyCenterPanel button,#zxPrivacyCenterPanel .zx-privacy-link{min-height:44px;padding:10px 14px;border:1px solid rgba(201,168,92,.45);border-radius:999px;background:transparent;color:#e8e4d8;font:inherit;cursor:pointer;text-decoration:none;text-align:center}',
      '#zxPrivacyCenterPanel .zx-privacy-primary{background:#c9a85c;color:#241c0c;font-weight:700}',
      '#zxPrivacyCenterPanel .zx-privacy-danger{border-color:rgba(213,105,92,.65);color:#f0b5ad}',
      '#zxPrivacyCenterStatus{min-height:24px;color:#f0d695}',
      '@media(max-width:480px){#zxPrivacyDock{right:8px;bottom:max(8px,env(safe-area-inset-bottom));gap:2px}#zxPrivacyDock a,#zxPrivacyDock button{padding:0 10px}#zxPrivacyCenter{padding:14px}#zxPrivacyCenterPanel{max-height:calc(100vh - 28px);padding:21px 17px}}'
    ].join('');

    var complaintHref = 'mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent('知星投诉或举报');
    var dock = document.createElement('div');
    dock.id = 'zxPrivacyDock';
    dock.setAttribute('aria-label', '隐私与投诉快捷入口');
    dock.innerHTML = '<a href="' + complaintHref + '">投诉/举报</a><button id="zxPrivacyOpen" type="button">隐私选择</button>';

    var center = document.createElement('div');
    center.id = 'zxPrivacyCenter';
    center.hidden = true;
    center.innerHTML = '<section id="zxPrivacyCenterPanel" role="dialog" aria-modal="true" aria-labelledby="zxPrivacyCenterTitle" tabindex="-1">' +
      '<h2 id="zxPrivacyCenterTitle">隐私选择与本机资料</h2>' +
      '<p class="zx-privacy-state" id="zxPrivacyChoiceState"></p>' +
      '<p>本期产品改进统计已关闭且接收端点为空，不会发送产品埋点。撤回问星处理同意后，下次问星会在按需加载 TCaptcha 或发送 DeepSeek 前重新征求确认。</p>' +
      '<div class="zx-privacy-actions">' +
        '<button class="zx-privacy-primary" id="zxPrivacyRevoke" type="button">撤回问星处理与统计同意</button>' +
        '<button class="zx-privacy-danger" id="zxPrivacyClear" type="button">清除页面可删除的本机知星资料</button>' +
        '<a class="zx-privacy-link" href="' + complaintHref + '">提交投诉或举报</a>' +
        '<a class="zx-privacy-link" id="zxPrivacyPolicy" href="' + privacyPageHref() + '">查看首期测试隐私政策</a>' +
        '<button id="zxPrivacyClose" type="button">关闭</button>' +
      '</div>' +
      '<p>投诉或举报按“受理 → 核验 → 处理 → 反馈”办理；该通道由人工值守，我们会在 15 个工作日内或法律规定期限内反馈。涉及腾讯云 TCaptcha 的个人信息请求，我们会按需协调服务提供方处理。</p>' +
      '<p id="zxPrivacyCenterStatus" role="status" aria-live="polite"></p>' +
    '</section>';

    document.head.appendChild(style);
    document.body.appendChild(dock);
    document.body.appendChild(center);
    dock.hidden = DOCK_SUPPRESSED;

    var openButton = document.getElementById('zxPrivacyOpen');
    var closeButton = document.getElementById('zxPrivacyClose');
    var panel = document.getElementById('zxPrivacyCenterPanel');
    var choiceState = document.getElementById('zxPrivacyChoiceState');
    var status = document.getElementById('zxPrivacyCenterStatus');
    var returnFocus = null;
    var previousOverflow = '';

    function renderChoices() {
      choiceState.textContent = '问星处理（TCaptcha + DeepSeek）：' + currentChoiceText('ai_processing') + '；产品统计：' + currentChoiceText('product_analytics') + '。';
    }

    function openCenter() {
      returnFocus = document.activeElement;
      previousOverflow = document.documentElement.style.overflow;
      status.textContent = '';
      renderChoices();
      dock.hidden = true;
      center.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      document.getElementById('zxPrivacyRevoke').focus();
    }

    function closeCenter() {
      center.hidden = true;
      dock.hidden = DOCK_SUPPRESSED;
      document.documentElement.style.overflow = previousOverflow;
      if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
    }

    openButton.addEventListener('click', openCenter);
    closeButton.addEventListener('click', closeCenter);
    center.addEventListener('click', function (event) {
      if (event.target === center) closeCenter();
    });
    center.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeCenter();
        return;
      }
      if (event.key !== 'Tab') return;
      var items = Array.prototype.slice.call(panel.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    document.getElementById('zxPrivacyRevoke').addEventListener('click', function () {
      try {
        revoke('ai_processing');
        revoke('product_analytics');
        if (window.ZxAnalytics && typeof window.ZxAnalytics.clear === 'function') window.ZxAnalytics.clear();
        renderChoices();
        status.textContent = '已撤回问星处理与产品统计同意；后续问星不会继续按原选择加载 TCaptcha 或发送 DeepSeek，重新使用前会再次确认。';
      } catch (_) {
        status.textContent = '当前浏览器未能保存撤回选择，请检查站点存储设置后重试。';
      }
    });

    document.getElementById('zxPrivacyClear').addEventListener('click', function () {
      if (!window.confirm('将清除当前页面有权删除的 LocalStorage 与 SessionStorage 中所有 zx_ 前缀资料，包括出生资料、报告解锁、匿名问星授权和隐私选择。不会自动删除服务端记录或 HttpOnly Cookie。此操作无法恢复，是否继续？')) return;
      try {
        clearAllLocalData();
        if (window.ZxAnalytics && typeof window.ZxAnalytics.clear === 'function') window.ZxAnalytics.clear();
        renderChoices();
        status.textContent = '已清除页面可删除的本机知星存储资料，页面即将刷新。服务端记录和 HttpOnly Cookie 不会因此自动删除，可通过投诉/举报入口提出处理请求。';
        window.setTimeout(function () { window.location.reload(); }, 900);
      } catch (_) {
        renderChoices();
        status.textContent = '本机资料未能完整清除，请检查浏览器站点存储设置后重试。页面不会把本次操作显示为清除成功。';
      }
    });
  }

  window.ZxPrivacyConsent = {
    noticeVersion: NOTICE_VERSION,
    choicesKey: CHOICES_KEY,
    has: has,
    grant: grant,
    revoke: revoke,
    snapshot: readChoices,
    exportLocalData: exportLocalData,
    clearAllLocalData: clearAllLocalData,
    mountPrivacyDock: mountPrivacyDock,
    setDockSuppressed: setDockSuppressed
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountPrivacyDock, { once:true });
    else mountPrivacyDock();
  }
})();
