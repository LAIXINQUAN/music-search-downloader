const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./utils/errorHandler');

const searchRoutes = require('./routes/search');
const musicRoutes = require('./routes/music');
const downloadRoutes = require('./routes/download');
const hotRoutes = require('./routes/hot');
const wallpaperRoutes = require('./routes/wallpaper');
const cardKeyRoutes = require('./routes/cardKey');
const proxyPlayRoutes = require('./routes/proxyPlay');
const localFileRoutes = require('./routes/localFile');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use('/api/search', searchRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/hot', hotRoutes);
app.use('/api/wallpapers', wallpaperRoutes);
app.use('/api/cardkey', cardKeyRoutes);
app.use('/api/proxy-play', proxyPlayRoutes);
app.use('/api/local-file', localFileRoutes);

app.get('/Music_31107.ico', (_req, res) => {
  res.sendFile(path.join(__dirname, 'Music_31107.ico'));
});

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

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(errorHandler);

const serverReady = new Promise((resolve, reject) => {
  const server = app.listen(PORT, () => {
    console.log(`音乐搜索与下载平台服务已启动: http://localhost:${PORT}`);
    resolve(PORT);
  });
  server.on('error', (err) => {
    console.error('Express 服务启动失败:', err.message);
    reject(err);
  });
});

module.exports = { app, serverReady };
