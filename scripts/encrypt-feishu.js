/**
 * 飞书应用凭证加密脚本
 * 用法：node scripts/encrypt-feishu.js <appId> <appSecret>
 * 作用：将飞书开放平台应用的 App ID 与 App Secret 加密为 hex 密文，
 *       输出后填入 services/usageService.js 的 ENCRYPTED_APP_ID / ENCRYPTED_APP_SECRET
 * 注意：加密算法与 usageService.js 的 decryptCredential 保持一致（AES-256-CBC）
 */
const crypto = require('crypto');

// 与 usageService.js 保持一致的加密参数
const ENC_KEY = crypto.createHash('sha256').update('QBMusic_Feishu_Usage_2025_Secure').digest();
const ENC_IV = Buffer.from('QBMusic_IV_16by!', 'utf8');

/**
 * 加密明文为 hex 密文
 * @param {string} plain - 明文
 * @returns {string} hex 密文
 */
function encrypt(plain) {
  const cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, ENC_IV);
  let encrypted = cipher.update(plain, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// 解析命令行参数
const appId = process.argv[2] || '';
const appSecret = process.argv[3] || '';

if (!appId || !appSecret) {
  console.error('用法: node scripts/encrypt-feishu.js <appId> <appSecret>');
  process.exit(1);
}

// 输出密文
console.log('=== 加密结果（填入 services/usageService.js） ===');
console.log(`ENCRYPTED_APP_ID = '${encrypt(appId)}';`);
console.log(`ENCRYPTED_APP_SECRET = '${encrypt(appSecret)}';`);
