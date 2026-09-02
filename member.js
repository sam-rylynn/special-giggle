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
      return /^https?:$/.test(u.protocol) && isLocalDebugHost(u.hostname) ? u.href.replace(/\/+$/, '') : '';
    } catch (_) {
      return '';
    }
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
    dropSession(PAID_ASK_PENDING_KEY);
    dropSession(PAID_ASK_PURCHASE_KEY);
    dropSession(PAID_ASK_IDENTITY_RESUME_KEY);
    drop(PENDING_PAYMENT_KEY);
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

  function rawRefreshAccessToken() {
    return api(AUTH_SESSION_REFRESH_PATH, {
      method: 'POST',
      noSessionRetry: true
    }).then(saveTokens).then(function (data) {
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
    var tok = token();
    if (tok) headers.authorization = 'Bearer ' + tok;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = controller ? setTimeout(function () { controller.abort(); }, 20000) : null;
    return fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      credentials: 'include',
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
      if (error && error.status === 401 && opts.noSessionRetry !== true &&
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
      state.authenticated = data.authenticated === true &&
        data.wechat_authenticated === true && identityKind === 'wechat';
      state.identityKind = state.authenticated ? identityKind : '';
      state.accountRef = state.authenticated && /^[a-f0-9]{64}$/.test(String(data.account_ref || ''))
        ? String(data.account_ref)
        : '';
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

  window.zxMember = {
    configured: function () { return !!API_BASE && accountConsentGranted(); },
    serviceConfigured: function () { return !!API_BASE; },
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
    enableCloudSync: function () {
      return api('/account/cloud-sync', { method: 'POST', body: { enabled: true, confirmed: true } })
        .then(function (data) { state.cloudSyncEnabled = true; return data; });
    },
    disableCloudSync: function () {
      return api('/account/cloud-sync', { method: 'POST', body: { enabled: false } })
        .then(function (data) { state.cloudSyncEnabled = false; return data; });
    },
    profile: function () { return api('/account/profile'); },
    saveProfile: function (name) {
      return api('/account/profile', {
        method: 'POST',
        body: { profile_name: String(name || '').trim() }
      });
    },
    syncChart: function (payload) { return api('/charts/sync', { method: 'POST', body: { payload: payload } }); },
    loadChart: function () { return api('/charts').then(function (data) { return data.chart; }); },
    reports: function () { return api('/reports'); },
    saveReport: function (input) {
      input = input || {};
      return api('/reports', {
        method: 'POST',
        body: {
          display_name: String(input.displayName || ''),
          relation_label: String(input.relation || ''),
          is_primary: input.primary === true,
          storage_confirmed: input.storageConfirmed === true,
          permission_confirmed: input.permissionConfirmed === true,
          payload: normalizeChartPayload(input.payload)
        }
      });
    },
    deleteReport: function (reportId) {
      return api('/reports/' + encodeURIComponent(String(reportId || '')), { method: 'DELETE' });
    },
    deepPeek: function () { return api('/deep/peek', { method: 'POST' }); },
    deepSave: function () {
      var error = new Error('browser-side answer persistence is retired');
      error.code = 'BROWSER_DEEP_SAVE_RETIRED';
      return Promise.reject(error);
    },
    deepHistory: function () { return api('/deep/history'); },
    deleteDeepAnswer: function (id) { return api('/deep/history/' + encodeURIComponent(id), { method: 'DELETE' }); },
    clearDeepHistory: function () { return api('/deep/history', { method: 'DELETE' }); },
    deleteAccount: function () {
      return api('/account', { method: 'DELETE' }).then(function (result) {
        clearPaidAskSessionState();
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
