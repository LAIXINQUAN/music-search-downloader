/**
 * 播放代理控制器
 * 服务端代理音频流，解决浏览器直接请求 MP3 链接被防盗链拦截的问题
 * 与下载接口不同：不设置 Content-Disposition: attachment，让浏览器作为音频流播放
 * GET /api/proxy-play?url=xxx
 */
const axios = require('axios');

/**
 * 根据 URL 域名推断合适的 Referer
 * @param {string} url - 音频URL
 * @returns {string} Referer 头
 */
function pickReferer(url) {
  try {
    const host = new URL(url).hostname;
    if (host.includes('gequbao')) return 'https://www.gequbao.com/';
    if (host.includes('kuwo') || host.includes('kw-')) return 'https://www.kuwo.cn/';
    if (host.includes('kugou')) return 'https://www.kugou.com/';
    if (host.includes('qq.com')) return 'https://y.qq.com/';
    if (host.includes('music.126') || host.includes('netease')) return 'https://music.163.com/';
    return '';
  } catch {
    return '';
  }
}

/**
 * 代理播放接口
 * 流式转发音频内容，加上防盗链所需的 Referer 和 User-Agent
 */
async function proxy(req, res) {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: '缺少音频链接参数' });
  }

  const audioUrl = decodeURIComponent(url);
  if (!audioUrl.startsWith('http')) {
    return res.status(400).json({ success: false, error: '无效的音频链接' });
  }

  const referer = pickReferer(audioUrl);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive'
  };
  if (referer) headers['Referer'] = referer;

  // 支持 HTTP Range 请求（浏览器 seek 时需要）
  if (req.headers.range) {
    headers['Range'] = req.headers.range;
  }

  try {
    const response = await axios.get(audioUrl, {
      headers,
      timeout: 30000,
      responseType: 'stream',
      maxRedirects: 5,
      // 允许 206 部分内容响应
      validateStatus: (status) => (status >= 200 && status < 300) || status === 206
    });

    // 转发上游响应状态码（206 表示部分内容，浏览器 seek 需要）
    res.status(response.status);

    // 转发 Content-Range 头（浏览器 seek 需要）
    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
    }

    // 仅设置 Content-Type，不设置 Content-Disposition（避免触发下载）
    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    // 允许跨域（前端可能从 file:// 或其他域加载）
    res.setHeader('Access-Control-Allow-Origin', '*');
    // 支持 Range 请求
    res.setHeader('Accept-Ranges', 'bytes');

    response.data.pipe(res);
    // 客户端断开连接时销毁上游流，避免资源泄漏
    req.on('close', () => response.data.destroy());
    // 上游流中途错误（如连接中断），需主动结束响应，避免请求挂起
    response.data.on('error', (err) => {
      console.error('[ProxyPlay Stream Error]', err.message);
      if (!res.headersSent) {
        res.status(502).json({ success: false, error: '音频流中断' });
      } else {
        res.end();
      }
    });
  } catch (error) {
    console.error('[ProxyPlay Error]', audioUrl, error.message);
    // 请求初始化阶段失败时 headers 尚未发送，可安全返回 JSON
    if (!res.headersSent) {
      res.status(502).json({ success: false, error: '获取音频失败: ' + error.message });
    } else {
      res.end();
    }
  }
}

module.exports = { proxy };