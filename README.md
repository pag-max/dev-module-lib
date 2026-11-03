# 开发模块库

从 8 个自制软件提炼的可复用模块。新工具优先复用此处，**禁止重写已有模块功能**。

## 模块总览

| 模块 | 路径 | 状态 | 说明 |
|------|------|------|------|
| **Electron Scaffold** | `electron-scaffold/` | ✅ 已实测（12 项自检全绿） | 桌面壳：主进程/preload/内嵌服务/打包配置/图标生成，复制即用 |
| **UI Kit** | `ui-kit/` | ✅ 已定稿（你评价通过） | Electron 页面组件库 + 主题 + `components/lightbox` 放大预览，根治「UI 不如意」 |
| **RecordBook** | `record-book/` | ✅ 可运行 | 本地 CRUD 记录本框架（一份 schema 生成一个本子，已复用 UI Kit） |
| **Download Engine** | `download-engine/` | ✅ v1.1.0 真实场景压过 | 多线程分片下载 + 真断点续传 + 重定向 + 自定义头 + 校验 + m3u8；带 `selftest.js` |
| **Config Store** | `config-store/` | ✅ 可运行 | 配置读写中心（默认值/类型/订阅） |
| **Logger** | `logger/` | ✅ 可运行 | 结构化滚动日志（等级/保留/回传 UI） |
| **AutoBackup** | `autobackup/` | ✅ 可运行 | 自动备份与一键恢复（时间戳快照/保留 N 份） |
| **Auth Gateway** | `auth-gateway/` | ✅ 可运行 | 登录/网关会话管理（SSO/cookie 持久化） |
| **Media Wrap** | `media-wrap/` | ✅ 可运行 | FFmpeg 封装（合并/探针/转码/截图） |
| **Build Templates** | `build-templates/` | ✅ 可运行 | 打包模板（electron-builder / PyInstaller onedir） |
| **Scraper Base** | `scraper-base/` | ✅ 可运行 | 爬虫基础（HTTP 池/重试/限速/解析助手） |

## AI 使用规范（SOP）
1. 新项目先读本索引 → 识别可复用模块 → 读对应 `README.md` + `demo/` 源码。
2. 带界面的新项目：**先复制 `electron-scaffold/`**，跑 `SCAFFOLD_SELFTEST=1 npm start` 验完再写业务；不要空目录手写 main.js，也不要先做网页再包壳。
3. 已有模块功能一律**复用/复制**，禁止从零重写。
4. UI / 手势严格套用 **UI Kit 定稿**，禁止自作主张优化（双击=双击、拖动=拖动）。
5. 模块升级保持向后兼容，不破坏已用项目；**发现的 bug 改在模块里并写 CHANGELOG，不许只在项目内私改副本**。
6. 复用前先验证：下载类先跑 `selftest.js`，UI 类先跑 `demo/`，再接真实数据。

详细规划与起手流程见 `规划设计.md`（第 3.1 / 3.2 节）。

## 最近一次改进（2026-11-02，来源：Nova 壁纸下载器实战）

| 模块 | 改了什么 | 为什么 |
|---|---|---|
| `download-engine` | 升级 v1.1.0：流式写盘、跟随重定向、自定义请求头（Referer 防盗链）、HEAD 降级探测、进度节流、分片数收敛、**真断点续传**、临时文件清理；新增 `selftest.js`（6 组 15 断言）与 `CHANGELOG.md` | 上一版标「可运行」但第一次接真实项目就失败：合并未等 flush 报「大小不符」、续传进度超 100%、分片删除卡死；336MB 视频会整块进内存 |
| `ui-kit` | 新增 `components/lightbox.css` + `lightbox.js`：图片/视频弹窗放大、←/→ 翻页、滚轮缩放、双击 1:1、Esc 关闭、缩略条；新增 `demo/lightbox.html` | 放大预览是高频需求，之前每次重写；且遮罩用 `backdrop-filter` 在 `--disable-gpu` 下会露底 |
| `electron-scaffold` | **新模块**：单实例/无菜单/窗口记忆/数据目录/外链拦截/端口顺延内嵌服务/SSE/跨域代理补 Referer/portable 打包配置/纯 Python 图标生成，附 12 项自检 | 上一轮每起一个项目都要手写一遍 main.js，打包的坑（rcedit 抹 NSIS、`ELECTRON_RUN_AS_NODE`、签名失败）也要重踩 |
| 根文档 | `README.md` 加 SOP 第 2/6 条；`规划设计.md` 加 3.1 起手 SOP、3.2 模块现状对照 | 上一轮 AI 把「Electron(web)」读成「浏览器网页」，先做了 web 版又返工 |
