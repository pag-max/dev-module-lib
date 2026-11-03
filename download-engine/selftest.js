#!/usr/bin/env node
// download-engine 自检脚本（离线可跑，不依赖外网）
//
//   node selftest.js
//
// 自建本地 HTTP 服务，覆盖 6 条真实路径：
//   1  分片并行下载 + 大小/sha256 校验
//   2  暂停 → 续传（验证已完成分片不重下）
//   3  服务器不支持 Range → 单流下载
//   4  301/302 重定向跟随
//   5  自定义请求头（Referer 防盗链，403 → 200）
//   6  404 → error 事件
// 任一失败退出码 1，全通过退出码 0。
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const DownloadEngine = require('./engine');

const SIZE = 8 * 1024 * 1024;
const BODY = crypto.randomBytes(SIZE);
const SHA = crypto.createHash('sha256').update(BODY).digest('hex');
const TMP = path.join(os.tmpdir(), 'dl-engine-selftest');
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

let slow = false;              // 暂停测试用：限速
let served = 0;                // 已发出的正文字节
const reqCount = {};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function send(res, buf, headers) {
  res.writeHead(206, headers);
  const STEP = 64 * 1024;
  for (let i = 0; i < buf.length; i += STEP) {
    if (res.destroyed || res.writableEnded) return;
    const slice = buf.subarray(i, i + STEP);
    served += slice.length;
    if (!res.write(slice)) await new Promise(r => res.once('drain', r));
    if (slow) await sleep(25);
  }
  res.end();
}

const server = http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  reqCount[p] = (reqCount[p] || 0) + 1;

  if (p === '/404') { res.writeHead(404); return res.end('nope'); }

  if (p === '/redir') { res.writeHead(302, { Location: '/range' }); return res.end(); }

  if (p === '/norange') {
    if (req.method === 'HEAD') { res.writeHead(200, { 'content-length': SIZE }); return res.end(); }
    res.writeHead(200, { 'content-length': SIZE });
    return res.end(BODY);
  }

  if (p === '/needref') {
    if (req.headers.referer !== 'https://ok.example/') { res.writeHead(403); return res.end('forbidden'); }
    res.writeHead(302, { Location: '/range' });
    return res.end();
  }

  if (p === '/range') {
    if (req.method === 'HEAD') {
      res.writeHead(200, { 'content-length': SIZE, 'accept-ranges': 'bytes' });
      return res.end();
    }
    const range = req.headers.range;
    if (!range) { res.writeHead(200, { 'content-length': SIZE }); return res.end(BODY); }
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const s = parseInt(m[1], 10);
    const e = m[2] ? Math.min(parseInt(m[2], 10), SIZE - 1) : SIZE - 1;
    const buf = BODY.subarray(s, e + 1);
    // 限速模式下按分片起始位置错峰，便于制造“部分分片已完成”的中间态
    if (slow) await sleep(Math.round((s / SIZE) * 1200));
    return send(res, buf, {
      'content-length': buf.length,
      'content-range': 'bytes ' + s + '-' + e + '/' + SIZE,
      'accept-ranges': 'bytes'
    });
  }

  res.writeHead(404); res.end();
});

// ---------------------------------------------------------------------------
const results = [];
function check(name, ok, extra) {
  results.push({ name, ok, extra });
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (extra ? '   ' + extra : ''));
}

function once(eng, ev, ms = 30000) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('等待事件 ' + ev + ' 超时')), ms);
    eng.once(ev, e => { clearTimeout(t); res(e); });
  });
}

function shaOf(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  console.log('\ndownload-engine v' + DownloadEngine.VERSION + ' selftest');
  console.log('本地服务 ' + base + '，样本 ' + (SIZE / 1048576) + 'MB\n');

  // --- 1 分片并行 ---
  console.log('[1] 分片并行 + 大小/sha256 校验');
  {
    const eng = new DownloadEngine({ threads: 4, shaCheck: true });
    const dest = path.join(TMP, 'a.bin');
    let lastPct = 0, progressEvents = 0;
    eng.on('progress', e => { progressEvents++; lastPct = e.percent; });
    const done = once(eng, 'done');
    const err = once(eng, 'error');
    eng.add({ url: base + '/range', dest, sha256: SHA });
    const r = await Promise.race([done, err]);
    const size = fs.statSync(dest).size;
    check('分片下载完成且无 error', !r.error, r.error || '');
    check('文件字节数一致', size === SIZE, size + '/' + SIZE);
    check('sha256 一致', shaOf(dest) === SHA);
    check('进度事件被节流（< 60 次/8MB）', progressEvents < 60, progressEvents + ' 次');
    check('最终进度 100%', lastPct === 100, lastPct + '%');
  }

  // --- 2 暂停 / 续传 ---
  console.log('\n[2] 暂停 → 续传（已完成分片不重下）');
  {
    slow = true;
    const eng = new DownloadEngine({ threads: 4 });
    const dest = path.join(TMP, 'b.bin');
    const id = eng.add({ url: base + '/range', dest });
    const t = eng.tasks.get(id);
    // 等到至少 1 片完成、但整体未完成时暂停
    const t0 = Date.now();
    while (Date.now() - t0 < 12000) {
      const doneN = t.chunks.filter(c => c.done).length;
      if (doneN >= 1 && doneN < t.chunks.length) break;
      await sleep(50);
    }
    eng.pause(id);
    const doneChunks = t.chunks.filter(c => c.done).length;
    const doneBytes = t.chunks.filter(c => c.done).reduce((s, c) => s + c.expect, 0);
    served = 0;
    slow = false;
    const done = once(eng, 'done');
    const err = once(eng, 'error');
    eng.resume(id);
    const r = await Promise.race([done, err]);
    check('暂停时确有已完成分片', doneChunks > 0, doneChunks + '/' + t.chunks.length + ' 片');
    check('续传后完成且无 error', !r.error, r.error || '');
    check('续传后 sha256 一致', shaOf(dest) === SHA);
    check('续传只补未完成部分', served <= (SIZE - doneBytes) * 1.3 + 65536,
      '补下 ' + (served / 1048576).toFixed(2) + 'MB / 剩余 ' + ((SIZE - doneBytes) / 1048576).toFixed(2) + 'MB');
  }

  // --- 3 不支持 Range ---
  console.log('\n[3] 服务器不支持 Range → 单流');
  {
    const eng = new DownloadEngine({ threads: 4, shaCheck: true });
    const dest = path.join(TMP, 'c.bin');
    const done = once(eng, 'done');
    const err = once(eng, 'error');
    eng.add({ url: base + '/norange', dest, sha256: SHA });
    const r = await Promise.race([done, err]);
    check('单流下载完成', !r.error, r.error || '');
    check('单流 sha256 一致', shaOf(dest) === SHA);
  }

  // --- 4 重定向 ---
  console.log('\n[4] 302 重定向跟随');
  {
    const eng = new DownloadEngine({ threads: 2 });
    const dest = path.join(TMP, 'd.bin');
    const done = once(eng, 'done');
    const err = once(eng, 'error');
    eng.add({ url: base + '/redir', dest });
    const r = await Promise.race([done, err]);
    check('重定向后照常完成', !r.error && fs.statSync(dest).size === SIZE, r.error || '');
  }

  // --- 5 自定义头 / 防盗链 ---
  console.log('\n[5] 自定义请求头（Referer 防盗链）');
  {
    const eng = new DownloadEngine({ threads: 2 });
    const dest = path.join(TMP, 'e.bin');
    const done = once(eng, 'done');
    const err = once(eng, 'error');
    eng.add({ url: base + '/needref', dest, headers: { Referer: 'https://ok.example/' } });
    const r = await Promise.race([done, err]);
    check('带 Referer 通过 403 并下载成功', !r.error && fs.statSync(dest).size === SIZE, r.error || '');

    const eng2 = new DownloadEngine({ threads: 2, retries: 0 });
    const p2 = Promise.race([
      once(eng2, 'error'),
      once(eng2, 'done').then(() => ({ error: '' }))
    ]);
    eng2.add({ url: base + '/needref', dest: path.join(TMP, 'e2.bin') });
    const e3 = await p2;
    check('不带 Referer 应报错（不静默产出残缺文件）', !!e3.error, e3.error || '');
  }

  // --- 6 404 ---
  console.log('\n[6] 404 报错');
  {
    const eng = new DownloadEngine({ threads: 2, retries: 0 });
    const err = once(eng, 'error');
    eng.add({ url: base + '/404', dest: path.join(TMP, 'f.bin') });
    const e = await err;
    check('404 触发 error 事件', /404/.test(e.error), e.error);
  }

  // --- 收尾 ---
  server.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n----------------------------------------');
  console.log('通过 ' + (results.length - failed.length) + '/' + results.length + (failed.length ? '，失败：' + failed.map(f => f.name).join(' / ') : ''));
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  process.exit(failed.length ? 1 : 0);
})().catch(e => {
  console.error('自检脚本异常：', e);
  server.close();
  process.exit(1);
});
