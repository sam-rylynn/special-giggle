(function attachZXStoryPlayer(global) {
  'use strict';

  var STORE_KEY = 'zx_story_events_v1';
  var ASSET_BY_SCENE = {
    identity: './img/cover.jpg',
    energy: './img/energy.jpg',
    tension: './img/astro.jpg',
    mirror: './img/relation.jpg',
    phase: './img/phase.jpg',
    takeaway: './img/token.jpg',
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function replace(ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function cleanCapability(capability) {
    if (!capability || typeof capability !== 'object') return {};
    var out = {};
    ['record', 'share', 'fallback', 'error'].forEach(function copyKey(key) {
      if (capability[key] == null) return;
      out[key] = String(capability[key]).slice(0, 48);
    });
    return out;
  }

  function recordEvent(event, scene, capability) {
    var item = {
      event: String(event || '').slice(0, 40),
      scene: scene ? String(scene).slice(0, 24) : '',
      timestamp: new Date().toISOString(),
      capability: cleanCapability(capability),
    };
    try {
      var list = JSON.parse(global.localStorage.getItem(STORE_KEY) || '[]');
      if (!Array.isArray(list)) list = [];
      list.push(item);
      global.localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(-100)));
    } catch (_error) {
      // Local-only diagnostics are best effort.
    }
  }

  function create(options) {
    if (!options || !options.root || !options.spec || !Array.isArray(options.spec.scenes)) {
      throw new TypeError('ZXStoryPlayer.create requires { root, spec }.');
    }
    var root = options.root;
    var spec = options.spec;
    var index = 0;
    var mounted = false;
    var destroyed = false;
    var touchX = null;
    var cleanup = [];
    var motion = null;
    var listenersBound = false;

    function scene() {
      return spec.scenes[index];
    }

    function buttons() {
      return {
        prev: root.querySelector('[data-story-prev]'),
        next: root.querySelector('[data-story-next]'),
        close: root.querySelector('[data-story-close]'),
        replay: root.querySelector('[data-story-replay]'),
        read: root.querySelector('[data-story-read]'),
        share: root.querySelector('[data-story-share]'),
      };
    }

    function updateChrome() {
      var current = scene();
      root.querySelector('[data-story-counter]').textContent = String(index + 1) + ' / ' + spec.scenes.length;
      root.querySelector('[data-story-label]').textContent = current.eyebrow || current.sceneId;
      Array.from(root.querySelectorAll('[data-story-progress-step]')).forEach(function updateStep(step, i) {
        step.classList.toggle('is-complete', i < index);
        step.classList.toggle('is-current', i === index);
      });
      var btn = buttons();
      btn.prev.disabled = index === 0;
      btn.next.disabled = index === spec.scenes.length - 1;
      var atEnd = index === spec.scenes.length - 1;
      btn.share.hidden = !atEnd;
      btn.read.hidden = !atEnd;
      btn.replay.hidden = !atEnd;
      if (atEnd) recordEvent('story_complete', current.sceneId, {});
    }

    function show(nextIndex, direction) {
      if (destroyed) return Promise.resolve();
      var bounded = Math.max(0, Math.min(spec.scenes.length - 1, nextIndex));
      if (bounded === index && mounted) return Promise.resolve();
      index = bounded;
      var el = root.querySelector('[data-scene-id="' + spec.scenes[index].sceneId + '"]');
      updateChrome();
      recordEvent('scene_view', spec.scenes[index].sceneId, {});
      if (motion && typeof motion.show === 'function') return motion.show(el, direction || 'forward');
      Array.from(root.querySelectorAll('[data-scene-id]')).forEach(function toggle(candidate) {
        candidate.hidden = candidate !== el;
      });
      return Promise.resolve(el);
    }

    function next() { return show(index + 1, 'forward'); }
    function prev() { return show(index - 1, 'backward'); }
    function replay() { return show(0, 'backward'); }

    function close(mode) {
      if (root.hidden && !listenersBound) return;
      if (global.ZXShareClip && typeof global.ZXShareClip.cleanup === 'function') global.ZXShareClip.cleanup();
      root.hidden = true;
      if (global.document && global.document.body) global.document.body.classList.remove('story-open');
      if (options.onClose) options.onClose(mode || 'close');
      destroyMotionOnly();
      unbind();
    }

    function returnReading() {
      close('read');
      if (options.onReturnReading) options.onReturnReading();
    }

    function share() {
      recordEvent('share_intent', scene().sceneId, {});
      if (options.onShare) options.onShare(spec);
    }

    function onKey(event) {
      if (root.hidden) return;
      if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); next(); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); prev(); }
      else if (event.key === 'Escape') { event.preventDefault(); close('escape'); }
    }

    function onTouchStart(event) {
      touchX = event.touches && event.touches[0] ? event.touches[0].clientX : null;
    }

    function onTouchEnd(event) {
      if (touchX == null || !event.changedTouches || !event.changedTouches[0]) return;
      var dx = event.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) < 36) return;
      if (dx < 0) next();
      else prev();
    }

    function onCloseClick() { close('close'); }
    function onReadClick() { returnReading(); }
    function onShareClick() { share(); }

    function destroyMotionOnly() {
      if (global.ZXStoryMotion && typeof global.ZXStoryMotion.destroy === 'function') {
        global.ZXStoryMotion.destroy();
      }
      motion = null;
      mounted = false;
    }

    function destroy() {
      destroyed = true;
      unbind();
      destroyMotionOnly();
      root.hidden = true;
      root.innerHTML = '';
      if (global.document && global.document.body) global.document.body.classList.remove('story-open');
    }

    function render() {
      root.className = 'zx-story-shell';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.hidden = true;
      root.innerHTML =
        '<div class="zx-story-toolbar">' +
          '<div class="zx-story-brand">知星｜命盘研究所</div>' +
          '<div class="zx-story-mode">观星模式</div>' +
          '<button type="button" class="zx-story-icon-button zx-story-close" data-story-close aria-label="关闭">×</button>' +
        '</div>' +
        '<div class="zx-story-progress"><div class="zx-story-progress-track">' +
          spec.scenes.map(function step(_scene, i) { return '<span class="zx-story-progress-step" data-story-progress-step="' + i + '"></span>'; }).join('') +
        '</div><div class="zx-story-counter" data-story-counter>1 / 6</div></div>' +
        '<div class="zx-story-stage">' +
          spec.scenes.map(function sceneMarkup(item, i) {
            var src = ASSET_BY_SCENE[item.sceneId] || ASSET_BY_SCENE.identity;
            var actions = item.sceneId === 'takeaway'
              ? '<div class="zx-story-actions"><button type="button" class="zx-story-action zx-story-action-primary" data-story-share>生成分享片</button><button type="button" class="zx-story-action" data-story-read>返回阅读</button><button type="button" class="zx-story-action" data-story-replay>重播</button></div>'
              : '';
            return '<section class="zx-story-scene" data-scene-id="' + esc(item.sceneId) + '"' + (i ? ' hidden' : '') + '>' +
              '<img class="zx-story-media" src="' + esc(src) + '" alt="">' +
              '<div class="zx-story-content">' +
                '<div class="zx-story-kicker">' + esc(item.eyebrow) + '</div>' +
                '<h2 class="zx-story-title">' + esc(item.headline) + '</h2>' +
                '<p class="zx-story-lede">' + esc(item.body) + '</p>' +
                '<small class="zx-story-source">来源 · ' + esc(item.sourceIds.join(' / ')) + '</small>' +
                actions +
              '</div>' +
            '</section>';
          }).join('') +
        '</div>' +
        '<div class="zx-story-controls">' +
          '<button type="button" class="zx-story-icon-button" data-story-prev aria-label="上一幕">‹</button>' +
          '<div class="zx-story-scene-label" data-story-label></div>' +
          '<button type="button" class="zx-story-icon-button" data-story-next aria-label="下一幕">›</button>' +
        '</div>';
    }

    function bind() {
      if (listenersBound) return;
      var btn = buttons();
      btn.prev.addEventListener('click', prev);
      btn.next.addEventListener('click', next);
      btn.close.addEventListener('click', onCloseClick);
      btn.replay.addEventListener('click', replay);
      btn.read.addEventListener('click', onReadClick);
      btn.share.addEventListener('click', onShareClick);
      root.addEventListener('touchstart', onTouchStart, { passive: true });
      root.addEventListener('touchend', onTouchEnd);
      global.addEventListener('keydown', onKey);
      global.addEventListener('pagehide', destroy);
      listenersBound = true;
      cleanup.push(function remove() {
        btn.prev.removeEventListener('click', prev);
        btn.next.removeEventListener('click', next);
        btn.close.removeEventListener('click', onCloseClick);
        btn.replay.removeEventListener('click', replay);
        btn.read.removeEventListener('click', onReadClick);
        btn.share.removeEventListener('click', onShareClick);
        root.removeEventListener('touchstart', onTouchStart);
        root.removeEventListener('touchend', onTouchEnd);
        global.removeEventListener('keydown', onKey);
        global.removeEventListener('pagehide', destroy);
        listenersBound = false;
      });
    }

    function unbind() {
      cleanup.splice(0).forEach(function run(fn) { fn(); });
      listenersBound = false;
    }

    function open() {
      if (destroyed) return;
      if (!root.innerHTML) {
        render();
      }
      bind();
      root.hidden = false;
      if (global.document && global.document.body) global.document.body.classList.add('story-open');
      motion = global.ZXStoryMotion && global.ZXStoryMotion.mount
        ? global.ZXStoryMotion.mount(root, { visualTokens: {}, initialSceneId: spec.scenes[index].sceneId })
        : null;
      mounted = true;
      updateChrome();
      recordEvent('story_open', scene().sceneId, {});
      recordEvent('scene_view', scene().sceneId, {});
    }

    render();
    updateChrome();

    return { open: open, close: close, destroy: destroy, show: show, next: next, prev: prev, replay: replay, spec: spec };
  }

  var api = { create: create, recordEvent: recordEvent, STORE_KEY: STORE_KEY };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ZXStoryPlayer = api;
})(typeof window !== 'undefined' ? window : globalThis);
