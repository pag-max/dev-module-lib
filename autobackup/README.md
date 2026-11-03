# AutoBackup · 自动备份与一键恢复

> 模块库基础件。你已在米哈游养成记录里手动留了 4 份 `_backup_时间戳`——把这套动作做成模块。
> 数据测试铁律要求「不能污染真实数据」，本模块是安全网。

## 接口契约
```js
const AutoBackup = require('autobackup/backup');
const bk = new AutoBackup({ target: 'data.json', backupDir: 'backups', keep: 10 });

bk.snapshot('升级前');     // 升级/大改前先拍一份，返回快照路径
bk.snapshot();             // 自动时间戳
bk.list();                 // 全部快照（新->旧）
bk.restore(bk.list()[0]);  // 一键恢复到最新快照
```
- 目录/文件都支持，递归拷贝。
- `keep` 控制保留份数，超出自动清理最旧的。

## 复用约定
- 关键写操作（导入、批量删除、结构迁移）前统一调 `snapshot()`。
- **禁止**删除 `backups/`，那是用户数据的安全网。
