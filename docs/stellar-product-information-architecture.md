# Fresnica Mobile 重写指南

> 地位：产品范围、信息架构与完成标准。GitHub、当前源码和 PR 状态是开发事实源；本文成熟度摘要与 [当前进度](fresnica-mobile-current-progress-and-next-plan.md) 同步事实，`fresnica-mobile-rewrite-execution-plan.md` 保留阶段、依赖和验收框架。
>
> 产品思路参考：`origin/Stellar@stellar-migration`（`bd0f4540`）。
>
> 工程思路参考：`origin/Xaman-App`（组件打包、theme token、lint / 路径别名）。
>
> 钱包 / 安全权威：`origin/fresnica` 的 Application Capability / Core 契约，加上当前 Mobile 实现和 `docs/mobile-capability-status.md`。
>
> 代码风格与分层规则：`docs/mobile-architecture-style-guide.md`。
>
> 本文覆盖 §13 所列历史文档里关于 Tab、产品壳和命名的说法。历史计划中的「候选／阻塞」不能覆盖已合并代码；产品范围和完成标准仍以本文及当前行为规格为准。
>
> 完整性优先于施工快。总表里不是「完成」或「卡上游（设计留位）」的 Phase，不得当作下一阶段的开工依据。

## 怎么用这份指南

1. **开工**：先恢复 GitHub/local exact HEAD、工作树和 PR，再看下面成熟度总表、[当前进度](fresnica-mobile-current-progress-and-next-plan.md) 与本 slice 行为规格。Phase 0/Stage 0A、导航主题基础及 Stage 2.5 共享恢复已有实现和各自证据，不重复重建。当前处理既有产品的窄范围状态合同修复；所有 donor-derived PR 仍持续执行 Stage 0A。
2. **有什么**：产品表面 §7（含 §7.8）、工程角色 §14、数据权威 §2.1。Exclude 则停止。表外默认不存在；要做必须先入表。
3. **做成什么样**：§8 与对应的 §9。Git 脚手架能点 ≠ 完成。`docs/mobile-capability-status.md` 只记现状，不当验收。
4. **每条 PR**：下面三条门禁 + §11。共享契约没有的语义，不要在 Mobile 里发明。

不要从 Xaman / Stellar 源码复制实现。Stellar 的 dApp 增改也位于 Xaman 派生树中，默认只提取流程、角色、协议输入输出和异常行为，再在 Fresnica 分层里 clean-room 重写。只有具备文件级独立著作权证据并有审批记录的文件才可例外移植，见 §1.1。

F0–F4 只是总表里的别名（导航库 / 守卫 / 栈 / 主题壳 / 按表面重建），**不再单独当施工队列**。

### 成熟度总表 — 2026-11-24

当前基线为 `main@6ed7b7c9d4c1ccf93e19dfc4265ec37d8a8b3f7d`，包含已合并 #231 UI、#230 SEP-53 修复和 #228 Android 前台 dApp 本地通知。下表区分实现与验收；本轮第 2–6 项作为修复候选交付，最终 PR/HEAD/检查/Work Review 在 [当前进度](fresnica-mobile-current-progress-and-next-plan.md) 登记。通知仅实现每次独立同意的 Android 子集，iOS 不支持，原生通知验收未完成；#78 暂停。历史原生结果保留原 SHA，Stage 9 iOS 真机 auth 取消/重试仍延期。

状态词：`完成` = 不要重做；`脚手架` = 能跑，不算产品闭环；`未过` / `未做` = 挡住后续；`卡上游` = 设计留位，Mobile 不发明语义；`未到` = 还没轮到。

| Phase | 别名 | 内容 | 状态 | 退出才算过 | 未过禁止 |
| --- | --- | --- | --- | --- | --- |
| 0 盘点 | — | Stellar `页面 → 业务 → 用例 → 编排 → SDK/API → storage`，并标必须留 / 重构 / 删 / 复用 / 交 Core | **完成**（有界，见 §6.0） | §6.0 所列表面与共享交易链已写入，并对照 Fresnica | 用「再扫全目录」挡住 2c；把 §7 产品表当成已经盘过调用链 |
| 0b 架构边界 | §1–§2 | UI 不碰 SDK / Realm / 裸 XDR；私钥 Core；无 `services/` | 完成 | 分层禁令写进指南且新代码遵守 | 加回全局 service、页面直接拼 Transaction |
| 1 骨架 | F1 部分 | build、启动、目录、CI | 完成 | App 能启动；CI 能跑真实步骤 | 再搭空 App |
| 2a 注入 / 存储 / 网络 | — | `createAppServices`、Realm 身份、Horizon gateway | 完成 | 一份注入；密钥不进 Realm；链上快照不当 Realm 真值 | 重写存储/SDK 当「重写项目」 |
| 2b 导航壳 | F0、F2 | React Navigation：根 stack + tabs + OverlayHost | 完成 | 主壳 tabs + 每 tab native-stack；Actions 为 overlay | 加 RNN / `NavigationService` |
| 2c 主题 / 状态栏 / 安全区 | F3 | 可替换 `AppTheme`、壳 `StatusBar`、inset | light/dark/system/image、图片调色与 Settings 入口已实现；完整视觉/原生验收未封板 | §6 F3 契约与原生/可访问性证据分别成立 | 把主题模式已实现等同最终视觉或 L4 |
| 2d 日志 | — | Session logs / 统一 Logger | 脱敏 logger、Developer Mode Session Logs 查看/清空/分享已实现；完整诊断与原生验收仍有边界 | 日志无密钥/明文 XDR；导出与取消/失败有证据 | 在业务 PR 里发明第二套日志 |
| 2e 会话 / 锁 | — | 一份选中账户；真实 `locked` 生命周期 | 应用锁、OS 生物识别 App access/口令回退、超时/隐私设置已实现 | App access 与签名授权独立；原生设备验收另列 | 假 PIN；把解锁凭证传给签名；各 Tab 独立选中态 |
| 3 Core 边界 | capability-status | Account / Balance / Payment / Transaction / Trustline / Signing / Gateway | 支持范围内主体已实现，Swap/Claimable/SDEX/LP 和受限 dApp 复用边界 | App 消费 capability，SDK/Core 负责敏感操作 | 在 Mobile 发明未支持的 Soroban、多签或 provider 语义 |
| 4 Account 切片 | F4-1 | 创建/导入/HD/watch-only、备份、账户生命周期 | 已实现；历史 L3 / L4 partial；本轮输入/清理修复为候选 | §9 Onboarding 与当前 S01/S02 规格；硬件/完整原生验收另列 | 把自动回归记作原生验收；重做未受影响流程 |
| 5 Wallet / Balance | F4-2 | 选中账户、snapshot/cache、Home、未激活/离线 | 已实现；历史 L3 / L4 partial；本轮信用资产投影为候选 | §9 Home；分区缓存和权威重读；完整估值/原生证据另列 | 将缓存当链上真值；乐观改余额；XLM 估值冒充全资产估值 |
| 6 交易框架 | — | prepare → review → authorize → sign → submit → 协调/结果 | **Stage 2.5 完成**：S07/S30 共用 pre-broadcast pending、无时效 duplicate guard、single-flight lifecycle reconciliation 与 read invalidation；Android 真实 Testnet process-death/restart 已验证 | 新写路径必须复用同一提交/reconciliation 管线并满足自己的 Capability/Stage 门 | 另建提交/恢复管线；把基础恢复通过误当成未开工写类型已获授权 |
| 7 Send / Request | F4-3、F4-4 | 精确 XDR Send；SEP-7 / QR / Share / ingress | Details→Recipient→Summary、全局 Contacts、typed Memo 与 Request/扫码/Deep Link 已实现；M 暂停 | §9 Send/Request；fresh App Passphrase；剩余原生验收 | 把公开请求预填当签名或网络授权 |
| 8 Swap / SDEX | F4 表内未编号 | Path Payment；SDEX 独立；LP 退出 | 报价/执行、订单管理、LP 持仓/退出已实现；完整交易面板及原生验收未完成 | 各自 Capability 与共享恢复；LP 存入/建池另列 | 沿用旧 #134 阻塞；Swap/SDEX/LP 混名 |
| 9 Security | F4-9 部分 | App access、恢复材料/改口令、硬件、隐私 | 应用锁/reveal/reprotect/隐私已实现；硬件、Realm 加密生命周期及设备验收未完成 | §7.6–§7.7、§9 Security 与现行 S04 策略 | 把 App unlock 当签名授权；把 Developer Mode 当密钥鉴权 |
| 10 Settings / 次要 | F4-5–8 | 主题/日志/网络、Activity、dApps、Help | 受支持产品流已实现；dApps 是受限签名矩阵；Terms 正文、完整支持及原生验收未完成 | 对应 §9 与行为规格；支持范围、失败路径、证据分别记录 | 把有限矩阵当任意 Soroban/dApp 支持；复制 donor |
| 11 发布 | — | 异常、deep link、崩溃、商店 | Deep Link 与 Android 前台 dApp 本地通知已实现；完整通知/发布及原生验收未完成 | 签名/身份/发布和原生矩阵；Stage 9 iOS 真机 auth 延期项闭合 | 用 CI 或 `steps:null` 当原生发布验收 |

当前以既有实现为基础修复跨流程状态合同，不再把 Create/Import/HD、Request、Swap、dApps、主题或应用锁当作未开工。实现范围、exact-HEAD 审查和原生验收分别记录；本轮修复候选不提升 L4。Soroban 合约资产/auth-entry、硬件/完整多签、完整通知和发布仍是后续产品阶段；WalletConnect 关闭、M 地址暂停和 Terms owner 内容待定保持不变。新改账本类型必须经过自己的 Capability 门并复用共享提交/恢复。

### PR 门禁

| 门禁 | 通过 | 失败 |
| --- | --- | --- |
| 垂直切片 | 该功能 UI → feature 状态 → capability → platform → 测试一次做完 | 先铺完全部 UI，或先抽一堆无调用方的基础类 |
| 交易一体 | 新的改账本路径复用 Phase 6 管线 | Send / Trustline / 以后的 Swap 各写一套 |
| 闭环进度 | 账户、余额、精确交易、返回后失效能讲清楚 | 用重写了几个屏幕当进度 |

### 闭合表（有什么，不管排期）

```text
产品壳  Home | Activity | Actions | dApps | Settings     §4
        ├─ 产品表面   §7 + §7.8
        ├─ 工程角色   §14
        └─ 数据权威   §2.1
```

三张表权威同级。漏项入表，不要在代码里发明。不要拿 Xaman / Stellar **目录**当全集。状态栏、安全区、交易后刷新不在 Tab 名里，但在 §14 / §2.1。

---

## 1. 权威

```text
Stellar 产品思路（壳、流程、交互角色）
        ↓
Fresnica Mobile features / 呈现层   （重写）
        ↓
Fresnica Application Capabilities   （不是 services 层）
        ↓
platform 适配器（Native SDK、Horizon、Realm、OS）
```

Stellar 从 Xaman fork 而来。Stellar 和 Xaman 的源码都不是可合并的 donor。

本地思路检出（gitignore 的 `/origin`）：

| 树 | 角色 |
| --- | --- |
| `origin/Stellar` 分支 `stellar-migration` | 产品壳、屏幕层级、交互角色和 dApp 行为参考；整体仍是 Xaman 派生树，默认 clean-room 重写；Vault / 加密只参考角色 |
| `origin/Xaman-App` | 打包方式、token、lint / 别名；Developer Mode 产品角色 |
| `origin/fresnica` | Application Capability / Core / SDK 契约 |

### 1.1 源码策略

| 来源 | 做法 |
| --- | --- |
| Stellar dApp 增改（目录、浏览器、Freighter 桥、权限、数据互通、disclaimer） | 保留产品行为，按 Stage 0A provenance 分类后 clean-room 重写到 `features/dapps` + platform；只有能证明独立权利并获批的文件可直接移植。不要缩成空 Tab，不走 Xaman xApps，不引入全局 `services/` |
| Stellar Vault / 加密（`Overlay/Vault`、`common/libs/vault.ts`、native keychain） | **参考**交互与分层；密钥与信封权威仍是 Fresnica Core / Native SDK |
| 其余 Stellar / Xaman 屏幕、helper、boot | 只借鉴角色，在 Fresnica 分层重写 |
| `Navigator`、`NavigationService`、RNN boot、`StyleService`、PIN / Secret Number、XRPL 控件 | 禁止照抄 |
| Account 与 Signer 耦合、Xaman 私有 Vault 当安全权威 | 禁止。Fresnica 保持 Account ≠ Signer |

Stellar 里有某个屏幕，只证明需要审计该产品行为，不代表可以粘贴实现。dApp 不再是目录级例外。

在 `origin/Stellar@bd0f4540` 上，**可见文案**已经是 Activity / dApps（`global.events` = "Activity"，`global.xapps` = "dApps"）。**RNN id 和文件夹**仍是 Events / XApps。跟可见产品壳，不要跟残留 id。

---

## 2. 分层：用 Capabilities，不要 services

这次重写不重新引入 Xaman 式的全局 `services/` 层。

既有规则：`AGENTS.md`、`docs/mobile-architecture-style-guide.md` §3、`feature-design.md`。

| 层 | 负责 | 不得负责 |
| --- | --- | --- |
| `app/` | 组合、导航、启动 | 钱包策略、XDR 含义 |
| `features/` | 产品流程、屏幕、功能内状态 | Realm、NativeModules、Stellar SDK、`platform/**` |
| `capabilities/` | 可复用的钱包语义 | React / React Native、Realm、呈现层 |
| `platform/` | Native SDK、Horizon、Realm、OS | 产品流程、审阅文案、鉴权策略 |
| `ui/` | 呈现原语 | features、capabilities、platform |

不要加 `src/services`。功能编排留在 feature。语义规则留在 Capabilities。机制留在 platform。`app/` 注入同一份依赖，这是接线统一，不是再做一层会改余额的全局服务。

`capabilities/history` 仍叫 History capability。**Activity** 是产品 Tab 名。不要为了跟 Tab 对齐去改 capability 名。

### 2.1 数据权威

按数据种类定唯一真值。不要追求「一个对象装下所有数据」，也不要把链上快照写进 Realm 当余额真值。

| 种类 | 权威 | 不得当作权威 |
| --- | --- | --- |
| 钱包身份（账户列表、标签、公开地址） | 一份 Realm 仓库，经 Account capability / `app/` 注入 | 各屏幕自己开 Realm；内存里再维护一份「真」列表 |
| 密钥、助记词、解密后的 signer | Fresnica Core / Native SDK | Realm、导航参数、普通 AsyncStorage、feature 状态长期保存 |
| 当前选中账户 | `app/` 组合层持有的公开 `accountId` | 每个 Tab 各自一份互不同步的选中态 |
| 链上事实（余额、是否激活、trustline、手续费/储备） | Horizon，经 Balance / Trustline / Payment 等 capability | 把上次 snapshot **当成**已上链真值；乐观改数字 |
| 历史操作 | Horizon 仍是权威；**允许**上次已拉页面的 UX 缓存（先展示再后台刷新） | 用本地缓存宣称「历史已完整 / 缺口已补全」（那是 donor 缺口恢复，History 契约没有） |
| 慢变展示数据（资产图标/名称、目录 etag） | 本地缓存 + 过期再拉 | 可信 origin、签名授权、账本余额或精确 XDR |
| Claimable 快照 / 用户风险标记 | 快照按账户/网络缓存并受账本失效驱动；风险 override 是独立用户数据 | 仅凭 TTL 宣称账本仍新鲜；把风险标记当链上事实。本轮失效/删除修复尚待统一 Review |
| 用户 RPC / 网络列表 | 本地持久化（Settings）；当前连接走 gateway | 未完成网络会话切换却宣称已经连接成功 |
| 可见网络 | Mainnet 正常默认；Testnet/custom node 由警告/确认式 Developer Mode 门控，既有 Testnet 恢复例外按现行规格 | 把 Developer Mode 或网络偏好当签名授权 |

**交易后怎么更新余额（也适用于 Trustline / 任何已上链结果）：**

1. 提交成功只说明网关收了那份已审阅 XDR。不改 Realm 账户记录，不在本地做乐观加减。
2. 结果为 submitted 或 uncertain，都把该账户的 Balance（以及已打开的 History）标过期。
3. Home / Activity 若仍挂在 native-stack 下（Send 是 push 上去的），返回时必须因 **focus 或显式失效** 再跑 `loadBalanceSnapshot` / 历史刷新。不能只靠首次 mount，也不能假设 `popToTop` 会卸载 Home。
4. 下拉刷新走同一条 capability，不另开数据源。
5. Horizon 404 是未激活；请求失败是断网 / 网关错误。二者不要和「刚转完、旧 snapshot 还在」混成一种 UI。

Stage 2.5 已把 submitted/uncertain 写入 network/account-scoped invalidation，并接入 focus 与交易核对。2026-10-23 核查确认：原 foreground/network recovery 只核对 pending，无 pending 时不会因此刷新读取。补齐规格见 `docs/behavior-specs/account-data-lifecycle.md`：LC1 已通过 PR #111 合并（`2452623`），把生命周期读取失效与交易核对分离，补首次在线、后台门控、请求合并和旧响应隔离。余额展示缓存 LC2 已通过 PR #112 合并（`be96178`）。LC3 前台事件流已通过 PR #113 合并（`ea007d8`）；LC4 节点恢复与提交后有界收敛已通过 PR #114 合并（`288f5ca`）。原生到账/延迟与设备验收尚未完成。LC5 的 Request/dApps 和慢变缓存消费者已进入基线；Claimable 当前消费者也已实现，本轮修复 TTL 内失效和 Home 首次发现。最终候选证据以当前进度登记为准，不从既有 LC1–LC4 证据外推。

**UX 缓存（要做）和「缓存当权威」（不做）不是同一件事。** 上次余额/历史可以立刻上屏，但过期后必须再问 Horizon；交易后必须失效。Stellar 把余额写进 Realm 当真值，那条不要。

---

## 3. 目标 vs 现状

本节按上述 exact main 基线记录当前实现，§7–§9 仍定义完整目标。支持范围内的可达实现不等于 Stellar 全量对齐或原生验收。新代码使用目标产品名，不加 Events / XApps 兼容别名。

| 事项 | 目标 | 当前实现与验收边界 |
| --- | --- | --- |
| 产品壳 | Home / Activity / Actions / dApps / Settings | 四目的地与 Actions overlay 已实现；A1–A5 已合并，含通用扫码、Recent、featured 和 Swap source preflight；#231 UI 已进入基线，原生/可访问性验收另列 |
| Tab id | `home`、`activity`、`dapps`、`settings` | 已是这些 id |
| Activity | 完整列表 / 筛选 / 详情 | 分页/搜索/筛选/详情、主要 operation-family 与可核实 effects、缓存/离线已实现；完整原生矩阵尚未封板 |
| dApps | clean-room 目录、Recent、浏览器、权限、Freighter 桥 | catalog/details/cache、Recent、custom URL/disclaimer、origin 生命周期、授权/撤销、受限支付签名和 SEP-53 已实现；Soroban/token/auth-entry 不支持，WalletConnect 关闭 |
| Developer Mode | 警告/确认开启、网络可见性、日志、开发者设置 | Network 工具与脱敏 Session Logs 查看/清空/分享已实现；不要求签名口令。完整开发工具及原生验收仍有边界 |
| 硬件钱包 | 产品内一等 signer（添加、签名、账户列表） | 类型里有 `hardware`，产品流 **未做** |
| Vault / 加密 | 敏感材料/授权生命周期由 Core 和原生机制约束 | 已有 passphrase/reveal/change-passphrase 产品流；没有引入 donor Vault。Realm 加密密钥生命周期和硬件仍未完成 |
| 自定义主题 | 图片取色生成 `AppTheme` 并持久化 | light/dark/system/image 和图片调色、Settings 入口已实现；完整视觉/设备验收另列 |
| 状态栏 / 安全区 | 对比度跟随主题；壳消费设备 inset | App-level `StatusBar`、`SafeAreaProvider`、shared `Screen` 和模式切换已接；需要逐表面原生/动态字体/读屏证据 |
| 导航 | 根 stack + tabs + 每 tab native-stack + overlay | `SessionGate` 在导航外承载真实 SessionUnlock；AppNavigator 保留旧 `locked` route 占位。Review、扫码、Actions/账户选择等产品角色已可达 |
| 链上快照 | submitted/uncertain、账本事件与生命周期按账户失效，再问权威 | Balance/History 读取有分区/代次隔离和可替换缓存；本轮 Claimable revision/首次发现及删除后旧响应退休仍是候选 |
| i18n | 已改写表面无硬编码产品文案 | 语言运行时和共享词典已实现；局部旧英文与完整读屏/动态字体验收仍需按产品表面收口 |

Stage 0A 的历史 presentation remediation 记录继续保留；现已实现的主题与 #231 UI 不应倒退标成纯文字脚手架。最终视觉、可访问性和原生产品验收仍各自记录；替换 presentation 不重写 Capability、Transaction 或 Platform。

安全不变量仍要遵守（Account ≠ Signer、密钥不进 JS 持久化、会改账本的路径绑精确 XDR）。它们约束怎么实现，不证明当前屏幕已经写完。`docs/mobile-capability-status.md` 分别记录实现范围与证据，不单凭可达页面判定产品验收。

---


## 4. 产品壳

```text
Home | Activity | Actions | dApps | Settings
```

- `Home`、`Activity`、`dApps`、`Settings` 是真正的目的地。
- `Actions` 是中间触发器。它打开操作 overlay，不得变成被选中的 Tab。
- 2026-11-26 owner 决策：中文默认将 Activity 底栏位置替换为 fex 快捷操作，可在 General Settings 关闭；非中文保持 Activity。保留 Activity 路由并在 Actions 提供条件入口；复用不受信任网站确认，不新增 Tab。见 [行为规格](behavior-specs/activity-fex-shortcut.md)。
- 产品生命周期包含 bootstrap、onboarding/setup、App access 锁定和 main；真实锁屏由导航外的 `SessionGate` 呈现。
- `SessionGate` 使用真实 App access 生命周期；OS 生物识别/口令回退与每次签名授权分开。旧 `locked` route 占位不能作为应用锁未实现的依据。

当前 feature 归属：

| Tab / 操作 | 目标 feature | 当前目录 |
| --- | --- | --- |
| Home | `features/home` | `features/home` |
| Activity | `features/activity` | `features/activity` |
| dApps | `features/dapps` | `features/dapps` |
| Settings | `features/settings` | `features/settings` |
| Send / Request / Swap | `features/send`、`features/request`、`features/swap` | 三条支持范围内的产品流均已实现 |

产品壳的 locale key 用产品名（`activity`、`dapps`），不用 donor 残留 id。

---

## 5. 导航角色

产品完整需要四种角色。F0 已选 **React Navigation**，不用 Wix RNN。

| 角色 | Stellar / Xaman 机制 | Fresnica 实现 |
| --- | --- | --- |
| 根 / tabs | RNN `setRoot` 底栏 | React Navigation bottom tabs：Home / Activity / dApps / Settings |
| Stack | RNN `push` / `pop` | `@react-navigation/native-stack`，不是屏幕 switch |
| Modal | RNN `showModal` | Stack `presentation: 'modal'`（审阅、扫码、提交、选择器、浏览器） |
| Overlay | RNN `showOverlay` | 导航树之上的 `app/` OverlayHost（Actions、鉴权、锁、Alert、切账户） |

Wix `react-native-navigation` 是 MIT，用它不构成 Xaman 许可证问题。它仍**不是** Fresnica 的库：它会接管 native 根（`AppDelegate` / `MainActivity`），和现有 Native SDK + Realm 启动抢根，且上游只在 RN 0.85.2 验证过（本应用是 0.87）。不要抄 Xaman / Stellar 的 `Navigator`、`NavigationService`、`StyleService`。

Fresnica 组合：

```text
App
  OverlayHost          （Actions、鉴权、锁、Alert、切账户）
  NavigationContainer
    native-stack
      onboarding / locked / main tabs
        每个 tab：native-stack
        Send / 审阅 / Settings：stack 或 modal
```

`app/navigation` 负责 tab / stack / modal。OverlayHost 留在 `app/` 组合层。feature 不得 import 全局 `NavigationService`。只有当 OverlayHost 无法覆盖必须盖住原生 modal 的锁 / 鉴权层，并且把失败证据记下来，才重新考虑 RNN。

AppNavigator 按 bootstrap 条件注册产品根；外层 `SessionGate` 按 applicationSession 状态显示 SessionUnlock 或导航。旧 `locked` route 仍保留占位，实际锁屏不靠跳转该 route。根生命周期不是产品 destination `switch`，不为文档形式重建导航。

F2 已用稳定 React Navigation 7.x，并匹配 `react-native-screens`、`react-native-safe-area-context`。`react-native-gesture-handler` 尚未装；需要手势栈或 modal 手势时再补。不要在本指南里钉 pre-release。

导航参数只能带公开 ID。精确 XDR、助记词、口令和解密后的 signer 材料留在所属流程 / controller。

### 5.1 根生命周期

这四段不要混名。产品表里的 Onboarding 不是启动闪屏，也不是 JS 起服务。

```text
原生 Splash（LaunchScreen / 启动主题）
        ↓
JS bootstrap     装 polyfill、建 Realm / SDK / gateway（createAppServices）
        ↓
钱包就绪判定      runtime.bootstrap / resolveOnboardingBootstrap
        ↓
onboarding       创建 / 导入 / 待备份（产品流）
        ↓
SessionGate      应用锁；OS 生物识别 / SDK 口令回退，独立于签名授权
        ↓
main             四 Tab + OverlayHost
```

| 名字 | 是什么 | 不是什么 |
| --- | --- | --- |
| Splash | 原生启动画面，JS 起来前 | 产品 Onboarding；也不是 `bootstrap` 路由 |
| `bootstrap` 路由 | JS 启动闸：依赖还没有、或启动失败 | 闪屏；钱包已就绪后的空白页 |
| Onboarding | 没有可用钱包、或待备份时的产品栈 | 每次冷启动都要走的 Splash |
| App access / `locked` 角色 | `SessionGate` / SessionUnlock 的真实锁定恢复；同名导航 route 仍是旧占位 | 签名授权、导出授权或假 PIN |

根流程按实际 bootstrap / App access 生命周期选择产品分支；锁定和离开前台不应让旧审核回调恢复有效。

---

## 6. 施工合同（F 别名）

**排队以文首成熟度总表为准。** 本节只保留总表引用的合同细节。不要把 F0–F4 读成「F2 完了就做 F3」。

Phase 0 和主题/壳模式实现均已有基础；当前剩余验收按文首总表逐项记录。不要重复搭建 F1–F3，也不要把无关产品 Capability 混在一批改动里。

### 6.0 Phase 0 盘点（有界，历史快照）

以下盘点保留原阶段对 Stellar 调用链和 Fresnica 当时缺口的记录，不代表 2026-11-24 的功能状态。表中的「脚手架／未做／卡上游」只说明当时情况；当前实现以文首成熟度表、§3 和当前行为规格为准，尤其 Swap、应用锁、Request、dApps、主题与日志已不再沿用旧阻塞。

范围：Onboarding、Home、Send、Activity、Settings、Trustline、dApps，以及共享审阅 / 提交 / 鉴权 / Vault。不扫 Stellar 每一个 XRPL 残留模板。

标记：`留角色` = 产品行为要有；`重构` = 在 Fresnica 分层 clean-room 重写，不抄文件；`删载体` = 不要 service / RNN / 把余额写入 Realm；`交 Core` = 密钥、签名、口令、System Auth；`Exclude` = 不做。历史“照搬”标记一律解释为“保留行为并重写”，除非 Stage 0A 给出文件级独立权利证据和审批。

Stellar 的「编排」是全局 `services/` + Repository。Fresnica 对应是 `feature 编排 + capability + app 注入`，没有 service 层。

#### Stellar 编排层（按服务）

| Stellar 载体 | 实际职责 | 标记 | Fresnica |
| --- | --- | --- | --- |
| `AccountService` | 订 Horizon stream；`getAccountInfo` 后把余额 / trustline **写进 Realm AccountDetails**；提交后 `refreshAfterSubmittedTx` | 删载体；留「交易后刷新」角色 | Balance / History 失效再拉；**禁止**把链上快照当 Realm 真值 |
| `LedgerService` | Horizon 账户/操作/submit；部分仍带 XRPL 方法名 | 重构 | `StellarSdkGateway` + Payment/Trustline/Transaction capability |
| `NetworkService` | Horizon 连接、通断、当前网络、**用户增删 RPC**、节点健康、切换网络 | 留完整角色，重构载体 | 当前候选以持久化网络偏好创建不可变网关会话；Mainnet 默认，Testnet/custom node 由 Developer Mode 门控。`APP_CONFIG.network` 仅保留显式 Testnet helper fixture；原生验收未完成 |
| `AuthenticationService` | 口令 / 生物识别；超时后弹出 Lock overlay | 重构 + 交 Core | System Auth 已有；**应用锁**卡上游会话 API |
| `AppService` | AppState、NetInfo、后台 15s 无操作后标 Inactive（给鉴权去决定要不要锁） | 留角色 | 见下「进锁」；不要抄 IAP 例外 |
| `NavigationService` | 全局导航单例 | 删载体 | React Navigation |
| `StyleService` | 可变主题 + mergeOptions | 删载体 | `AppTheme`（2c 未做） |
| `BackendService` / `ApiService` | Xaman 云 API（地址咨询、KYC、third-party permissions） | Exclude 云；本机解析不依赖它 | 无 Fresnica 后端则不要假装有咨询源 |
| `DappCatalogService` | FChain 目录（etag / 24h 详情缓存） | 保留行为，clean-room 重写 | 未做 |
| `PermissionManager` | dApp 权限 | 保留行为，重写进 capability | 未做 |
| `LoggerService` | Session logs | 留角色 | 未做（2d） |
| `StellarSwapService` | Horizon strict-send/receive 报价 | 留角色；**执行卡上游 Path Payment 契约** | 钱包要有 Swap。未到契约前可盘点 UI，**不得**在 Mobile 发明滑点/路径语义 |
| `PushNotificationsService` | Firebase + Xaman 载荷（SignRequest / OpenXApp / OpenTx） | **用户提升为要做**；不能整段搬 | 与原 §7.1 Exclude 冲突，见下。需 Fresnica 自己的推送事件，不要 Xaman 云签请求 |
| `ResolverService` | 地址显示名：通讯录 → 本机账户标签 →（可选）Xaman `BackendService` 咨询/KYC/拉黑；LRU 300；SEP-29 memo required | 留本机解析；云咨询 Exclude | 见下 |
| `ClaimableBalanceService` | Horizon claimable 分页、Realm 快照 TTL 1h、垃圾分类、claim 走 TransactionBuilder | **留并搬运**（Stellar 自研） | 读路径可迁入分层；**claim 必须走 Phase 6 交易管线**，不要页面拼 TX |
| `StellarAssetMetadataService` / `StellarTokenRegistryService` | stellar.toml + 社区 curated list、合并索引、AddToken 缓存 | **留，本地缓存** | Fresnica **尚未设计**。要补 platform 缓存，不当余额权威 |
| `StellarFriendbotService` | 仅 Testnet 调 friendbot.stellar.org | **留** | Home 未激活按钮；脚手架里被故意拿掉了 |
| `LinkingService` | 冷启动/运行时 URL；实现里 **XRPL/Xaman decode 仍是 stub** | **留角色，按 Stellar URI 重写** | 不能照搬当前 stub。原排在 Phase 11，产品要求提前做 |

#### 存储

| Stellar | 存什么 | 标记 | Fresnica |
| --- | --- | --- | --- |
| Realm `Account` | 地址、标签、accessLevel、derivationPath | 留角色 | `AccountSignerRepository`；Account ≠ Signer |
| Realm `AccountDetails` | 余额、sequence、trustline | **UX 缓存可留形态**；删「当真值」 | 允许上次 snapshot 上屏；权威仍是 Horizon；交易后失效 |
| Realm `AccountOperation` | 历史页缓存 | **UX 缓存要做**；删「缺口恢复当完整历史」 | Activity 打开先出上次列表再刷新。原 stage-plan non-goal 过粗，见冲突 |
| Realm `Node` / `Network` | 用户 RPC 列表 | 留 | 未做 |
| Realm `ClaimableBalance` | 待领快照 TTL 1h | 留（随 Claimable 搬运） | 无 |
| Realm `Currency` | 资产名/图标，24h 过期 | 留，走 metadata 缓存 | 无 |
| Realm `Contact` | 地址簿 | Adapt | S22 网络隔离、本地联系人与 destination picker；见 `behavior-specs/s22-address-book.md`，候选未验收 |
| Realm `Core` | Dev Mode、默认账户、网络偏好 | 重构 | 语言 store 已有；Dev Mode 未做 |
| Native `Vault` | 私钥/助记词密文；Realm 库加密钥也从这来 | 交 Core | Fresnica SDK envelope；Realm 不存密钥 |
| `common/libs/stellar/keypair.ts` | JS 侧生成/派生密钥 | 交 Core | 禁止 feature 用 Stellar SDK 出密钥 |

#### 按表面调用链

**Onboarding / Setup / 加账户**

```text
OnboardingView / Setup Passcode·Biometry / Account Generate·Import
  → 创建或导入身份、设口令、待备份
  → AccountRepository.add + Vault.create（私钥/助记词）
  → stellar/keypair.ts 在 JS 里派生
  → Realm Account；密钥进 Vault
```

| 标记 | Fresnica |
| --- | --- |
| 留角色：创建/导入/观察/待备份/硬件入口 | `features/onboarding` + Account/Signer capability；**脚手架** |
| 交 Core：助记词、口令、envelope | `provisionAccount` 已走 SDK；不要抄 `keypair.ts` |
| 删：Tangem、Cipher 迁移、Setup Push | §7 Exclude |
| 重构：Setup Passcode → 应用口令，不是 PIN | 部分在 onboarding |

**Home**

```text
HomeView
  → 当前账户、资产列表、切账户、Actions
  → AccountRepository 听 accountUpdate；AccountService.updateAccountsDetails
  → LedgerService.getAccountInfo / Horizon
  → 写回 Realm AccountDetails（Stellar 把这当真值）
InactiveAccount（测试网）
  → StellarFriendbotService.fundAccount
HomeActions
  → Swap、扫码、Recent dApps、Exchange（按资产）
资产行
  → 管理/添加 trustline（增减资产）
```

| 标记 | Fresnica |
| --- | --- |
| 留角色：账户、切换、主操作、资产；未激活 ≠ 断网 | `HomeScreen` + `loadBalanceSnapshot`；**脚手架** |
| **留：HomeActions 扫码** | Stellar 中间操作 overlay 含扫码，打开共享 `Modal/Scan`。当前 Fresnica Actions 只有 Send、Swap、Request。付款请求扫描在 Request，见 §7.4 |
| **留：测试网 Friendbot 激活按钮** | 当前 `InactiveAccountPanel` 只保留公开地址、资金提示和 refresh；自动 Friendbot 激活按钮仍是产品缺口，要按 Network/Testnet 边界单独补 |
| **留：资产增减**（进 Trustline 精确 XDR，不是 Home 里直接改余额） | Manage Assets 能力有；Home 入口要保留 |
| 删载体：Realm 当余额真值 | 交易后 focus + Stage 2.5 read invalidation 已接；UX 上仍可先显示上次 snapshot，但权威继续来自 Horizon |
| LP / claimable 详情 | Claimable **搬运**；LP 仍按 §7.8 |

#### Stellar 已做的缓存（Fresnica 要对齐思想）

| 点 | Stellar | Fresnica |
| --- | --- | --- |
| 账户余额/trustline | Realm `AccountDetails`，stream 写回 | 可作 **stale-while-revalidate**，不能当账本 |
| Activity 操作 | `AccountOperationRepository.saveAccountOperations` | **要做** UX 缓存；不要做「补洞后的完整历史」 |
| Claimable | Realm + 1h TTL | 随搬运 |
| 地址显示名 | Resolver LRU 300 | 本机通讯录/账户名缓存；不要 Xaman 咨询缓存 |
| 资产元数据 | toml / curated list / Currency 24h | **尚未设计，要补** |
| dApp 目录 | etag + Preferences + 24h 详情 | 随 dApp clean-room 重写 |
| dApp 图标 / Recent | IconCache、VisitHistory | 随 dApp |
| RPC 节点 | Realm Node | 要做 |
| Resolver 清除 | Dev settings「清缓存」 | 可留在 Dev Mode |

**Send**

```text
SendView 五步（Recipient → Details → Summary → Submitting → Result）
  → 选币、金额、memo（文件名 DestinationTag）、构建、提交
  → 页面内 `new TransactionBuilder` + Operation.payment / createAccount
  → Vault overlay 签名 → LedgerService.submitTransaction(XDR)
  → AccountService.refreshAfterSubmittedTx → 再写 Realm
```

| 标记 | Fresnica |
| --- | --- |
| 留角色：表单→准备→精确审阅→授权→提交→结果；memo | `sendProductFlow` + Payment capability；**脚手架**（产品未按 §9 完成） |
| 删载体：屏幕里 `TransactionBuilder`；乐观/Realm 改余额 | 精确 XDR 已在 capability；**禁止**页面拼 TX |
| 重构：DestinationTag UI → Stellar memo | §7.8 Adopt |
| FlaggedDestination | 流程内警告，Adopt |

**共享交易（审阅 / 提交 / 鉴权 / Vault）**

```text
ReviewTransaction / Submit / TransactionLoader
  → 通用审阅与提交（Send 另有一条自建 TX）
  → transaction.submit() → LedgerService
VaultOverlay
  → 解密签名 / 选 signer
  → Vault.open + 本地 sign
Authenticate / PassphraseAuthentication
  → 口令或生物识别
  → AuthenticationService
Lock
  → 前后台锁
  → AppService + AuthenticationService
```

| 标记 | Fresnica |
| --- | --- |
| 留角色：一套 prepare→review→authorize→sign→submit | Payment 与 Trustline **已共用**提交管线；UI 仍脚手架 |
| 交 Core：签名、揭示、System Auth | Signing Coordination 已有 |
| 删：Review 里大量 XRPL `genuine/*` 模板、PurchaseProduct | Exclude |
| 锁 | 留位，卡上游，不伪造 |

**Activity**

```text
EventsView / Details / FilterEvents
  → 列表、筛选、详情
  → LedgerService.getAccountOperations
  → 写入 AccountOperationRepository 再读缓存
```

| 标记 | Fresnica |
| --- | --- |
| 留角色：列表/刷新/更多/空态/详情/已加载页筛选 | `features/activity` + History；列表与单 operation detail 已接，筛选/搜索和完整 operation family 仍未闭合 |
| 删：Realm 操作缓存当权威 | 不做缺口恢复 |
| 呈现层 helpers（operation 分类） | 重构，不抄 XRPL 语义 |

**Trustline / 管理资产**

```text
AddToken / TokenSettings
  → 加/改 trustline
  → 页面内 TransactionBuilder + Operation.changeTrust
  → Vault 签 → LedgerService.submit
```

| 标记 | Fresnica |
| --- | --- |
| 留角色：Add/Remove 精确 XDR | `trustlineProductFlow`；**脚手架/能力已接** |
| 删载体：页面拼 `changeTrust` | 与 Send 同一套提交管线 |
| Set Limit | S30 已实现并进入统一 exact-XDR / revalidation / recovery 管线；完整产品 L4 仍按 Stage 4 运行验收 |

**Settings（Stellar 实际有的，对照脚手架缺项）**

```text
Settings 根
  账户列表、地址簿、General、Advanced、Security、支持（外链）、条款、About
  ThirdPartyApps 在 Stellar 已隐藏（走 Connected dApps）
  MonetizationElement 内购条 → 仍 Exclude
General
  语言、显示法币 CurrencyPicker、主题（light/dark/moonlight/royal）、跟随系统、触感
Security
  改口令、生物识别、Connected dApps、自动锁定时长、Android 截屏保护
Advanced
  Developer Mode（鉴权+警告；关闭时非 Main 先切回）、网络列表/增删 RPC/节点健康、
  Session logs、Developer settings（清 Resolver 缓存、实验 UI、Realm Viewer）、ChangeLog
```

| 项 | 标记 | Fresnica 现状 |
| --- | --- | --- |
| 账户 / 语言 / About / System Auth | 留 | 部分有 |
| 地址簿 | 留 | 行在，无流程 |
| General 主题 / 触感 / 显示法币 | 留 | **缺**（主题契约在 2c） |
| Advanced 整组 | 留 | 行在，Dev Mode / RPC / logs **缺** |
| 网络增删 RPC | 留（你已确认） | 当前候选已提供鉴权门控增删/测试/选择与回退；原生验收未完成 |
| 自动锁时长 | 留角色 | 锁卡上游，设置项可先留 |
| 截屏保护 | 留，Dev Mode 可关 | 未做 |
| Realm Viewer | 仍 Exclude（开发工具） | — |
| 推送开关 | **提升为要做** | 无；见冲突 |
| 支持外链 | 留 | 行在未接 |
| 条款 InAppBrowser | 留 | 未做 |

**dApps**

```text
XAppsView → DappCatalogService（https://dapp.fchain.io/v1）
  → XAppBrowser + Freighter 注入
  → PermissionManager / DappPermission / Disclaimer / DappShared
  → 签名仍走 Vault / 交易管线
```

| 标记 | Fresnica |
| --- | --- |
| clean-room 重写 Stellar 已形成的目录、Recent、浏览器、桥、权限、数据互通行为 | `features/dapps` **预览壳** |
| 迁入 Fresnica 分层，不搬 `services/` | 待建 dApp 授权 capability |
| 删：Xaman xApps 后端 | 已 Exclude |

#### 对照当时 Fresnica 状态（Phase 0 历史闭合依据）

| 表面 | Stellar 链已梳 | Fresnica |
| --- | --- | --- |
| Onboarding | 是 | 脚手架；密钥已交 SDK |
| Home | 是 | 脚手架；刷新模型与 Stellar 相反（不应写 Realm） |
| Send | 是 | S07 capability/页面与 Stage 2.5 invalidation/recovery 已接；memo family 与完整产品 native/E2E 仍未闭合 |
| 交易框架 | 是 | 能力完成 / UI 脚手架 |
| Activity | 是 | 列表与单 operation detail 已接；筛选/搜索/完整 family projection 未完；不要把操作缓存当权威 |
| Trustline | 是 | 能力有；页面脚手架 |
| Settings | 是 | 分组未按 §7.5 做完 |
| dApps | 是 | 预览壳；clean-room 重写未开始 |
| Vault / 鉴权 / 锁 | 是 | 签名走 Core；锁卡上游 |

有界范围外仍 Exclude 的：Tangem、Cipher、内购 / Monetization、NetworkRailsSync、XRPL Destination tag **名**、Realm Viewer。Xaman `BackendService` 咨询/KYC/third-party-permissions 云 API 仍 Exclude。

**当时与原设计冲突、因产品确认而改表的：** Push（原 §7.1 Exclude）、Activity UX 缓存（原 History non-goal「不要持久化缓存」过粗）、Friendbot/Linking/资产元数据/Claimable 搬运（原盘点标成可选/占位/Phase 11）。当时 Swap 等待 fresnica#134；该记录保留依赖来源，当前支持范围内的 Swap 执行已实现，不再是现行阻塞。

本行退出条件已满足：**Phase 0 过关。** 不得再以「盘点没做」挡 2c。F3 已有浅色语义主题、壳状态栏/安全区与共享 primitive，剩余项以总表和执行计划为准。

### F0 — 导航库决定

状态：**已定**。

```text
库：            React Navigation
                native-stack + bottom tabs + modal presentation
                overlay 角色用 app/ OverlayHost
日期：          2026-09-03
Native smoke：  不适用（未选 RNN）
未选用：        Wix react-native-navigation
```

F2 落实这一选择。不要加 RNN。不要引入 `NavigationService` 或其他全局导航单例。

### F1 — Lint、格式、别名、架构守卫

- 加入 Prettier、ESLint、import 别名（已有的 `@app`、`@capabilities`、`@features`、`@platform`、`@ui`、`@lib`）。
- 正常生成 lockfile。不要手写 lock 数据。
- 在触及 onboarding、accounts、send、activity/history、trustlines、settings、security 这些目录时，把它们纳入 `scripts/check-architecture.mjs` 的严格范围。
- 不要在同一 PR 里既改行为又全库格式化。

退出条件：

- [ ] `npm run check` 包含 format / lint / alias / architecture
- [ ] 严格 feature 里的新代码不能 import `platform`

### F2 — 导航栈和产品 id

状态：**主壳已接上**（2026-09-04）。

- 已用 React Navigation 7 替换 `ProductRuntime` 的 destination `switch`：根 `native-stack` + bottom tabs + 每 tab 的 `native-stack`。
- OverlayHost 在 `app/`。Actions 是 overlay，不是 Tab。
- 运行时 id 和 feature 目录是 Activity / dApps。`capabilities/history` 仍叫 History。
- 导航参数只带公开 ID。

退出条件：

- [x] 主壳是 tabs + 每 tab 的 native-stack，不是产品 destination `switch`
- [x] Tab id 为 `home | activity | dapps | settings`
- [x] Actions 是 overlay，不是被选中的 Tab

F2 尾巴，随对应表面补（不构成「可以开 F3」）：

- 根流程仍按 bootstrap **条件注册** `bootstrap` / `onboarding` / `main`（见 §5 说明）。不必为了主题壳先改成始终挂齐四屏。
- 真实锁定/恢复由 `SessionGate` 承担；保留的 `locked` route 占位不作为产品证据。App access 不授予签名权。
- modal / overlay 已承载审核、扫码、Actions、账户选择与授权；各 surface 继续使用其生命周期/取消边界。
- Activity `operation-details` 已挂入 Activity native stack；导航只传 `accountId + operationId`，详情重新查询 History capability。

### F3 — UI kit 契约（总表 2c；Phase 0 已过，本行部分完成）

组件清单和最终视觉**还没定**。F3 先锁语义契约，不要把当前 `defaultTheme` 或现有扁平组件当成 kit。

必须先成立：

- 语义 `AppTheme`：主色、次主色、背景、表面、文字、边框、状态色。屏幕只消费这些 token，不写裸颜色。
- 自定义主题是产品功能，不是以后再说：用户上传一张图片 → 程序提取主色、次主色等 → 生成一份 `AppTheme` → 全 app 应用并持久化。
- 状态栏内容样式（深色字 / 浅色字）是主题的一部分，由壳随 `AppTheme` 替换而更新。见 §10.1。不要让 feature 写死 `barStyle`。
- 安全区是壳原语（将来的 Screen / Header / TabBar）消费设备 inset，不是每页自己猜刘海高度。见 §10.1。
- §14 里阶段为 F3 的行，必须在契约或壳原语位置上能对上（状态栏、安全区、主题替换、系统导航条）。
- General 原语清单待约定后再补（Screen、Header、Button 等）。钱包专用控件留在 feature，直到出现第二个调用点。
- 向 Xaman 学打包（General 目录、token、lint）和状态栏**产品角色**，不抄色板、品牌、`StyleService`、RNN `statusBar` options、`DeviceUtilsModule`。

退出条件：

- [x] `AppTheme` 语义字段和默认/图片主题替换已实现；该实现勾选不替代原生产品验收
- [x] `AppTheme` 能派生或携带状态栏内容样式（浅底深字 / 深底浅字）；壳随主题替换更新
- [x] 当前约定中的壳组件消费 token；这些文件没有裸颜色
- [x] 自定义主题的入口位置已记在 Settings（实现可在 F4 之后，契约必须在 F3 留下）
- [x] 安全区由壳原语消费 inset（Screen / Header / TabBar 原语）

### F4 — 按产品表重建流程（总表 Phase 4–10；脚手架不算过关）

仅当 Phase 0 已过、且将消费的 Foundation 行已满足时，才按此顺序**重建**（不是把当前脚手架搬到栈上就算完）：

1. Onboarding / 待备份 / 硬件钱包添加入口
2. Home（含切账户、链上 snapshot、从改账本流返回后的失效刷新）
3. Send（精确 XDR；硬件 / 软件 signer 都要能走审阅-签名；结束时失效 Home / Activity）
4. Request（分享公开身份；可紧跟 Send）
5. Activity（列表 / 筛选 / 详情；返回后刷新）
6. Settings，含 **Developer Mode**、语言、网络、Security、自定义主题入口、地址簿、About
7. Trustline / 管理资产（返回同样失效余额）
8. dApps：保留 Stellar 已形成的产品行为，按 Stage 0A provenance 做 clean-room 重写，不是空壳
9. Vault overlay（参考 Stellar，接 Fresnica 签名 / 揭示）

Swap / Path Payment 与 SDEX 挂单已在支持范围内实现并留在产品表（§7.2）；新增交易语义仍须有 Capability 契约。

每个表面必须满足 §8 和对应的 §9，并消费它用到的 §2.1 / §14 行。对照的是 Stellar 产品行为，不是当前 Mobile 占位。

退出条件：这些流程能通过 F2 导航到达；`npm run check` 通过；安全不变量没有被削弱。

Swap 执行、应用锁、已有钱包软件 signer 添加和 Mainnet 已有实现。仍需单独交付的 Realm 加密密钥生命周期、完整多签、硬件签名器继续留在设计中；Mainnet 为正常默认网络，Testnet/custom endpoint 的门控与恢复例外按当前网络规格。

---

## 7. 产品表

Adopt（采用）= 在 Fresnica 重写用户可见表面。Adapt（适配）= 保留角色，改安全 / 协议语义。Exclude（排除）= donor 残留。Exclude 的表面不要实现，除非当前产品 / Capability 需求明确把它提升上来。

### 7.1 Onboarding 与设置

| Stellar 表面 | 决定 | Fresnica 归属 | Capability |
| --- | --- | --- | --- |
| Onboarding | Adopt | `features/onboarding` | Account、Signer、Application Security |
| Setup / Passcode | Adapt 为应用口令 | `features/onboarding`、`features/security` | Application Security、Signing Coordination |
| Setup / Biometry | Adapt 为独立 OS App access；签名另取口令 | `features/security` | Application Security |
| Setup / Push notification | **Adopt**（产品提升；不要搬 Xaman Firebase 签请求） | `features/settings` / platform | 完整通知/Backend 为后续范围；#228 Android 前台本地通知已合并，iOS 不支持；[S21 规格](behavior-specs/s21-dapp-local-notifications.md) 与原生验收分别记录 |
| Setup / Finish | Adopt | `features/onboarding` | Account |

### 7.2 Tab 与主操作

| Stellar 表面 | 决定 | Fresnica 归属 | Capability |
| --- | --- | --- | --- |
| Home | Adopt | `features/home` | Account、Balance |
| Events id / Activity 名 | Adopt 为 Activity | `features/activity` | History |
| XApps id / dApps 名 | 保留 Stellar 目录、Recent、浏览器、权限、Freighter 桥行为，clean-room 重写 | `features/dapps`（受支持子集已实现） | 完整 Soroban/任意交易矩阵仍未完成；donor 仅是行为来源，不可复制实现 |
| Settings | Adopt | `features/settings` | — |
| Overlay / HomeActions | Adopt | app 壳 + feature 操作 | — |
| Send | Adopt | `features/send` | Payment、Transaction、Signing Coordination |
| Request | Adopt | `features/request` | Account（分享公开身份） |
| Exchange / Swap | Adapt 为已实现的 strict-send/receive Swap；原生验收另列 | `features/swap` | Path Payment / Transaction |
| SDEX 挂单 | Adapt 为独立订单产品；列表/创建/修改/取消已实现 | `features/markets` | SDEX / Transaction；市场图表和完整交易面板另列 |

### 7.3 账户

| Stellar 表面 | 决定 | Fresnica 归属 | Capability |
| --- | --- | --- | --- |
| Account Add / Import / Generate / List / Edit | Adopt | `features/accounts` | Account、Signer |
| 添加硬件钱包 | Adopt；设计阶段就纳入，不是 residual | `features/accounts`、Signing | Signer（`hardware`） |
| 查看助记词 / 密钥 | Adopt；可参考 Stellar Vault 揭示交互 | `features/security` | Signer、Application Security |
| 修改口令 | Adopt；当前 SDK 验证/reprotect 与原子持久化路径已实现 | `features/security` | Application Security |
| Tangem（Xaman 卡） | Exclude，除非 Core 明确支持 | — | 不是通用硬件钱包需求 |
| Cipher 迁移 | Exclude | — | donor 残留 |

### 7.4 共享 modal / overlay 词汇

底层必须提供这些角色，即使部分调用方暂时为空：

| 角色 | Stellar 来源 | 决定 |
| --- | --- | --- |
| 审阅交易 | `Modal/ReviewTransaction` | Adopt；绑定精确 XDR |
| 提交 / 进度 / 结果 | `Modal/Submit`、`TransactionLoader` | Adopt |
| 扫码 | `Modal/Scan`，由 HomeActions 打开 | Adopt。Request 摄像头/系统相册 QR 与 A2 Actions 通用扫码均已接线，公开输入进入 typed parser/router；扫描不授予签名权 |
| 币种 / 收款方 / 账户 / 手续费选择器 | Modal + Overlay pickers | Adopt 角色；手续费策略仅在 Capability 支持时 |
| 全局选择器 | `Global/Picker` | Adopt 为共享选择器壳 |
| Alert / 确认 | `Overlay/Alert` | Adopt |
| 鉴权 / 口令 | Auth overlays | Adapt 到 Signing Coordination；可参考 Vault 方法 |
| 锁 | `Overlay/Lock` | Adapt 角色；当前由 SessionGate / Application Session 实现，独立于签名授权 |
| Vault / 解密签名 | `Overlay/Vault`、`common/libs/vault.ts` | **参考**并纳入；接 Fresnica 签名 / 揭示，不要当第二套加密权威 |
| 切换账户 / 网络 | overlays | Adopt |
| 分享账户 | overlay | Adopt |
| 添加代币 / 代币设置 | overlays | Adopt through Trustline |
| 连接问题 | overlay | Adopt |
| 应用内 / dApp 浏览器 | Stellar `Modal/XAppBrowser` 等行为 | clean-room 重写（dApp） |
| 通用内置浏览器 | `Modal/InAppBrowser` | Adopt；条款 / Credits / 外链用这个，不要拿 dApp 浏览器顶替 |
| Memo 输入 | 文件名仍是 `EnterDestinationTag` / `ConfirmDestinationTag` | **Adopt 为 Stellar memo**；Exclude 的只是 XRPL destination-tag **这个名字和语义** |
| Destination tag 名 / PurchaseProduct / NetworkRailsSync | overlays | Exclude |

### 7.5 Settings

```text
Settings
  General
    自定义主题            （上传图片提取色板；契约在 F3，实现可稍后）
  Security
    Connected dApps
    修改口令
  Advanced
    Developer Mode       （必要；见下）
    网络列表 / 添加        （非 Dev Mode 不暴露未开门的 Mainnet 伪装）
    Session logs
    Developer settings   （仅 Dev Mode 开启后）
  地址簿
  Terms / Credits / About
```

除非明确要求开发专用工具，否则 Exclude Realm Viewer。

### 7.6 Developer Mode

Stellar/Xaman 的 Developer Mode 产品角色已在 Fresnica 重写。当前已实现警告/确认开关、网络工具和脱敏 Session Logs；完整诊断工具与原生验收继续按 S23–S25 规格收口。

参考 `origin/Stellar`：`Settings/Advanced/AdvancedSettingsView`、`CoreRepository.isDeveloperModeEnabled`、`NetworkRepository.getVisibleNetworks`。

产品角色：

- Advanced 里开关；开启需阅读警告并确认，不要求 App Passphrase 或签名授权。
- 开启后：显示测试网等非 Main 网络、Session logs、Developer settings、Android 可关截屏保护。
- 关闭时：若当前不在 Main 网络，先切回默认网络再关。
- Send / Token settings 等处的 Dev Mode 分支一并搬产品行为，语义仍走 Fresnica 网络 / 网关。

不要把「现在只连 Testnet」当成已经覆盖了 Dev Mode。Testnet 脚手架 ≠ Developer Mode。

### 7.7 硬件钱包

重写必须按一等能力设计，不要等「以后再加口」。

- 账户添加：软件 signer 之外有硬件入口。首批只把 Ledger Nano X / Flex / Stax、BLE、iOS / Android 列为候选验证矩阵，不把尚未真机验证的 provider/device 组合写成支持承诺；Stellar `hardwareWallet.ts` 仅作产品行为参考。
- 列表与详情能区分硬件账户。
- 审阅 → 授权 → 签名：硬件路径走 Signing Coordination，不要另写一套 XDR。
- Core / SDK 未接通时，UI 可禁用并说明原因，但信息架构和路由要留好。
- Tangem 是 Xaman 卡路径，默认 Exclude，与「支持硬件钱包」不是同一件事。
- Trezor、USB/HID、NFC 与其他 provider/transport 不属于首批范围；只有 provider + device + transport + platform + OS + app/firmware 的真机组合通过后才能标 Supported。

### 7.8 产品表闭合（原未点名）

Stellar 有、§7.1–§7.7 原先没逐行写的表面。这里给决定，避免再当「漏项」或默默丢掉。

| Stellar 表面 | 决定 | Fresnica |
| --- | --- | --- |
| Enter / Confirm DestinationTag（实为 memo） | Adopt | Send 表单 / 审阅；§9 已要求 memo |
| FilterEvents | Adopt 呈现 | Activity：只筛当前已加载页；不发明服务端过滤或 History 持久化缓存 |
| Help | Adopt 角色 | 共享 overlay / modal，给流程内说明；不是独立 Tab |
| ChangeLog | Adopt | Settings / About，或版本升级后的说明；不挡 F4 主交易 |
| InAppBrowser | Adopt | 非 dApp 外链；与 Freighter 浏览器分开 |
| LPDetails / ClaimableDetails / ExplainBalance / SwitchAssetCategory | Adopt 角色 | Home：LP / 待领份额不当成普通代币；详情随 Balance 能表达的事实；契约没有则诚实占位，不 Exclude 这个区分 |
| ThirdPartyApps | Adapt | 并入 Settings Security **Connected dApps** / dApp 权限模型；不另做一页 Xaman「第三方应用」 |
| FlaggedDestination / RequestDecline / ParticipantMenu | Adopt | Send / Request / Activity 流程内警告与菜单 |
| CriticalProcessing | Adapt | 并入提交 / 进度角色，不单开产品 |
| DappShared | 保留行为、clean-room 重写 | 随 dApp 产品一起实现 |
| SDEX 挂单 | Adopt 独立阶段 | 见 §7.2；不要和 Path Payment Exchange 混成一个产品 |

---

## 8. 重写完成标准

一个表面只有下列适用项全部成立，才算重写完成。对照 Stellar 产品行为，**不要对照当前 Mobile 占位是否“已经能点”。**

- 用户可见结构符合 §4 / §7（Activity / dApps 命名，Actions 为 overlay）。
- 用到的横切符合 §14，数据种类符合 §2.1。
- 账本 / 安全语义跟当前 Fresnica Capabilities；不要新增仅 Mobile 的协议策略。
- 屏幕不 import `platform`、Realm、NativeModules 或 `@stellar/stellar-sdk`。
- feature 状态显式；非法迁移失败关闭。
- 会改账本的表面：精确 XDR 身份在审阅、授权、签名、提交之间保持绑定。
- 导航只带公开 ID。
- 文案走 i18n。不要新增硬编码的用户可见字符串。
- 样式用 theme token。不要新增裸颜色字面量。
- 测试覆盖流程状态，以及该表面能到达的 Capability 失败情况。
- `npm run check` 通过；或外部 CI / runner 失败被记为外部失败——绝不当成通过。

---

## 9. 分表面完成标准

与 §8 一起用。除非该行另有说明，底层 F2 必须已经存在。

### Onboarding / 待备份

- 创建 / 导入 / 只读观察仍走 SDK 保护 API。JS 持久化里不得出现明文助记词或口令。
- 添加流程里要有**硬件钱包**入口（§7.7）。Core 未接通时可禁用，不能从信息架构里删掉。
- 已有钱包 Create/Import/HD 已通过 SDK 当前口令验证接通；按当前 S01 规格处理各自授权和敏感输入生命周期，不重复封闭已有路径。
- 待备份助记词是栈上的一等目的地，不能只靠 bootstrap 特例。
- 文案和错误已本地化。

### Home

- 信息顺序仍是：当前账户、切换器、主操作、资产列表。
- 加载 / 未激活 / 已激活 / 错误保持区分。测试网未激活要有 **Friendbot 激活**。LP / claimable 不当成普通代币；claimable **搬运** Stellar 实现。
- Send / 添加账户与 Trustline 精确复核是 stack push。Home 的添加资产和资产详情可用可关闭的 bottom sheet；增减资产继续进入既有 Trustline 精确复核，见 `behavior-specs/s06-asset-sheets.md`。
- 余额读取仍走 Balance capability，snapshot 留在 Home feature 状态，不写入 Realm 当真值。
- 从 Send / Trustline / 任何改账本流返回时，即使 Home 仍挂在栈上，也要因 focus 或显式失效再拉 snapshot。提交 uncertain 同样失效。不要本地乐观减余额。
- 资产类别切换、余额说明、LP / claimable 详情走 §7.8 角色；契约表达不了就占位，不要显示成普通发行资产。

### Send（S07）

- 表单 → 当前账本准备 → 精确 XDR 审阅 → 授权 → 提交 → 结果。
- Payment / CreateAccount 选择、**memo**、手续费、trustline、只读 / 多签 / **硬件**失败仍在 Payment + Transaction + Signing Coordination。不要为了改样式换成另一套协议。
- Memo 输入 Adopt；不要因为 Stellar 文件还叫 DestinationTag 就当成 XRPL 标签 Exclude。
- 审阅和提交是 §5 的 modal / stack 角色。Vault 签名交互可参考 Stellar，密钥仍走 Core。
- 结果为 submitted 或 uncertain 时，失效该账户的 Balance / History，再 `popToTop`。不要在本地减一个金额。
- 现有 Payment 测试不能改弱；它们也不等于 Send 产品已经写完。

### Activity

- 运行时 id 和目录是 `activity` / `features/activity`。用户文案是 Activity。Capability 仍是 `capabilities/history`。
- 列表行为对齐按 [S13 list alignment](behavior-specs/s13-activity-list-alignment.md) 分批交付：先补现有 payment/create_account/change_trust 的主体身份与金额布局；具体日期分组保留，不采用 Today/Yesterday。S22 全局联系人名称仅作临时展示，不进入 History/cache；联系人创建网络是来源信息，不是展示分区。后续操作族和可见性规则按同一清单补齐，不能把首片当全量完成。
- 列表、下拉刷新、加载更多、空态、错误、操作详情都在。
- FilterEvents：对已加载（含 UX 缓存）条目做呈现筛选。允许上次列表先上屏再刷新。**不要**把本地缓存说成完整链上历史或做 donor 缺口恢复。
- 从改账本流回到已挂载的列表时，同样失效 / 刷新。
- 日期 / 金额 / 文案走 i18n 和格式化 helper，不要内联英文。

### Settings / Security / Language / Network / About / Developer Mode / 主题

- 分组符合 §7.5。**Developer Mode 是必要项**，不是推迟项。当前警告/确认式模式、网络工具与日志按 §7.6 和 S23–S25 规格验收；完整诊断/原生证据另列。
- 自定义主题入口在 General；实现依赖 F3 的 `AppTheme` 可替换契约。
- 不要在未开 Dev Mode 时提供假 Mainnet 开关。用户仍可在已可见网络上 **增删 RPC**。
- 推送是产品项（§7.1 已提升）；不要搬 Xaman SignRequest 云载荷。
- 语言通过 locale preference store 持久化。
- Security / Vault 不把密钥写入普通持久化。当前应用锁使用 SessionGate/Application Session，和签名 SDK 的 fresh-passphrase 权限分开。
- 当前 Security 生物识别设置仅控制 App access；关闭后使用 SDK 口令回退，每次签名始终另取 fresh App Passphrase。旧 routine-signing System Auth 开关/确认记录按历史证据保留，不作为当前签名策略。取消/失败保持真实状态并允许重试，不能用本地状态伪装授权成功。
- ChangeLog 在 About 或版本升级说明里；Terms / Credits 走通用 InAppBrowser，不走 dApp 浏览器。
- Connected dApps 覆盖原 ThirdPartyApps 角色，不另开一页。

### Trustline / 管理资产（S30）

- Add / Set Limit / Remove 都走 Trustline 精确 XDR 路径，资产代码大小写原样保留；现有三条产品语义和提交前账本复验不得在 UI 重写时退化。
- Set Limit 必须验证现有 trustline、limit 与余额/买入负债、issuer 状态及 authorization/clawback；Remove 必须验证零余额、零负债和 liquidity-pool 关系。
- 提交后按 §2.1 失效 Home 余额；不要依赖「返回会卸载 Home」。
- S30 与 S07 必须共同通过 Stage 2.5 pending/uncertain 重启协调与防重复；只让其中一条路径恢复不算共享 Transaction 管线封板。

### dApps

- Tab id 和目录是 `dapps` / `features/dapps`。用户文案是 dApps。
- clean-room 重写并覆盖 Stellar 已形成的行为：FChain 目录、Home / Recent、分类、自定义 URL、disclaimer、浏览器、Freighter 注入、权限与数据互通。`origin/Stellar` 的 `screens/xApps`、`Modal/XAppBrowser`、`freighter/` 只作行为与协议审计来源；直接移植文件必须有独立权利证据和审批记录。
- 实现在 Fresnica 分层内完成，不要复制 donor 目录或整棵 `services/`。
- 当前 catalog/browser/permission/Freighter/SEP-53 支持子集已实现；这不等于完整 Soroban/任意交易矩阵或原生验收完成。

### 硬件钱包

- 见 §7.7。账户、签名、列表三条路径都要在设计里。当前「Not yet implemented」不是 Exclude。

### Request / Swap / SDEX

- Request 已实现公开 SEP-7/QR 分享与受控输入；预填必须继续进入显式 Send 审阅。
- Swap 的报价/执行与 SDEX 订单管理均已实现支持子集，不再沿用旧 Path Payment 合同阻塞。
- SDEX/LP 与 Swap 是独立产品表面；LP 存入/建池、完整市场面板和原生验收仍另列。

---

## 10. UI kit 与自定义主题

UI kit **尚未约定**组件清单和视觉。不要提前把当前扁平组件或 `defaultTheme` 当成 kit。

F3 只锁这些：

- 语义 token，屏幕不写裸颜色。
- 活跃主题可替换：默认一套，用户上传图片后提取主色、次主色等生成另一套，应用到整个 app。
- 提取与持久化放在 Settings / 主题 feature，经 `app/` 注入 `AppTheme`。不要每个屏幕自己读图片。
- 状态栏对比度和安全区跟主题 / 设备走，见 §10.1。F3 还要让 §14 里标了 F3 的壳角色在契约里有位置（不必一次做完视觉 kit）。

向 Xaman 学打包，不抄色板、`StyleService`、PIN / Secret Number、XRPL 控件。

### 10.1 状态栏与安全区

参考 `origin/Xaman-App` 的**产品角色**，用 React Navigation + `AppTheme` 实现。不要抄 RNN `Navigator` / `setDefaultOptions` / `mergeOptions`，不要抄 `StyleService`，不要抄 `DeviceUtilsModule.layoutInsets`。

#### Xaman 怎么同步（思路）

1. **对比度反相，不跟系统时间抢色。** 默认导航选项里：浅色主题用 `statusBar.style = 'dark'`（深色时间 / 图标），深色主题用 `'light'`。判定是 `theme !== 'light'`（`dark` / `moonlight` / `royal` 都算深色）。公式等价于 `select({ light: 'dark', dark: 'light' })`。
2. **写在壳上，换主题再刷一遍。** 进主壳或 Onboarding 时把上述选项设成默认；Settings 改主题后 `StyleService.setTheme` → `Navigator.switchTheme` → 再 `setDefaultOptions`，并对已挂屏幕 `mergeOptions`。OS 外观变化（`Appearance`）和从后台回前台，在开启自动跟随时走同一条重绑。
3. **不要在任意中间页立刻整树重绘。** 等回到主 Tab 或 Settings General，并且 modal / overlay 关掉再刷，避免半透明层上闪状态栏。
4. **内容画到状态栏后面，用 inset 把 Header 推下来。** `drawBehind: true`；Android 状态栏背景透明；系统导航条颜色跟 `$background`。Header `marginTop` 用 native `safeAreaInsets.top`（他们叫 `statusBarHeight`）；iOS TabBar 高度含 `bottomInset`。
5. **例外覆盖，离开后回到主题值。** 暗色遮罩 overlay（Actions、切账户等）和扫码相机强制 `'light'`；Lock 跟当前 `isDarkMode`。WebView `autoManageStatusBarEnabled={false}`，避免页面把状态栏抢走。Info.plist 的 `UIStatusBarStyleLightContent` 只是 JS 起来前的启动默认，运行时被主题覆盖。

#### Fresnica 契约

- `AppTheme` 必须能推出状态栏内容样式：`dark`（深色字，配浅底）或 `light`（浅色字，配深底）。可由背景亮度派生，或作为显式 token。默认浅色主题和「从图片生成的主题」都走这条，避免白底白字。
- 壳（`app/`）统一设置 `StatusBar`（以及 Android 系统导航条颜色）。feature 屏幕默认不写 `barStyle`。暗色 scrim overlay、相机扫码等可以覆盖；关闭后恢复主题值。dApp WebView 不得自行管理状态栏。
- 主题替换时只重绑壳，不要模仿 Xaman 对每个屏幕 `mergeOptions`，也不要引入 `StyleService`。
- 安全区用已接入的 `react-native-safe-area-context`（根上 `SafeAreaProvider`，壳用 `useSafeAreaInsets`）。Screen / Header / TabBar / Overlay 消费 inset。不要再搬 Xaman 的 native inset 模块，不要为灵动岛写死 47/59，不要把 RN 自带 `SafeAreaView` 当成完成态（Android 挖孔和自定义 TabBar 底栏都不可靠）。
- **主 Tab 底栏安全区所有权（2026-11-23）：** `MainTabBar` 的 `SafeAreaView` 唯一消费底部 inset；Home、Activity、dApps、Settings 根页面及无账户占位页的 `Screen` 只消费 `top/right/left`。滚动内容末尾保留 8 dp 的视觉缓冲，不叠加额外底部安全区。次级路由（交易详情、账户管理、设置子页）、登录/恢复表单及弹窗继续使用各自默认/专用的底部安全区，不能全局删除 `Screen` 默认 `bottom`。本变动仅是布局所有权调整，不改变数据、导航或授权语义。
- 允许内容画到状态栏后面（edge-to-edge），由壳 inset 让开刘海 / 灵动岛 / Home Indicator / 手势条。
- F3 壳原语已落地 App-level `StatusBar`、`SafeAreaProvider` 与 shared `Screen` inset；F4 表面只消费壳。light/dark/system/image 已实现；不得由此直接宣称完整 F3 原生/可访问性验收。

---

## 11. 怎么重写一个表面

先看文首总表：该 Phase 未过则不要开这条表面。导航库是 React Navigation（§5；总表 2b）。每条 PR 还要过文首三条门禁（垂直切片、交易一体、闭环进度）。

1. 在 PR 说明里写出 §7 / §7.8 / §14 / §2.1 对应行、feature 归属、Capability。若是 Exclude，停止。
2. 读 `docs/mobile-capability-status.md` 区分实现范围、历史证据和未验收项。Capability 被挡住时 UI 保持诚实（禁用 / 占位），但不要从产品表删掉（硬件钱包、Dev Mode、dApp 都是例子）。
3. 看 `origin/Stellar`：只提取屏幕顺序、空态 / 加载 / 错误、overlay / modal、协议输入输出和异常行为。dApp 同样执行 Stage 0A provenance 与 clean-room 规则；实现者不得把 donor 文件当模板逐行改写。Vault / 加密只对照交互角色，再接到 Core。
4. 实现进 `features/*` + `ui/*`。适配器在 `app/`。可复用钱包策略进 `capabilities/`。链上快照不要写入 Realm 当真值。
5. 文案走 i18n。用目标名（`activity`、`dapps`）。
6. 为流程状态和该屏幕能到达的 Capability 失败补测试。
7. 若这是该 feature 目录第一次实质性重写，同一 PR 扩展 `scripts/check-architecture.mjs`。
8. 跑 `npm run check`，以及该表面会影响的 Capability 测试。

遇到这些情况先停下来问，不要自行绕过：

- 把 **Xaman** 文件或 Stellar **非 dApp** 屏幕整文件抄进 `src/`
- 加 `src/services` 或全局 `NavigationService`
- 在 F0 已选 React Navigation 之后再加 Wix RNN
- 用当前脚手架「已经能点」代替 Stellar 产品覆盖
- 把 Developer Mode、硬件钱包、dApp 浏览器标成 Exclude
- 为「兼容」留下 Events / XApps 别名
- 把底层 PR 和新的产品 Capability 混在一起
- 实现表外横切，或不经 §7.8 / §14 把未点名屏幕丢掉
- 把 Realm 中的链上快照当成余额权威，或在提交成功后本地乐观改余额。允许按 §2.1 保存可替换的分区展示缓存；交易准备必须重新读取权威账本状态。

---

## 12. PR 规则

- 一个分支一个产品目标。
- 编码前写出总表 Phase、§7 行（或 §14 / §2.1 行）、feature 归属、Capability。
- 通过文首三条 PR 门禁。
- Phase 0 已过。2c（F3）剩余项未完成前不要声称相关 F4 表面已经消费完整主题能力；Stage 2.5 已完成，但任何新写账类型仍须先过自己的 Stage/Capability 门并复用同一恢复管线。
- 实质性重写遗留 feature 目录时，同一 PR 扩展 `scripts/check-architecture.mjs`。
- 不要把底层（总表 2c / F3 等）和新的产品 Capability 混在一起。
- 不要为了让屏幕看起来完整而削弱精确 XDR 或密钥处理。
- 不要拿当前仓库占位当产品已覆盖。
- 不要加 `src/services`，也不要把链上余额写入 Realm 当真值。
- 不要加 Wix RNN 或全局 `NavigationService`。
- 不要大规模格式化无关文件。
- 不要把 `steps:null` 或其他执行前 CI 失败当成通过。
- 表外横切不要在代码里发明；先入 §14 或 §7.8。

---

## 13. 文档地图

| 文档 | 角色 |
| --- | --- |
| 本文件 | 产品范围/信息架构权威：成熟度 Foundation gate、闭合表（有什么）、完成标准（做成什么样） |
| `fresnica-mobile-rewrite-execution-plan.md` | 阶段、provenance、发布与依赖框架；当前执行状态见 `fresnica-mobile-current-progress-and-next-plan.md` |
| `docs/product-traceability-ledger.md` | S01–S30 稳定产品 ID、owner、依赖、目标阶段和验收锚点；S07 为 Send，S30 为 Trustline |
| `docs/provenance/README.md` | donor 文件来源证据、clean-room 工作规则和直接移植禁区 |
| `docs/mobile-architecture-style-guide.md` | 分层、依赖方向、代码风格 |
| `docs/mobile-capability-status.md` | 各 Capability 当前在设备上实际做什么 |
| `docs/fresnica-mobile-stage-plan.md` | 历史 Capability / 安全 PR 证据和上游闸门 |
| `AGENTS.md` | 所有新增 / 重写 Mobile 文件必须遵守的护栏 |
| `feature-design.md` | 为什么用 feature 而不是 `services/` |

历史文档。不要用它们决定 Tab 名、产品壳图或重写顺序：

- `docs/product-structure.md`
- `docs/product-parity-roadmap.md`
- `docs/product-parity-matrix.md`
- `docs/fresnica-mobile-handoff.md`
- `docs/stellar-rewrite-milestones.md`
- `docs/stellar-source-parity.md`
- `docs/stellar-horizontal-parity-audit.md`
- `docs/product-donor-map.md`

这些文件仍可作为「曾经考虑过什么」的清单。它们若写 Events / XApps、三栏 `Wallet | Activity | Settings`、或「下一里程碑是 Product Shell」，以本文为准。

---

## 14. 工程角色（横切闭合表）

来源是 Xaman / Stellar 里用户能感到的**角色**，加上 Fresnica 已选栈强加的项。不是它们的文件、`services/` 或 RNN options。

规则与 §7 相同：表里没有的横切默认不存在；要做必须先入表。删 RNN / `StyleService` / `DeviceUtils` 时，角色留在这里，换 Fresnica 机制。

| 角色 | Fresnica 机制 | 阶段 | 禁止 |
| --- | --- | --- | --- |
| 状态栏对比度跟主题 | `AppTheme` 派生内容样式；`app/` 设 `StatusBar` | F3 契约，壳实现 | feature 写死 `barStyle`；RNN `statusBar`；`StyleService.mergeOptions` |
| 内容避让刘海 / Home Indicator | 根上 `SafeAreaProvider`，壳 `useSafeAreaInsets` | F3 壳 | `DeviceUtils.layoutInsets`；写死 47/59；把 RN 自带 `SafeAreaView` 当完成态 |
| 主题替换整 app | 可替换 `AppTheme`，只重绑壳 | F3 | 活对象 StyleService；对每个屏幕 mergeOptions |
| 跟系统浅色 / 深色 | 同一 theme provider；入口在 Settings | 契约 F3，实现 F4 | 第二套自动主题 |
| Android 系统导航条颜色 | 跟 background token | F3 壳 | RNN `navigationBar` |
| 截屏保护 | platform 机制；Dev Mode 可关 | F4 Advanced | 在 JS 里假装 FLAG_SECURE |
| 前后台 / 应用锁 | SessionGate / Application Session 与原生隐私保护 | 已有实现；原生设备验收单列 | 假 PIN；密钥进普通状态；App unlock 授予签名权 |
| 网络通断 | ConnectionIssue overlay；与「未激活」分开 | F4；Home 已有区分 | 把 Horizon 404 当成断网 |
| Session logs | Settings Advanced，Dev Mode 后 | F4 | 日志里写密钥 / XDR 明文 |
| 键盘避让 | RN 常规 KeyboardAvoiding / 表单原语 | 有表单的表面 | 抄 Xaman KeyboardModule |
| 启动失败（库损坏等） | `bootstrap` 错误屏；wipe 策略另定 | 启动壳 | 静默进 main |
| 语言 / 时区 / 分隔符 | locale runtime；数字格式走 helper | 语言已有；时区/分隔符随 i18n 表面 | 屏幕内硬编码 en-US |
| JS runtime 缺口 | `installRuntimePolyfills`（URL / TextDecoder / PluralRules 等） | 启动；按运行时补 | 假定 Hermes 有完整 Intl |
| WebView 不抢状态栏 | dApp / InAppBrowser 关闭 WebView 自管状态栏 | F4 dApps / 条款 | 页面把状态栏改走后不恢复 |
| 原生导航模块 | `react-native-screens` + safe-area；改依赖后**重建原生** | 启动 / F2 | 只装 JS 不编原生（红屏 `RNCSafeAreaProvider` / `RNSScreenStack`） |
| 手势 | 需要手势栈或 modal 手势时再加 `react-native-gesture-handler` | 按需，不挡 F3 | 为「对齐 Xaman」提前加 |
| 竖屏锁定 | Info.plist / Android manifest | 壳 | RNN orientation options |
| 当前选中账户 | `app/` 一份公开 `accountId` | F2 已有形态；F4 各表面消费 | 各 Tab 互不同步的选中态 |
| 链上 snapshot 失效 | §2.1：focus / 显式失效，不写 Realm | F4 Home / Send / Activity / Trustline | 全局 AccountService 改缓存；乐观减余额 |
| 账户数据生命周期与前台到账 | `docs/behavior-specs/account-data-lifecycle.md`；App 调度、Capability 端口、Platform I/O，公开数据重读与交易恢复分离 | LC1–LC4 已合并；LC5 现有链接/目录/网站确认生命周期接入候选，其他缓存随所属产品；原生到账和 LC6 聚合验收待完成 | 无 pending 就不刷新；后台重复监听；事件直接加减余额；假称全账户提醒或后台推送已完成 |
| Metro ↔ 真机 / 模拟器 | 开发机：`adb reverse` 等随冷启动会丢 | 开发运行时，不是产品 | 把「Unable to load script」当产品缺陷改业务 |
| 推送 / Firebase | Push 是完整计划必达但 Backend 非当前主线：先做受控 Deep Link、前台事件、本地通知和稳定端口；远端通知在可信发送端、token/identity/scope 协议成立前阻断 | 执行计划 Stage 8B / 后续 release | 把 Firebase 客户端配置当后端；Push 自动授权/签名 |
| IAP / jailbreak 启动拦截 | IAP Exclude；root/jailbreak 策略在发布安全阶段单独决定 | 排除 / 发布 | 当「Xaman 有」就照搬 |
| RNN / NavigationService / StyleService / DeviceUtils / 全局 `services/` | **Exclude** | 禁止 | 以任何名义加回来 |

Xaman 没有、Fresnica 栈仍要有的：`SafeAreaProvider`、`enableScreens`、改导航库后的原生重建。这些写在表里，就是为了不再靠真机才发现。

### S04/S24 shared foundation clarification (2026-10-27)

The current authentication and network-session behavior contract is [shared-auth-network-session](behavior-specs/shared-auth-network-session.md). Fresh App Passphrase verification for sensitive Developer Mode enable is independent from the still-missing generic biometric app-session challenge. A zero-signer verification result never authenticates this action. Normal bootstrap selects Mainnet without relabelling existing Testnet records; empty current-network account partitions keep Settings reachable. Custom-node controls remain mode-gated and service generations bind all gateways consistently. The contract records cancellation, persistence, pending-submission and active-node removal invariants and native acceptance boundaries.

#### Retained Testnet migration exception (PR #124 P2)

Existing Testnet account partitions, including watch-only/external-only wallets, retain an explicit built-in Testnet path without enabling Developer Mode. This exception prevents bootstrap lockout; new Testnet access and all custom-node controls still require the existing mode authority. Retention is persisted as public network preference metadata and does not authenticate an action or alter Account/Signer/network identities. See the shared-auth-network-session specification.
