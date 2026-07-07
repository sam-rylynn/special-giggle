// MySQL 连接池(模块级,复用 SCF 热实例连接)。腾讯云数据库 MySQL / TDSQL-C。
// 依赖 mysql2(需在函数依赖里安装)。所有连接参数走环境变量,严禁写死。
// execute() 走预处理语句 → 参数化,天然防 SQL 注入。
const mysql = require('mysql2/promise');

let pool;
function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: Number(process.env.DB_POOL || 4),
      charset: 'utf8mb4',
      timezone: 'Z',
    });
  }
  return pool;
}

// 参数化查询;params 必须用数组占位,禁止字符串拼接 SQL
async function q(sql, params) {
  const [rows] = await getPool().execute(sql, params || []);
  return rows;
}

// 事务:取独立连接,BEGIN → fn(conn) → COMMIT;出错 ROLLBACK。用于账号合并等多写原子操作。
async function tx(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (e) {
    try { await conn.rollback(); } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { q, getPool, tx };
