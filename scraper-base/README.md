# Scraper Base · 爬虫基础

> 模块库基础件。统一交大课件爬虫 / 动漫爬取 / 三站下载工具里的 HTTP 请求与解析逻辑。

## 接口契约
```js
const Scraper = require('scraper-base/scraper');

// 1) 普通抓取（自带 UA 轮换 + 限速 + 重试）
const s = new Scraper({ concurrency: 4, delay: 500, retries: 3 });
const html = await s.get('https://example.com/list');

// 2) 解析助手（零依赖，不引 cheerio 也能用）
Scraper.first(html, /<title>(.*?)<\/title>/s);     // 首个匹配组
Scraper.all(html, /href="(.*?\.mp4)"/g);           // 全部匹配
Scraper.between(html, '<div id="a">', '</div>');   // 区间截取

// 3) 批量抓取
const items = await s.map(urls, (page, url) => Scraper.all(page, /.../g));
```
- 指数退避重试、速率限制，避免被封。
- `binary:true` 可抓图片/视频流为 Buffer。

## 复用约定
- 新爬虫统一 `require('../../scraper-base/scraper')`，**禁止**重写 fetch 封装。
- 真实数据测试时把 `delay` 调大、或先用小样本，遵守「不污染真实数据」铁律。
