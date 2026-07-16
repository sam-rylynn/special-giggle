/* member.js — 会员账号客户端最小接入层
 * API_BASE 留空时完全关闭。生产页不接受 ?api= 覆盖;本地调试仅允许本地页指向 localhost/127.0.0.1。
 * 浏览器只做账号初始化、会员态查询、分享交付与 /deep/peek 预闸;
 * 真正 /deep/consume 与 /deep/refund 只能由深问后端服务间调用。
 */
(function () {
  'use strict';

  var API_BASE = '';

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

  API_BASE = localDebugUrlParam('api') || API_BASE;

  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
      return v;
    } catch (_) {
      return null;
    }
  }
  function drop(k) {
    try { localStorage.removeItem(k); } catch (_) {}
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
    return ls('zx_token') || '';
  }

  function api(path, opts) {
    if (!API_BASE) return Promise.reject(new Error('no api'));
    opts = opts || {};
    var headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
    var tok = token();
    if (tok) headers.authorization = 'Bearer ' + tok;
    return fetch(API_BASE + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var error = new Error(data.error || ('HTTP ' + r.status));
          error.status = r.status;
          error.data = data;
          throw error;
        }
        return data;
      });
    });
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

  function chartRef(payload) {
    if (!window.crypto || !window.crypto.subtle || typeof TextEncoder !== 'function') {
      return Promise.reject(new Error('secure digest unavailable'));
    }
    var normalized = normalizeChartPayload(payload);
    var source = [normalized.d, normalized.t, normalized.c, normalized.g].join('\n');
    return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
      .then(function (buffer) {
        return Array.prototype.map.call(new Uint8Array(buffer), function (item) {
          return item.toString(16).padStart(2, '0');
        }).join('');
      });
  }

  function storedAccess() {
    try { return JSON.parse(ls('zx_report_access') || 'null'); } catch (_) { return null; }
  }

  function saveAccess(data) {
    if (!data || !data.allowed || !data.access_token) return data;
    ls('zx_report_access', JSON.stringify({
      chart_ref: data.chart_ref,
      access_token: data.access_token,
      expires_at: data.expires_at
    }));
    return data;
  }

  var state = { ready: false, memberUntil: null, cloudSyncEnabled: false };

  function refresh() {
    return api('/account/me').then(function (data) {
      state.memberUntil = data.member_until || null;
      state.cloudSyncEnabled = !!data.cloud_sync_enabled;
      state.ready = true;
      return data;
    });
  }

  function init() {
    if (!API_BASE) return Promise.resolve(state);
    return api('/account/init', { method: 'POST', body: { device_id: cid() } })
      .then(function (data) {
        if (data.token) ls('zx_token', data.token);
        state.memberUntil = data.member_until || null;
        state.ready = true;
        return refresh().catch(function () { return state; });
      })
      .catch(function () { return state; });
  }

  var initPromise = init();

  window.zxMember = {
    configured: function () { return !!API_BASE; },
    snapshot: function () {
      return {
        ready: state.ready,
        memberUntil: state.memberUntil,
        cloudSyncEnabled: state.cloudSyncEnabled
      };
    },
    ready: function () { return state.ready; },
    whenReady: function () { return initPromise; },
    token: token,
    chartRef: chartRef,
    isMember: function () { return !!(state.memberUntil && state.memberUntil > Date.now()); },
    memberUntil: function () { return state.memberUntil; },
    cloudSyncEnabled: function () { return state.cloudSyncEnabled; },
    me: refresh,
    enableCloudSync: function () {
      return api('/account/cloud-sync', { method: 'POST', body: { enabled: true, confirmed: true } })
        .then(function (data) { state.cloudSyncEnabled = true; return data; });
    },
    disableCloudSync: function () {
      return api('/account/cloud-sync', { method: 'POST', body: { enabled: false } })
        .then(function (data) { state.cloudSyncEnabled = false; return data; });
    },
    syncChart: function (payload) { return api('/charts/sync', { method: 'POST', body: { payload: payload } }); },
    loadChart: function () { return api('/charts').then(function (data) { return data.chart; }); },
    deepPeek: function () { return api('/deep/peek', { method: 'POST' }); },
    deepSave: function (question, answer, contextSummary) {
      return api('/deep/save', {
        method: 'POST',
        body: { question: question, answer: answer, context_summary: contextSummary || [] }
      });
    },
    deepHistory: function () { return api('/deep/history'); },
    deleteDeepAnswer: function (id) { return api('/deep/history/' + encodeURIComponent(id), { method: 'DELETE' }); },
    clearDeepHistory: function () { return api('/deep/history', { method: 'DELETE' }); },
    createShareIntent: function (ref) {
      return api('/share/intents', { method: 'POST', body: { chart_ref: ref } });
    },
    confirmShare: function (shareToken) {
      return api('/share/confirm', { method: 'POST', body: { share_token: shareToken } });
    },
    shareStatus: function () { return api('/share/status'); },
    issueReportAccess: function (ref) {
      return api('/share/report-access', { method: 'POST', body: { chart_ref: ref } }).then(saveAccess);
    },
    verifyStoredReportAccess: function (ref) {
      var access = storedAccess();
      if (!access || access.chart_ref !== ref || !access.access_token || Number(access.expires_at) <= Date.now()) {
        return Promise.resolve({ allowed: false, reason: 'missing_access' });
      }
      return api('/share/report-access/verify', {
        method: 'POST',
        body: { chart_ref: ref, access_token: access.access_token }
      }).then(function (result) {
        if (!result.allowed) drop('zx_report_access');
        return result;
      });
    },
    deleteAccount: function () {
      return api('/account', { method: 'DELETE' }).then(function (result) {
        drop('zx_token');
        drop('zx_cid');
        drop('zx_report_access');
        state.ready = false;
        state.memberUntil = null;
        state.cloudSyncEnabled = false;
        return result;
      });
    }
  };
})();
