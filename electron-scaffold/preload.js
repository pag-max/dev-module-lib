// electron-scaffold · preload 模板
//
// 只做两件事：① 把主进程端口/版本等信息安全地递进来 ② 把需要的本机能力挂成 window.api
// 铁律：contextIsolation:true + nodeIntegration:false 下，渲染进程拿不到 require / fs，
//       一切本机操作都必须由这里 ipcRenderer.invoke 转给主进程，不要图省事开 nodeIntegration。
const { contextBridge, ipcRenderer } = require('electron');

// main.js 通过 additionalArguments 注入：--api-port=17650
const portArg = process.argv.find(a => a.startsWith('--api-port='));
const apiPort = portArg ? Number(portArg.split('=')[1]) : 0;

contextBridge.exposeInMainWorld('api', {
  // 内嵌 HTTP 服务：页面里用 `${api.base}/api/...`
  port: apiPort,
  base: apiPort ? 'http://127.0.0.1:' + apiPort : '',

  // 环境信息
  info: () => ipcRenderer.invoke('app:info'),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node
  },

  // 对话框
  pickFolder: (opts) => ipcRenderer.invoke('dialog:pick-folder', opts),
  pickFile: (opts) => ipcRenderer.invoke('dialog:pick-file', opts),

  // 系统壳
  openPath: (p) => ipcRenderer.invoke('shell:open-path', p),
  showItem: (p) => ipcRenderer.invoke('shell:show-item', p),
  openExternal: (url) => ipcRenderer.invoke('shell:open-external', url),

  // 窗口控制（自绘标题栏时才需要）
  win: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    maximize: () => ipcRenderer.invoke('win:maximize'),
    close: () => ipcRenderer.invoke('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:is-maximized')
  },

  // SSE 事件通道地址。注意：不要在这里 new EventSource 再 return 出来——
  // contextBridge 只能传原始值/纯对象/函数，EventSource 这类带原生句柄的对象过不去，
  // 拿到的会是 undefined 或空壳，表现为「连接一直未建立」。
  // 正确用法（渲染进程里）：new EventSource(window.api.sseUrl)
  sseUrl: apiPort ? 'http://127.0.0.1:' + apiPort + '/api/events' : ''
});
