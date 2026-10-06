# Browser PDF dependencies

Loaded from this site's own origin only after the user requests PDF export. Report contents are never posted to a renderer or third-party service.

- pdf-lib 1.17.1: bundled runtime copy, MIT. Upstream https://github.com/Hopding/pdf-lib ; license in `pdf-lib-LICENSE.md`.
- @pdf-lib/fontkit 1.1.1: pinned UMD build from https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js ; MIT, upstream README and license notice in `fontkit-NOTICE.md` (https://github.com/Hopding/fontkit).
- ZhixingPDFSans-Regular.ttf: derived from https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf under SIL OFL 1.1 (`OFL.txt`). Converted CFF outlines to TrueType outlines using fontTools Cu2QuPen at max_err=1.0. Font family renamed to Zhixing PDF Sans. All 31,036 glyphs, Unicode mapping and horizontal metrics retained. This avoids the CFF subset CID mapping rendering failure found during Apple PDFKit verification. The browser embeds only the used glyphs in each PDF.

The font is intentionally independent of report text and contains no user information. Files are versioned and checked in; do not dynamically load CDN versions at runtime.
