/* member.js — 账号与会话客户端最小接入层
 * API_BASE 留空时完全关闭。生产页不接受 ?api= 覆盖;本地调试仅允许本地页指向 localhost/127.0.0.1。
 * 浏览器只做账号初始化、微信服务号会话确认与 access token 刷新；问星商品和微信 JSAPI 支付由
 * web/paid-h5.js（历史文件名）承接。旧 H5 下单和浏览器 deepSave 均明确失败关闭。
 * 真正 /deep/consume、/deep/complete 与 /deep/refund 只能由深问后端服务间调用。
 */
(function () {
  'use strict';

  var API_BASE = '';
  var AUTH_SESSION_PATH = '/auth/session';
  var AUTH_SESSION_REFRESH_PATH = '/auth/session/refresh';
  var AUTH_LOGOUT_PATH = '/auth/logout';
  var PENDING_PAYMENT_KEY = 'zx_pending_payment_order_v1';
  var PAID_ASK_PENDING_KEY = 'zx_paid_ask_pending_v1';
  var PAID_ASK_PURCHASE_KEY = 'zx_pending_paid_ask_purchase_v1';
  var PAID_ASK_IDENTITY_RESUME_KEY = 'zx_paid_ask_identity_resume_v1';
  var PAID_ASK_AUTO_OAUTH_BLOCK_KEY = 'zx_paid_ask_auto_oauth_block_v1';
  var ACCESS_TOKEN_KEY = 'zx_access_token';
  var ACCESS_TOKEN_EXPIRES_KEY = 'zx_access_token_expires_at';
  var AUTH_REFRESH_LOCK_NAME = 'zx-auth-refresh-v1';
  var AUTH_CHANNEL_NAME = 'zx-auth-session-v1';
  var READING_PROGRESS_PREFIX = 'zx_report_last_chapter_v2:';
  var READER_POSITION_PREFIX = 'zx_reader_position_v1:';
  var ACCOUNT_SESSION_KEYS = ['zx_chart_selection_v1', 'zx_managed_synastry_selection_v1', 'zx_ui_continuation_v1'];

  // The one report-access rule shared by every page that loads this client.
  // storage_expires_at is the server's storage expiry; expires_at is its older mirror.
  function paidReportExpiry(item) {
    if (!item || typeof item !== 'object') return null;
    var value = Number.isSafeInteger(item.storage_expires_at) ? item.storage_expires_at : item.expires_at;
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  function paidReportUsable(item, now) {
    var at = Number.isSafeInteger(now) ? now : Date.now();
    var expiry = paidReportExpiry(item);
    return !!(item && /^[a-f0-9]{48}$/.test(String(item.report_id || '')) && item.readable === true &&
      !item.unavailable_reason && item.refund_status !== 'pending' && item.entitlement_status === 'active' &&
      item.delivery_status === 'ready' && expiry !== null && expiry > at);
  }
  window.ZxReportAccess = Object.freeze({ expiry: paidReportExpiry, usable: paidReportUsable });

  // Prices come only from the generated policy projection (report-offer.js).
  // A missing price stays unknown; the server catalog still decides eligibility.
  function projectedPriceFen(productCode) {
    var source = window.ZxReportOffer;
    var offers = source && Array.isArray(source.offers) ? source.offers : [];
    for (var index = 0; index < offers.length; index++) {
      var item = offers[index];
      if (item && item.productCode === productCode) {
        return item.currency === 'CNY' && Number.isSafeInteger(item.amountFen) && item.amountFen > 0 ? item.amountFen : null;
      }
    }
    return null;
  }

  function isLocalDebugHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }
  function isLocalDebugPage() {
    return location.protocol === 'file:' || isLocalDebugHost(location.hostname);
  }
  function localDebugUrlParam(name) {
    var raw = new URLSearchParams(location.search).get(name);
    if (!raw || !isLocalDebugPage()) return '';
    try {
      var u = new URL(raw, location.href);
      return /^https?:$/.test(u.protocol) && isLocalDebugHost(u.hostname) && !u.username && !u.password && !u.search && !u.hash ? u.href.replace(/\/+$/, '') : '';
    } catch (_) {
      return '';
    }
  }

  function privateReportsPage() {
    return window.ZX_PRIVATE_REPORT_BUILD === true || (isLocalDebugPage() && new URLSearchParams(location.search).get('private-report') === '1');
  }

  function configuredApiBase(value) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    try {
      var target = new URL(raw);
      var hostname = target.hostname.toLowerCase().replace(/\.$/, '');
      if (target.protocol !== 'https:' ||
          target.username || target.password || target.search || target.hash ||
          (target.pathname && target.pathname !== '/') ||
          (hostname !== 'zhixng.cn' && !hostname.endsWith('.zhixng.cn'))) {
        return '';
      }
      return target.origin;
    } catch (_) {
      return '';
    }
  }

  var injectedPublicConfig = window.ZX_PUBLIC_CONFIG;
  if (!injectedPublicConfig || typeof injectedPublicConfig !== 'object' ||
      Array.isArray(injectedPublicConfig)) {
    injectedPublicConfig = {};
  }
  API_BASE = localDebugUrlParam('api') ||
    configuredApiBase(injectedPublicConfig.accountApiBase) ||
    API_BASE;

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
      return v;
    } catch (_) {
      return null;
    }
  }
  function ss(k, v) {
    try {
      if (v === undefined) return sessionStorage.getItem(k);
      sessionStorage.setItem(k, v);
      return v;
    } catch (_) {
      return null;
    }
  }
  function drop(k) {
    try { localStorage.removeItem(k); } catch (_) {}
  }
  function dropSession(k) {
    try { sessionStorage.removeItem(k); } catch (_) {}
  }
  function cid() {
    var v = ls('zx_cid');
    if (!v) {
      if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') {
        throw new Error('secure randomness unavailable');
      }
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      v = 'c' + Array.prototype.map.call(bytes, function (item) {
        return item.toString(16).padStart(2, '0');
      }).join('');
      ls('zx_cid', v);
    }
    return v;
  }
  function token() {
    var access = ss(ACCESS_TOKEN_KEY) || '';
    var expiresAt = Number(ss(ACCESS_TOKEN_EXPIRES_KEY) || 0);
    if (access && (!expiresAt || expiresAt > Date.now())) return access;
    if (access) {
      dropSession(ACCESS_TOKEN_KEY);
      dropSession(ACCESS_TOKEN_EXPIRES_KEY);
    }
    var legacy = ls('zx_token') || '';
    if (/^zx_a_/i.test(legacy)) {
      ss(ACCESS_TOKEN_KEY, legacy);
      drop('zx_token');
      return legacy;
    }
    return legacy;
  }
  function accessTokenData() {
    var access = ss(ACCESS_TOKEN_KEY) || '';
    var expiresAt = Number(ss(ACCESS_TOKEN_EXPIRES_KEY) || 0);
    if (!/^zx_a_[A-Za-z0-9_-]{1,512}$/.test(access)) return null;
    if (expiresAt && expiresAt <= Date.now() + 5000) return null;
    return {
      access_token: access,
      access_token_expires_at: expiresAt || null,
      token_type: 'Bearer'
    };
  }
  function saveTokens(data) {
    data = data || {};
    var access = String(data.access_token || '');
    var legacy = String(data.token || '');
    if (access) {
      ss(ACCESS_TOKEN_KEY, access);
      var expiresAt = Number(data.access_token_expires_at || 0);
      if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
        ss(ACCESS_TOKEN_EXPIRES_KEY, String(expiresAt));
      } else {
        dropSession(ACCESS_TOKEN_EXPIRES_KEY);
      }
      drop('zx_token');
    } else if (legacy) {
      if (/^zx_a_/i.test(legacy)) ss(ACCESS_TOKEN_KEY, legacy);
      else ls('zx_token', legacy);
    }
    return data;
  }
  function clearTokens() {
    dropSession(ACCESS_TOKEN_KEY);
    dropSession(ACCESS_TOKEN_EXPIRES_KEY);
    drop('zx_token');
  }
  function clearPaidAskSessionState() {
    dropSession('zx_profile_ask_purchase_v1');
    dropSession(PAID_ASK_PENDING_KEY);
    dropSession(PAID_ASK_PURCHASE_KEY);
    dropSession(PAID_ASK_IDENTITY_RESUME_KEY);
    drop(PENDING_PAYMENT_KEY);
    dropSession('zx_private_report_resume_id');
    try {
      for (var index = sessionStorage.length - 1; index >= 0; index--) {
        var key = sessionStorage.key(index);
        if (key && key.indexOf('zx_private_ask_pending_v1:') === 0) sessionStorage.removeItem(key);
      }
    } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('zx-private-session-cleared')); } catch (_) {}
  }
  // Signing out or closing the account removes device records that name or derive
  // from an account. Base charts stay; chart-vault.js removes their account links
  // when it receives zx-account-signed-out.
  function clearAccountLocalTraces() {
    try {
      for (var index = localStorage.length - 1; index >= 0; index--) {
        var key = localStorage.key(index);
        if (!key) continue;
        var progressScope = key.indexOf(READING_PROGRESS_PREFIX) === 0 ? key.slice(READING_PROGRESS_PREFIX.length) : '';
        // Private report progress keys start with the 64-hex account ref; local
        // charts use a single birth-input digest without an account segment.
        if (key.indexOf(READER_POSITION_PREFIX) === 0 || /^[a-f0-9]{64}:/.test(progressScope)) localStorage.removeItem(key);
      }
    } catch (_) {}
    ACCOUNT_SESSION_KEYS.forEach(function (key) {
      try {
        var value = JSON.parse(sessionStorage.getItem(key) || 'null');
        if (value && (value.kind === 'report' || value.owner || value.accountRef || value.report)) sessionStorage.removeItem(key);
      } catch (_) { dropSession(key); }
    });
    try { window.dispatchEvent(new CustomEvent('zx-account-signed-out')); } catch (_) {}
  }
  function blockAutomaticOauth() {
    ss(PAID_ASK_AUTO_OAUTH_BLOCK_KEY, '1');
  }

  var sessionRefreshPromise = null;
  var refreshBroadcastVersion = 0;
  var refreshCandidates = Object.create(null);
  var refreshWaiters = [];
  var authTabId = (function () {
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') return '';
    var bytes = new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (item) {
      return item.toString(16).padStart(2, '0');
    }).join('');
  })();
  var authChannel = null;
  if (typeof window.BroadcastChannel === 'function') {
    try { authChannel = new window.BroadcastChannel(AUTH_CHANNEL_NAME); } catch (_) {}
  }

  function postAuthMessage(message) {
    if (!authChannel || !message) return;
    try { authChannel.postMessage(Object.assign({ source: authTabId }, message)); } catch (_) {}
  }

  function resolveRefreshWaiters(data) {
    var waiters = refreshWaiters.splice(0);
    waiters.forEach(function (resolve) { resolve(data || null); });
  }

  if (authChannel) {
    authChannel.onmessage = function (event) {
      var message = event && event.data || {};
      if (!message || message.source === authTabId) return;
      if (message.type === 'access') {
        var access = String(message.access_token || '');
        var expiresAt = Number(message.access_token_expires_at || 0);
        if (!/^zx_a_[A-Za-z0-9_-]{1,512}$/.test(access) ||
            !Number.isFinite(expiresAt) || expiresAt <= Date.now() + 5000) return;
        saveTokens({
          access_token: access,
          access_token_expires_at: expiresAt,
          token_type: 'Bearer'
        });
        refreshBroadcastVersion += 1;
        resolveRefreshWaiters(accessTokenData());
      } else if (message.type === 'need-access') {
        var current = accessTokenData();
        if (current) {
          postAuthMessage({
            type: 'access',
            access_token: current.access_token,
            access_token_expires_at: current.access_token_expires_at
          });
        }
      } else if (message.type === 'refresh-candidate') {
        var candidate = String(message.source || '');
        var timestamp = Number(message.at || 0);
        if (/^[a-f0-9]{24}$/i.test(candidate) && Number.isFinite(timestamp) &&
            Math.abs(Date.now() - timestamp) < 5000) {
          refreshCandidates[candidate] = timestamp;
        }
      } else if (message.type === 'clear-access') {
        dropSession(ACCESS_TOKEN_KEY);
        dropSession(ACCESS_TOKEN_EXPIRES_KEY);
        clearPaidAskSessionState();
        clearAccountLocalTraces();
        blockAutomaticOauth();
        state.ready = false;
        state.memberUntil = null;
        state.cloudSyncEnabled = false;
        state.authenticated = false;
        state.identityKind = '';
        state.accountRef = '';
        state.paymentAvailable = false;
      }
    };
  }

  function isAuthPath(path) {
    return String(path || '').indexOf('/auth/') === 0;
  }

  // A refresh that races another use of the old token is answered with 409
  // SESSION_REFRESH_RETRY. Wait as asked (retry_after / Retry-After, at most 3 s) and
  // refresh once more; any further failure follows the normal path, where only
  // 401/403 end the private session.
  var REFRESH_RETRY_MAX_MS = 3000;
  function refreshRetryDelay(error) {
    var data = error && error.data || {};
    var detail = data.error && typeof data.error === 'object' ? data.error : {};
    var candidates = [data.retry_after, detail.retry_after, error && error.retryAfter];
    for (var index = 0; index < candidates.length; index++) {
      if (candidates[index] == null || candidates[index] === '') continue;
      var seconds = Number(candidates[index]);
      if (Number.isFinite(seconds) && seconds >= 0) return Math.min(REFRESH_RETRY_MAX_MS, Math.round(seconds * 1000));
    }
    return 1000;
  }
  function requestRefresh(retried) {
    return api(AUTH_SESSION_REFRESH_PATH, {
      method: 'POST',
      noSessionRetry: true
    }).catch(function (error) {
      if (retried || !error || error.status !== 409 || error.code !== 'SESSION_REFRESH_RETRY') throw error;
      return new Promise(function (resolve) { setTimeout(resolve, refreshRetryDelay(error)); })
        .then(function () { return requestRefresh(true); });
    });
  }
  function rawRefreshAccessToken() {
    return requestRefresh(false).then(saveTokens).then(function (data) {
      var current = accessTokenData();
      if (current) {
        postAuthMessage({
          type: 'access',
          access_token: current.access_token,
          access_token_expires_at: current.access_token_expires_at
        });
      }
      return data;
    });
  }

  function waitForBroadcastAccess(timeoutMs) {
    var current = accessTokenData();
    if (current) return Promise.resolve(current);
    if (!authChannel) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var settled = false;
      function finish(data) {
        if (settled) return;
        settled = true;
        resolve(data || null);
      }
      refreshWaiters.push(finish);
      window.setTimeout(function () {
        var index = refreshWaiters.indexOf(finish);
        if (index >= 0) refreshWaiters.splice(index, 1);
        finish(accessTokenData());
      }, Math.max(20, Number(timeoutMs) || 0));
    });
  }

  function refreshWithoutWebLocks() {
    if (!authChannel || !authTabId) return rawRefreshAccessToken();
    postAuthMessage({ type: 'need-access' });
    return waitForBroadcastAccess(100).then(function (peerAccess) {
      if (peerAccess) return peerAccess;
      var now = Date.now();
      refreshCandidates[authTabId] = now;
      postAuthMessage({ type: 'refresh-candidate', at: now });
      return new Promise(function (resolve) {
        window.setTimeout(resolve, 140);
      }).then(function () {
        var cutoff = Date.now() - 1000;
        var candidates = Object.keys(refreshCandidates).filter(function (id) {
          return Number(refreshCandidates[id]) >= cutoff;
        }).sort();
        if (!candidates.length || candidates[0] === authTabId) return rawRefreshAccessToken();
        return waitForBroadcastAccess(5000).then(function (winnerAccess) {
          if (winnerAccess) return winnerAccess;
          return rawRefreshAccessToken();
        });
      });
    });
  }

  function refreshAccessToken() {
    if (sessionRefreshPromise) return sessionRefreshPromise;
    var observedVersion = refreshBroadcastVersion;
    var locks = window.navigator && window.navigator.locks;
    if (locks && typeof locks.request === 'function') {
      sessionRefreshPromise = locks.request(AUTH_REFRESH_LOCK_NAME, { mode: 'exclusive' }, function () {
        var current = accessTokenData();
        if (refreshBroadcastVersion !== observedVersion && current) return current;
        postAuthMessage({ type: 'need-access' });
        return waitForBroadcastAccess(80).then(function (peerAccess) {
          return peerAccess || rawRefreshAccessToken();
        });
      });
    } else {
      sessionRefreshPromise = refreshWithoutWebLocks();
    }
    sessionRefreshPromise = sessionRefreshPromise.then(function (data) {
      sessionRefreshPromise = null;
      return data;
    }, function (error) {
      sessionRefreshPromise = null;
      dropSession(ACCESS_TOKEN_KEY);
      dropSession(ACCESS_TOKEN_EXPIRES_KEY);
      if (privateReportsPage() && state && state.accountRef && error && (error.status === 401 || error.status === 403)) {
        clearPaidAskSessionState();
        state.authenticated = false;
        state.identityKind = '';
        state.accountRef = '';
        state.paymentAvailable = false;
      }
      throw error;
    });
    return sessionRefreshPromise;
  }

  function freshAccessToken() {
    var current = accessTokenData();
    if (current) return Promise.resolve(current.access_token);
    return refreshAccessToken().then(function () {
      var refreshed = accessTokenData();
      if (!refreshed) throw new Error('authenticated access token unavailable');
      return refreshed.access_token;
    });
  }

  function accountConsentGranted() {
    return !!(window.ZxPrivacyConsent && window.ZxPrivacyConsent.has('device_account'));
  }

  function api(path, opts) {
    if (!API_BASE) return Promise.reject(new Error('no api'));
    opts = opts || {};
    var headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
    var tok = opts.anonymous === true ? '' : token();
    if (tok) headers.authorization = 'Bearer ' + tok;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;
    return fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      // OAuth starts without a bearer token, but must accept the HttpOnly state
      // cookie that binds the later WeChat callback to this browser.
      credentials: opts.anonymous === true && path !== '/auth/wechat/oauth/start' ? 'omit' : 'include',
      cache: 'no-store',
      signal: controller ? controller.signal : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var detail = data && data.error;
          var code = detail && typeof detail === 'object' ? detail.code : data && data.code || detail;
          var message = detail && typeof detail === 'object' ? detail.message : detail;
          var error = new Error(message || code || ('HTTP ' + r.status));
          error.status = r.status;
          error.data = data;
          error.code = String(code || '');
          // Readable only when the API exposes it over CORS; retry_after in the body is the fallback.
          try { var retryAfter = r.headers && typeof r.headers.get === 'function' ? r.headers.get('Retry-After') : null; if (retryAfter != null) error.retryAfter = retryAfter; } catch (_) {}
          throw error;
        }
        return data;
      });
    }).catch(function (error) {
      if (error && error.name === 'AbortError') {
        var timeoutError = new Error('request timed out');
        timeoutError.code = 'REQUEST_TIMEOUT';
        throw timeoutError;
      }
      if (error && error.status === 401 && opts.anonymous !== true && opts.noSessionRetry !== true &&
          opts.sessionRetried !== true && !isAuthPath(path)) {
        dropSession(ACCESS_TOKEN_KEY);
        dropSession(ACCESS_TOKEN_EXPIRES_KEY);
        return refreshAccessToken().then(function () {
          return api(path, Object.assign({}, opts, { sessionRetried: true }));
        });
      }
      throw error;
    }).finally(function () { if (timeout) clearTimeout(timeout); });
  }

  function normalizeChartPayload(payload) {
    payload = payload || {};
    return {
      d: String(payload.d || ''),
      t: String(payload.t || ''),
      c: String(payload.c || '').trim(),
      g: String(payload.g || '')
    };
  }

  var state = {
    ready: false,
    memberUntil: null,
    cloudSyncEnabled: false,
    authenticated: false,
    identityKind: '',
    accountRef: '',
    paymentAvailable: false
  };

  function applyAccountState(data) {
    data = data || {};
    if (data.member_until !== undefined) state.memberUntil = data.member_until || null;
    if (data.cloud_sync_enabled !== undefined) state.cloudSyncEnabled = !!data.cloud_sync_enabled;
    if (data.payment_available !== undefined) state.paymentAvailable = data.payment_available === true;
    if (data.authenticated !== undefined || data.wechat_authenticated !== undefined || data.identity_kind !== undefined) {
      var identityKind = String(data.identity_kind || '');
      var authenticated = data.authenticated === true &&
        data.wechat_authenticated === true && identityKind === 'wechat';
      var accountRef = authenticated && /^[a-f0-9]{64}$/.test(String(data.account_ref || ''))
        ? String(data.account_ref) : '';
      // A refresh may identify a different owner. Invalidate private views and
      // in-flight responses before publishing the replacement identity.
      if (state.accountRef && state.accountRef !== accountRef) clearPaidAskSessionState();
      state.authenticated = authenticated;
      state.identityKind = authenticated ? identityKind : '';
      state.accountRef = accountRef;
    }
    return data;
  }

  function refresh() {
    return api('/account/me').then(function (data) {
      applyAccountState(data);
      state.ready = true;
      return data;
    });
  }

  function authSession() {
    if (!token()) return Promise.resolve({ authenticated: false });
    return api(AUTH_SESSION_PATH).then(function (data) {
      applyAccountState(data);
      return data;
    });
  }

  function refreshSession() {
    return refreshAccessToken()
      .then(authSession);
  }

  function initAnonymousAccount() {
    if (privateReportsPage()) return Promise.resolve({ authenticated: false });
    return api('/account/init', { method: 'POST', body: { device_id: cid() } })
      .then(function (data) {
        saveTokens(data);
        applyAccountState(data);
        return data;
      });
  }

  function hasWechatOauthCallback() {
    try { return new URLSearchParams(location.search).get('wechat_bind') === 'success'; }
    catch (_) { return false; }
  }

  function init() {
    if (!API_BASE) return Promise.resolve(state);
    var restore = hasWechatOauthCallback()
      ? refreshSession().catch(function () {
          clearTokens();
          state.authenticated = false;
          state.identityKind = '';
          state.accountRef = '';
          return null;
        })
      : token()
      ? authSession().catch(function (error) {
          if (error && error.status === 401) {
            return refreshSession().catch(function () {
              clearTokens();
              state.authenticated = false;
              state.identityKind = '';
              state.accountRef = '';
              return initAnonymousAccount();
            });
          }
          return null;
        })
      : refreshSession().catch(function () {
          clearTokens();
          state.authenticated = false;
          state.identityKind = '';
          state.accountRef = '';
          return initAnonymousAccount();
        });
    return restore
      .then(function () { return refresh().catch(function () { return state; }); })
      .then(function (data) { state.ready = true; return data; })
      .catch(function () { return state; });
  }

  var initStarted = false;
  var initPromise = Promise.resolve(state);

  function start() {
    if (!API_BASE) return Promise.resolve(state);
    if (!accountConsentGranted()) {
      var error = new Error('privacy consent required');
      error.code = 'PRIVACY_CONSENT_REQUIRED';
      return Promise.reject(error);
    }
    if (initStarted) return initPromise;
    initStarted = true;
    initPromise = init();
    return initPromise;
  }

  function reportClientError(code) { var error = new Error(code); error.code = code; return error; }
  function checkedPaidReportId(id) {
    if (typeof id !== 'string' || !/^[a-f0-9]{48}$/.test(id)) throw reportClientError('REPORT_NOT_FOUND');
    return id;
  }
  function privateReportServiceAvailable() {
    return privateReportsPage() && !!API_BASE && (injectedPublicConfig.reportServiceAvailable === true || !!localDebugUrlParam('api'));
  }
  var REPORT_PAYMENT_VERSIONS = Object.freeze({
    agreementVersion:'user-agreement-2026.10.15-report-v2',privacyVersion:'privacy-2026.10.15-report-v2',
    membershipTermsVersion:'paid-report-2026.09.09-v1',refundPolicyVersion:'refund-2026.10.15-report-v2',
    aiDisclosureVersion:'ai-disclosure-2026.09.09-report-v1',purchaseNoticeVersion:'purchase-notice-2026.09.09-report-v1'
  });
  var REPORT_POLICY_PATHS = Object.freeze({userAgreementUrl:'/terms.html',privacyUrl:'/privacy.html',
    membershipRulesUrl:'/membership-rules.html',refundUrl:'/refund-policy.html',aiDisclosureUrl:'/ai-disclosure.html',purchaseNoticeUrl:'/purchase-notice.html'});
  function paidReportPurchaseReady() {
    var expiry=Date.parse(injectedPublicConfig.reportAcceptanceExpiresAt || '');
    if(injectedPublicConfig.reportAcceptanceMode === true && (!Number.isSafeInteger(expiry) || expiry<=Date.now()))return false;
    return privateReportServiceAvailable() && injectedPublicConfig.reportPurchaseAvailable === true &&
      injectedPublicConfig.paymentOrigin === 'https://zhixng.cn' && /^wx[a-f0-9]{16}$/.test(injectedPublicConfig.wechatOfficialAccountAppId || '') &&
      Object.keys(REPORT_PAYMENT_VERSIONS).every(function(key){return injectedPublicConfig[key] === REPORT_PAYMENT_VERSIONS[key];}) &&
      Object.keys(REPORT_POLICY_PATHS).every(function(key){return injectedPublicConfig[key] === 'https://zhixng.cn' + REPORT_POLICY_PATHS[key];});
  }
  // Product semantics only. Prices are read from the policy projection.
  var REPORT_ASK_PRODUCTS = Object.freeze({ask_single_v1:{credits:1},ask_pack_3_v1:{credits:3}});
  function askOfferPriceMatches(productCode, amountFen) {
    if (!Number.isSafeInteger(amountFen) || amountFen <= 0) return false;
    var projected = projectedPriceFen(productCode);
    return projected === null || amountFen === projected;
  }
  async function paidAskCreateOrder(id, productCode, confirmation, idempotencyKey) {
    if (!paidReportPurchaseReady()) throw reportClientError('REPORT_SALES_NOT_APPROVED');
    if (!/MicroMessenger/i.test(navigator.userAgent || '')) throw reportClientError('WECHAT_BROWSER_REQUIRED');
    id = checkedPaidReportId(id);
    var expected = REPORT_ASK_PRODUCTS[productCode];
    if (!Object.prototype.hasOwnProperty.call(REPORT_ASK_PRODUCTS, productCode)) throw reportClientError('PAYMENT_PRODUCT_INVALID');
    if (!confirmation || confirmation.policyConsent !== true) throw reportClientError('PAYMENT_CONSENT_REQUIRED');
    if (confirmation.adultConfirmed !== true) throw reportClientError('PAYMENT_ADULT_CONFIRMATION_REQUIRED');
    if (typeof idempotencyKey !== 'string' || !/^[a-f0-9]{32}$/.test(idempotencyKey)) throw reportClientError('PAYMENT_IDEMPOTENCY_KEY_INVALID');
    var owner = state.accountRef;
    function currentOwner() {
      if (!state.authenticated || state.identityKind !== 'wechat' || !owner) throw reportClientError('WECHAT_AUTHENTICATION_REQUIRED');
      if (state.accountRef !== owner) throw reportClientError('REPORT_ACCOUNT_CHANGED');
    }
    currentOwner();
    // Refresh both the owned report and its offer immediately before creating an order.
    var report = await privateReportApi('/paid-reports/' + id + '?view=status');
    currentOwner();
    if (!report || report.report_id !== id || !paidReportUsable(report)) throw reportClientError('ASK_REPORT_NOT_READY');
    var catalog = await privateReportApi('/ask/products?report_id=' + id);
    currentOwner();
    var offers = catalog && Array.isArray(catalog.products) ? catalog.products.filter(function (item) { return item.product_code === productCode; }) : [];
    var offer = offers.length === 1 ? offers[0] : null;
    if (!catalog || catalog.payment_available !== true || !offer || offer.payment_available !== true || offer.purchase_eligible !== true ||
        offer.currency !== 'CNY' || !askOfferPriceMatches(productCode, offer.amount_fen) || offer.question_credits !== expected.credits || !paidReportPurchaseReady()) throw reportClientError('ASK_PURCHASE_UNAVAILABLE');
    return privateReportMutation('/payments/orders', {method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:{
      product_code:productCode,paid_report_id:id,channel:'wechatpay_jsapi',consent:true,adult_confirmed:true,
      agreement_version:REPORT_PAYMENT_VERSIONS.agreementVersion,privacy_version:REPORT_PAYMENT_VERSIONS.privacyVersion,
      membership_terms_version:REPORT_PAYMENT_VERSIONS.membershipTermsVersion,refund_policy_version:REPORT_PAYMENT_VERSIONS.refundPolicyVersion,
      ai_disclosure_version:REPORT_PAYMENT_VERSIONS.aiDisclosureVersion,purchase_notice_version:REPORT_PAYMENT_VERSIONS.purchaseNoticeVersion
    }});
  }
  function privateReportApi(path, options) {
    if (!privateReportServiceAvailable()) return Promise.reject(reportClientError('REPORT_SERVICE_UNAVAILABLE'));
    if (!accountConsentGranted()) return Promise.reject(reportClientError('PRIVACY_CONSENT_REQUIRED'));
    return freshAccessToken().then(function () {
      if (!accountConsentGranted()) throw reportClientError('PRIVACY_CONSENT_REQUIRED');
      if (!privateReportServiceAvailable()) throw reportClientError('REPORT_SERVICE_UNAVAILABLE');
      return api(path, options);
    }).then(function (result) {
      if (!accountConsentGranted()) throw reportClientError('PRIVACY_CONSENT_REQUIRED');
      return result;
    });
  }
  function privateReportMutation(path, options) {
    if (!privateReportServiceAvailable()) return Promise.reject(reportClientError('REPORT_SERVICE_UNAVAILABLE'));
    if (!accountConsentGranted()) return Promise.reject(reportClientError('PRIVACY_CONSENT_REQUIRED'));
    var owner = state.accountRef;
    if (!state.authenticated || state.identityKind !== 'wechat' || !owner) return Promise.reject(reportClientError('WECHAT_AUTHENTICATION_REQUIRED'));
    function sameOwner() {
      if (!accountConsentGranted()) throw reportClientError('PRIVACY_CONSENT_REQUIRED');
      if (!privateReportServiceAvailable()) throw reportClientError('REPORT_SERVICE_UNAVAILABLE');
      if (!state.authenticated || state.identityKind !== 'wechat' || state.accountRef !== owner) throw reportClientError('REPORT_ACCOUNT_CHANGED');
    }
    return identifiedAccessToken().then(function () {
      sameOwner();
      // Never replay an irreversible confirmation under a newly refreshed owner.
      return api(path, Object.assign({}, options, {noSessionRetry:true}));
    }).then(function (result) { sameOwner(); return result; });
  }
  // A refreshed access token can belong to another account (another tab may sign in
  // as someone else). Whenever an owner-bound request needs a refresh, ask the server
  // who the token belongs to; applyAccountState then publishes the actual owner.
  function reidentifiedSession() {
    dropSession(ACCESS_TOKEN_KEY);
    dropSession(ACCESS_TOKEN_EXPIRES_KEY);
    return refreshSession();
  }
  function identifiedAccessToken() {
    return accessTokenData() ? Promise.resolve() : reidentifiedSession();
  }
  // Deleting a saved answer is irreversible. A 401 is retried once, and only after
  // the refreshed session is confirmed to be the account that started the request.
  function ownerBoundRequest(path, options) {
    var owner = state.accountRef, sent = false, replayed = false;
    if (!accountConsentGranted()) return Promise.reject(reportClientError('PRIVACY_CONSENT_REQUIRED'));
    if (!state.authenticated || state.identityKind !== 'wechat' || !/^[a-f0-9]{64}$/.test(owner)) return Promise.reject(reportClientError('WECHAT_AUTHENTICATION_REQUIRED'));
    function sameOwner() {
      if (!accountConsentGranted()) throw reportClientError('PRIVACY_CONSENT_REQUIRED');
      if (!state.authenticated || state.identityKind !== 'wechat' || state.accountRef !== owner) throw reportClientError('REPORT_ACCOUNT_CHANGED');
    }
    function send() {
      sameOwner();
      sent = true;
      return api(path, Object.assign({}, options, { noSessionRetry: true }));
    }
    return identifiedAccessToken().then(send).catch(function (error) {
      if (!sent || replayed || !error || error.status !== 401) throw error;
      replayed = true;
      return reidentifiedSession().then(send);
    }).then(function (result) { sameOwner(); return result; });
  }
  function checkedReportInput(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(function (key) { return !['d','t','c','g'].includes(key); })) throw reportClientError('REPORT_REQUEST_INVALID');
    return normalizeChartPayload(input);
  }

  if (typeof window.addEventListener === 'function') {
    window.addEventListener('zx-account-consent-revoked', function () {
      clearTokens();
      state.ready = false;state.memberUntil = null;state.cloudSyncEnabled = false;
      state.authenticated = false;state.identityKind = '';state.accountRef = '';state.paymentAvailable = false;
      clearPaidAskSessionState();
    });
  }

  window.zxMember = {
    giftReportServiceAvailable: function () { return privateReportServiceAvailable() && injectedPublicConfig.giftReportServiceAvailable === true; },
    giftPaymentVersions: function () { return Object.assign({}, REPORT_PAYMENT_VERSIONS); },
    giftCall: function (path, body, options) {
      options = options || {};
      if (typeof path !== 'string' || path.length > 1200 || path.includes('#') ||
          Object.keys(options).some(function (key) { return key !== 'anonymous'; }) || options.anonymous !== undefined && typeof options.anonymous !== 'boolean') return Promise.reject(reportClientError('GIFT_REQUEST_INVALID'));
      var pathname = path.split('?')[0];
      if (!/^\/synastry\/(?:gifts(?:\/(?:orders|inspect|[a-f0-9]{64}(?:\/(?:order|share|retry|refund))?))?|gift-claims(?:\/prepare)?)$/.test(pathname)) return Promise.reject(reportClientError('GIFT_REQUEST_INVALID'));
      if (path.includes('?')) {
        if (pathname !== '/synastry/gifts' || body !== undefined) return Promise.reject(reportClientError('GIFT_REQUEST_INVALID'));
        var params = new URLSearchParams(path.slice(path.indexOf('?')+1)), seen = new Set(), invalid = false;
        params.forEach(function(value,key) {
          if (seen.has(key)) invalid = true;
          seen.add(key);
          if (key === 'limit') { if (!/^[1-9][0-9]?$/.test(value) || Number(value)>50) invalid = true; }
          else if (key === 'cursor') { if (value.length>512 || !/^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value)) invalid = true; }
          else invalid = true;
        });
        if (invalid || !seen.size) return Promise.reject(reportClientError('GIFT_REQUEST_INVALID'));
      }
      if (!privateReportServiceAvailable() || injectedPublicConfig.giftReportServiceAvailable !== true) return Promise.reject(reportClientError('GIFT_SERVICE_UNAVAILABLE'));
      var read = pathname === '/synastry/gifts' || /^\/synastry\/gifts\/[a-f0-9]{64}(?:\/order)?$/.test(pathname);
      if (read && body !== undefined || !read && (!body || typeof body !== 'object' || Array.isArray(body))) return Promise.reject(reportClientError('GIFT_REQUEST_INVALID'));
      if (options.anonymous === true) {
        if (path !== '/synastry/gifts/inspect' || Object.keys(body).some(function (key) { return key !== 'token'; }) || !/^[a-f0-9]{64}$/.test(body.token || '')) return Promise.reject(reportClientError('GIFT_REQUEST_INVALID'));
        return api(path, {method:'POST',anonymous:true,noSessionRetry:true,body:{token:body.token}});
      }
      if (path === '/synastry/gifts/orders' && !paidReportPurchaseReady()) return Promise.reject(reportClientError('REPORT_SALES_NOT_APPROVED'));
      return privateReportMutation(path, read ? {method:'GET'} : {method:'POST',body:body});
    },
    synastryCall: function (path, body) {
      var allowed = /^\/synastry\/(?:profile|records|lookup|participants(?:\/(?:self|revoke))?|pair-slot|invitations|invitations\/inspect|invitations\/accept|invitations\/[a-f0-9]{64}\/revoke|pairs\/[a-f0-9]{64}(?:\/(?:retry|unlink|support|report))?|managed-pairs(?:\/[a-f0-9]{64}(?:\/remove)?)?)$/;
      if (typeof path !== 'string' || path.length > 1200 || path.includes('#')) return Promise.reject(reportClientError('SYN_REQUEST_INVALID'));
      var pathname = path.split('?')[0];
      if (!allowed.test(pathname)) return Promise.reject(reportClientError('SYN_REQUEST_INVALID'));
      if (path.includes('?')) {
        if (!['/synastry/records','/synastry/managed-pairs','/synastry/pair-slot'].includes(pathname) || body !== undefined) return Promise.reject(reportClientError('SYN_REQUEST_INVALID'));
        var params = new URLSearchParams(path.slice(path.indexOf('?')+1)), seen = new Set(), invalid = false;
        params.forEach(function(value,key) {
          if (seen.has(key)) invalid = true;
          seen.add(key);
          if(pathname==='/synastry/pair-slot'){if(key!=='report_id'||!/^[a-f0-9]{48}$/.test(value))invalid=true;}
          else if (key === 'kind') { if (pathname !== '/synastry/records' || !['all','invitations','pairs','gifts'].includes(value)) invalid = true; }
          else if (key === 'limit') { if (!/^[1-9][0-9]?$/.test(value) || Number(value)>50) invalid = true; }
          else if (key === 'cursor') { if (!/^[A-Za-z0-9_.-]{1,512}$/.test(value)) invalid = true; }
          else invalid = true;
        });
        if (invalid || !seen.size || pathname==='/synastry/pair-slot'&&(seen.size!==1||!seen.has('report_id'))) return Promise.reject(reportClientError('SYN_REQUEST_INVALID'));
      }
      if(pathname==='/synastry/pair-slot'&&!path.includes('?')||pathname==='/synastry/participants/self'&&body!==undefined)return Promise.reject(reportClientError('SYN_REQUEST_INVALID'));
      var read = pathname === '/synastry/pair-slot' || pathname === '/synastry/participants/self' || pathname === '/synastry/profile' || pathname === '/synastry/records' || (pathname === '/synastry/managed-pairs' && body === undefined) || /^\/synastry\/(?:pairs|managed-pairs)\/[a-f0-9]{64}$/.test(pathname);
      // Reuse account consent, current-owner guard, token refresh and no cross-account mutation replay.
      return privateReportMutation(path, read ? {method:'GET'} : {method:'POST',body:body || {}});
    },
    chartContinuationCall: function (path, body) {
      if (typeof path !== 'string' || !/^\/chart-continuations(?:\/(?:consume|revoke))?$/.test(path) ||
          !body || typeof body !== 'object' || Array.isArray(body)) return Promise.reject(reportClientError('CHART_CONTINUATION_REQUEST_INVALID'));
      if (!privateReportServiceAvailable()) return Promise.reject(reportClientError('REPORT_SERVICE_UNAVAILABLE'));
      if (path === '/chart-continuations/consume') return privateReportMutation(path, {method:'POST',body:body});
      // Creation and revocation bind only a short-lived opaque continuation, never an account session.
      return api(path, {method:'POST',anonymous:true,noSessionRetry:true,body:body});
    },
    configured: function () { return !!API_BASE && accountConsentGranted(); },
    serviceConfigured: function () { return !!API_BASE; },
    paidReportServiceAvailable: privateReportServiceAvailable,
    snapshot: function () {
      return {
        ready: state.ready,
        memberUntil: state.memberUntil,
        cloudSyncEnabled: state.cloudSyncEnabled,
        authenticated: state.authenticated,
        identityKind: state.identityKind,
        accountRef: state.accountRef,
        paymentAvailable: state.paymentAvailable,
        consentRequired: !!API_BASE && !accountConsentGranted()
      };
    },
    ready: function () { return state.ready; },
    start: start,
    whenReady: start,
    token: token,
    freshAccessToken: freshAccessToken,
    isMember: function () { return !!(state.memberUntil && state.memberUntil > Date.now()); },
    memberUntil: function () { return state.memberUntil; },
    cloudSyncEnabled: function () { return state.cloudSyncEnabled; },
    authenticated: function () { return state.authenticated; },
    me: refresh,
    authSession: authSession,
    logout: function () {
      function sendLogout() {
        return api(AUTH_LOGOUT_PATH, { method: 'POST', noSessionRetry: true });
      }
      return sendLogout().catch(function (error) {
        if (!error || error.status !== 401) throw error;
        return refreshAccessToken().then(sendLogout);
      }).then(function () {
        clearPaidAskSessionState();
        clearAccountLocalTraces();
        blockAutomaticOauth();
        clearTokens();
        postAuthMessage({ type: 'clear-access' });
        state.ready = false;
        state.memberUntil = null;
        state.cloudSyncEnabled = false;
        state.authenticated = false;
        state.identityKind = '';
        state.accountRef = '';
        state.paymentAvailable = false;
        return init();
      });
    },
    membershipProducts: function () {
      var error = new Error('legacy membership products are retired');
      error.code = 'LEGACY_MEMBERSHIP_RETIRED';
      return Promise.reject(error);
    },
    createPaymentOrder: function () {
      var error = new Error('legacy browser payment entry is retired; use the JSAPI paid-ask client');
      error.code = 'LEGACY_PAYMENT_ENTRY_RETIRED';
      return Promise.reject(error);
    },
    paymentOrder: function (orderNo) {
      return api('/payments/orders/' + encodeURIComponent(String(orderNo || '')));
    },
    paymentOrders: function () { return api('/payments/orders'); },
    paymentRefunds: function () { return api('/payments/refunds'); },
    requestPaymentRefund: function (input, idempotencyKey) {
      input = input || {};
      return api(
        '/payments/orders/' + encodeURIComponent(String(input.orderNo || '')) + '/refunds',
        {
          method: 'POST',
          headers: { 'Idempotency-Key': String(idempotencyKey || '') },
          body: {
            amount_fen: Number(input.amountFen),
            reason_code: String(input.reasonCode || ''),
            note: input.note == null ? null : String(input.note)
          }
        }
      );
    },
    closePaymentOrder: function (orderNo) {
      return api('/payments/orders/' + encodeURIComponent(String(orderNo || '')) + '/close', { method: 'POST' });
    },
    rememberPaymentOrder: function (orderNo) {
      var value = String(orderNo || '').trim();
      if (/^[a-f0-9]{32}$/i.test(value)) ls(PENDING_PAYMENT_KEY, value);
      return value;
    },
    pendingPaymentOrder: function () {
      var value = ls(PENDING_PAYMENT_KEY) || '';
      return /^[a-f0-9]{32}$/i.test(value) ? value : '';
    },
    forgetPaymentOrder: function (orderNo) {
      var current = ls(PENDING_PAYMENT_KEY) || '';
      if (!orderNo || current === String(orderNo)) drop(PENDING_PAYMENT_KEY);
    },
    // The pre-report cloud-sync and legacy /reports archive methods were removed:
    // no maintained page calls them, and base charts are no longer uploaded.
    profile: function () { return api('/account/profile'); },
    saveProfile: function (name) {
      return api('/account/profile', {
        method: 'POST',
        body: { profile_name: String(name || '').trim() }
      });
    },
    testingStatus: function () { return privateReportApi('/account/testing'); },
    testingGrantReport: function (reportId, confirmation) {
      return privateReportMutation('/account/testing/reports',{method:'POST',body:Object.assign({},confirmation,{reportId:checkedPaidReportId(reportId)})});
    },
    testingGift: function (body) { return privateReportMutation('/account/testing/gifts',{method:'POST',body:body}); },
    paidReportPreview: function (input, confirmation) {
      if (!confirmation || confirmation.transferConfirmed !== true) return Promise.reject(reportClientError('REPORT_TRANSFER_CONFIRMATION_REQUIRED'));
      if (!privateReportServiceAvailable()) return Promise.reject(reportClientError('REPORT_SERVICE_UNAVAILABLE'));
      return api('/report-preview', {method:'POST', anonymous:true, noSessionRetry:true,
        body:{input:checkedReportInput(input),transfer_confirmed:true}});
    },
    paidReportPrepare: function (input, confirmation) {
      confirmation = confirmation || {};
      if (confirmation.transferConfirmed !== true) return Promise.reject(reportClientError('REPORT_TRANSFER_CONFIRMATION_REQUIRED'));
      if (confirmation.storageConfirmed !== true) return Promise.reject(reportClientError('REPORT_STORAGE_CONFIRMATION_REQUIRED'));
      if (typeof confirmation.subjectIsSelf !== 'boolean' || (!confirmation.subjectIsSelf && confirmation.permissionConfirmed !== true)) {
        return Promise.reject(reportClientError('REPORT_SUBJECT_PERMISSION_REQUIRED'));
      }
      return privateReportMutation('/paid-reports/prepare', {method:'POST',body:{input:checkedReportInput(input),
        transfer_confirmed:true,storage_confirmed:true,subject_is_self:confirmation.subjectIsSelf,
        permission_confirmed:confirmation.permissionConfirmed === true}});
    },
    paidReportList: function (options) {
      options = options || {}; var query = '';
      if (options.before !== undefined) {
        if (!Number.isSafeInteger(options.before) || options.before < 1) return Promise.reject(reportClientError('REPORT_REQUEST_INVALID'));
        query = '?before=' + options.before;
      }
      return privateReportApi('/paid-reports' + query);
    },
    paidReportRead: function (id, view) {
      if (view !== undefined && view !== 'status') return Promise.reject(reportClientError('REPORT_REQUEST_INVALID'));
      return privateReportApi('/paid-reports/' + checkedPaidReportId(id) + (view === 'status' ? '?view=status' : ''));
    },
    paidReportRetry: function (id) { return privateReportApi('/paid-reports/' + checkedPaidReportId(id) + '/retry', {method:'POST',body:{}}); },
    paidReportDelete: function (id, confirmation) {
      if (!confirmation || confirmation.confirmed !== true) return Promise.reject(reportClientError('REPORT_DELETE_CONFIRMATION_REQUIRED'));
      return privateReportMutation('/paid-reports/' + checkedPaidReportId(id), {method:'DELETE',body:{confirmed:true}});
    },
    paidReportCorrect: function (id, input, confirmation, idempotencyKey) {
      confirmation = confirmation || {};
      if (confirmation.transferConfirmed !== true) return Promise.reject(reportClientError('REPORT_TRANSFER_CONFIRMATION_REQUIRED'));
      if (confirmation.storageConfirmed !== true) return Promise.reject(reportClientError('REPORT_STORAGE_CONFIRMATION_REQUIRED'));
      if (typeof confirmation.subjectIsSelf !== 'boolean' || (!confirmation.subjectIsSelf && confirmation.permissionConfirmed !== true)) return Promise.reject(reportClientError('REPORT_SUBJECT_PERMISSION_REQUIRED'));
      if (confirmation.discardPreviousConfirmed !== true) return Promise.reject(reportClientError('REPORT_CORRECTION_CONFIRMATION_REQUIRED'));
      if (typeof idempotencyKey !== 'string' || !/^[a-z0-9._:-]{16,128}$/i.test(idempotencyKey)) return Promise.reject(reportClientError('REPORT_REQUEST_INVALID'));
      return privateReportMutation('/paid-reports/' + checkedPaidReportId(id) + '/correct', {method:'POST',headers:{'Idempotency-Key':idempotencyKey},
        body:{input:checkedReportInput(input),transfer_confirmed:true,storage_confirmed:true,subject_is_self:confirmation.subjectIsSelf,
          permission_confirmed:confirmation.permissionConfirmed===true,discard_previous_confirmed:true}});
    },
    accountClosure: function () { return privateReportApi('/account/closure'); },
    paidReportPurchaseReady: paidReportPurchaseReady,
    paidAskCreateOrder: paidAskCreateOrder,
    paidReportCreateOrder: function (id, confirmation, idempotencyKey) {
      if (!paidReportPurchaseReady()) return Promise.reject(reportClientError('REPORT_SALES_NOT_APPROVED'));
      if (!/MicroMessenger/i.test(navigator.userAgent || '')) return Promise.reject(reportClientError('WECHAT_BROWSER_REQUIRED'));
      confirmation = confirmation || {};
      if (confirmation.policyConsent !== true) return Promise.reject(reportClientError('PAYMENT_CONSENT_REQUIRED'));
      if (confirmation.adultConfirmed !== true) return Promise.reject(reportClientError('PAYMENT_ADULT_CONFIRMATION_REQUIRED'));
      if (typeof idempotencyKey !== 'string' || !/^[a-f0-9]{32}$/.test(idempotencyKey)) return Promise.reject(reportClientError('PAYMENT_IDEMPOTENCY_KEY_INVALID'));
      return privateReportMutation('/payments/orders', {method:'POST',headers:{'Idempotency-Key':idempotencyKey},body:{
        product_code:'deep_report_v1',paid_report_id:checkedPaidReportId(id),channel:'wechatpay_jsapi',consent:true,adult_confirmed:true,
        agreement_version:REPORT_PAYMENT_VERSIONS.agreementVersion,privacy_version:REPORT_PAYMENT_VERSIONS.privacyVersion,
        membership_terms_version:REPORT_PAYMENT_VERSIONS.membershipTermsVersion,refund_policy_version:REPORT_PAYMENT_VERSIONS.refundPolicyVersion,
        ai_disclosure_version:REPORT_PAYMENT_VERSIONS.aiDisclosureVersion,purchase_notice_version:REPORT_PAYMENT_VERSIONS.purchaseNoticeVersion
      }});
    },
    paidReportProducts: function (id, kind) {
      if (kind !== undefined && kind !== 'report' && kind !== 'ask') return Promise.reject(reportClientError('REPORT_REQUEST_INVALID'));
      return privateReportApi('/' + (kind === 'ask' ? 'ask' : 'report') + '/products?report_id=' + checkedPaidReportId(id));
    },
    paidReportBalance: function (id) { return privateReportApi('/deep/peek', {method:'POST',body:{report_id:checkedPaidReportId(id)}}); },
    wechatOAuthStart: function (returnPath) {
      if (!accountConsentGranted()) return Promise.reject(reportClientError('PRIVACY_CONSENT_REQUIRED'));
      if (!['/account.html','/checkout.html'].includes(returnPath)) return Promise.reject(reportClientError('REPORT_REQUEST_INVALID'));
      return api('/auth/wechat/oauth/start', {method:'POST',anonymous:true,noSessionRetry:true,body:{return_path:returnPath}});
    },
    deepPeek: function (reportId) { return privateReportsPage() ? this.paidReportBalance(reportId) : api('/deep/peek', { method: 'POST' }); },
    deepSave: function () {
      var error = new Error('browser-side answer persistence is retired');
      error.code = 'BROWSER_DEEP_SAVE_RETIRED';
      return Promise.reject(error);
    },
    deepHistory: function () { return api('/deep/history'); },
    // No bulk history deletion is exposed; each answer is deleted after confirmation.
    deleteDeepAnswer: function (id) {
      if (typeof id !== 'string' || !/^[a-f0-9]{48}$/.test(id)) return Promise.reject(reportClientError('ASK_RESULT_NOT_FOUND'));
      return ownerBoundRequest('/deep/history/' + id, { method: 'DELETE' });
    },
    deleteAccount: function (confirmation) {
      var privateMode = privateReportsPage();
      var closureOwner = state.accountRef;
      if (privateMode && (!confirmation || confirmation.confirmed !== true || confirmation.refundBeforeDelete !== true || confirmation.irreversibleConfirmed !== true)) {
        return Promise.reject(reportClientError('ACCOUNT_CLOSURE_CONFIRMATION_REQUIRED'));
      }
      var request = privateMode ? privateReportMutation('/account', {method:'DELETE',body:{confirmed:true,refund_before_delete:true,irreversible_confirmed:true}}) : api('/account', {method:'DELETE'});
      return request.then(function (result) {
        if (privateMode && (!closureOwner || !state.authenticated || state.accountRef !== closureOwner)) throw reportClientError('REPORT_ACCOUNT_CHANGED');
        if (privateMode && result.status === 'closure_pending') return result;
        if (privateMode && (result.status !== 'completed' || result.ok !== true || result.recoverable !== false)) throw reportClientError('ACCOUNT_CLOSURE_RESPONSE_INVALID');
        clearPaidAskSessionState();
        clearAccountLocalTraces();
        blockAutomaticOauth();
        clearTokens();
        postAuthMessage({ type: 'clear-access' });
        drop('zx_cid');
        state.ready = false;
        state.memberUntil = null;
        state.cloudSyncEnabled = false;
        state.authenticated = false;
        state.identityKind = '';
        state.accountRef = '';
        state.paymentAvailable = false;
        return result;
      });
    }
  };
})();
