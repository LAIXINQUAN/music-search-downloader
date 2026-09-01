/**
 * 桌面歌词窗口预加载脚本
 * 暴露 IPC 通信接口给歌词窗口
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lyricsAPI', {
  /**
   * 关闭桌面歌词窗口
   */
  closeLyrics: () => ipcRenderer.send('close-desktop-lyrics'),
  /**
   * 监听歌词更新
   * @param {Function} callback - 回调函数 ({text, songInfo})
   */
  onUpdateLyrics: (callback) => {
    ipcRenderer.on('update-desktop-lyrics', (_event, data) => callback(data));
  }
});