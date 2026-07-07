// 极简自签会话 token(HMAC-SHA256),零三方依赖。
// payload = { uid, did, exp };secret 走环境变量,严禁写死。
const crypto = require('crypto');
const SECRET = process.env.TOKEN_SECRET || '';

function b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64u(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// 默认 180 天有效期
function sign(payload, ttlMs = 180 * 24 * 3600 * 1000) {
  if (!SECRET) throw new Error('TOKEN_SECRET not set');
  const body = Object.assign({}, payload, { exp: Date.now() + ttlMs });
  const p = b64u(JSON.stringify(body));
  const sig = b64u(crypto.createHmac('sha256', SECRET).update(p).digest());
  return p + '.' + sig;
}

function verify(tok) {
  if (!SECRET || !tok || typeof tok !== 'string' || tok.indexOf('.') < 0) return null;
  const i = tok.indexOf('.');
  const p = tok.slice(0, i), sig = tok.slice(i + 1);
  const expect = b64u(crypto.createHmac('sha256', SECRET).update(p).digest());
  // 定长 + timingSafeEqual 防时序侧信道;长度不等直接拒
  if (sig.length !== expect.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  let body;
  try { body = JSON.parse(unb64u(p).toString('utf8')); } catch (_) { return null; }
  if (!body || typeof body.exp !== 'number' || body.exp < Date.now()) return null;
  return body;
}

module.exports = { sign, verify };
