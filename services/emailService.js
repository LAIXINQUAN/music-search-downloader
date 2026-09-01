/**
 * 邮件发送服务
 * 用于发送邮箱验证码。使用 QQ 邮箱 SMTP 发信。
 * SMTP 授权码采用 AES-256-CBC 加密内置，运行时解密使用（不存储明文）
 */
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// 与 usageService.js 一致的加密参数（保证同一套密钥）
const ENC_KEY = crypto.createHash('sha256').update('QBMusic_Feishu_Usage_2025_Secure').digest();
const ENC_IV = Buffer.from('QBMusic_IV_16by!', 'utf8');

// AES-256-CBC 加密后的 QQ 邮箱发件人账号与授权码（由脚本生成后填入）
const ENCRYPTED_SMTP_USER = 'f2df07a5817121c91f4a3d9ab71128c3'; // laixinqb@qq.com
const ENCRYPTED_SMTP_PASS = 'f50f6de700a4d603e7ed6c642dd311e166ad2ee2a2574ca63804ebef669a8316'; // 授权码

/**
 * 解密内置的 SMTP 凭据
 * @param {string} cipherHex - 加密密文（hex）
 * @returns {string} 明文
 */
function decryptCredential(cipherHex) {
  if (!cipherHex) return '';
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, ENC_IV);
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// 复用 transporter（连接复用，避免每次新建）
let transporter = null;

/**
 * 获取 SMTP 发送器（懒加载）
 * @returns {Object} nodemailer transporter
 */
function getTransporter() {
  if (transporter) return transporter;
  const user = decryptCredential(ENCRYPTED_SMTP_USER);
  const pass = decryptCredential(ENCRYPTED_SMTP_PASS);
  transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000
  });
  return transporter;
}

/**
 * 发送验证码邮件
 * @param {string} toEmail - 收件人邮箱
 * @param {string} code - 6 位验证码
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendVerificationCode(toEmail, code) {
  try {
    const user = decryptCredential(ENCRYPTED_SMTP_USER);
    const info = await getTransporter().sendMail({
      from: `"QB音乐" <${user}>`,
      to: toEmail,
      subject: '【QB音乐】登录验证码',
      text: `你的登录验证码是：${code}\n验证码 5 分钟内有效，请勿泄露给他人。\n若非本人操作，请忽略本邮件。`,
      html: `<div style="font-family:sans-serif;max-width:420px;margin:auto;border:1px solid #eee;border-radius:8px;padding:24px;">
        <h3 style="margin:0 0 12px;">QB音乐 登录验证码</h3>
        <p style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#6d5cff;margin:16px 0;">${code}</p>
        <p style="color:#888;font-size:13px;">验证码 5 分钟内有效，请勿泄露给他人。<br>若非本人操作，请忽略本邮件。</p>
      </div>`
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[邮件服务] 发送失败:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendVerificationCode };
