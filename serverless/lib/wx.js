// 微信网页授权(公众号 · snsapi_base)助手。AppSecret 只在环境变量,绝不入库。
// 环境变量:
//   WX_APPID     公众号 AppID
//   WX_APPSECRET 公众号 AppSecret(密钥)
//   WX_REDIRECT  回调地址 = 你部署后的 /wx/callback 完整 URL(须在公众号后台配「网页授权域名」)
const https = require('https');

const APPID = process.env.WX_APPID || '';
const SECRET = process.env.WX_APPSECRET || '';
const REDIRECT = process.env.WX_REDIRECT || '';

function configured() { return !!(APPID && SECRET && REDIRECT); }

// 生成授权跳转 URL(仅用 AppID + 回调,不含密钥;可安全暴露给前端跳转)
function authorizeUrl(state) {
  return 'https://open.weixin.qq.com/connect/oauth2/authorize'
    + '?appid=' + encodeURIComponent(APPID)
    + '&redirect_uri=' + encodeURIComponent(REDIRECT)
    + '&response_type=code&scope=snsapi_base'
    + '&state=' + encodeURIComponent(state)
    + '#wechat_redirect';
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let b = '';
      res.on('data', c => { b += c; });
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

// code → { openid, unionid? }(密钥在服务端换取,前端不碰)
async function exchangeCode(code) {
  const url = 'https://api.weixin.qq.com/sns/oauth2/access_token'
    + '?appid=' + encodeURIComponent(APPID)
    + '&secret=' + encodeURIComponent(SECRET)
    + '&code=' + encodeURIComponent(code)
    + '&grant_type=authorization_code';
  const d = await getJson(url);
  if (!d || d.errcode || !d.openid) throw new Error('wx exchange failed: ' + (d && (d.errmsg || d.errcode)));
  return { openid: d.openid, unionid: d.unionid || null };
}

module.exports = { configured, authorizeUrl, exchangeCode };
