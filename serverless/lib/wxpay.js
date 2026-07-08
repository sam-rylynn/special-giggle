// 微信支付 v3 助手(Native 扫码下单 + 回调验签/解密)。所有密钥/证书走环境变量,绝不入库。
// 环境变量:
//   WX_PAY_MCHID        商户号
//   WX_PAY_SERIAL       商户 API 证书序列号
//   WX_PAY_PRIVATE_KEY  商户 API 私钥(PEM,-----BEGIN PRIVATE KEY-----…)
//   WX_PAY_APIV3_KEY    APIv3 密钥(32 字符)
//   WX_PAY_PUBKEY       微信支付平台公钥(PEM;公钥模式,用于验回调签名)
//   WX_PAY_APPID        支付用 appid(公众号/开放平台;缺省回退 WX_APPID)
//   WX_PAY_NOTIFY_URL   回调地址 = 部署后的 /wx/notify 完整 URL
const crypto = require('crypto');
const https = require('https');

const MCHID = process.env.WX_PAY_MCHID || '';
const SERIAL = process.env.WX_PAY_SERIAL || '';
// PEM 归一化:很多密钥托管把换行存成字面量 \n,还原成真换行,否则 OpenSSL 解析失败、支付全断
const PRIVATE_KEY = (process.env.WX_PAY_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const APIV3_KEY = process.env.WX_PAY_APIV3_KEY || '';
const PLATFORM_PUBKEY = (process.env.WX_PAY_PUBKEY || '').replace(/\\n/g, '\n');
const PAY_APPID = process.env.WX_PAY_APPID || process.env.WX_APPID || '';
const NOTIFY_URL = process.env.WX_PAY_NOTIFY_URL || '';

function configured() { return !!(MCHID && SERIAL && PRIVATE_KEY && APIV3_KEY && PAY_APPID && NOTIFY_URL); }

// 请求签名:message = 方法\nURL路径\n时间戳\n随机串\n请求体\n,用商户私钥 RSA-SHA256 签
function authHeader(method, urlPath, body) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  const message = method + '\n' + urlPath + '\n' + ts + '\n' + nonce + '\n' + (body || '') + '\n';
  const signature = crypto.createSign('RSA-SHA256').update(message).sign(PRIVATE_KEY, 'base64');
  return 'WECHATPAY2-SHA256-RSA2048 mchid="' + MCHID + '",nonce_str="' + nonce + '",signature="' + signature + '",timestamp="' + ts + '",serial_no="' + SERIAL + '"';
}

function httpsRequest(method, host, path, headers, body) {
  return new Promise(function (resolve, reject) {
    const req = https.request({ method: method, host: host, path: path, headers: headers }, function (res) {
      let b = ''; res.on('data', function (c) { b += c; }); res.on('end', function () { resolve({ status: res.statusCode, body: b }); });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Native 统一下单 → { codeUrl }。amountFen = 金额(分),由服务端权威计算传入。
async function nativeOrder(opts) {
  const urlPath = '/v3/pay/transactions/native';
  const payload = JSON.stringify({
    appid: PAY_APPID, mchid: MCHID,
    description: opts.description, out_trade_no: opts.outTradeNo,
    notify_url: NOTIFY_URL, amount: { total: opts.amountFen, currency: 'CNY' },
  });
  const headers = {
    'Authorization': authHeader('POST', urlPath, payload),
    'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'zhixing-scf',
    'Content-Length': Buffer.byteLength(payload),   // 微信支付 API 需显式长度,勿用 chunked
  };
  const r = await httpsRequest('POST', 'api.mch.weixin.qq.com', urlPath, headers, payload);
  const data = JSON.parse(r.body || '{}');
  if (r.status !== 200) throw new Error('wxpay native failed: ' + (data.message || data.code || r.status));
  return { codeUrl: data.code_url };
}

// 验回调签名(公钥模式):验签串 = 时间戳\n随机串\n请求体\n,用平台公钥验;并校验时间戳防重放
function verifyNotify(headers, rawBody) {
  const ts = headers['wechatpay-timestamp'];
  const nonce = headers['wechatpay-nonce'];
  const sig = headers['wechatpay-signature'];
  if (!ts || !nonce || !sig || !PLATFORM_PUBKEY) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 300) return false;   // 超 5 分钟拒
  const message = ts + '\n' + nonce + '\n' + (rawBody || '') + '\n';
  try { return crypto.createVerify('RSA-SHA256').update(message).verify(PLATFORM_PUBKEY, sig, 'base64'); }
  catch (_) { return false; }
}

// 解密回调 resource(AES-256-GCM;key=APIv3 密钥,iv=nonce,aad=associated_data)
function decryptResource(resource) {
  const key = Buffer.from(APIV3_KEY, 'utf8');
  const iv = Buffer.from(resource.nonce, 'utf8');
  const raw = Buffer.from(resource.ciphertext, 'base64');
  const tag = raw.slice(raw.length - 16);
  const ciphertext = raw.slice(0, raw.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  if (resource.associated_data) decipher.setAAD(Buffer.from(resource.associated_data, 'utf8'));
  const out = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(out.toString('utf8'));
}

// 主动查单(对账/自愈:回调漏收时靠它把订单置为已支付)。GET 签名的 URL 需含 query。
async function queryOrder(outTradeNo) {
  const urlPath = '/v3/pay/transactions/out-trade-no/' + encodeURIComponent(outTradeNo) + '?mchid=' + encodeURIComponent(MCHID);
  const headers = { 'Authorization': authHeader('GET', urlPath, ''), 'Accept': 'application/json', 'User-Agent': 'zhixing-scf' };
  const r = await httpsRequest('GET', 'api.mch.weixin.qq.com', urlPath, headers, null);
  const data = JSON.parse(r.body || '{}');
  if (r.status !== 200) throw new Error('wxpay query failed: ' + (data.message || r.status));
  return data;   // { trade_state, transaction_id, amount:{total}, out_trade_no }
}

module.exports = { configured, nativeOrder, verifyNotify, decryptResource, queryOrder };
