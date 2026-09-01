/**
 * 认证路由
 * POST /api/auth/register      密码注册（两步：先校验验证码）
 * POST /api/auth/login         密码登录
 * POST /api/auth/send-code     发送邮箱验证码（35秒限一次）
 * POST /api/auth/verify-code   校验邮箱验证码（注册/改密码第一步）
 * POST /api/auth/change-password 修改密码（两步：先校验验证码）
 * POST /api/auth/login-code    验证码登录（自动注册）
 * POST /api/auth/logout        登出
 * GET  /api/auth/me            查询当前登录邮箱
 * 全部接口带速率限制，防暴力破解与滥用
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authService = require('../services/authService');

// 敏感操作限流：每分钟 10 次/IP
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '操作过于频繁，请稍后重试' }
});

/**
 * 从请求中提取并校验邮箱
 * @param {string} email
 * @returns {string | null}
 */
function validEmail(email) {
  if (!authService.isValidEmail(email)) return null;
  return email.toLowerCase().trim();
}

// 密码注册
router.post('/register', authLimiter, async (req, res) => {
  const email = validEmail(req.body && req.body.email);
  const password = req.body && req.body.password;
  if (!email) return res.status(400).json({ success: false, error: '邮箱格式不正确' });
  if (!password || typeof password !== 'string' || password.length < 8 || password.length > 64) {
    return res.status(400).json({ success: false, error: '密码长度需为 8-64 位' });
  }
  try {
    const result = await authService.register(email, password);
    if (!result.success) return res.status(400).json({ success: false, error: result.error });
    return res.json({ success: true });
  } catch (err) {
    console.error('[注册失败]', err.message);
    return res.status(500).json({ success: false, error: '注册失败，请稍后重试' });
  }
});

// 密码登录
router.post('/login', authLimiter, async (req, res) => {
  const email = validEmail(req.body && req.body.email);
  const password = req.body && req.body.password;
  if (!email || !password) return res.status(400).json({ success: false, error: '邮箱或密码不能为空' });
  try {
    const result = await authService.loginWithPassword(email, password);
    if (!result.success) return res.status(400).json({ success: false, error: result.error });
    return res.json({ success: true, token: result.token, email });
  } catch (err) {
    console.error('[登录失败]', err.message);
    return res.status(500).json({ success: false, error: '登录失败，请稍后重试' });
  }
});

// 发送邮箱验证码
router.post('/send-code', authLimiter, async (req, res) => {
  const email = validEmail(req.body && req.body.email);
  if (!email) return res.status(400).json({ success: false, error: '邮箱格式不正确' });
  try {
    const result = await authService.sendCode(email);
    if (!result.success) {
      return res.status(429).json({ success: false, error: result.error, canResendIn: result.canResendIn });
    }
    return res.json({ success: true });
  } catch (err) {
    console.error('[发验证码失败]', err.message);
    return res.status(500).json({ success: false, error: '验证码发送失败，请稍后重试' });
  }
});

// 验证码登录
router.post('/login-code', authLimiter, async (req, res) => {
  const email = validEmail(req.body && req.body.email);
  const code = req.body && req.body.code;
  if (!email || !code) return res.status(400).json({ success: false, error: '邮箱或验证码不能为空' });
  try {
    const result = await authService.loginWithCode(email, String(code));
    if (!result.success) return res.status(400).json({ success: false, error: result.error });
    return res.json({ success: true, token: result.token, email });
  } catch (err) {
    console.error('[验证码登录失败]', err.message);
    return res.status(500).json({ success: false, error: '登录失败，请稍后重试' });
  }
});

// 校验邮箱验证码（注册/改密码第一步，不签发 token）
router.post('/verify-code', authLimiter, async (req, res) => {
  const email = validEmail(req.body && req.body.email);
  const code = req.body && req.body.code;
  if (!email || !code) return res.status(400).json({ success: false, error: '邮箱或验证码不能为空' });
  const result = authService.verifyCode(email, String(code));
  if (!result.success) return res.status(400).json({ success: false, error: result.error });
  return res.json({ success: true });
});

// 修改密码（两步：先校验验证码，再更新密码）
router.post('/change-password', authLimiter, async (req, res) => {
  const email = validEmail(req.body && req.body.email);
  const newPassword = req.body && req.body.newPassword;
  if (!email) return res.status(400).json({ success: false, error: '邮箱格式不正确' });
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 64) {
    return res.status(400).json({ success: false, error: '新密码长度需为 8-64 位' });
  }
  try {
    const result = await authService.changePassword(email, newPassword);
    if (!result.success) return res.status(400).json({ success: false, error: result.error });
    return res.json({ success: true });
  } catch (err) {
    console.error('[修改密码失败]', err.message);
    return res.status(500).json({ success: false, error: '修改密码失败，请稍后重试' });
  }
});

// 登出
router.post('/logout', authLimiter, (req, res) => {
  const token = req.body && req.body.token;
  authService.logout(token);
  return res.json({ success: true });
});

// 查询当前登录状态
router.get('/me', (req, res) => {
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  const email = authService.verifySession(token);
  if (!email) return res.status(401).json({ success: false, error: '未登录或登录已过期' });
  return res.json({ success: true, email });
});

module.exports = router;
