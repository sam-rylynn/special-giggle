/* Presentation only: keep native selection, consent, invitation and purchase handlers. */
(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const create = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const chapters = [
    ['总览', '看清反复出现的自己', '核心优势与常见卡点，放在一起看。', '串起五章的核心判断，分清哪些是可以继续发挥的优势，哪些习惯容易让你反复消耗。'],
    ['盘面', '优势为什么有时用不出来', '人格底色、五行结构与星盘参照。', '从四柱、五行和日主强弱，理解你形成判断、接收信息的方式，再用太阳、月亮与上升作参照。'],
    ['关系', '在乎一个人，怎样不越走越累', '靠近的方式、冲突的反应与关系边界。', '看看自己怎样建立亲近、遇到分歧时习惯如何回应，以及哪些需要值得说清楚。'],
    ['行动', '有想法之后，怎样真正做下去', '启动动力、掉速原因与可尝试的调整。', '把理解落到行动：识别让你迟迟不开始或中途停下的模式，找到更适合自己的推进方式。'],
    ['时间', '当下与下一阶段，先抓住什么', '当前十年、今明两年与阶段重点。', '把当前阶段、今明两年放进同一条时间线，理解哪些主题值得持续投入，哪些事情需要调整节奏。']
  ];
  let stopped = false;
  let observing = false;
  const lifecycle = new AbortController();

  function disclosure(label, className) {
    const details = create('details', '', className);
    details.append(create('summary', label));
    return details;
  }

  function enhanceOffer() {
    const offer = $('.report-offer');
    const list = offer?.querySelector('.report-chapters');
    const outline = offer?.querySelector('.report-outline');
    const button = $('#reportPurchaseBtn');
    if (!offer || !outline || !button || !list || offer.dataset.zxCompat) return;
    const items = [...list.children];
    if (items.length !== chapters.length || items.some((item, i) => !item.textContent.includes(chapters[i][0]))) return;
    offer.dataset.zxCompat = '1';
    offer.classList.add('zx-report-offer');
    const intro = create('header', '', 'zx-offer-heading');
    intro.append(create('p', '完整深度报告', 'zx-offer-kicker'));
    const title = $('#reportOfferTitle');
    const lead = title.nextElementSibling;
    intro.append(title);
    if (lead?.tagName === 'P') intro.append(lead);
    offer.prepend(intro);
    const contents = create('section', '', 'zx-offer-contents');
    contents.setAttribute('aria-label', '完整报告的五章内容');
    const heading = create('h5', '从理解自己，到找到下一步');
    contents.append(heading, list);
    list.classList.add('zx-chapter-list');
    items.forEach((item, index) => {
      const [chapter, question, focus, description] = chapters[index];
      const details = create('details', '', 'zx-chapter-preview');
      const summary = create('summary');
      const number = create('span', String(index + 1).padStart(2, '0'), 'zx-chapter-number');
      number.setAttribute('aria-hidden', 'true');
      const copy = create('span', '', 'zx-chapter-copy');
      copy.append(create('span', chapter, 'zx-chapter-name'), create('strong', question), create('span', focus, 'zx-chapter-focus'));
      summary.append(number, copy);
      details.append(summary, create('p', description, 'zx-chapter-description'));
      item.replaceChildren(details);
    });
    outline.replaceWith(contents);
    intro.after(contents);
    const footer = create('div', '', 'zx-offer-purchase');
    const gift = offer.querySelector('.report-gift');
    if (gift) footer.append(gift);
    footer.append(button);
    const status = $('#reportOfferStatus');
    if (status) footer.append(status);
    contents.after(footer);
    // The original button, status region, retry and consent panel are never cloned.
  }

  function enhanceHeader() {
    const nav = $('.prototype-nav');
    if (!nav || nav.dataset.zxCompat) return;
    const header = $('.site-header');
    const brand = header?.querySelector('.brand');
    if (!header || !brand) return;
    nav.dataset.zxCompat = '1';
    document.documentElement.classList.add('zx-compatibility');
    const links = header.querySelector('.header-links');
    for (const link of document.querySelectorAll('.home-return-bar a')) links.append(link);
    const mark = create('img');
    mark.src = './media/static-home/approved-symbol.png';
    mark.width = 30; mark.height = 30; mark.alt = '';
    brand.replaceChildren(mark, create('span', '知星'));
    nav.querySelector('[data-nav="invite"]').textContent = '邀请合盘';
    nav.querySelector('[data-nav="connections"]').textContent = '我的合盘';
    // The home route remains on the brand link; archive remains in the main nav.
    nav.querySelector('[data-nav="home"]').hidden = true;
    header.querySelector('.my-pair-link').hidden = true;
  }

  function enhanceOpenings(main) {
    for (const opening of main.querySelectorAll('.type-detail .synastry-opening')) {
      if (opening.dataset.zxCompat) continue;
      opening.dataset.zxCompat = '1';
      const hero = opening.querySelector('.synastry-opening__hero');
      const balance = opening.querySelector('.synastry-opening__balance');
      if (hero && balance) hero.after(balance);
      const reasons = opening.querySelector('.synastry-opening__reasons');
      const basis = opening.querySelector('.synastry-opening__basis');
      if (reasons) {
        const details = disclosure('为什么会这样 · 完整解读', 'zx-compat-reasons');
        reasons.before(details);
        details.append(reasons);
        if (basis) details.append(basis);
      }
    }
  }

  function enhanceInvitation(main) {
    const channels = main.querySelector('.invite-channel-page');
    if (channels && !channels.dataset.zxCompat) {
      channels.dataset.zxCompat = '1';
      const heading = channels.querySelector('h1');
      heading.textContent = '邀请一个人，读懂你们';
      const steps = create('ol', '', 'zx-invite-steps');
      steps.setAttribute('aria-label', '共同解读的三个步骤');
      for (const [title, text] of [['发出邀请', '微信链接或知星号'], ['双方确认', '选定有效报告并分别同意'], ['共同阅读', '各自私人报告不共享']]) {
        const item = create('li');
        item.append(create('strong', title), create('span', text));
        steps.append(item);
      }
      channels.querySelector('.channel-heading').after(steps);
    }
    const send = main.querySelector('.invite-send-page');
    if (send && !send.dataset.zxCompat) {
      send.dataset.zxCompat = '1';
      const body = send.querySelector('.send-content');
      const actions = send.querySelector('.send-actions');
      const art = body.querySelector('.celestial-card')?.parentElement;
      if (art && actions) {
        const preview = disclosure('查看邀请卡片', 'zx-invite-preview');
        preview.append(art);
        body.prepend(actions);
        body.append(preview);
        const extra = disclosure('卡片与赠送', 'zx-invite-extra');
        for (const control of actions.querySelectorAll('#open-invite-poster,.invite-gift-action')) extra.append(control);
        actions.append(extra);
        actions.querySelector('#copy-invite-link').textContent = '生成邀请链接';
      }
    }
  }

  function enhanceArchive(main) {
    const record = main.querySelector('.archive-open-record');
    if (!record || record.dataset.zxCompat) return;
    record.dataset.zxCompat = '1';
    const body = record.querySelector('.archive-state-body');
    record.prepend(body);
    const title = body.querySelector('h2');
    title.textContent = '继续读你们，或查看新邀请';
    const aside = main.querySelector('.archive-index');
    if (aside) {
      const detail = disclosure('共同阅读与隐私', 'zx-archive-privacy');
      detail.append(aside);
      main.querySelector('.archive-layout').after(detail);
    }
  }

  function sync() {
    if (stopped || document.hidden) return;
    observer.disconnect();
    try {
      enhanceOffer();
      enhanceHeader();
      const main = $('#app');
      if (main) {
        enhanceOpenings(main);
        enhanceInvitation(main);
        enhanceArchive(main);
      }
    } finally {
      if (observing && $('#app')) observer.observe($('#app'), { childList: true, subtree: true });
    }
  }
  const observer = new MutationObserver(sync);
  function start() {
    if (stopped || window.getComputedStyle(document.documentElement).getPropertyValue('--zx-compat-ready').trim() !== '1') return;
    observing = true;
    sync();
  }
  function pause() { observing = false; observer.disconnect(); }
  function destroy() { stopped = true; pause(); lifecycle.abort(); }
  window.addEventListener('pagehide', pause, { signal: lifecycle.signal });
  window.addEventListener('pageshow', start, { signal: lifecycle.signal });
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : start(), { signal: lifecycle.signal });
  window.ZXCompatibilityExperience = Object.freeze({ refresh: sync, destroy });
  start();
})();
