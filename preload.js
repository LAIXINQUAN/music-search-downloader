/**
 * Electron 预加载脚本
 * 通过 contextBridge 安全地暴露 Electron API 给渲染进程
 */
const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给前端页面调用
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 发送关闭行为设置到主进程
   * @param {string} behavior - 'minimize' 或 'close'
   */
  setCloseBehavior: (behavior) => ipcRenderer.send('set-close-behavior', behavior),
  /**
   * 请求主进程退出应用（从托盘菜单触发）
   */
  quitApp: () => ipcRenderer.send('quit-app'),
  /**
   * 判断当前是否为真正退出（用于区分关闭和最小化）
   * @returns {Promise<boolean>}
   */
  isQuiting: () => ipcRenderer.invoke('is-quiting'),
  /**
   * 触发文件下载（通过主进程 webContents.downloadURL）
   * @param {string} url - 下载链接
   * @param {string} fileName - 文件名
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  downloadFile: (url, fileName) => ipcRenderer.invoke('download-file', { url, fileName }),
  /**
   * 监听下载进度
   * @param {Function} callback - 回调函数 ({fileName, progress, received, total})
   */
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_event, data) => callback(data));
  },
  /**
   * 监听下载完成
   * @param {Function} callback - 回调函数 ({success, fileName, path, error?})
   */
  onDownloadComplete: (callback) => {
    ipcRenderer.on('download-complete', (_event, data) => callback(data));
  },
  /**
   * 移除下载进度监听
   */
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  },
  /**
   * 移除下载完成监听
   */
  removeDownloadCompleteListener: () => {
    ipcRenderer.removeAllListeners('download-complete');
  },
  /**
 * 打开文件选择对话框，选择本地音频文件
 * @returns {Promise<{success: boolean, canceled?: boolean, filePath?: string}>}
 */
openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
/**
 * 打开桌面歌词窗口
 * @returns {Promise<{success: boolean}>}
 */
openDesktopLyrics: () => ipcRenderer.invoke('open-desktop-lyrics'),
/**
 * 检查桌面歌词窗口是否打开
 * @returns {Promise<boolean>}
 */
isDesktopLyricsOpen: () => ipcRenderer.invoke('is-desktop-lyrics-open'),
/**
 * 关闭桌面歌词窗口
 */
closeDesktopLyrics: () => ipcRenderer.send('close-desktop-lyrics'),
/**
 * 监听桌面歌词窗口被关闭（由歌词窗口自身关闭时触发）
 * @param {Function} callback
 */
onDesktopLyricsClosed: (callback) => {
  ipcRenderer.on('desktop-lyrics-closed', () => callback());
},
/**
 * 更新桌面歌词文本
 * @param {string} text - 当前歌词文本
 * @param {string} songInfo - 歌曲信息
 */
updateDesktopLyricsText: (text, songInfo) => ipcRenderer.send('update-desktop-lyrics-text', { text, songInfo }),
/**
 * 打开迷你播放器
 * @returns {Promise<{success: boolean}>}
 */
openMiniPlayer: () => ipcRenderer.invoke('open-mini-player'),
/**
 * 检查迷你播放器是否打开
 * @returns {Promise<boolean>}
 */
isMiniPlayerOpen: () => ipcRenderer.invoke('is-mini-player-open'),
/**
 * 监听迷你播放器控制事件
 * @param {Function} callback - 回调函数 ({action, percent?})
 */
onMiniControl: (callback) => {
  ipcRenderer.on('mini-control', (_event, data) => callback(data));
},
/**
 * 关闭迷你播放器窗口
 */
closeMiniPlayer: () => ipcRenderer.send('close-mini-player'),
/**
 * 监听迷你播放器窗口被关闭（由播放器自身关闭时触发）
 * @param {Function} callback
 */
onMiniPlayerClosed: (callback) => {
  ipcRenderer.on('mini-player-closed', () => callback());
},
/**
 * 更新迷你播放器状态（发送给主进程）
 * @param {Object} data - { name, artist, coverUrl, isPlaying, percent }
 */
updateMiniPlayer: (data) => {
  ipcRenderer.send('update-mini-player-state', data);
},
});
