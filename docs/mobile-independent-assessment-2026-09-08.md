# Fresnica Mobile 独立源码评估

日期：2026-09-08。对象：当前 Mobile，以及本地 origin/Stellar、origin/Xaman-App、origin/fresnica。

配套交付：[后续重写执行计划](mobile-rewrite-delivery-plan-2026-09-08.md)。本文记录证据与判断，配套计划记录任务、依赖、产物和验收。

## 1. 结论

**底层尚未全部搭建完成；架构方向合理，已经有值得保留的实现，但整体仍处于功能底座与产品框架的建设期，不能定为成熟钱包。**

需要分别看三个层次：

| 问题 | 判断 | 依据 |
| --- | --- | --- |
| Fresnica 共享底层是否已经可用？ | 已有可消费的安全核心、SDK、规范与参考实现 | Rust Core、Native SDK、保护/签名向量、Account/Payment/Transaction 等契约均存在；不代表每项都已交付到 RN |
| Mobile 的钱包业务底层是否完成？ | **部分完成** | 创建/导入、余额、有限 Payment/Trustline、单软件 signer 签名可继续使用；完整账户生命周期、交易恢复、网络、dApp、硬件等未完成 |
| Mobile 整体架构是否完整成熟？ | **结构已成立，运行闭环和约束执行尚不完整** | 有组合根、分层、导航、Realm 和测试；缺会话锁、跨页面数据失效、完整主题消费、错误/日志、产品端到端验证及发布保障 |

建议继续演进现有工程。无需再搭一个空 App，也无需把业务全搬进 Rust；需要把现有底座补成可验证的用户闭环，再逐项恢复 Stellar 功能。UI 重新设计，不以当前仿 Stellar 的视觉作为最终要求。

这里不提供“已完成百分比”或“L4 成熟”评级：测试覆盖的是具体切片，缺少当前双端完整产品运行与发布证据，不能据此推算整个钱包成熟度。

## 2. 评估方法与可复核基线

### 2.1 阅读顺序与范围

先检查当前生产代码、入口、持久化、签名/提交调用链，再检查三个 origin 项目的源码和原始规范，形成判断后才交叉核对 Mobile 现有路线文档。现有文档的“完成”“卡上游”没有被当作事实依据。

本次执行了本地类型、脚本、单元、Realm 集成和补充源码 Lint 检查；静态追踪了主要业务链。没有启动旧 Stellar/Xaman 产品逐屏操作，没有重新构建 Android/iOS，没有执行 Testnet 交易、Face ID/指纹或硬件实测，也没有查询远端 CI/issue 最新状态。

因此，本文中的“Stellar 有实现”指源码存在相关行为和调用入口；原项目文档记载的人工验证是历史证据，不等于本次复测。全量功能基线最终还需执行计划 D00 的逐项行为签收。

### 2.2 快照

| 对象 | 本地 Git HEAD |
| --- | --- |
| Mobile | fef747ebed9a4a678288e90c5144877939310d2b |
| Stellar，stellar-migration 分支 | bd0f4540b2496a57314e4e29bc6fcf8ff691b60f |
| Xaman-App | 01e2538b08efa2c960233911fad02633f31ce6cd |
| origin/fresnica | f220351d7a097d22bf6475d0135f56aa09fb7e4b |
| Mobile 构建使用的 .fresnica-upstream | 47383bd94b1f88882dd0759f7275bd8b5452dcdb |

工作区在评估开始时已有修改及未跟踪文件，包括 AGENTS.md、两个状态/架构文档、原执行计划和 feature-design.md。本文不覆盖这些文件；HEAD 只标识提交基线，评估实际针对当时工作区。

### 2.3 本次验证

| 检查 | 实际结果 | 能证明什么 |
| --- | --- | --- |
| npm run check | 通过；Jest 40 suites / 210 tests | 当前配置覆盖的类型、格式、Lint、别名、架构、语言和单元测试通过 |
| npm run test:realm -- --watchman=false | 通过；1 suite / 14 tests | 真正 Realm 的注册、身份、共享 signer、关闭再打开等测试通过 |
| 对 src 直接执行 ESLint | **2 errors / 25 warnings，193 个被检查文件** | 常规 lint 命令没有覆盖源码，这一漏检可以复现 |
| 现存 native-runtime-smoke-result.json | 2026-08-28 的成功标记 | 只证明当时 Realm 与 parseAccount/invalid-input 的最小运行，不证明现版本交易/授权 |
| 双端原生、安全、产品端到端、发布 | 本次未运行 | 不判为通过，也不推定失败 |

第一次 npm run check 在 Jest 启动前因沙箱禁止访问 Watchman 中断；获得沙箱外执行许可后完整重跑通过。记录环境为本地 Node 24.4.1，CI 配置为 Node 22.13.0；本地通过不代替 CI。

源码 Lint 两个错误分别是：

- src/platform/fresnica/native/__tests__/loadNativeFresnicaModule.test.ts:33，未使用的 _missing。
- src/platform/stellar/__tests__/StellarPathPaymentSdkGateway.test.ts:1，未使用的 Asset。

警告涉及 no-void、位运算、嵌套组件等，需逐条判断；不以警告数量直接推导产品风险。

## 3. 三个项目应该如何融合

| 来源 | 应采用 | 应改写/隔离 |
| --- | --- | --- |
| Stellar | 已实现的用户任务、账户/资产/交易行为、dApp 对外协议、各流程异常和返回路径 | XRPL 遗留、旧 Vault、安全实现、后端残留、旧 UI；已有缺陷不作为兼容目标 |
| Xaman-App | 组件目录纪律、主题集中管理、存储迁移、启动/恢复与权限完整性、单元+E2E、开发调试工具 | 全局 services、Navigator/NavigationService、RNN、StyleService、Account 与密钥耦合；不整套复制 |
| Fresnica | Account ≠ Signer ≠ Recovery Source、保护信封、原生签名、强授权边界、钱包语义与一致性向量 | Rust/终端的内部目录、UI、存储结构不直接成为 Mobile 设计 |
| 当前 Mobile | 组合根、React Navigation、Realm 身份图、已验证 preflight/review/授权/提交实现、AppTheme 接口 | 过渡依赖、硬编码 Testnet、占位页面、视觉兼容层和缺少生命周期的状态 |

证据入口：

- [Fresnica 架构](../origin/fresnica/docs/architecture.md)、[Capability 索引](../origin/fresnica/docs/capabilities/README.md)：统一语义，不要求统一实现。
- [Xaman 启动](../origin/Xaman-App/src/app.tsx)、[组件结构](../origin/Xaman-App/src/components/General/Button/Button.tsx)、[测试规范](../origin/Xaman-App/docs/testing.md)、[存储迁移](../origin/Xaman-App/src/store/models/schemas/)：完整性来自运行纪律和验证，不只来自文件夹。
- [Stellar 原始进度](../origin/Stellar/docs/stellar-migration/STATUS.md)、[原始待办](../origin/Stellar/docs/stellar-migration/PENDING_WORK.md)：Stellar 本身仍有 Soroban 验证、通知后台、Swap 回归及技术身份等未闭环项。

源码来源管理需要单列任务：Stellar 自有 dApp 与继承代码混在同一目录，必须识别来源及边界后移植；不能把整个 freighter 或 XAppBrowser 目录统称为可原样复制。此处是工程溯源要求，不是对许可证适用性的法律结论。

## 4. 底层完成度：已有实现与剩余工作

| 领域 | 已有证据 | 尚缺 |
| --- | --- | --- |
| 原生接入 | FresnicaSdk 接口、RN 适配、稳定错误、方法存在性检查、原生 CI 配方 | 新 SDK 交付对齐、当前双端运行、安全流程真机证据；启动只验方法，不等于运行时核验版本 |
| 钱包身份 | Account/Signer/Reference 分离；同网络重复身份拒绝；原子创建；共享 signer 保留 | Recovery Source 持久模型、完整编辑/升级/降级/删除编排、原生授权清理重试 |
| 软件账户 | 首次创建、secret/mnemonic 导入、watch-only、备份中断恢复 | 已有钱包继续添加软件账户、HD 派生入口、普通 Reveal/Export、批量口令轮换 |
| 持久化 | Realm schema v2，领域 DTO 与 Realm 对象分离；14 个真实集成测试 | 安全状态/清理任务、pending submission、偏好/联系人/权限；数据库加密密钥生命周期尚无实现 |
| Payment/Trustline | 账本参数与余额 preflight、完整资产身份、精确 XDR review、共享签名提交 | Payment memo ID/hash、M/return 的契约扩展；Set Limit；重启后的不确定交易恢复 |
| 签名授权 | 当前账本权重检查、单软件 signer、原生 System Auth/口令签名 | 外部 provider、多 signer 协调、明确取消/失效/回退产品策略 |
| 读取与刷新 | Balance；History 分页、去重、防旧请求覆盖；Home 下拉 | 跨页面失效、前后台/网络恢复、持久 UX 缓存、操作详情及完整 Stellar operation 语义 |
| 网络 | Horizon 机制和明确 Testnet 配置 | 动态 NetworkContext、网络配置持久化、Mainnet/自定义节点、跨网请求与权限隔离 |
| 安全会话 | System Auth 启用/修复/停用 | 启动/回前台应用锁、验证专用桥接、隐私遮罩、截图/剪贴板策略 |

主要代码：[组合根](../src/app/createAppServices.ts)、[账户编排](../src/capabilities/account/provisionAccount.ts)、[Realm 仓库](../src/platform/persistence/realm/RealmAccountSignerRepository.ts)、[schema](../src/platform/persistence/realm/schemas.ts)、[Payment](../src/capabilities/payment/preparePayment.ts)、[共享提交](../src/capabilities/transaction/submitReviewedTransaction.ts)。

数据库目前未设置 Realm encryptionKey，但其中软件 signer 的 envelope 本身仍是加密信封。不能把“数据库未整体加密”描述成“私钥明文存储”；两者保护对象不同。

### 4.1 SDK 版本差异不是一个版本号修改

| 项目 | Mobile 当前固定值 | origin/fresnica 提供值 |
| --- | --- | --- |
| Native SDK | 0.2.1 | 0.3.0，release descriptor 标记 preview |
| Native Binding API | 2 | 3 |
| 通用 SDK / Core Client API | 3 / 3 | 5 / 5 |
| RN adapter source | 0.2.1 | 0.3.0 |
| RN 高层消息签名 | 无 | 有 signMessageWithPasscode / signMessageWithSystemAuth |
| RN 验证专用/应用解锁 | 未提供 | 所查 canonical adapter 仍未提供所需通用接口 |
| RN Soroban auth-entry | 未提供 | 所查 canonical adapter 仍未提供 |

依据：[Mobile 兼容表](../src/platform/fresnica/compatibility.ts)、[上游 release descriptor](../origin/fresnica/releases/native-sdk-v0.3.0.json)、[上游 RN adapter](../origin/fresnica/adapters/react-native/apple/FresnicaCoreModule.swift)、[Native binding](../origin/fresnica/bindings/native/src/lib.rs)。

0.3.0 能解决消息签名交付的一部分，不能宣称自动解决锁、全部 dApp 或 Soroban。Core 中存在 Soroban authorization 实现，也不代表 SDK→Native→RN 已经交付它。升级应独立验证旧信封兼容、双端产物和错误语义。

### 4.2 最需要先修的交易闭环缺口

当前 [submitReviewedTransaction](../src/capabilities/transaction/submitReviewedTransaction.ts) 已复用 freshness、账本授权、sign 和 submit；[StellarSdkGateway](../src/platform/stellar/StellarSdkGateway.ts) 区分 accepted/rejected/uncertain。这是正确且值得保留的基础。

但：

1. uncertain 最后停在结果页的一段“请检查交易哈希”提示；当前 schema 没有 pending submission，gateway 没有按哈希协调恢复的生产闭环。
2. 离开结果页或杀进程后没有该笔写入的持久防重复状态，用户可重新构建相同经济意图的新交易。
3. Home 的刷新依赖挂载、账户切换、下拉；Send 从 stack 返回不会保证触发它。Trustline 结果甚至提示用户返回手工刷新。

[Fresnica Transaction 契约](../origin/fresnica/docs/capabilities/transaction.md) 明确要求不确定提交防重复，优先按原交易身份协调结果。因此“共享管线已实现”成立，“交易闭环已经完整通过”不成立。

### 4.3 安全阻塞必须精确分类

- **真的缺交付接口**：已有口令的无泄露验证专用调用、现有 System Auth domain 的应用会话 challenge；所查 RN 接口没有。不能用 Reveal、虚构交易签名、重新加密当验证替身，也不能添加 JS KDF/verifier。
- **已有机制但缺 Mobile 编排**：真正修改口令使用 reprotect；[上游 system-auth 规范](../origin/fresnica/docs/platforms/mobile/system-auth.md) 已要求先准备全部新信封、原子提交、旧注册失效、逐 signer 重注册及失败恢复。不得把整个轮换项目笼统列为“等上游”。
- **已有接口但未接完整产品**：deriveMnemonicSigner、普通 Reveal/Export、prepare/apply 外部签名。
- **契约 Defined，可以实现再回馈**：dApp session、联系人、元数据、平台网络/恢复策略。在既定安全边界内做第一份实现，不必等待抽象的全球统一 API。
- **现契约明确排除或没有必要语义**：M 地址 Payment、MEMO_RETURN、Path Payment/Swap 策略；全量保持这些行为需先补上游契约/明确决策，不能私自缩成现有 G+text 能力。

## 5. 架构成熟度与具体问题

| 优先级 | 发现、影响 | 证据与处置 |
| --- | --- | --- |
| 发布前必修 | 应用锁是占位，不能代表钱包已具备会话安全 | AppNavigator 的 LockedPlaceholderScreen；先完成安全接口和状态机，不做假锁 |
| 新写功能前必修 | 不确定交易与返回后刷新不闭环 | §4.2；先扩展同一条 Transaction 管线 |
| 扩展网络前必修 | capabilities/signing 等反向依赖 app/config，gateway 与 review/sign 使用全局 Testnet | 注入固定于本次请求的 NetworkContext；切网不能改变已审阅上下文 |
| 随所属切片修复 | capability 直接使用 Stellar SDK，port/DTO 多定义于 platform；Send/Trustline feature 引用 platform 类型 | 属于过渡依赖，不等于页面已经直接读私钥；先把契约归还 capability，再替换具体机制，保留安全回归 |
| 当前守卫不充分 | strict 范围遗漏 onboarding/accounts/send/trustlines/security/settings；不约束 capability→app 等依赖 | check-architecture.mjs；按实际切片扩大，禁止靠不入 strict 掩盖改写 |
| 主题仍是部分实现 | AppTheme/ThemeSeed 已存在，但 Home 直接依赖 stellarColors，多处屏幕使用原始颜色/局部 StyleSheet | 统一消费 AppTheme；F3 不是从零发明 token，图片取色/偏好/对比度回退另有工作 |
| 质量门漏检 | npm lint / format:check 只传配置与脚本 | 把改写范围纳入；配置和 src 检查分清，避免一口气全库格式化 |
| 运行框架不完整 | 未发现 AppState 生命周期、统一脱敏日志、错误恢复和外部 intent 分发闭环 | app 管生命周期，capabilities 管语义，platform 管监听与 I/O |
| 产品验证不足 | 当前 Jest testMatch 仅 *.test.ts；没有产品屏幕/E2E 链路证据 | 建双端可复跑的用户流程，mock native 不能替代授权实测 |
| 发布配置未就绪 | Android release 使用 debug signing；iOS 当前 Info.plist 未见 NSFaceIDUsageDescription | 列发布/原生安全配置验收；本次不推断真实设备具体报错 |

已有正面基础也应保留：功能组件、显式依赖注入、typed flow 的部分实践、无全局 src/services、不可变领域记录、Account/Signer 分離、金额使用精确十进制语义、核心签名留在 native。问题是这些规则还没有覆盖所有生产路径。

## 6. Stellar 功能差距表

“Adapt”表示保留用户能力、在新 UI/Fresnica 边界下实现；不是删除。“Adopt”也不代表允许复制源码。Stellar dApp 增改仍位于 Xaman 派生树中，默认按 `docs/provenance/README.md` clean-room 重写。“待确认”不能在签收时自动转为 Exclude。

| ID | Stellar 行为与源码证据（origin/Stellar 下） | 当前 Mobile | 目标归属 / 决策 |
| --- | --- | --- | --- |
| S01 | screens/Account/Add：生成、secret/mnemonic/watch-only 导入、派生路径 | 首次流程有；已有钱包加软件账户不完整 | accounts/onboarding + Account/Signer；Adapt |
| S02 | screens/Account/List、Account/Edit：选择、标签、排序/隐藏等账户管理 | 列表与有限详情 | accounts + Wallet；Adapt，逐动作签收 |
| S03 | Account/Edit/ViewMnemonic、ViewSecretKey、ChangePassphrase | 仅备份中断 Reveal 等少数路径 | accounts/security + Signer/Backup；Adapt，遵守统一口令语义 |
| S04 | screens/Settings/Security、Overlay/Lock/Authenticate：锁、授权、修改口令、截图设置 | System Auth 有；其余缺 | security + Application Security；Adapt |
| S05 | Home、AccountService：余额、储备/可用额、前台刷新、未激活 Friendbot | 基本余额；实时/失效/激活闭环缺 | home + Balance/Network；Adapt |
| S06 | AddToken、TokenSettings、StellarTokenRegistryService、StellarAssetMetadataService：发现、详情、图标与风险 | 手填 issued asset；详情/目录未接 | assets/trustlines + Asset Discovery；Adapt |
| S07 | Send Steps、common/utils/stellarMemo：Payment/CreateAccount、memo text/ID/hash/return | G 地址、none/text | send + Payment；Adapt；return 需契约扩展 |
| S08 | common/utils/stellarQr、stellarAddress：M 地址与 muxed ID | 未支持 | request/send + Destination；Adapt；保留完整身份，先扩展契约 |
| S09 | Request、Modal/Scan、stellarQr：地址/请求 QR、扫码导入/发送/打开 URL、复制分享 | 未实现 | request/scanner + Intent/Contacts ports；Adapt |
| S10 | Exchange、StellarSwapService、helpers/stellarSwap*：strict send/receive、报价/路径/滑点/TTL | 仅 Path Payment gateway 机制 | exchange + Swap/Transaction；Adapt，先共享语义 |
| S11 | ClaimableBalanceService、ClaimableDetails：分类/风险标记/领取 | 未实现 | claimables + 对应 capability；Adapt，先定义写语义 |
| S12 | StellarLPPoolService、LPDetails：LP 列表/详情/撤出 | 余额机制识别 pool，不具产品 | liquidity + pool capability；Adapt；不凭空增 LP deposit |
| S13 | Events、Events/Details、operation presentation：筛选、列表、详情、参与方/浏览器 | payment/create-account 语义与有限列表；其余 unsupported；详情未注册 | activity + History；Adapt |
| S14 | xApps、DappCatalogService、DappIconCacheService：分类/搜索/策展/图标 | 静态空目录 | dapps + Catalog ports；自有部分 Adopt，其余 Adapt |
| S15 | DappVisitHistoryManager、XAppInfo、CustomXAppUrl、DappDisclaimer | 静态 Recent；其他未接 | dapps + 公开偏好/访问历史；Adopt/Adapt |
| S16 | Modal/XAppBrowser：浏览、URL/来源、导航、账户/网络变化与权限失效 | 无 browser runtime | dapps + platform/browser；Adopt/Adapt |
| S17 | PermissionManager、DappPermission、ConnectedDapps：连接许可、持久/会话授权、撤销 | 未实现 | dapps/security + session capability；Adopt/Adapt |
| S18 | freighter adapter：账户/网络读取、transaction 请求、签名/返回或提交 | 未实现；现 Payment review 不能解析任意 dApp 交易 | dapps + Transaction/Signing；Adapt 安全接线 |
| S19 | freighter submitBlob：消息签名与响应版本编码 | 0.2.1 无高层接口 | dapps + SEP-53 native；升级并验证原始字节语义 |
| S20 | freighter submitAuthEntry：Soroban 授权入口 | Mobile/RN 交付缺；Core 有相关实现 | dapps + 上游安全交付；不可 JS 开私钥替代 |
| S21 | XAppBrowser 命令/notification bridge、demo-dapp：分享、设备能力与数据互通 | 未实现 | dapps + 受控 platform ports；逐方法签收 |
| S22 | Settings/AddressBook、DestinationPicker、联系人身份显示 | 未实现 | contacts + Contacts capability；Adapt，Xaman 后端标签不可伪造 |
| S23 | Settings/General：语言、显示币种/格式、外观、反馈等设置 | 语言选择+3 份基础字典；多处硬编码英文 | settings + Preferences/locale/AppTheme；Adapt |
| S24 | Settings/Advanced/Network、SwitchNetwork：网络/节点 | Testnet 展示 | settings + Network；Adapt，遵守开发模式门控 |
| S25 | DeveloperSettings、SessionLog、RealmViewer：实验开关、缓存/诊断 | 未实现 | settings + Diagnostics；Adapt，诊断展示需脱敏 |
| S26 | InAppBrowser、Help、Credits、Terms、ChangeLog 等通用支持路径 | About 脚手架 | settings/support + 安全浏览/链接；Adapt |
| S27 | 原生 AppState、剪贴板、截图、摄像头/文件/分享、权限生命周期 | 仅基础 native 工程 | app/platform + 所属 feature；Adapt |
| S28 | Tangem 路径/Provider，Fresnica external-signer 规范补充 | signer 类型留位，生产签名明确 unsupported | accounts/security + external signer；硬件在目标内，具体设备/传输待确认 |
| S29 | 原项目 Vault/Realm/Preferences 升级行为 | 新 schema；没有原 Stellar 数据迁移器 | migration；是否原地升级待用户回答，不静默导入旧授权 |
| S30 | Trustline Add/Set Limit/Remove、精确资产身份、提交前账本复验 | Testnet 产品流已实现；Stage 2.5 恢复未闭合 | trustlines + Trustline/Transaction；Adapt；与 S07 共用 pending/uncertain 恢复 |

> S30 于 2026-09-09 在执行审阅中追加。稳定 ID 只追加、不重排，因此没有插入 S07 与 S08 之间。

需要单独明确的边界：

- Stellar QR 明确将 SEP-7 tx/callback/signed-origin 标为 unsupported；不是现有已完成能力，不应默认为此次全部实现。
- 原始 Stellar 含 M 地址、MEMO_RETURN 的产品行为；Fresnica 当前 Payment 明确不涵盖它们。memo ID/hash 则已有共享语义，仅 Mobile 缺实现。不能把这三者都写成“等上游”。
- Stellar 的 freighter helper 会打开旧 Vault 并生成 JS Keypair；即使自有 dApp 允许移植，这部分也必须替换为 Fresnica 原生调用。[helper 证据](../origin/Stellar/src/freighter/helpers/signatureHelper.ts)。
- Browser 外层已有 origin/account/network 权限检查，不能只看 freighter adapter 的陈旧“隐式信任”注释就判定整个旧产品没有权限门。[外层证据](../origin/Stellar/src/screens/Modal/XAppBrowser/XAppBrowserModal.tsx)。
- Stellar 的图标、报价、推送和外部服务需登记自有/第三方服务依赖；dApp 本地通知/消息互通与完整账户远程推送不是同一项。旧文档明确后者仍缺后台闭环。
- SDEX offer 语义在 Fresnica 已 Normative，但 Stellar 中存在 Offer 展示不证明有完整下单/管理产品。SDEX 写 UI、Anchor、WalletConnect、passkey/智能账户、AI 自主授权都不能仅因底层有参考实现而自动扩展本次范围；若要加入，另行确认。
- Xaman 的 XRPL 交易、Secret Numbers、Destination Tag、Xaman 后台/Payload、付费/Pro 等继承项先按历史残留登记。实际可达且用户需要的行为必须确认替代方案，不能只凭文件名批量删除。

## 7. 对现有 Mobile 文档的交叉校正

以下为本次证据导出的调整建议，没有覆盖工作区原稿：

| 原表述 | 应改成 |
| --- | --- |
| 基础阶段完成，所以后续只能按旧 Phase 顺序继续 | 底座可复用；按具体缺口与依赖施工。主题仍是产品 UI 前置，但不能阻止交易恢复/上游接口工作 |
| Transaction 能力完成 | 共用提交骨架与部分安全行为已验证；持久不确定交易恢复、防重复和刷新未完成 |
| Application Security/口令轮换全部卡上游 | 拆为验证专用接口、会话 challenge 真缺口；reprotect 批量轮换和 stale 注册保护属于可开展的 Mobile 编排 |
| dApp 是 Defined，所以不能实现 | 上游 dapp.md 明确允许首个产品实现并回馈；缺加密交付接口的请求类别单独阻塞 |
| F3 主题完全未做 | AppTheme 接口/Provider/生成 seam 已有；全应用消费、安全区/状态栏与设置入口未闭环 |
| 相应 feature 状态为 implemented，因此功能对齐 | 必须注明支持操作、真实入口和已跑验收；结构可达与产品完整是两件事 |
| SDEX 与 Swap 都卡同一个契约 | SDEX 已 Normative；Path Payment/Swap 是另一项缺口；是否新增 SDEX 产品也须单独定范围 |

## 8. 后续已确认的决定（2026-09-09）

- 作为全新 Fresnica 应用实现发布；Android 沿用 Stellar 已选的 `com.fresnica.wallet` Application ID，iOS 最终 Bundle ID 仍需在 Apple Developer / 商店配置阶段冻结。
- 不迁移旧 Stellar/Xaman 账户、设置或 dApp 授权。同 Application ID 覆盖安装仍可能保留旧数据，因此必须检测 legacy data、fail closed，并在用户确认恢复材料后执行受控 fresh-start，不得静默读取或删除。
- Stellar 自研增改也位于 Xaman 派生树，默认在保证行为的前提下 clean-room 重写；只有文件级 provenance 能证明独立权利并获批时才可直接移植。
- 所有已列功能均为完整重写计划必达范围，可以分先后和多个 release 完成。
- Backend 暂不作为主要目标；依赖可信 Backend 的 Push/远端身份能力保留接口和阻断状态。
- Ledger Nano X/Flex/Stax + BLE + iOS/Android 改为候选验证矩阵，不是未验证的支持承诺。Fresnica 上游的 macOS/HID 实测仍不能作为 Mobile 支持证明。
