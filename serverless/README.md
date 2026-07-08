# 会员系统后端(腾讯云 SCF)

前端是 GitHub Pages 静态站(公开);**本目录只放代码,密钥一律走 SCF 环境变量,绝不入库**(见 `.gitignore`)。

## 结构

```
serverless/
  api.js            Web 函数入口(监听 9000),按路径后缀路由
  lib/respond.js    CORS + JSON 响应助手
  lib/token.js      自签会话 token(HMAC-SHA256,无三方依赖)
  lib/db.js         MySQL 连接池(参数化查询)
  schema.sql        建表 SQL
  package.json      依赖(mysql2)
```

## 接口

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/account/init` | 否 | `{device_id}` → `{token, member_until}`(匿名账号) |
| GET  | `/account/me` | Bearer | `{member_until, is_member, is_bound}` |
| POST | `/charts/sync` | Bearer | `{payload}` 固化盘(仅用户开启云端同步后前端才调用) |
| GET  | `/charts` | Bearer | 拉取最近一张盘 |
| GET  | `/wx/login-url` | Bearer | 返回微信授权跳转 URL(state=签名随机串) |
| GET  | `/wx/callback` | 否(签名 state) | 换 openid → 存一次性 `bindcode` → 经 `#bindcode=` 回传前端(**不在此绑定**) |
| POST | `/wx/claim` | Bearer | 凭本浏览器会话 token + bindcode 完成绑定/合并,返回新 token |
| DELETE | `/charts` | Bearer | 删除云端已存的盘(关闭云端同步时调用) |
| POST | `/order/create` | Bearer | `{plan}` → Native 下单,返回 `{out_trade_no, code_url}` |
| GET | `/order/status` | Bearer | `?out_trade_no` → `{status}`(前端轮询) |
| POST | `/wx/notify` | 否(平台签名) | 微信支付回调:验签 + 解密 + 幂等续会员期 |
| DELETE | `/account` | Bearer | 注销账号,删除全部数据 |
| POST | `/deep/consume` | Bearer | 问知星额度/会员闸 → `{allowed, is_member, remaining}` |
| POST | `/collect` | 否 | 埋点收集(analytics.js 的端点,落函数日志/CLS,不记 IP/UA) |

**Phase B 绑定/合并(防 OAuth 登录 CSRF)**:回调**不做绑定**,只换到 openid 并存一张一次性 `bindcode` 回传前端;真正绑定由前端凭「完成回调那台浏览器自己的会话 token」调 `/wx/claim` 完成 —— 绑定目标账号恒等于当前登录账号,签名 state 无法被钓鱼重放到受害者账号。合并:微信身份无账号→挂到当前账号;已有账号→把当前匿名账号的 devices/charts/orders 并入微信账号(charts 留较新者、会员期取较晚者),事务原子。前端「微信登录」需**认证服务号**并在公众号后台配网页授权域名。

## 部署步骤

1. **建库**:开通腾讯云数据库 MySQL(或 TDSQL-C),用 `schema.sql` 建表;记下 host/port/user/pass/db。
2. **建函数**:SCF 控制台 → 新建 → **Web 函数** → Node.js 16+ → 上传本目录(含 `node_modules`,即先 `npm i` 装好 `mysql2`)。
3. **配环境变量**(函数配置 → 环境变量,**不要写进代码**):
   - `TOKEN_SECRET` = 一段强随机(如 `openssl rand -hex 32`)
   - `DB_HOST` `DB_PORT` `DB_USER` `DB_PASS` `DB_NAME`(可选 `DB_POOL`,默认 4)
   - **微信绑定(Phase B)**:`WX_APPID` `WX_APPSECRET`(认证服务号)、`WX_REDIRECT`=部署后的 `/wx/callback` 完整 URL、`WX_APP_RETURN`=绑定后跳回的前端页(如 `https://你的站/report.html`)。未配置时 `/wx/login-url` 返回 503,前端登录按钮优雅降级。
   - **微信支付(Phase C)**:`WX_PAY_MCHID`、`WX_PAY_SERIAL`(商户证书序列号)、`WX_PAY_PRIVATE_KEY`(商户 API 私钥 PEM)、`WX_PAY_APIV3_KEY`(32 字符)、`WX_PAY_PUBKEY`(微信支付**平台公钥** PEM,公钥模式验回调)、`WX_PAY_NOTIFY_URL`(=`/wx/notify` 完整 URL)、`WX_PAY_APPID`(缺省回退 `WX_APPID`)。未配置时 `/order/create` 返回 503。
4. **网络**:若数据库在 VPC,给函数配同 VPC;否则用公网地址 + 白名单。
5. **拿 URL**:复制函数「访问路径」(形如 `https://xxxx-xxxx.ap-guangzhou.tencentscf.com`)。
6. **接前端**(两处):
   - `member.js` 顶部 `API_BASE` = 上面的 URL
   - `analytics.js` 顶部 `ANALYTICS_ENDPOINT` = 上面的 URL + `/collect`
   - 联调期可用 `?api=<url>` / `?collect=<url>` 覆盖,免改代码。
   - ⚠ **填 `API_BASE` 的同一次改动**里,给 app.html 隐私文案补一句:会用一个随机匿名设备标识创建会员账号(不含出生信息/姓名/联系方式)——因为启用后每次加载都会建匿名账号。

## 安全须知(已在代码中落实,勿回退)

- **密钥只在环境变量**,`.gitignore` 已挡 `*.pem/*.key/*.p12/.env`(微信商户证书就属这类)。
- DB 全走 `execute()` **参数化查询**,禁止字符串拼接 SQL。
- token 用 `timingSafeEqual` 定长比较验签,防时序侧信道。
- CORS 现为 `*`,上线可收紧为正式域名。
- **公开前必须加限流**:`/account/init` 与 `/collect` 是无鉴权公开写端点。须在 API 网关 / SCF 层按 IP 限流(用量套餐,或 Redis/CLS 计数),否则可被刷量灌库(创建海量匿名账号 / 灌日志)。无状态函数内做不了可靠限流,这一步在部署侧。
- `/collect` **不落 IP / User-Agent**,只记匿名行为事件,与 analytics.js 的零 PII 承诺一致。

## 待接(后续 Phase)

- **B(已实现)**:微信网页授权绑定 + 匿名账号合并 + 前端「云端同步」显式开关(出生数据仅开启后上传)。待你配 `WX_*` 环境变量 + 认证服务号即可启用。
- **C(已实现代码,待商户号实测)**:`/order/create`(Native 统一下单)+ `/order/status` + `/wx/notify`(平台公钥验签 + APIv3-GCM 解密 + 幂等 + 金额以服务端为准 + 续会员期)。前端会员墙已接下单+轮询。`lib/wxpay.js` 用**微信支付公钥模式**验回调。**需企业微信支付商户号(mchid/APIv3 密钥/商户证书/平台公钥)才能实测**;订单金额在服务端 `PLAN_CFG` 权威定义(前端只传 plan)。
