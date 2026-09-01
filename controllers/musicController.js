/**
 * 音乐详情控制器
 * 处理音乐详情获取请求
 */
const { getMusicDetail } = require('../services/scraper');

/**
 * 音乐详情接口
 * GET /api/music/:id?name=xxx&singer=xxx
 * query 参数 name/singer 由前端从搜索结果透传，供后端在主播放源为空时
 * 作为网易云后备播放的搜索关键词（kw_/kg_/qq_ 源详情接口本身拿不到这些信息）
 * Express 5 中异步路由的错误不会自动传递到错误处理中间件，
 * 因此在 catch 中显式返回 JSON 响应
 */
async function detail(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, error: '缺少音乐ID参数' });
    }

    const { name, singer } = req.query;
    const music = await getMusicDetail(id, { name, singer });

    if (!music || (!music.name && !music.playUrl && !music.neteaseId)) {
      return res.status(404).json({ success: false, error: '未找到该音乐' });
    }

    return res.json({
      success: true,
      data: music
    });
  } catch (error) {
    console.error('[Detail Error]', error.message);
    return res.status(500).json({ success: false, error: '获取详情失败: ' + error.message });
  }
}

module.exports = { detail };
