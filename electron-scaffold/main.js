// electron-scaffold · 主进程模板  v1.0.0
//
// 起新项目：复制整个 electron-scaffold 目录 → 改下面 4 个常量 → npm i → npm start
// 已经内置的坑位（别重复踩）：
//   单实例锁 / 无菜单栏 / 窗口位置记忆 / 用户数据目录 / --disable-gpu 开关 /
//   外链拦截 / 内嵌 HTTP 服务端口顺延 / 退出时清理服务
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const srv = require('./server/http-server');

// ============================ 改这里 ============================
const APP_NAME = 'ScaffoldApp';              // 显示名（也用作 %APPDATA% 目录名）
const APP_ID = 'com.example.scaffold';       // AppUserModelId，任务栏分组/通知用
const DEFAULT_PORT = 17650;                  // 内嵌服务起始端口，占用会自动 +1 顺延
const SCHEME_COLOR = '#0f1622';              // 窗口底色，避免白闪
// ================================================================

app.setName(APP_NAME);

// GPU：遇到白屏/黑屏/花屏，用 `npm start -- --disable-gpu` 或环境变量 SCAFFOLD_DISABLE_GPU=1
if (process.argv.includes('--disable-gpu') || process.env.SCAFFOLD_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration();
}
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

let win = null;
let port = 0;

// 用户数据目录：打包后 → %APPDATA%\<APP_NAME>；开发态 → 项目内 .dev-data（不污染真实数据）
function dataDir() {
  if (process.env.SCAFFOLD_DATA_DIR) return path.resolve(process.env.SCAFFOLD_DATA_DIR);
  return app.isPackaged ? app.getPath('userData') : path.join(__dirname, '.dev-data');
}
function ensureDir(d) { try { fs.mkdirSync(d, { recursive: true }); } catch (_) {} return d; }

// 窗口位置/大小记忆
const stateFile = () => path.join(dataDir(), 'window-state.json');
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (_) { return {}; }
}
function saveState(w) {
  if (!w || w.isDestroyed() || w.isMinimized()) return;
  try { fs.writeFileSync(stateFile(), JSON.stringify(w.getNormalBounds())); } catch (_) {}
}

// ---- 单实例：双击第二次只聚焦已有窗口，不开第二个 ----
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });
  app.whenReady().then(bootstrap).catch(err => {
    console.error('[scaffold] 启动失败：', err);
    dialog.showErrorBox('启动失败', String(err && err.message || err));
    app.quit();
  });
}

async function bootstrap() {
  Menu.setApplicationMenu(null);            // 去掉默认菜单栏（File/Edit/View…）
  ensureDir(dataDir());

  try {
    const r = await srv.start({ root: path.join(__dirname, 'renderer'), port: DEFAULT_PORT });
    port = r.port;
    if (r.port !== DEFAULT_PORT) console.log('[scaffold] 端口 ' + DEFAULT_PORT + ' 被占用，已顺延到 ' + r.port);
  } catch (e) {
    console.error('[scaffold] 内嵌服务启动失败：', e.message);
  }
  console.log('[scaffold] 内嵌服务 http://127.0.0.1:' + port + '  数据目录 ' + dataDir());

  createWindow();

  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}

function createWindow() {
  const st = loadState();
  win = new BrowserWindow({
    width: st.width || 1180,
    height: st.height || 780,
    x: st.x, y: st.y,
    minWidth: 900, minHeight: 600,
    show: false,                             // ready-to-show 再显示，消除白屏闪烁
    backgroundColor: SCHEME_COLOR,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,                // 铁律：必须 true
      nodeIntegration: false,                // 铁律：必须 false
      sandbox: false,                        // preload 里要 require('electron') 时置 false
      spellcheck: false,
      additionalArguments: ['--api-port=' + port]   // 把端口传给 preload，页面无需再问一次
    }
  });

  win.once('ready-to-show', () => {
    win.show();
    // 可选自检：SCAFFOLD_SELFTEST=1 npm start → 自动验证窗口/服务/预览/SSE，打印结果后退出
    if (process.env.SCAFFOLD_SELFTEST === '1') setTimeout(() => runSelfTest(win), 900);
  });
  win.on('close', () => saveState(win));
  win.on('closed', () => { win = null; });

  // 安全：站内不许跳外链，window.open 一律交给系统浏览器
  const localOrigin = port ? 'http://127.0.0.1:' + port : '';
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith('file://') || (localOrigin && url.startsWith(localOrigin))) return;
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });

  // 优先走本地 HTTP（避免 file:// 下的跨域限制，SSE/fetch 才能用）；服务没起来再退回 file://
  if (port) {
    win.loadURL('http://127.0.0.1:' + port + '/index.html').catch(() => {
      win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    });
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
}

// --------------------------------------------------------------------------
// IPC：渲染进程只能通过这里访问本机能力
// --------------------------------------------------------------------------
ipcMain.handle('app:info', () => ({
  name: APP_NAME,
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform,
  port,
  dataDir: dataDir(),
  packaged: app.isPackaged
}));

ipcMain.handle('dialog:pick-folder', async (_e, opts = {}) => {
  const r = await dialog.showOpenDialog(win, {
    title: opts.title || '选择文件夹',
    defaultPath: opts.defaultPath || app.getPath('downloads'),
    properties: ['openDirectory', 'createDirectory']
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dialog:pick-file', async (_e, opts = {}) => {
  const r = await dialog.showOpenDialog(win, {
    title: opts.title || '选择文件',
    defaultPath: opts.defaultPath,
    filters: opts.filters,
    properties: ['openFile']
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('shell:open-path', (_e, p) => (p ? shell.openPath(p) : 'empty path'));
ipcMain.handle('shell:show-item', (_e, p) => { if (p) shell.showItemInFolder(p); });
ipcMain.handle('shell:open-external', (_e, url) => { if (/^https?:/i.test(url)) shell.openExternal(url); });

ipcMain.handle('win:minimize', () => win && win.minimize());
ipcMain.handle('win:maximize', () => { if (!win) return false; win.isMaximized() ? win.unmaximize() : win.maximize(); return win.isMaximized(); });
ipcMain.handle('win:close', () => win && win.close());
ipcMain.handle('win:is-maximized', () => !!(win && win.isMaximized()));

// --------------------------------------------------------------------------
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { try { srv.stop(); } catch (_) {} });

// --------------------------------------------------------------------------
// 自检（SCAFFOLD_SELFTEST=1）：验证「服务通、preload 通、页面渲染、预览弹窗、SSE 通」
// 复制脚手架到新项目后，先跑一次这个再改业务，能挡住 90% 的环境类问题。
// --------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runSelfTest(w) {
  const out = [];
  const check = (name, ok, extra) => {
    out.push({ name, ok });
    console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (extra != null ? '   ' + extra : ''));
  };
  const js = code => w.webContents.executeJavaScript(code, true);

  try {
    // 1) 内嵌服务
    const ping = await new Promise(resolve => {
      http.get('http://127.0.0.1:' + port + '/api/ping', res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
      }).on('error', e => resolve('ERR:' + e.message));
    });
    check('内嵌服务 /api/ping 可用', /"ok":true/.test(ping), ping.slice(0, 60));

    // 2) preload 注入
    const info = await js('({ port: window.api.port, base: window.api.base, hasApi: typeof window.api.info === "function" })');
    check('preload 注入端口', info.port === port, String(info.port));
    check('preload 暴露 IPC 方法', info.hasApi === true);
    check('页面 api.base 正确', info.base === 'http://127.0.0.1:' + port, info.base);

    // 3) 页面结构
    const proto = await js('location.protocol');
    check('页面经本地 HTTP 加载（ssE/跨域才可用）', proto === 'http:', proto);
    const blocks = await js('document.querySelectorAll(".card").length');
    check('5 个示例区块渲染', blocks === 5, String(blocks));
    const envRows = await js('document.querySelectorAll("#envList dd").length');
    check('环境自检信息已填充', envRows === 6, String(envRows));

    // 4) 放大预览
    await js('document.querySelectorAll(".shot")[0].click()');
    await sleep(250);
    check('单击缩略图弹出预览', (await js('!!document.querySelector(".lb-mask.lb-open")')) === true);
    w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
    w.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
    await sleep(250);
    check('Esc 关闭预览', (await js('!!document.querySelector(".lb-mask.lb-open")')) === false);

    // 5) SSE
    await sleep(400);
    const sse = await js('document.querySelector("#sseBadge").textContent');
    check('SSE 已连接', /已连接/.test(sse), sse);
    const logCount = await js('document.querySelectorAll("#log li").length');
    check('SSE 收到 ready 事件', logCount >= 1, String(logCount));

    // 6) 静态资源与 Range
    const head = await new Promise(resolve => {
      http.get({ host: '127.0.0.1', port, path: '/lib/theme.css' }, res => {
        res.resume(); resolve(res.statusCode);
      }).on('error', () => resolve(0));
    });
    check('静态资源可访问', head === 200, 'HTTP ' + head);
  } catch (e) {
    check('自检脚本异常：' + e.message, false);
  }

  const failed = out.filter(r => !r.ok);
  console.log('\n自检通过 ' + (out.length - failed.length) + '/' + out.length +
    (failed.length ? '  失败：' + failed.map(f => f.name).join(' / ') : '') + '\n');

  // 可选：把窗口截一张图存下来，方便肉眼复核排版
  if (process.env.SCAFFOLD_SELFTEST_SHOT) {
    try {
      await sleep(300);
      const img = await w.webContents.capturePage();
      fs.writeFileSync(process.env.SCAFFOLD_SELFTEST_SHOT, img.toPNG());
      console.log('截图：' + process.env.SCAFFOLD_SELFTEST_SHOT);
    } catch (e) { console.log('截图失败：' + e.message); }
  }
  app.exit(failed.length ? 1 : 0);
}

