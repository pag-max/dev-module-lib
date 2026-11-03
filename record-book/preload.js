// RecordBook · preload（contextIsolation 安全桥）
// 仅暴露最小 API 给渲染进程。在浏览器直接打开 page.html 时这些函数不存在，
// renderer 会自动降级为 localStorage + window.open，无需改动。
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rb', {
  save: (records) => ipcRenderer.invoke('rb-save', records),
  load: () => ipcRenderer.invoke('rb-load'),
  openLink: (link) => ipcRenderer.invoke('rb-open-link', link)
});
