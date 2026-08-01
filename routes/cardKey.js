/**
 * 卡密管理路由
 * POST /api/cardkey/replace —— 替换当前卡密（只修改当前使用的卡密）
 */
const express = require('express');
const router = express.Router();
const { replace } = require('../controllers/cardKeyController');

router.post('/replace', replace);

module.exports = router;