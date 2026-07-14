(function attachZXShareClip(global) {
  'use strict';

  var WIDTH = 720;
  var HEIGHT = 1280;
  var FPS = 30;
  var DURATION_MS = 15000;
  var MIME_TYPES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  var active = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function replace(ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function safePayload(spec) {
    var clip = spec && spec.shareClip ? spec.shareClip : {};
    return {
      identity: String(clip.identity || '').slice(0, 32),
      strength: String(clip.strength || '').slice(0, 8),
      tension: String(clip.tension || '').slice(0, 58),
      actionAdvice: String(clip.actionAdvice || '').slice(0, 58),
      brand: String(clip.brand || '知星｜命盘研究所').slice(0, 24),
    };
  }

  function pickMime(win) {
    if (!win.MediaRecorder || typeof win.MediaRecorder.isTypeSupported !== 'function') return '';
    return MIME_TYPES.find(function supported(type) { return win.MediaRecorder.isTypeSupported(type); }) || '';
  }

  function capabilities(win, canvas) {
    var mime = pickMime(win);
    return {
      record: Boolean(mime && canvas && typeof canvas.captureStream === 'function'),
      mime: mime,
      share: Boolean(win.navigator && typeof win.navigator.canShare === 'function'),
      fallback: true,
    };
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    var lines = [];
    var line = '';
    Array.from(String(text || '')).forEach(function each(ch) {
      var next = line + ch;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach(function draw(lineText, i) {
      ctx.fillText(lineText, x, y + i * lineHeight);
    });
    return y + Math.min(lines.length, maxLines) * lineHeight;
  }

  function drawFrame(canvas, payload, progress) {
    var ctx = canvas.getContext('2d');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    var p = Math.max(0, Math.min(1, progress || 0));
    var g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, '#0e1220');
    g.addColorStop(.52, '#1a2233');
    g.addColorStop(1, '#070910');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.globalAlpha = .16;
    ctx.strokeStyle = '#c9a85c';
    ctx.lineWidth = 2;
    for (var i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.arc(WIDTH / 2, 350, 90 + i * 44 + p * 18, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#c9a85c';
    ctx.font = '28px "Songti SC", serif';
    ctx.fillText(payload.brand, WIDTH / 2, 118);

    ctx.fillStyle = '#e8e4d8';
    ctx.font = '700 58px "Songti SC", serif';
    wrapText(ctx, payload.identity, WIDTH / 2, 300, 560, 72, 2);

    ctx.fillStyle = '#c9a85c';
    ctx.font = '30px "Songti SC", serif';
    ctx.fillText(payload.strength, WIDTH / 2, 482);

    ctx.fillStyle = 'rgba(232,228,216,.88)';
    ctx.font = '30px "PingFang SC", sans-serif';
    wrapText(ctx, payload.tension, WIDTH / 2, 640, 560, 48, 3);

    ctx.fillStyle = '#e9d09a';
    ctx.font = '34px "Songti SC", serif';
    wrapText(ctx, payload.actionAdvice, WIDTH / 2, 900, 570, 54, 3);

    ctx.strokeStyle = 'rgba(201,168,92,.42)';
    ctx.lineWidth = 1;
    ctx.strokeRect(44, 44, WIDTH - 88, HEIGHT - 88);
    ctx.fillStyle = 'rgba(107,114,128,.9)';
    ctx.font = '22px "Songti SC", serif';
    ctx.fillText('以易理观己 · 以星盘为证', WIDTH / 2, 1146);
  }

  function makeOverlay(payload) {
    var overlay = global.document.createElement('div');
    overlay.className = 'zx-clip-layer';
    overlay.innerHTML =
      '<div class="zx-clip-panel" role="dialog" aria-modal="true" aria-label="分享片预览">' +
        '<canvas class="zx-clip-canvas" width="' + WIDTH + '" height="' + HEIGHT + '"></canvas>' +
        '<div class="zx-clip-status" data-clip-status>预览已生成，确认后再导出。</div>' +
        '<div class="zx-clip-actions">' +
          '<button type="button" class="zx-story-action zx-story-action-primary" data-clip-export>导出分享片</button>' +
          '<button type="button" class="zx-story-action" data-clip-save>保存静态海报</button>' +
          '<button type="button" class="zx-story-action" data-clip-cancel>取消</button>' +
        '</div>' +
      '</div>';
    global.document.body.appendChild(overlay);
    drawFrame(overlay.querySelector('canvas'), payload, 0);
    return overlay;
  }

  function downloadBlob(blob, filename) {
    var url = global.URL.createObjectURL(blob);
    var a = global.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    global.document.body.appendChild(a);
    a.click();
    a.remove();
    global.setTimeout(function revoke() { global.URL.revokeObjectURL(url); }, 1000);
  }

  function open(spec, options) {
    cleanup();
    var payload = safePayload(spec);
    var overlay = makeOverlay(payload);
    var canvas = overlay.querySelector('canvas');
    var status = overlay.querySelector('[data-clip-status]');
    var cap = capabilities(global, canvas);
    var recorder = null;
    var stream = null;
    var timer = null;
    var raf = null;
    var chunks = [];
    var done = false;
    var cancelled = false;
    var onEvent = options && options.onEvent;

    function emit(event, capability) {
      if (onEvent) onEvent(event, '', capability || cap);
    }

    function stopTracks() {
      if (stream) {
        stream.getTracks().forEach(function stop(track) { track.stop(); });
      }
      stream = null;
    }

    function stopAnimation() {
      if (raf) global.cancelAnimationFrame(raf);
      raf = null;
      if (timer) global.clearTimeout(timer);
      timer = null;
    }

    function controllerCleanup() {
      if (done) return;
      done = true;
      cancelled = true;
      stopAnimation();
      try {
        if (recorder && recorder.state !== 'inactive') recorder.stop();
      } catch (_error) {}
      stopTracks();
      global.removeEventListener('pagehide', controllerCleanup);
      overlay.remove();
      if (active && active.cleanup === controllerCleanup) active = null;
    }

    function saveStatic() {
      canvas.toBlob(function save(blob) {
        if (blob) downloadBlob(blob, 'zhixing-story-poster.png');
      }, 'image/png');
    }

    function animate(start) {
      var elapsed = Date.now() - start;
      drawFrame(canvas, payload, elapsed / DURATION_MS);
      if (elapsed < DURATION_MS) raf = global.requestAnimationFrame(function next() { animate(start); });
    }

    function exportClip() {
      emit('clip_export_start', cap);
      if (!cap.record) {
        status.textContent = '当前浏览器不支持录制，已回退为静态分享海报。';
        emit('clip_export_fail', { fallback: 'static' });
        saveStatic();
        return;
      }
      chunks = [];
      try {
        stream = canvas.captureStream(FPS);
        recorder = new global.MediaRecorder(stream, { mimeType: cap.mime, audioBitsPerSecond: 0, videoBitsPerSecond: 2500000 });
        recorder.ondataavailable = function onData(event) { if (event.data && event.data.size) chunks.push(event.data); };
        recorder.onstop = function onStop() {
          if (cancelled) return;
          stopAnimation();
          stopTracks();
          var blob = new Blob(chunks, { type: cap.mime || 'video/webm' });
          emit('clip_export_success', { record: cap.mime || 'video/webm', share: cap.share ? 'canShare' : 'download' });
          var file = new File([blob], 'zhixing-story-clip.webm', { type: blob.type });
          if (global.navigator && global.navigator.canShare && global.navigator.canShare({ files: [file] }) && global.navigator.share) {
            global.navigator.share({ files: [file], title: payload.brand }).catch(function shareFailed() {
              downloadBlob(blob, file.name);
            });
          } else {
            downloadBlob(blob, file.name);
          }
          status.textContent = '分享片已导出。';
        };
        recorder.start();
        status.textContent = '正在生成 15 秒分享片，可随时取消。';
        var start = Date.now();
        animate(start);
        timer = global.setTimeout(function stopRecord() {
          if (recorder && recorder.state !== 'inactive') recorder.stop();
        }, DURATION_MS);
      } catch (error) {
        status.textContent = '录制不可用，已回退为静态分享海报。';
        emit('clip_export_fail', { fallback: 'static', error: error && error.name });
        stopAnimation();
        stopTracks();
        saveStatic();
      }
    }

    overlay.querySelector('[data-clip-export]').addEventListener('click', exportClip);
    overlay.querySelector('[data-clip-save]').addEventListener('click', saveStatic);
    overlay.querySelector('[data-clip-cancel]').addEventListener('click', controllerCleanup);
    global.addEventListener('pagehide', controllerCleanup);
    emit('clip_preview', cap);

    active = { cleanup: controllerCleanup, payload: payload, canvas: canvas };
    return active;
  }

  function cleanup() {
    if (active && active.cleanup) active.cleanup();
    active = null;
  }

  var api = {
    open: open,
    cleanup: cleanup,
    safePayload: safePayload,
    drawFrame: drawFrame,
    capabilities: capabilities,
    pickMime: pickMime,
    WIDTH: WIDTH,
    HEIGHT: HEIGHT,
    FPS: FPS,
    DURATION_MS: DURATION_MS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ZXShareClip = api;
})(typeof window !== 'undefined' ? window : globalThis);
