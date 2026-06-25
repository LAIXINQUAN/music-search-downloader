/**
 * 音乐详情控制器
 * 处理音乐详情获取请求
 */
const { getMusicDetail } = require('../services/scraper');
const { ApiError } = require('../utils/errorHandler');

/**
 * 音乐详情接口
 * GET /api/music/:id?name=xxx&singer=xxx
 * query 参数 name/singer 由前端从搜索结果透传，供后端在主播放源为空时
 * 作为网易云后备播放的搜索关键词（kw_/kg_/qq_ 源详情接口本身拿不到这些信息）
 */
async function detail(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      throw new ApiError(400, '缺少音乐ID参数');
    }

    const { name, singer } = req.query;
    const music = await getMusicDetail(id, { name, singer });

    if (!music || (!music.name && !music.playUrl && !music.neteaseId)) {
      throw new ApiError(404, '未找到该音乐');
    }

    res.json({
      success: true,
      data: music
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { detail };