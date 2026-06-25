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
});
