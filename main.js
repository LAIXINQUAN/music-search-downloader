/**
 * Electron 主进程入口
 * 启动 Express 后端服务，创建桌面窗口、系统托盘，处理关闭行为
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuiting = false;
let closeBehavior = 'close'; // 'close' 或 'minimize'
let serverPort = 3000;

/**
 * 启动 Express 后端服务
 * 直接 await index.js 导出的 serverReady Promise，确保服务完全就绪
 * 如果默认端口被占用则递增重试，最多重试 MAX_PORT_RETRIES 次
 * 全部失败则弹出错误对话框并退出应用
 * @param {number} [port=3000] - 起始端口号
 * @param {number} [retryCount=0] - 当前重试次数
 * @returns {Promise<number>} 实际监听的端口号
 */
const MAX_PORT_RETRIES = 20; // 最多尝试 20 个端口（3000-3019）
async function startServer(port = 3000, retryCount = 0) {
  process.env.PORT = String(port);
  try {
    const { serverReady } = require('./index');
    const actualPort = await serverReady;
    serverPort = actualPort;
    console.log(`后端服务已就绪: http://localhost:${actualPort}`);
    return actualPort;
  } catch (err) {
    // 端口被占用（EADDRINUSE），在重试上限内递增重试
    if (err.code === 'EADDRINUSE' && retryCount < MAX_PORT_RETRIES) {
      console.warn(`端口 ${port} 被占用，尝试 ${port + 1}...`);
      // 清除 require 缓存，否则 index.js 不会重新执行
      delete require.cache[require.resolve('./index')];
      // 同时清除 index.js 依赖的模块缓存
      ['./routes/search', './routes/music', './routes/download', './routes/hot',
       './routes/cardKey', './routes/proxyPlay',
       './routes/localFile', './routes/wallpaper',
       './controllers/searchController', './controllers/downloadController',
       './controllers/cardKeyController', './controllers/proxyPlayController',
       './services/scraper', './services/cardKeyService',
       './utils/errorHandler'].forEach(m => {
        try { delete require.cache[require.resolve(m)]; } catch {}
      });
      return startServer(port + 1, retryCount + 1);
    }
    // 所有端口均被占用或其他错误，弹出错误对话框并退出
    console.error('后端服务启动失败:', err.message);
    dialog.showErrorBox(
      '服务启动失败',
      `无法在端口 3000-${port} 范围内启动服务。\n\n` +
      `错误原因: ${err.message}\n\n` +
      '请检查是否有其他程序占用了这些端口，或重启电脑后重试。'
    );
    app.quit();
    throw err;
  }
}

/**
 * 创建系统托盘图标和菜单
 */
function createTray() {
  const iconPath = path.join(__dirname, 'Music_31107.ico');
  tray = new Tray(iconPath);

  // 托盘右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出应用',
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('QB音乐');
  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示窗口
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * 创建主窗口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 750,
    minHeight: 500,
    title: 'QB音乐',
    icon: path.join(__dirname, 'Music_31107.ico'),
    backgroundColor: '#f5f5f7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true,
    show: false
  });

  // 移除菜单栏（简洁风格）
  mainWindow.setMenuBarVisibility(false);

  // 服务器已就绪，直接加载 URL
  const targetUrl = `http://localhost:${serverPort}`;

  /**
   * 带重试机制加载页面，防止极端情况下服务器延迟
   */
  let retryCount = 0;
  function loadPage() {
    mainWindow.loadURL(targetUrl).then(() => {
      mainWindow.show();
    }).catch(() => {
      retryCount++;
      if (retryCount < 20) {
        setTimeout(loadPage, 500);
      } else {
        // 重试多次失败后显示窗口和错误提示
        mainWindow.loadURL(`data:text/html;charset=utf-8,<h1 style="font-family:sans-serif;text-align:center;margin-top:40vh;color:#333">服务启动失败，请重启应用</h1>`);
        mainWindow.show();
      }
    });
  }

  loadPage();

  // 拦截所有外链，在默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  /**
   * 处理文件下载事件
   * Electron 检测到下载请求时触发（<a download> 或 Content-Disposition: attachment）
   */
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    const fileName = item.getFilename() || 'music.mp3';
    // 解码 URL 编码的文件名
    let decodedName = fileName;
    try {
      decodedName = decodeURIComponent(fileName);
    } catch (e) {
      // 解码失败则使用原始文件名
    }
    const savePath = path.join(app.getPath('downloads'), decodedName);

    console.log(`下载开始: ${decodedName}`);
    console.log(`保存路径: ${savePath}`);

    item.setSavePath(savePath);

    // 下载完成
    item.on('done', (event, state) => {
      if (state === 'completed') {
        console.log(`下载完成: ${decodedName}`);
        mainWindow.webContents.send('download-complete', { success: true, fileName: decodedName, path: savePath });
      } else if (state === 'cancelled') {
        console.log(`下载已取消: ${decodedName}`);
      } else if (state === 'interrupted') {
        console.error(`下载中断: ${decodedName}`);
        mainWindow.webContents.send('download-complete', { success: false, fileName: decodedName, error: '下载中断' });
      }
    });

    // 下载进度更新
    item.on('updated', (event, state) => {
      if (state === 'progressing') {
        const received = item.getReceivedBytes();
        const total = item.getTotalBytes();
        if (total > 0) {
          const progress = Math.round((received / total) * 100);
          mainWindow.webContents.send('download-progress', { fileName: decodedName, progress, received, total });
        }
      }
    });
  });

  // 窗口关闭事件：根据设置决定最小化到托盘还是退出
  mainWindow.on('close', (event) => {
    if (!isQuiting && closeBehavior === 'minimize') {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
    mainWindow = null;
  });
}

// IPC：接收前端发送的关闭行为设置
ipcMain.on('set-close-behavior', (_event, behavior) => {
  closeBehavior = behavior;
});

// IPC：前端请求退出应用
ipcMain.on('quit-app', () => {
  isQuiting = true;
  app.quit();
});

// IPC：前端查询当前是否为真正退出
ipcMain.handle('is-quiting', () => isQuiting);

/**
 * IPC：触发文件下载
 * 前端调用此接口，由主进程通过 webContents.downloadURL() 发起下载
 */
ipcMain.handle('download-file', async (event, { url, fileName }) => {
  try {
    // 确保 URL 是绝对路径（Electron 的 downloadURL 需要绝对 URL）
    const absoluteUrl = url.startsWith('http') ? url : `http://localhost:${serverPort}${url}`;
    console.log(`IPC下载请求: ${absoluteUrl}`);
    // 文件名由 will-download 处理器从响应头的 Content-Disposition 中获取
    mainWindow.webContents.downloadURL(absoluteUrl);
    return { success: true };
  } catch (err) {
    console.error(`IPC下载失败: ${err.message}`);
    return { success: false, error: err.message };
  }
});

/**
 * IPC：打开文件选择对话框，选择本地音频文件
 */
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择音频文件',
    filters: [
      { name: '音频文件', extensions: ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac', 'wma', 'ape', 'aiff', 'opus'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }
  return { success: true, filePath: result.filePaths[0] };
});

// ========== 桌面歌词窗口管理 ==========
let desktopLyricsWindow = null;

/**
 * 创建或显示桌面歌词窗口
 */
function createDesktopLyricsWindow() {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.show();
    desktopLyricsWindow.focus();
    return;
  }

  desktopLyricsWindow = new BrowserWindow({
    width: 800,
    height: 80,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-desktop-lyrics.js')
    }
  });

  desktopLyricsWindow.loadFile(path.join(__dirname, 'desktop-lyrics.html'));

  // 设置窗口位置（右下角）
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  desktopLyricsWindow.setPosition(
    Math.round((screenWidth - 800) / 2),
    screenHeight - 120
  );

  desktopLyricsWindow.on('closed', () => {
    desktopLyricsWindow = null;
    // 通知主窗口桌面歌词已关闭，同步状态
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop-lyrics-closed');
    }
  });
}

/**
 * 更新桌面歌词
 * @param {string} text - 当前歌词文本
 * @param {string} songInfo - 歌曲信息
 */
function updateDesktopLyrics(text, songInfo) {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.webContents.send('update-desktop-lyrics', { text, songInfo });
  }
}

// IPC：关闭桌面歌词窗口
ipcMain.on('close-desktop-lyrics', () => {
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    desktopLyricsWindow.close();
    desktopLyricsWindow = null;
  }
});

// IPC：创建桌面歌词窗口
ipcMain.handle('open-desktop-lyrics', () => {
  createDesktopLyricsWindow();
  return { success: true };
});

// IPC：检查桌面歌词窗口是否打开
ipcMain.handle('is-desktop-lyrics-open', () => {
  return desktopLyricsWindow !== null && !desktopLyricsWindow.isDestroyed();
});

// IPC：更新桌面歌词（从渲染进程）
ipcMain.on('update-desktop-lyrics-text', (_event, { text, songInfo }) => {
  updateDesktopLyrics(text, songInfo);
});

// ========== 迷你播放器窗口管理 ==========
let miniPlayerWindow = null;

/**
 * 创建或显示迷你播放器窗口
 */
function createMiniPlayerWindow() {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.show();
    miniPlayerWindow.focus();
    return;
  }

  miniPlayerWindow = new BrowserWindow({
    width: 480,
    height: 56,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-mini-player.js')
    }
  });

  miniPlayerWindow.loadFile(path.join(__dirname, 'mini-player.html'));

  // 设置窗口位置（右下角）
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  miniPlayerWindow.setPosition(
    screenWidth - 500,
    screenHeight - 80
  );

  miniPlayerWindow.on('closed', () => {
    miniPlayerWindow = null;
    // 通知主窗口迷你播放器已关闭，同步状态
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mini-player-closed');
    }
  });
}

// IPC：打开迷你播放器
ipcMain.handle('open-mini-player', () => {
  createMiniPlayerWindow();
  return { success: true };
});

// IPC：关闭迷你播放器
ipcMain.on('close-mini-player', () => {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    miniPlayerWindow.close();
    miniPlayerWindow = null;
  }
});

// IPC：更新迷你播放器状态（从渲染进程）
ipcMain.on('update-mini-player-state', (_event, data) => {
  updateMiniPlayer(data);
});

// IPC：检查迷你播放器是否打开
ipcMain.handle('is-mini-player-open', () => {
  return miniPlayerWindow !== null && !miniPlayerWindow.isDestroyed();
});

// 迷你播放器控制 IPC
ipcMain.on('mini-toggle-play', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mini-control', { action: 'togglePlay' });
  }
});

ipcMain.on('mini-prev', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mini-control', { action: 'prev' });
  }
});

ipcMain.on('mini-next', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mini-control', { action: 'next' });
  }
});

ipcMain.on('mini-seek', (_event, percent) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mini-control', { action: 'seek', percent });
  }
});

/**
 * 更新迷你播放器状态
 * @param {Object} data - { name, artist, coverUrl, isPlaying, percent }
 */
function updateMiniPlayer(data) {
  if (miniPlayerWindow && !miniPlayerWindow.isDestroyed()) {
    if (data.name !== undefined || data.artist !== undefined || data.coverUrl !== undefined || data.isPlaying !== undefined) {
      miniPlayerWindow.webContents.send('mini-update-song', {
        name: data.name,
        artist: data.artist,
        coverUrl: data.coverUrl,
        isPlaying: data.isPlaying
      });
    }
    if (data.isPlaying !== undefined) {
      miniPlayerWindow.webContents.send('mini-update-play-state', { isPlaying: data.isPlaying });
    }
    if (data.percent !== undefined) {
      miniPlayerWindow.webContents.send('mini-update-progress', { percent: data.percent });
    }
  }
}

// 应用就绪后先启动服务再创建窗口和托盘
app.whenReady().then(async () => {
  await startServer();
  createWindow();
  createTray();
});

// 所有窗口关闭时退出应用（托盘模式下不会触发，因为窗口是 hide 不是 close）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// 应用退出前清理托盘
app.on('before-quit', () => {
  isQuiting = true;
  if (tray) {
    tray.destroy();
    tray = null;
  }
});