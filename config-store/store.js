// Config Store · 配置读写中心
// 用法：const cfg = new ConfigStore({ file:'config.json', defaults:{ thread:4, path:'.' } });
// 特性：默认值合并、类型安全读取、自动保存、重置、可选变更订阅（接 UI 设置页）。
const fs = require('fs');

class ConfigStore {
  constructor({ file = 'config.json', defaults = {}, schema = null } = {}) {
    this.file = file;
    this.defaults = defaults;
    this.schema = schema;                 // 可选：{ key: 'number'|'string'|'boolean' }
    this._subs = [];
    this.data = this._load();
  }
  _load() {
    let d = { ...this.defaults };
    if (this.file && fs.existsSync(this.file)) {
      try { Object.assign(d, JSON.parse(fs.readFileSync(this.file, 'utf8'))); } catch (e) { /* 坏文件用默认 */ }
    }
    return d;
  }
  get(key) { return key === undefined ? this.data : this.data[key]; }
  set(key, val) {
    if (typeof key === 'object') Object.assign(this.data, key);
    else {
      if (this.schema && this.schema[key]) {
        if (this.schema[key] === 'number') val = Number(val);
        if (this.schema[key] === 'boolean') val = val === true || val === 'true' || val === '1';
      }
      this.data[key] = val;
    }
    this.save();
    this._subs.forEach(fn => { try { fn(this.data); } catch (_) {} });
    return this;
  }
  save() { if (this.file) fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2)); return this; }
  reset() { this.data = { ...this.defaults }; this.save(); this._subs.forEach(fn => fn(this.data)); return this; }
  onChange(fn) { this._subs.push(fn); return this; }
}
module.exports = ConfigStore;
