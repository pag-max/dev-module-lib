// Scraper Base · 爬虫基础（HTTP 池 / 重试 / 限速 / 解析）
// 用法：const s = new Scraper({ concurrency:4, delay:500, retries:3 });
// 依赖：Node 18+ 自带 fetch。特性：并发控制、指数退避重试、UA 轮换、速率限制、HTML 解析助手。
const sleep = ms => new Promise(r => setTimeout(r, ms));

const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
];

class Scraper {
  constructor({ concurrency = 4, delay = 500, retries = 3, uaRotate = true, proxy = null, timeout = 20000 } = {}) {
    this.concurrency = concurrency;
    this.delay = delay;
    this.retries = retries;
    this.uaRotate = uaRotate;
    this.proxy = proxy;
    this.timeout = timeout;
    this._ua = 0;
  }
  _uaNext() {
    if (!this.uaRotate) return UA_POOL[0];
    const u = UA_POOL[this._ua % UA_POOL.length]; this._ua++;
    return u;
  }
  async _rateLimit() { if (this.delay) await sleep(this.delay); }

  async get(url, { headers = {}, retry = this.retries, binary = false } = {}) {
    for (let i = 0; i <= retry; i++) {
      try {
        await this._rateLimit();
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), this.timeout);
        const res = await fetch(url, {
          headers: { 'User-Agent': this._uaNext(), ...headers },
          signal: ctrl.signal
        });
        clearTimeout(t);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return binary ? Buffer.from(await res.arrayBuffer()) : await res.text();
      } catch (e) {
        if (i === retry) throw e;
        await sleep(2 ** i * 300); // 指数退避
      }
    }
  }
  async getJSON(url, opt = {}) {
    const txt = await this.get(url, { ...opt, headers: { 'Accept': 'application/json', ...(opt.headers || {}) } });
    return JSON.parse(txt);
  }
  // 串行批量抓取（受并发/限速约束）
  async map(urls, fn) {
    const out = [];
    for (const u of urls) {
      try { out.push(await fn(await this.get(u), u)); }
      catch (e) { out.push({ error: String(e) }); }
    }
    return out;
  }

  // ---------- 解析助手（零依赖） ----------
  static first(html, re) { const m = html.match(re); return m ? (m[1] ?? m[0]) : null; }
  static all(html, re) { return [...html.matchAll(re)].map(m => m[1] ?? m[0]); }
  static between(html, a, b) {
    const i = html.indexOf(a); if (i < 0) return null;
    const j = html.indexOf(b, i + a.length); if (j < 0) return html.slice(i + a.length);
    return html.slice(i + a.length, j);
  }
}
module.exports = Scraper;
