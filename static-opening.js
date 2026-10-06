(function () {
  'use strict';
  const image = document.getElementById('zx-entrance-image');
  const source = image.closest('picture').querySelector('source');
  const landscape = matchMedia(source.media);
  const setFailed = failed => {
    document.body.classList.toggle('zx-entrance-failed', failed);
    document.body.classList.remove('zx-entrance-pending');
  };
  let revision = 0;
  const checkSource = () => {
    const current = ++revision;
    const expected = new URL(landscape.matches ? source.srcset : image.src, document.baseURI).href;
    const reconcile = () => {
      if (current === revision) setFailed(!image.naturalWidth || image.currentSrc !== expected);
    };
    // Cached failed sources can change on rotation without another error event.
    image.decode().then(reconcile, reconcile);
  };
  image.addEventListener('error', () => { revision++; setFailed(true); });
  image.addEventListener('load', checkSource);
  landscape.addEventListener('change', checkSource);
  if (image.complete) checkSource();
})();
