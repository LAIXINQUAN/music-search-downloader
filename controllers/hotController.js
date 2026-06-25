/**
 * 热门推荐控制器
 * 处理首页热门歌曲推荐请求
 */
const { getHotMusic } = require('../services/scraper');

/**
 * 热门推荐接口
 * GET /api/hot
 */
async function hot(req, res, next) {
  try {
    const songs = await getHotMusic();

    res.json({
      success: true,
      total: songs.length,
      data: songs
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { hot };