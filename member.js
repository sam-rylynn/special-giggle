/* member.js — 会员账号客户端最小接入层
 * API_BASE 留空时完全关闭。生产页不接受 ?api= 覆盖;本地调试仅允许本地页指向 localhost/127.0.0.1。
 * 浏览器只做账号初始化、会员态查询与 /deep/peek 预闸;真正 /deep/consume 与 /deep/refund 只能由深问后端服务间调用。
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
  function cid() {
    var v = ls('zx_cid');
    if (!v) {
      v = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
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
        if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
        return data;
      });
    });
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
    token: token,
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
    deleteAccount: function () { return api('/account', { method: 'DELETE' }); }
  };

  init();
})();
