/* Generated local static canary candidate. Public values only; random path is not authentication. */
(function () {
  'use strict';

  const GENERATED_AT = "2026-08-25T08:31:13.490Z";
  const EXPIRES_AT = "2026-08-25T10:31:13.490Z";
  const EXPIRES_AT_MS = Date.parse(EXPIRES_AT);
  const PATH_SEGMENT = "zx-free-ask-static-47d95d2f217e0449267f7f3b9fc98da7";
  const CAPTCHA_APP_ID = "198990533";
  const PILOT_API_URL = "https://api.zhixng.cn/pilot";
  const DEEP_API_URL = "https://api.zhixng.cn/ai/deep";
  const pathMatches = () => {
    try { return String(window.location.pathname || '').split('/').includes(PATH_SEGMENT); }
    catch (_) { return false; }
  };
  const isActive = () => pathMatches() && Date.now() < EXPIRES_AT_MS;
  const activeAtLoad = isActive();

  window.ZX_PUBLIC_CONFIG = Object.freeze({
    launchMode: 'share-free',
    paidH5Enabled: false,
    accountApiBase: 'https://api.zhixng.cn',
    analyticsEnabled: false,
    analyticsEndpoint: '',
    get captchaAppId() { return isActive() ? CAPTCHA_APP_ID : ''; },
    get freeAskStarPilotEnabled() { return isActive(); },
    get pilotGrantApiUrl() { return isActive() ? PILOT_API_URL : ''; },
    get deepServiceAvailable() { return isActive(); },
    get deepApiUrl() { return isActive() ? DEEP_API_URL : ''; },
    paymentOrigin: 'https://zhixng.cn',
    merchantLegalName: '贵州天云稀泉科技有限公司',
    supportUrl: 'https://zhixng.cn/privacy.html',
    refundUrl: '',
    userAgreementUrl: 'https://zhixng.cn/terms.html',
    membershipRulesUrl: '',
    privacyUrl: 'https://zhixng.cn/privacy.html',
    aiDisclosureUrl: 'https://zhixng.cn/ai-disclosure.html',
    purchaseNoticeUrl: '',
    agreementVersion: 'user-agreement-2026.08.25-free-ask-v2',
    privacyVersion: 'privacy-2026.08.25-free-ask-v3',
    membershipTermsVersion: '',
    refundPolicyVersion: '',
    aiDisclosureVersion: 'ai-disclosure-2026.08.25-free-ask-v3',
    purchaseNoticeVersion: '',
    canaryGeneratedAt: GENERATED_AT,
    canaryExpiresAt: EXPIRES_AT,
    canaryPathPrefix: '/' + PATH_SEGMENT + '/',
    canaryRandomPathIsAuthentication: false,
    get canaryActive() { return isActive(); }
  });

  const originalFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  if (originalFetch) {
    window.fetch = function (input, init) {
      let target = '';
      try { target = String(input && input.url || input || ''); } catch (_) {}
      if (!isActive() && (target.startsWith(PILOT_API_URL) || target.startsWith(DEEP_API_URL))) {
        return Promise.reject(new Error('CANARY_EXPIRED'));
      }
      return originalFetch(input, init);
    };
  }

  if (activeAtLoad) {
    const enforceExpiry = () => { if (!isActive()) window.location.reload(); };
    window.setTimeout(enforceExpiry, Math.max(0, EXPIRES_AT_MS - Date.now()) + 25);
    window.addEventListener('pageshow', enforceExpiry);
    window.addEventListener('focus', enforceExpiry);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') enforceExpiry();
    });
  }
})();
