# Download Engine · 多线程分片下载引擎 **v1.1.0**

> 模块库核心模块。提炼自三站下载工具、动漫爬取（24 线程分段+校验）、交大课件爬虫、m3u8dl 的重复下载逻辑，
> 并经 Nova 壁纸下载器（336MB 4K 视频 + 千张图）真实场景压过一轮。变更记录见 `CHANGELOG.md`。

## 接口契约
```js
const DownloadEngine = require('download-engine/engine');
const eng = new DownloadEngine({ threads: 4, retries: 3, shaCheck: false, timeout: 30000 });

// 接 UI：直接喂给 UI Kit 的「下载队列」组件（见 demo/ui.html）
eng.on('added',    e => ui.addRow(e));
eng.on('progress', e => ui.updateRow(e));   // {id,downloaded,total,percent,speed}，150ms 节流
eng.on('done',     e => ui.markDone(e));    // {id,dest,bytes}
eng.on('error',    e => ui.markError(e));   // {id,error}
eng.on('paused',   e => ui.markPaused(e));
eng.on('removed',  e => ui.removeRow(e));

const id = eng.add({
  url: 'https://x/file.mp4',
  dest: 'out.mp4',
  sha256: '可选',                              // shaCheck:true 时生效
  headers: { Referer: 'https://x/' }          // 可选：防盗链/UA/Cookie
});
eng.pause(id); eng.resume(id); eng.remove(id);   // resume 为真续传，不重下已完成分片

// m3u8 流：抓 playlist → 下 ts → 合并（依赖 media-wrap）
await eng.downloadM3u8('https://x/playlist.m3u8', 'out.mp4');
```

## 能力
- **分片并行**：HTTP `Range` 把文件拆片并行下载，再顺序合并。`threads` 是并发上限，分片数按最小 256KB 收敛。
- **真断点续传**：每片独立落盘 `.partN`（`os.tmpdir()/dl-engine-parts`），暂停只 abort 在飞请求；续传跳过已完成分片。
- **跟随重定向**：301/302/307 最多 5 跳（CDN / 对象存储直链必需）。
- **自定义请求头**：`headers` 透传到每个分片请求，解决 Referer 防盗链 403。
- **指数退避重试**：单片失败自动重试 `retries` 次。
- **流式写盘**：内存占用与文件大小无关（300MB+ 文件不吃 300MB 内存）。
- **完整性校验**：比对大小（可选 sha256），不符即报错，不会静默产出残缺文件。
- **m3u8 一站式**：无需外部拼命令，内部调 `media-wrap` 合并 ts。

## 已知坑（实战踩过，别重复踩）
| 场景 | 症状 | 原因 / 对策 |
|---|---|---|
| 直链打开是图、程序下载 403 | `HTTP 403` | 对象存储 Referer 防盗链。`add({ headers:{ Referer:'https://原站/' }})`；网页端同时加 `<meta name="referrer" content="no-referrer">`。**注意：多数 OSS 只拦「错误来源」，空 Referer 是放行的**——浏览器从 `localhost`/`file://` 打开时自带本地 Referer 才会 403，Node/curl 默认不带 Referer 反而能过，排查时别被这个假象骗了 |
| 下载完立刻报「大小不符」 | size 偏小 | 合并未等 flush。v1.1.0 已修，勿回退 `ws.on('finish')` 等待 |
| 分片临时文件删不掉 | 删除超时/报错 | 部分环境 `unlinkSync` 被劫持到回收站。用 `fs.rmSync(force:true)` + try-catch，且临时文件放 `os.tmpdir()` 不放目标目录 |
| 进度条乱跳 / 卡 100% 不结束 | — | 别在外部自行累加字节数，只信 `progress` 事件的 `downloaded`；`done` 才是终态 |
| HEAD 拿不到长度 | 走单流 | 服务器不支持 HEAD，引擎已自动降级 `GET Range:0-0` 探测 |

## 自检（改完引擎必须跑）
```bash
node selftest.js        # 离线自建 Range 服务器，6 组用例 15 项断言，全过退出码 0
```
覆盖：分片下载 + sha256、暂停续传（验证已完成分片不重下）、不支持 Range 的单流、302 重定向、Referer 防盗链 403→200、404 报错。

## UI 模板
`demo/ui.html` 是 **UI Kit 下载队列**完整模板：缩略+文件名+来源+状态徽标+内嵌进度+速度+操作按钮组（拖拽手柄排序 / 暂停·继续 / 移除），已被 RecordBook 与 Nova 壁纸下载器复用。

## 复用约定
- 新下载器统一 `require('../../download-engine/engine')`，**禁止**从零写下载循环。
- 引擎不负责 UI，UI 只通过事件订阅——保持引擎与界面解耦。
- **在项目里发现引擎 bug：先跑 `selftest.js` 复现，再改本模块并写入 `CHANGELOG.md`，不要只在项目内私改副本**——否则下一个项目会重新踩一遍。
