/**
 * 本地音频文件服务路由
 * GET /api/local-file?path=xxx
 * 提供本地音频文件的流式访问，支持 Range 请求（用于音频 seek）
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// 允许的音频文件扩展名
const ALLOWED_EXTENSIONS = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac', '.wma', '.ape', '.aiff', '.opus'];

router.get('/', (req, res) => {
  try {
    const filePath = req.query.path;
    const fileName = req.query.name || '';

    if (!filePath) {
      return res.status(400).json({ success: false, error: '缺少文件路径参数' });
    }

    // 解码路径并规范化（防止路径穿越攻击）
    const decodedPath = path.resolve(decodeURIComponent(filePath));

    // 验证文件扩展名
    const ext = path.extname(decodedPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return res.status(403).json({ success: false, error: '不支持的文件类型' });
    }

    // 检查文件是否存在
    if (!fs.existsSync(decodedPath)) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }

    const stat = fs.statSync(decodedPath);
    const fileSize = stat.size;

    // 用于 Content-Disposition 的文件名
    const dispositionName = fileName || encodeURIComponent(path.basename(decodedPath));

    // 根据扩展名设置 Content-Type
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.flac': 'audio/flac',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.aac': 'audio/aac',
      '.wma': 'audio/x-ms-wma',
      '.ape': 'audio/ape',
      '.aiff': 'audio/aiff',
      '.opus': 'audio/opus'
    };
    const contentType = mimeTypes[ext] || 'audio/mpeg';

    // 处理 Range 请求（支持音频 seek）
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const stream = fs.createReadStream(decodedPath, { start, end, highWaterMark: 1024 * 1024 });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename*=UTF-8''${dispositionName}`
      });

      stream.on('error', (err) => {
        console.error('本地文件流错误:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: '文件读取失败' });
        } else {
          res.end();
        }
      });

      req.on('close', () => stream.destroy());
      stream.pipe(res);
    } else {
      // 无 Range 请求，返回完整文件
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename*=UTF-8''${dispositionName}`
      });

      const stream = fs.createReadStream(decodedPath, { highWaterMark: 1024 * 1024 });

      stream.on('error', (err) => {
        console.error('本地文件流错误:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: '文件读取失败' });
        } else {
          res.end();
        }
      });

      req.on('close', () => stream.destroy());
      stream.pipe(res);
    }
  } catch (err) {
    console.error('本地文件服务错误:', err.message);
    return res.status(500).json({ success: false, error: '内部错误' });
  }
});

module.exports = router;