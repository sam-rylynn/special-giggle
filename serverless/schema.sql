-- 会员系统 · 数据库 schema(MySQL 5.7+/8.0;腾讯云数据库 MySQL / TDSQL-C)
-- Phase A 用 users/devices;charts 供跨设备固化(Phase B 起用);orders/deep_logs 供 Phase C。
-- 字符集统一 utf8mb4;时间戳一律存 epoch 毫秒(BIGINT),避免时区歧义。

CREATE TABLE IF NOT EXISTS users (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  unionid       VARCHAR(64) NULL UNIQUE,          -- 微信开放平台 unionid(绑定后填,Phase B)
  openid        VARCHAR(64) NULL UNIQUE,          -- 公众号 openid(绑定身份键;NULL 允许多行)
  member_until  BIGINT      NULL,                 -- 会员到期(epoch ms);NULL=非会员
  created_at    BIGINT      NOT NULL,
  updated_at    BIGINT      NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 一个 user 可绑多台设备(先匿名后绑定 / 匿名合并):device_id(=前端 zx_cid) → user
CREATE TABLE IF NOT EXISTS devices (
  device_id  VARCHAR(64) PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_dev_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 跨设备盘固化(Phase B 起写入;需用户显式开启云端同步)
CREATE TABLE IF NOT EXISTS charts (
  id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    BIGINT UNSIGNED NOT NULL,
  payload    JSON   NOT NULL,                     -- {d,t,c,g,...} 出生输入
  updated_at BIGINT NOT NULL,
  UNIQUE KEY uk_chart_user (user_id),             -- 每用户一张最新盘(配合 upsert,防重复行)
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单(Phase C · 微信支付)
CREATE TABLE IF NOT EXISTS orders (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  out_trade_no VARCHAR(64)  NOT NULL UNIQUE,      -- 商户订单号(幂等键)
  user_id      BIGINT UNSIGNED NOT NULL,
  plan         VARCHAR(16)  NOT NULL,             -- month | year
  amount       INT          NOT NULL,             -- 金额(分),服务端权威
  status       VARCHAR(16)  NOT NULL,             -- pending | paid | refunded
  wx_txn_id    VARCHAR(64)  NULL,                 -- 微信支付交易号
  created_at   BIGINT       NOT NULL,
  paid_at      BIGINT       NULL,
  last_query_at BIGINT      NULL,                 -- 上次主动查单时间(限流用)
  INDEX idx_order_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 问知星服务端额度(替代可被绕过的 localStorage 额度)
CREATE TABLE IF NOT EXISTS deep_logs (
  user_id BIGINT UNSIGNED NOT NULL,
  day     CHAR(10) NOT NULL,                      -- YYYY-MM-DD
  count   INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 微信绑定一次性凭据:回调换到 openid 后暂存;前端凭「完成回调那台浏览器自己的会话 token」认领后即删。
-- 绑定不在无鉴权的回调里做 → 杜绝 OAuth 登录 CSRF。过期行可定期清理(无害)。
CREATE TABLE IF NOT EXISTS wx_pending (
  code     VARCHAR(64) PRIMARY KEY,
  init_uid BIGINT UNSIGNED NOT NULL,           -- 发起登录的账号;认领时必须为同一账号(堵正/反向 OAuth 绑定 CSRF)
  openid   VARCHAR(64) NOT NULL,
  unionid  VARCHAR(64) NULL,
  exp      BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
