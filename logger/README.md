# Logger · 结构化滚动日志模块

> 模块库基础件。杜绝每个项目各写一套 `console.log` / 自己拼文件名。
> 来自你项目里的重复点：动漫爬取 `logs/下载_时间.log`（保留 30 个）、米哈游 `update.log`。

## 接口契约
```js
const Logger = require('logger/logger');
const log = new Logger({
  dir: 'logs',          // 日志目录，默认 ./logs
  keep: 30,             // 保留最近 N 个文件，默认 30
  level: 'info',        // debug|info|warn|error，低于该等级不写
  onLog: (lv, msg, e) => ui.toast(msg, lv === 'error' ? 'danger' : 'info') // 可选：实时回传 UI
});
log.info('开始下载', url);
log.warn('速度偏低');
log.error('连接失败', err);
log.rotate();           // 清理超量文件
```
- 输出：每行一条 JSON（`{t, level, msg}`），便于机器解析。
- `onLog` 直接对接 **UI Kit** 的 Toast 或下载详情抽屉的实时日志流。

## 复用约定
- 新项目统一 `require('../../logger/logger')`，**不要重写**。
- 升级保持向后兼容：新增 option 必须带默认值。
