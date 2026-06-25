# QB音乐 - 音乐搜索与下载平台

一款基于 Electron + Express 的 Windows 桌面音乐搜索与下载客户端，支持多平台音乐源搜索、在线播放和下载。

## 功能特性

- 🔍 **多源搜索** - 支持歌曲宝、酷我、酷狗、QQ音乐、网易云音乐等多平台搜索
- 🎵 **在线播放** - 内置播放器，支持在线试听
- 💾 **下载功能** - 一键下载 MP3 音频文件
- 🔥 **热门推荐** - 获取热门歌曲榜单
- 🖥️ **桌面应用** - Windows 桌面客户端，支持系统托盘最小化
- 🌙 **明暗主题** - 支持浅色/深色主题切换
- 🎨 **豆包风格UI** - 简洁美观的界面设计

## 技术栈

- **前端**: HTML/CSS/JavaScript（豆包风格界面）
- **后端**: Node.js + Express 5
- **桌面框架**: Electron
- **数据爬取**: Axios + Cheerio
- **打包工具**: electron-builder

## 项目结构

```
music-search-downloader/
├── main.js              # Electron 主进程入口
├── preload.js           # Electron 预加载脚本
├── index.js             # Express 服务入口
├── package.json         # 项目配置
├── .npmrc               # npm 镜像配置（国内加速）
├── Music_31107.ico      # 应用图标
├── controllers/         # 控制器层
│   ├── searchController.js   # 搜索控制器
│   ├── musicController.js    # 音乐详情控制器
│   ├── downloadController.js # 下载控制器
│   └── hotController.js      # 热门推荐控制器
├── routes/              # 路由层
│   ├── search.js
│   ├── music.js
│   ├── download.js
│   └── hot.js
├── services/            # 服务层
│   └── scraper.js       # 多源音乐爬虫服务
├── utils/               # 工具类
│   └── errorHandler.js  # 统一错误处理
└── public/              # 前端静态文件
    └── index.html       # 主页面
```

## 安装与运行

### 环境要求

- Node.js >= 18
- Windows 操作系统

### 安装依赖

```bash
npm install
```

> 项目已配置 `.npmrc` 使用淘宝镜像加速下载。

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

打包后的安装程序位于 `dist/` 目录下。

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/search?keyword=xxx` | GET | 搜索音乐 |
| `/api/music/:id` | GET | 获取音乐详情与播放链接 |
| `/api/download?url=xxx` | GET | 下载音乐文件 |
| `/api/hot` | GET | 获取热门歌曲 |
| `/api/netease-play?id=xxx` | GET | 网易云音乐音频代理（解决跨域） |

## 支持的音乐源

- 歌曲宝 (gequbao.com)
- 酷我音乐 (kuwo.cn)
- 酷狗音乐 (kugou.com)
- QQ音乐 (y.qq.com)
- 网易云音乐（后备播放源）

## 署名

GitHub: [LAIXINGQUAN](https://github.com/LAIXINGQUAN)

## License

ISC
