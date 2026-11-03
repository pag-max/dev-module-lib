// Download Engine · 多线程分片下载引擎  v1.1.0
//
// 用法：
//   const eng = new DownloadEngine({ threads: 4, retries: 3, shaCheck: false });
//   eng.on('progress', e => ui.updateRow(e));      // {id,downloaded,total,percent,speed}
//   eng.add({ url, dest, sha256?, headers?, id? });
//
// 特性：HTTP Range 分片并行、断点续传（真续传，已完成分片不重下）、指数退避重试、
//      完整性校验（大小 + 可选 sha256）、m3u8 合并（依赖 media-wrap）。
//
// v1.1.0 变更（2026-11-02，Nova 壁纸下载器实战后回写）：
//   1) 全流程流式写盘，不再整文件进内存（原实现在 300MB+ 文件上会吃等量内存）
//   2) 跟随 301/302/307 重定向（CDN / OSS 常见），最多 5 跳
//   3) 支持自定义请求头 headers（绕过 Referer 防盗链、带 Cookie/UA 等）
//   4) HEAD 不被支持时自动降级为 GET Range:0-0 探测总长度
//   5) 进度事件节流 150ms，大文件不再刷爆 UI/SSE
//   6) 分片数按文件大小收敛（小文件不乱开并发），分片数上限 = threads
//   7) resume 真续传：已完成分片直接跳过，只补未完成分片
//   8) remove / 失败时清理临时分片，不残留 os.tmpdir
//
// 历史 bug 修复（v1.0.1，勿回退）：
//   - 合并分片必须等 write stream 'finish' 再返回，否则 _verify 读到未落盘文件误报“大小不符”
//   - resume() 必须清零 downloaded/chunks，否则进度累加、分片重复
//   - 分片落 os.tmpdir()/dl-engine-parts，删除用 fs.rmSync(force) 并 try-catch
//     （部分环境 unlinkSync 被劫持到回收站，会卡住或超时）
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { URL } = require('url');
const { pipeline } = require('stream/promises');

const VERSION = '1.1.0';
const MAX_REDIRECT = 5;
const PROGRESS_INTERVAL = 150;   // ms，进度事件节流
const MIN_CHUNK = 256 * 1024;    // 单分片最小 256KB
const PART_ROOT = path.join(os.tmpdir(), 'dl-engine-parts');

// ---------------------------------------------------------------------------
// 底层请求：跟随重定向 + 超时 + 自定义头
// 返回 { res, finalUrl }，调用方自己消费 res 流
// ---------------------------------------------------------------------------
function request(url, { method = 'GET', headers = {}, timeout = 30000 } = {}, left = MAX_REDIRECT) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(new Error('URL 非法: ' + url)); }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method, headers }, res => {
      const code = res.statusCode || 0;
      if (code >= 300 && code < 400 && res.headers.location) {
        res.resume();
        if (left <= 0) return reject(new Error('重定向次数超限'));
        const next = new URL(res.headers.location, u).href;
        request(next, { method, headers, timeout }, left - 1).then(resolve, reject);
        return;
      }
      if (code >= 400) { res.resume(); return reject(new Error('HTTP ' + code)); }
      resolve({ res, finalUrl: u.href });
    });
    req.setTimeout(timeout, () => req.destroy(new Error('请求超时 ' + timeout + 'ms')));
    req.on('error', reject);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// 探测文件大小与是否支持 Range；HEAD 不可用时降级 GET bytes=0-0
// ---------------------------------------------------------------------------
async function probe(url, headers = {}) {
  try {
    const { res } = await request(url, { method: 'HEAD', headers });
    const len = parseInt(res.headers['content-length'] || '0', 10);
    const accept = String(res.headers['accept-ranges'] || '').includes('bytes');
    res.resume();
    if (len > 0) return { total: len, accept };
  } catch (_) { /* 落到下面的降级探测 */ }

  const { res } = await request(url, { headers: { ...headers, Range: 'bytes=0-0' } });
  const cr = String(res.headers['content-range'] || '');       // bytes 0-0/12345
  const m = cr.match(/\/(\d+)/);
  const total = m ? parseInt(m[1], 10) : parseInt(res.headers['content-length'] || '0', 10);
  res.resume();
  return { total, accept: res.statusCode === 206 && !!m };
}

// ---------------------------------------------------------------------------
// 把一段字节流写进文件；返回实际字节数
// ---------------------------------------------------------------------------
async function fetchToFile(url, dest, { start, end, headers = {}, signal, onBytes } = {}) {
  const h = { ...headers };
  if (start != null && end != null) h.Range = 'bytes=' + start + '-' + end;
  const { res } = await request(url, { headers: h });
  if (signal?.aborted) { res.destroy(); throw new Error('aborted'); }
  const ws = fs.createWriteStream(dest);
  let bytes = 0;
  res.on('data', c => { bytes += c.length; if (onBytes) onBytes(c.length); });
  if (signal) {
    const onAbort = () => res.destroy(new Error('aborted'));
    signal.addEventListener('abort', onAbort, { once: true });
    try { await pipeline(res, ws); }
    finally { signal.removeEventListener('abort', onAbort); }
  } else {
    await pipeline(res, ws);
  }
  return bytes;
}

class DownloadEngine extends EventEmitter {
  constructor({ threads = 4, retries = 3, shaCheck = false, timeout = 30000 } = {}) {
    super();
    this.threads = Math.max(1, threads);
    this.retries = retries;
    this.shaCheck = shaCheck;
    this.timeout = timeout;
    this.tasks = new Map();
    this._seq = 0;
  }

  add(task) {
    const id = task.id || ('dl' + (++this._seq));
    const t = {
      id, url: task.url, dest: task.dest,
      headers: task.headers || {},                 // 例：{ Referer: 'https://a.com/' }
      sha256: task.sha256 || null,
      status: 'queued', total: 0, downloaded: 0,
      chunks: [], controllers: [], _t0: 0, _lastEmit: 0, _doneBytes: 0
    };
    this.tasks.set(id, t);
    this.emit('added', { id, url: t.url, dest: t.dest });
    this._run(t);
    return id;
  }

  async _run(t) {
    try {
      const meta = await probe(t.url, t.headers);
      if (!meta.total) throw new Error('无法获取文件大小');
      t.total = meta.total;
      if (!meta.accept) await this._single(t);
      else await this._chunked(t);
      await this._verify(t);
      this._cleanParts(t);
      t.status = 'done';
      this._emitProgress(t, true);
      this.emit('done', { id: t.id, dest: t.dest, bytes: t.total });
    } catch (e) {
      if (t.status === 'paused' || t.status === 'removed') return;   // 主动操作，不算失败
      t.status = 'error';
      this._cleanParts(t);
      this.emit('error', { id: t.id, error: String(e.message || e) });
    }
  }

  // 单流（不支持 Range）
  async _single(t) {
    t.status = 'downloading'; t._t0 = Date.now(); t.downloaded = 0;
    try { fs.mkdirSync(path.dirname(t.dest), { recursive: true }); } catch (_) {}
    const bytes = await fetchToFile(t.url, t.dest, {
      headers: t.headers,
      signal: this._addCtrl(t, 0),
      onBytes: n => { t.downloaded += n; this._emitProgress(t); }
    });
    t.total = t.total || bytes;
  }

  // 分片并行
  async _chunked(t) {
    const count = Math.max(1, Math.min(this.threads, Math.ceil(t.total / MIN_CHUNK) || 1));
    // 首次进入才建分片表；resume 时复用，保留已完成分片
    if (!t.chunks.length) {
      try { fs.mkdirSync(PART_ROOT, { recursive: true }); } catch (_) {}
      const tag = crypto.createHash('md5').update(t.dest).digest('hex').slice(0, 12);
      const chunkSize = Math.ceil(t.total / count);
      for (let i = 0; i < count; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize - 1, t.total - 1);
        t.chunks.push({
          idx: i, start, end, expect: end - start + 1, done: false,
          file: path.join(PART_ROOT, tag + '.part' + i)
        });
      }
    }
    t.status = 'downloading';
    t._t0 = t._t0 || Date.now();
    // 已完成分片计入 downloaded（真续传的关键）；未完成分片从 0 计数
    for (const c of t.chunks) if (!c.done) c.bytes = 0;
    this._recount(t);
    this._emitProgress(t, true);

    const pending = t.chunks.filter(c => !c.done);
    await Promise.all(pending.map(c => this._downloadChunk(t, c)));
    if (t.status === 'paused' || t.status === 'removed') return;

    // 顺序合并：流式 pipe，逐片删除，不整块读进内存
    try { fs.mkdirSync(path.dirname(t.dest), { recursive: true }); } catch (_) {}
    const ws = fs.createWriteStream(t.dest);
    const wsErr = new Promise((_, rej) => ws.on('error', rej));
    for (const c of t.chunks) {
      await Promise.race([
        new Promise((res, rej) => {
          const rs = fs.createReadStream(c.file);
          rs.on('error', rej);
          rs.on('end', res);
          rs.pipe(ws, { end: false });
        }),
        wsErr
      ]);
      try { fs.rmSync(c.file, { force: true }); } catch (_) {}
    }
    // 必须等 flush 完再返回，否则 _verify 读到半截文件
    await new Promise((res, rej) => { ws.on('error', rej); ws.on('finish', res); ws.end(); });
  }

  _recount(t) {
    let n = 0;
    for (const c of t.chunks) n += c.done ? c.expect : (c.bytes || 0);
    t.downloaded = n;
  }

  async _downloadChunk(t, c) {
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      if (t.status === 'paused' || t.status === 'removed') return;
      c.bytes = 0;                                  // 每次重试重新计数，避免进度虚高
      try {
        const bytes = await fetchToFile(t.url, c.file, {
          start: c.start, end: c.end, headers: t.headers,
          signal: this._addCtrl(t, c.idx),
          onBytes: n => { c.bytes += n; this._recount(t); this._emitProgress(t); }
        });
        if (bytes !== c.expect) throw new Error('分片大小不符 ' + bytes + '≠' + c.expect);
        c.done = true;
        this._recount(t);
        return;
      } catch (e) {
        if (t.status === 'paused' || t.status === 'removed') return;
        if (attempt === this.retries) throw e;
        await new Promise(r => setTimeout(r, 2 ** attempt * 300));
      }
    }
  }

  _addCtrl(t, idx) {
    const ctrl = new AbortController();
    t.controllers[idx] = ctrl;
    return ctrl.signal;
  }

  async _verify(t) {
    const stat = fs.statSync(t.dest);
    if (t.total && stat.size !== t.total) throw new Error('大小不符：' + stat.size + '≠' + t.total);
    if (this.shaCheck && t.sha256) {
      const h = crypto.createHash('sha256');
      await new Promise((res, rej) => {
        const rs = fs.createReadStream(t.dest);
        rs.on('data', c => h.update(c));
        rs.on('end', res);
        rs.on('error', rej);
      });
      if (h.digest('hex') !== t.sha256) throw new Error('sha256 校验失败');
    }
  }

  _emitProgress(t, force) {
    const now = Date.now();
    if (!force && now - t._lastEmit < PROGRESS_INTERVAL) return;
    t._lastEmit = now;
    const ms = Math.max(1, now - (t._t0 || now));
    this.emit('progress', {
      id: t.id, downloaded: t.downloaded, total: t.total,
      percent: t.total ? Math.min(100, Math.round((t.downloaded / t.total) * 100)) : 0,
      speed: Math.round((t.downloaded / ms) * 1000)
    });
  }

  _cleanParts(t) {
    for (const c of t.chunks) {
      try { fs.rmSync(c.file, { force: true }); } catch (_) {}
    }
  }

  pause(id) {
    const t = this.tasks.get(id); if (!t || t.status === 'done') return;
    t.status = 'paused';
    t.controllers.forEach(c => c && c.abort());
    this.emit('paused', { id });
  }

  // 真续传：已完成分片保留，只补未完成分片
  resume(id) {
    const t = this.tasks.get(id);
    if (!t || t.status !== 'paused') return;
    t.status = 'queued';
    t.controllers = [];
    t.downloaded = t.chunks.filter(c => c.done).reduce((s, c) => s + c.expect, 0);
    this._run(t);
  }

  remove(id) {
    const t = this.tasks.get(id); if (!t) return;
    t.status = 'removed';
    t.controllers.forEach(c => c && c.abort());
    t.controllers = [];
    this._cleanParts(t);
    this.tasks.delete(id);
    this.emit('removed', { id });
  }

  // m3u8：抓 playlist → 下 ts → 合并（依赖 media-wrap）
  async downloadM3u8(playlistUrl, dest, { threads = 4, tmpDir, headers = {} } = {}) {
    const base = new URL(playlistUrl);
    const { res } = await request(playlistUrl, { headers });
    let txt = '';
    await new Promise((resolve, reject) => {
      res.setEncoding('utf8');
      res.on('data', c => { txt += c; });
      res.on('end', resolve);
      res.on('error', reject);
    });
    const segs = txt.split('\n').map(l => l.trim())
      .filter(l => l && !l.startsWith('#')).map(l => new URL(l, base).href);
    if (!segs.length) throw new Error('playlist 内没有分片');
    tmpDir = tmpDir || dest + '.tsdir';
    fs.mkdirSync(tmpDir, { recursive: true });
    const files = segs.map((u, i) => path.join(tmpDir, String(i).padStart(5, '0') + '.ts'));
    for (let i = 0; i < segs.length; i += threads) {
      await Promise.all(segs.slice(i, i + threads).map((u, k) =>
        fetchToFile(u, files[i + k], { headers }).catch(e => { throw new Error('分片 ' + (i + k) + ' 失败：' + e.message); })
      ));
      const n = Math.min(i + threads, segs.length);
      this.emit('progress', { id: dest, downloaded: n, total: segs.length, percent: Math.round(n / segs.length * 100), speed: 0 });
    }
    const media = require('../media-wrap/media');
    await media.mergeSegments(files, dest);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    this.emit('done', { id: dest, dest });
  }
}

DownloadEngine.VERSION = VERSION;
module.exports = DownloadEngine;
