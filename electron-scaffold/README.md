# Electron Scaffold · 桌面脚手架 **v1.0.0**

> 从 Nova 壁纸下载器（真实交付：portable exe、71MB、内嵌 HTTP 服务、图片视频预览）反向提炼。
> 目的：下次起一个「带界面的桌面小工具」，不再从空目录手写 main.js，也不再重踩打包的坑。

## 30 秒起一个新项目

```bash
# 1) 复制整个目录到 D:\Documents\<新项目名>
cp -r D:/Documents/开发模块库/electron-scaffold D:/Documents/我的新工具
cd D:/Documents/我的新工具

# 2) 改 main.js 顶部 4 个常量：APP_NAME / APP_ID / DEFAULT_PORT / SCHEME_COLOR
#    改 package.json 的 name / productName / version
#    改 server/http-server.js 起始端口（与 DEFAULT_PORT 保持一致）

# 3) 装依赖（首次）
npm i

# 4) 跑起来
npm start                  # 正常
npm run start:nogpu        # 白屏/黑屏/花屏时用（本机验证过：disable-gpu 更稳）

# 5) 打包出绿色版
npm run dist               # → dist/ScaffoldApp.exe（portable 单文件）
```

首次跑起来，窗口里 5 个区块全部有数据 = 脚手架健康。任何一个报红，先看下面的「内置了什么」。

## 目录结构

| 文件 | 作用 |
|---|---|
| `main.js` | 主进程：单实例锁、无菜单栏、窗口位置记忆、数据目录、外链拦截、IPC 全表 |
| `preload.js` | contextBridge 暴露 `window.api`：端口、info、选目录/文件、openPath、窗口控制、SSE |
| `server/http-server.js` | 内嵌本地服务：**端口占用自动顺延**、静态资源、SSE 推送、跨域代理（补 Referer + 转发 Range） |
| `renderer/index.html` | 页面骨架（5 个示例区块，删掉即得空壳） |
| `renderer/style.css` | 页面布局（只用 theme.css 的令牌，不写死颜色） |
| `renderer/app.js` | 页面逻辑：环境自检 / IPC 选目录 / 放大预览 / SSE / 代理 |
| `renderer/lib/theme.css` | 复制自 `ui-kit/theme.css`（**升级时同步覆盖**） |
| `renderer/lib/lightbox.*` | 复制自 `ui-kit/components/lightbox.*`（同上） |
| `electron-builder.yml` | 打包配置，portable + 三条踩坑注释 |
| `tools/gen_icon.py` | 纯标准库生成 `icon.png` + 多尺寸 `icon.ico`（--c1/--c2 换色） |
| `assets/` | 图标 |

## 内置了什么（每条都是踩过才写进来的）

| 现象 | 原因 | 脚手架里怎么解决的 |
|---|---|---|
| 双击图标起了两个窗口，第二个抢数据 | 没加单实例锁 | `app.requestSingleInstanceLock()` + `second-instance` 聚焦已有窗口 |
| 默认菜单栏 File/Edit/View 露出，不像成品 | Electron 默认菜单 | `Menu.setApplicationMenu(null)` |
| 启动白屏闪一下 | 窗口先显示再渲染 | `show:false` + `ready-to-show` 再 `show()`，并设 `backgroundColor` |
| 关掉再开，窗口位置/大小丢了 | 没存状态 | `window-state.json` 存 `getNormalBounds()` |
| 开发态把测试数据写进真实数据目录 | 开发/打包共用一个路径 | 开发态写项目内 `.dev-data`，打包态才用 `%APPDATA%\<应用名>`；可用 `SCAFFOLD_DATA_DIR` 覆盖 |
| 端口 17650 被别的进程占了，服务起不来 | 写死端口 | `start()` 失败 `EADDRINUSE` 自动 +1 顺延 20 次，真实端口回传给页面 |
| 页面上看到的图片是 403，复制链接到浏览器能开 | Referer 防盗链 | `/api/proxy?url=&referer=` 服务端补头转发，并转发 Range（视频可拖进度） |
| 页面点击链接跳走了、或者弹出 Electron 新窗口 | 没拦导航 | `setWindowOpenHandler` + `will-navigate` 一律 `shell.openExternal` |
| 退出后端口还占着 | 服务没随窗口关闭 | `before-quit` → `srv.stop()` |
| 打包报签名/符号链接错误 | 本机无符号链接权限 | `signAndEditExecutable: false` |
| 打包出来的 exe 从 71MB 变 78KB | 用 rcedit 直接改已打包的 portable exe，抹掉 NSIS 附加数据 | 改 `node_modules/electron/dist/electron.exe` 后写回 electron 缓存 zip，再重新打包 |
| `electron .` 报 `app undefined` | 环境里有 `ELECTRON_RUN_AS_NODE=1` | 启动前 `env -u ELECTRON_RUN_AS_NODE` 或 `set ELECTRON_RUN_AS_NODE=` |
| 图片放大预览在 disable-gpu 下露出桌面 | `backdrop-filter` 在无 GPU 合成时不生效 | lightbox 组件遮罩用纯色（已在组件里固化） |

## 与模块库其它模块的组合

```
electron-scaffold          壳：窗口 + preload + 内嵌服务 + 打包
├── download-engine        下载：分片/续传/重定向/自定义头（照抄 lib/engine.js 或直接 require）
├── ui-kit/theme.css       视觉：所有颜色/间距/圆角走令牌
├── ui-kit/components/lightbox   放大预览弹窗
├── config-store           配置读写（下载目录、开关、窗口偏好）
├── logger                 滚动日志（排查用户现场问题）
└── autobackup             数据快照（记录本类必备）
```

接法：把需要的模块文件复制进新项目的 `lib/`，然后 `require('./lib/xxx')`。
**不要**在新项目里重写这些能力——这是模块库存在的唯一理由。

## 验证清单（改完必须自己走一遍）

1. `npm start` → 窗口出现，5 个区块都有数据，右上角「服务 端口」为绿色。
2. 点「选择目录」→ 弹出系统对话框 → 选完路径回显 → 点「打开」能在资源管理器里打开。
3. 点任一缩略图 → 弹窗放大 → ←/→ 翻页 → Esc 关闭 → 页面滚动恢复。
4. 「实时事件」显示「已连接」，日志里有 `ready` 一条。
5. 再双击一次 exe → 不新开窗口，只把已有窗口拉到前面。
6. `npm run dist` → `dist/ScaffoldApp.exe` 双击能开，且 `%APPDATA%\ScaffoldApp` 下生成数据目录。
