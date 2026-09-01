/**
 * 收藏云同步路由（飞书多维表格匿名存储）
 * POST /api/cloud-sync  body: { owner?, deviceId?, favorites }  保存收藏
 * GET  /api/cloud-sync?owner=邮箱 或 ?deviceId=xxx              拉取收藏
 * 登录用户按 owner 邮箱归属（跨设备），匿名用户按 deviceId
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { saveCloudFavorites, loadCloudFavorites } = require('../services/cloudSyncService');

// 设备ID格式校验（防止注入与恶意输入）
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;
// 邮箱格式校验
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// 单次存储的最大收藏条数
const MAX_FAVORITES = 1000;

// 云同步接口限流：每分钟最多 20 次，防止滥用
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后重试' }
});

/**
 * 校验设备ID
 * @param {string} deviceId
 * @returns {boolean}
 */
function validDeviceId(deviceId) {
  return typeof deviceId === 'string' && DEVICE_ID_PATTERN.test(deviceId);
}

/**
 * 校验邮箱
 * @param {string} email
 * @returns {string | null} 规范化邮箱或 null
 */
function validEmail(email) {
  if (typeof email === 'string' && email.length <= 100 && EMAIL_PATTERN.test(email)) {
    return email.trim().toLowerCase();
  }
  return null;
}

// 保存收藏（POST）
router.post('/', syncLimiter, async (req, res) => {
  const body = req.body || {};
  const owner = validEmail(body.owner);
  const deviceId = body.deviceId;
  const favorites = body.favorites;
  // 账号或设备标识至少提供一个
  if (!owner && !validDeviceId(deviceId)) {
    return res.status(400).json({ success: false, error: '缺少有效的账号或设备标识' });
  }
  if (!Array.isArray(favorites)) {
    return res.status(400).json({ success: false, error: '收藏数据格式错误' });
  }
  // 限制收藏条数，防止数据过大
  const trimmed = favorites.slice(0, MAX_FAVORITES);
  const result = await saveCloudFavorites({ owner, deviceId, favorites: trimmed });
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error || '云同步保存失败' });
  }
  res.json({ success: true, count: trimmed.length, updatedAt: Date.now() });
});

// 拉取收藏（GET）
router.get('/', syncLimiter, async (req, res) => {
  const owner = validEmail(req.query.owner);
  const deviceId = req.query.deviceId || '';
  if (!owner && !validDeviceId(deviceId)) {
    return res.status(400).json({ success: false, error: '缺少有效的账号或设备标识' });
  }
  const result = await loadCloudFavorites({ owner, deviceId });
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error || '云同步拉取失败' });
  }
  res.json({ success: true, favorites: result.favorites || [], updatedAt: Date.now() });
});

module.exports = router;
