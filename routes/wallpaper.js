/**
 * 动态壁纸路由
 * 提供壁纸列表查询、缩略图和视频流服务
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const multer = require('multer');

// ===== ffmpeg 初始化（打包环境兼容） =====
// 在 Electron 打包后，ffmpeg-static 的 __dirname 指向 app.asar 内部，
// 但实际二进制文件在 app.asar.unpacked 中，需要修正路径
let ffmpeg = null;
let ffmpegAvailable = false;

try {
    ffmpeg = require('fluent-ffmpeg');
    let ffmpegPath = require('ffmpeg-static');

    // 修正打包环境中的路径（asar -> asar.unpacked）
    if (ffmpegPath && !fs.existsSync(ffmpegPath)) {
        const unpackedPath = ffmpegPath.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
        if (fs.existsSync(unpackedPath)) {
            ffmpegPath = unpackedPath;
            console.log('[壁纸] 已修正 ffmpeg 打包路径:', unpackedPath);
        }
    }

    // 验证二进制文件存在后再设置路径
    if (ffmpegPath && fs.existsSync(ffmpegPath)) {
        ffmpeg.setFfmpegPath(ffmpegPath);
        ffmpegAvailable = true;
        console.log('[壁纸] ffmpeg 初始化成功:', ffmpegPath);
    } else {
        console.warn('[壁纸] ffmpeg 二进制文件不存在，缩略图功能将不可用');
    }
} catch (err) {
    console.warn('[壁纸] ffmpeg 加载失败，缩略图功能将不可用:', err.message);
}

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

    // ffmpeg 不可用时返回默认占位图
    if (!ffmpegAvailable) {
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
          <rect fill="#1a1a2e" width="320" height="180"/>
          <text fill="#555" font-family="sans-serif" font-size="14" text-anchor="middle" x="160" y="95">视频预览不可用</text>
        </svg>`);
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

/**
 * 配置 multer 用于文件上传
 * 限制文件类型为视频格式，大小最大 500MB
 */
// 确保 multer 临时目录存在
const UPLOAD_TEMP_DIR = path.join(WALLPAPER_DIR, '.upload_temp');
if (!fs.existsSync(UPLOAD_TEMP_DIR)) {
    fs.mkdirSync(UPLOAD_TEMP_DIR, { recursive: true });
}

const upload = multer({
    dest: UPLOAD_TEMP_DIR,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
    fileFilter: (_req, file, cb) => {
        const allowedExts = ['.mp4', '.webm', '.mov'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`不支持的文件类型: ${ext}，仅支持 .mp4、.webm、.mov`));
        }
    }
});

/**
 * POST /api/wallpapers/download
 * 从指定 URL 下载壁纸文件到本地壁纸目录
 * Body: { url: string, filename: string }
 */
router.post('/download', async (req, res) => {
    try {
        const { url, filename } = req.body;
        if (!url || !filename) {
            return res.status(400).json({ success: false, error: '缺少 url 或 filename 参数' });
        }

        // 安全检查：防止路径穿越
        const safeFilename = path.basename(filename);
        const filePath = path.join(WALLPAPER_DIR, safeFilename);

        // 如果文件已存在，直接返回成功
        if (fs.existsSync(filePath)) {
            return res.json({ success: true, filename: safeFilename, message: '文件已存在' });
        }

        // 确保壁纸目录存在
        if (!fs.existsSync(WALLPAPER_DIR)) {
            fs.mkdirSync(WALLPAPER_DIR, { recursive: true });
        }

        // 使用 axios 以流式方式下载文件
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 300000 // 5分钟超时（大文件下载需要较长时间）
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        // 清除该文件的缩略图缓存，确保下次请求时重新生成
        thumbnailCache.delete(safeFilename);

        console.log(`壁纸下载成功: ${safeFilename}`);
        res.json({ success: true, filename: safeFilename });
    } catch (error) {
        console.error('壁纸下载失败:', error.message);
        res.status(500).json({ success: false, error: `壁纸下载失败: ${error.message}` });
    }
});

/**
 * POST /api/wallpapers/upload
 * 上传视频文件作为壁纸
 * 接收 multipart/form-data，字段名: file
 */
router.post('/upload', (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ success: false, error: '文件大小超过限制（最大 500MB）' });
                }
                return res.status(400).json({ success: false, error: `上传错误: ${err.message}` });
            }
            return res.status(400).json({ success: false, error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, error: '请选择要上传的文件' });
        }

        const tempPath = req.file.path;
        const originalName = req.file.originalname;
        const safeFilename = path.basename(originalName);
        const targetPath = path.join(WALLPAPER_DIR, safeFilename);

        try {
            // 确保壁纸目录存在
            if (!fs.existsSync(WALLPAPER_DIR)) {
                fs.mkdirSync(WALLPAPER_DIR, { recursive: true });
            }

            // 将临时文件移动到壁纸目录
            fs.renameSync(tempPath, targetPath);

            // 清理临时目录中的空文件
            const tempDir = path.join(WALLPAPER_DIR, '.upload_temp');
            if (fs.existsSync(tempDir)) {
                const tempFiles = fs.readdirSync(tempDir);
                if (tempFiles.length === 0) {
                    fs.rmSync(tempDir, { recursive: true });
                }
            }

            console.log(`壁纸上传成功: ${safeFilename}`);
            // 清除该文件的缩略图缓存（如果存在同名旧文件）
            thumbnailCache.delete(safeFilename);
            res.json({ success: true, filename: safeFilename });
        } catch (error) {
            console.error('壁纸上传失败:', error.message);
            // 清理临时文件
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
            res.status(500).json({ success: false, error: `壁纸上传失败: ${error.message}` });
        }
    });
});

module.exports = router;