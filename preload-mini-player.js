/**
 * 迷你播放器窗口预加载脚本
 * 暴露 IPC 通信接口给迷你播放器窗口
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('miniAPI', {
  /**
   * 切换播放/暂停
   */
  togglePlay: () => ipcRenderer.send('mini-toggle-play'),
  /**
   * 上一曲
   */
  prev: () => ipcRenderer.send('mini-prev'),
  /**
   * 下一曲
   */
  next: () => ipcRenderer.send('mini-next'),
  /**
   * 跳转到指定进度
   * @param {number} percent - 0-1
   */
  seek: (percent) => ipcRenderer.send('mini-seek', percent),
  /**
   * 关闭迷你播放器
   */
  closePlayer: () => ipcRenderer.send('close-mini-player'),
  /**
   * 获取授权署名（开源版 pro 显示"授权给 用户名"）
   * @returns {Promise<string>} 署名文本，无署名返回空串
   */
  getSignature: () => ipcRenderer.invoke('mini-get-signature'),
  /**
   * 监听歌曲更新
   * @param {Function} callback
   */
  onUpdateSong: (callback) => {
    ipcRenderer.on('mini-update-song', (_event, data) => callback(data));
  },
  /**
   * 监听播放状态更新
   * @param {Function} callback
   */
  onUpdatePlayState: (callback) => {
    ipcRenderer.on('mini-update-play-state', (_event, data) => callback(data));
  },
  /**
   * 监听进度更新
   * @param {Function} callback
   */
  onUpdateProgress: (callback) => {
    ipcRenderer.on('mini-update-progress', (_event, data) => callback(data));
  }
});