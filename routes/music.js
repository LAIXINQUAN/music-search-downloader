/**
 * 音乐详情路由
 * GET /api/music/:id
 */
const express = require('express');
const router = express.Router();
const { detail } = require('../controllers/musicController');

router.get('/:id', detail);

module.exports = router;