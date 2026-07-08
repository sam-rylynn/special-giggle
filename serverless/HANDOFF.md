# 会员系统后端 · 交接说明(HANDOFF)

给后端团队。前端是 GitHub Pages 静态站(公开 repo),后端独立部署到腾讯云 SCF。
本目录 `serverless/` 是可直接部署的骨架代码;**密钥一律走环境变量,绝不入库**。
部署分步见 [README.md](./README.md),本文件是「转发用」的整体契约 + 待办。

---

## 1. 现在要部署什么(Phase A/B,不碰钱)

一个 **SCF Web 函数**(Node.js 16+,监听 9000),提供账号 / 跨设备盘 / 微信绑定 / 埋点收集。
依赖:`mysql2`(见 `package.json`)。数据库:腾讯云 MySQL / TDSQL-C,用 `schema.sql` 建表。

### 接口契约

| 方法 | 路径 | 鉴权 | 请求 | 响应 |
|---|---|---|---|---|
| POST | `/account/init` | 否 | `{device_id}`(前端 zx_cid,`^[a-z0-9]{6,64}$`) | `{token, member_until}` |
| GET | `/account/me` | Bearer | — | `{member_until, is_member, is_bound}` |
| POST | `/charts/sync` | Bearer | `{payload:{d,t,c,g}}` | `{ok:true}` |
| GET | `/charts` | Bearer | — | `{chart, updated_at}` |
| DELETE | `/charts` | Bearer | — | `{ok:true}`(关闭云端同步时删) |
| GET | `/wx/login-url` | Bearer | — | `{url}`;未配 WX_* 返回 503 |
| GET | `/wx/callback` | 签名 state | `?code&state` | 302 → `WX_APP_RETURN#bindcode=<code>`(失败 `?bind=err`) |
| POST | `/wx/claim` | Bearer | `{bindcode}` | `{token, is_bound:true}` |
| POST | `/order/create` | Bearer | `{plan}` | `{out_trade_no, code_url}`(未配支付返回 503) |
| GET | `/order/status` | Bearer | `?out_trade_no` | `{status}` |
| POST | `/wx/notify` | 平台签名 | 微信支付回调体 | `{code:'SUCCESS'}` |
| DELETE | `/account` | Bearer | — | `{ok:true}`(注销账号删全部数据) |
| POST | `/deep/consume` | Bearer | — | `{allowed, is_member, remaining}`(问知星额度/会员闸) |
| POST | `/collect` | 否 | 埋点事件 JSON | 204 |

- **鉴权**:`Authorization: Bearer <token>`。token = 自签 HMAC(`base64url(json{uid,did,exp}).sig`,secret=`TOKEN_SECRET`)。
  uid 一律取自 token,**绝不从客户端入参取**。带 `k` 字段的令牌是 wxbind state,不可当会话令牌(已在鉴权闸拒绝)。
- **CORS**:`Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`;`Allow-Headers: content-type, authorization`。上线可把 `*` 收紧为正式域名。

### 数据库(schema.sql)

- `users(id, unionid?, openid?, member_until, created_at, updated_at)` — 账号 + 会员态(member_until = epoch ms,NULL=非会员)
- `devices(device_id PK, user_id, created_at)` — 一账号多设备(先匿名后绑定的合并靠它)
- `charts(id, user_id UNIQUE, payload JSON, updated_at)` — 跨设备盘(每用户一张,upsert)
- `orders(...)` — 订单(Phase C 用)
- `deep_logs(user_id, day, count)` — 问知星服务端额度(建了,**未接**)
- `wx_pending(code PK, init_uid, openid, unionid, exp)` — 微信绑定一次性凭据

### 环境变量(只在 SCF 配置,勿写进代码/勿入库)

```
TOKEN_SECRET            强随机(openssl rand -hex 32)
DB_HOST DB_PORT DB_USER DB_PASS DB_NAME   [DB_POOL 可选,默认4]
WX_APPID WX_APPSECRET   认证服务号(网页授权)
WX_REDIRECT             = 部署后的 /wx/callback 完整 URL(公众号后台配「网页授权域名」)
WX_APP_RETURN           绑定后跳回的前端页(如 https://你的站/report.html)
# 微信支付(Phase C,拿到商户号后配)
WX_PAY_MCHID WX_PAY_SERIAL WX_PAY_PRIVATE_KEY(商户私钥PEM) WX_PAY_APIV3_KEY
WX_PAY_PUBKEY(平台公钥PEM,公钥模式验回调) WX_PAY_NOTIFY_URL(=/wx/notify URL) WX_PAY_APPID
```

### 前端接线(后端给出函数 URL 后,前端改两处)

- `member.js` 顶部 `API_BASE` = 函数 URL
- `analytics.js` 顶部 `ANALYTICS_ENDPOINT` = 函数 URL + `/collect`
- 联调期可用 `?api=<url>` / `?collect=<url>` 覆盖,免改代码

---

## 2. 三条不可简化的要点(安全 / 合规)

1. **公开写端点限流**:`/account/init` 与 `/collect` 无鉴权,须在 **API 网关 / SCF 层按 IP 限流**(用量套餐或 Redis/CLS 计数)。无状态函数内做不了可靠限流。
2. **微信绑定防 CSRF(勿简化)**:`/wx/callback` **不做绑定**,只换 openid + 存一次性 `wx_pending{init_uid=发起登录的uid, openid}`,重定向回 `#bindcode=`。真正绑定在 `/wx/claim`:凭调用者会话 token,**要求 `pend.init_uid === 会话 uid`**(认领者必须是发起者本人),读+校验+删+合并在同一事务。
   > 若把绑定挪回 callback、或去掉 init_uid 校验,会重现「诱导受害者完成/注入 bindcode → 账号接管」漏洞(本次开发已两次踩中并修复,勿回退)。
3. **`/collect` 不落 IP / User-Agent**,只记匿名行为事件(与前端「零 PII」承诺一致)。

---

## 3. 还没做(需后端后续实现)

### 高优先

- **微信支付(Phase C · 已实现代码,待商户号实测)**:`lib/wxpay.js` + `/order/create`(Native 统一下单)+ `/order/status` + `/wx/notify`(平台**公钥模式**验签 + APIv3-GCM 解密 + **幂等** + **金额以服务端 `PLAN_CFG` 为准** + 续 `member_until`)。前端会员墙已接下单+轮询+`pay_success` 埋点。**待你配 `WX_PAY_*`(商户号/APIv3密钥/商户私钥/平台公钥)才能真跑**——这段是密钥就位前无法实测的部分,联调时重点回归验签/解密/回调幂等。
- **问知星额度 / 会员 gating —— 我方已做软闸,深问后端建议加硬校验**:本仓 `POST /deep/consume`(Bearer)已实现服务端额度(`deep_logs` 按天计数,`DEEP_FREE_PER_DAY` 可调)+ 会员不限次判断;前端 `askDeep` 已在调它,超额即弹会员墙,`localStorage` 额度降级为 UX 兜底。**但要硬性防绕过,现有深问后端**(已部署的 `...tencentscf.com`,不在本 repo)也需在收到请求时用**同一 `TOKEN_SECRET`** 验 `Authorization` token 取 uid → 查 `member_until` 与 `deep_logs`;否则用户绕过我方前端直接打深问函数仍可白嫖。这是把付费墙做到「不可绕过」的最后一环。

### 收尾

- **账号注销**:✅ 已实现 `DELETE /account`(事务删 charts/orders/deep_logs/devices/users);前端隐私弹窗有「注销账号并删除全部数据」入口。
- **埋点持久化**:`/collect` 现落函数日志(CLS),聚合弱;长期分析建议改写 COS / 数据库。
- **支付二维码 / H5 / JSAPI**:`/order/create` 返回 `code_url`,前端目前以文本展示(二维码渲染待接,可与海报/签卡二维码 TODO 合并做);微信内打开需补 H5/JSAPI 下单场景。
- **JSAPI 支付**:微信内打开的支付路径(PC/H5 之外)。

### 前端侧(与后端无关,备忘)

- 定价 `PLANS` 为占位价(月18/年98),上线定真价;海报/签卡二维码仍占位(定域名后生成);`zxVariant()` 已打桶但 UI 未做真实 A/B 分流。

---

## 4. 一句话上线路径

先按 README 部署第 1 节(账号/同步/绑定/埋点)→ 前端填两个 URL 全链路联调 → 商户号到位后接第 3 节的支付 + 深问额度 gating。
