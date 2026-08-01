/**
 * 播放代理路由
 * GET /api/proxy-play?url=xxx —— 服务端代理音频流，绕过防盗链
 */
const express = require('express');
const router = express.Router();
const { proxy } = require('../controllers/proxyPlayController');

router.get('/', proxy);

module.exports = router;