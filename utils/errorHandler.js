/**
 * 自定义API错误类，用于携带HTTP状态码
 */
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

/**
 * 统一错误处理中间件
 * 捕获所有未处理的错误，返回统一格式的JSON响应
 */
function errorHandler(err, req, res, _next) {
  // 记录错误日志（开发环境）
  console.error(`[Error] ${err.message}`);

  // 如果是自定义ApiError，使用其状态码
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message
    });
  }

  // 处理axios请求错误
  if (err.response) {
    return res.status(502).json({
      success: false,
      error: '上游服务请求失败'
    });
  }

  if (err.code === 'ECONNABORTED') {
    return res.status(504).json({
      success: false,
      error: '请求超时，请稍后重试'
    });
  }

  // 默认500错误
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
}

module.exports = { ApiError, errorHandler };