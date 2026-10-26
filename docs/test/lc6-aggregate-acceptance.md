# LC6｜账户数据生命周期双平台聚合验收清单

Trace: S05-LC6 / S13-LC6, plus merged S09/S14/S15 LC5 consumers. Baseline: PR #115 merged into `main@6b1f2100f6c3a91394170b9005a807f76f7b6bcb`.

**状态：未执行（NOT RUN）**。本清单属于最终统一验收准备；本批 LC6-A 自动化合同测试不能代替原生产品或真实到账证据。没有实际执行的场景不得标 PASS。Android Emulator 与 iOS Simulator 可用于前期调试，真机验收最后进行。iOS 真机 System Auth 取消/重试仍延期至 Stage 9。

| 关键路径 | 测试场景（每个平台） | 操作 | 预期 | Android | iOS |
| --- | --- | --- | --- | --- | --- |
| 是 | 首次离线启动 / 缓存恢复 | 先在线加载 A 的 Home 和 Activity，退出应用，断网后重新启动 | A 的公开缓存可见且有 stale/更新时间；不产生新读取、不使用缓存作为交易授权 | NOT RUN | NOT RUN |
| 是 | 在线恢复 / A 与 B 分区 | 缓存 A、切换到 B、离线与重新联网 | 仅显示当前账户/网络内容；在线后重新验证 Balance/History，旧 A 结果不得闪现或覆盖 B | NOT RUN | NOT RUN |
| 是 | 前后台实时到账 | 在选中账户保持前台，切换 Home、Activity 和其他 Tab，外部向该账户发送 Testnet 资金 | Effects 仅提供 invalidation；可查询后的 Balance 与 Activity 按真实账本更新，并记录查询可用→UI 可见延迟（目标五秒；单次通过不等于 SLA） | NOT RUN | NOT RUN |
| 是 | 断流与节点冷却 | 中断 Effects、模拟节点 429/5xx/超时或切换到错误网络节点，恢复可信端点 | 共享 cooldown/fallback，不越过 Retry-After；错误网络 fail-closed；恢复后再读真实状态，无自动重广播 | NOT RUN | NOT RUN |
| 是 | 冷/热链接与网络恢复 | 冷启动/前台重复输入同一 Request URI，离线等待后恢复在线；中途切换账户或关闭 | 有效请求只进入一次当前审阅；取消/旧解析不能复活；不绕开 eligibility、signer 或 exact-XDR 管线 | NOT RUN | NOT RUN |
| 是 | dApps 首次离线与系统浏览器 | 首次离线进入 dApps，再联网；在网站确认页后台、离开、返回 | 不无限 loading；未配置目录为 unavailable；旧提案不能被确认，已批准同一焦点交接按既有规则处理 Recent | NOT RUN | NOT RUN |
| 是 | 交易提交后数据收敛 | 使用获授权 Testnet 交易触发 pending→confirmed/rejected/uncertain，节点短暂不可用后恢复 | 跟踪原始 hash；最多既定次数的只读收敛；恢复不得重新签名/广播，不伪造余额或历史 | NOT RUN | NOT RUN |
| 是 | 删除与重启 | A/B 分区分别缓存，删除 A；结束进程并重新打开 | A 的分区被清理、B 保持；Realm 迁移和历史持久化不丢失；无残留 signer/secret 跨分区暴露 | NOT RUN | NOT RUN |
| 否 | 访问性与显示设置 | 在小屏/大字号和屏幕阅读器下完成离线、错误、重试、恢复 | 状态文案可读可访问；无错误交互或 UI 跳转；TalkBack/VoiceOver 证据独立记录 | NOT RUN | NOT RUN |

## 记录要求

执行每条场景时追加：日期、设备/模拟器与系统版本、构建类型、测试的 exact `main` / PR HEAD、账户与网络（只记录公开或脱敏 ID）、操作与预期、实际结果、日志/截图引用、PASS/FAIL/BLOCKED、失败复现与恢复说明。不要记录私钥、助记词、passphrase、未经脱敏的诊断或授权材料。

LC6-A 的 Jest 跨模块合同测试使用真实 App read-model + Capability + 内存缓存实现和受控 I/O；补充的 Realm 集成验证在真实 v6 文件 close/reopen 后，确认两个公开缓存分区离线恢复、在线重验与账户隔离（本地 5 套件 / 69 测试）。两者都不是原生应用进程重启验收。现有 LC2 v5→v6 迁移代码不变，无需仅因该切片重新设计迁移。原生聚合执行时仍须重新记录当前树的实际重启/迁移/清理证据。缓存不得用于代替 live 交易授权。

完整 LC6 验收只能在满足双端实际证据后关闭；本清单暂不提升 S05/S13 或整体产品成熟度。
