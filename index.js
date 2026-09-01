/**
 * 音乐搜索与下载平台 - 服务入口
 * 基于 Express 框架，提供音乐搜索、详情、下载和热门推荐API
 * 导出 serverReady Promise，供 Electron 主进程等待服务就绪
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const { errorHandler } = require('./utils/errorHandler');

/**
 * 加载应用版本配置（edition.json）
 * 区分开源版（oss，默认，含卡密）与开源版（pro，无卡密）
 * pro 版：无卡密验证，纯署名防转卖
 * @returns {{edition: string, licenseName: string}} 版本配置
 */
function loadAppConfig() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'edition.json'), 'utf8');
    const cfg = JSON.parse(raw);
    return { edition: cfg.edition === 'pro' ? 'pro' : 'oss', licenseName: cfg.licenseName || '' };
  } catch (err) {
    // 读取失败时回退为开源版
    return { edition: 'oss', licenseName: '' };
  }
}

// 版本配置（启动时读取一次）
const APP_CONFIG = loadAppConfig();

/**
 * 安全加载模块，失败时返回空路由，不阻塞服务启动
 * @param {string} modulePath - 模块路径
 * @param {string} name - 模块名称（用于日志）
 * @returns {Object} Express Router 实例
 */
function safeRequire(modulePath, name) {
    try {
        return require(modulePath);
    } catch (err) {
        console.error(`[启动错误] 加载路由模块失败 [${name}]:`, err.message);
        // 返回空路由，确保服务仍能启动
        const fallback = require('express').Router();
        fallback.use((_req, res) => {
            res.status(503).json({ success: false, error: `模块 [${name}] 暂不可用` });
        });
        return fallback;
    }
}

// 引入路由模块（每条路由独立 try-catch，避免单条失败导致整个服务崩溃）
const searchRoutes = safeRequire('./routes/search', 'search');
const musicRoutes = safeRequire('./routes/music', 'music');
const downloadRoutes = safeRequire('./routes/download', 'download');
const hotRoutes = safeRequire('./routes/hot', 'hot');
const cardKeyRoutes = safeRequire('./routes/cardKey', 'cardKey');
const proxyPlayRoutes = safeRequire('./routes/proxyPlay', 'proxyPlay');
const wallpaperRoutes = safeRequire('./routes/wallpaper', 'wallpaper');
const localFileRoutes = safeRequire('./routes/localFile', 'localFile');
const usageRoutes = safeRequire('./routes/usage', 'usage');
const cloudSyncRoutes = safeRequire('./routes/cloudSync', 'cloudSync');
const authRoutes = safeRequire('./routes/auth', 'auth');

const app = express();
const PORT = process.env.PORT || 3000;

// 信任代理（解决 express-rate-limit 的 X-Forwarded-For 警告）
app.set('trust proxy', 1);

// 禁用 Express 指纹（X-Powered-By 头）
app.disable('x-powered-by');

// 安全中间件：helmet 添加 Content-Security-Policy、X-Content-Type-Options 等安全头
app.use(helmet({
  contentSecurityPolicy: false, // 前端页面内联样式较多，CSP 由前端自行控制
  crossOriginEmbedderPolicy: false
}));

// CORS 配置：仅允许本地 Electron 客户端和本地开发环境
app.use(cors({
  origin: function (origin, callback) {
    // 允许无 origin 的请求（如 Electron 的 file:// 或本地请求）
    if (!origin) return callback(null, true);
    // 允许本地地址
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('file://')) {
      return callback(null, true);
    }
    // 拒绝其他来源
    callback(new Error('不允许的跨域来源'));
  }
}));
app.use(express.json({ limit: '1mb' })); // 限制请求体大小

// 全局速率限制：每个 IP 每分钟最多 200 次请求
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后重试' }
});
app.use(globalLimiter);

// 卡密接口速率限制已移至 routes/cardKey.js 中仅对 /replace 路由生效
// check-update 接口不受速率限制，确保版本检查不被拦截

// 静态文件服务（前端页面），使用绝对路径确保 Electron 打包后也能正确找到
app.use(express.static(path.join(__dirname, 'public')));

// 请求日志中间件
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// 注册路由
app.use('/api/search', searchRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/hot', hotRoutes);
app.use('/api/cardkey', cardKeyRoutes);
app.use('/api/proxy-play', proxyPlayRoutes);
app.use('/api/wallpapers', wallpaperRoutes);
app.use('/api/local-file', localFileRoutes);
app.use('/api/usage', usageRoutes);
app.use('/api/cloud-sync', cloudSyncRoutes);
app.use('/api/auth', authRoutes);

// 服务根目录图标（让 Electron 浏览器标签页也显示 favicon）
app.get('/Music_31107.ico', (_req, res) => {
  res.sendFile(path.join(__dirname, 'Music_31107.ico'));
});

// API 信息接口（必须在通配符之前注册）
app.get('/api', (_req, res) => {
  res.json({
    success: true,
    message: '音乐搜索与下载平台 API 服务运行中',
    endpoints: {
      search: '/api/search?keyword=xxx',
      musicDetail: '/api/music/:id',
      download: '/api/download?url=xxx',
      hot: '/api/hot'
    }
  });
});

// 应用版本配置接口（供前端获取版本开关：oss 开源版（含卡密） / pro 开源版（无卡密））
app.get('/api/app-config', (_req, res) => {
  res.json({ success: true, ...APP_CONFIG });
});

// 网易云音乐音频代理（解决跨域与防盗链，作为后备播放源）
const axios = require('axios');
app.get('/api/netease-play', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ success: false, error: '缺少歌曲ID' });
  try {
    const audioUrl = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://music.163.com/',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'identity',
      'Connection': 'keep-alive'
    };

    // 支持 HTTP Range 请求（浏览器 seek 时需要）
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

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

    // 设置响应头
    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    // 支持 Range 请求
    res.setHeader('Accept-Ranges', 'bytes');

    response.data.pipe(res);
    req.on('close', () => response.data.destroy());
    // 上游流中途错误处理
    response.data.on('error', (err) => {
      console.error('[NeteasePlay Stream Error]', err.message);
      if (!res.headersSent) {
        res.status(502).json({ success: false, error: '音频流中断' });
      } else {
        res.end();
      }
    });
  } catch (error) {
    console.error('网易云音频代理失败:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: '获取音频失败' });
    } else {
      res.end();
    }
  }
});

// 根路由回退：所有未匹配的 GET 请求返回 index.html（Express 5 兼容写法）
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 统一错误处理
app.use(errorHandler);

/**
 * 导出 serverReady Promise
 * 在 app.listen 成功时 resolve(port)，失败时 reject(error)
 * 供 Electron 主进程直接 await，无需 HTTP 轮询
 */
const serverReady = new Promise((resolve, reject) => {
  const server = app.listen(PORT, () => {
    console.log(`音乐搜索与下载平台服务已启动: http://localhost:${PORT}`);
    // 服务器启动后自动发送访问请求
    axios.get('https://laixinquan.github.io/LAIQB/', { timeout: 5000 }).then(() => {
      console.log('[启动请求] 已发送访问请求');
    }).catch(e => {
      console.warn('[启动请求] 发送失败:', e.message);
    });
    resolve(PORT);
  });
  server.on('error', (err) => {
    console.error('Express 服务启动失败:', err.message);
    reject(err);
  });
});

module.exports = { app, serverReady };
