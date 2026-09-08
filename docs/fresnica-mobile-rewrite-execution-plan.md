# Fresnica Mobile 重写评估与执行计划

> 状态：2026-09-08 源码审计基线
>
> 审计对象：
>
> - 当前 Mobile：仓库根目录 `src/`、原生工程、测试与 CI
> - 底层权威：`origin/fresnica`
> - 产品行为基线：`origin/Stellar@stellar-migration`
> - 工程成熟度参考：`origin/Xaman-App`
>
> 本文是执行入口，不以已有路线文档的结论为前提。已有文档只在源码审计后用于交叉验证。

## 1. 最终判断

当前项目已完成“可继续承载重写”的核心底座，但尚未达到“底层封板”或“整体架构成熟”的状态。

更准确的定级是：

- 核心写账底座：成熟度 L3+，Payment 与 Trustline 主链达到 L4。
- 原生安全与持久化：现有版本下达到 L3/L4，但 Mobile 使用的 Fresnica Native SDK 0.2.1 已落后于上游 0.3.0。
- 架构边界：方向正确，执行成熟度 L2；约束只覆盖部分目录，Capability 仍直接依赖 App 配置、Platform 类型和 Stellar SDK。
- 产品壳：React Navigation、四个可见 Tab 与 Actions Overlay 已成立，但主题、安全区、会话锁、统一错误与日志仍未形成完整横切能力。
- Stellar 功能重写：只完成少数可运行闭环；dApps、Request、Swap、Claimable、资产元数据、Developer Mode、通讯录等尚未重写完成。
- 发布成熟度：尚未达到 Mainnet 钱包发布条件。

因此，后续不应重新搭建第二套底层，也不应按页面数量平推。正确策略是先消除底座版本差和边界缺口，再以“一个真实用户闭环 + 一条复用交易管线 + 可执行验收证据”为单位逐功能重写。

## 2. 审计证据

### 2.1 已通过的本地验证

- `npm run check`：通过。
- TypeScript：通过。
- 格式与基础 Lint：通过。
- 模块别名、架构守卫、语言包检查：通过。
- Jest：40 个测试套件、210 个测试全部通过。
- `npm run test:realm`：1 个 Realm 集成套件、14 个测试全部通过。
- 现有 Native runtime smoke 结果证明过 Realm round-trip 与 `FresnicaCore.parseAccount`，但结果日期为 2026-08-28，且只覆盖最小链接，不代表当前完整产品运行。

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

- `scripts/check-architecture.mjs` 只严格覆盖部分 Feature，不能证明全仓库符合目标边界。
- `npm run lint` 当前只显式检查配置和脚本文件，没有把全部 `src/**/*` 作为命令输入。
- 多个 Capability 生产文件仍直接导入：
  - `@stellar/stellar-sdk`
  - `src/app/config/appConfig`
  - `src/platform/fresnica`
  - `src/platform/stellar`
- `features/send/sendProductFlow.ts` 与 `features/trustlines/trustlineProductFlow.ts` 仍依赖具体 Platform 契约。
- Activity detail 路由有类型声明但未注册为可达闭环。
- dApps 当前只是静态预览。
- Request 与 Exchange 没有实际 Feature 目录和生产接线。
- App lock 只有占位 Screen。
- 当前仅 Testnet；Network Settings 为展示状态。
- 当前单本地 signer；multisig、hardware provider 和 C-account 均未形成 Mobile 产品闭环。

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
- Stellar 自有 dApp Catalog、Browser、Freighter Bridge、Permission

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

不得直接复制 Xaman 源码。其 CUSTOM 许可对公开、商业与分叉用途有限制。以下机制也不进入目标架构：

- 全局 `services/` 单例桶。
- Wix React Native Navigation。
- 全局可变 `Navigator`。
- 全局可变 `StyleService`。
- Ledger 领域代码直接触发导航或 UI。
- Screen/Service 随处读取 Realm Repository。

Stellar 自有 dApp 代码是明确例外，但移植后仍必须拆入 Fresnica 的 Feature、Capability、Platform 和 App 边界。

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

### Stage 0：冻结审计基线

目标：让“当前是什么”可重复验证。

工作项：

- 将本文作为执行入口。
- 保存当前 `npm run check` 与 `npm run test:realm` 基线。
- 为产品功能建立源码级 inventory，逐项标记 Adopt、Adapt、Exclude。
- 将 XRPL/Xaman residue 列表变为禁止引入清单。
- 记录现有 Native runtime smoke 的日期与覆盖范围，禁止把旧结果当当前通过。

退出条件：

- 所有后续 PR 能指向一个产品闭环和一个成熟度门。
- 不再使用“页面已存在”作为完成证据。

### Stage 1：升级 Fresnica Native SDK 基线

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

### Stage 2：架构边界收口

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

- 全部 Feature、Capability、UI、Platform 都处于严格检查范围。
- 架构检查能用失败 fixture 证明规则确实生效。
- Capability 单测无需 React Native、Realm、NativeModules 或 Stellar SDK mock。

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

### Stage 4：现有闭环修复

目标：先把已经接近完成的功能变成真正 L4。

执行顺序：

1. Onboarding 与账户
   - 新建 mnemonic。
   - 导入 secret/mnemonic。
   - watch-only。
   - pending backup 恢复。
   - 现有钱包 Add Signer；若缺上游验证 API则保持阻断。
2. Home 与资产
   - account switch。
   - inactive state。
   - balance refresh 与 focus invalidation。
   - asset details。
3. Send
   - form → review → auth → submit → result。
   - create-account 分支。
   - issued asset、memo-required、reserve/liability/capacity。
   - 提交后余额和 Activity 失效再拉。
4. Trustline
   - Add、Set Limit、Remove。
   - 零余额/零负债移除规则。
5. Activity
   - 列表、分页、筛选、搜索。
   - 注册并接通 operation detail。
   - 不宣称 gap recovery 等于完整历史。
6. Settings
   - Accounts、Security、Language、About。
   - Network 在真实可切换前继续明确标记只读。

退出条件：

- 上述每项达到 L4。
- 每条写路径都复用同一 transaction submission pipeline。
- 成功后不乐观篡改 Realm 余额。

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

目标：移植 Stellar 自有 dApp 产品栈，并按 Fresnica 边界重组。

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
- Connected dApps Settings。
- dApp transaction 进入统一 review/sign/submit，不能直接调用 Native 签名。
- 保留 Stellar 已实现的 allowlist、自定义 URL、Disclaimer 和差异化弹窗行为；该部分属于 Stellar 自有代码，允许移植，但必须按 Fresnica 分层重组并重新做安全验证。
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

### Stage 8：Stellar 扩展产品

以下均进入首版范围，按依赖和风险逐项执行：

- Asset Metadata 与 Stellar TOML。
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
- Theme 与多语言切换。
- Liquidity Pool 展示与适用操作。
- External/Hardware signer。
- Soroban G-account 授权。

每一项单独达到 L4，不组成“大功能 PR”。

Hardware Signer 首版支持声明：

- Provider：Ledger。
- Device：Ledger Nano X、Ledger Flex、Ledger Stax。
- Transport：BLE。
- Platform：iOS 与 Android。
- Stellar derivation：SEP-5，默认 `m/44'/148'/0'`。
- Supported 的最小单位是 provider + device model + transport + platform + Stellar App/firmware version 的实测组合。
- Ledger Nano S Plus 不属于首批跨平台承诺；USB-C 可在后续作为 Android-only 组合验证。
- USB/HID、NFC、Trezor 和其他 provider 不属于首批范围。

职责边界：

- Fresnica Core/Native SDK 生成精确待签名内容，绑定 expected signer，并在返回后验证 signer identity、transaction hash 和 transaction XDR。
- Mobile Hardware Signer Provider 负责 BLE 发现、连接、transport 生命周期、Ledger APDU/设备交互和设备专有错误映射。
- Mobile 不重新实现签名安全模型。

### Stage 9：发布工程

目标：从可开发产品升级为可发布钱包。

工作项：

- 同一首版支持 Mainnet 与 Testnet。
- 默认用户路径使用 Mainnet；Developer Mode 鉴权后开放 Testnet 与自定义 RPC/Horizon 管理。
- Endpoint allowlist/guard。
- 依赖与原生产物 hash 验证。
- SBOM 与 artifact provenance。
- Realm schema migration 回滚与故障 UX。
- Root/jailbreak 策略。
- Android FLAG_SECURE 与 iOS screen capture 处理。
- Crash/analytics 隐私策略。
- Accessibility、locale、性能和低内存恢复。
- E2E：
  - cold onboarding。
  - restore/import。
  - send。
  - trustline。
  - swap。
  - dApp permission + sign。
  - background lock。
- Mainnet release 前必须完成 Testnet soak；这不改变首版同时包含 Mainnet/Testnet 的产品范围。

退出条件：

- Release candidate 的所有必需 Capability 为 L4。
- 所有 CI workflow 有真实 steps 和成功证据。
- 安全审查无未接受的高严重度问题。

## 8. 推荐 PR 序列

每个 PR 保持一个可审查目标。

1. `chore(native): align Mobile with Fresnica Native SDK 0.3.0`
2. `refactor(architecture): move capability ports out of platform`
3. `chore(lint): enforce source-wide lint and architecture rules`
4. `feat(theme): complete semantic AppTheme shell`
5. `feat(security): add lifecycle session lock`
6. `feat(activity): close operation-detail navigation loop`
7. `feat(home): invalidate balances after submitted transactions`
8. `feat(accounts): finish signer-aware add-account flow`
9. `feat(request): add SEP-7 request and shared URI routing`
10. `feat(swap): add path-payment capability and product flow`
11. `feat(dapps): port catalog and browser shell`
12. `feat(dapps): add permission and Freighter request model`
13. `feat(dapps): route transaction and message signing through Fresnica`
14. `feat(claimable): add claimable balance flow`
15. `feat(developer): add Developer Mode, network tools and session logs`
16. `feat(signers): add external/hardware signer provider`
17. `chore(release): add Mainnet release gates and E2E`

若某个 PR 的上游 Capability 未冻结，该 PR 必须停在契约设计或被阻断状态，不能用 Mobile 私有实现绕过。

## 9. 单个 Feature 的完成模板

每个 Feature PR 描述必须回答：

- 产品行为参考来自 Stellar 的哪个 Screen/Flow？
- 决策是 Adopt、Adapt 还是 Exclude？
- 哪个 Fresnica Capability 是语义权威？
- 哪些第三方机制由 Platform 实现？
- Feature 持有的判别联合状态是什么？
- exact transaction identity 如何贯穿 review/sign/submit？
- 取消、失败、过期、重试、uncertain 如何表现？
- 是否新增敏感数据？保存在哪里？为什么安全？
- 哪些架构 strict scope 被新增或扩展？
- 哪些单元、集成、native、E2E 证据已执行？

最低验收命令：

```bash
npm run check
npm run test:realm
```

涉及原生、Realm schema、签名、系统认证或生命周期时，还必须执行对应 Android/iOS gate。

## 10. 已确认的首版产品约束

- 首版同时支持 Mainnet 和 Testnet。
- 默认正常模式为 Mainnet；鉴权开启 Developer Mode 后显示 Testnet 与自定义 RPC/Horizon 管理，行为参考 Stellar。
- `dapp.fchain.io` 由 Fresnica 团队控制，可作为正式 Catalog。
- 当前没有 Fresnica 自有后端；已有 Firebase 配置属于 Fresnica。
- Push Notification 属于首版。
- Fresnica 发布的 dApp 支持通过 Deep Link 自动打开/连接钱包，并向 App 产生通知。
- SDEX、Claimable、Friendbot、Address Book、Developer Mode 全部进入首版。
- LP、General、Advanced、Security、About、Terms & Conditions、主题和多语言切换进入首版。
- 自定义图片提取并生成 AppTheme 是首版门。
- Hardware Signer 首版为 Ledger Nano X/Flex/Stax + BLE + iOS/Android，按实测兼容组合声明。

“最终一致”原意是：某能力可以不进入首个可发布版本，但在重写全部完成时必须与有效 Stellar 产品行为一致。本项目现已确认上述能力全部属于首版，因此不再使用该区分。

### Push Notification 当前可交付边界

首版可先支持：

- Fresnica 产品公告/安全通知。
- 已连接 dApp 的前台事件与本地通知。
- 受控 Firebase 发送的 `open-dapp` 通知。
- 受控 Firebase 发送的 `open-activity` / `open-transaction` 路由提示。
- Deep Link 唤起后由 dApp 发起标准 Freighter permission/request 流程。

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
- 复制 Xaman vault、navigation、services 或 XRPL ledger 代码。
- 把 Xaman 云服务替换成未经确认的 Fresnica 云服务。

## 11. 当前下一步

立即执行顺序：

1. 先完成 Stage 1 Native SDK 升级。
2. 紧接 Stage 2 架构边界收口。
3. 在 Stage 3 Shell 完成前，页面可使用功能型 UI 验证流程，但必须消费稳定 Theme 与 Component seam。
4. 从 Stage 4 开始按闭环逐项恢复 Stellar 产品能力。
5. 同步设计缓存 schema、失效规则和容量，不在页面完成后补做第二套数据层。
6. 将 Push 的“当前无后端范围”和“未来 Backend 协议”分开验收。

这条顺序避免两类返工：

- 用旧 Native API 写完 dApp/锁/外部签名后再次迁移。
- 在 Capability 与 Platform 仍混合时复制大量 Feature，扩大架构债务。
