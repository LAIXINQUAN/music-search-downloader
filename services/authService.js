/**
 * 认证服务
 * 实现邮箱注册/登录（密码登录 + 邮箱验证码登录）、会话管理、飞书用户表读写
 * 账号数据存飞书多维表格「用户表」，密码以 scrypt 加盐哈希存储（绝不存明文）
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getTenantToken } = require('./usageService');
const { sendVerificationCode } = require('./emailService');

const FEISHU_API = 'https://open.feishu.cn/open-apis';
const BITABLE_APP_TOKEN = 'LP1rbleZ9anXyRsuse9cuFv2n5X';

// 飞书用户表（已创建）
const USER_TABLE_ID = 'tblWJzA73F5aTPJo';

// 用户表字段
const FIELD_EMAIL = '邮箱';
const FIELD_HASH = '密码哈希';
const FIELD_SALT = '盐';
const FIELD_REGISTER = '注册时间';

// 验证码配置：5 分钟有效，每 35 秒可发一次
const CODE_TTL = 5 * 60 * 1000;
const CODE_RESEND_INTERVAL = 35 * 1000;

// 会话有效期：30 天
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000;

/**
 * 计算可写的数据目录（打包后 userData，纯 Node 回退项目 data/）
 * @returns {string}
 */
function getDataDir() {
  try {
    const electron = require('electron');
    if (electron && electron.app && typeof electron.app.getPath === 'function') {
      return electron.app.getPath('userData');
    }
  } catch (err) { /* 非 Electron */ }
  return path.join(__dirname, '..', 'data');
}

const SESSIONS_FILE = path.join(getDataDir(), 'auth-sessions.json');

// 内存中的验证码：{ 邮箱: { code, expireAt, lastSendAt } }
const codeStore = new Map();

/**
 * 生成随机 6 位数字验证码
 * @returns {string}
 */
function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * 邮箱格式校验
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return typeof email === 'string' && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email) && email.length <= 100;
}

/**
 * scrypt 哈希密码（加盐）
 * @param {string} password
 * @param {string} salt
 * @returns {string} hex 哈希
 */
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/**
 * 读取会话文件
 * @returns {Object} { token: { email, expireAt } }
 */
function loadSessions() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
  } catch (err) {
    return {};
  }
}

/**
 * 保存会话文件
 * @param {Object} sessions
 */
function saveSessions(sessions) {
  const dir = path.dirname(SESSIONS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions), 'utf8');
}

/**
 * 按邮箱查询飞书用户表
 * @param {string} token
 * @param {string} email
 * @returns {Promise<{recordId: string, email: string, hash: string, salt: string} | null>}
 */
async function findUser(token, email) {
  const res = await axios.post(
    `${FEISHU_API}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${USER_TABLE_ID}/records/search`,
    {
      filter: { conjunction: 'and', conditions: [{ field_name: FIELD_EMAIL, operator: 'is', value: [email] }] },
      page_size: 20
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  if (!res.data || res.data.code !== 0) throw new Error(`查询用户失败: ${res.data && res.data.msg || '未知错误'}`);
  const items = (res.data.data && res.data.data.items) || [];
  if (items.length === 0) return null;
  const f = items[0].fields;
  const get = s => Array.isArray(f[s]) ? f[s].map(x => x.text).join('') : (f[s] || '');
  return { recordId: items[0].record_id, email: get(FIELD_EMAIL), hash: get(FIELD_HASH), salt: get(FIELD_SALT) };
}

/**
 * 查找某邮箱在飞书用户表中的全部记录（用于检测重复账号）
 * @param {string} token
 * @param {string} email
 * @returns {Promise<Array<{recordId: string, register?: string}>>}
 */
async function findAllUsersByEmail(token, email) {
  const res = await axios.post(
    `${FEISHU_API}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${USER_TABLE_ID}/records/search`,
    {
      filter: { conjunction: 'and', conditions: [{ field_name: FIELD_EMAIL, operator: 'is', value: [email] }] },
      page_size: 100
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  if (!res.data || res.data.code !== 0) throw new Error(`查询用户失败: ${res.data && res.data.msg || '未知错误'}`);
  const items = (res.data.data && res.data.data.items) || [];
  return items.map(item => {
    const f = item.fields || {};
    const get = s => Array.isArray(f[s]) ? f[s].map(x => x.text).join('') : (f[s] || '');
    return { recordId: item.record_id, email: get(FIELD_EMAIL), register: get(FIELD_REGISTER) };
  });
}

/**
 * 清理某邮箱的重复账号：保留最早一条记录，删除其余重复记录
 * @param {string} token
 * @param {string} email
 * @returns {Promise<{success: boolean, removed: number}>}
 */
async function cleanupDuplicateUsers(token, email) {
  const records = await findAllUsersByEmail(token, email);
  if (records.length <= 1) return { success: true, removed: 0 };
  // 按注册时间排序，时间最小的保留（无注册时间则按记录顺序）
  records.sort((a, b) => String(a.register || '').localeCompare(String(b.register || '')));
  const keep = records[0];
  let removed = 0;
  for (const r of records) {
    if (r.recordId === keep.recordId) continue;
    await axios.delete(
      `${FEISHU_API}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${USER_TABLE_ID}/records/${r.recordId}`,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
    );
    removed++;
  }
  return { success: true, removed };
}

/**
 * 创建用户记录到飞书
 * @param {string} token
 * @param {string} email
 * @param {string} hash
 * @param {string} salt
 */
async function createUser(token, email, hash, salt) {
  const res = await axios.post(
    `${FEISHU_API}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${USER_TABLE_ID}/records`,
    {
      fields: {
        [FIELD_EMAIL]: email,
        [FIELD_HASH]: hash,
        [FIELD_SALT]: salt,
        [FIELD_REGISTER]: new Date().toLocaleString('zh-CN', { hour12: false })
      }
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  if (!res.data || res.data.code !== 0) throw new Error(`创建用户失败: ${res.data && res.data.msg || '未知错误'}`);
}

/**
 * 校验邮箱验证码（仅确认验证码正确，不签发登录 token）
 * 用于注册 / 修改密码的第一步
 * @param {string} email
 * @param {string} code
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function verifyCode(email, code) {
  const entry = codeStore.get(email);
  if (!entry || entry.expireAt < Date.now()) {
    return { success: false, error: '验证码已过期，请重新获取' };
  }
  if (entry.code !== String(code).trim()) {
    return { success: false, error: '验证码错误' };
  }
  // 校验通过即作废，防止重复使用
  codeStore.delete(email);
  return { success: true };
}

/**
 * 密码注册（两步：前端先校验验证码，再调用本接口写入账号）
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function register(email, password) {
  const token = await getTenantToken();
  const existing = await findUser(token, email);
  if (existing) return { success: false, error: '该邮箱已注册' };
  // 二次校验：缩小并发竞态窗口，避免同邮箱重复注册
  const dup = await findAllUsersByEmail(token, email);
  if (dup.length > 0) return { success: false, error: '该邮箱已注册' };
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  await createUser(token, email, hash, salt);
  return { success: true };
}

/**
 * 修改密码（两步：前端先校验验证码，再调用本接口更新飞书）
 * @param {string} email
 * @param {string} newPassword
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function changePassword(email, newPassword) {
  const token = await getTenantToken();
  const user = await findUser(token, email);
  if (!user) return { success: false, error: '该邮箱未注册，请先注册' };
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(newPassword, salt);
  // 更新飞书用户表：密码哈希 + 盐
  const res = await axios.put(
    `${FEISHU_API}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${USER_TABLE_ID}/records/${user.recordId}`,
    {
      fields: {
        [FIELD_HASH]: hash,
        [FIELD_SALT]: salt
      }
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 15000 }
  );
  if (!res.data || res.data.code !== 0) {
    throw new Error(`修改密码失败: ${res.data && res.data.msg || '未知错误'}`);
  }
  return { success: true };
}

/**
 * 密码登录
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, error?: string, token?: string}>}
 */
async function loginWithPassword(email, password) {
  const token = await getTenantToken();
  const user = await findUser(token, email);
  if (!user) return { success: false, error: '邮箱或密码错误' };
  if (!user.hash || !user.salt) return { success: false, error: '该邮箱未设置密码，请使用验证码登录' };
  const calc = hashPassword(password, user.salt);
  // 常量时间比较，防时序攻击
  if (crypto.timingSafeEqual(Buffer.from(calc, 'hex'), Buffer.from(user.hash, 'hex'))) {
    return { success: true, token: issueSession(email) };
  }
  return { success: false, error: '邮箱或密码错误' };
}

/**
 * 发送验证码（每 35 秒限一次）
 * @param {string} email
 * @returns {Promise<{success: boolean, error?: string, canResendIn?: number}>}
 */
async function sendCode(email) {
  const now = Date.now();
  const entry = codeStore.get(email);
  if (entry && now - entry.lastSendAt < CODE_RESEND_INTERVAL) {
    const wait = Math.ceil((CODE_RESEND_INTERVAL - (now - entry.lastSendAt)) / 1000);
    return { success: false, error: `发送太频繁，请 ${wait} 秒后再试`, canResendIn: wait };
  }
  const code = generateCode();
  const mailRes = await sendVerificationCode(email, code);
  if (!mailRes.success) {
    return { success: false, error: '验证码发送失败，请检查邮箱地址或稍后重试' };
  }
  codeStore.set(email, { code, expireAt: now + CODE_TTL, lastSendAt: now });
  return { success: true };
}

/**
 * 验证码登录（若邮箱不存在则自动注册）
 * @param {string} email
 * @param {string} code
 * @returns {Promise<{success: boolean, error?: string, token?: string}>}
 */
async function loginWithCode(email, code) {
  const entry = codeStore.get(email);
  if (!entry || entry.expireAt < Date.now()) {
    return { success: false, error: '验证码已过期，请重新获取' };
  }
  if (entry.code !== String(code).trim()) {
    return { success: false, error: '验证码错误' };
  }
  // 使用后立即作废，防止重放
  codeStore.delete(email);
  return { success: true, token: issueSession(email) };
}

/**
 * 签发会话 token
 * @param {string} email
 * @returns {string}
 */
function issueSession(email) {
  const sessions = loadSessions();
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { email, expireAt: Date.now() + SESSION_TTL };
  saveSessions(sessions);
  return token;
}

/**
 * 校验会话 token
 * @param {string} token
 * @returns {string | null} 邮箱（有效时）或 null
 */
function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const sessions = loadSessions();
  const s = sessions[token];
  if (!s) return null;
  if (s.expireAt < Date.now()) {
    delete sessions[token];
    saveSessions(sessions);
    return null;
  }
  return s.email;
}

/**
 * 登出：删除会话
 * @param {string} token
 */
function logout(token) {
  const sessions = loadSessions();
  if (sessions[token]) {
    delete sessions[token];
    saveSessions(sessions);
  }
}

module.exports = {
  register,
  changePassword,
  verifyCode,
  loginWithPassword,
  loginWithCode,
  sendCode,
  verifySession,
  logout,
  isValidEmail,
  findAllUsersByEmail,
  cleanupDuplicateUsers,
  CODE_RESEND_INTERVAL,
  codeStore // 导出（供测试/调试读取验证码）
};
