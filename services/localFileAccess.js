/**
 * 本地文件访问授权模块
 * 主进程在扫描本地音乐文件夹时，将扫描目录登记为"授权目录"，
 * /api/local-file 路由据此放行，实现"用户明确扫描的目录可播放"，
 * 同时避免放开全部文件系统访问导致的安全风险。
 */

// 已授权目录列表（绝对路径）
let authorizedDirs = [];

/**
 * 登记一个授权目录
 * @param {string} dir - 目录绝对路径
 */
function addAuthorizedDir(dir) {
  if (!dir) return;
  const resolved = pathResolve(dir);
  if (!authorizedDirs.includes(resolved)) {
    authorizedDirs.push(resolved);
  }
}

/**
 * 清空授权目录（可选，用于重新初始化）
 */
function clearAuthorizedDirs() {
  authorizedDirs = [];
}

/**
 * 判断文件路径是否位于任一授权目录内
 * @param {string} filePath - 文件绝对路径
 * @returns {boolean} 是否已授权
 */
function isAuthorized(filePath) {
  if (!filePath) return false;
  const resolved = pathResolve(filePath);
  return authorizedDirs.some(dir => resolved === dir || resolved.startsWith(dir + pathSep()));
}

/**
 * 惰性加载 path 模块，避免循环依赖
 */
function pathResolve(p) {
  const path = require('path');
  return path.resolve(p);
}
function pathSep() {
  const path = require('path');
  return path.sep;
}

module.exports = { addAuthorizedDir, clearAuthorizedDirs, isAuthorized };
