/**
 * 热门推荐路由
 * GET /api/hot
 */
const express = require('express');
const router = express.Router();
const { hot } = require('../controllers/hotController');

router.get('/', hot);

module.exports = router;