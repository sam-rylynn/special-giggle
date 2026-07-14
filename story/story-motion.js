(function attachZXStoryMotion(global) {
  'use strict';

  var doc = global.document;
  var state = {
    root: null,
    scenes: [],
    active: null,
    pending: null,
    options: {},
    animations: new Map(),
    timers: new Map(),
    cleanup: [],
    tokenBackup: new Map(),
    transition: null,
  };

  function clamp(value, min, max, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function hasSceneId(scene) {
    return Boolean(scene && scene.dataset && scene.dataset.sceneId);
  }

  function isReducedMotion() {
    if (typeof state.options.reducedMotion === 'boolean') {
      return state.options.reducedMotion;
    }
    return Boolean(
      global.matchMedia &&
        global.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function updateDiagnostics() {
    if (!state.root || !state.root.dataset) return;
    state.root.dataset.zxMotionMode = isReducedMotion() ? 'reduced' : 'full';
    state.root.dataset.zxMotionAnimations = String(state.animations.size);
    state.root.dataset.zxMotionTimers = String(state.timers.size);
  }

  function setSceneVisibility(scene, visible, active) {
    scene.hidden = !visible;
    scene.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if ('inert' in scene) scene.inert = !visible;
    scene.classList.toggle('is-active', Boolean(active));
    if (!visible || active) {
      scene.classList.remove('is-entering', 'is-leaving');
    }
  }

  function finishResource(resource, collection) {
    var finish = collection.get(resource);
    if (!finish) return;
    collection.delete(resource);
    finish();
    updateDiagnostics();
  }

  function cancelMotionResources() {
    Array.from(state.animations.entries()).forEach(function cancelEntry(entry) {
      var animation = entry[0];
      try {
        animation.cancel();
      } catch (_error) {
        // A completed browser animation may already be detached.
      }
      finishResource(animation, state.animations);
    });

    Array.from(state.timers.entries()).forEach(function clearEntry(entry) {
      var timer = entry[0];
      global.clearTimeout(timer);
      finishResource(timer, state.timers);
    });
  }

  function finalizeScene(scene) {
    if (!scene) return;
    state.scenes.forEach(function updateScene(candidate) {
      setSceneVisibility(candidate, candidate === scene, candidate === scene);
    });
    state.active = scene;
    state.pending = null;
    state.root.dataset.zxSceneId = scene.dataset.sceneId;
    updateDiagnostics();
  }

  function settleTransition(target) {
    var transition = state.transition;
    state.transition = null;
    cancelMotionResources();
    finalizeScene(target || state.pending || state.active);
    if (transition && !transition.settled) {
      transition.settled = true;
      transition.resolve(state.active);
    }
  }

  function runAnimation(element, keyframes, timing) {
    if (typeof element.animate === 'function') {
      return new Promise(function playAnimation(resolve) {
        var settled = false;
        var animation;
        var finish = function finish() {
          if (settled) return;
          settled = true;
          resolve();
        };

        try {
          animation = element.animate(keyframes, timing);
          state.animations.set(animation, finish);
          updateDiagnostics();
          Promise.resolve(animation.finished).then(
            function animationDone() {
              finishResource(animation, state.animations);
            },
            function animationCancelled() {
              finishResource(animation, state.animations);
            }
          );
        } catch (_error) {
          finish();
        }
      });
    }

    return new Promise(function waitForFallback(resolve) {
      var timer = global.setTimeout(function completeFallback() {
        finishResource(timer, state.timers);
      }, timing.duration);
      state.timers.set(timer, resolve);
      updateDiagnostics();
    });
  }

  function transitionFrames(direction, reduced) {
    if (reduced) {
      return {
        incoming: [{ opacity: 0 }, { opacity: 1 }],
        outgoing: [{ opacity: 1 }, { opacity: 0 }],
      };
    }

    var sign = direction === 'backward' ? -1 : 1;
    return {
      incoming: [
        { opacity: 0, transform: 'translate3d(' + sign * 36 + 'px, 0, 0) scale(.985)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
      ],
      outgoing: [
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
        { opacity: 0, transform: 'translate3d(' + sign * -24 + 'px, 0, 0) scale(1.015)' },
      ],
    };
  }

  function show(sceneElement, direction) {
    if (!state.root) throw new Error('ZXStoryMotion.mount(root) must run before show().');
    if (!hasSceneId(sceneElement) || !state.root.contains(sceneElement)) {
      throw new TypeError('show(sceneElement) requires a mounted [data-scene-id] element.');
    }

    if (state.transition) settleTransition(state.pending);
    if (sceneElement === state.active) return Promise.resolve(sceneElement);

    var outgoing = state.active;
    var reduced = isReducedMotion();
    var frames = transitionFrames(direction, reduced);
    var duration = reduced
      ? clamp(state.options.reducedDuration, 120, 360, 180)
      : clamp(state.options.duration, 240, 1200, 680);
    var timing = { duration: duration, easing: reduced ? 'linear' : 'cubic-bezier(.22,.78,.22,1)', fill: 'both' };

    state.pending = sceneElement;
    setSceneVisibility(sceneElement, true, false);
    sceneElement.classList.add('is-entering');
    if (outgoing) outgoing.classList.add('is-leaving');
    updateDiagnostics();

    return new Promise(function transitionPromise(resolve) {
      var transition = { resolve: resolve, settled: false, target: sceneElement };
      state.transition = transition;
      var animations = [runAnimation(sceneElement, frames.incoming, timing)];
      if (outgoing) animations.push(runAnimation(outgoing, frames.outgoing, timing));

      Promise.all(animations).then(function completeTransition() {
        if (state.transition === transition) settleTransition(sceneElement);
      });
    });
  }

  function applyVisualTokens(root, tokens) {
    if (!tokens || typeof tokens !== 'object') return;
    Object.keys(tokens).forEach(function applyToken(name) {
      var value = tokens[name];
      if (!/^--zx-story-[a-z0-9-]+$/.test(name) || typeof value !== 'string' || value.length > 128) return;
      state.tokenBackup.set(name, {
        value: root.style.getPropertyValue(name),
        priority: root.style.getPropertyPriority(name),
      });
      root.style.setProperty(name, value);
    });
  }

  function restoreVisualTokens() {
    if (!state.root) return;
    state.tokenBackup.forEach(function restoreToken(previous, name) {
      if (previous.value) state.root.style.setProperty(name, previous.value, previous.priority);
      else state.root.style.removeProperty(name);
    });
    state.tokenBackup.clear();
  }

  function mount(root, options) {
    if (!root || typeof root.querySelectorAll !== 'function') {
      throw new TypeError('mount(root) requires a DOM element.');
    }

    destroy();
    state.root = root;
    state.options = options && typeof options === 'object' ? options : {};
    state.scenes = Array.from(root.querySelectorAll('[data-scene-id]')).filter(hasSceneId);
    if (!state.scenes.length) {
      state.root = null;
      throw new Error('mount(root) found no [data-scene-id] scenes.');
    }

    root.classList.add('zx-story-motion');
    applyVisualTokens(root, state.options.visualTokens);

    var initial = state.scenes[0];
    if (state.options.initialSceneId) {
      initial =
        state.scenes.find(function matchInitial(scene) {
          return scene.dataset.sceneId === state.options.initialSceneId;
        }) || initial;
    }
    finalizeScene(initial);

    if (doc && typeof doc.addEventListener === 'function') {
      var onVisibilityChange = function onVisibilityChange() {
        if (doc.hidden && state.root) settleTransition(state.pending || state.active);
      };
      doc.addEventListener('visibilitychange', onVisibilityChange);
      state.cleanup.push(function removeVisibilityListener() {
        doc.removeEventListener('visibilitychange', onVisibilityChange);
      });
    }

    return api;
  }

  function destroy() {
    cancelMotionResources();
    if (state.transition && !state.transition.settled) {
      state.transition.settled = true;
      state.transition.resolve(null);
    }
    state.transition = null;

    state.cleanup.splice(0).forEach(function runCleanup(cleanup) {
      cleanup();
    });

    if (state.root) {
      restoreVisualTokens();
      state.scenes.forEach(function resetScene(scene) {
        scene.hidden = false;
        scene.removeAttribute('aria-hidden');
        if ('inert' in scene) scene.inert = false;
        scene.classList.remove('is-active', 'is-entering', 'is-leaving');
      });
      state.root.classList.remove('zx-story-motion');
      delete state.root.dataset.zxSceneId;
      delete state.root.dataset.zxMotionMode;
      delete state.root.dataset.zxMotionAnimations;
      delete state.root.dataset.zxMotionTimers;
    }

    state.root = null;
    state.scenes = [];
    state.active = null;
    state.pending = null;
    state.options = {};
  }

  var api = Object.freeze({ mount: mount, show: show, destroy: destroy });
  global.ZXStoryMotion = api;
})(window);
