/**
 * 卡密管理控制器
 * 处理修改卡密请求
 * Express 5 中异步路由的错误不会自动传递到错误处理中间件，
 * 因此在 catch 中显式返回 JSON 响应
 */
const { replaceCardKey } = require('../services/cardKeyService');

/**
 * 替换当前卡密接口
 * POST /api/cardkey/replace
 * body: { oldKey: string, newKey: string }
 * 把当前使用的卡密（oldKey）替换为新卡密（newKey），其他卡密保持不变
 */
async function replace(req, res) {
  try {
    const { oldKey, newKey } = req.body || {};

    // 参数校验
    if (oldKey === undefined || newKey === undefined) {
      return res.status(400).json({ success: false, error: '缺少 oldKey 或 newKey 参数' });
    }
    if (!/^\d{8}$/.test(String(oldKey))) {
      return res.status(400).json({ success: false, error: '当前卡密必须为 8 位数字' });
    }
    if (!/^\d{8}$/.test(String(newKey))) {
      return res.status(400).json({ success: false, error: '新卡密必须为 8 位数字' });
    }
    if (String(oldKey) === String(newKey)) {
      return res.status(400).json({ success: false, error: '新卡密与当前卡密相同' });
    }

    // 调用服务替换当前卡密
    await replaceCardKey(String(oldKey), String(newKey));

    return res.json({ success: true, message: '卡密已更新，请使用新卡密登录' });
  } catch (error) {
    console.error('[CardKey Replace Error]', error.message);
    return res.status(500).json({ success: false, error: '修改失败: ' + error.message });
  }
}

module.exports = { replace };