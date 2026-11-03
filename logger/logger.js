// Logger · 结构化滚动日志模块
// 用法：const log = new Logger({ dir:'logs', keep:30, level:'info', onLog:(lv,msg,e)=>ui.toast(msg) });
// 特性：JSON 行日志、按等级过滤、保留最近 N 个文件、可选实时回传 UI（接 ui-kit Toast / 下载日志抽屉）。
const fs = require('fs');
const path = require('path');

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}
function fmt(args) {
  return args.map(a => typeof a === 'string' ? a : (a && a.stack ? a.stack : JSON.stringify(a))).join(' ');
}

class Logger {
  constructor(opt = {}) {
    this.dir = opt.dir || path.join(process.cwd(), 'logs');
    this.keep = opt.keep ?? 30;
    this.level = opt.level || 'info';
    this.onLog = opt.onLog || null;          // (level, message, entry) => void
    this.levels = { debug: 10, info: 20, warn: 30, error: 40 };
    fs.mkdirSync(this.dir, { recursive: true });
    this.file = path.join(this.dir, `log_${stamp()}.log`);
  }
  _write(level, args) {
    if ((this.levels[level] || 20) < this.levels[this.level]) return null;
    const entry = { t: new Date().toISOString(), level, msg: fmt(args) };
    try { fs.appendFileSync(this.file, JSON.stringify(entry) + '\n'); } catch (e) { /* 磁盘异常忽略 */ }
    if (this.onLog) { try { this.onLog(level, entry.msg, entry); } catch (_) {} }
    return entry;
  }
  debug(...a) { return this._write('debug', a); }
  info(...a)  { return this._write('info', a); }
  warn(...a)  { return this._write('warn', a); }
  error(...a) { return this._write('error', a); }
  // 保留最近 keep 个日志文件，其余删除
  rotate() {
    const files = fs.readdirSync(this.dir).filter(f => f.endsWith('.log'))
      .map(f => path.join(this.dir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    files.slice(this.keep).forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });
  }
}
module.exports = Logger;
