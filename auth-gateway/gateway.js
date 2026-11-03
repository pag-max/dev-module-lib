// Auth Gateway · 登录 / 网关会话管理
// 用法：const gw = new AuthGateway({ sessionFile:'session.json' });
// 特性：cookie/ token 持久化、登录态判断、登出、注入 SSO 登录函数（交大 / AcFun 网关）。
const fs = require('fs');

class AuthGateway {
  constructor({ sessionFile = 'session.json', onLoginUI = null } = {}) {
    this.sessionFile = sessionFile;
    this.onLoginUI = onLoginUI;     // 可选：弹出 UI Kit 登录页，返回 Promise<session>
    this.session = this._load();
  }
  _load() {
    try { return JSON.parse(fs.readFileSync(this.sessionFile, 'utf8')); }
    catch { return {}; }
  }
  save() { fs.writeFileSync(this.sessionFile, JSON.stringify(this.session, null, 2)); }
  set(key, val) { if (typeof key === 'object') Object.assign(this.session, key); else this.session[key] = val; this.save(); }
  get(key) { return key === undefined ? this.session : this.session[key]; }
  isLoggedIn() { return !!(this.session.token || this.session.session || this.session.cookie); }
  logout() { this.session = {}; this.save(); }

  // 通用登录：传入一个 async 函数 fn(gw) => sessionObj，成功后落地
  async login(fn) {
    const s = await fn(this);
    Object.assign(this.session, s);
    this.save();
    return this.session;
  }
  // 注入 UI 登录（接 UI Kit 登录页）：点「登录」按钮时 await gw.loginUI()
  async loginUI() {
    if (!this.onLoginUI) throw new Error('未配置 onLoginUI');
    const s = await this.onLoginUI(this);
    Object.assign(this.session, s);
    this.save();
    return this.session;
  }
  // 给 fetch / http 请求附上已存 cookie
  authHeaders() {
    const c = this.session.cookie;
    return c ? { Cookie: c } : {};
  }
}
module.exports = AuthGateway;
