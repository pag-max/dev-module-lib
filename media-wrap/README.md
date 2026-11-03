# Media Wrap · FFmpeg 封装

> 模块库基础件。统一动漫爬取（m3u8/TS 合并、完整性校验）与画图板（时长/转码）里的 ffmpeg 调用，避免到处拼命令。

## 接口契约
```js
const media = require('media-wrap/media');

await media.mergeSegments(['s0.ts','s1.ts','s2.ts'], 'out.mp4');   // 分段合并（写临时 list 再 concat）
await media.concatList('concat.txt', 'out.mp4');                  // 已有 list 文件时
const sec = await media.duration('out.mp4');                      // 探针取时长
await media.transcode('in.mp4', 'out.mp4', ['-crf','23']);       // 转码
await media.screenshot('in.mp4', 'cap.png', '00:00:03');          // 截图
```
- 全程走 `execFile`（不拼 shell，防注入）。
- 缺 ffmpeg 时抛清晰错误，由 **Build Templates** 负责静默安装。

## 复用约定
- 凡涉及音视频合并/探针/转码，统一走本模块，**禁止**在业务代码里手写 `exec('ffmpeg ...')`。
