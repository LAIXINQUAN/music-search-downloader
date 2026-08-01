const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let tray = null;
let isQuiting = false;
let closeBehavior = 'close';
let serverPort = 3000;

/**
 * 启动 Express 后端服务
 * 等待服务器就绪后返回实际端口号
 */
async function startServer() {
  try {
    const { serverReady } = require('./index');
    const actualPort = await serverReady;
    serverPort = actualPort;
    console.log(`后端服务已就绪: http://localhost:${actualPort}`);
    return actualPort;
  } catch (err) {
    console.error('后端服务启动失败:', err.message);
    throw err;
  }
}

/**
 * 创建主窗口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'QB音乐',
    icon: path.join(__dirname, 'Music_31107.ico'),
    backgroundColor: '#f5f5f7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });

  const targetUrl = `http://localhost:${serverPort}`;

  let retryCount = 0;
  function loadPage() {
    mainWindow.loadURL(targetUrl).then(() => {
      mainWindow.show();
    }).catch(() => {
      retryCount++;
      if (retryCount < 10) {
        setTimeout(loadPage, 500);
      } else {
        mainWindow.loadURL(`data:text/html;charset=utf-8,<h1 style="font-family:sans-serif;text-align:center;margin-top:40vh;color:#333">服务启动失败，请重启应用</h1>`);
        mainWindow.show();
      }
    });
  }

  setTimeout(loadPage, 1000);

  mainWindow.on('close', (e) => {
    if (!isQuiting && closeBehavior === 'minimize') {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ... 更多代码
module.exports = { app, mainWindow, serverPort };