/**
 * 使用统计路由
 * POST /api/usage —— 接收前端上报的使用记录，转发到飞书多维表格
 * 带限流：每个 IP 每分钟最多 10 次，防止滥用
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { reportUsage } = require('../services/usageService');

// 使用统计接口限流：每分钟最多 10 次
const usageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '上报过于频繁，请稍后重试' }
});

/**
 * 上报使用记录
 * POST /api/usage
 * body: { username, machineId, version, signature }
 */
router.post('/', usageLimiter, async (req, res) => {
  try {
    const { username, machineId, version, signature } = req.body || {};
    // 至少需要一项有效数据，否则拒绝
    if (!username && !machineId) {
      return res.status(400).json({ success: false, error: '缺少上报数据' });
    }
    const result = await reportUsage({ username, machineId, version, signature });
    // 即使飞书未配置也不影响客户端，视为成功（客户端不做重试）
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Usage Report Error]', error.message);
    return res.status(500).json({ success: false, error: '上报失败' });
  }
});

module.exports = router;
