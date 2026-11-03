// Media Wrap · FFmpeg 封装（合并 / 探针 / 转码 / 截图）
// 用法：const media = require('media-wrap/media');
// 依赖：系统已装 ffmpeg（动漫爬取、画图板都已依赖它）。如无，优先用 build-templates 的静默安装。
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(args, maxBuffer = 1e9) {
  return new Promise((res, rej) => {
    execFile('ffmpeg', args, { maxBuffer }, (err, _so, se) => {
      if (err && err.code === 'ENOENT') return rej(new Error('未找到 ffmpeg，请先安装'));
      err ? rej(err) : res(se || '');
    });
  });
}
function probe(args) {
  return new Promise((res, rej) => {
    execFile('ffprobe', args, { maxBuffer: 1e9 }, (err, so, se) => {
      if (err && err.code === 'ENOENT') return rej(new Error('未找到 ffprobe'));
      err ? rej(err) : res(so || se || '');
    });
  });
}

// 时长（秒）
async function duration(file) {
  const out = await probe(['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1', file]);
  return parseFloat(out.trim());
}
// 把 n 个分段按序合并（需先有 list.txt: 每行 file 'seg0.ts'）
async function concatList(listFile, out) {
  return run(['-f','concat','-safe','0','-i',listFile,'-c','copy', out]);
}
// 直接合并一组分段文件
async function mergeSegments(segs, out, tmp = path.join(require('os').tmpdir(), 'concat.txt')) {
  fs.writeFileSync(tmp, segs.map(s => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'));
  await concatList(tmp, out);
  fs.unlinkSync(tmp);
  return out;
}
// 转码
async function transcode(input, out, extra = []) {
  return run(['-i', input, ...extra, out]);
}
// 截图
async function screenshot(input, out, at = '00:00:01') {
  return run(['-i', input, '-ss', at, '-vframes', '1', out]);
}
module.exports = { run, probe, duration, concatList, mergeSegments, transcode, screenshot };
