// AutoBackup · 自动备份与一键恢复
// 用法：const bk = new AutoBackup({ target:'data.json', backupDir:'backups', keep:10 });
// 特性：时间戳快照、保留最近 N 份、按标签快照（如升级前）、一键恢复。
const fs = require('fs');
const path = require('path');

function ts() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }

function cp(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const f of fs.readdirSync(src)) cp(path.join(src, f), path.join(dest, f));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}
function rmrf(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    for (const f of fs.readdirSync(p)) rmrf(path.join(p, f));
    fs.rmdirSync(p);
  } else fs.unlinkSync(p);
}

class AutoBackup {
  constructor({ target, backupDir = 'backups', keep = 10 } = {}) {
    this.target = target;
    this.backupDir = backupDir;
    this.keep = keep;
    fs.mkdirSync(this.backupDir, { recursive: true });
  }
  snapshot(tag = '') {
    if (!this.target) throw new Error('AutoBackup: target 未指定');
    const name = `${ts()}${tag ? '_' + tag : ''}`;
    const dest = path.join(this.backupDir, name);
    cp(this.target, dest);
    this._prune();
    return dest;
  }
  list() {
    return fs.readdirSync(this.backupDir)
      .filter(f => !f.endsWith('.json'))
      .map(f => path.join(this.backupDir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  }
  restore(name, to = this.target) {
    const src = path.join(this.backupDir, name);
    rmrf(to);
    cp(src, to);
    return to;
  }
  _prune() {
    const all = this.list();
    all.slice(this.keep).forEach(n => rmrf(n));
  }
}
module.exports = AutoBackup;
