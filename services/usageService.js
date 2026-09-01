/**
 * 使用统计服务
 * 负责把软件使用记录（时间、用户名、机器标识）上报到飞书多维表格
 * 飞书应用凭证采用 AES-256-CBC 加密内置，运行时解密使用（不存储明文）
 *
 * 数据结构（飞书多维表格字段）：
 * - 记录时间（文本）
 * - 用户名（文本）
 * - 机器标识（文本）
 * - 版本（文本）
 */
const axios = require('axios');
const crypto = require('crypto');

// 飞书开放平台配置
const FEISHU_API = 'https://open.feishu.cn/open-apis';

// 加密密钥（SHA-256 派生，32 字节）与初始化向量（16 字节）
const ENC_KEY = crypto.createHash('sha256').update('QBMusic_Feishu_Usage_2025_Secure').digest();
const ENC_IV = Buffer.from('QBMusic_IV_16by!', 'utf8');

// AES-256-CBC 加密后的飞书 App ID（密文 hex）与 App Secret
// 由 scripts/encrypt-feishu.js 生成后填入
const ENCRYPTED_APP_ID = 'ef19c598d07cf57447cdd597818680d23c06e32f56a113d38d8b13aea1f151e2';
const ENCRYPTED_APP_SECRET = 'b99ad936f5c48093aacef62375548160a69f2523cc9f6cbe97b887297376a4bfa9ad4286fdc85d907ef497c2642f6283';

// 飞书多维表格配置（由应用创建，应用为所有者可直接写入）
const BITABLE_APP_TOKEN = 'LP1rbleZ9anXyRsuse9cuFv2n5X';
const BITABLE_TABLE_ID = 'tblCASaVhNy1Cijl';

// 内存缓存 tenant_access_token（有效期约 2 小时，提前 5 分钟刷新）
let cachedToken = null;
let tokenExpireAt = 0;
// 并发去重：多个上报同时触发时只发起一次 token 获取
let tokenPromise = null;

/**
 * 解密内置的飞书应用凭证
 * @param {string} cipherHex - 加密后的密文（hex）
 * @returns {string} 解密后的明文
 */
function decryptCredential(cipherHex) {
  if (!cipherHex) return '';
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, ENC_IV);
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * 获取飞书 tenant_access_token
 * 带缓存：有效期 2 小时，缓存到过期前 5 分钟
 * @returns {Promise<string>} token
 */
async function getTenantToken() {
  const appId = decryptCredential(ENCRYPTED_APP_ID);
  const appSecret = decryptCredential(ENCRYPTED_APP_SECRET);
  if (!appId || !appSecret) {
    throw new Error('飞书应用凭证未配置');
  }
  // 缓存未过期则直接复用
  if (cachedToken && Date.now() < tokenExpireAt) {
    return cachedToken;
  }
  // 并发去重：已有获取中的请求则复用
  if (tokenPromise) {
    return tokenPromise;
  }
  tokenPromise = (async () => {
    const res = await axios.post(
      `${FEISHU_API}/auth/v3/tenant_access_token/internal`,
      { app_id: appId, app_secret: appSecret },
      { timeout: 10000 }
    );
    if (!res.data || res.data.code !== 0) {
      throw new Error(`获取飞书token失败: ${res.data && res.data.msg || '未知错误'}`);
    }
    cachedToken = res.data.tenant_access_token;
    tokenExpireAt = Date.now() + (res.data.expire - 300) * 1000;
    return cachedToken;
  })().finally(() => {
    // 无论成功失败都清除进行中的 promise，允许下次重新获取
    tokenPromise = null;
  });
  return tokenPromise;
}

/**
 * 上报一条使用记录到飞书多维表格
 * @param {Object} data - { username, machineId, version, signature }
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function reportUsage(data) {
  const record = {
    '记录时间': new Date().toLocaleString('zh-CN', { hour12: false }),
    '用户名': (data.username || '').slice(0, 100),
    '机器标识': (data.machineId || '').slice(0, 100),
    '版本': (data.version || '').slice(0, 20),
    '署名': (data.signature || '').slice(0, 100)
  };

  // 未配置飞书多维表格时，仅记录日志，不报错（保证核心功能不受影响）
  if (!BITABLE_APP_TOKEN || !BITABLE_TABLE_ID) {
    console.log('[使用统计] 飞书表格未配置，跳过上报:', JSON.stringify(record));
    return { success: false, error: '飞书表格未配置' };
  }

  try {
    const token = await getTenantToken();
    const res = await axios.post(
      `${FEISHU_API}/bitable/v1/apps/${BITABLE_APP_TOKEN}/tables/${BITABLE_TABLE_ID}/records`,
      { fields: record },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );
    if (res.data && res.data.code === 0) {
      console.log('[使用统计] 已上报到飞书多维表格');
      return { success: true };
    }
    throw new Error((res.data && res.data.msg) || '飞书写入失败');
  } catch (err) {
    console.error('[使用统计] 上报失败:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { reportUsage, getTenantToken };
