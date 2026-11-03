// RecordBook · Electron 主进程
// 直接复用 ui-kit 的 theme.css，本文件只负责窗口 + 本地文件持久化 + 打开链接。
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

const DATA_FILE = path.join(app.getPath('userData'), 'records.json');

function createWindow() {
  const win = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 860,
    minHeight: 560,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#ffffff', symbolColor: '#1f1f1f' },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('page.html');
}

// 持久化：renderer 调用，把记录数组写入 userData/records.json
ipcMain.handle('rb-save', async (_e, records) => {
  const fs = require('fs');
  fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf8');
  return true;
});

// 持久化：启动时读取
ipcMain.handle('rb-load', async () => {
  const fs = require('fs');
  if (!fs.existsSync(DATA_FILE)) return null;
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
});

// 打开链接：网址 -> 默认浏览器；本地路径 -> 系统打开
ipcMain.handle('rb-open-link', async (_e, link) => {
  if (!link) return false;
  try {
    if (/^https?:\/\//i.test(link)) {
      await shell.openExternal(link);
    } else {
      await shell.openPath(link);
    }
    return true;
  } catch (err) {
    return { error: String(err) };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
