/**
 * Electron 主进程入口
 * 启动 Express 后端服务，创建桌面窗口、系统托盘，处理关闭行为
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, shell } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let isQuiting = false;
let closeBehavior = 'close'; // 'close' 或 'minimize'

/**
 * 启动 Express 后端服务
 * 带端口冲突检测，若 3000 被占用则递增尝试
 */
function startServer() {
  return new Promise((resolve) => {
    const net = require('net');

    /**
     * 检测指定端口是否可用
     * @param {number} port - 待检测的端口号
     * @returns {Promise<number>} 可用的端口号
     */
    function tryPort(port) {
      return new Promise((resolvePort) => {
        const tester = net.createServer();
        tester.once('error', () => resolvePort(port + 1));
        tester.once('listening', () => {
          tester.close(() => resolvePort(port));
        });
        tester.listen(port);
      });
    }

    tryPort(3000).then((port) => {
      process.env.PORT = String(port);
      try {
        require('./index');
        resolve(port);
      } catch (e) {
        console.error('后端服务启动失败:', e.message);
        resolve(port);
      }
    });
  });
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

  tray.setToolTip('QB音乐 - GitHub: LAIXINGQUAN');
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
    title: 'QB音乐 - GitHub: LAIXINGQUAN',
    icon: path.join(__dirname, 'Music_31107.ico'),
    backgroundColor: '#f5f5f7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: true,
    show: true
  });

  // 移除菜单栏（简洁风格）
  mainWindow.setMenuBarVisibility(false);

  // 加载前端页面，带重试机制等待 Express 启动
  const targetUrl = `http://localhost:${process.env.PORT || 3000}`;
  let retryCount = 0;
  const maxRetries = 30;

  /**
   * 尝试加载 URL，失败则延迟重试
   */
  function tryLoad() {
    mainWindow.loadURL(targetUrl).catch(() => {
      if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(tryLoad, 500);
      }
    });
  }

  // 延迟 1 秒后开始加载，给 Express 启动时间
  setTimeout(tryLoad, 1000);

  // 拦截所有外链，在默认浏览器打开
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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
