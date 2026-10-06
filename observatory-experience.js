/* Optional presentation layer. Native report/profile code owns data and actions. */
(function () {
  'use strict';
  if (window.ZxObservatory) return;
  const stems = { '甲': 'jia', '乙': 'yi', '丙': 'bing', '丁': 'ding', '戊': 'wu', '己': 'ji', '庚': 'geng', '辛': 'xin', '壬': 'ren', '癸': 'gui' };
  const chapters = ['sec-overview', 'sec-chart', 'sec-relation', 'sec-action', 'sec-phase'];
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const owned = new Set();
  const animations = new Map();
  const controller = new AbortController();
  let mounted = false;
  let destroyed = false;
  let suspended = false;
  let observer;
  let activeChapter = '';
  let activePage;
  let currentStem = '';
  let currentSelection = '';
  let started = 0;

  function cancelMotion() {
    for (const animation of animations.values()) animation.cancel();
    animations.clear();
    root.dataset.observatoryActive = '0';
  }
  function play(node, frames, duration = 440) {
    if (!node || reduced.matches || root.classList.contains('zx-reader-reduce') || suspended || document.hidden || destroyed || !node.animate) return;
    animations.get(node)?.cancel();
    const animation = node.animate(frames, { duration, easing: 'cubic-bezier(.22,1,.36,1)', iterations: 1 });
    animations.set(node, animation);
    root.dataset.observatoryActive = String(animations.size);
    root.dataset.observatoryStarted = String(++started);
    const finish = () => {
      if (animations.get(node) === animation) animations.delete(node);
      if (!destroyed) root.dataset.observatoryActive = String(animations.size);
    };
    animation.finished.then(finish, finish);
  }
  function make(tag, cls, parent) {
    const node = document.createElement(tag);
    node.className = cls;
    node.setAttribute('aria-hidden', 'true');
    parent.append(node);
    owned.add(node);
    return node;
  }
  function instrument(parent, cls) {
    const art = make('div', 'zx-ob-art ' + cls, parent);
    const aperture = make('div', 'zx-ob-aperture', art);
    const image = make('img', 'zx-ob-image', aperture);
    image.alt = '';
    image.decoding = 'async';
    image.addEventListener('error', () => art.classList.add('zx-ob-art-unavailable'), { signal: controller.signal });
    image.addEventListener('load', () => {
      art.classList.remove('zx-ob-art-unavailable');
      play(art.querySelector('.zx-ob-rotor'), [{ transform: 'rotate(-32deg)', opacity: .3 }, { transform: 'rotate(0deg)', opacity: 1 }], 760);
      play(image, [{ opacity: .35 }, { opacity: 1 }], 600);
    }, { signal: controller.signal });
    const rotor = make('div', 'zx-ob-rotor', art);
    // Instrument marks are decorative, not fabricated natal positions or strengths.
    const ticks = Array.from({ length: 48 }, (_, index) => `<path d="M160 9v${index % 4 === 0 ? 12 : 5}" transform="rotate(${index * 7.5} 160 160)"/>`).join('');
    rotor.innerHTML = `<svg viewBox="0 0 320 320" fill="none" aria-hidden="true" focusable="false"><circle cx="160" cy="160" r="158" class="zx-ob-dim"/><circle cx="160" cy="160" r="136"/><g class="zx-ob-ticks">${ticks}</g><path d="M160 0v26M160 294v26M0 160h26M294 160h26"/><path d="M209 34a136 136 0 0 1 77 75M34 209a136 136 0 0 0 77 77" class="zx-ob-edge"/></svg>`;
    return art;
  }
  function changeArt(art, stem) {
    if (!art || art.dataset.stem === (stem || '')) return;
    art.dataset.stem = stem || '';
    const image = art.querySelector('img');
    if (stems[stem]) {
      image.src = './media/static-home/day-masters/' + stems[stem] + '.webp';
      art.classList.remove('zx-ob-art-unavailable');
    } else {
      image.removeAttribute('src');
      art.classList.add('zx-ob-art-unavailable');
    }
  }
  function meters(page, animate) {
    const rows = [...page.querySelectorAll('.bar')];
    if (!rows.length) return;
    const values = rows.map(row => Number(row.querySelector('small')?.textContent));
    if (values.some(value => !Number.isFinite(value) || value < 0)) return;
    const max = Math.max(...values);
    if (!(max > 0)) return;
    rows.forEach(row => {
      const track = row.querySelector('.track');
      if (!track) return;
      if (!track.querySelector('.zx-ob-meter-ticks')) {
        const ticks = make('div', 'zx-ob-meter-ticks', track);
        for (let index = 0; index <= 10; index++) make('i', '', ticks);
        make('i', 'zx-ob-meter-scan', track);
      }
      if (animate) play(track.querySelector('.zx-ob-meter-scan'), [{ transform: 'scaleX(.08)', opacity: .85 }, { transform: 'scaleX(1)', opacity: 0 }], 680);
    });
    let scale = page.querySelector('.zx-ob-meter-scale');
    if (!scale) {
      scale = make('div', 'zx-ob-meter-scale', rows[0].parentNode);
      rows.at(-1).after(scale);
      make('span', 'zx-ob-meter-zero', scale).textContent = '0';
      make('span', 'zx-ob-meter-max', scale);
    }
    // The ruler shares the native bars' zero/max scale; it never invents percentages.
    const limit = scale.querySelector('.zx-ob-meter-max');
    if (limit.textContent !== String(max)) limit.textContent = String(max);
  }
  function report() {
    const hero = document.querySelector('.report-hero');
    const reader = document.querySelector('#reportReader');
    if (!hero || !reader) {
      hero?.querySelector('.zx-ob-report-art')?.remove();
      root.classList.remove('zx-ob-report-ready');
      activeChapter = '';
      activePage = undefined;
      return;
    }
    root.classList.add('zx-ob-report-ready');
    let art = hero.querySelector('.zx-ob-report-art');
    if (!art) art = instrument(hero, 'zx-ob-report-art');
    const identity = document.querySelector('#reportIdentity')?.textContent || '';
    changeArt(art, identity.match(/([甲乙丙丁戊己庚辛壬癸])[木火土金水]/)?.[1]);
    const rail = reader.querySelector('.reader-rail-inner');
    if (rail && !rail.querySelector('.zx-ob-route')) {
      const track = make('div', 'zx-ob-route', rail);
      chapters.forEach(id => { const dot = make('i', 'zx-ob-node', track); dot.dataset.chapter = id; });
      make('i', 'zx-ob-cursor', track);
    }
    const page = reader.querySelector('.reader-page.is-active');
    if (!page) return;
    const changed = activeChapter !== page.id || activePage !== page;
    meters(page, changed);
    if (!changed) return;
    const previous = chapters.indexOf(activeChapter);
    activeChapter = page.id;
    activePage = page;
    reader.querySelectorAll('.zx-ob-node').forEach(dot => dot.classList.toggle('is-current', dot.dataset.chapter === activeChapter));
    const heading = page.querySelector('.pad > h2');
    play(heading, [{ transform: 'translateY(5px)', opacity: .55 }, { transform: 'translateY(0)', opacity: 1 }], 420);
    const cursor = reader.querySelector('.zx-ob-cursor');
    const index = chapters.indexOf(activeChapter);
    if (cursor && index >= 0) {
      const destination = `translateX(${index * 100}%)`;
      cursor.style.transform = destination;
      play(cursor, [{ transform: `translateX(${(previous < 0 ? index : previous) * 100}%)`, opacity: .5 }, { transform: destination, opacity: 1 }], 480);
    }
  }
  function profile() {
    const identity = document.querySelector('#profile-identity');
    if (!identity) return;
    const selected = document.querySelector('.chart-library-item.is-current');
    const seal = selected?.querySelector('.chart-seal');
    const stem = seal?.querySelector('strong')?.textContent?.trim() || '';
    let art = identity.querySelector('.zx-ob-profile-art');
    if (!art) art = instrument(identity, 'zx-ob-profile-art');
    changeArt(art, stem);
    if (currentStem !== stem) {
      currentStem = stem;
      root.classList.toggle('zx-ob-profile-ready', !!stems[stem]);
    }
    const copy = identity.querySelector('.identity-copy');
    if (copy) {
      let label = copy.querySelector('.zx-ob-stem-label');
      if (stems[stem]) {
        if (!label) label = make('span', 'zx-ob-stem-label', copy);
        const text = stem + (seal.querySelector('span')?.textContent?.trim() || '');
        if (label.textContent !== text) label.textContent = text;
      } else label?.remove();
    }
    const selection = selected?.querySelector('a')?.getAttribute('href') || stem;
    if (currentSelection && selection !== currentSelection) {
      play(copy, [{ transform: 'translateY(4px)', opacity: .55 }, { transform: 'translateY(0)', opacity: 1 }], 380);
      play(art.querySelector('.zx-ob-rotor'), [{ transform: 'rotate(-18deg)', opacity: .4 }, { transform: 'rotate(0deg)', opacity: 1 }], 560);
    }
    currentSelection = selection;
    const shared = document.querySelector('.shared-reading-panel');
    if (shared && !shared.querySelector('.zx-ob-pair')) {
      const pair = make('div', 'zx-ob-pair', shared);
      pair.innerHTML = '<svg viewBox="0 0 240 130" fill="none" aria-hidden="true" focusable="false"><path class="zx-ob-pair-axis" d="M8 65H232"/><g class="zx-ob-pair-left"><ellipse cx="94" cy="65" rx="67" ry="45" transform="rotate(-28 94 65)"/><circle cx="40" cy="81" r="4"/><path d="M94 51v28M80 65h28"/></g><g class="zx-ob-pair-right"><ellipse cx="148" cy="65" rx="67" ry="45" transform="rotate(28 148 65)"/><circle cx="202" cy="82" r="4"/><path d="M148 53v24M136 65h24"/></g></svg>';
      const respond = () => {
        play(pair.querySelector('.zx-ob-pair-left'), [{ transform: 'translateX(-9px)', opacity: .4 }, { transform: 'translateX(0)', opacity: 1 }]);
        play(pair.querySelector('.zx-ob-pair-right'), [{ transform: 'translateX(9px)', opacity: .4 }, { transform: 'translateX(0)', opacity: 1 }]);
      };
      const action = shared.querySelector('#synastry-action');
      action?.addEventListener('focusin', respond, { signal: controller.signal });
      action?.addEventListener('click', respond, { signal: controller.signal });
    }
  }
  function enhance() {
    if (!mounted || destroyed || suspended || document.hidden) return;
    observer.disconnect();
    try {
      report();
      profile();
      for (const [node, animation] of animations) if (!node.isConnected) { animation.cancel(); animations.delete(node); }
      for (const node of owned) if (!node.isConnected) owned.delete(node);
      root.dataset.observatoryActive = String(animations.size);
    } finally {
      for (const target of [document.querySelector('#out'), document.querySelector('#main')]) {
        if (target) observer.observe(target, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
      }
    }
  }
  function pause() { suspended = true; observer?.disconnect(); cancelMotion(); }
  function resume() { if (!destroyed) { suspended = false; enhance(); } }
  function mount() {
    if (mounted || destroyed || (!root.classList.contains('zx-reading') && !root.classList.contains('zx-profile'))) return;
    // If the optional stylesheet fails, do not insert unstyled imagery into the reader.
    if (window.getComputedStyle(root).getPropertyValue('--zx-observatory-css').trim() !== '1') return;
    mounted = true;
    root.classList.add('zx-observatory');
    observer = new MutationObserver(enhance);
    window.addEventListener('pagehide', pause, { signal: controller.signal });
    window.addEventListener('pageshow', resume, { signal: controller.signal });
    document.addEventListener('visibilitychange', () => document.hidden ? pause() : resume(), { signal: controller.signal });
    reduced.addEventListener('change', cancelMotion, { signal: controller.signal });
    window.addEventListener('zx-reader-motion-change', cancelMotion, { signal: controller.signal });
    enhance();
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    pause();
    controller.abort();
    owned.forEach(node => node.remove());
    owned.clear();
    root.classList.remove('zx-observatory', 'zx-ob-profile-ready', 'zx-ob-report-ready');
    delete root.dataset.observatoryActive;
    delete root.dataset.observatoryStarted;
  }
  window.ZxObservatory = Object.freeze({ mount, destroy });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true, signal: controller.signal });
  else mount();
})();
