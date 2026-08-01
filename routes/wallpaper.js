/**
 * 动态壁纸路由
 * 提供壁纸列表查询、缩略图和视频流服务
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// 设置 ffmpeg 路径（使用 ffmpeg-static 提供的二进制文件）
ffmpeg.setFfmpegPath(ffmpegStatic);

// 动态壁纸存储目录（开发环境和打包环境兼容）
const WALLPAPER_DIR = (() => {
    // 打包后的 Electron 环境：壁纸在 extraResources 中
    if (process.resourcesPath) {
        const p = path.join(process.resourcesPath, '动态壁纸');
        if (fs.existsSync(p)) return p;
    }
    // 开发环境：壁纸在项目根目录
    const devPath = path.join(__dirname, '..', '动态壁纸');
    return devPath;
})();

// 支持的视频格式
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];

/**
 * GET /api/wallpapers
 * 返回所有可用壁纸列表
 */
router.get('/', (_req, res) => {
    try {
        if (!fs.existsSync(WALLPAPER_DIR)) {
            return res.json({ success: true, wallpapers: [] });
        }
        const files = fs.readdirSync(WALLPAPER_DIR);
        const wallpapers = files
            .filter(f => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()))
            .map(f => ({
                filename: f,
                name: path.basename(f, path.extname(f)),
                ext: path.extname(f).toLowerCase()
            }));
        res.json({ success: true, wallpapers });
    } catch (error) {
        console.error('获取壁纸列表失败:', error.message);
        res.status(500).json({ success: false, error: '获取壁纸列表失败' });
    }
});

/**
 * GET /api/wallpapers/video?name=xxx
 * 以流式传输壁纸视频文件
 * 支持 Range 请求实现视频拖动
 */
router.get('/video', (req, res) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ success: false, error: '缺少壁纸文件名' });
    }

    // 安全检查：防止路径穿越
    const safeName = path.basename(name);
    const filePath = path.join(WALLPAPER_DIR, safeName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: '壁纸文件不存在' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(safeName).toLowerCase();

    // MIME 类型映射
    const mimeTypes = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska'
    };
    const contentType = mimeTypes[ext] || 'video/mp4';

    // 大文件流式传输优化：增大 highWaterMark 减少磁盘 I/O
    const streamOptions = { highWaterMark: 1024 * 1024 }; // 1MB

    // 流错误处理：防止磁盘错误导致进程崩溃
    const handleStreamError = (stream, res) => {
        stream.on('error', (err) => {
            console.error('壁纸视频流传输错误:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: '视频流传输失败' });
            } else {
                res.end();
            }
        });
        req.on('close', () => stream.destroy());
    };

    // 支持 Range 请求（视频拖动需要）
    const range = req.headers.range;
    if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        res.writeHead(206, {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize,
            'Content-Type': contentType
        });

        const stream = fs.createReadStream(filePath, { ...streamOptions, start, end });
        stream.pipe(res);
        handleStreamError(stream, res);
    } else {
        res.writeHead(200, {
            'Content-Length': fileSize,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes'
        });

        const stream = fs.createReadStream(filePath, streamOptions);
        stream.pipe(res);
        handleStreamError(stream, res);
    }
});

/**
 * GET /api/wallpapers/thumbnail
 * 使用 ffmpeg 提取视频第一帧作为缩略图（JPEG 格式）
 * 支持缓存，减少重复生成
 */
const thumbnailCache = new Map();
router.get('/thumbnail', (req, res) => {
    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ success: false, error: '缺少壁纸文件名' });
    }

    // 安全检查：防止路径穿越
    const safeName = path.basename(name);
    const filePath = path.join(WALLPAPER_DIR, safeName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, error: '壁纸文件不存在' });
    }

    // 检查缓存
    const cacheKey = safeName;
    if (thumbnailCache.has(cacheKey)) {
        const cached = thumbnailCache.get(cacheKey);
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(cached);
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // 使用 ffmpeg 提取视频第一帧，直接 pipe 到响应
    const stream = ffmpeg(filePath)
        .on('error', (err) => {
            console.error(`壁纸缩略图生成失败 [${safeName}]:`, err.message);
            // 如果还没有发送响应头，返回错误 JSON
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: '生成缩略图失败' });
            }
        })
        .on('end', () => {
            // ffmpeg 结束
        })
        .outputOptions([
            '-vframes 1',          // 只提取一帧
            '-f image2pipe',        // 输出到管道
            '-q:v 3'                // JPEG 质量（1-31，越小质量越好）
        ])
        .pipe();

    // 收集 ffmpeg 输出的二进制数据
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        // 缓存缩略图（最多缓存 50 个）
        if (thumbnailCache.size < 50) {
            thumbnailCache.set(cacheKey, buffer);
        }
        if (!res.headersSent) {
            res.send(buffer);
        }
    });
    stream.on('error', (err) => {
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: '缩略图传输失败' });
        }
    });
});

module.exports = router;