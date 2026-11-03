# Auth Gateway · 登录 / 网关会话管理

> 模块库基础件。统一交大 SSO、AcFun 网关、三站 `.acfan_gateway.json` 的登录态保持逻辑。

## 接口契约
```js
const AuthGateway = require('auth-gateway/gateway');
const gw = new AuthGateway({ sessionFile: 'session.json' });

gw.isLoggedIn();                  // 是否已有有效会话
gw.set('token', t).set('cookie', c); // 落地会话
gw.authHeaders();                 // => { Cookie: '...' } 给后续请求

// SSO 登录（交大课程爬虫）：传入取 token 的函数
await gw.login(async () => {
  // ...走 SSO 流程，返回 { token, cookie }
  return { token: 'xxx', cookie: 'session=yyy' };
});
gw.logout();
```
- 会话落地为 JSON，重开软件免登录。
- `onLoginUI` 可接 **UI Kit 登录页**模板（`demo/ui.html`）：账号密码录入 + 登录态徽标 + 登出。

## 复用约定
- 凡涉及登录/鉴权，统一走本模块，**禁止**各项目把 token 写死在业务代码里。
- 密码等敏感字段只存会话文件、不进日志（Logger 已自动只记 msg）。
