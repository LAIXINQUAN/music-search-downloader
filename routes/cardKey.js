/**
 * 卡密管理路由
 * POST /api/cardkey/replace —— 替换当前卡密（只修改当前使用的卡密，有限流保护）
 * GET /api/cardkey/check-update —— 代理获取版本信息，无速率限制
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const axios = require('axios');
const { replace } = require('../controllers/cardKeyController');

// 卡密替换接口限流：每分钟最多 5 次
const replaceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '卡密操作过于频繁，请稍后重试' }
});

router.post('/replace', replaceLimiter, replace);

/**
 * 版本检查代理接口
 * 通过 raw.githubusercontent.com 获取版本信息，避免前端直接访问 GitHub Pages 超时
 */
router.get('/check-update', async (_req, res) => {
  try {
    // 优先用 raw.githubusercontent.com（比 github.io 更稳定，不会被 CDN 拦截）
    const response = await axios.get('https://raw.githubusercontent.com/LAIXINQUAN/LAIQB/main/README.md', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/plain, */*'
      }
    });
    const text = response.data;

    // 解析版本号
    const versionMatch = text.match(/最新版本：(\d+\.\d+\.\d+)/);
    if (!versionMatch) {
      return res.json({ success: false, error: '无法解析版本信息' });
    }

    // 解析下载地址
    const downloadMatch = text.match(/下载地址：(https?:\/\/\S+)/);

    return res.json({
      success: true,
      latestVersion: versionMatch[1],
      downloadUrl: downloadMatch ? downloadMatch[1] : ''
    });
  } catch (error) {
    console.error('[CheckUpdate Error]', error.message);
    // 回退方案：尝试 GitHub API 获取文件内容
    try {
      const apiRes = await axios.get('https://api.github.com/repos/LAIXINQUAN/LAIQB/contents/README.md', {
        timeout: 10000,
        headers: {
          'User-Agent': 'QB-Music-App',
          'Accept': 'application/vnd.github+json'
        }
      });
      const text = Buffer.from(apiRes.data.content || '', 'base64').toString('utf8');
      const versionMatch = text.match(/最新版本：(\d+\.\d+\.\d+)/);
      if (!versionMatch) {
        return res.json({ success: false, error: '无法解析版本信息' });
      }
      const downloadMatch = text.match(/下载地址：(https?:\/\/\S+)/);
      return res.json({
        success: true,
        latestVersion: versionMatch[1],
        downloadUrl: downloadMatch ? downloadMatch[1] : ''
      });
    } catch (err2) {
      console.error('[CheckUpdate Fallback Error]', err2.message);
      return res.json({ success: false, error: '网络请求失败，请稍后重试' });
    }
  }
});

module.exports = router;
