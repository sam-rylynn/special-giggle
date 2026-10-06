/* Presentation only: existing reader owns navigation, account checks and submissions. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const controller = new AbortController();
  const signal = controller.signal;
  let observer;
  let running = false;

  function enhanceTime() {
    const timeline = document.querySelector('.time-focus');
    if (!timeline || timeline.dataset.readingEnhanced) return;
    timeline.dataset.readingEnhanced = 'true';
    const periods = [...timeline.querySelectorAll(':scope > .time-focus-decade')];
    const years = [...timeline.querySelectorAll(':scope > .time-focus-year')];
    const turning = timeline.querySelector(':scope > .time-turning-years');
    const basis = timeline.querySelector(':scope > .time-focus-basis');
    if (!periods.length && !years.length) return;
    // Respect an explicit reading sequence in an authored snapshot; navigation still
    // gives direct access to the current period without rewriting historical copy.
    const lead = timeline.querySelector('.time-focus-lead');
    if (turning && basis && !/先看.{0,8}转折/.test(lead?.textContent || '')) timeline.insertBefore(turning, basis);
    const nav = document.createElement('nav');
    nav.className = 'zx-time-nav';
    nav.setAttribute('aria-label', '时间定位');
    const targets = [
      ...periods.slice(0, 1).map(node => ({ node, label: '当前阶段' })),
      ...years.map(node => ({ node, label: node.dataset.year + ' 年' })),
      ...periods.slice(1).map(node => ({ node, label: '下一阶段' })),
      ...(turning ? [{ node: turning, label: '转折年份' }] : [])
    ];
    targets.forEach(({ node, label }, index) => {
      if (!node.id) node.id = 'zx-time-section-' + index;
      const link = document.createElement('a');
      link.href = '#' + node.id;
      link.textContent = label;
      link.addEventListener('click', event => {
        event.preventDefault();
        node.scrollIntoView({ block: 'start', behavior: 'instant' });
        const heading = node.querySelector('h4');
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      }, { signal });
      nav.append(link);
    });
    if (lead) lead.after(nav);
    else timeline.prepend(nav);
  }

  function enhanceComposer() {
    const input = $('deepQ');
    if (!input || !$('sec-deep')) return;
    if (input.tagName === 'TEXTAREA') {
      if ($('zx-ask-counter')) $('zx-ask-counter').textContent = input.value.length + ' / ' + input.maxLength;
      return;
    }
    const textarea = document.createElement('textarea');
    for (const attribute of input.attributes) {
      if (attribute.name !== 'type') textarea.setAttribute(attribute.name, attribute.value);
    }
    textarea.rows = 4;
    textarea.value = input.value;
    textarea.disabled = input.disabled;
    textarea.readOnly = input.readOnly;
    textarea.setAttribute('aria-describedby', 'zx-ask-counter');
    input.replaceWith(textarea);
    const composer = $('deepComposer');
    const label = composer.querySelector('label[for="deepQ"]');
    if (label) label.classList.remove('sr-only');
    const counter = document.createElement('small');
    counter.id = 'zx-ask-counter';
    counter.className = 'zx-ask-counter';
    const count = () => { counter.textContent = textarea.value.length + ' / ' + textarea.maxLength; };
    textarea.addEventListener('input', count, { signal });
    textarea.after(counter);
    count();
    const notice = document.querySelector('#sec-deep .deep-notice');
    // All data-processing and cost notices remain visible before submission.
    if (notice) $('deepAsk').before(notice);
  }

  function enhance() {
    if (!running) return;
    observer.disconnect();
    try {
      const reader = $('reportReader');
      if (!reader) return;
      const quick = document.querySelector('.report-topbar');
      const social = $('reportSynastryLink');
      if (quick && social && !quick.contains(social)) {
        quick.append(social);
        document.documentElement.classList.add('zx-reading-nav-ready');
      }
      const menu = $('readerMobileNav');
      if (menu && !menu.dataset.readingEnhanced) {
        menu.dataset.readingEnhanced = 'true';
        (menu.closest('.reader-rail-inner') || menu).addEventListener('keydown', event => {
          if (event.key !== 'Escape' || menu.hidden) return;
          menu.hidden = true;
          $('readerMenuToggle').setAttribute('aria-expanded', 'false');
          $('readerMenuToggle').focus();
        }, { signal });
      }
      enhanceTime();
      enhanceComposer();
    } finally {
      if (running) observer.observe($('out'), { childList: true, subtree: true });
    }
  }
  function start() {
    if (!$('out') || running) return;
    running = true;
    observer ||= new MutationObserver(enhance);
    enhance();
  }
  window.addEventListener('pagehide', () => { running = false; observer?.disconnect(); });
  window.addEventListener('pageshow', start);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
