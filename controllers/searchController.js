/**
 * 搜索控制器
 * 处理音乐搜索请求
 */
const { searchMusic } = require('../services/scraper');
const { ApiError } = require('../utils/errorHandler');

/**
 * 搜索音乐接口
 * GET /api/search?keyword=xxx
 */
async function search(req, res, next) {
  try {
    const { keyword } = req.query;

    if (!keyword || !keyword.trim()) {
      throw new ApiError(400, '请输入搜索关键词');
    }

    const { source } = req.query;
    const songs = await searchMusic(keyword.trim(), source || 'all');

    res.json({
      success: true,
      total: songs.length,
      data: songs
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { search };