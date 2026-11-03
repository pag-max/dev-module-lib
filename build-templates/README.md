# Build Templates · 打包模板

> 模块库基础件。每次新工具都重配 electron-builder / PyInstaller，太浪费——直接抄这里。

## 文件
- `electron-builder.yml` — Electron 应用打包配置（win/mac/linux、nsis/portable/dmg/AppImage）。
- `pyinstaller_build.py` — Python 打包脚本，**onedir 模式**（免安装、启动快，符合你的打包偏好），先落临时目录再 cp 回，不污染源码。

## 复用约定
- 新项目复制对应模板到项目根，改 `appId` / `productName` / `APP` / `NAME` 即可。
- 图标放 `assets/icon.*`，缺失就删对应 `--icon` 行。
- 前端推荐 PyQt6+Fluent 或 Electron（与你既定偏好一致）。
