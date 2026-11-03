# Config Store · 配置读写中心

> 模块库基础件。统一每个项目散落的配置（动漫 `config.json`、交大 `账号配置.txt`、三站 `.acfan_gateway.json`）。

## 接口契约
```js
const ConfigStore = require('config-store/store');
const cfg = new ConfigStore({
  file: 'config.json',
  defaults: { thread: 4, savePath: '.', autoBackup: true },
  schema: { thread: 'number', autoBackup: 'boolean' }
});
cfg.get('thread');              // 4
cfg.set('thread', 8);           // 自动类型转换 + 落盘
cfg.set({ savePath: 'D:/Downloads' }); // 批量
cfg.onChange(d => renderSettings(d));  // 接 UI Kit 设置页
cfg.reset();                    // 回到默认
```
- 文件损坏自动回退默认，不会崩。
- 类型按 `schema` 自动规整，避免 `'8'` 当 8 用。

## UI 模板
`demo/ui.html` 是 **UI Kit 设置页**模板：左侧分组导航 + 右侧分组卡片，低利害项自动保存、高利害项才弹确认。新工具直接套用。

## 复用约定
- 新项目统一 `require('../../config-store/store')`，**不要重写**。
