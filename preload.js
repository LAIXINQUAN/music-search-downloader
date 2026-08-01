const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setCloseBehavior: (behavior) => ipcRenderer.send('set-close-behavior', behavior),
  quitApp: () => ipcRenderer.send('quit-app'),
  isQuiting: () => ipcRenderer.invoke('is-quiting'),
  downloadFile: (url, fileName) => ipcRenderer.invoke('download-file', { url, fileName }),
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', (_event, data) => callback(data));
  },
  onDownloadComplete: (callback) => {
    ipcRenderer.on('download-complete', (_event, data) => callback(data));
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('download-progress');
  },
  removeDownloadCompleteListener: () => {
    ipcRenderer.removeAllListeners('download-complete');
  },
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openDesktopLyrics: () => ipcRenderer.invoke('open-desktop-lyrics'),
  isDesktopLyricsOpen: () => ipcRenderer.invoke('is-desktop-lyrics-open'),
  closeDesktopLyrics: () => ipcRenderer.send('close-desktop-lyrics'),
  onDesktopLyricsClosed: (callback) => {
    ipcRenderer.on('desktop-lyrics-closed', () => callback());
  },
  updateDesktopLyricsText: (text, songInfo) => ipcRenderer.send('update-desktop-lyrics-text', { text, songInfo }),
  openMiniPlayer: () => ipcRenderer.invoke('open-mini-player'),
  isMiniPlayerOpen: () => ipcRenderer.invoke('is-mini-player-open'),
  onMiniControl: (callback) => {
    ipcRenderer.on('mini-control', (_event, data) => callback(data));
  },
  closeMiniPlayer: () => ipcRenderer.send('close-mini-player'),
  onMiniPlayerClosed: (callback) => {
    ipcRenderer.on('mini-player-closed', () => callback());
  },
  updateMiniPlayer: (data) => {
    ipcRenderer.send('update-mini-player-state', data);
  },
});
