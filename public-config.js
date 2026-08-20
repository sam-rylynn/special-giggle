/*
 * 知星前端公开配置。
 *
 * 这里只允许填写可公开的信息；任何 SecretKey、APIv3 Key、证书私钥、
 * 短信验证码或服务端 AppSecretKey 都不得进入本文件。
 *
 * TCaptcha AppId 仍须在腾讯云控制台创建后填写；留空会让手机号登录失败关闭。
 */
(function () {
  'use strict';

  window.ZX_PUBLIC_CONFIG = Object.freeze({
    launchMode: 'share-free',
    paidH5Enabled: false,
    accountApiBase: 'https://api.zhixng.cn',
    analyticsEnabled: false,
    analyticsEndpoint: '',
    captchaAppId: '',
    deepServiceAvailable: false,
    deepApiUrl: '',
    paymentOrigin: 'https://zhixng.cn',
    merchantLegalName: '贵州天云稀泉科技有限公司',
    supportUrl: 'https://zhixng.cn/privacy.html#contact',
    refundUrl: 'https://zhixng.cn/refund-policy.html',
    userAgreementUrl: 'https://zhixng.cn/terms.html',
    membershipRulesUrl: 'https://zhixng.cn/membership-rules.html',
    privacyUrl: 'https://zhixng.cn/privacy.html',
    aiDisclosureUrl: 'https://zhixng.cn/ai-disclosure.html',
    purchaseNoticeUrl: 'https://zhixng.cn/purchase-notice.html',
    agreementVersion: 'user-agreement-2026.08.03-v2',
    privacyVersion: 'privacy-2026.08.03-v2',
    membershipTermsVersion: 'membership-2026.08.03-v2',
    refundPolicyVersion: 'refund-2026.08.03-v2',
    aiDisclosureVersion: 'ai-disclosure-2026.08.03-v2',
    purchaseNoticeVersion: 'purchase-notice-2026.08.03-v2'
  });
})();
