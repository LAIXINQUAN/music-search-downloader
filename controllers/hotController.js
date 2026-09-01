/**
 * 热门推荐控制器
 * 处理首页热门歌曲推荐请求
 */
const { getHotMusic } = require('../services/scraper');

/**
 * 热门推荐接口
 * GET /api/hot
 * Express 5 中异步路由的错误不会自动传递到错误处理中间件，
 * 因此在 catch 中显式返回 JSON 响应
 */
async function hot(req, res) {
  try {
    const songs = await getHotMusic();

    return res.json({
      success: true,
      total: songs.length,
      data: songs
    });
  } catch (error) {
    console.error('[Hot Error]', error.message);
    return res.status(500).json({ success: false, error: '获取热门歌曲失败' });
  }
}

module.exports = { hot };
