// 腾讯云 SCF · Web 函数 · 会员系统 API
// Phase A 路由:
//   POST /account/init   { device_id }            → 匿名账号 + 会话 token
//   GET  /account/me     (Bearer token)           → 会员态
//   POST /charts/sync    (Bearer) { payload }      → 固化当前盘(Phase B 起前端调用)
//   GET  /charts         (Bearer)                  → 拉取最近一张盘
//   POST /collect        { 埋点事件 }               → 落日志(analytics.js 的收集端点)
// 监听 9000(SCF Web 函数约定)。路由用「路径后缀」匹配,兼容网关 stage 前缀。
// 密钥/连接参数一律走环境变量:TOKEN_SECRET, DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME。
const http = require('http');
const crypto = require('crypto');
const { json, noContent, readBody } = require('./lib/respond');
const token = require('./lib/token');
const wx = require('./lib/wx');
const { q, tx } = require('./lib/db');

const DEVICE_RE = /^[a-z0-9]{6,64}$/i;
const WX_RETURN = process.env.WX_APP_RETURN || '';   // 绑定完成后跳回的前端页(如 https://站点/report.html)
const now = () => Date.now();
const ends = (path, suffix) => path === suffix || path.endsWith(suffix);
const redirect = (res, target) => { res.writeHead(302, { Location: target }); res.end(); };

async function ensureUserForDevice(deviceId) {
  const rows = await q('SELECT user_id FROM devices WHERE device_id=?', [deviceId]);
  if (rows.length) return rows[0].user_id;
  const t = now();
  const r = await q('INSERT INTO users (created_at, updated_at) VALUES (?,?)', [t, t]);
  const uid = r.insertId;
  try {
    await q('INSERT INTO devices (device_id, user_id, created_at) VALUES (?,?,?)', [deviceId, uid, t]);
  } catch (e) {
    // 并发下同一 device 被另一路先占坑(devices.device_id 主键冲突):
    // 删掉本路刚建、尚无人引用的孤儿 user,回读胜者映射 —— 避免重复建号 + 孤儿行堆积
    if (e && e.code === 'ER_DUP_ENTRY') {
      try { await q('DELETE FROM users WHERE id=?', [uid]); } catch (_) {}
      const again = await q('SELECT user_id FROM devices WHERE device_id=?', [deviceId]);
      if (again.length) return again[0].user_id;
    }
    throw e;
  }
  return uid;
}

// 微信绑定 + 匿名账号合并(在调用方事务连接 c 内执行,与 bindcode 消费同事务 → 失败可回滚)。
// 规则:以微信身份(优先 unionid,退 openid)为准账号;若微信账号已存在则把当前匿名账号并入它。
async function mergeBind(c, currentUid, openid, unionid) {
  {
    let existing = null;
    if (unionid) { const [r] = await c.execute('SELECT id, member_until FROM users WHERE unionid=? LIMIT 1', [unionid]); existing = r[0] || null; }
    if (!existing && openid) { const [r] = await c.execute('SELECT id, member_until FROM users WHERE openid=? LIMIT 1', [openid]); existing = r[0] || null; }
    const [cr] = await c.execute('SELECT id, member_until FROM users WHERE id=?', [currentUid]);
    const cur = cr[0];
    if (!cur) throw new Error('no current user');

    // 微信身份尚无账号 → 直接把身份挂到当前账号
    if (!existing) {
      await c.execute('UPDATE users SET unionid=?, openid=?, updated_at=? WHERE id=?', [unionid || null, openid || null, now(), currentUid]);
      return currentUid;
    }
    if (existing.id === currentUid) return currentUid;   // 已是同一账号

    // 合并:current → existing(微信账号 U 为准)
    const U = existing.id;
    await c.execute('UPDATE devices SET user_id=? WHERE user_id=?', [U, currentUid]);
    const [ccRows] = await c.execute('SELECT payload, updated_at FROM charts WHERE user_id=?', [currentUid]);
    const curChart = ccRows[0];
    if (curChart) {
      const [ucRows] = await c.execute('SELECT updated_at FROM charts WHERE user_id=?', [U]);
      const uChart = ucRows[0];
      // 两边都有盘 → 留 updated_at 较新者
      if (!uChart || curChart.updated_at > uChart.updated_at) {
        await c.execute('INSERT INTO charts (user_id,payload,updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload), updated_at=VALUES(updated_at)', [U, JSON.stringify(curChart.payload), curChart.updated_at]);
      }
      await c.execute('DELETE FROM charts WHERE user_id=?', [currentUid]);
    }
    await c.execute('UPDATE orders SET user_id=? WHERE user_id=?', [U, currentUid]);
    await c.execute('DELETE FROM deep_logs WHERE user_id=?', [currentUid]);   // 日额度计数,合并时丢弃可接受
    const mu = Math.max(existing.member_until || 0, cur.member_until || 0) || null;   // 会员期取较晚者
    await c.execute('UPDATE users SET member_until=?, updated_at=? WHERE id=?', [mu, now(), U]);
    await c.execute('DELETE FROM users WHERE id=?', [currentUid]);
    return U;
  }
}

async function handle(req, res) {
  if (req.method === 'OPTIONS') return noContent(res, 204);
  const url = new URL(req.url, 'http://x');
  const path = url.pathname.replace(/\/+$/, '');

  // 埋点收集:公开写,无需鉴权
  if (req.method === 'POST' && ends(path, '/collect')) {
    try {
      const e = JSON.parse((await readBody(req, 12000)) || '{}');
      // 只记匿名行为事件;不落 IP / User-Agent(与 analytics.js 的「零 PII」承诺一致)
      console.log('EV ' + JSON.stringify({
        ev: e.ev, page: e.page, cid: e.cid, sid: e.sid, props: e.props,
        w: e.w, ref: e.ref, t: e.t,
      }));
    } catch (_) { /* 忽略坏包 */ }
    return noContent(res, 204);
  }

  // 微信授权回调(浏览器顶层跳转,无 Bearer)。这里【不】做绑定 —— 只换到 openid,
  // 存一张一次性 bindcode,重定向回前端;真正的绑定由前端凭「本浏览器自己的会话 token」
  // 调 /wx/claim 完成。这样绑定的目标账号 = 完成回调那台浏览器的登录账号,而非可被钓鱼重放的 state。
  if (req.method === 'GET' && ends(path, '/wx/callback')) {
    const code = url.searchParams.get('code');
    const claims = token.verify(url.searchParams.get('state'));
    if (!claims || claims.k !== 'wxbind' || !code) return redirect(res, (WX_RETURN || '/') + '?bind=err');
    try {
      const { openid, unionid } = await wx.exchangeCode(code);
      const bc = crypto.randomBytes(24).toString('hex');
      // 记 init_uid = 发起登录的账号;只有它能认领 → 注入到别人浏览器的 bindcode 会被拒
      await q('INSERT INTO wx_pending (code, init_uid, openid, unionid, exp) VALUES (?,?,?,?,?)', [bc, claims.uid, openid, unionid, now() + 10 * 60 * 1000]);
      return redirect(res, (WX_RETURN || '/') + '#bindcode=' + bc);   // bindcode 单独无用,须配「发起者本人的会话 token」才能认领
    } catch (e) {
      console.error('wx callback', e && e.stack || e);
      return redirect(res, (WX_RETURN || '/') + '?bind=err');
    }
  }

  // 匿名 init:device_id(非 PII)换 user + token
  if (req.method === 'POST' && ends(path, '/account/init')) {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (_) { return json(res, 400, { error: 'bad json' }); }
    const did = String((body && body.device_id) || '');
    if (!DEVICE_RE.test(did)) return json(res, 400, { error: 'bad device_id' });
    const uid = await ensureUserForDevice(did);
    const urow = (await q('SELECT member_until FROM users WHERE id=?', [uid]))[0];
    return json(res, 200, { token: token.sign({ uid, did }), member_until: urow ? urow.member_until : null });
  }

  // ↓↓↓ 以下需鉴权 ↓↓↓
  const auth = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
  const claims = token.verify(auth);
  // claims.k 存在 = 这是短时的 wxbind state 令牌,不能当会话令牌用
  if (!claims || claims.k) return json(res, 401, { error: 'unauthorized' });
  const uid = claims.uid;

  if (req.method === 'GET' && ends(path, '/account/me')) {
    const urow = (await q('SELECT member_until, unionid, openid FROM users WHERE id=?', [uid]))[0];
    if (!urow) return json(res, 404, { error: 'no user' });
    return json(res, 200, {
      member_until: urow.member_until,
      is_member: !!(urow.member_until && urow.member_until > now()),
      is_bound: !!(urow.unionid || urow.openid),
    });
  }

  // 取微信授权跳转地址;state 签入【发起登录的当前账号 uid】,回调据此记录 init_uid,认领时校验
  if (req.method === 'GET' && ends(path, '/wx/login-url')) {
    if (!wx.configured()) return json(res, 503, { error: 'wx not configured' });
    const st = token.sign({ uid, k: 'wxbind', n: crypto.randomBytes(8).toString('hex') }, 10 * 60 * 1000);
    return json(res, 200, { url: wx.authorizeUrl(st) });
  }

  // 认领绑定:uid 来自鉴权(本会话)。要求 bindcode 的 init_uid === 本会话 uid ——
  // 即「认领者必须是发起这次登录的同一账号」,注入到别人浏览器的 bindcode 会被拒(堵正/反向 CSRF)。
  // 读 bindcode(FOR UPDATE)→ 校验 → 删 → 合并,全在一个事务里:失败回滚,bindcode 不白费。
  if (req.method === 'POST' && ends(path, '/wx/claim')) {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (_) { return json(res, 400, { error: 'bad json' }); }
    const bc = String((body && body.bindcode) || '');
    if (!/^[a-f0-9]{16,64}$/.test(bc)) return json(res, 400, { error: 'bad code' });
    const out = await tx(async (c) => {
      const [rows] = await c.execute('SELECT init_uid, openid, unionid, exp FROM wx_pending WHERE code=? FOR UPDATE', [bc]);
      if (!rows.length) return { err: 'code invalid or expired' };
      const pend = rows[0];
      if (String(pend.init_uid) !== String(uid)) return { err: 'code not for this session' };   // 不删:留给真正的发起者认领
      await c.execute('DELETE FROM wx_pending WHERE code=?', [bc]);
      if (pend.exp < now()) return { err: 'code invalid or expired' };
      const finalUid = await mergeBind(c, uid, pend.openid, pend.unionid);
      return { finalUid };
    });
    if (out.err) return json(res, 400, { error: out.err });
    return json(res, 200, { token: token.sign({ uid: out.finalUid }), is_bound: true });
  }

  if (req.method === 'POST' && ends(path, '/charts/sync')) {
    let body;
    try { body = JSON.parse(await readBody(req)); } catch (_) { return json(res, 400, { error: 'bad json' }); }
    const payload = body && body.payload;
    if (!payload || typeof payload !== 'object') return json(res, 400, { error: 'bad payload' });
    // 每用户一张盘(charts.user_id 唯一键)→ 原子 upsert,免 check-then-act 竞态
    await q('INSERT INTO charts (user_id, payload, updated_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE payload=VALUES(payload), updated_at=VALUES(updated_at)',
      [uid, JSON.stringify(payload), now()]);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && ends(path, '/charts')) {
    const rows = await q('SELECT payload, updated_at FROM charts WHERE user_id=? ORDER BY updated_at DESC LIMIT 1', [uid]);
    return json(res, 200, { chart: rows.length ? rows[0].payload : null, updated_at: rows.length ? rows[0].updated_at : null });
  }

  // 关闭云端同步时调用:真正删除云端已存的盘,兑现「关闭即删除」的承诺
  if (req.method === 'DELETE' && ends(path, '/charts')) {
    await q('DELETE FROM charts WHERE user_id=?', [uid]);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'not found' });
}

http.createServer((req, res) => {
  handle(req, res).catch(e => {
    console.error('ERR', e && e.stack || e);
    try { json(res, 500, { error: 'server error' }); } catch (_) {}
  });
}).listen(9000);
