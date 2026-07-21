/* share-qr.js — 只为服务端签名分享链接绘制二维码。 */
(function (global) {
  'use strict';

  function signedShareUrl(value) {
    var url;
    try {
      url = new URL(String(value || ''), global.location && global.location.href || 'https://zhixing.cn/');
    } catch (_) {
      throw new Error('invalid share url');
    }
    if (!/^https?:$/.test(url.protocol) || !url.searchParams.get('share')) {
      throw new Error('signed share token required');
    }
    return url.href;
  }

  function draw(context, value, options) {
    if (!context || typeof context.fillRect !== 'function') throw new Error('canvas context required');
    if (typeof global.qrcode !== 'function') throw new Error('qr encoder unavailable');

    options = options || {};
    var text = signedShareUrl(value);
    var size = Math.floor(Number(options.size) || 216);
    var quietZone = Math.max(4, Math.floor(Number(options.quietZone) || 4));
    var qr = global.qrcode(0, options.level || 'M');
    qr.addData(text, 'Byte');
    qr.make();

    var modules = qr.getModuleCount();
    var cellSize = Math.floor(size / (modules + quietZone * 2));
    if (cellSize < 2) throw new Error('share url is too dense for this qr size');

    var actualSize = cellSize * (modules + quietZone * 2);
    var left = Math.round((Number(options.x) || 0) + (size - actualSize) / 2);
    var top = Math.round((Number(options.y) || 0) + (size - actualSize) / 2);
    var light = options.light || '#f3ead2';
    var dark = options.dark || '#09111d';

    context.save();
    context.imageSmoothingEnabled = false;
    context.fillStyle = light;
    context.fillRect(left, top, actualSize, actualSize);
    context.fillStyle = dark;
    for (var row = 0; row < modules; row += 1) {
      for (var col = 0; col < modules; col += 1) {
        if (!qr.isDark(row, col)) continue;
        context.fillRect(
          left + (col + quietZone) * cellSize,
          top + (row + quietZone) * cellSize,
          cellSize,
          cellSize
        );
      }
    }
    context.restore();

    return Object.freeze({
      moduleCount: modules,
      cellSize: cellSize,
      actualSize: actualSize,
      left: left,
      top: top
    });
  }

  global.ZxShareQr = Object.freeze({ draw: draw, signedShareUrl: signedShareUrl });
})(window);
