// CORS + JSON 响应助手(所有函数共用)
const CORS = {
  'Access-Control-Allow-Origin': '*',                 // 可收紧为正式域名
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
};

function json(res, code, obj) {
  res.writeHead(code, Object.assign({ 'content-type': 'application/json' }, CORS));
  res.end(JSON.stringify(obj));
}

function noContent(res, code) {
  res.writeHead(code || 204, CORS);
  res.end();
}

// 读取请求体,带上限(防滥用)
function readBody(req, limit = 100000) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => {
      b += c;
      if (b.length > limit) { req.destroy(); reject(new Error('body too large')); }
    });
    req.on('end', () => resolve(b));
    req.on('error', reject);
  });
}

module.exports = { CORS, json, noContent, readBody };
