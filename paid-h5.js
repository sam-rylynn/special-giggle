/* paid-h5.js — 手机号账号 + 微信支付 H5 前端。
 * API_BASE 仍由 member.js 统一控制；为空时所有登录、订单和支付动作 fail closed。
 * 微信 H5 仅允许手机外部浏览器。微信内置浏览器和桌面端不得创建 H5 订单。
 */
(function () {
  'use strict';

  var PAYMENT_CONFIG_DEFAULTS = Object.freeze({
    paymentOrigin: '',
    merchantLegalName: '',
    supportUrl: '',
    refundUrl: '',
    userAgreementUrl: '',
    membershipRulesUrl: '',
    privacyUrl: '',
    aiDisclosureUrl: '',
    purchaseNoticeUrl: '',
    agreementVersion: '',
    privacyVersion: '',
    membershipTermsVersion: '',
    refundPolicyVersion: '',
    aiDisclosureVersion: '',
    purchaseNoticeVersion: ''
  });
  var injectedPaymentConfig = window.ZX_PUBLIC_CONFIG || window.ZX_PUBLIC_PAYMENT_CONFIG;
  if (!injectedPaymentConfig || typeof injectedPaymentConfig !== 'object' || Array.isArray(injectedPaymentConfig)) {
    injectedPaymentConfig = {};
  }
  var PUBLIC_PAYMENT_CONFIG = Object.freeze(Object.keys(PAYMENT_CONFIG_DEFAULTS).reduce(function (result, key) {
    result[key] = typeof injectedPaymentConfig[key] === 'string' ? injectedPaymentConfig[key].trim() : '';
    return result;
  }, {}));
  var REQUIRED_POLICY_VERSIONS = Object.freeze({
    agreementVersion: 'user-agreement-2026.08.03-v2',
    privacyVersion: 'privacy-2026.08.03-v2',
    membershipTermsVersion: 'membership-2026.08.03-v2',
    refundPolicyVersion: 'refund-2026.08.03-v2',
    aiDisclosureVersion: 'ai-disclosure-2026.08.03-v2',
    purchaseNoticeVersion: 'purchase-notice-2026.08.03-v2'
  });

  var PHONE_RE = /^1[3-9]\d{9}$/;
  var CODE_RE = /^\d{6}$/;
  var ORDER_RE = /^[a-f0-9]{32}$/i;
  var PRODUCT_CODES = Object.freeze({
    member_monthly_v1: Object.freeze({ name: '月度会员', suffix: '/ 月', duration: '自支付成功起 1 个月', amountFen: 2900, months: 1 }),
    member_annual_v1: Object.freeze({ name: '年度会员', suffix: '/ 年', duration: '自支付成功起 12 个月', amountFen: 22800, months: 12 })
  });
  var ORDER_STATE = Object.freeze({
    waiting: {
      badge: '待支付',
      title: '等待微信支付',
      body: '请在手机系统浏览器中继续支付。支付后本页会向知星后端确认结果。'
    },
    confirming: {
      badge: '确认中',
      title: '正在确认支付结果',
      body: '请不要重复支付。页面会继续向知星后端查询订单。'
    },
    active: {
      badge: '已生效',
      title: '支付成功，会员权益已生效',
      body: '你可以返回“我的”查看会员有效期与当前服务月额度。'
    },
    expired: {
      badge: '已关闭',
      title: '本次支付未完成',
      body: '订单已过期或关闭，没有开通新的会员权益。请返回会员方案重新创建订单。'
    },
    failed: {
      badge: '未完成',
      title: '本次支付没有完成',
      body: '没有开通新的会员权益。你可以刷新订单状态，或返回会员方案重新尝试。'
    },
    entitlement_pending: {
      badge: '权益确认中',
      title: '订单已支付，会员权益仍在确认中',
      body: '请不要重复支付。请保留订单号并稍后刷新；如长时间未到账，可通过客服入口处理。'
    },
    refunding: {
      badge: '退款处理中',
      title: '退款正在处理',
      body: '到账进度以微信支付和知星订单记录为准。'
    },
    refunded: {
      badge: '已退款',
      title: '订单已退款',
      body: '退款结果与到账时间以原支付渠道记录为准。'
    }
  });

  var accountMounted = false;
  var accountMountPromise = null;
  var selectedProduct = null;
  var catalog = [];
  var annualPurchaseEligible = false;
  var idempotencyKey = '';
  var smsTimer = null;
  var smsChallengeId = '';
  var smsChallengePhone = '';
  var checkoutPoll = null;
  var checkoutCountdown = null;
  var checkoutRefreshPromise = null;
  var latestCheckoutData = null;
  var checkoutConfirmedTracked = false;
  var captchaScriptPromise = null;

  function $(id) { return document.getElementById(id); }
  function trackEvent(name, details) {
    try { return !!(window.ZxAnalytics && window.ZxAnalytics.track(name, details)); }
    catch (_) { return false; }
  }
  function member() { return window.zxMember || null; }
  function snapshot() {
    var client = member();
    if (!client || !client.snapshot) {
      return { configured: false, ready: false, phoneVerified: false, phoneMask: '', paymentAvailable: false };
    }
    var data = client.snapshot();
    var memberUntil = data.memberUntil == null ? null : data.memberUntil;
    var memberUntilTime = memberUntil == null
      ? 0
      : new Date(typeof memberUntil === 'number' ? memberUntil : String(memberUntil)).getTime();
    return {
      configured: !!(client.configured && client.configured()),
      ready: !!data.ready,
      phoneVerified: !!data.phoneVerified,
      phoneMask: String(data.phoneMask || ''),
      paymentAvailable: data.paymentAvailable === true,
      memberUntil: memberUntil,
      isMember: Number.isFinite(memberUntilTime) && memberUntilTime > Date.now()
    };
  }

  function text(id, value) {
    var element = $(id);
    if (element) element.textContent = String(value == null ? '' : value);
  }

  function clear(element) {
    if (element) element.replaceChildren();
  }

  function button(label, onClick, className) {
    var element = document.createElement('button');
    element.type = 'button';
    element.className = 'btn' + (className ? ' ' + className : '');
    element.textContent = label;
    element.addEventListener('click', onClick);
    return element;
  }

  function link(label, href, className) {
    var element = document.createElement('a');
    element.className = 'btn' + (className ? ' ' + className : '');
    element.textContent = label;
    element.href = href;
    return element;
  }

  function safeHttpsUrl(value, allowHash) {
    var raw = String(value || '').trim();
    if (!raw) return '';
    try {
      var parsed = new URL(raw, window.location.href);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
          parsed.search || (!allowHash && parsed.hash)) return '';
      return parsed.href;
    } catch (_) {
      return '';
    }
  }

  function safeHttpsOrigin(value) {
    var safe = safeHttpsUrl(value);
    if (!safe) return '';
    try { return new URL(safe).origin; } catch (_) { return ''; }
  }

  function validPolicyVersion(value) {
    return /^[a-z0-9][a-z0-9._-]{0,31}$/i.test(String(value || ''));
  }

  function publicConfigReady() {
    var c = PUBLIC_PAYMENT_CONFIG;
    var policyVersionsReady = Object.keys(REQUIRED_POLICY_VERSIONS).every(function (key) {
      return c[key] === REQUIRED_POLICY_VERSIONS[key];
    });
    return !!(
      safeHttpsOrigin(c.paymentOrigin) &&
      String(c.merchantLegalName || '').trim() &&
      safeHttpsUrl(c.supportUrl, true) &&
      safeHttpsUrl(c.refundUrl) &&
      safeHttpsUrl(c.userAgreementUrl) &&
      safeHttpsUrl(c.membershipRulesUrl) &&
      safeHttpsUrl(c.privacyUrl) &&
      safeHttpsUrl(c.aiDisclosureUrl) &&
      safeHttpsUrl(c.purchaseNoticeUrl) &&
      validPolicyVersion(c.agreementVersion) &&
      validPolicyVersion(c.privacyVersion) &&
      validPolicyVersion(c.membershipTermsVersion) &&
      validPolicyVersion(c.refundPolicyVersion) &&
      validPolicyVersion(c.aiDisclosureVersion) &&
      validPolicyVersion(c.purchaseNoticeVersion) &&
      policyVersionsReady
    );
  }

  function captchaAppId() {
    var config = window.ZX_PUBLIC_CONFIG;
    var value = config && typeof config === 'object' && !Array.isArray(config)
      ? String(config.captchaAppId || '').trim()
      : '';
    return /^\d{6,12}$/.test(value) ? value : '';
  }

  function loadCaptchaScript() {
    if (typeof window.TencentCaptcha === 'function') return Promise.resolve();
    if (captchaScriptPromise) return captchaScriptPromise;
    captchaScriptPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var settled = false;
      var timer = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error('CAPTCHA_SCRIPT_TIMEOUT'));
      }, 10000);
      script.src = 'https://turing.captcha.qcloud.com/TJCaptcha.js';
      script.async = true;
      script.referrerPolicy = 'origin';
      script.onload = function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (typeof window.TencentCaptcha === 'function') resolve();
        else reject(new Error('CAPTCHA_SCRIPT_INVALID'));
      };
      script.onerror = function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(new Error('CAPTCHA_SCRIPT_UNAVAILABLE'));
      };
      document.head.appendChild(script);
    }).catch(function (error) {
      captchaScriptPromise = null;
      throw error;
    });
    return captchaScriptPromise;
  }

  function runCaptcha() {
    var appId = captchaAppId();
    if (!appId) return Promise.reject(new Error('CAPTCHA_NOT_CONFIGURED'));
    return loadCaptchaScript().then(function () {
      return new Promise(function (resolve, reject) {
        var settled = false;
        function finish(error, value) {
          if (settled) return;
          settled = true;
          if (error) reject(error);
          else resolve(value);
        }
        try {
          var captcha = new window.TencentCaptcha(appId, function (result) {
            result = result || {};
            if (Number(result.ret) === 0 &&
                typeof result.ticket === 'string' && result.ticket &&
                typeof result.randstr === 'string' && result.randstr) {
              finish(null, {
                ticket: result.ticket,
                randstr: result.randstr
              });
              return;
            }
            finish(new Error(Number(result.ret) === 2
              ? 'CAPTCHA_CANCELLED'
              : 'CAPTCHA_REJECTED'));
          }, {
            userLanguage: 'zh-cn'
          });
          captcha.show();
        } catch (_) {
          finish(new Error('CAPTCHA_UNAVAILABLE'));
        }
      });
    });
  }

  function isWeChatBrowser() {
    return /MicroMessenger/i.test(navigator.userAgent || '');
  }

  function isMobileBrowser() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
  }

  function h5Environment() {
    if (isWeChatBrowser()) {
      return {
        ready: false,
        reason: '微信内置浏览器不能使用本次 H5 收银台。请点右上角，在手机系统浏览器中打开后再购买。'
      };
    }
    if (!isMobileBrowser()) {
      return {
        ready: false,
        reason: '微信支付 H5 仅支持手机外部浏览器。请使用手机系统浏览器打开本页。'
      };
    }
    if (window.location.protocol !== 'https:' && !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
      return { ready: false, reason: '支付页必须通过已备案并在微信商户平台配置的 HTTPS 域名打开。' };
    }
    var paymentOrigin = safeHttpsOrigin(PUBLIC_PAYMENT_CONFIG.paymentOrigin);
    if (!paymentOrigin) {
      return { ready: false, reason: '微信支付 H5 域名尚未配置，当前不会创建订单。' };
    }
    if (window.location.origin !== paymentOrigin) {
      return { ready: false, reason: '当前页面不在微信商户平台备案的 H5 支付域名，不能发起支付。' };
    }
    return { ready: true, reason: '' };
  }

  function money(amountFen) {
    var amount = Number(amountFen);
    return Number.isSafeInteger(amount) && amount >= 0 ? '¥' + (amount / 100).toFixed(amount % 100 ? 2 : 0) : '—';
  }

  function timeValue(value) {
    if (value === null || value === undefined || value === '') return null;
    var numeric = Number(value);
    var date = new Date(Number.isFinite(numeric) ? numeric : String(value));
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }

  function formatDateTime(value) {
    var timestamp = timeValue(value);
    return timestamp == null ? '' : new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function randomKey() {
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') return '';
    var bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    return Array.prototype.map.call(bytes, function (item) {
      return item.toString(16).padStart(2, '0');
    }).join('');
  }

  function normalizeProduct(item) {
    item = item || {};
    var code = String(item.product_code || '');
    var fixed = PRODUCT_CODES[code];
    var amount = item.amount_fen;
    var months = item.duration_months;
    if (!fixed || !Number.isSafeInteger(amount) || amount !== fixed.amountFen ||
        !Number.isSafeInteger(months) || months !== fixed.months ||
        item.currency !== 'CNY' || item.auto_renew !== false) {
      return null;
    }
    var explicitEligibility =
      item.purchase_eligible === true || item.eligible === true ||
      item.eligibility === 'eligible' ||
      !!(item.eligibility && item.eligibility.allowed === true)
        ? true
        : item.purchase_eligible === false || item.eligible === false ||
          item.eligibility === 'ineligible' ||
          !!(item.eligibility && item.eligibility.allowed === false)
          ? false
          : null;
    return {
      productCode: code,
      name: fixed.name,
      suffix: fixed.suffix,
      duration: fixed.duration,
      amountFen: amount,
      months: months,
      paymentAvailable: item.payment_available === true,
      purchaseEligible: explicitEligibility === true
    };
  }

  function selectedRadioProduct() {
    var checked = document.querySelector('input[name="memberPlan"]:checked');
    return checked ? catalog.find(function (item) { return item.productCode === checked.value; }) || null : null;
  }

  function renderAccountAuth() {
    var state = snapshot();
    var panel = $('account-status');
    var actions = $('accountActions');
    if (!panel || !actions) return;
    panel.hidden = false;
    clear(actions);
    if (!state.configured) {
      text('accountBadge', '暂不可用');
      text('accountTitle', '手机号登录暂不可用');
      text('accountBody', '账号服务尚未连接，当前不会发送验证码，也不会创建订单。');
      return;
    }
    if (!state.phoneVerified) {
      text('accountBadge', '未登录');
      text('accountTitle', '手机号登录');
      text('accountBody', '登录后可在不同设备找回会员、订单和已确认同步的资料。微信只用于付款。');
      actions.append(button('手机号登录', openPhoneLogin, 'primary'));
      return;
    }
    text('accountBadge', '已登录');
    text('accountTitle', state.phoneMask ? '已登录 ' + state.phoneMask : '手机号已验证');
    text('accountBody', '当前会员和订单归属此手机号账号。');
    actions.append(button('退出登录', logout));
  }

  function setPlanControls(enabled) {
    var monthly = $('planMonthly');
    var annual = $('planAnnual');
    var annualCard = $('planAnnualCard');
    if (monthly) monthly.disabled = !enabled;
    if (annual) annual.disabled = !(enabled && annualPurchaseEligible);
    if (annualCard) annualCard.hidden = !annualPurchaseEligible;
  }

  function renderCatalog(data) {
    var products = Array.isArray(data && data.products) ? data.products.map(normalizeProduct).filter(Boolean) : [];
    var monthly = products.find(function (product) { return product.productCode === 'member_monthly_v1'; }) || null;
    var annual = products.find(function (product) { return product.productCode === 'member_annual_v1'; }) || null;
    annualPurchaseEligible = !!(annual && annual.paymentAvailable && annual.purchaseEligible);
    catalog = [monthly, annualPurchaseEligible ? annual : null].filter(Boolean);
    products.forEach(function (product) {
      var id = product.productCode === 'member_monthly_v1' ? 'planMonthlyPrice' : 'planAnnualPrice';
      text(id, money(product.amountFen) + ' ' + product.suffix);
    });
    var available = data && data.payment_available === true &&
      !!monthly && monthly.paymentAvailable && monthly.purchaseEligible;
    setPlanControls(available);
    if (!annualPurchaseEligible && $('planAnnual')) $('planAnnual').checked = false;
    if (available && !$('planMonthly').checked && !$('planAnnual').checked) $('planMonthly').checked = true;
    return available;
  }

  function renderUpgradeState(paymentAvailable) {
    var state = snapshot();
    var actions = $('upgradeActions');
    if (!actions) return;
    clear(actions);
    if (!state.configured) {
      text('upgradeBadge', '不可购买');
      text('upgradeStateTitle', '会员购买当前不可用');
      text('upgradeNote', '账号与支付服务尚未连接，当前不会创建订单或收取费用。');
      setPlanControls(false);
      return;
    }
    if (state.isMember) {
      text('upgradeBadge', '会员有效');
      text('upgradeStateTitle', '当前会员期内暂不续购');
      text('upgradeNote', '现有会员权益仍在有效期内。到期后可重新选择月度或年度方案，本次不会创建新订单。');
      setPlanControls(false);
      return;
    }
    if (!paymentAvailable) {
      text('upgradeBadge', '不可购买');
      text('upgradeStateTitle', '微信支付 H5 当前不可用');
      text('upgradeNote', '微信支付 H5 尚未通过生产配置与验收，当前不会创建订单。');
      setPlanControls(false);
      return;
    }
    text('upgradeBadge', publicConfigReady() ? '可购买' : '配置待完成');
    if (!state.phoneVerified) {
      text('upgradeStateTitle', '手机号登录后可购买');
      text('upgradeNote', '请先登录手机号。支付前还需要完成商户、协议、客服和退款入口配置。');
      actions.append(button('登录后购买', openPhoneLogin, 'primary'));
      return;
    }
    text('upgradeStateTitle', publicConfigReady() ? '请选择会员方案' : '支付配置尚未完成');
    text('upgradeNote', publicConfigReady()
      ? (annualPurchaseEligible
          ? '请选择方案。最终金额与购买资格以知星后端创建订单时的校验结果为准。'
          : '首购仅开放 ¥29 月度会员；¥228 年度会员仅在知星后端确认购买资格后显示。')
      : '商户主体、协议、客服或退款入口尚未配置完整，支付按钮保持关闭。');
    actions.append(button(publicConfigReady() ? '确认购买' : '查看购买确认', openPurchase, 'primary'));
  }

  function policyNode(label, url) {
    var safe = safeHttpsUrl(url, true);
    if (safe) {
      var a = document.createElement('a');
      a.href = safe;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = label;
      return a;
    }
    var span = document.createElement('span');
    span.className = 'unavailable';
    span.textContent = label + '尚未配置';
    return span;
  }

  function renderServiceLinks(target) {
    clear(target);
    if (!target) return;
    target.append(
      policyNode('联系客服', PUBLIC_PAYMENT_CONFIG.supportUrl),
      policyNode('退款申请', PUBLIC_PAYMENT_CONFIG.refundUrl)
    );
  }

  function renderPurchasePolicyLinks() {
    var target = $('purchasePolicyLinks');
    clear(target);
    if (!target) return;
    target.append(
      policyNode('用户协议', PUBLIC_PAYMENT_CONFIG.userAgreementUrl),
      document.createTextNode(' '),
      policyNode('会员服务规则', PUBLIC_PAYMENT_CONFIG.membershipRulesUrl),
      document.createTextNode(' '),
      policyNode('隐私政策', PUBLIC_PAYMENT_CONFIG.privacyUrl),
      document.createTextNode(' '),
      policyNode('AI 服务说明', PUBLIC_PAYMENT_CONFIG.aiDisclosureUrl),
      document.createTextNode(' '),
      policyNode('购买确认摘要', PUBLIC_PAYMENT_CONFIG.purchaseNoticeUrl),
      document.createTextNode(' '),
      policyNode('退款规则', PUBLIC_PAYMENT_CONFIG.refundUrl)
    );
  }

  function openPhoneLogin() {
    var state = snapshot();
    if (!state.configured) return;
    text('phoneLoginError', '');
    $('loginCode').value = '';
    smsChallengeId = '';
    smsChallengePhone = '';
    $('phoneLoginDialog').showModal();
    window.setTimeout(function () { $('loginPhone').focus(); }, 0);
  }

  function smsError(error) {
    if (error && error.message === 'CAPTCHA_CANCELLED') return '已取消安全验证，本次没有发送短信。';
    if (error && /^CAPTCHA_/.test(String(error.message || ''))) {
      return '安全验证暂不可用，请检查网络后重试。';
    }
    if (error && error.status === 429) {
      var detail = error.data && error.data.error;
      var retry = Number(
        error.data && error.data.retry_after ||
        detail && detail.retry_after ||
        detail && detail.retry_after_seconds
      );
      return Number.isFinite(retry) && retry > 0 ? '请求过于频繁，请 ' + retry + ' 秒后再试。' : '请求过于频繁，请稍后再试。';
    }
    return '验证码暂时无法发送，请稍后重试。';
  }

  function loginError(error) {
    var code = String(error && error.code || '');
    if (code === 'SMS_CODE_EXPIRED') return '验证码已过期，请重新获取。';
    if (code === 'SMS_ATTEMPTS_EXCEEDED') return '验证码尝试次数过多，请重新获取。';
    if (code === 'ACCOUNT_MERGE_REVIEW_REQUIRED') return '账号资料需要人工核对，现有会员权益不会被删除。请通过客服入口处理。';
    return '手机号或验证码未通过验证，请检查后重试。';
  }

  function startSmsCountdown(seconds) {
    var buttonElement = $('sendSmsButton');
    var remaining = Math.max(1, Math.min(300, Number(seconds) || 60));
    window.clearInterval(smsTimer);
    buttonElement.disabled = true;
    buttonElement.textContent = remaining + ' 秒后重试';
    smsTimer = window.setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(smsTimer);
        buttonElement.disabled = false;
        buttonElement.textContent = '重新获取';
      } else {
        buttonElement.textContent = remaining + ' 秒后重试';
      }
    }, 1000);
  }

  async function requestSms() {
    var client = member();
    var phone = $('loginPhone').value.trim();
    if (!client || !client.configured() || !PHONE_RE.test(phone)) {
      text('phoneLoginError', PHONE_RE.test(phone) ? '账号服务尚未连接。' : '请输入正确的 11 位手机号。');
      return;
    }
    $('sendSmsButton').disabled = true;
    text('phoneLoginError', '请先完成安全验证…');
    try {
      var risk = await runCaptcha();
      text('phoneLoginError', '安全验证已通过，正在发送验证码…');
      var result = await client.requestSms(phone, risk);
      var challengeId = String(result && result.challenge_id || '');
      if (!challengeId || challengeId.length > 256) throw new Error('invalid sms challenge');
      smsChallengeId = challengeId;
      smsChallengePhone = phone;
      text('phoneLoginError', '验证码已发送，请在有效时间内填写。');
      startSmsCountdown(result && (result.retry_after || result.retry_after_seconds) || 60);
      $('loginCode').focus();
    } catch (error) {
      smsChallengeId = '';
      smsChallengePhone = '';
      $('sendSmsButton').disabled = false;
      text('phoneLoginError', smsError(error));
    }
  }

  async function verifyPhone(event) {
    event.preventDefault();
    var client = member();
    var phone = $('loginPhone').value.trim();
    var code = $('loginCode').value.trim();
    $('loginPhone').removeAttribute('aria-invalid');
    $('loginCode').removeAttribute('aria-invalid');
    if (!PHONE_RE.test(phone)) {
      text('phoneLoginError', '请输入正确的 11 位中国大陆手机号。');
      $('loginPhone').setAttribute('aria-invalid', 'true');
      $('loginPhone').focus();
      return;
    }
    if (!CODE_RE.test(code)) {
      text('phoneLoginError', '请输入短信中的 6 位验证码。');
      $('loginCode').setAttribute('aria-invalid', 'true');
      $('loginCode').focus();
      return;
    }
    if (!smsChallengeId || smsChallengePhone !== phone) {
      text('phoneLoginError', '请先为当前手机号重新获取验证码。');
      $('sendSmsButton').focus();
      return;
    }
    $('phoneLoginPrimary').disabled = true;
    text('phoneLoginError', '正在验证并恢复账号…');
    trackEvent('login_started', { method: 'sms', outcome: 'started' });
    try {
      await client.verifySms(smsChallengeId, phone, code);
      smsChallengeId = '';
      smsChallengePhone = '';
      $('loginCode').value = '';
      text('phoneLoginError', '登录成功，正在刷新会员与订单。');
      trackEvent('login_completed', { method: 'sms', outcome: 'completed' });
      window.setTimeout(function () { window.location.reload(); }, 350);
    } catch (error) {
      $('phoneLoginPrimary').disabled = false;
      text('phoneLoginError', loginError(error));
      if (Number(error && error.status || 0) < 500) {
        $('loginCode').setAttribute('aria-invalid', 'true');
        $('loginCode').focus();
      }
      trackEvent('login_failed', { method: 'sms', outcome: 'failed', reason: Number(error && error.status) >= 500 ? 'network' : 'validation' });
    }
  }

  async function logout() {
    var client = member();
    if (!client || !window.confirm('确认退出当前手机号账号？本机尚未同步的资料不会自动上传。')) return;
    try {
      await client.logout(false);
      window.location.reload();
    } catch (_) {
      text('accountBody', '退出没有完成，请稍后重试。');
    }
  }

  function openPurchase() {
    if (snapshot().isMember) {
      text('upgradeNote', '当前会员期内暂不续购，本次不会创建新订单。');
      return;
    }
    selectedProduct = selectedRadioProduct();
    if (!selectedProduct) {
      text('upgradeNote', '请先选择月度或年度会员。');
      return;
    }
    var environment = h5Environment();
    text('purchaseProduct', selectedProduct.name);
    text('purchaseAmount', money(selectedProduct.amountFen));
    text('purchaseDuration', selectedProduct.duration);
    text('purchaseMerchant', PUBLIC_PAYMENT_CONFIG.merchantLegalName || '尚未配置');
    renderPurchasePolicyLinks();
    $('purchaseConsent').checked = false;
    $('purchaseAdultConsent').checked = false;
    $('purchasePaymentConsent').checked = false;
    $('purchasePrimary').textContent = '确认并支付 ' + money(selectedProduct.amountFen);
    $('purchasePrimary').disabled = true;
    text('purchaseError', environment.ready
      ? (publicConfigReady() ? '' : '商户、协议、客服或退款入口未配置完整，当前不能支付。')
      : environment.reason);
    idempotencyKey = randomKey();
    $('purchaseDialog').showModal();
    window.setTimeout(function () { $('purchaseAdultConsent').focus(); }, 0);
  }

  function syncPurchaseButton() {
    var state = snapshot();
    var environment = h5Environment();
    $('purchasePrimary').disabled = !(
      $('purchaseConsent').checked &&
      $('purchaseAdultConsent').checked &&
      $('purchasePaymentConsent').checked &&
      state.phoneVerified &&
      !state.isMember &&
      state.paymentAvailable &&
      publicConfigReady() &&
      environment.ready &&
      !!idempotencyKey
    );
  }

  async function createOrder(event) {
    event.preventDefault();
    syncPurchaseButton();
    if ($('purchasePrimary').disabled || !selectedProduct) return;
    var client = member();
    $('purchasePrimary').disabled = true;
    text('purchaseError', '正在创建安全订单，请不要重复操作…');
    trackEvent('checkout_started', {
      method: 'wechat_h5',
      outcome: 'started',
      plan: selectedProduct.productCode === 'member_annual_v1' ? 'yearly' : 'monthly'
    });
    try {
      var result = await client.createPaymentOrder({
        productCode: selectedProduct.productCode,
        consent: true,
        agreementVersion: PUBLIC_PAYMENT_CONFIG.agreementVersion,
        privacyVersion: PUBLIC_PAYMENT_CONFIG.privacyVersion,
        membershipTermsVersion: PUBLIC_PAYMENT_CONFIG.membershipTermsVersion,
        refundPolicyVersion: PUBLIC_PAYMENT_CONFIG.refundPolicyVersion,
        aiDisclosureVersion: PUBLIC_PAYMENT_CONFIG.aiDisclosureVersion,
        purchaseNoticeVersion: PUBLIC_PAYMENT_CONFIG.purchaseNoticeVersion,
        adultConfirmed: true
      }, idempotencyKey);
      var order = result && (result.order || result);
      var orderNo = String(order && (order.order_no || order.orderNo) || '');
      if (!ORDER_RE.test(orderNo)) throw new Error('invalid order response');
      if (typeof client.rememberPaymentOrder === 'function') client.rememberPaymentOrder(orderNo);
      window.location.href = './checkout.html?order=' + encodeURIComponent(orderNo);
    } catch (error) {
      idempotencyKey = '';
      text('purchaseError', String(error && error.code || '') === 'PAYMENT_ACTIVE_MEMBER'
        ? '当前会员仍在有效期内，暂不支持续购；本次未发生扣款。'
        : '订单没有创建成功，未发生扣款。请关闭后重新尝试。');
    }
  }

  function orderStateCode(order) {
    order = order || {};
    var entitlement = String(order.entitlement_status || order.entitlement_state || '').toUpperCase();
    var status = String(order.status || order.state || '').toUpperCase();
    var provider = String(order.provider_trade_state || order.trade_state || '').toUpperCase();

    // 知星订单态、微信交易态和权益态来自三个不同状态机，不能拼成一段文本后模糊匹配。
    if (/GRANTED|FULFILLED|ACTIVE/.test(entitlement)) return 'active';
    if (/GRANTED|FULFILLED|ACTIVE|COMPLETED/.test(status)) return 'active';

    if (/REFUNDED|REFUND_SUCCESS/.test(status)) return 'refunded';
    if (/REFUNDING|REFUND_PROCESSING/.test(status)) return 'refunding';
    if (provider === 'REFUND') return 'refunding';

    // 关单处理中永远只允许查单，不得再次展示支付动作。
    if (/CLOSE_PENDING/.test(status)) return 'confirming';
    if (/ENTITLEMENT_PENDING|PAID_ENTITLEMENT_PENDING/.test(status)) return 'entitlement_pending';
    if (/PENDING|PROCESSING/.test(entitlement) &&
        (provider === 'SUCCESS' || /PAID|SUCCESS|SETTLED/.test(status))) {
      return 'entitlement_pending';
    }

    if (provider === 'SUCCESS') return 'entitlement_pending';
    if (provider === 'USERPAYING') return 'confirming';
    if (provider === 'CLOSED' || provider === 'REVOKED') return 'expired';
    if (provider === 'PAYERROR') return 'failed';

    if (/PAID|SUCCESS|SETTLED/.test(status)) return 'entitlement_pending';
    if (/PAYING|CONFIRMING|PROCESSING/.test(status)) return 'confirming';
    if (/EXPIRED|CLOSED|REVOKED/.test(status)) return 'expired';
    if (/FAIL|ERROR|ABNORMAL/.test(status)) return 'failed';
    return 'waiting';
  }

  function orderLabel(state) {
    return ORDER_STATE[state] || ORDER_STATE.waiting;
  }

  function unwrapOrder(input) {
    var order = input && (input.order || input) || {};
    var checkout = input && input.checkout || order.checkout || {};
    return { order: order, checkout: checkout };
  }

  function renderOrderItem(input) {
    var normalized = unwrapOrder(input);
    var order = normalized.order;
    var orderNo = String(order.order_no || order.orderNo || '');
    var state = orderStateCode(order);
    var refund = input && input.latestRefund || null;
    var article = document.createElement('article');
    article.className = 'order-item';
    var content = document.createElement('div');
    var title = document.createElement('h3');
    title.className = 'order-title';
    var code = String(order.product_code || '');
    title.textContent = PRODUCT_CODES[code] ? PRODUCT_CODES[code].name : '知星会员订单';
    var amount = document.createElement('p');
    amount.className = 'order-meta';
    amount.textContent = money(order.amount_fen) + ' · 订单号 ' + (orderNo || '待确认');
    var created = document.createElement('p');
    created.className = 'order-meta';
    created.textContent = formatDateTime(order.created_at) || '创建时间待确认';
    content.append(title, amount, created);
    var side = document.createElement('div');
    side.className = 'order-status';
    var badge = document.createElement('span');
    badge.textContent = refund ? refundStateLabel(refund) : orderLabel(state).badge;
    side.append(badge);
    if (state === 'waiting' && ORDER_RE.test(orderNo)) {
      side.append(link('继续支付', './checkout.html?order=' + encodeURIComponent(orderNo)));
    }
    if (state === 'active' && ORDER_RE.test(orderNo) && refundAllowsNewRequest(refund)) {
      side.append(button('申请退款', function () {
        requestOrderRefund(order);
      }));
    }
    article.append(content, side);
    return article;
  }

  function refundStateLabel(refund) {
    var status = String(refund && refund.status || '').toLowerCase();
    if (status === 'manual_review') return '退款审核中';
    if (['applying', 'processing', 'query_required'].includes(status)) return '退款处理中';
    if (status === 'abnormal') return '退款待核对';
    if (status === 'succeeded') return '已退款';
    if (status === 'rejected') return '退款申请未通过';
    if (status === 'closed') return '退款已关闭';
    return '退款状态待确认';
  }

  function refundStateCode(refund) {
    var status = String(refund && refund.status || '').toLowerCase();
    if (status === 'succeeded') return 'refunded';
    if (['manual_review', 'applying', 'processing', 'query_required', 'abnormal'].includes(status)) {
      return 'refunding';
    }
    return '';
  }

  function refundAllowsNewRequest(refund) {
    if (!refund) return true;
    return ['rejected', 'closed'].includes(String(refund.status || '').toLowerCase());
  }

  async function requestOrderRefund(order) {
    var client = member();
    var orderNo = String(order && (order.order_no || order.orderNo) || '');
    var amountFen = Number(order && order.amount_fen);
    if (!client || !ORDER_RE.test(orderNo) ||
        !Number.isSafeInteger(amountFen) || amountFen < 1) {
      text('orderLive', '当前订单信息不完整，无法提交退款申请。');
      return;
    }
    if (!window.confirm(
      '确认提交这笔订单的全额退款申请？申请会先进入人工审核，不会立即到账；退款成功后的会员权益将按退款规则处理。'
    )) return;
    var key = randomKey();
    if (!key) {
      text('orderLive', '当前浏览器缺少安全随机数能力，退款申请没有提交。');
      return;
    }
    text('orderLive', '正在提交退款人工审核申请…');
    trackEvent('refund_started', { outcome: 'started' });
    try {
      await client.requestPaymentRefund({
        orderNo: orderNo,
        amountFen: amountFen,
        reasonCode: 'customer_request',
        note: null
      }, key);
      text('orderLive', '退款申请已提交人工审核。结果与到账时间以订单中心和微信支付记录为准。');
      await loadOrders();
    } catch (error) {
      var code = String(error && error.code || '');
      text('orderLive', code === 'REFUND_OPEN_REQUEST_EXISTS'
        ? '这笔订单已有退款申请正在处理，请勿重复提交。'
        : '退款申请没有提交成功，请稍后重试或通过客服入口处理。');
    }
  }

  async function loadOrders() {
    var client = member();
    var state = snapshot();
    var list = $('orderList');
    var actions = $('orderActions');
    clear(list);
    clear(actions);
    renderServiceLinks($('orderServiceLinks'));
    if (!state.configured) {
      text('orderBadge', '暂不可用');
      text('orderStateTitle', '订单服务尚未连接');
      text('orderStateBody', '当前不会创建订单或收取费用。');
      return;
    }
    if (!state.phoneVerified) {
      text('orderBadge', '需登录');
      text('orderStateTitle', '手机号登录后可查看订单');
      text('orderStateBody', '支付结果只以知星后端确认的订单状态为准。');
      actions.append(button('手机号登录', openPhoneLogin));
      return;
    }
    text('orderBadge', '读取中');
    text('orderStateTitle', '正在读取我的订单');
    text('orderStateBody', '请稍候。');
    try {
      var results = await Promise.all([
        client.paymentOrders(),
        client.paymentRefunds()
      ]);
      var result = results[0];
      var refundResult = results[1];
      var items = Array.isArray(result && result.items) ? result.items : [];
      var refunds = Array.isArray(refundResult && refundResult.items) ? refundResult.items : [];
      var latestRefundByOrder = new Map();
      refunds.forEach(function (refund) {
        var orderNo = String(refund && refund.order_no || '');
        if (ORDER_RE.test(orderNo) && !latestRefundByOrder.has(orderNo)) {
          latestRefundByOrder.set(orderNo, refund);
        }
      });
      text('orderBadge', items.length + ' 笔');
      text('orderStateTitle', items.length ? '我的订单' : '还没有会员订单');
      text('orderStateBody', items.length
        ? '支付状态与会员生效结果均来自知星后端。'
        : '创建会员订单后会显示在这里。');
      clear(list);
      items.forEach(function (item) {
        var normalized = unwrapOrder(item);
        var orderNo = String(normalized.order.order_no || normalized.order.orderNo || '');
        list.append(renderOrderItem({
          order: normalized.order,
          checkout: normalized.checkout,
          latestRefund: latestRefundByOrder.get(orderNo) || null
        }));
      });
      actions.append(button('刷新订单', loadOrders));
    } catch (_) {
      text('orderBadge', '读取失败');
      text('orderStateTitle', '暂时无法确认订单与退款状态');
      text('orderStateBody', '当前不会假定订单已生效或没有退款。请稍后刷新，避免重复支付或重复提交退款。');
      actions.append(button('重新读取', loadOrders));
    }
  }

  async function mountAccountOnce() {
    if (!accountMounted) {
      accountMounted = true;
      $('phoneLoginCancel').addEventListener('click', function () {
        smsChallengeId = '';
        smsChallengePhone = '';
        $('loginCode').value = '';
        $('phoneLoginDialog').close();
      });
      $('loginPhone').addEventListener('input', function () {
        $('loginPhone').removeAttribute('aria-invalid');
        if (smsChallengePhone && $('loginPhone').value.trim() !== smsChallengePhone) {
          smsChallengeId = '';
          smsChallengePhone = '';
          $('loginCode').value = '';
          text('phoneLoginError', '手机号已更改，请重新获取验证码。');
        }
      });
      $('loginCode').addEventListener('input', function () {
        $('loginCode').removeAttribute('aria-invalid');
      });
      $('sendSmsButton').addEventListener('click', requestSms);
      $('phoneLoginForm').addEventListener('submit', verifyPhone);
      $('purchaseCancel').addEventListener('click', function () { $('purchaseDialog').close(); });
      $('purchaseConsent').addEventListener('change', syncPurchaseButton);
      $('purchaseAdultConsent').addEventListener('change', syncPurchaseButton);
      $('purchasePaymentConsent').addEventListener('change', syncPurchaseButton);
      $('purchaseForm').addEventListener('submit', createOrder);
      document.querySelectorAll('input[name="memberPlan"]').forEach(function (input) {
        input.addEventListener('change', function () { selectedProduct = selectedRadioProduct(); });
      });
    }
    try {
      await member().whenReady();
    } catch (error) {
      if (String(error && error.code || '') !== 'PRIVACY_CONSENT_REQUIRED') throw error;
      renderAccountAuth();
      renderUpgradeState(false);
      await loadOrders();
      return;
    }
    renderAccountAuth();
    var paymentAvailable = false;
    if (snapshot().configured) {
      try {
        var productData = await member().membershipProducts();
        paymentAvailable = renderCatalog(productData);
      } catch (_) {
        paymentAvailable = false;
      }
    }
    renderUpgradeState(paymentAvailable);
    await loadOrders();
  }

  function mountAccount() {
    if (!$('member-upgrade') || !member()) return Promise.resolve();
    if (!accountMountPromise) accountMountPromise = mountAccountOnce();
    return accountMountPromise;
  }

  function checkoutState(input) {
    var normalized = unwrapOrder(input);
    var refund = input && input.latestRefund || null;
    return {
      order: normalized.order,
      checkout: normalized.checkout,
      refund: refund,
      state: refundStateCode(refund) || orderStateCode(normalized.order)
    };
  }

  function trustedH5Url(value) {
    try {
      var url = new URL(String(value || ''));
      return url.protocol === 'https:' &&
        url.hostname === 'wx.tenpay.com' &&
        (!url.port || url.port === '443') &&
        !url.username &&
        !url.password &&
        !url.hash
        ? url.href
        : '';
    } catch (_) {
      return '';
    }
  }

  function trustedReturnUrl(value) {
    var paymentOrigin = safeHttpsOrigin(PUBLIC_PAYMENT_CONFIG.paymentOrigin);
    var safe = safeHttpsUrl(value);
    if (!paymentOrigin || !safe) return '';
    try {
      var url = new URL(safe);
      return url.origin === paymentOrigin ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function stopCheckoutTimers() {
    window.clearTimeout(checkoutPoll);
    window.clearInterval(checkoutCountdown);
  }

  function scheduleCheckoutPoll(delay) {
    window.clearTimeout(checkoutPoll);
    checkoutPoll = window.setTimeout(refreshCheckout, Math.max(0, Number(delay) || 0));
  }

  function renderCountdown(expiresAt) {
    window.clearInterval(checkoutCountdown);
    var target = timeValue(expiresAt);
    if (target == null) {
      text('checkoutCountdown', '');
      return;
    }
    function tick() {
      var left = Math.max(0, target - Date.now());
      var minutes = Math.floor(left / 60000);
      var seconds = Math.floor((left % 60000) / 1000);
      text('checkoutCountdown', left > 0
        ? '请在 ' + minutes + ':' + String(seconds).padStart(2, '0') + ' 内完成支付'
        : '支付凭证已过期，正在确认订单状态');
      if (left <= 0) {
        window.clearInterval(checkoutCountdown);
        checkoutCountdown = null;
        return false;
      }
      return true;
    }
    if (tick()) checkoutCountdown = window.setInterval(tick, 1000);
  }

  function renderCheckout(input) {
    var data = checkoutState(input);
    latestCheckoutData = data;
    var order = data.order;
    var checkout = data.checkout;
    var label = orderLabel(data.state);
    var orderNo = String(order.order_no || order.orderNo || '');
    var expiresAt = checkout.expires_at || order.expires_at;
    text('checkoutBadge', label.badge);
    text('checkoutTitle', label.title);
    text('checkoutBody', label.body);
    text('checkoutOrderNo', orderNo || '—');
    var product = PRODUCT_CODES[String(order.product_code || '')];
    text('checkoutProduct', product ? product.name : '知星会员');
    text('checkoutAmount', money(order.amount_fen));
    text('checkoutCreatedAt', formatDateTime(order.created_at) || '—');
    text('checkoutExpiresAt', formatDateTime(expiresAt) || '—');
    text('checkoutMemberUntil', formatDateTime(order.member_until || order.entitlement_until) || '待后端确认');
    renderCountdown(expiresAt);
    var actions = $('checkoutActions');
    clear(actions);
    var environment = h5Environment();
    var h5Url = trustedH5Url(checkout.h5_url);
    var returnUrl = trustedReturnUrl(checkout.redirect_url);
    if (data.state === 'waiting') {
      if (!environment.ready) {
        text('checkoutNotice', environment.reason + ' 当前不会发起微信支付。');
      } else if (!h5Url || !returnUrl) {
        text('checkoutNotice', '支付链接或备案域名回跳地址尚未生成，当前不会发起支付。请刷新订单状态。');
      } else {
        text('checkoutNotice', '离开微信支付后返回本页，系统会主动查询订单；页面不会依据回跳参数判定成功。');
        actions.append(button('前往微信支付', function () {
          if (!h5Environment().ready) {
            text('checkoutNotice', h5Environment().reason);
            return;
          }
          if (typeof member().rememberPaymentOrder === 'function') member().rememberPaymentOrder(orderNo);
          window.location.assign(h5Url);
        }, 'primary'));
      }
    } else if (data.state === 'confirming' || data.state === 'entitlement_pending') {
      text('checkoutNotice', label.body);
    } else if (data.state === 'active') {
      if (typeof member().forgetPaymentOrder === 'function') member().forgetPaymentOrder(orderNo);
      text('checkoutNotice', '会员权益已由知星后端确认。');
      actions.append(link('返回我的', './account.html#membership-status', 'primary'));
      if (!checkoutConfirmedTracked) {
        checkoutConfirmedTracked = true;
        trackEvent('order_confirmed', { method: 'wechat_h5', outcome: 'completed' });
      }
    } else {
      if (typeof member().forgetPaymentOrder === 'function') member().forgetPaymentOrder(orderNo);
      text('checkoutNotice', label.body);
      actions.append(link('返回会员方案', './account.html#member-upgrade'));
    }
    actions.append(button('刷新订单状态', function () { scheduleCheckoutPoll(0); }));
    renderServiceLinks($('checkoutServiceLinks'));
    if (data.state === 'waiting' || data.state === 'confirming') scheduleCheckoutPoll(3000);
    else if (data.state === 'entitlement_pending') scheduleCheckoutPoll(5000);
    else stopCheckoutTimers();
  }

  async function refreshCheckoutOnce() {
    var client = member();
    var rememberedOrder = client && typeof client.pendingPaymentOrder === 'function'
      ? client.pendingPaymentOrder()
      : '';
    var orderNo = String(new URLSearchParams(window.location.search).get('order') || rememberedOrder || '');
    if (!client || !snapshot().configured) {
      text('checkoutBadge', '暂不可用');
      text('checkoutTitle', '支付服务尚未连接');
      text('checkoutBody', '当前不会创建订单或发起微信支付。');
      text('checkoutNotice', '请返回“我的”继续使用已开放功能。');
      clear($('checkoutActions'));
      $('checkoutActions').append(link('返回我的', './account.html#account-status', 'primary'));
      renderServiceLinks($('checkoutServiceLinks'));
      return;
    }
    if (!snapshot().phoneVerified) {
      text('checkoutBadge', '需登录');
      text('checkoutTitle', '请先登录手机号');
      text('checkoutBody', '订单必须归属已验证手机号账号。');
      clear($('checkoutActions'));
      $('checkoutActions').append(link('返回登录', './account.html#account-status', 'primary'));
      return;
    }
    if (!ORDER_RE.test(orderNo)) {
      text('checkoutBadge', '无订单');
      text('checkoutTitle', '没有可恢复的支付订单');
      text('checkoutBody', '请返回会员方案，确认商品后创建订单。');
      clear($('checkoutActions'));
      $('checkoutActions').append(link('返回会员方案', './account.html#member-upgrade'));
      return;
    }
    text('checkoutNotice', '正在向知星后端查询订单…');
    try {
      var results = await Promise.all([
        client.paymentOrder(orderNo),
        client.paymentRefunds()
      ]);
      var result = results[0];
      var refunds = Array.isArray(results[1] && results[1].items) ? results[1].items : [];
      var latestRefund = refunds.find(function (refund) {
        return String(refund && refund.order_no || '') === orderNo;
      }) || null;
      var normalized = unwrapOrder(result);
      renderCheckout({
        order: normalized.order,
        checkout: normalized.checkout,
        latestRefund: latestRefund
      });
    } catch (_) {
      text('checkoutBadge', '查询失败');
      text('checkoutTitle', '暂时无法确认支付或退款结果');
      text('checkoutBody', '当前不会假定订单已生效或没有退款，请不要重复支付。');
      text('checkoutNotice', '网络恢复后请刷新订单状态；如已扣款或已申请退款，请保留订单号联系人工处理。');
      clear($('checkoutActions'));
      $('checkoutActions').append(button('重新查询', function () { scheduleCheckoutPoll(0); }, 'primary'));
      renderServiceLinks($('checkoutServiceLinks'));
    }
  }

  function refreshCheckout() {
    if (checkoutRefreshPromise) return checkoutRefreshPromise;
    checkoutRefreshPromise = refreshCheckoutOnce().finally(function () {
      checkoutRefreshPromise = null;
    });
    return checkoutRefreshPromise;
  }

  async function mountCheckout() {
    if (!$('paidCheckoutPage') || !member()) return;
    try {
      await member().whenReady();
    } catch (error) {
      if (String(error && error.code || '') !== 'PRIVACY_CONSENT_REQUIRED') throw error;
      text('checkoutBadge', '需先启用');
      text('checkoutTitle', '请先启用设备账号');
      text('checkoutBody', '订单必须归属已确认启用的账号。当前不会查询订单、创建订单或发起支付。');
      text('checkoutNotice', '返回“我的”，阅读设备账号说明并主动确认后再继续。');
      clear($('checkoutActions'));
      $('checkoutActions').append(link('返回我的', './account.html#account-status', 'primary'));
      renderServiceLinks($('checkoutServiceLinks'));
      trackEvent('payment_returned', { method: 'wechat_h5', outcome: 'unavailable', reason: 'configuration' });
      return;
    }
    trackEvent('payment_returned', { method: 'wechat_h5', outcome: 'started' });
    await refreshCheckout();
    window.addEventListener('pageshow', function () { scheduleCheckoutPoll(0); });
    window.addEventListener('focus', function () { scheduleCheckoutPoll(0); });
    window.addEventListener('online', function () { scheduleCheckoutPoll(0); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) window.clearTimeout(checkoutPoll);
      else scheduleCheckoutPoll(0);
    });
    window.addEventListener('beforeunload', stopCheckoutTimers);
  }

  function waitForClient(attempt) {
    if (member()) {
      if ($('member-upgrade')) mountAccount();
      if ($('paidCheckoutPage')) mountCheckout();
      return;
    }
    if (attempt < 50) window.setTimeout(function () { waitForClient(attempt + 1); }, 100);
  }

  window.ZxPaidH5 = {
    config: PUBLIC_PAYMENT_CONFIG,
    h5Environment: h5Environment,
    publicConfigReady: publicConfigReady,
    orderStateCode: orderStateCode,
    refundStateCode: refundStateCode,
    checkoutState: checkoutState,
    trustedH5Url: trustedH5Url,
    trustedReturnUrl: trustedReturnUrl,
    normalizeProduct: normalizeProduct,
    mountAccount: mountAccount,
    mountCheckout: mountCheckout
  };

  waitForClient(0);
})();
