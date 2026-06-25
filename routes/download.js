/**
 * 音乐下载路由
 * GET /api/download?url=xxx&name=xxx
 */
const express = require('express');
const router = express.Router();
const { download } = require('../controllers/downloadController');

router.get('/', download);

module.exports = router;