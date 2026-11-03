// electron-scaffold · 内嵌本地 HTTP 服务
//
// 解决三件事：① 端口被占用自动顺延　② 静态资源服务　③ SSE 实时推送 + 跨域资源代理
//
// 用法（main.js）：
//   const srv = require('./server/http-server');
//   const { port } = await srv.start({ root: path.join(__dirname, 'renderer'), port: 17650 });
//   srv.broadcast('progress', { percent: 42 });     // 推给所有已连接的页面
//   srv.stop();
//
// 页面里：
//   const es = new EventSource('http://127.0.0.1:' + window.api.port + '/api/events');
//   es.addEventListener('progress', e => console.log(JSON.parse(e.data)));
//
// 为什么不做成 file:// 直接 fetch：
//   1) 防盗链资源必须服务端补 Referer，浏览器端加不了
//   2) SSE / 进度推送需要长连接，file:// 下没有同源策略可用
//   3) 大文件预览要转发 Range，file:// 干不了
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json'
};

let server = null;
let rootDir = process.cwd();
let clients = new Set();
let heartbeat = null;
let _port = 0;

// 仅监听 127.0.0.1，跨域头放开是安全的；页面若以 file:// 加载也才能连上 SSE
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
};

// --------------------------------------------------------------------------
// 对外：启动 / 停止 / 推送
// --------------------------------------------------------------------------
function start({ root, port = 17650, host = '127.0.0.1', tries = 20 } = {}) {
  rootDir = path.resolve(root || rootDir);
  // 重复调用直接返回已有实例，避免同名进程占两个端口
  if (server) return Promise.resolve({ port: _port, host, root: rootDir });
  return new Promise((resolve, reject) => {
    const attempt = (p, left) => {
      const s = http.createServer(handle);
      s.once('error', err => {
        try { s.close(); } catch (_) {}
        if (err.code === 'EADDRINUSE' && left > 0) return attempt(p + 1, left - 1);
        reject(err);
      });
      s.listen(p, host, () => {
        server = s;
        _port = p;
        heartbeat = setInterval(() => {
          for (const c of clients) { try { c.write(': ping\n\n'); } catch (_) {} }
        }, 25000);
        heartbeat.unref && heartbeat.unref();
        resolve({ port: p, host, root: rootDir });
      });
    };
    attempt(port, tries);
  });
}

function stop() {
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  for (const c of clients) { try { c.end(); } catch (_) {} }
  clients.clear();
  if (server) { try { server.close(); } catch (_) {} server = null; }
}

function broadcast(event, data) {
  const payload = 'event: ' + event + '\ndata: ' + JSON.stringify(data == null ? {} : data) + '\n\n';
  for (const c of clients) { try { c.write(payload); } catch (_) {} }
}

// --------------------------------------------------------------------------
// 路由
// --------------------------------------------------------------------------
function handle(req, res) {
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = decodeURIComponent(u.pathname);

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (p === '/api/ping') return json(res, { ok: true, port: _port, pid: process.pid });
  if (p === '/api/events') return sse(req, res);
  if (p === '/api/proxy') return proxy(u, req, res);
  return serveStatic(p, req, res);
}

function json(res, obj, code = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...CORS
  });
  res.end(body);
}

function sse(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
    ...CORS
  });
  res.write('retry: 3000\n\n');
  clients.add(res);
  // 连上先发一条 ready，页面可据此判断“服务通、SSE 通”
  try { res.write('event: ready\ndata: ' + JSON.stringify({ port: _port, ts: Date.now() }) + '\n\n'); } catch (_) {}
  req.on('close', () => clients.delete(res));
}

// 静态资源（含目录穿越防护）
function serveStatic(p, req, res) {
  let file = path.join(rootDir, p === '/' ? 'index.html' : p);
  const rel = path.relative(rootDir, file);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return json(res, { error: 'forbidden' }, 403);

  fs.stat(file, (err, st) => {
    if (!err && st.isDirectory()) file = path.join(file, 'index.html');
    fs.stat(file, (err2, st2) => {
      if (err2 || !st2.isFile()) return json(res, { error: 'not found', path: p }, 404);
      const ext = path.extname(file).toLowerCase();
      const type = MIME[ext] || 'application/octet-stream';
      const noCache = /\.(html|js|css)$/.test(ext);
      const head = {
        'content-type': type,
        'content-length': st2.size,
        'cache-control': noCache ? 'no-store' : 'max-age=3600',
        'accept-ranges': 'bytes'
      };
      // Range 支持：音视频预览拖动进度必需
      const range = req.headers.range;
      if (range && /^bytes=/.test(range)) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        let start = m[1] ? parseInt(m[1], 10) : 0;
        let end = m[2] ? parseInt(m[2], 10) : st2.size - 1;
        if (isNaN(start) || start >= st2.size) {
          res.writeHead(416, { 'content-range': 'bytes */' + st2.size });
          return res.end();
        }
        end = Math.min(end, st2.size - 1);
        res.writeHead(206, { ...head, 'content-length': end - start + 1, 'content-range': 'bytes ' + start + '-' + end + '/' + st2.size });
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, head);
      fs.createReadStream(file).pipe(res);
    });
  });
}

// 跨域资源代理：补 Referer/UA，转发 Range，错误码原样透传
//   /api/proxy?url=<encodeURIComponent>&referer=<encodeURIComponent>
function proxy(u, req, res) {
  const target = u.searchParams.get('url');
  if (!target || !/^https?:/i.test(target)) return json(res, { error: 'bad url' }, 400);
  const referer = u.searchParams.get('referer') || '';
  const headers = { 'user-agent': req.headers['user-agent'] || 'Mozilla/5.0', accept: '*/*' };
  if (referer) headers.referer = referer;
  if (req.headers.range) headers.range = req.headers.range;

  const go = (url, left) => {
    let t;
    try { t = new URL(url); } catch (e) { return json(res, { error: 'bad url' }, 400); }
    const lib = t.protocol === 'https:' ? https : http;
    const r = lib.request(t, { method: 'GET', headers }, up => {
      const code = up.statusCode || 0;
      if (code >= 300 && code < 400 && up.headers.location && left > 0) {
        up.resume();
        return go(new URL(up.headers.location, t).href, left - 1);
      }
      if (code >= 400) {
        up.resume();
        return json(res, { error: 'upstream ' + code, url }, 502);
      }
      const pass = {};
      ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']
        .forEach(k => { if (up.headers[k]) pass[k] = up.headers[k]; });
      pass['cache-control'] = 'max-age=3600';
      res.writeHead(code === 206 ? 206 : 200, pass);
      up.pipe(res);
    });
    r.setTimeout(30000, () => r.destroy(new Error('timeout')));
    r.on('error', e => { if (!res.headersSent) json(res, { error: String(e.message) }, 502); else res.end(); });
    r.end();
  };
  go(target, 5);
}

module.exports = { start, stop, broadcast, get port() { return _port; } };
