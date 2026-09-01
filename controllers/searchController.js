/**
 * 搜索控制器
 * 处理音乐搜索请求
 */
const { searchMusic } = require('../services/scraper');
const { ApiError } = require('../utils/errorHandler');

/**
 * 搜索音乐接口
 * GET /api/search?keyword=xxx&source=all
 * Express 5 中异步路由的错误不会自动传递到错误处理中间件，
 * 因此在 catch 中显式返回 JSON 响应，确保前端不会因无响应而超时
 */
async function search(req, res) {
  try {
    const { keyword } = req.query;

    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ success: false, error: '请输入搜索关键词' });
    }

    const { source } = req.query;
    const songs = await searchMusic(keyword.trim(), source || 'all');

    return res.json({
      success: true,
      total: songs.length,
      data: songs
    });
  } catch (error) {
    console.error('[Search Error]', error.message);
    return res.status(500).json({ success: false, error: '搜索失败: ' + error.message });
  }
}

module.exports = { search };
