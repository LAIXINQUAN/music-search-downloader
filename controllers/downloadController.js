/**
 * 下载控制器
 * 处理音乐下载代理请求
 */
const axios = require('axios');
const { URL } = require('url');
const net = require('net');

/**
 * 音乐下载白名单域名（仅允许从这些域名下载）
 */
const ALLOWED_DOMAINS = [
  'gequbao.com', 'www.gequbao.com',
  'kuwo.cn', 'www.kuwo.cn', 'kw-',
  'kugou.com', 'www.kugou.com',
  'qq.com', 'y.qq.com',
  'music.163.com', 'music.126.net',
  'migu.cn',
  'github.com', 'githubusercontent.com',
  'objects.githubusercontent.com'
];

/**
 * 检查 URL 是否为安全的内网地址
 * 防止 SSRF 攻击（访问内网服务）
 * @param {string} hostname - 主机名
 * @returns {boolean} 是否为内网地址
 */
function isPrivateIP(hostname) {
  // 检查是否为 IP 地址
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(hostname)) return false;
  const parts = hostname.split('.').map(Number);
  // 127.0.0.0/8 回环
  if (parts[0] === 127) return true;
  // 10.0.0.0/8 私有
  if (parts[0] === 10) return true;
  // 172.16.0.0/12 私有
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16 私有
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 169.254.0.0/16 链路本地
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 0.0.0.0
  if (parts[0] === 0) return true;
  return false;
}

/**
 * 检查 URL 是否在允许的域名白名单内
 * @param {string} hostname - 主机名
 * @returns {boolean} 是否允许
 */
function isAllowedDomain(hostname) {
  return ALLOWED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
}

/**
 * 音乐下载代理接口
 * GET /api/download?url=xxx&name=xxx
 * 服务端代理下载，以流式方式转发给客户端
 * Express 5 中异步路由的错误不会自动传递到错误处理中间件，
 * 因此在 catch 中显式返回 JSON 响应
 */
async function download(req, res) {
  try {
    const { url, name } = req.query;

    if (!url) {
      return res.status(400).json({ success: false, error: '缺少下载链接参数' });
    }

    // 解码URL（URL 可能已被编码，解码失败则使用原始值）
    let downloadUrl = url;
    try {
      downloadUrl = decodeURIComponent(url);
    } catch {
      // 解码失败，使用原始 URL
    }

    // 验证URL合法性
    if (!downloadUrl.startsWith('http')) {
      return res.status(400).json({ success: false, error: '无效的下载链接' });
    }

    // SSRF 防护：解析 URL 并检查域名/IP 安全性
    let parsedUrl;
    try {
      parsedUrl = new URL(downloadUrl);
    } catch {
      return res.status(400).json({ success: false, error: '无效的下载链接格式' });
    }

    // 禁止内网 IP 地址
    if (isPrivateIP(parsedUrl.hostname)) {
      return res.status(403).json({ success: false, error: '不允许访问内网地址' });
    }

    // 检查域名白名单
    if (!isAllowedDomain(parsedUrl.hostname)) {
      return res.status(403).json({ success: false, error: '不支持的下载来源' });
    }

    console.log(`开始下载: ${downloadUrl}`);

    // 根据 URL 域名选择 Referer
    let referer = 'https://www.gequbao.com/';
    try {
      const host = new URL(downloadUrl).hostname;
      if (host.includes('kuwo') || host.includes('kw-')) referer = 'https://www.kuwo.cn/';
      else if (host.includes('kugou')) referer = 'https://www.kugou.com/';
      else if (host.includes('qq')) referer = 'https://y.qq.com/';
      else if (host.includes('music.126') || host.includes('netease')) referer = 'https://music.163.com/';
    } catch {}

    // 发送请求获取文件流
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream',
      timeout: 120000, // 增加超时时间到2分钟
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer,
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Connection': 'keep-alive'
      },
      maxRedirects: 5,
      // 允许 403，由后续逻辑处理
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
    console.error(`下载失败: ${error.message}`);

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ success: false, error: '下载超时，请稍后重试' });
    }

    if (error.response) {
      // 上游服务器返回错误
      const status = error.response.status;
      if (status === 403) {
        return res.status(403).json({ success: false, error: '下载链接已过期或受防盗链保护，可尝试在详情页使用网盘下载' });
      }
      if (status === 404) {
        return res.status(404).json({ success: false, error: '资源不存在' });
      }
    }

    return res.status(500).json({ success: false, error: '下载失败，请稍后重试' });
  }
}

module.exports = { download };