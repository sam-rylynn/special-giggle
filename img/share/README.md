# Share Card Assets

本目录只接收网页用压缩分享卡，不存原始大图。

- 日主身份卡：`day-master/`，宽度 750，保持定稿原始比例，不裁成 3:4；因内嵌固定日柱文案和未核验二维码，不直接作为运行时成品。网页改用无文字、无二维码的 `web/media/day-master-share-bg-v2.webp`，再由确定性 Canvas 绘制真实日柱、日主、关键词与星盘辅证。
- 本命签：`qian/`，固定 750 × 1000；逐文件重算确认与 2026-07-13 全量改版标准压缩结果 `60/60` 一致。运行时按 `q.assetId` 加载，只绘制不含旧二维码的安全视觉区并动态重绘底栏，加载失败时回退 Canvas。
- 两类分享卡默认均不绘制二维码；仅当服务端 `/share/intents` 签发 `share_token` 后，才由 `share-qr.js` 动态绘制专属入口码。二维码只包含入口 URL 与签名令牌，不包含出生资料或命盘内容。
- 本命签审阅总览：`review/qian-overview/`，仅供视觉审阅，不作为前端运行时资产。
- 机器可读契约：`share-card-assets.json`
- 最新资产与接入交接：`memory/share-card-assets-handoff-2026-07-21.md`

检查命令：

```bash
node tools/check-share-assets.mjs
node tools/check-share-assets.mjs --strict-files
```

普通检查用于结构与体积校验；`--strict-files` 额外要求清单内所有运行时素材均存在。
