/* Optional reader controls. The native reader remains the authority for access and chapters. */
(function (root) {
  'use strict';
  const chapters = ['sec-overview', 'sec-chart', 'sec-relation', 'sec-action', 'sec-phase'];
  const preferenceKey = 'zx_reader_preferences_v1';
  const positionPrefix = 'zx_reader_position_v1:';
  const maxAge = 30 * 86400000;
  const preferences = value => ({ large: value?.large === true, reduce: value?.reduce === true });
  function validPosition(value, now = Date.now()) {
    return !!value && chapters.includes(value.chapter) && Number.isInteger(value.block) && value.block >= 0 && value.block < 5000 &&
      Number.isFinite(value.fraction) && value.fraction >= 0 && value.fraction <= 1 &&
      Number.isFinite(value.at) && value.at <= now && now - value.at < maxAge;
  }
  function readingPoint(rects, line) {
    const index = rects.findIndex(rect => rect.bottom > line && rect.height > 0);
    if (index < 0) return null;
    const rect = rects[index];
    return { block: index, fraction: Math.max(0, Math.min(1, (line - rect.top) / rect.height)) };
  }
  async function scopeKey(scope, revision, crypto) {
    if (!scope || !/^[a-f0-9]{64}$/.test(revision || '') || !crypto?.subtle) return '';
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope + ':' + revision));
    return positionPrefix + Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
  }
  if (typeof module === 'object' && module.exports) { module.exports = { preferences, validPosition, readingPoint, scopeKey }; return; }
  if (root.ZxReaderComfort) return;
  const doc = root.document, html = doc.documentElement;
  const systemMotion = root.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController(), signal = controller.signal;
  const owned = new Set(), links = new WeakMap();
  let observer, suspended = false, destroyed = false, currentReader, settings, resumeButton;
  let scope = '', revision = '', key = '', epoch = 0, offer = null, interacted = false, lastWrite = 0, highlighted;
  const read = name => { try { return JSON.parse(root.localStorage.getItem(name)); } catch (_) { return null; } };
  const write = (name, value) => { try { root.localStorage.setItem(name, JSON.stringify(value)); return true; } catch (_) { return false; } };
  let preference = preferences(read(preferenceKey));
  function applyPreferences() {
    html.classList.toggle('zx-reader-large', preference.large);
    html.classList.toggle('zx-reader-reduce', preference.reduce || systemMotion.matches);
    root.dispatchEvent(new Event('zx-reader-motion-change'));
  }
  function context() {
    // Read the already-validated native snapshot; never infer a report from URL or birth data.
    try {
      if (typeof PRIVATE_DOWNLOAD_READY === 'undefined' || !PRIVATE_DOWNLOAD_READY || !PRIVATE_OWNER ||
          typeof memberSnapshot !== 'function' || !PRIVATE_SNAPSHOT) return null;
      const session = memberSnapshot();
      if (!session.authenticated || session.identityKind !== 'wechat' || session.accountRef !== PRIVATE_OWNER) return null;
      return { scope: REPORT_CHAPTER_STORAGE_KEY, revision: PRIVATE_SNAPSHOT.revisionKey };
    } catch (_) { return null; }
  }
  function make(tag, cls, parent, text) {
    const node = doc.createElement(tag); node.className = cls;
    if (text) node.textContent = text;
    parent.append(node); owned.add(node); return node;
  }
  function removeOwned() {
    owned.forEach(node => node.remove()); owned.clear();
    highlighted?.classList.remove('zx-reading-highlight'); highlighted = null;
    currentReader = settings = resumeButton = null;
  }
  function line() {
    const rail = doc.querySelector('.reader-rail');
    return root.innerWidth <= 760 ? Math.max(20, rail?.getBoundingClientRect().bottom || 0) + 20 : 90;
  }
  function blocks(page) {
    return [...page.querySelectorAll('h3,h4,h5,h6,p,li,blockquote')].filter(node =>
      !node.closest('.zx-reader-settings,.zx-reader-resume') &&
      !node.parentElement?.closest('p,li,blockquote'));
  }
  function savePosition(force = false) {
    if (!key || !interacted || destroyed || suspended || (!force && Date.now() - lastWrite < 800)) return;
    const active = context();
    if (!active || active.scope !== scope || active.revision !== revision) return;
    const page = doc.querySelector('.reader-page.is-active');
    if (!page || !chapters.includes(page.id)) return;
    const point = readingPoint(blocks(page).map(node => node.getBoundingClientRect()), line());
    if (!point) return;
    lastWrite = Date.now(); write(key, { chapter: page.id, ...point, at: lastWrite });
  }
  function updateOffer() {
    if (!resumeButton) return;
    resumeButton.hidden = !offer;
  }
  function prunePositions() {
    try {
      const names = Object.keys(root.localStorage).filter(name => name.startsWith(positionPrefix));
      const retained = [];
      for (const name of names) {
        const value = read(name);
        if (!validPosition(value)) root.localStorage.removeItem(name);
        else retained.push({ name, at: value.at });
      }
      retained.sort((a, b) => b.at - a.at).slice(20).forEach(item => root.localStorage.removeItem(item.name));
    } catch (_) {}
  }
  async function syncScope(active) {
    const next = active?.scope || '', nextRevision = active?.revision || '';
    if (next === scope && nextRevision === revision) return;
    const token = ++epoch;
    scope = next; revision = nextRevision; key = ''; offer = null; interacted = false; updateOffer();
    if (!scope) return;
    let resolved;
    try { resolved = await scopeKey(scope, revision, root.crypto); } catch (_) { return; }
    const fresh = context();
    if (destroyed || token !== epoch || !fresh || fresh.scope !== scope || fresh.revision !== revision) return;
    key = resolved;
    const saved = read(key); offer = validPosition(saved) ? saved : null; updateOffer();
  }
  function moveTo(node) {
    if (!node) return false;
    const panel = node.closest('.relation-level-panel[hidden]');
    if (panel) {
      const button = [...doc.querySelectorAll('.relation-level-button')].find(control => control.getAttribute('aria-controls') === panel.id);
      button?.click();
      if (panel.hidden) return false;
    }
    let parent = node.parentElement;
    while (parent) { if (parent.tagName === 'DETAILS') parent.open = true; parent = parent.parentElement; }
    highlighted?.classList.remove('zx-reading-highlight'); highlighted = node;
    node.classList.add('zx-reading-highlight');
    node.tabIndex = -1; node.focus({ preventScroll: true });
    root.scrollTo({ top: Math.max(0, node.getBoundingClientRect().top + root.scrollY - line()), behavior: 'instant' });
    return true;
  }
  function resume() {
    const active = context(), saved = offer;
    if (!saved || !validPosition(saved) || !active || active.scope !== scope || active.revision !== revision || typeof activateReportChapter !== 'function') return;
    if (!activateReportChapter(saved.chapter, false, true, false)) return;
    const page = doc.getElementById(saved.chapter), node = blocks(page)[saved.block];
    if (!node) { offer = null; updateOffer(); return; }
    offer = null; updateOffer(); if (!moveTo(node)) return;
    root.scrollTo({ top: Math.max(0, node.getBoundingClientRect().top + root.scrollY + saved.fraction * node.getBoundingClientRect().height - line()), behavior: 'instant' });
    interacted = true;
  }
  function installControls(reader) {
    const rail = reader.querySelector('.reader-rail-inner');
    if (!rail) return;
    settings = make('details', 'zx-reader-settings', rail);
    const summary = make('summary', '', settings, 'Aa'); summary.title = '阅读设置'; summary.setAttribute('aria-label', '阅读设置');
    const panel = make('div', 'zx-reader-settings-panel', settings);
    const group = make('fieldset', '', panel); make('legend', '', group, '字号');
    for (const [value, text] of [['standard', '标准'], ['large', '大字']]) {
      const label = make('label', '', group), radio = make('input', '', label);
      radio.type = 'radio'; radio.name = 'zx-reader-size'; radio.value = value;
      radio.setAttribute('aria-label', text);
      radio.checked = preference.large === (value === 'large'); make('span', '', label, text);
      radio.addEventListener('change', () => {
        preference.large = radio.value === 'large'; applyPreferences();
        status.textContent = write(preferenceKey, preference) ? '' : '本次已生效，浏览器未允许保存设置。';
      }, { signal });
    }
    const label = make('label', 'zx-reader-motion-option', panel), checkbox = make('input', '', label);
    checkbox.type = 'checkbox'; checkbox.checked = preference.reduce || systemMotion.matches; checkbox.disabled = systemMotion.matches;
    checkbox.setAttribute('aria-label', '减少动效');
    make('span', '', label, '减少动效');
    const status = make('p', 'zx-reader-setting-status', panel); status.setAttribute('role', 'status');
    checkbox.addEventListener('change', () => {
      preference.reduce = checkbox.checked; applyPreferences();
      status.textContent = write(preferenceKey, preference) ? '' : '本次已生效，浏览器未允许保存设置。';
    }, { signal });
    settings.addEventListener('keydown', event => { if (event.key === 'Escape') { settings.open = false; summary.focus(); } }, { signal });
    resumeButton = make('button', 'zx-reader-resume', rail, '继续上次阅读'); resumeButton.type = 'button'; updateOffer();
    resumeButton.addEventListener('click', resume, { signal });
  }
  function addLink(parent, label, target) {
    if (!target || parent.querySelector('.zx-reading-fact-link')) return;
    const button = make('button', 'zx-reading-fact-link', parent);
    button.type = 'button'; button.title = label; button.setAttribute('aria-label', label); links.set(button, target);
    button.addEventListener('click', () => {
      const current = links.get(button), page = current?.closest('.reader-page');
      if (!current?.isConnected || !page || typeof activateReportChapter !== 'function' || !context()) return;
      activateReportChapter(page.id, false, true, false); moveTo(current); interacted = true; savePosition(true);
    }, { signal });
  }
  function installLinks(reader) {
    const chart = reader.querySelector('#sec-chart');
    if (!chart) return;
    const energy = chart.querySelector('.chapter-block');
    chart.querySelectorAll('.bar').forEach(row => addLink(row, '查看' + row.querySelector('b')?.textContent + '的五行解读', energy));
    const preferred = { '太阳': 'sec-overview', '月亮': 'sec-relation', '上升': 'sec-action' };
    chart.querySelectorAll('.astro-facts li').forEach(fact => {
      const label = fact.querySelector('span')?.textContent?.trim();
      const page = doc.getElementById(preferred[label]);
      const target = [...(page?.querySelectorAll('p,blockquote') || [])].find(node =>
        !node.matches('.chapter-source,.method-reference') && node.textContent.includes(label));
      addLink(fact, '查看' + label + (target ? '相关解读' : '计算来源'), target || chart.querySelector('.astro-block .chapter-source'));
    });
  }
  function enhance() {
    if (suspended || destroyed || doc.hidden) return;
    observer.disconnect();
    try {
      const reader = doc.querySelector('#reportReader'), active = context();
      if (!reader || !active) { removeOwned(); syncScope(null); return; }
      if (reader !== currentReader) { removeOwned(); currentReader = reader; installControls(reader); }
      installLinks(reader); syncScope(active);
      for (const node of owned) if (!node.isConnected) owned.delete(node);
    } finally { if (!suspended && !destroyed) observer.observe(doc.getElementById('out'), { childList: true, subtree: true }); }
  }
  function pause() { savePosition(true); suspended = true; observer?.disconnect(); }
  function start() { if (!destroyed) { suspended = false; enhance(); } }
  function destroy() { if (destroyed) return; pause(); destroyed = true; ++epoch; controller.abort(); removeOwned(); html.classList.remove('zx-reader-large', 'zx-reader-reduce'); }
  function intent(event) {
    if (event.target?.closest?.('input,textarea,select,.zx-reader-settings')) return;
    if (event.type !== 'keydown' || ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) interacted = true;
  }
  function mount() {
    if (!doc.getElementById('out') || root.getComputedStyle(html).getPropertyValue('--zx-reader-comfort-css').trim() !== '1') return;
    applyPreferences(); prunePositions(); observer = new MutationObserver(enhance);
    for (const name of ['wheel', 'touchmove', 'keydown']) doc.addEventListener(name, intent, { passive: true, signal });
    root.addEventListener('scroll', () => savePosition(), { passive: true, signal });
    root.addEventListener('scrollend', () => savePosition(true), { passive: true, signal });
    doc.addEventListener('click', event => { if (settings?.open && !settings.contains(event.target)) settings.open = false; }, { signal });
    root.addEventListener('pagehide', pause, { signal }); root.addEventListener('pageshow', start, { signal });
    doc.addEventListener('visibilitychange', () => doc.hidden ? pause() : start(), { signal });
    root.addEventListener('zx-private-session-cleared', () => { removeOwned(); syncScope(null); }, { signal });
    systemMotion.addEventListener('change', () => { applyPreferences(); const box = settings?.querySelector('input[type="checkbox"]'); if (box) { box.checked = preference.reduce || systemMotion.matches; box.disabled = systemMotion.matches; } }, { signal });
    enhance();
  }
  root.ZxReaderComfort = Object.freeze({ destroy });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount, { once: true, signal }); else mount();
})(typeof window === 'object' ? window : null);
