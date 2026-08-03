/* privacy-consent.js — 知星前端隐私选择与本机资料控制
 * 只记录用户在当前浏览器中的选择；不把同意本身上传到服务端。
 */
(function () {
  'use strict';

  var NOTICE_VERSION = '2026-08-03.2';
  var CHOICES_KEY = 'zx_privacy_choices_v1';
  var EXPORT_KEYS = [
    'zx_input',
    'zx_saved_reports_v1',
    'zx_profile_name_v1',
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
    writeChoices(saved);
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

  function clearAllLocalData() {
    var keys = [];
    try {
      for (var i = 0; i < localStorage.length; i += 1) {
        var key = localStorage.key(i);
        if (key && key.indexOf('zx_') === 0) keys.push(key);
      }
      keys.forEach(function (key) { localStorage.removeItem(key); });
    } catch (_) {}
    return keys;
  }

  window.ZxPrivacyConsent = {
    noticeVersion: NOTICE_VERSION,
    choicesKey: CHOICES_KEY,
    has: has,
    grant: grant,
    revoke: revoke,
    snapshot: readChoices,
    exportLocalData: exportLocalData,
    clearAllLocalData: clearAllLocalData
  };
})();
