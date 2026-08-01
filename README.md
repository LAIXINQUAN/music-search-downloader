# QB音乐 - 音乐搜索与下载平台 v3.6.3

[![最新版本](https://img.shields.io/badge/版本-3.6.3-blue)]()
[![下载](https://img.shields.io/badge/下载-Windows安装包-brightgreen)]()

一款基于 Electron + Express 的 Windows 桌面音乐搜索与下载客户端，支持多平台音乐源搜索、在线播放和下载。

## 下载安装

| 版本 | 下载链接 | 说明 |
|------|---------|------|
| **v3.6.3** | [QB-Music-Setup-3.6.3.exe](https://github.com/LAIXINQUAN/music-search-downloader/releases/latest) | Windows 安装包（推荐） |
| 源代码 | [GitHub 仓库](https://github.com/LAIXINQUAN/music-search-downloader) | 克隆后自行构建 |

> 安装包约 90~100MB，包含完整 Electron 运行时，下载后双击即可安装。

## 功能特性

- 🔍 **多源搜索** - 支持歌曲宝、酷我、酷狗、QQ音乐、网易云音乐等多平台搜索
- 🎵 **在线播放** - 内置播放器，支持在线试听
- 💾 **下载功能** - 一键下载 MP3 音频文件
- 🔥 **热门推荐** - 获取热门歌曲榜单
- 🖥️ **桌面应用** - Windows 桌面客户端，支持系统托盘最小化
- 🌙 **明暗主题** - 支持浅色/深色主题切换
- 🎨 **壁纸功能** - 沉浸模式动态视频壁纸
- 🎨 **豆包风格UI** - 简洁美观的界面设计

## 技术栈

- **前端**: HTML/CSS/JavaScript（豆包风格界面）
- **后端**: Node.js + Express 5
- **桌面框架**: Electron
- **数据爬取**: Axios + Cheerio
- **打包工具**: electron-builder

## 安装与运行

### 环境要求
- Node.js >= 18
- Windows 操作系统

### 安装依赖
```bash
npm install
```

### 开发模式运行
```bash
# 仅启动 Express 服务（浏览器访问 http://localhost:3000）
npm start

# 启动 Electron 桌面应用
npm run electron
```

### 打包 Windows 安装包
```bash
npm run build
```

## 署名

GitHub: [LAIXINQUAN](https://github.com/LAIXINQUAN)

## License

ISC
