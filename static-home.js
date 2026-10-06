/* Presentation adapter: chart, copy, consent, ownership and report actions stay upstream. */
(function () {
  'use strict';
  const stems = { '甲': 'jia', '乙': 'yi', '丙': 'bing', '丁': 'ding', '戊': 'wu', '己': 'ji', '庚': 'geng', '辛': 'xin', '壬': 'ren', '癸': 'gui' };
  const $ = id => document.getElementById(id);
  function mount() {
    const result = $('result');
    const copy = document.querySelector('.confirmed-hero');
    if (!result || !copy || !window.ZxHomeChartBridge || document.body.dataset.staticHomeMounted === 'true') return;
    const nav = document.querySelector('.zx-static-nav');
    if (!nav) return;
    const actions = nav.lastElementChild;
    const profile = $('day-profile-link');
    if (profile) {
      profile.textContent = '我的资料';
      const icon = document.createElement('i');
      icon.dataset.lucide = 'user-round';
      profile.prepend(icon);
      actions.replaceChildren($('day-chart-switch'), profile);
    }

    const hero = document.createElement('div');
    hero.className = 'zx-static-result-hero';
    const title = document.createElement('div');
    title.className = 'zx-static-title';
    $('resultTitle').textContent = '你的日主';
    title.append($('resultTitle'), $('dayMasterHero'));
    const scene = document.createElement('figure');
    scene.className = 'zx-static-scene';
    scene.innerHTML = '<img id="zx-static-art" width="1024" height="1024" alt="" decoding="async" fetchpriority="high"><p class="zx-static-art-error" hidden>画面暂未加载，日主解读仍可阅读。</p>';
    const image = scene.firstElementChild;
    image.addEventListener('error', () => { scene.lastElementChild.hidden = false; image.hidden = true; });
    image.addEventListener('load', () => { scene.lastElementChild.hidden = true; image.hidden = false; });
    const source = document.createElement('p');
    source.id = 'zx-static-source';
    copy.prepend(source);
    const links = document.createElement('div');
    links.className = 'zx-static-links';
    links.innerHTML = '<a class="zx-report-link" href="#reportPreview">了解深度报告<i data-lucide="arrow-right"></i></a><button class="zx-save-link" type="button">保存日主卡</button>';
    links.lastElementChild.addEventListener('click', () => $('shareActionBtn').click());
    links.firstElementChild.addEventListener('click', event => {
      event.preventDefault();
      const target = $('reportPreview');
      target.tabIndex = -1;
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
      target.focus({ preventScroll: true });
    });
    copy.append(links);
    hero.append(title, scene, copy);
    result.prepend(hero);
    // Keep precision/method information and selected-chart identity in the real reading flow.
    const notes = document.createElement('div');
    notes.className = 'zx-static-method';
    const nameBar = document.querySelector('.zx-name-bar');
    if (nameBar) notes.append(nameBar);
    notes.append($('rzSub'), document.querySelector('#dayMasterHero .method-reference'));
    $('confirmedHome').append(notes);
    document.querySelector('.zx-name-bar')?.classList.add('zx-static-name');
    document.body.classList.add('zx-static-home');
    document.body.dataset.staticHomeMounted = 'true';
    window.lucide?.createIcons();

    let currentArt = '';
    function update() {
      const current = window.ZxHomeChartBridge.getCurrent();
      const id = stems[current?.chart?.dayMaster?.stem || current?.dp?.stem];
      if (!id) return;
      hero.dataset.stem = id;
      if (id !== currentArt) {
        currentArt = id;
        image.hidden = false;
        scene.lastElementChild.hidden = true;
        image.src = './media/static-home/day-masters/' + id + '.webp';
      }
      image.alt = current.home.dayMaster.label + ' · ' + current.home.dayMaster.image;
      source.textContent = current.home.dayMaster.label + ' × 太阳' + current.sign.replace(/座$/, '');
    }
    const observer = new MutationObserver(update);
    const observe = () => {
      observer.observe($('rzChars'), { childList: true, characterData: true, subtree: true });
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-view-state'] });
      update();
    };
    observe();
    window.addEventListener('pagehide', () => observer.disconnect());
    window.addEventListener('pageshow', observe);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
