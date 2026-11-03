# UI Kit · 页面组件库

**定位**：一套由你亲自定稿的 Electron(web) 页面组件与主题，是根治「UI 不如意」的抓手。AI 改业务时只**复制**组件，不改其样式与交互行为。

## 技术栈
- 纯原生 HTML / CSS / JS（vanilla），**不引入框架**，与你现有 `page.html` 项目一致。
- 设计灵感：Fluent（圆角、柔和阴影、蓝色强调、深浅色自适应）。

## 目录
- `theme.css` —— 设计令牌（颜色/间距/圆角/阴影）+ 全部组件样式，**单文件便于审阅与复制**。
- `demo/index.html` —— 组件展示页，**你在此评价审美**。
- `demo/app.js` —— 交互演示（主题切换 / 对话框 / Toast / Tabs / 拖拽排序 / 双击）。
- `配色方案.md` —— **分类数据配色规范与全部色值记录**（二元/三元/四元 5 套方案 + 语义状态色，含实算对比度）。
- `tools/palette_check.py` —— 配色对比度复算脚本，改色后重跑验证。

## 组件清单
按钮 · 卡片与卡片列表 · 数据表格 · 表单（输入/下拉/开关/滑块/日期）· 进度条与环形进度 · 对话框 · Toast · Tabs · 徽标 · 侧边栏布局 · 工具栏 · 空状态 · **日历/日期选择器** · **图片查看器/画廊** · **Markdown 编辑器（带预览）** · **高级数据表格（分页+排序+筛选+列显隐）**。

**业务模块 UI 模板**（在 `demo/index.html` 中展示，供评价）：
- 下载队列：任务行含缩略、文件名、来源、状态徽标、内嵌进度条、速度/大小；左侧**拖拽手柄**调顺序（已移除上移/下移箭头），操作按钮仅保留暂停·继续 / 移除。
- 记录本列表/编辑页（RecordBook）：可**拖拽左侧手柄排序**的列表 + 搜索 + 新增/编辑弹窗（按 schema 动态生成表单）+ 导入导出 + 多选批量操作栏；**每条记录可挂不限数量的链接**（本地路径 / 网址，点击即打开：网址 `window.open`、本地路径走 Electron `shell.openPath`）。
- 设置页（Config Store）：分组导航 + 分组卡片表单，低利害自动保存、高利害才确认。
- 登录/网关页（Auth Gateway）：居中卡片 + 错误 Alert + 登录态徽标/登出。
- 下载详情抽屉：侧滑抽屉含分片进度 + 实时日志（级别过滤）。
- 数据看板（Dashboard）：统计卡 + 纯 CSS 条形图。
- 命令面板（Cmd+K）：分组结果、模糊高亮、快捷键提示、键盘导航。
- 空状态/首跑引导：命名缺失→解释价值→指向第一步 + 激活清单。
- 窗口标题栏：Frameless + drag region + 窗口控制按钮（Electron 原生感）。
- **配色方案（Categorical Palette）**：`demo/index.html` 的「配色方案」板块。**实时计算**每个色在浅/深底的 WCAG 对比度并标红（<3:1），给出二元/三元/四元在浅底与深底两套选色 + 4 类示例柱状图。规范见 `配色方案.md`。
- **日历 / 日期选择器**：月份网格，点选日期、高亮今天、跨月灰显；可嵌入选日期场景（备考计划、待办、记账本）。
- **图片查看器 / 画廊**：主图预览 + 缩略图条 + 翻页 / 缩放（演示用内嵌 SVG，离线可用）；画图板、动漫封面场景。
- **Markdown 编辑器**：左编辑右实时预览，工具栏快捷插入标题/加粗/斜体/列表/代码/链接；笔记类工具通用。
- **高级数据表格**：表头点击排序、搜索过滤、分页、列显隐菜单；可直接替换现有记录本的简单表格。

## 独立组件（`components/`，可直接复制进项目）

### 放大预览 Lightbox v1.0.0
`components/lightbox.css` + `components/lightbox.js`，零依赖，demo 在 `demo/lightbox.html`。

```html
<link rel="stylesheet" href="lib/lightbox.css">
<script src="lib/lightbox.js"></script>
<script>
  MediaLightbox.open({
    items: [
      { src: 'https://x/a.png', title: '标题', meta: '3840×2160 · 2.6MB' },
      { src: 'https://x/b.mp4', type: 'video', title: '视频', thumb: 'https://x/b.jpg' }
    ],
    index: 0,
    onDownload: (item, i) => {},     // 可选：右下角“下载”按钮
    onIndexChange: (i) => {}         // 可选：翻页回调
  });
  MediaLightbox.close();
</script>
```

能力：图片/视频弹窗放大、←/→ 翻页、滚轮缩放（图片）、拖动平移、双击 1:1、Esc 关闭、底部缩略条、加载中/失败提示。
接口：`open(opts)` / `close()` / `next()` / `prev()` / `index` / `isOpen`。

三条固化的坑（改组件时别破坏）：
1. 遮罩用**纯色**，不用 `backdrop-filter` —— Electron `--disable-gpu` 下会露出桌面。
2. 切换媒体前必须 `pause()` + `removeAttribute('src')`，否则视频句柄不释放、切图后还在后台播。
3. 键盘监听 `open` 时绑、`close` 时解，避免二次打开重复绑定、或吃掉页面其它输入框的 Esc。

## 手势约定（铁律，写入记忆）
- **双击 = 双击**（如卡片双击进入详情/编辑），不替换为单击。
- **拖动 = 拖动**（如列表拖拽排序、拖拽上传），不篡改为点击按钮。
- **右键 = 右键菜单**。
- AI 不得对这些交互「自作主张优化」。

## 运行
- 浏览器直接打开 `demo/index.html` 预览。
- Electron 项目中：把 `page.html` 改为引用 `theme.css` 的页面即可套用。

## 主题
根元素 `data-theme="light" | "dark"`，令牌集中在 `:root` 与 `[data-theme="dark"]`。切换由 `app.js` 演示。
