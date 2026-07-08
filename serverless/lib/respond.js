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

// 读取请求体,带上限(防滥用)。按 Buffer 累积、整块拼好再解码,
// 避免多字节 UTF-8 被 TCP 分片切碎(回调验签依赖原始字节,勿逐块 toString)。
function readBody(req, limit = 100000) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { req.destroy(); reject(new Error('body too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

module.exports = { CORS, json, noContent, readBody };
