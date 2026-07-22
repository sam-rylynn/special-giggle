# Share Card Assets

本目录只接收网页用压缩分享卡，不存原始大图。

- 日主身份卡：`day-master/`，十张视觉只认 2026-07-10 定稿，宽度 750 并保持各自原始比例。运行时按天干加载对应卡面，只覆盖原图中的示例日柱、太阳星座和未核验二维码槽；不再生成通用 Canvas 卡面。
- 本命签：`qian/`，六十张视觉只认 2026-07-13 全量改版，固定 750 × 1000。运行时按 `q.assetId` 加载，只覆盖制作日期和原图二维码底栏；加载失败时明确提示重试，不再回退另一套 Canvas 卡面。
- Canvas 仅作为图片导出和服务端签名二维码的合成表面，不是视觉模板来源。
- 两类分享卡只有在服务端 `/share/intents` 签发 `share_token` 后，才由 `share-qr.js` 在定稿图片的二维码槽中动态绘制专属入口码。二维码只包含入口 URL 与签名令牌，不包含出生资料或命盘内容。
- 本命签审阅总览：`review/qian-overview/`，仅供视觉审阅，不作为前端运行时资产。
- 机器可读契约：`share-card-assets.json`
- 最新资产与接入交接：`memory/share-card-assets-handoff-2026-07-21.md`

检查命令：

```bash
node tools/check-share-assets.mjs
node tools/check-share-assets.mjs --strict-files
```

普通检查用于结构与体积校验；`--strict-files` 额外要求清单内所有运行时素材均存在。
