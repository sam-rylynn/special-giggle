(function (global) {
  'use strict';

  const STORAGE_KEY = 'zx_free_ask_star_pilot_v1';
  const BROWSER_KEY = 'zx_free_ask_star_browser_v1';
  const TOKEN_RE = /^zx_p_[A-Za-z0-9_-]{43}$/;
  const BROWSER_RE = /^zx_b_[A-Za-z0-9_-]{43}$/;
  const REF_RE = /^[a-f0-9]{64}$/;
  let captchaScriptPromise = null;

  function config() {
    const value = global.ZX_PUBLIC_CONFIG;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function trustedHttpsUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw);
      const host = url.hostname.toLowerCase().replace(/\.$/, '');
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
          (host !== 'zhixng.cn' && !host.endsWith('.zhixng.cn'))) return '';
      return url.href.replace(/\/+$/, '');
    } catch (_) { return ''; }
  }

  function endpoint() {
    if (config().freeAskStarPilotEnabled !== true) return '';
    return trustedHttpsUrl(config().pilotGrantApiUrl);
  }

  function captchaAppId() {
    const value = String(config().captchaAppId || '').trim();
    return /^[1-9]\d{5,15}$/.test(value) ? value : '';
  }

  function randomBase64Url(bytesLength) {
    if (!global.crypto || typeof global.crypto.getRandomValues !== 'function') {
      throw new Error('SECURE_RANDOM_UNAVAILABLE');
    }
    const bytes = new Uint8Array(bytesLength);
    global.crypto.getRandomValues(bytes);
    let binary = '';
    bytes.forEach(value => { binary += String.fromCharCode(value); });
    return global.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function randomHex(bytesLength) {
    if (!global.crypto || typeof global.crypto.getRandomValues !== 'function') {
      throw new Error('SECURE_RANDOM_UNAVAILABLE');
    }
    const bytes = new Uint8Array(bytesLength);
    global.crypto.getRandomValues(bytes);
    return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  }

  function getItem(key) {
    try { return global.localStorage.getItem(key); } catch (_) { return null; }
  }

  function setItem(key, value) {
    try { global.localStorage.setItem(key, value); return true; } catch (_) { return false; }
  }

  function browserId() {
    let value = getItem(BROWSER_KEY) || '';
    if (BROWSER_RE.test(value)) return value;
    value = `zx_b_${randomBase64Url(32)}`;
    if (!setItem(BROWSER_KEY, value)) throw new Error('PILOT_STORAGE_UNAVAILABLE');
    return value;
  }

  function receipt(input) {
    const controller = global.ZxReportShareUnlock;
    if (!controller || typeof controller.pilotReceipt !== 'function') return null;
    const value = controller.pilotReceipt(input);
    return value && REF_RE.test(String(value.chartRef || '')) ? value : null;
  }

  function readGrant(input) {
    const proof = receipt(input);
    if (!proof) return null;
    try {
      const value = JSON.parse(getItem(STORAGE_KEY) || 'null');
      if (!value || value.chartRef !== proof.chartRef || !TOKEN_RE.test(String(value.token || '')) ||
          !Number.isFinite(Number(value.expiresAt)) || Number(value.expiresAt) <= Date.now()) return null;
      return value;
    } catch (_) { return null; }
  }

  function saveGrant(proof, data) {
    const value = {
      chartRef: proof.chartRef,
      token: String(data.grant_token || ''),
      grantDay: String(data.grant_day || ''),
      expiresAt: Number(data.expires_at || 0),
      quota: {
        initial: !!(data.quota && data.quota.initial),
        followup: !!(data.quota && data.quota.followup)
      }
    };
    if (!TOKEN_RE.test(value.token) || !value.expiresAt || !setItem(STORAGE_KEY, JSON.stringify(value))) {
      throw new Error('PILOT_STORAGE_UNAVAILABLE');
    }
    return Object.freeze(value);
  }

  function loadCaptcha() {
    if (typeof global.TencentCaptcha === 'function') return Promise.resolve();
    if (captchaScriptPromise) return captchaScriptPromise;
    captchaScriptPromise = new Promise((resolve, reject) => {
      const script = global.document.createElement('script');
      let settled = false;
      const timer = global.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('CAPTCHA_SCRIPT_TIMEOUT'));
      }, 10000);
      script.src = 'https://turing.captcha.qcloud.com/TJCaptcha.js';
      script.async = true;
      script.referrerPolicy = 'origin';
      script.onload = () => {
        if (settled) return;
        settled = true;
        global.clearTimeout(timer);
        if (typeof global.TencentCaptcha === 'function') resolve();
        else reject(new Error('CAPTCHA_SCRIPT_INVALID'));
      };
      script.onerror = () => {
        if (settled) return;
        settled = true;
        global.clearTimeout(timer);
        reject(new Error('CAPTCHA_SCRIPT_UNAVAILABLE'));
      };
      global.document.head.appendChild(script);
    }).catch(error => {
      captchaScriptPromise = null;
      throw error;
    });
    return captchaScriptPromise;
  }

  async function runCaptcha(aid) {
    const appId = captchaAppId();
    if (!appId) throw new Error('CAPTCHA_NOT_CONFIGURED');
    if (!aid || typeof aid.aid_encrypted !== 'string' || aid.aid_encrypted_type !== 'gcm' ||
        !Number.isFinite(Number(aid.expires_at)) || Number(aid.expires_at) <= Date.now()) {
      throw new Error('CAPTCHA_AID_INVALID');
    }
    await loadCaptcha();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        if (error) reject(error); else resolve(value);
      };
      try {
        const captcha = new global.TencentCaptcha(appId, result => {
          result = result || {};
          if (Number(result.ret) === 0 && result.ticket && result.randstr) {
            finish(null, { ticket:String(result.ticket), randstr:String(result.randstr) });
          } else {
            finish(new Error(Number(result.ret) === 2 ? 'CAPTCHA_CANCELLED' : 'CAPTCHA_REJECTED'));
          }
        }, {
          userLanguage:'zh-cn',
          aidEncrypted:aid.aid_encrypted,
          aidEncryptedType:aid.aid_encrypted_type
        });
        captcha.show();
      } catch (_) { finish(new Error('CAPTCHA_UNAVAILABLE')); }
    });
  }

  async function postGrant(path, body) {
    const base = endpoint();
    if (!base) throw new Error('PILOT_NOT_CONFIGURED');
    const controller = new AbortController();
    const timer = global.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await global.fetch(`${base}${path}`, {
        method:'POST',
        headers:{ 'content-type':'application/json' },
        body:JSON.stringify(body),
        credentials:'omit',
        referrerPolicy:'no-referrer',
        signal:controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data && data.error && data.error.code || `HTTP_${response.status}`);
        error.code = error.message;
        error.status = response.status;
        throw error;
      }
      return data;
    } finally { global.clearTimeout(timer); }
  }

  async function ensureGrant(input) {
    const existing = readGrant(input);
    if (existing) return existing;
    const proof = receipt(input);
    if (!proof) throw new Error('RESHARE_REQUIRED');
    const aid = await postGrant('/captcha-aid', {});
    const risk = await runCaptcha(aid);
    const data = await postGrant('/grant', {
      browser_id:browserId(),
      chart_ref:proof.chartRef,
      share:{ method:proof.method, unlocked_at:proof.unlockedAt },
      risk
    });
    return saveGrant(proof, data);
  }

  function requestContext(input, stage) {
    const grant = readGrant(input);
    if (!grant) return null;
    return Object.freeze({
      token:grant.token,
      chartRef:grant.chartRef,
      stage,
      idempotencyKey:randomHex(16)
    });
  }

  function updateQuota(input, quota, expiresAt) {
    const proof = receipt(input);
    const grant = readGrant(input);
    if (!proof || !grant) return false;
    return !!saveGrant(proof, {
      grant_token:grant.token,
      grant_day:grant.grantDay,
      expires_at:Number(expiresAt || grant.expiresAt),
      quota:quota || {}
    });
  }

  function invalidateGrant(input) {
    const proof = receipt(input);
    if (!proof) return false;
    try {
      const value = JSON.parse(getItem(STORAGE_KEY) || 'null');
      if (!value || value.chartRef !== proof.chartRef) return false;
      global.localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (_) { return false; }
  }

  function status(input) {
    const proof = receipt(input);
    const grant = readGrant(input);
    return Object.freeze({
      configured:!!endpoint() && !!captchaAppId(),
      receipt:!!proof,
      granted:!!grant,
      expiresAt:grant ? grant.expiresAt : null,
      quota:grant ? Object.freeze({ ...grant.quota }) : Object.freeze({ initial:true, followup:false })
    });
  }

  global.ZxFreeAskStarPilot = Object.freeze({
    storageKey:STORAGE_KEY,
    ensureGrant,
    requestContext,
    status,
    updateQuota,
    invalidateGrant
  });
})(typeof window !== 'undefined' ? window : globalThis);
