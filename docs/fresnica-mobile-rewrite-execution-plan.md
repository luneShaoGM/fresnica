# Fresnica Mobile 重写评估与执行计划

> 状态：2026-09-08 源码审计基线；2026-09-09 产品范围与迁移策略确认；2026-09-10 Stage 2.5 交易恢复门完成；Stage 0A 发现历史 donor presentation blocker 后进入净树 remediation，当前目标是 clean integration milestone，而不是直接合并 rewrite 历史
>
> 审计对象：
>
> - 当前 Mobile：仓库根目录 `src/`、原生工程、测试与 CI
> - 底层权威：`origin/fresnica`
> - 产品行为基线：`origin/Stellar@stellar-migration`
> - 工程成熟度参考：`origin/Xaman-App`
>
> 本文是唯一施工顺序与状态账本。`docs/stellar-product-information-architecture.md` 继续拥有产品范围、信息架构与完成标准；`docs/product-traceability-ledger.md` 保存稳定产品 ID 与验收映射；`docs/provenance/README.md` 保存 clean-room 门；`docs/mobile-capability-status.md` 只记录实现证据。历史路线文档不得覆盖本文的当前顺序。

## 1. 最终判断

当前项目已完成“可继续承载重写”的核心底座，但尚未达到“底层封板”或“整体架构成熟”的状态。

更准确的定级是：

- 核心写账底座：Stage 2.5 已闭合 pending/uncertain 持久化、按原 hash 重启协调、同一经济意图防重复与 read-model 失效；S07 Payment 与 S30 Trustline 已证明共用同一恢复管线，并有真实 Android Testnet process-death/restart 证据。该 Transaction recovery 切片达到 L4 证据门，但 S07/S30 产品本身仍须按 Stage 4 的完整 UI/异常/native/E2E 标准分别验收，不能据此整体升级 L4。
- 原生安全与持久化：审计时 Mobile 使用 Fresnica Native SDK 0.2.1；Stage 1 已升级到发布的 0.3.0（Native Binding API 3 / SDK API 5 / Core Client API 5），双端 build/runtime smoke 已通过。
- 架构边界：Stage 2 已完成生产依赖收口；Capability-owned ports、network 注入和 Platform projection 已成立，production Feature / Capability / Platform 反向依赖审计为 0。依赖守卫已全量，presentation/style strict scope 仍按已重写表面扩展，不能笼统称为全仓风格封板。
- 产品壳：React Navigation、四个可见 Tab 与 Actions Overlay 已成立；浅色 semantic AppTheme、壳级 StatusBar/safe-area、共享 UI primitive、Feature error projection 与脱敏 SessionLogger 基础已经接入。Stage 0A remediation 将 Shell/Home/Settings 收缩为 `Pressable + Text + ActivityIndicator + AppTheme` 的中性功能型 presentation，并移除 donor assets/components/theme；dark/system/image theme、最终视觉品牌、可用的 app-session lock、Developer Mode 日志入口等仍未完成。
- Stellar 功能重写：只完成少数可运行闭环；dApps、Request、Swap、Claimable、资产元数据、Developer Mode、通讯录等尚未重写完成。
- 发布成熟度：尚未达到 Mainnet 钱包发布条件。Android release 已在 `50d8653` 移除 debug-signing fallback，并用 fail-closed + 临时测试证书验证 wiring；生产 release keystore/CI secret 尚未配置，Android Application ID、iOS distribution identity、Mainnet 与其余 Stage 9 门仍未完成。

因此，后续不应重新搭建第二套底层，也不应按页面数量平推。正确策略是先消除底座版本差和边界缺口，再以“一个真实用户闭环 + 一条复用交易管线 + 可执行验收证据”为单位逐功能重写。

## 2. 审计证据

### 2.1 已记录的里程碑验证

- Stage 2 里程碑的 `npm run check`、TypeScript、格式、Lint、模块别名、架构守卫、语言包与 40 个 Jest 套件 / 216 个测试均通过。
- Stage 2 里程碑的 `npm run test:realm`：1 个 Realm 集成套件、14 个测试全部通过。
- Stage 1 已在 Android emulator 与 iOS simulator 使用 0.3.0 fresh build 重新执行 Native runtime smoke，证明 Realm round-trip、`FresnicaCore.parseAccount`、external-signing bridge 与 SEP-53 high-level message-signing bridge 可用；它仍不是完整产品 E2E。
- 上述证据是里程碑证据，不自动代表当前工作树。每次状态升级必须记录 commit SHA、执行日期、CI run 与准确测试数量。

### Milestone final local validation — 2026-09-10

Validation target: `f49dc50e4052067192b4c6ff007de54eeaf9cd92` (`docs(rewrite): refresh milestone evidence`).

- Provenance manual drift gate: `node scripts/audit-donor-provenance.mjs` regenerated the fixed `Stellar bd0f4540...` / `Xaman 01e2538...` ledger with **1,642 files / 1,048 inherited / 594 modified-unproven**; SHA-256 remained `189b8bb6485f9818f9d7c43f271ccfcc9b5e05067610d22bbc58296854aaf45f`, so the committed ledger diff was zero.
- `npm run check`: **56/56 suites, 284/284 tests**; TypeScript, format, alias, architecture and locale gates passed; ESLint **0 errors / 28 warnings**; three locale dictionaries share 98 keys.
- `npm run test:realm`: **17/17** passed, including pending-submission close/reopen, long-unknown blocking, confirmed/rejected reconciliation and cross-restart duplicate protection.
- Android real Testnet recovery: transaction `fc75bde872216a89d8fa867269a7ee2fd40d652d4a93e58f256d7c33c381fecc` was persisted as `uncertain` for source `GAEYI6MKQTXPVVZ74GYGSBB3SEL3SFOP7GUJ2VD34YRDEOGGC3NBS5ES`; ActivityManager shows PID **8360** was force-stopped and fresh PID **8525** reopened the same `transaction-recovery-smoke.realm`. Final callback preserved exact network/account/source/hash and reconciled to `confirmed` without another sign/broadcast.
- Android standard native smoke passed at `2026-09-10T04:39:40.999Z`: Realm + `FresnicaCore.parseAccount` + external-signing bridge + SEP-53 bridge all reported `ok`.
- Android release signing: `:app:assembleRelease` without credentials exited 1; root `assemble --dry-run` also failed closed. A temporary `/tmp` PKCS12 successfully signed `assembleRelease`, and `apksigner` verified `CN=Fresnica Final Release Gate, O=Fresnica, C=US` with no Android Debug certificate. No production key was created or persisted.
- iOS fresh simulator `xcodebuild` succeeded on iPhone 15 Pro / iOS 17.2 (`DEF9E99C-0D02-4803-B457-CFB631433DFD`). Standard native smoke then passed at `2026-09-10T04:41:29.551Z` with the same Realm/Core/external-signing/SEP-53 assertions.
- Worktree was clean after all local gates. This is **local milestone evidence only**; the branch was still 11 commits ahead of `origin/rewrite/stellar-source-parity` at validation time, so current remote PR/CI evidence was not yet available and no merge to `main` was performed.

### 2.2 已存在且可继续演进的底层

- `src/app/createAppServices.ts`
  - 已作为组合根装配 Realm、Fresnica Native SDK、Stellar Gateway 和各 Capability 依赖。
- `src/platform/fresnica/`
  - 已建立 TypeScript SDK 契约、NativeModules 适配、错误归一化和版本兼容信息。
- `src/platform/persistence/realm/`
  - 已建立 Account、Signer、Account-Signer Reference 与 Locale Preference。
  - 已验证原子注册、重启恢复、重复身份拒绝、共享 signer 生命周期。
- `src/platform/stellar/`
  - 已提供账户状态、余额、授权、历史、账本参数、Payment、ChangeTrust、Path Payment 机制和提交结果归一化。
- `src/capabilities/`
  - Account、Balance、Payment、Trustline、Transaction、Signing、Ledger Authorization、History、Application Security 已有实现和测试。
- 精确交易链
  - 已形成 prepare → exact XDR review → freshness → ledger authorization → sign → submit。
  - 已区分 accepted、deterministic rejected 和 uncertain submission。
  - XDR 未放入导航参数。

### 2.3 不能被“测试全绿”掩盖的问题

- `scripts/check-architecture.mjs` 已检查全部生产 Feature / Capability / UI / Platform 的依赖方向，但裸色、inline style、样式共置等 strict presentation 规则仍只覆盖已登记的重写表面。
- `npm run lint` 已覆盖 `src/`，但 warning 尚未清零，也没有屏幕级 E2E 证据。
- Stage 2.5 transaction recovery 已完成首轮 S07/S30 证明；后续 S10–S12、S18 等新的改账本路径仍必须显式复用同一 pending/reconciliation 管线，不能因基础设施已完成而建立第二套提交恢复。
- Activity detail 已接通，但当前只覆盖有限 operation projection，不能代表 Stellar Activity 行为完整。
- dApps 当前只是静态预览。
- Request 与 Exchange 没有实际 Feature 目录和生产接线。
- App lock 只有占位 Screen。
- 当前仅 Testnet；Network Settings 为展示状态。
- 当前单本地 signer；multisig、hardware provider 和 C-account 均未形成 Mobile 产品闭环。
- SessionLogger 目前是组合根和脱敏基础，尚未形成全流程埋点、用户可达导出和 Developer Mode Session Logs 闭环。

### 2.4 为什么 Capability 直接导入 App、Platform 或 Stellar SDK 不合适

这里的问题不是“这些调用现在不能工作”，而是依赖所有权倒置。

- Capability 是钱包业务语义的拥有者，应定义自己需要的端口和稳定 DTO。
- Platform 是外部机制的实现者，应依赖并实现 Capability 的端口。
- App 只负责选择 Mainnet/Testnet、Endpoint 和具体实现，再完成注入。

当前部分代码形成了：

```text
capability → app/config
capability → platform/StellarGateway
capability → platform/FresnicaSdk
capability → @stellar/stellar-sdk
```

目标应为：

```text
app → capability contracts ← platform implementations
```

具体风险：

- 导入 `appConfig`：Capability 被当前 App 的单一 Testnet 配置绑定，难以并行支持 Mainnet、Testnet、多账户网络作用域和测试配置。
- 导入 `platform/stellar`：Capability 的业务输入输出被 Horizon/Stellar SDK 适配层拥有，未来切换 Horizon provider、RPC 或缓存实现时会反向影响业务层。
- 导入 `platform/fresnica`：虽然多为 TypeScript type-only import，不会增加运行时包体，但契约仍由具体适配层拥有，依赖方向错误。
- 导入 `@stellar/stellar-sdk`：`Transaction`、`Asset`、`StrKey` 等第三方对象或解析机制进入 Capability 后，Capability 测试必须理解 SDK，第三方升级也会穿透业务层。

不是所有 Stellar 逻辑都要从 Capability 移走。reserve、liability、memo-required、trustline capacity、签名协调等业务规则仍属于 Capability；StrKey/XDR/Horizon/Native 调用应由 Platform 通过稳定 DTO 和端口提供。

## 3. 权威边界

### 3.1 产品行为

`origin/Stellar@stellar-migration` 是产品行为基线，但不是代码架构或安全权威。

保留的产品角色包括：

- Home
- Activity
- Actions
- dApps
- Settings
- Onboarding 与账户管理
- Send、Request、Path Payment Swap
- Trustline 与资产管理
- Claimable Balance
- Asset Metadata
- Developer Mode、网络管理、Session Logs
- Address Book
- Stellar 中已经形成的 dApp Catalog、Browser、Freighter Bridge、Permission 产品行为；实现必须按下面的源码来源规则重写

Stellar 中仍存在的 XRPL/Xaman 遗留不能因为“目录存在”就成为 Fresnica 功能：

- XRPL genuine transaction 模板
- Destination Tag 语义
- Xaman Backend/Payload 云
- Tangem 的 XRPL 签名路径
- IAP/Pro/Monetization
- ThirdPartyApps、NetworkRailsSync
- XRPL Linking decode
- WalletConnect；Stellar 源码中没有实现

### 3.2 底层与安全语义

`origin/fresnica` 是以下事项的权威：

- Account、Signer 与 Recovery Source 分离。
- secret/mnemonic 生成、派生、保护与 reveal。
- System Auth 与 Fresnica Passphrase 的不同保证级别。
- exact-XDR review/sign/submit 绑定。
- 外部签名 prepare/apply/verify。
- 稳定错误语义。
- Normative Application Capability。
- Native SDK 与跨语言 conformance 向量。

Mobile 不得在 JavaScript/TypeScript 中重新实现密钥派生、KDF、保护信封、交易哈希或签名。

### 3.3 工程完整性

`origin/Xaman-App` 只用于借鉴工程模式：

- Feature/Screen/Component 打包纪律。
- 交易 Preflight → Review → Authorization → Submit → Result 的产品节奏。
- Realm migration 纪律。
- 统一错误、日志、诊断与 E2E 门禁。
- 深链与扫码入口一致性。
- 主题、组件和测试组织。

不得直接复制 Xaman 或 Stellar 源码。两棵仓库都携带 XRPL Labs CUSTOM dual license，Stellar 自研改动也建立在 Xaman 派生树上，不能按目录名推定著作权。默认策略是 clean-room behavior rewrite：先把用户行为、协议输入输出和异常路径写成不含实现细节的规格，再在 Fresnica 分层中重新实现。

只有同时满足以下条件的代码才可作为例外直接移植：

- 能用提交历史和文件级 provenance 证明该实现完全由 Fresnica 团队独立创作。
- 不包含或改写 Xaman 受限源码的实质表达。
- 依赖与资源许可证已登记并允许目标发布方式。
- 例外经过明确的工程/法律审核记录；没有记录时仍按 clean-room 重写。

以下机制也不进入目标架构：

- 全局 `services/` 单例桶。
- Wix React Native Navigation。
- 全局可变 `Navigator`。
- 全局可变 `StyleService`。
- Ledger 领域代码直接触发导航或 UI。
- Screen/Service 随处读取 Realm Repository。

### 3.4 已确认的产品与迁移决定（2026-09-09）

- 本工程作为全新 Fresnica 应用实现发布，不承诺兼容或迁移旧 Stellar/Xaman Realm、账户、设置、缓存、联系人或 dApp 授权。
- Android 最终 Application ID 沿用 Stellar 已选定的 `com.fresnica.wallet`；当前 Mobile 的 `com.fresnica.mobile` 是临时值，必须在发布身份阶段迁移。
- iOS 旧 Stellar 工程仍是 Xaman 遗留 Bundle ID，当前 Mobile Bundle ID 也不是最终值；最终 Fresnica Bundle ID、Apple Team、Associated Domains、APNs 和商店记录必须在发布前一起冻结，不能猜测或沿用 `com.xrpllabs.xumm`。
- 同 Application ID 的设备可能发生覆盖安装，即使产品定义为“全新应用”。启动时若检测到旧数据，不得把旧 Realm/Vault/dApp permission 当成 Fresnica 数据，也不得静默删除；必须 fail closed，明确提示这是全新钱包，并在用户确认已具备恢复材料后才执行受控清理/重新初始化。
- 所有已确认功能都是整个重写计划的必达范围，可以按依赖和风险分多个可发布增量完成；“后发布”不等于 Exclude。
- Fresnica Backend 暂不作为当前主线。依赖可信后端才能安全成立的能力保留接口、威胁模型和阻断状态，不用 Mobile 私有协议或第三方凭据绕过。
- Ledger Nano X / Flex / Stax + BLE + iOS/Android 是候选验证矩阵，不是尚未验证的首版支持承诺。

## 4. 目标架构

依赖方向固定为：

```text
app
├── composition/bootstrap
├── navigation/chrome
└── providers
     │
     ├── features ──► capabilities ──► domain ports
     │       └──────► ui
     │
     └── platform ──► domain ports

platform/fresnica    → Fresnica Native SDK
platform/stellar     → Stellar SDK / Horizon / RPC
platform/persistence → Realm
platform/system      → OS / lifecycle / secure screen / clipboard
```

约束：

- `features/**` 不导入 Platform、Realm、NativeModules 或 Stellar SDK。
- `capabilities/**` 不导入 React、React Native、App 配置、Realm、NativeModules、具体 Gateway 实现或 Stellar SDK。
- Capability 的端口和 DTO 由 Capability/Domain 所有，Platform 实现它们。
- `ui/**` 只接受展示数据和回调。
- `platform/**` 不决定产品工作流、确认策略、滑点策略或用户文案。
- `app/**` 是唯一组合根。
- 交易对象在 Feature flow 内持有，不通过导航传播。
- 所有金额、价格、费率和限额使用精确字符串、整数或分数。
- Network identity 必须作用于账户、缓存、review、签名和提交。

### 4.1 每层负责什么

#### `app/`：装配、启动和全局产品壳

- 创建 Realm、Fresnica SDK、Stellar Gateway、Cache Repository。
- 根据用户设置选择 Mainnet/Testnet 与 RPC/Horizon endpoint。
- 注入 Feature 和 Capability 所需依赖。
- 管理根导航、Tab、Overlay、Deep Link、App lifecycle、Session Lock、StatusBar 和 Provider。
- 不承载 Payment、Trustline、Swap 等业务规则。

#### `features/`：用户流程和产品状态

- 组织 Screen、Feature-local Component、Controller、View Model 和判别联合状态。
- 把点击、输入、扫码、授权结果转换成明确的 Capability 调用。
- 决定 loading、empty、error、review、success 等产品呈现。
- 可以先使用功能型 UI 完成闭环，不要求等待最终视觉稿。
- 不直接访问 Realm、NativeModules、Stellar SDK 或具体 Platform adapter。

#### `capabilities/`：钱包业务语义

- 定义 Account、Payment、Trustline、Transaction、SDEX、Dapp、Signing Coordination 等稳定契约。
- 执行 reserve、liability、capacity、memo-required、network binding、authorization 等规则。
- 定义所需 Gateway/Repository/Signer Provider 端口和稳定错误。
- 保持与 React Native、Realm、WebView、BLE、Horizon client 和具体 SDK 无关。

#### `platform/`：外部机制

- `platform/fresnica`：Native SDK、密钥保护、签名、System Auth、external signature apply/verify。
- `platform/stellar`：Horizon/RPC、Stellar SDK、XDR 构造与解析、链上提交。
- `platform/persistence`：Realm schema、migration、Repository 和本地缓存。
- `platform/system`：BLE、App lifecycle、secure screen、clipboard、通知、网络状态。
- `platform/dapp-browser`：WebView、origin、message transport。
- Platform 不决定产品确认顺序、允许的滑点或用户提示文案。

#### `ui/`：无钱包语义的视觉组件

- Theme token、Button、Field、Screen、Header、List、Modal、Loading、Error 等。
- 只接受展示数据和事件回调。
- 不知道账户、交易、Signer、Realm 或 Horizon。

#### `locale/`：本地化资源和格式

- 维护支持语言、字典、fallback 和区域格式。
- Feature 使用稳定文案 key，不把协议错误原文直接展示给用户。

### 4.2 本地缓存策略

本地缓存属于目标架构的一部分，不等于把 Realm 当作链上真值。

建议缓存：

- 资产元数据、Stellar TOML 与图标。
- Activity 历史页和 Operation detail projection。
- Account 与 Account-Signer Reference。
- Address Book。
- Claimable Balance 快照。
- dApp Catalog、图标、Visit History 和 Permission。
- Network/RPC 列表与健康检查结果。
- 用户 Theme、Language、Developer Mode 等设置。

每类缓存必须定义：

- cache key：至少包含 network id；资产还包含完整 `code + issuer`，账户数据包含 address。
- freshness：TTL、stale-while-revalidate 或明确失效事件。
- authority：Horizon/RPC、Fresnica Native、Catalog 或用户输入中的哪一个是权威。
- invalidation：交易提交、切网、切账户、前台恢复、pull-to-refresh 等触发条件。
- degraded UX：离线时允许显示多旧的数据，并明确“最后更新”。
- migration 与容量：schema 版本、最大记录数、LRU/分页清理。
- privacy：联系人、dApp permission 和诊断数据的保护与导出规则。

推荐模型：

```text
Screen → Feature controller → Capability read model
                              │
                              ├── 先读本地 cache
                              └── 后台 revalidate external authority
                                      │
                                      └── 写 cache + 发布新 snapshot
```

余额、授权、报价和待提交交易必须在敏感操作前重新验证，不能只依赖缓存。

## 5. 成熟度门

模块只按可执行证据升级，不按文件数量升级。

### L0：缺失

- 无契约或仅有想法。

### L1：结构

- 有 Route、类型或静态 Screen。
- 无真实数据、状态转换或运行接线。

### L2：实现

- 有纯实现和单元测试。
- 尚未进入生产组合根或真实导航。

### L3：生产接线

- 由 `app` 装配。
- 可从用户入口到达。
- 错误、取消、重试和结果状态可观察。

### L4：闭环验证

- 满足 L3。
- 有集成/E2E/native runtime 证据。
- 敏感交易满足 exact identity 与 fail-closed。
- CI 将该证据作为必过门。

“底层封板”要求所有以下项达到 L4：

- Fresnica Native SDK 当前支持版本。
- Account/Signer/Recovery 持久化和 migration。
- Application session lock。
- Payment/Trustline/通用交易流水线。
- External signer provider seam。
- Network-scoped repository/cache。
- 结构化错误与隐私安全日志。
- Android/iOS cold start、background/foreground、sign、submit smoke。

当前尚未满足，因此不能标记封板。

## 6. 执行原则

每个重写增量必须同时交付：

1. 一个可从真实入口完成的用户闭环。
2. 对既有通用交易管线的复用或受控扩展。
3. 失败、取消、过期、重试和 uncertain 状态。
4. Capability/Platform 边界测试。
5. Feature 状态转换测试。
6. 必要的 Android/iOS 运行证据。
7. 架构守卫范围同步扩展。
8. Adopt / Adapt / Exclude 决策记录。

UI 执行策略：

- 最终视觉设计未完成期间，允许使用功能型 Screen 和 Feature-local Component 完成流程与测试。
- 仍须从第一天使用语义 AppTheme、统一基础组件、Accessibility label 和可替换 View Model。
- 不以像素级完成度阻塞 Capability、导航和状态机验证。
- 最终设计确定后可以替换 `ui/` 和 Feature presentation，不应重写 Capability 或 Platform。

禁止以下交付方式：

- 只创建空目录或 Route 后声明功能完成。
- 先复制 Stellar/Xaman Screen，再以后拆层。
- 在 Feature 中直接用 Stellar SDK 快速接通。
- 为一个新交易类型建立第二套 sign/submit 流水线。
- 用 Realm 中的余额或历史代替 Horizon/RPC 权威状态。
- 因 UI 方便把 XDR、passphrase、secret 或 mnemonic 放入导航或普通持久化。

## 7. 分阶段执行路线

### Stage 0：冻结审计基线（基础账本已建立，持续维护）

目标：让“当前是什么”可重复验证。

工作项：

- 将本文作为执行入口。
- 保存当前 `npm run check` 与 `npm run test:realm` 基线。
- 为产品功能建立源码级 inventory，逐项标记 Adopt、Adapt、Exclude。
- 以 `docs/mobile-independent-assessment-2026-09-08.md` 的 S01–S29 为初始基线建立 `docs/product-traceability-ledger.md`；审计补充的 Trustline Add/Set Limit/Remove 使用追加 ID S30。§7、§14 或后续审计发现的新行为必须继续追加新 ID，既不能重排旧 ID，也不能只追加到笼统的 Stage 列表。
- 将 XRPL/Xaman residue 列表变为禁止引入清单。
- 记录现有 Native runtime smoke 的日期与覆盖范围，禁止把旧结果当当前通过。

退出条件：

- 所有后续 PR 能指向一个产品闭环和一个成熟度门。
- 每个必达产品行为都有稳定 ID、来源证据、provenance、Adopt/Adapt/Exclude、Feature/Capability/Platform owner、外部依赖、验收和当前成熟度。
- 不再使用“页面已存在”作为完成证据。

现有交付物：

- `docs/product-traceability-ledger.md` 已建立 S01–S30、owner、决策、依赖、成熟度、目标阶段与验收锚点；其中 S07 明确属于 Send/Payment，S30 明确属于 Trustline Add/Set Limit/Remove。
- `.github/pull_request_template.md` 已要求 PR 填写 trace ID、目标阶段、来源路径、失败处理和精确证据。
- 账本是活文档；新行为必须先加 ID，成熟度升级必须带当前 commit/platform/date/result，不能沿用历史绿灯。

### Stage 0A：源码来源与 clean-room 门（基础门已建立，所有 donor-derived PR 持续执行）

目标：确保因 Xaman 许可证而启动的重写不会在 dApps 或其他“Stellar 已改过”的目录中重新引入派生实现。

工作项：

- 按 `docs/provenance/README.md` 对 Stellar/Xaman 行为参考建立文件级 provenance，至少覆盖 `xApps`、`XAppBrowser`、`freighter`、Vault、navigation、services、主题、图标和本地资源。
- 把来源分为 `Xaman inherited`、`Stellar modified derivative`、`provably Fresnica original`、`third-party`。
- 默认只提取产品角色、协议、输入输出、异常和验收行为；新实现者不得复制 donor 的代码结构、表达、注释、测试或资源。
- 对确需直接移植的完全自有文件保存提交历史、作者/权利确认、依赖许可证和审批记录。
- 在 PR 模板增加 provenance 声明；在发布 SBOM 之外保留源码来源账本。
- 为 provenance 生成器增加只读 `--check` 模式并接入门禁：固定 commit 下生成结果与已提交 ledger 不一致时失败，检查过程不得改写工作树。

退出条件：

- 没有把整个 Stellar dApp 目录统称为“自研可照搬”。
- 每个实施中的表面都有明确的 clean-room 或已审批移植路径。
- 无法证明权利的实现一律按行为重写，不因施工速度降低标准。

现有交付物与边界：

- `docs/provenance/donor-source-ledger.tsv` 已固定审计 Stellar `bd0f4540` 与 Xaman `01e2538b`：覆盖 1,642 个目标文件，其中 1,048 个为相同 Xaman blob，594 个为 Stellar modified/provenance-unproven。
- `scripts/audit-donor-provenance.mjs` 可重建上述索引；变更 donor 基线必须同时更新审计 commit 并审阅 ledger diff，不得以移动的 `HEAD` 静默重定义证据。
- 当前没有任何文件被认定为 `provably Fresnica original`，也没有直接移植审批；因此实际默认路径仍是 clean-room rewrite。
- 文件 blob 对比只是来源证据索引，不是法律结论。每个 donor-derived 功能仍需先形成不含实现表达的行为规格，再由实现审查证明没有把 donor 当代码模板。
- `docs/provenance/donor-blob-index.tsv` 另保存两个固定 donor commit 的全树 blob 索引；`npm run provenance:check` 对当前 tracked + non-ignored target tree 做 exact blob collision 与直接移植标记检查，并由 `npm run check`/CI 强制执行。
- 当前唯一 collision allowlist 是 `ios/.xcode.env`，绑定 React Native Community template `0.87.0` 官方路径、Git blob、SHA-256 与 MIT license；不存在“模板文件通用忽略”规则。Android debug keystore 已重新生成成 Fresnica debug key，不使用 allowlist。
- 自动 collision=0 只证明没有已知 exact donor blob/marker，不自动证明 clean-room；Home、Settings、MainTabBar 等 donor-informed surface 在 integration 前仍要人工检查实现结构。
- `donor-source-ledger.tsv` 的固定 commit 漂移目前仍通过人工重建审阅；target-tree collision gate 的自动化不替代该来源账本，也不替代行为规格。
- `36d306f` 已删除 `src/ui/assets/stellar/**`、`src/ui/components/stellar/**`、`src/ui/theme/stellar/**`，并把 MainTabBar/Home/Settings 收缩为中性 `Pressable`/文字/`ActivityIndicator`/`ListRow` presentation；人工结构审查确认这些生产表面不再含 donor Image、500ms debounce helper、Stellar presentation import 或实现来源标记。
- `bd916c5` 已建立全 donor-tree blob 索引与 fail-closed target-tree collision/marker gate，并将 Android debug keystore 重新生成成 Fresnica 自有 debug key。该 rewrite 净树随后 `npm run check` 56/56 suites、284/284 tests，Realm 17/17，ESLint 0 errors / 23 warnings；collision gate 扫描 347 个目标文件，结果为 0 个未授权 exact donor blob、1 个固定 RN template 例外、0 个 direct-migration marker。该结果是 **pre-integration evidence**，clean integration 仍必须全部重跑。

### Stage 1：升级 Fresnica Native SDK 基线（已完成 2026-09-08）

目标：消除 Mobile 0.2.1 与上游 0.3.0 / Core API 5 的能力差。

工作项：

- 更新 compatibility manifest。
- 重新生成 Android 与 Apple React Native adapter。
- 移除 CI 中已经被上游修复的临时 patch；若仍需 patch，逐项保留证据。
- 对新增 API 建立 TypeScript contract：
  - SEP-53 message signing。
  - external signing prepare/apply。
  - unlock/session 所需 API，以实际上游暴露为准。
- 运行 Android/iOS build 与 native smoke。
- 增加版本不匹配 fail-fast 测试。

退出条件：

- Mobile、Adapter、Native Binding、Core Client API 版本矩阵一致。
- Android 与 iOS 都能从干净环境生成 adapter、构建 App 并通过 runtime smoke。
- 无法升级的上游缺口必须有明确 issue 和被阻断 Feature，不得本地发明语义。

执行证据：

- `.fresnica-upstream` 固定到 `native-sdk-v0.3.0` 发布 commit `b1d0427ec5c5398c3bb2e01b886e4e3084e46a73`。
- 发布 AAR / Apple XCFramework 均按 `SHA256SUMS` 验证；RN adapter 0.3.0 在 Mobile RN 0.87.0 工具链重新生成。
- Android `:app:assembleDebug` 与 iOS simulator `xcodebuild` 均成功。
- Android / iOS fresh runtime smoke 均证明 Realm、`parseAccount`、external-signing bridge 与 SEP-53 high-level message-signing bridge 可用。
- 上游 Fresnica #128 / #129 仍 open；Android adapter 构建继续只在 checkout 中应用已登记的 init/JVM-target compatibility patch，不改变 SDK/签名语义。
- `npm run check`：40 suites / 216 tests；`npm run test:realm`：14 tests，全部通过。

### Stage 2：架构边界收口（已完成 2026-09-08）

目标：让目标依赖图成为全仓强制规则。

工作项：

- 将 Capability 所需端口移入 Capability/Domain 所有的目录。
- 将 network config 作为依赖注入，不从 Capability 导入 `appConfig`。
- 将 XDR decode/review projection 移到 Platform 机制或明确的无第三方依赖 Domain projection。
- 去除生产 Capability 对 `@stellar/stellar-sdk` 的直接依赖。
- 去除 Send、Trustline Feature 对 Platform 类型的直接依赖。
- 扩展 `scripts/check-architecture.mjs` 到全部 Feature 与 Capability。
- 修正 `npm run lint`，确保全量 `src/**/*.{ts,tsx}` 进入 ESLint。
- 删除没有实际实现的预留别名，或在首次真实使用时创建受控模块。

退出条件：

- 全部生产 Feature、Capability、UI、Platform 都处于依赖方向检查范围；presentation/style strict scope 随每个新重写表面扩展。
- 架构检查能用失败 fixture 证明规则确实生效。
- Capability 单测无需 React Native、Realm、NativeModules 或 Stellar SDK mock。

执行证据：

- Capability-owned `FresnicaSdkPort`、network context、Payment/Trustline/Balance/History/Transaction gateway ports 已建立；旧 `platform/fresnica/FresnicaSdk.ts` 与 `types.ts` 转发契约已删除。
- Payment / Trustline exact-XDR decode 与 review projection 已下沉到 `StellarSdkGateway`；Capability 只消费稳定 projection，不再 import Stellar SDK。
- `createAppServices` 统一注入 network id / passphrase / Horizon endpoint；Onboarding、Settings 与 Path Payment platform 机制不再反向读取 `appConfig`。
- production Capability / Feature / Platform 反向依赖审计为 0；Capability 单测无 React Native、Realm、NativeModules、Stellar SDK 依赖。
- `scripts/check-architecture.mjs` 已覆盖全部 production Feature / Capability / UI / Platform 的依赖边界，并用 4 个负向 fixture 验证规则会失败；presentation/style strict scope 仍按触及范围逐步扩展。
- `npm run lint` 已纳入完整 `src/`；当前 0 errors、25 个既有 warnings。`@lib -> src/lib` 空预留别名已删除并同步 alias gate。
- `npm run check`：40 suites / 216 tests；`npm run test:realm`：14 tests，全部通过。

### Stage 2.5：交易可靠性与重启恢复（已完成 2026-09-10）

目标：在新增 Swap、SDEX、Claimable、LP、dApp transaction 等写路径前，把同一条提交管线补成可重启恢复且防重复的基础能力。

当前产品追踪范围：S07 Send/Payment 与 S30 Trustline。Stage 2.5 的实现 PR 必须同时引用这两个 ID，证明恢复能力来自共享 Transaction 管线，而不是只为其中一条路径做特例。未来 S10–S12、S18 的改账本部分必须复用这里封板的管线。

工作项：

- 定义 Capability-owned pending submission / reconciliation 契约和公开 DTO。
- 在签名完成、提交开始前或能够确定 transaction hash 的最早安全点持久化公开恢复状态。
- 保存 network id、account id/address、transaction hash、提交时间、operation/intention identity 与协调状态；不得保存 secret、passphrase、unlock key、未保护 signer material 或为 UI 方便长期保存敏感 XDR。
- 对 timeout/transport uncertainty 按原 transaction hash 查询 Horizon/RPC，区分 confirmed、rejected、still-unknown；不设置自动失效窗口。长期 still-unknown 只允许降低查询频率或改变 UI 提示，仍继续阻止普通重构/重试。
- App cold start、foreground、网络恢复和用户显式刷新走同一协调入口。
- 未协调前阻止相同经济意图的普通重试；任何显式替代交易政策必须由 Transaction Capability 规定。
- submitted 与 uncertain 都使 Balance、Activity 和相关 read model 失效，但刷新失败不能改写已确认的 transaction identity。
- 为 process death、重复点击、超时后实际上链、确定拒绝、长期未知和跨网络恢复增加 Realm/Capability/E2E 测试。

退出条件：

- S07 Payment 与 S30 Trustline 共享恢复实现，不只是共享 `submitTransaction` 调用。
- 杀进程后仍能恢复并协调 uncertain submission。
- 在协调前不能无提示构造并提交相同经济意图的新交易。
- Transaction 管线满足 `origin/fresnica/docs/capabilities/transaction.md` 的 uncertainty 要求后，才能整体升级到 L4。

执行证据（2026-09-10，Transaction recovery 切片）：

- Trace IDs：S07、S30。`043c947` 在 exact signed XDR 广播前计算 transaction hash 并持久化公开 pending metadata；持久化失败即不广播，不保存 XDR、passphrase、secret、unlock key 或 signer material。
- `3651aa7` 对 `network + account + economic intent` 建立 unresolved duplicate guard，并在 Repository `create()` 层关闭并发竞态；still-unknown 无时间失效，只有 confirmed/rejected 或未来 Transaction Capability 明确定义的用户 replacement/cancel policy 才能解除。
- `b035037` 引入 `@react-native-community/netinfo@12.0.1`，仅 `platform/system` 解释 connectivity；只有明确 offline → online 触发恢复，`isInternetReachable === null` 保持 unknown。cold start、foreground、network recovery、manual refresh 全部进入同一个 App-level single-flight coordinator。
- `6e50817` 建立 account/network-scoped read invalidation port/store：submitted 与 uncertain 均使 Balance、Activity 及相关详情 stale；deterministic rejection 不伪装成账本变化，刷新失败也不改变既有 transaction identity。
- `8f5bffd` 覆盖 restart、timeout 后实际 confirmed、deterministic rejected、跨网络隔离和 S07/S30 共用 Repository；长期未知测试从 2020 跨到 2036 并再次 reopen，仍保持 duplicate guard。
- `eaa1e8c` 将 S07/S30 的 Horizon Platform transport 切换为 Stellar SDK 17.0.1 官方 `/axios` variant，并把内部 submit seam 收敛为 signed-XDR string；解决 RN 默认 fetch/feaxios transport 在真实提交时的 400 问题，不改变 Capability 语义。
- `5db3610` 增加可重复 Android Testnet process-death harness。由已提交 HEAD fresh rebuild 后执行 `npm run smoke:transaction-recovery:android`：真实交易 `f4c319cbe5db754888a419af7311901331ebf1b5a9209d2dd7fff8cd057e1417` 先持久化为 uncertain；PID 7631 被 force-stop；新 PID 7773 从同一 Realm 读取同一 network/account/source/hash，只做 reconciliation，最终 confirmed，没有重新签名或广播。
- 当前代码门禁：`npm run check` 55 suites / 278 tests 全通过；`npm run test:realm` 17/17；ESLint 0 errors / 29 warnings；format、alias、architecture、locale 全通过。
- Native gate：Android `npm run smoke:android` 通过；iOS fresh simulator `xcodebuild` 成功，随后 `npm run smoke:ios` 通过，均验证 Realm、`FresnicaCore.parseAccount`、external-signing bridge 与 SEP-53 bridge。iOS simulator 为 iPhone 15 Pro / iOS 17.2。
- 以上只升级 Transaction recovery 基础切片；S07/S30 的产品成熟度仍保持 L3 partial，等待 Stage 4 各自完整用户闭环/native/E2E。未来 S10–S12、S18 的写账部分必须复用该管线。

### Stage 3：产品 Shell 与横切能力

目标：建立所有后续 Feature 可直接消费的成熟壳。

工作项：

- 完成统一 AppTheme：
  - semantic color、spacing、typography、radius、elevation。
  - light/dark/system。
  - 为未来 image → generated palette 保留持久化与替换 seam。
- 把 onboarding、send、settings、security、trustlines 的 legacy palette 全部迁移。
- 建立统一 Screen、Header、ListRow、Modal、Bottom Action、Empty/Error/Loading。
- 由 App chrome 统一管理 Safe Area 与 StatusBar。
- 建立 lifecycle/session lock。
- 建立结构化 Logger：
  - correlation id。
  - secret/XDR/passphrase redaction。
  - 用户可导出的 session diagnostics。
- 建立统一 Feature error projection 和 retry policy。
- 建立最小产品 E2E/native-flow harness，至少能重复执行 cold onboarding、进入主壳、真实账户读取和一条 Testnet 写路径；后续 Feature 扩展同一 harness，不等 Stage 9 才首次建立。
- 建立 Network/RPC 管理壳：
  - 正常模式默认 Mainnet。
  - 鉴权开启 Developer Mode 后显示 Testnet 和自定义 RPC/Horizon 管理。
  - 关闭 Developer Mode 时按 Stellar 行为回到 Mainnet。
  - 账户、缓存、review 与签名全部按 network id 隔离。

退出条件：

- 所有现存 Screen 只消费 AppTheme。
- 无 Feature 硬编码状态栏、安全区或裸色。
- 冷启动、后台超时、前台恢复、锁屏取消都有测试或运行证据。
- Logger 不记录敏感材料。
- L4 所需的产品 E2E 证据已有可执行载体；只有单元测试的表面最高仍是 L3。

当前执行证据（截至 2026-09-10，仍为 partial）：

- 浅色 semantic `AppTheme`、App-level `StatusBar`、共享 `Screen` safe-area shell 已接入；`src/features` 裸色、legacy palette、Stellar theme import、Feature 直接 `SafeAreaView` 审计均为 0。
- 用户已完成 safe-area 人工走查；Theme 采用 B 方向：最终 dark palette / system switching 等正式视觉稿，不自行发明品牌深色方案。
- `AppModal`、`BottomAction`、`ListRow`、`StateView` 与既有 Button/Card/Field/Header/Screen 已形成共享 primitive；组件契约测试通过。
- `SessionLogger` 已进入 App 组合根，提供 correlation id、ring buffer、export 与 secret/mnemonic/passphrase/passcode/unlock key/envelope/XDR/token redaction。
- 统一 Feature error projection 已被 Home、Onboarding、Accounts、Security、Send、Trustline 消费；Native `invalid-passcode` 仅作为 adapter 兼容错误码，产品文案统一为 App Passphrase。
- App Passphrase 产品策略已冻结：不提供短数字 passcode 保护根；普通签名优先 System Auth，导出/恢复/改密及显式高风险事务要求 fresh strong passphrase。
- session lock 的纯状态机已覆盖 cold-start、background timeout、foreground resume、cancel 与 verified-unlock transition；但当前 Fresnica 0.3.0 React Native adapter 仍没有通用 `authenticateSystemAuth(reason)`。在上游提供安全 challenge 前，不得用 reveal、dummy XDR、伪 biometric probe 或 JavaScript credential scheme 绕过。
- Network Settings 保持只读开发壳：当前开发配置仍为 Testnet；首版策略明确为 Mainnet 默认，鉴权开启 Developer Mode 后开放 Testnet/custom Horizon/RPC。
- 定向 Stage 3 contract tests：4 suites / 18 tests 通过。

未封板项：

- dark/system Theme 与 image-generated palette：等待正式视觉稿/主题设计后启用。
- session biometric unlock：被 Fresnica 通用 System Auth challenge API 阻断。
- Developer Mode 鉴权、持久化 network selection、custom endpoint health/manage：继续按后续产品闭环实现。

### Stage 4：现有闭环修复

目标：先把已经接近完成的功能变成真正 L4。

执行顺序：

1. Onboarding 与账户
   - 新建 mnemonic。
   - 导入 secret/mnemonic。
   - mnemonic language、BIP39 passphrase、derivation path / account index 按 Fresnica 契约保留完整恢复语义。
   - watch-only。
   - pending backup 恢复。
   - 现有钱包 Add Signer；若缺上游验证 API则保持阻断。
   - Account label、选择、排序、隐藏、删除，以及引用计数下的 signer 清理。
   - Reveal/Export、修改 Fresnica Passphrase、全 protected signer staged `reprotect` + 原子提交 + System Auth registration 修复；真正缺 API 的子步骤单独阻断，不把整个生命周期都标成上游阻断。
2. Home 与资产
   - account switch。
   - inactive state。
   - balance refresh 与 focus invalidation。
   - asset details。
3. Send
   - form → review → auth → submit → result。
   - create-account 分支。
   - issued asset、memo-required、reserve/liability/capacity。
   - memo text / ID / hash 分别验收；MEMO_RETURN 和 muxed `M...` 地址在共享 Capability 明确前 fail closed，但必须保留追踪项，不能静默当作 Exclude。
   - 提交后余额和 Activity 失效再拉。
4. Trustline
   - Add、Set Limit、Remove。
   - 零余额/零负债移除规则。
5. Activity
   - 列表、分页、筛选、搜索。
   - 注册并接通 operation detail。
   - 逐 operation family 扩展稳定 projection、参与方、交易浏览器、警告和上下文操作；unknown 继续明确显示 unsupported。
   - 不宣称 gap recovery 等于完整历史。
6. Settings
   - Accounts、Security、Language、About。
   - Network 在真实可切换前继续明确标记只读。

退出条件：

- 上述每项达到 L4。
- 每条写路径都复用同一 transaction submission pipeline。
- 成功后不乐观篡改 Realm 余额。
- 所有新增/重写用户文案进入 locale 字典，金额/日期/分隔符走格式化 helper；Accessibility label、动态字体和屏幕阅读顺序随切片验收，不推迟到发布阶段补齐。

当前执行证据（2026-09-09）：

- `Settings → Accounts → Account Detail` 已改为同一 Settings native stack 内的本地历史，不再为打开 Detail 先切 Home tab；Back 语义现由 `navigation.goBack()` 返回 Accounts。跨 tab 入场导致的视觉下跳是否完全消失仍待 simulator 人工确认。
- Settings 与 Home 的 Add Account 复用同一 watch-only Screen，但各自保留自己的 native-stack 返回历史。现有钱包新增 protected software signer 继续 fail closed，因为 Fresnica 0.3.0 尚无 framework-safe `verifySignerPassphrase`。
- 新保护 App Passphrase 策略已从 Onboarding 抽到 Application Security：至少 15 个 Unicode scalar，不静默 normalize，不增加强制大小写/数字/符号组合规则；Onboarding 已增加最低要求、确认一致和 System Auth / fresh-passphrase 职责提示。新版视觉仍待 simulator 人工确认。
- S04 `6a19346` 已将 System Auth Disable 改为显式二次确认：Cancel/backdrop/system-back 不触发 Native remove，busy 期间阻止重复确认；Native remove 失败时保持真实 enabled 状态并可重试。该切片来自 Fresnica security requirement，未参考 donor 实现；app-session unlock 仍被通用 System Auth challenge API 阻断，因此 S04 仍是 partial/blocker。
- Home 与 Activity 的 focus revalidation 由 App navigator wrapper 触发，Feature 不导入 React Navigation；交易返回 Home 或后续切回 Activity 时重新读取权威数据，不对 Realm 余额做乐观修改。
- Home `asset-details` 已接通：导航只携带 `accountId + BalanceAsset identity`，详情页重新读取 Balance capability，覆盖 loading / ready / inactive / unsupported / missing / error 与手动 refresh；Asset Metadata / Stellar TOML 保持 Stage 8。
- Activity `operation-details` 已接通：导航只携带 `accountId + operationId`；History Capability 使用单 operation Horizon 查询，验证 operation id 与账户关联，区分 404 / gateway failure，并只向 Feature 暴露稳定 DTO。
- S30 Trustline 已闭合 Add / Set Limit / Remove 的产品语义：Set Limit 要求现有 trustline、正 limit 不低于 `balance + buying liabilities`、非零结果要求 issuer 仍存在，并在签名前重新验证 intent、limit、authorization/clawback 与 ledger state；Manage Assets 复用同一 exact-XDR review / System Auth / sign / submit 管线。Stage 2.5 shared recovery 已与 S07 一起通过，但 S30 的完整 Stage 4 产品/native/E2E 仍未全部验收，因此继续标记 L3 partial。
- Stage 2.5 已在 2026-09-10 从该临时失败状态闭合；其冻结证据仍是 `5db3610` 上的 55 suites / 278 tests 与 Realm 17/17。后续安全/发布收口到代码 head `50d8653` 时，`npm run check` 为 56 suites / 284 tests、`npm run test:realm` 17/17、ESLint 0 errors / 28 warnings；这组较新数字不回写覆盖 Stage 2.5 历史快照。Stage 4 尚未完成的账户/Send/Trustline/Activity 产品验收仍按各 Sxx 独立保留。

### Stage 5：Request 与 Stellar URI

目标：完成收款分享闭环。

工作项：

- 地址 QR 与系统 Share。
- SEP-7 request URI。
- 可选 amount、asset、memo。
- 扫描、粘贴、系统 deep link 进入同一个解析和路由模块。
- 对未知 URI、错误 network、错误 asset identity fail closed。
- 法币汇率为可选展示能力，不阻断基础收款。

退出条件：

- 无 Xaman Destination Tag 或 XRPL link decoder。
- 三个入口产生一致的 Domain request。
- 无敏感数据进入 URL。

### Stage 6：Path Payment Swap

目标：重写 Stellar 已实现的报价与兑换体验。

前置：

- `origin/fresnica` 的 Path Payment/Swap 共享契约完成。
- 不得以 SDEX Offer 契约替代 Path Payment。

工作项：

- strict-send 与 strict-receive quote。
- 滑点、路径、报价过期和重报价。
- exact route → exact XDR review。
- 复用 authorization/sign/submit/result。
- quote 与提交网络一致性。

退出条件：

- Capability conformance 测试通过。
- 过期报价不可签名。
- 不使用 JavaScript float 计算链上值。

### Stage 7：dApps 与 Freighter

目标：保留 Stellar 已形成的 dApp 产品行为，以 clean-room 方式在 Fresnica 边界内重写；只有 Stage 0A 已证明完全自有并获批的独立文件才允许直接移植。

工作项：

- Catalog 与 Recent。
- Search、Category、Disclaimer。
- 支持用户输入任意 dApp URL。
- Browser lifecycle。
- Origin normalization 与两级信任模型：
  - Catalog/allowlist dApp：展示 Fresnica 发布/审核来源和标准连接确认。
  - 用户输入 dApp：每次首次打开展示更强风险警告，明确“未由 Fresnica 审核”，不得继承 Catalog 信任。
- Permission grant、revoke、scope 和持久化。
- Freighter request access/public key/network/user info。
- transaction XDR 与 Soroban auth entry request。
- SEP-53 message signing。
- 为 Freighter/browser command 建立逐方法矩阵：请求参数、响应版本、origin/account/network binding、权限 scope、取消/错误、是否需要签名、是否依赖 backend；不能用“数据互通”四个字替代验收。
- 浏览器分享、剪贴板、相机/扫码、文件、外链和系统权限均通过受控 Platform port；前后台、账户切换、网络切换和 navigation race 必须使不再有效的请求/permission 失效。
- Connected dApps Settings。
- dApp transaction 进入统一 review/sign/submit，不能直接调用 Native 签名。
- 保留 Stellar 已实现的 allowlist、自定义 URL、Disclaimer 和差异化弹窗行为作为产品验收参考；不得据此推定对应目录可直接复制。
- 自动链接钱包通过受控 Universal Link / App Link / Custom Scheme 进入统一 Deep Link 路由，不通过 Push payload 直接授权。
- Push payload 只能携带不透明事件 id 和受限 route hint，不能携带 secret、passphrase、未审阅 XDR 或自动授权指令。

建议拆分：

- `features/dapps`：catalog、browser 产品状态与 UI。
- `capabilities/dapp-interaction`：request/session/permission 语义。
- `platform/dapp-browser`：WebView 和 message transport。
- `platform/fresnica`：message/transaction/auth-entry signing。
- `app`：deep link 与 browser composition。

退出条件：

- origin spoof、navigation race、replay、permission escalation 有测试。
- 任意 dApp 请求都可取消、拒绝和审计。
- 无 Xaman OTT/Backend/Payload 依赖。
- Stage 0A provenance/clean-room 记录完整；浏览器与 Catalog 中不存在未获许可的 Xaman/Stellar 派生实现或资源。
- 依赖可信远端身份或 Push backend 的子能力在 backend 到位前保持明确阻断，不降低 permission/origin 约束。

### Stage 8：Stellar 扩展产品

以下均进入完整重写计划的必达范围，按依赖和风险逐项执行；可以分多个 release 交付：

- Asset Metadata 与 Stellar TOML。
- Asset Discovery、Catalog/Registry、图标缓存、风险来源和资产身份验证；不能把“metadata”当成完整发现与风险产品。
- Claimable Balance 读与 claim。
- Address Book。
- Developer Mode。
- Network 管理与健康检查。
- Session Logs。
- Friendbot，仅 Testnet。
- SDEX Offer 产品；按 Normative SDEX 契约实现，不与 Swap 混用。
- General Settings。
- Advanced Settings。
- Security Settings。
- About。
- Terms & Conditions。
- Help、Credits、ChangeLog 与非 dApp 的通用 InAppBrowser。
- Theme 与多语言切换。
- 显示币种、区域格式、反馈入口及其他经追踪账本确认的 General preference。
- Liquidity Pool 列表、详情、份额/储备语义和 Stellar 已实现的撤出等确切操作；没有共享写契约时诚实阻断，不用“适用操作”模糊签收。
- External/Hardware signer。
- Soroban G-account 授权。
- AppState、隐私遮罩、剪贴板时效、相机/照片/文件/分享权限与拒绝恢复等原生平台角色。

每一项单独达到 L4，不组成“大功能 PR”。

Hardware Signer 候选验证矩阵（不是当前支持声明）：

- Candidate provider：Ledger。
- Candidate device：Ledger Nano X、Ledger Flex、Ledger Stax。
- Candidate transport：BLE。
- Candidate platform：iOS 与 Android。
- Stellar derivation：SEP-5，默认 `m/44'/148'/0'`。
- 先完成 maintained library / vendor SDK、许可证、RN 0.87 兼容和 BLE 权限/生命周期 spike；不可行时回到产品范围决策，不自行实现未经审阅的 APDU 语义。
- 只有真机完成账户发现、精确交易 clear-sign、取消、断连、错误 signer/path 拒绝和重复回归的组合才能列为 Supported。
- Supported 的最小单位是 provider + device model + transport + platform + OS + Stellar App/firmware version 的实测组合。
- Ledger Nano S Plus 不属于首批跨平台承诺；USB-C 可在后续作为 Android-only 组合验证。
- USB/HID、NFC、Trezor 和其他 provider 不属于首批范围。

职责边界：

- Fresnica Core/Native SDK 生成精确待签名内容，绑定 expected signer，并在返回后验证 signer identity、transaction hash 和 transaction XDR。
- Mobile Hardware Signer Provider 负责 BLE 发现、连接、transport 生命周期、Ledger APDU/设备交互和设备专有错误映射。
- Mobile 不重新实现签名安全模型。

退出条件补充：

- 候选型号不是完成标准；逐组合 compatibility ledger 是完成标准。
- 没有实测通过的组合不得出现在商店文案或首版支持声明中。

### Stage 8B：Backend 依赖占位（非当前主线）

目标：让 Mobile 可以在没有 Fresnica Backend 的情况下继续完成本地钱包能力，同时不伪造 Push、远端 dApp 身份或云数据能力已经闭环。

工作项：

- 为 Catalog、Push、device token、dApp identity、notification scope、远程配置和其他服务建立版本化接口与威胁模型。
- Mobile adapter 必须支持 `unavailable` / `not-configured` / degraded 状态；本地钱包、公开地址分享和前台 dApp 交互不应被无关 backend 阻断。
- 可以完成受控 Deep Link、Universal Link / App Link、前台事件和本地通知；不得把 Firebase 客户端配置当成可信发送后端。
- 资产 TOML、图标等公开远端读取分别定义 authority、缓存、redirect/TLS、容量和离线策略，不与需要身份认证的 Push backend 混成一个服务。

退出条件：

- 当前无 backend 时，产品不会显示虚假的“远程推送已启用”或自动授权能力。
- 依赖 backend 的必达功能保留稳定追踪 ID 和阻断原因；未来 backend 可通过既定端口接入，不需重写 Feature/Capability。

### Stage 9：发布工程

目标：从可开发产品升级为可发布钱包。

工作项：

- 同一首版支持 Mainnet 与 Testnet。
- 默认用户路径使用 Mainnet；Developer Mode 鉴权后开放 Testnet 与自定义 RPC/Horizon 管理。
- Endpoint allowlist/guard。
- 依赖与原生产物 hash 验证。
- SBOM 与 artifact provenance。
- 将 Android namespace/Application ID 从临时 `com.fresnica.mobile` 迁移并冻结为 `com.fresnica.wallet`，同步 Manifest provider、Deep Link/App Link、Firebase（若启用）、签名、CI 与商店记录。
- 冻结最终 iOS Bundle ID、Apple Team、entitlements、Associated Domains、APNs、provisioning profile、CI secrets 与 App Store Connect 记录；不得沿用 Stellar 的 `com.xrpllabs.xumm` 遗留值。
- 本产品不迁移旧 Stellar/Xaman 数据；仍必须实现 legacy-data detection 和受控 fresh-start UX。同 Application ID 覆盖安装时不得读取旧授权或静默 wipe，用户确认恢复材料前不得删除可能仍需恢复的钱包数据。
- Realm schema migration、当前 Fresnica 版本间的升级/回滚与故障 UX；“不迁移 Stellar”不等于以后无需 Fresnica schema migration。
- Android release 使用独立 release signing，禁止 debug key；iOS 使用正式 distribution 配置。
- Root/jailbreak 策略。
- Android FLAG_SECURE 与 iOS screen capture 处理。
- Crash/analytics 隐私策略。
- Accessibility、locale、性能和低内存恢复。
- 扩展 Stage 3 已建立的 E2E/native-flow harness：
  - cold onboarding。
  - restore/import。
  - send。
  - trustline。
  - swap。
  - dApp permission + sign。
  - background lock。
- Mainnet release 前必须完成 Testnet soak；这不改变首版同时包含 Mainnet/Testnet 的产品范围。

当前里程碑 release-signing 证据（2026-09-10，Stage 9 仍未完成）：

- `50d8653` 删除 `buildTypes.release -> signingConfigs.debug` fallback；release signing 仅接受四个显式 Gradle property / 同名环境变量，部分配置或缺失 keystore 都 fail closed，credential value 不做 trim/normalize。
- 无 release credentials 时 `:app:assembleRelease` exit 1；根 `./gradlew assemble --dry-run` 因实际 task graph 包含 release packaging 同样 exit 1，不能通过入口名称绕过。
- 本地仅在 `/tmp` 生成临时测试 PKCS12，并成功执行 `:app:assembleRelease`；`apksigner` 证明 APK 证书为 `CN=Fresnica Local Release Gate, O=Fresnica, C=US`，且不是 Android Debug。临时 keystore 已删除，不是生产签名材料。
- `native-android-gate.yml` 已增加同样的无凭据 fail-closed 与 ephemeral CI release-signing gate；当前只完成本地 YAML/Gradle 验证，尚无本 commit 的远端 GitHub Actions 成功记录。
- 生产 Android release keystore / CI secret 尚未配置；Application ID 仍是临时 `com.fresnica.mobile`，所以不得把本项写成“正式发布签名完成”。

退出条件：

- Release candidate 的所有必需 Capability 为 L4。
- 所有 CI workflow 有真实 steps 和成功证据。
- 安全审查无未接受的高严重度问题。

## 8. 推荐 PR 序列

每个 PR 保持一个可审查目标。

1. `chore(native): align Mobile with Fresnica Native SDK 0.3.0`
2. `refactor(architecture): move capability ports out of platform`
3. `chore(lint): enforce source-wide lint and architecture rules`
4. `docs(provenance): establish clean-room product ledger`
5. `feat(transaction): persist and reconcile uncertain submissions`
6. `test(e2e): establish repeatable native product-flow harness`
7. `feat(theme): complete semantic AppTheme shell`
8. `feat(security): wire lifecycle session lock when upstream challenge exists`
9. `feat(activity): close operation-detail navigation loop`
10. `feat(home): invalidate balances after submitted transactions`
11. `feat(accounts): finish signer-aware account lifecycle`
12. `feat(request): add SEP-7 request and shared URI routing`
13. `feat(swap): add path-payment capability and product flow`
14. `feat(dapps): clean-room rewrite catalog and browser shell`
15. `feat(dapps): add permission and Freighter request model`
16. `feat(dapps): route transaction and message signing through Fresnica`
17. `feat(claimable): add claimable balance flow`
18. `feat(developer): add Developer Mode, network tools and session logs`
19. `spike(signers): validate Ledger BLE candidate matrix`
20. `feat(signers): add only verified external/hardware combinations`
21. `chore(identity): freeze Android application ID and iOS bundle identity`
22. `chore(release): add Mainnet release gates and expand E2E`

若某个 PR 的上游 Capability 未冻结，该 PR 必须停在契约设计或被阻断状态，不能用 Mobile 私有实现绕过。

## 9. 单个 Feature 的完成模板

每个 Feature PR 描述必须回答：

- 产品行为参考来自 Stellar 的哪个 Screen/Flow？
- 对应产品追踪 ID 是什么，是否把该 ID 的所有子行为都签收？
- donor 文件来源属于 Xaman inherited、Stellar modified derivative、provably Fresnica original 还是 third-party？本 PR 是 clean-room rewrite 还是已审批移植？
- 决策是 Adopt、Adapt 还是 Exclude？
- 哪个 Fresnica Capability 是语义权威？
- 哪些第三方机制由 Platform 实现？
- Feature 持有的判别联合状态是什么？
- exact transaction identity 如何贯穿 review/sign/submit？
- 取消、失败、过期、重试、uncertain 如何表现？
- 是否新增敏感数据？保存在哪里？为什么安全？
- 是否影响 legacy-data detection、当前 Fresnica schema migration 或覆盖安装行为？
- 是否依赖 backend/第三方服务？未配置、离线、限流、身份不可信时如何降级？
- 用户文案、金额/日期格式、Accessibility label、动态字体和屏幕阅读顺序如何验收？
- 哪些架构 strict scope 被新增或扩展？
- 哪些单元、集成、native、E2E 证据已执行？

最低验收命令：

```bash
npm run check
npm run test:realm
```

涉及原生、Realm schema、签名、系统认证或生命周期时，还必须执行对应 Android/iOS gate。

## 10. 已确认的完整计划范围与发布约束

- 所有本节和 Stage 4–8 列出的能力都是完整重写计划的必达范围，可以按依赖和风险分先后及多个可发布增量；未进入第一个 release 不等于 Exclude。
- 第一个可发布钱包增量至少支持 Mainnet 与 Testnet、账户/Signer 基础生命周期、Home/Balance、Send、Request、Trustline、Activity、必要安全与交易恢复；具体 release 切分由追踪账本决定，不降低最终范围。
- 默认正常模式为 Mainnet；鉴权开启 Developer Mode 后显示 Testnet 与自定义 RPC/Horizon 管理，行为参考 Stellar。
- `dapp.fchain.io` 由 Fresnica 团队控制，可作为正式 Catalog。
- 当前没有 Fresnica 自有后端；已有 Firebase 客户端配置不等于可信发送端。Backend 不是当前主要目标。
- Push Notification、远端 dApp 通知和需要服务端身份绑定的能力属于最终必达范围，但在 Backend 未交付时保持明确阻断；本地通知、前台事件和受控 Deep Link 可以先完成。
- Fresnica 发布的 dApp 最终支持通过受控 Deep Link 打开钱包，再进入标准 permission/request 流程；“打开”不等于自动授权或自动签名。
- SDEX、Claimable、Friendbot、Address Book、Developer Mode、LP、General、Advanced、Security、About、Terms、主题和多语言切换全部属于完整计划范围。
- 自定义图片提取并生成 AppTheme 是完整主题功能的完成门，不要求在基础交易闭环之前完成最终视觉。
- Ledger Nano X/Flex/Stax + BLE + iOS/Android 是候选矩阵；只有逐组合实测通过的项才进入某个 release 的支持声明。
- Android 最终 Application ID 是 `com.fresnica.wallet`；iOS 最终 Bundle ID 待产品/Apple Developer 配置确认。旧数据不迁移，但覆盖安装必须使用受控 fresh-start UX。

### Push Notification 当前可交付边界

无 Backend 时可先支持：

- Fresnica 产品公告/安全通知。
- 已连接 dApp 的前台事件与本地通知。
- Deep Link 唤起后由 dApp 发起标准 Freighter permission/request 流程。

Backend 交付并完成身份/滥用验证后才可支持：

- 受控 Firebase 发送的 `open-dapp` 通知。
- 受控 Firebase 发送的 `open-activity` / `open-transaction` 路由提示。

必须继续阻断：

- 任意第三方 dApp 直接持有 FCM 服务端凭据。
- Push 到达后自动授予连接、账户访问或签名权限。
- Push payload 直接携带并执行待签名 XDR。
- 在没有可信发送端、设备 token 注册和 dApp 身份绑定协议时，宣称“任意 dApp 可在后台远程推送”为完整功能。

后续 Fresnica Backend 至少需要承担：

- FCM device token 注册、轮换和撤销。
- Catalog dApp identity 与允许的 notification scope。
- 认证、限流、滥用处理和审计。
- 不透明 notification id 到受控内容的解析。
- 不接触钱包 secret、passphrase 或代用户签名。

### 已明确不应自行推进

- 在共享 Path Payment 契约缺失时发布 Swap。
- 在会话安全 API 不足时自行派生或持久化 unlock key。
- 把 WalletConnect 加入“Stellar 功能等价”范围。
- 复制 Xaman/Stellar 的 vault、navigation、services、xApps/browser 派生实现或 XRPL ledger 代码。
- 把 Xaman 云服务替换成未经确认的 Fresnica 云服务。

## 11. 当前下一步

立即执行顺序：

1. Stage 1 Native SDK 升级已完成。
2. Stage 2 架构边界收口已完成。
3. **Stage 0A 基础账本已经建立；所有 donor-derived PR 持续执行 clean-room 规格、来源声明与独立审查，当前没有任何可直接移植文件。**
4. **S07 Payment + S30 Trustline 的 Stage 2.5 uncertain submission 恢复与防重复已于 2026-09-10 完成首轮证明；以后新增改账本类型必须复用该管线，不能另建恢复路径。**
5. **`rewrite/stellar-source-parity` 只用于完成 Stage 0A 净树 remediation：删除未经授权的 donor presentation 资源/实现，建立 target-tree collision gate，并把受影响表面收缩到中性功能布局。不得再把这个含历史 donor blob/port commits 的 412-commit 分支普通 merge 到 `main`。**
6. remediation 净树通过 `npm run check`、Realm、target-tree collision 与人工 Home/Settings/MainTabBar 结构审查后，从最新 `origin/main` 新建 clean integration 分支，把 rewrite 分支的**最终净树**作为一个新的里程碑 snapshot/squash commit 引入；该 integration 分支不得继承 rewrite 历史。
7. clean integration 分支重新执行全部代码/Realm/provenance、Android/iOS native、Android release-signing 和 PR-triggered CI 门。全部通过后，才允许 `integration → main` PR 使用普通 merge commit；最终文档记录新的 integration commit SHA 与 PR/CI。生产 release keystore、最终 Application ID/iOS identity 仍属于 Stage 9 后续。
8. 同步设计缓存 schema、失效规则和容量，不在页面完成后补做第二套数据层。
9. 将 Push 的“当前无后端范围”和“未来 Backend 协议”分开验收。
10. 在发布工程中恢复 Android `com.fresnica.wallet`，冻结新的 iOS Bundle ID，并实现不迁移旧数据的受控 fresh-start。

这条顺序避免两类返工：

- 用旧 Native API 写完 dApp/锁/外部签名后再次迁移。
- 在 Capability 与 Platform 仍混合时复制大量 Feature，扩大架构债务。
- 在不确定交易未协调时扩展多种写路径，放大重复上链风险。
- 把 Stellar 派生目录误当成完全自有代码，再次引入许可证风险。
