# RecordBook · 记录本核心模块

> 来自「开发模块库」的第一个**真实可运行组件**。schema 驱动：一份字段配置即可生成一个本子，
> 内置增删改查、拖拽排序、搜索过滤、多选批量、不限数量链接、导入导出。
> **直接复用 `../ui-kit/theme.css`** —— 这是模块库价值的证明：UI 一次定稿，处处套用，AI 不得改手势与配色。

## 适用场景
备考记录本 / 娱乐记录本 / 自定义记录本 / 记账 / 待办日历 / 番剧漫画记录 / 米哈游养成记录 ……
你那 7 个「记录本家族」项目，本模块一次成型，新工具只配字段。

## 怎么跑
- **Electron（推荐，可直开本地路径）**：`npm install` → `npm start`
- **浏览器预览**：直接双击 `page.html`，用 `localStorage` 存储（打开本地路径会弹 Toast 提示，Electron 下才真打开）

## 文件
- `main.js` — Electron 主进程：窗口（frameless 标题栏）、`userData/records.json` 持久化、`shell.openPath/openExternal` 打开链接
- `preload.js` — 安全桥，暴露 `window.rb.{save,load,openLink}`
- `page.html` — 界面，引用 `../ui-kit/theme.css`
- `app.js` — 渲染逻辑（schema 驱动、拖拽、链接、批量、导入导出）

## schema（当前默认字段）
| 字段 | 说明 |
|---|---|
| name | 名称（必填） |
| cat | 分类 |
| status | 状态：进行中 / 待办 / 已完成（徽标配色见 ui-kit） |
| note | 备注 |
| links | 链接数组，不限数量，每项 {label, url}；`http(s)://` 走网址(蓝 chip)，其余走本地路径(橙 chip)，点击即打开 |
| date | 更新日期（自动） |

要换字段，改 `app.js` 的 `seed()` 与编辑弹窗表单即可；列表卡片用 `card()` 渲染。

## 已固化交互（AI 不得改）
- 双击无（此处用「编辑」按钮）；**拖动 `⋮⋮` 手柄 = 排序**
- 链接 chip 点击 = 打开对应网址/本地路径；`✕` = 删除
- 勾选行 = 出现底部批量操作栏（标记完成 / 删除）
- 状态徽标配色与配色方案.md 一致

## 复用约定
新项目需要「记录本」时，复制本目录或 `import` 其逻辑，**不要重写**。UI 改样式只改 `ui-kit/theme.css`。
