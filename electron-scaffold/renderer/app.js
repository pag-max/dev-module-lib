// electron-scaffold · 页面逻辑（示例：环境自检 / 选目录 / 放大预览 / SSE / 代理）
// 依赖 preload 暴露的 window.api，不直接使用 require / fs / node 模块。

const $ = s => document.querySelector(s);

// ---------------------------------------------------------------- 环境自检
async function fillEnv() {
  const info = await window.api.info();
  $('#appName').textContent = info.name;
  $('#appSub').textContent = info.packaged ? '打包运行 · v' + info.version : '开发态 · v' + info.version;
  const rows = [
    ['Electron', info.electron],
    ['Chromium', info.chrome],
    ['Node', info.node],
    ['内嵌服务端口', info.port || '（启动失败）'],
    ['数据目录', info.dataDir],
    ['运行模式', info.packaged ? '已打包' : '开发态（写入项目 .dev-data）']
  ];
  $('#envList').innerHTML = rows.map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('');
  const ok = !!info.port;
  const b = $('#srvBadge');
  b.textContent = ok ? '服务 ' + info.port : '服务未起';
  b.classList.toggle('bad', !ok);
  return info;
}

$('#btnReload').addEventListener('click', fillEnv);
$('#btnDataDir').addEventListener('click', async () => {
  const info = await window.api.info();
  await window.api.openPath(info.dataDir);
});

// ---------------------------------------------------------------- 选目录
let pickedDir = '';
function syncDir() {
  $('#dirPath').value = pickedDir;
  $('#btnOpenDir').disabled = !pickedDir;
}
$('#btnPick').addEventListener('click', async () => {
  const dir = await window.api.pickFolder({ title: '选择下载/导出目录', defaultPath: pickedDir || undefined });
  if (!dir) return;
  pickedDir = dir;
  syncDir();
});

$('#btnOpenDir').addEventListener('click', () => { if (pickedDir) window.api.openPath(pickedDir); });

// ---------------------------------------------------------------- 放大预览
function art(c1, c2, label, n) {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800">'
    + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/>'
    + '<stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>'
    + '<rect width="1280" height="800" fill="url(#g)"/>'
    + '<circle cx="1030" cy="190" r="150" fill="rgba(255,255,255,.12)"/>'
    + '<text x="64" y="680" font-family="Microsoft YaHei" font-size="76" fill="rgba(255,255,255,.92)">' + label + '</text>'
    + '<text x="66" y="732" font-family="Segoe UI" font-size="28" fill="rgba(255,255,255,.55)">1280 × 800 · ' + n + '</text></svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const shots = [
  { src: art('#12325c', '#3b82f6', '示例一', 'scaffold'), title: '示例一 · 冷色渐变', meta: '1280×800 · SVG' },
  { src: art('#5b1d1d', '#f97316', '示例二', 'scaffold'), title: '示例二 · 暖色渐变', meta: '1280×800 · SVG' },
  { src: art('#0b3d2e', '#22c55e', '示例三', 'scaffold'), title: '示例三 · 绿调渐变', meta: '1280×800 · SVG' }
];

const grid = $('#grid');
shots.forEach((it, i) => {
  const d = document.createElement('div');
  d.className = 'shot';
  d.innerHTML = '<img src="' + it.src + '" alt=""><div class="cap">' + it.title + '</div>';
  d.addEventListener('click', () => MediaLightbox.open({ items: shots, index: i }));
  grid.appendChild(d);
});

// ---------------------------------------------------------------- SSE
let es = null;
function logLine(tag, text) {
  const li = document.createElement('li');
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  li.innerHTML = t + '　<b>' + tag + '</b>　' + text;
  const log = $('#log');
  log.insertBefore(li, log.firstChild);
  while (log.children.length > 40) log.removeChild(log.lastChild);
}

function connectSSE() {
  if (es) { try { es.close(); } catch (_) {} }
  const badge = $('#sseBadge');
  if (!window.api.sseUrl) { badge.textContent = '无服务'; badge.classList.add('bad'); return; }
  // 必须由页面自己 new EventSource：preload 里造好再传出来，contextBridge 传不了原生对象
  es = new EventSource(window.api.sseUrl);
  es.onopen = () => { badge.textContent = '已连接'; badge.classList.remove('bad'); logLine('open', 'SSE 通道建立'); };
  es.onerror = () => { badge.textContent = '断开（自动重连）'; badge.classList.add('bad'); };
  es.addEventListener('ready', e => logLine('ready', e.data));
  // 自定义事件示例：主进程 srv.broadcast('progress', {...}) 会到这里
  es.addEventListener('progress', e => logLine('progress', e.data));
}
$('#btnReconnect').addEventListener('click', connectSSE);

// ---------------------------------------------------------------- 代理
$('#btnProxy').addEventListener('click', () => {
  const url = $('#proxyUrl').value.trim();
  const ref = $('#proxyRef').value.trim();
  const out = $('#proxyOut');
  if (!/^https?:/i.test(url)) { out.innerHTML = '<span class="muted">请先填一个 http(s) 图片直链</span>'; return; }
  const q = window.api.base + '/api/proxy?url=' + encodeURIComponent(url)
    + (ref ? '&referer=' + encodeURIComponent(ref) : '');
  out.innerHTML = '<span class="muted">加载中…</span>';
  const img = new Image();
  img.onload = () => { out.innerHTML = ''; out.appendChild(img); logLine('proxy', '加载成功 ' + img.naturalWidth + '×' + img.naturalHeight); };
  img.onerror = () => { out.innerHTML = '<span class="muted">加载失败（可能 403 / 链接失效，看服务端日志）</span>'; logLine('proxy', '加载失败'); };
  img.src = q;
});

// ---------------------------------------------------------------- 启动
fillEnv().then(syncDir).catch(e => logLine('error', String(e && e.message || e)));
connectSSE();
