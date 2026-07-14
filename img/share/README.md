# Share Card Assets

本目录只接收网页用压缩分享卡，不存原始大图。

- 日主身份卡：`day-master/`，宽度 750，保持定稿原始比例，不裁成 3:4。
- 本命签：`qian/`，固定 750 × 1000；60 张定稿已接收并按 `q.assetId` 接入运行时。
- 本命签审阅总览：`review/qian-overview/`，仅供视觉审阅，不作为前端运行时资产。
- 机器可读契约：`share-card-assets.json`

检查命令：

```bash
node tools/check-share-assets.mjs
node tools/check-share-assets.mjs --strict-files
```

普通检查用于结构与体积校验；`--strict-files` 额外要求清单内所有运行时素材均存在。
