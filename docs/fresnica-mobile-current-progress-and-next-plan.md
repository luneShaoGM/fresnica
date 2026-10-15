# Fresnica Mobile｜当前进度与后续任务计划

> **状态快照：2026-10-15** · **用途：跨会话恢复、任务排序、验收边界与交接**
>
> 本文是阶段性进度与下一步执行索引，不替代 GitHub 的实时事实、`AGENTS.md`、产品 Behavior Specs、`docs/fresnica-mobile-rewrite-execution-plan.md`、`docs/product-traceability-ledger.md` 或 Application Capability 契约。日期之后如 PR、远端 HEAD 或 CI 有变动，应按第 8 节重新核验并更新本文。

## 1. 结论与下一步

Fresnica 已具备账户、余额、发送、信任线、交易恢复等可用底座，多个 Stage 4 产品切片达到 **L3 / L4 partial**；但整个应用尚未达到发布成熟度。当前有两条近端任务线：

1. **UI-01 / PR #83：先完成 exact-HEAD Work 独立审查。** 若出现 P1/P2，按实际 Diff 定向修复，新 HEAD 重审；审查无 P1/P2 后由用户决定合并。CI 全绿不等于原生 UI 验收。
2. **S09 原生收口：保护已有工作并闭合缺失证据。** Photo QR 四个原生文件尚未被 Git 跟踪，必须从已有受保护工作区/快照核对后进入独立 PR；Android 分享取消、iOS 后台 deep link 等按影响范围定向复测，不重做已通过的热启动路径。

UI-01 之后再逐步迁移低风险页面；**不要一次性替换全部 UI**，不要把 UI 重构与账户、签名、交易、S09 原生改动混入同一个 PR。

## 2. GitHub 与本地事实源

| 项目 | 截止 2026-10-15 的已核实状态 |
| --- | --- |
| 仓库 | [luneShaoGM/fresnica](https://github.com/luneShaoGM/fresnica) |
| 远端 `main` | `aa01e7e0f570cfff53e514965d7ef6b33e34aa23` |
| 近期合并 | [#80](https://github.com/luneShaoGM/fresnica/pull/80) iOS 前台 Deep Link → `a9b3274fd34858c5d3bd34e3c4c6564290093d52`；[#81](https://github.com/luneShaoGM/fresnica/pull/81) S14 只读 dApp Catalog → `d79d4f1bb9fd83949cb700cc58a1ea4107835eca`；[#82](https://github.com/luneShaoGM/fresnica/pull/82) Android 分享结果修复 → 当前 `main` |
| 当前产品 PR | [#83 — UI-01 原生组件库首次接入](https://github.com/luneShaoGM/fresnica/pull/83)；OPEN、可合并候选，但未审查批准 |
| PR #83 remote HEAD | `5fe11f6671159935e6f2f2016565fe2c519cf9d0`；base 为上述 `main`；10 个文件，+236/−15 |
| PR #83 CI | GitHub CI、Realm、Native Android Gate、Native Apple Gate：**SUCCESS**；107/107 Jest 套件、619/619 测试；ESLint 0 errors、21 个既有 warnings |
| PR #83 Work Review | **尚无**有效独立 Work Review；仅有 [DEV_HANDOFF 评论](https://github.com/luneShaoGM/fresnica/pull/83#issuecomment-6185910806)。不得视为 APPROVED |
| 历史未关 PR | [#78](https://github.com/luneShaoGM/fresnica/pull/78) Automation V2.2 已暂停；[#25](https://github.com/luneShaoGM/fresnica/pull/25)、[#14](https://github.com/luneShaoGM/fresnica/pull/14) 为旧 PR，不作为当前开发基线 |
| 本地工作区 | Remote Desktop Commander 离线/不稳定，**本轮未能实时重新确认** local branch、HEAD 与 working tree；不得推断本地已同步 `main` |

**已有保全证据（不是当前工作区状态证明）：** 前次在本地 `/Users/lune/Documents/work/2012/fresnica-s09-preserved/snapshot-20261015T021112Z/` 创建并校验过 S09 快照，共 53 个文件：20 个修改的跟踪文件、29 个未跟踪项目和 4 个被 Git 忽略的原生 Photo QR 文件。含 staged/unstaged patch、文件 manifest 与 SHA-256 校验。当前设备离线，尚未再次读取验证；**不得 reset、clean、覆盖或删除未知本地变更**。

## 3. 产品与工程成熟度

| 领域 / 追踪 ID | 当前成熟度与已完成证据 | 尚未闭合 |
| --- | --- | --- |
| Stage 0 / 0A / 1 / 2 / 2.5 | 基线工程、架构、安全与共享交易提交/重启恢复底座已有证据；S07/S30 共用 exact-XDR、pending/uncertain/reconciliation 管线 | Stage 0A provenance、架构和安全规则对后续每个 PR 持续有效 |
| S01 Existing Wallet、S02 Accounts | Create / Import / HD、账户选择/排序/隐藏/删除等；**L3 / L4 partial** | 重复可执行的 aggregate gate，可靠动态字体、读屏与焦点验收 |
| S05 Home / Balance / Friendbot | 余额、未激活账户与 Testnet Friendbot、资产详情等；**L3 / L4 partial** | L4 级双平台无障碍与可重复门禁 |
| S07 Send、S30 Trustline | 多 memo、授权、签名、提交/uncertain/重启恢复；Trustline Add/Set Limit/Remove；**L3 partial / L4 partial** | 特别是 S07 iOS **真机 System Auth 取消→重试**延期 Stage 9，不得冒充完成；读屏/回归门未全部闭合 |
| S13 Activity | 分页、过滤/搜索、详情、离线缓存、Explorer、Android aggregate；**L3 partial** | iOS Activity 真正的离线→Retry→page 1 revalidation→重启产品链尚需证据；不要把直接 Helper 证据当产品流 |
| S09 Request / QR / Share / Deep Link | #80、#82 的定向代码修复已进入 `main`；多个双端主路径已有历史模拟器验收 | **Aggregate 未闭合**：Photo QR 原生源码、S09-06/S09-27/S09-42 等仍有缺口（见第 4 节） |
| S14 / S15 / S16–S19 dApps | S14 Catalog 加载/搜索/分类只读状态基线已合并，**S14 L1 partial**；S15 仅脚手架；SEP-53 为机制级 L2 | 真实 Catalog 提供方未验证；没有可信 WebView/origin、Recent、权限/撤销、Freighter 完整产品闭环 |
| Stage 3 / UI-01 | 完成上游原生组件候选包来源与校验；PR #83 将 Provider、Theme、Locale 接线和 dApps 空状态首个消费者提交审查 | PR #83 尚未 Merge；组件在 Fresnica 真正 Android/iOS 产品流、动态字体、读屏、对比度等均未验收 |
| Stage 8 / 9 | S06、S22–S25 等有部分框架；发布路线和 fail-closed 发布安全边界已定义 | S22 通讯录、资产发现、设置/诊断完整闭环、主网与签名发布凭据、设备验收尚未完成 |

成熟度以最新代码、PR、行为规格和实际验收记录为准。部分历史施工文档仍保留较早的 S09「未做」等行，**不得用过时状态行覆盖 #80–#83 的当前事实**；同时也不得因 PR 合并自动提升为 L4。

## 4. S09 原生收口：当前缺口与验收定义

| 任务 | 已知证据 / 风险 | 下一步与可通过条件 |
| --- | --- | --- |
| **S09-06 Android Share** | #82 已改变 Android 系统分享返回结果：不再把无法确认的 chooser 结果显示成「已分享」；此前模拟器出现取消后误报成功 | 在新构建中实测「分享 → Back/取消 → 不出现成功假阳性 → 再次分享」。记录构建、设备、步骤和 UI；正常关闭不是错误 |
| **S09-07 / Photo QR** | Android 相册选图解码已有部分历史证据；iOS 尚未完整。四个新原生文件分别为 Android `RequestPhotoQrModule.kt`、`RequestPhotoQrPackage.kt`，iOS `RequestPhotoQr.swift`、`RequestPhotoQr.m`，被 `/android`、`/ios` ignore 规则遗漏 | **先以保全快照与当前基线逐文件核对**，筛除临时 Gradle/打包配置；在独立 Photo QR PR 显式 `git add -f` 纳入正确原生文件；验证双端 clean checkout/build、相册选图→公开 SEP-7 URI 解码、失败/取消/重复选择与权限降级；不得称相册选图等于相机扫码 |
| **S09-25 iOS 前台热 Deep Link** | #80 修复后 **2026-10-14 已复测成功**；原生 app 在前台接收链接并显示待处理付款请求 | 功能未受后续修改影响时不重复完整验收；新集成若直接触及链接路由才复测 |
| **S09-27 iOS 后台 Deep Link** | 历史测试仍记录 FAIL；未建立 PR #80 后的可信定向复测结果 | 使用 #80 合并后的新构建：前台→后台→打开 URI→回到应用→核对请求展示/取消/重复交付。只修复实际失败面 |
| **S09-42 路由失焦异步竞态** | 无受控延迟的原生产品流证据；既有 helper/单测不能代替 | 控制资格检查/导航异步完成时序，在切换路由、账户、卸载情况下证明旧回调不污染新状态 |
| **S09-21 真相机二维码扫码** | 两端缺少可信真实相机访问条件；不能用离线解码替代 | 设备/权限条件具备时才验收真实拍摄、无权限、取消与错误恢复；之前保持 BLOCKED |

**S09 PR 边界：** 原生 Photo QR 单独成 PR；分享取消、后台 Deep Link、失焦竞态分别按证据决定是仅验收还是新代码切片。所有输入只允许公开 Request URI / 地址；不得引入签名、自动发送、私钥、跨网络或跨账户副作用。

## 5. UI 组件库：已知包身份与迁移顺序

上游仓库：[Pixman022/fresnica-ui-native](https://github.com/Pixman022/fresnica-ui-native)。组件库已具备 15 个起始原语及内部交付候选，但**不是 npm 公共发布版，也不是 Fresnica UI 全面验收完成**。

| 属性 | 冻结身份 |
| --- | --- |
| 包 | `@fresnica/ui-native@1.1.0-rc.1` |
| 上游 package-bearing commit | `7182872be5c1557bc332d270bf3a5e7cec48c409` |
| Web Token source lock | `15d49e0be28a232ae6de2a7285a3a77add8c87d4` |
| tarball SHA-256 | `54913d4c4466d3cd5744b41d878a3af54344728bda30dc3592ccef2c07fd834f` |
| 本地包形式 | `vendor/ui-native/fresnica-ui-native-1.1.0-rc.1.tgz`（仅存在于 PR #83 分支，非 `main`） |

**UI-01（当前 PR #83）：** App 保持原有 `AppThemeProvider` 与 `LocalizationProvider` 为权威，通过 `UiNativeProvider` 将语义色、语言传给第三方原语。`NativeStateView` 已试用于 S14 dApps 的只读空/不可用状态。包验证、npm lockfile、CI 均完成；未执行真机/模拟器 UI 验收。上游组件的品牌绿/白字对比度不足、reduced-motion 与真实读屏验证不足不得隐藏。

**UI 迁移按窄切片实施：**

| 顺序 | 切片 | 交付与门禁 |
| --- | --- | --- |
| UI-01 / PR #83 | 固定包 + App Provider / Theme / Locale + 第一个非交互 StateView | Work exact-HEAD Review；原生部署后核对主题/语言/布局/状态；不因 CI 自动 Merge |
| UI-02 | 选一个低风险页面完成 Button/Field/Screen 等最小复用 | 无新业务 Capability；中英繁体/长文案/键盘/焦点/Back/失败状态定向验证；只改一屏 |
| UI-03 | Home / Activity 展示层渐进接入 | 保留 Horizon 权威、账户/网络分区、离线缓存/Retry 和焦点刷新；不重跑无关原有用例 |
| UI-04 | Accounts / Settings 视觉统一 | 保留账户删除、隐藏、默认账户与 Signer 生命周期；主题和偏好持久化仍归 App |
| UI-05 | Send / Request 高风险表面 | 最后接入；必须保留安全输入原生属性、授权、exact-XDR、intent identity、uncertain/recovery；执行受影响产品流验证 |
| UI-06 / UI-07 | dApps 后续页面与双平台聚合 | Catalog/Browser 功能语义先行；完成 UI 的真机 TalkBack/VoiceOver、动态字体、焦点/对比度与异常路径 |

**主题冲突边界：** 上游 Native 组件库的当前准备范围不做「图片取色」；但 Fresnica Mobile 的 `AGENTS.md` 仍将自定义图片主题列为产品范围。UI 包只能接受 App 提供的完整 `AppTheme`，不得由 Provider 引入第二套主题状态，也不能因为上游暂不实现图片取色就擅自取消 Mobile 产品要求。

## 6. 推荐执行队列（一个 PR 一个窄范围产品切片）

| 优先级 | 任务 | 依赖 / 退出标准 |
| --- | --- | --- |
| **P0** | **PR #83 exact-HEAD Work Review** | 审查当前 `5fe11f6671159935e6f2f2016565fe2c519cf9d0`：实际 Diff、tarball/lock 来源、Provider/locale 生命周期、ESM、CI、回退方案；无未解决 P1/P2 后由用户决定 Merge |
| **P1** | **S09 Photo QR 源码收口独立 PR** | 以已保护的四个原生文件为基础；前置：能可信读取本地源码并确认当前 branch/HEAD/dirty tree，或由用户提供同一快照；不得重造/覆盖未知工作；原生构建、相册失败/取消恢复检查 |
| **P1** | **S09-06 / S09-27 定向复测** | Android 分享取消/重试、iOS 后台链接，记录设备和真实路径；失败则新建相应范围修复 PR |
| **P1** | **UI-01 原生试集成验收** | PR #83 被审查并获合并授权后，确认新 `main`，在双端新构建中查看 dApps 空/不可用状态、语言和 theme，并记录局限 |
| **P2** | **S09-42 和真实相机验收** | 前者需受控异步时序；后者需可用真实相机，条件未满足则 BLOCKED，不冒充通过 |
| **P2** | **UI-02 → UI-03 → UI-04** | 每次只迁移一处受影响表面，避免新增底层服务与无关重测 |
| **P2** | **S13 iOS Activity reconnect 缺口** | 仅补当前 Activity effect/Retry 产品路径与 Hermes/Intl 兼容性相关受影响证据 |
| **P2** | **Stage 7：S15-A 安全 URL/origin 规则 → S16 浏览器只读生命周期 → S15 Recent → S14 实际目录提供方** | 先有 fail-closed URL 规范、disclaimer/隐私、origin，再允许浏览；目录 API 必须有经验证的 HTTPS、schema、大小、超时和可信来源契约 |
| **P3** | **Stage 7：S17 权限/撤销 → S18 Freighter 读取 → S19/S18 签名和交易** | 后续签名必须通过既有 capability 授权与 exact-XDR 管线；不得自行发明授权协议 |
| **P3** | **Stage 8：S22 通讯录、S06 资产发现、S23 设置、S25 诊断日志** | 倾向先交付用户可用的独立只读/设置功能；遵守分区隔离、真实数据源与脱敏规则 |
| **后置** | **Stage 9 发布 / 真机完整验收** | 最终 App ID、生产签名凭据、Mainnet 开门、隐私/无障碍、实机 iOS System Auth 取消/重试；不得凭模拟器宣称发布就绪 |
| **暂停/阻塞** | **Automation V2.2 / #78；S10 Swap** | Automation 仅用户明确重启才继续；Swap 等待 Fresnica 规范性 Path Payment Capability，不拿 SDEX 替代 |

**可并行的仅是互不触碰的事实核对和独立验收准备；代码每次仍保持一个清晰、可独立复审的产品切片。**

## 7. 不变的安全与验收纪律

- **GitHub 是事实源。** 开始开发先确认 remote `main`、当前 PR、exact HEAD、CI/Review，以及本地 branch/HEAD/working tree；未确认干净或可安全隔离本地未知变更时，不改本地代码。
- **Chat 开发、Work 独立审查。** Work 自行取 remote HEAD + Diff + CI，不把 `DEV_HANDOFF` 当证据；P1/P2 必须修复，新 HEAD 需要重审；用户决定何时 Merge。
- **一个 PR 一个窄范围。** 不以旧 `ai:*` labels、定时 Worker、历史 handoff 作为合并门禁；#78 保持暂停。
- **严守 Capability / SDK/Core 边界。** 保留 Account/Signer 生命周期、network/account partition、exact-XDR 与 intent identity、授权/签名/提交/uncertain/recovery、fail-closed 和敏感材料隔离；不复制 Stellar/Xaman 非批准源码。
- **证据等级单独记。** Jest、CI、helper、模拟器、真实设备、Native Product-flow Acceptance 各自说明；不重复此前已通过且未受影响的验证。
- **跨平台和发布。** Stage 9 iOS 真机 System Auth cancel/retry 继续延期。没有真实 iPhone / 相机/权限时只能标记 BLOCKED / DEFERRED，不能宣称 PASS。

## 8. 每次会话恢复与更新协议

在下一次“继续 Fresnica”前，按以下顺序核对并更新本文：

1. 读取远端 `main` 当前完整 SHA，列出 OPEN PR、branch、base 与 exact HEAD；确认本次是否有新合并。
2. 查看当前 PR 的最新 **exact-HEAD 独立 Work Review**、P1/P2/P3、CI、是否需要增量 Fix/重审；不沿用旧 HEAD APPROVED。
3. 如果需要本地原生工作，先核对 local branch/HEAD/working tree 与已保全快照；不清理、覆盖未知改动；RDC 不可用时可改其他受控工具，但不能声称执行过的本地验证。
4. 列出本轮真正完成的代码、测试和设备证据，清楚区分未测、失败与阻塞。
5. 只推进队列中第一个具备全部前置条件的窄切片；完成后 PR → CI → exact-HEAD Review → 修复 P1/P2 → 用户决定 Merge。
6. Merge 后以**新的 `main` exact SHA**更新 `2`，并调整任务状态；避免因文档过期而重做已完成事项。

## 9. 可追溯入口

- GitHub：[main](https://github.com/luneShaoGM/fresnica/tree/main)、[#80](https://github.com/luneShaoGM/fresnica/pull/80)、[#81](https://github.com/luneShaoGM/fresnica/pull/81)、[#82](https://github.com/luneShaoGM/fresnica/pull/82)、[#83](https://github.com/luneShaoGM/fresnica/pull/83)。
- 代码交接：[#83 DEV_HANDOFF](https://github.com/luneShaoGM/fresnica/pull/83#issuecomment-6185910806)；其 Work 独立 Review 截至本快照**尚不存在**。
- 工程/产品：`AGENTS.md`、`docs/stellar-product-information-architecture.md`、`docs/fresnica-mobile-rewrite-execution-plan.md`、`docs/product-traceability-ledger.md`、`docs/mobile-capability-status.md`、`docs/behavior-specs/`。
- UI：上游 [Native 库](https://github.com/Pixman022/fresnica-ui-native) 的 `docs/consumer-handoff.md` 与 `docs/delivery-candidate-2026-10-12.md`；本仓库 PR #83 的 `docs/ui-native-consumer-integration.md`。
- S09 实机资料：此前保全目录和本地 `docs/test/Fresnica_S09_Test_Checklist_40be444b.md`。这些本地文件**不是 GitHub 已合并文件**，需恢复访问后再核对。

---

**维护提示：** 本文只陈述 2026-10-15 可追溯的状态、明确的后续计划与证据边界。最新 Github/源码/独立审查如有变化，以实时事实为准；不要将本文件当成安全、能力或发布认证。
