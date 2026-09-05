; ============================================================
; QB音乐 v3.4.5 - NSIS 美化安装器自定义脚本
; 作者: LAIXINGQUAN (https://github.com/LAIXINGQUAN)
; ============================================================

; ---------- 安装器欢迎页面 ----------
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "欢迎安装 QB音乐 v${VERSION}"
  !define MUI_WELCOMEPAGE_TEXT "QB音乐 是一款集音乐搜索、在线播放与下载于一体的桌面客户端。$\r$\n$\r$\n\b 核心功能：$\r$\n$\t• 多平台音乐搜索与在线播放$\r$\n$\t• 高清音乐下载（支持多种音质）$\r$\n$\t• 沉浸式播放模式（3D 粒子特效）$\r$\n$\t• 动态壁纸与桌面歌词$\r$\n$\t• 迷你播放器模式$\r$\n$\r$\n\b 使用须知：$\r$\n$\t• 本软件仅供个人学习与研究使用$\r$\n$\t• 请勿用于商业用途或侵犯他人版权$\r$\n$\t• 安装前建议关闭其他音乐播放器"
!macroend

; ---------- 安装目录页面标题 ----------
!macro customInstallDirPage
  !define MUI_DIRECTORYPAGE_TEXT_TOP "QB音乐 v${VERSION} 将安装到以下目录。$\r$\n$\r$\n建议使用默认路径，或选择一个有足够空间的磁盘。$\r$\n\b 应用信息：$\r$\n$\t• 版本：v${VERSION}$\r$\n$\t• 作者：LAIXINGQUAN$\r$\n$\t• 类型：桌面客户端（Electron + Express）"
!macroend

; ---------- 安装器完成页面 ----------
!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "QB音乐 v${VERSION} 安装完成"
  !define MUI_FINISHPAGE_TEXT "QB音乐 已成功安装到您的计算机。$\r$\n$\r$\n\b 快速开始：$\r$\n$\t• 双击桌面快捷方式启动应用$\r$\n$\t• 从开始菜单中找到 QB音乐$\r$\n$\r$\n\b 更多资源：$\r$\n$\t• GitHub: https://github.com/LAIXINQUAN/music-search-downloader$\r$\n$\t• 卡密页面: https://laixinquan.github.io/LAIQB/"
  !define MUI_FINISHPAGE_LINK "访问 GitHub 项目主页"
  !define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/LAIXINQUAN/music-search-downloader"

  ; 运行应用
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd

  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"

  !insertmacro MUI_PAGE_FINISH
!macroend

; ---------- 安装进度页面标题 ----------
!macro customHeader
  !define MUI_PAGE_HEADER_TEXT "正在安装 QB音乐"
  !define MUI_PAGE_HEADER_SUBTEXT "请稍候，正在将 QB音乐 安装到您的计算机..."
!macroend

; ---------- 卸载器欢迎页面 ----------
!macro customUnWelcomePage
  !define MUI_UNTEXT_WELCOME_INFO_TITLE "卸载 QB音乐 v${VERSION}"
  !define MUI_UNTEXT_WELCOME_INFO_TEXT "您确定要卸载 QB音乐 吗？$\r$\n$\r$\n卸载后，以下数据将被保留：$\r$\n$\t• 下载的音乐文件$\r$\n$\t• 自定义壁纸文件$\r$\n$\r$\n如需完全清除，请在卸载后手动删除安装目录。"
!macroend

; ---------- 卸载器完成页面 ----------
!macro customUninstallPage
  !define MUI_UNTEXT_FINISH_TITLE "QB音乐 卸载完成"
  !define MUI_UNTEXT_FINISH_INFO_TEXT "QB音乐 已从您的计算机中卸载。$\r$\n$\r$\n感谢您曾经使用 QB音乐，期待您的再次使用！$\r$\n$\r$\n如有任何问题，请访问 GitHub 项目主页反馈。"
  !insertmacro MUI_UNPAGE_FINISH
!macroend

; ---------- 安装器初始化（检测已有版本）----------
!macro customInit
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion"
  ${If} $0 != ""
    MessageBox MB_YESNO|MB_ICONQUESTION "检测到已安装 QB音乐 $0。$\r$\n$\r$\n是否覆盖安装 v${VERSION}？" IDYES upgrade_confirm
    Quit
    upgrade_confirm:
  ${EndIf}
!macroend

; ============================================================
; 可选组件：任务栏控制器 (MusicBar)
; 用户可在安装界面勾选是否一并安装 MusicBar
; ============================================================

; 组件选择页（插入到安装进度页之前）
Page components

Section "任务栏控制器 (MusicBar)" SecMusicBar
  SetOutPath "$INSTDIR\MusicBar"
  File "${BUILD_RESOURCES_DIR}\MusicBar.exe"

  ; 开始菜单快捷方式
  CreateDirectory "$SMPROGRAMS\QB音乐"
  CreateShortCut "$SMPROGRAMS\QB音乐\MusicBar.lnk" "$INSTDIR\MusicBar\MusicBar.exe"

  ; 注册到卸载列表，便于用户单独卸载 MusicBar
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MusicBar" "DisplayName" "MusicBar"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MusicBar" "DisplayIcon" "$INSTDIR\MusicBar\MusicBar.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MusicBar" "UninstallString" "$INSTDIR\QB音乐.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\MusicBar" "InstallLocation" "$INSTDIR\MusicBar"
SectionEnd