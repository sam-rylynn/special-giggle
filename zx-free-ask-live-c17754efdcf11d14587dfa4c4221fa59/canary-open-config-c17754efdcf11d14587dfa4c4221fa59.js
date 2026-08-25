/* Temporary public canary configuration. Contains no secret. Delete after the one-shot test. */
(function () {
  'use strict';
  const runtime = Object.freeze({
    launchMode: 'share-free-canary',
    paidH5Enabled: false,
    accountApiBase: '',
    analyticsEnabled: false,
    analyticsEndpoint: '',
    captchaAppId: '198990533',
    freeAskStarPilotEnabled: true,
    pilotGrantApiUrl: 'https://api.zhixng.cn/pilot',
    deepServiceAvailable: true,
    deepApiUrl: 'https://api.zhixng.cn/ai/deep',
    paymentOrigin: '',
    refundUrl: '',
    membershipRulesUrl: '',
    purchaseNoticeUrl: ''
  });
  window.ZX_PUBLIC_CONFIG = runtime;
  window.ZX_LIVE_CANARY_CONFIG = Object.freeze({
    canaryId: 'c17754efdcf11d14587dfa4c4221fa59',
    expiresAt: '2026-08-25T10:31:13.490Z',
    pilotApi: runtime.pilotGrantApiUrl,
    deepApi: runtime.deepApiUrl
  });
})();
