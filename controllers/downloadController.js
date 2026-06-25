/**
 * 下载控制器
 * 处理音乐下载代理请求
 */
const axios = require('axios');
const { ApiError } = require('../utils/errorHandler');

/**
 * 音乐下载代理接口
 * GET /api/download?url=xxx&name=xxx
 * 服务端代理下载，以流式方式转发给客户端
 */
async function download(req, res, next) {
  try {
    const { url, name } = req.query;

    if (!url) {
      throw new ApiError(400, '缺少下载链接参数');
    }

    // 解码URL
    const downloadUrl = decodeURIComponent(url);

    // 验证URL合法性
    if (!downloadUrl.startsWith('http')) {
      throw new ApiError(400, '无效的下载链接');
    }

    console.log(`开始下载: ${downloadUrl}`);

    // 发送请求获取文件流
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 120000, // 增加超时时间到2分钟
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.gequbao.com/',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive'
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400
    });

    // 设置响应头
    const fileName = name ? `${encodeURIComponent(name)}.mp3` : 'music.mp3';
    const contentType = response.headers['content-type'] || 'audio/mpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${fileName}`);

    // 如果有Content-Length，设置响应头
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }

    // 处理客户端断开连接
    req.on('close', () => {
      console.log('客户端断开连接，停止下载');
      response.data.destroy(); // 停止上游流
    });

    // 流式传输文件
    response.data.pipe(res);

    // 处理上游流错误
    response.data.on('error', (err) => {
      console.error(`上游流错误: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: '下载失败' });
      } else {
        // 如果响应头已发送，只能结束连接
        res.end();
      }
    });

    // 下载完成日志
    response.data.on('end', () => {
      console.log('下载完成');
    });

  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }

    console.error(`下载失败: ${error.message}`);

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ success: false, error: '下载超时，请稍后重试' });
    }

    if (error.response) {
      // 上游服务器返回错误
      const status = error.response.status;
      if (status === 403) {
        return res.status(403).json({ success: false, error: '上游服务器拒绝访问，请尝试使用网盘下载' });
      }
      if (status === 404) {
        return res.status(404).json({ success: false, error: '资源不存在' });
      }
    }

    res.status(500).json({ success: false, error: '下载失败，请稍后重试' });
  }
}

module.exports = { download };