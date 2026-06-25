/**
 * 音乐搜索与下载平台 - 服务入口
 * 基于 Express 框架，提供音乐搜索、详情、下载和热门推荐API
 */
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./utils/errorHandler');

// 引入路由模块
const searchRoutes = require('./routes/search');
const musicRoutes = require('./routes/music');
const downloadRoutes = require('./routes/download');
const hotRoutes = require('./routes/hot');

const app = express();
const PORT = process.env.PORT || 3000;

// 基础中间件配置
app.use(cors());
app.use(express.json());

// 静态文件服务（前端页面），使用绝对路径确保 Electron 打包后也能正确找到
const path = require('path');
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

// 网易云音乐音频代理（解决跨域与防盗链，作为后备播放源）
const axios = require('axios');
app.get('/api/netease-play', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).json({ success: false, error: '缺少歌曲ID' });
  try {
    const response = await axios.get(`https://music.163.com/song/media/outer/url?id=${id}.mp3`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 30000,
      responseType: 'stream',
      maxRedirects: 5
    });
    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    response.data.pipe(res);
    req.on('close', () => response.data.destroy());
  } catch (error) {
    console.error('网易云音频代理失败:', error.message);
    res.status(500).json({ success: false, error: '获取音频失败' });
  }
});

// 根路由回退：所有未匹配的 GET 请求返回 index.html（Express 5 兼容写法）
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 统一错误处理
app.use(errorHandler);

// 启动服务
app.listen(PORT, () => {
  console.log(`音乐搜索与下载平台服务已启动: http://localhost:${PORT}`);
});

module.exports = app;