# Fresnica Mobile 重写指南

> 地位：产品结构、命名、底层顺序和完成标准的重写权威。
>
> 产品思路参考：`origin/Stellar@stellar-migration`（`bd0f4540`）。
>
> 工程思路参考：`origin/Xaman-App`（组件打包、theme token、lint / 路径别名）。
>
> 钱包 / 安全权威：`origin/fresnica` 的 Application Capability / Core 契约，加上当前 Mobile 实现和 `docs/mobile-capability-status.md`。
>
> 代码风格与分层规则：`docs/mobile-architecture-style-guide.md`。
>
> 本文覆盖 §13 所列历史文档里关于 Tab、产品壳、命名和施工顺序的说法。冲突时以本文为准。

## 怎么用这份指南

改任何产品表面之前先读这一页。

1. 读 §1–§4（权威、分层、命名、目标 vs 现状）。Git 是现状，本文是目标。
2. 在 §7 找到该表面。若是 Exclude（排除），停止。
3. 在 `docs/mobile-capability-status.md` 确认 Capability 所有者。共享契约没有的语义，不要在 Mobile 里发明。
4. 若是底层工作，按 §6 的顺序做。不要在还不存在的导航栈上假设去重写功能。
5. 编码时跟 §11。一个表面只有 §8 和对应的 §9 都成立，才算重写完成。

除 Stellar 自研 dApp 外，不要从 Xaman / Stellar 源码开工。打开它们只为回忆流程或角色，然后在 Fresnica 分层里实现。dApp 以 Stellar 自研实现为照搬来源，见 §1.1。

当前仓库里的 Onboarding / Send / Home 等只是薄脚手架，**不是**重写完成标准。产品完整度以 Stellar 产品表和本文为准。

F0 已定：React Navigation。F2 主壳已接上。不要接入 Wix RNN。不要在还不存在的导航栈上假设去重写功能——栈已经在 `app/navigation`。

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
| `origin/Stellar` 分支 `stellar-migration` | 产品壳、屏幕层级、交互角色；**自研 dApp 是照搬来源**；Vault / 加密可参考 |
| `origin/Xaman-App` | 打包方式、token、lint / 别名；Developer Mode 产品角色 |
| `origin/fresnica` | Application Capability / Core / SDK 契约 |

### 1.1 源码策略

| 来源 | 做法 |
| --- | --- |
| Stellar 自研 dApp（目录、浏览器、Freighter 桥、权限、数据互通、disclaimer） | **照搬**到 Fresnica 分层（`features/dapps` + 桥接 platform）。不要缩成空 Tab。不要走 Xaman xApps。仍不要引入全局 `services/` |
| Stellar Vault / 加密（`Overlay/Vault`、`common/libs/vault.ts`、native keychain） | **参考**交互与分层；密钥与信封权威仍是 Fresnica Core / Native SDK |
| 其余 Stellar / Xaman 屏幕、helper、boot | 只借鉴角色，在 Fresnica 分层重写 |
| `Navigator`、`NavigationService`、RNN boot、`StyleService`、PIN / Secret Number、XRPL 控件 | 禁止照抄 |
| Account 与 Signer 耦合、Xaman 私有 Vault 当安全权威 | 禁止。Fresnica 保持 Account ≠ Signer |

Stellar 里有某个屏幕，默认不等于可以粘贴它的实现。dApp 是明确例外。

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

不要加 `src/services`。功能编排留在 feature。语义规则留在 Capabilities。机制留在 platform。

`capabilities/history` 仍叫 History capability。**Activity** 是产品 Tab 名。不要为了跟 Tab 对齐去改 capability 名。

---

## 3. 目标 vs 现状

本文描述的是**目标**。Git 只是未完成脚手架，**不要拿当前代码当重写完成标准**。现有 Onboarding / Send / Home / Activity 能跑，不等于产品已覆盖。新代码用目标名。不要加 Events / XApps 兼容别名。

| 事项 | 目标 | 当前脚手架（不是完成态） |
| --- | --- | --- |
| 产品壳 | Home / Activity / Actions / dApps / Settings | 五项壳外形；Actions 已是 OverlayHost |
| Tab id | `home`、`activity`、`dapps`、`settings` | 已是这些 id |
| Activity | 完整列表 / 筛选 / 详情 | `features/activity` + History capability；详情路由未挂 |
| dApps | 照搬 Stellar 自研：目录、Recent、浏览器、权限、Freighter 桥 | `features/dapps` 预览壳，未接目录 |
| Developer Mode | 采用 Stellar/Xaman 设计（鉴权开启、网络可见性、日志、开发者页） | **未做** |
| 硬件钱包 | 产品内一等 signer（添加、签名、账户列表） | 类型里有 `hardware`，产品流 **未做** |
| Vault / 加密 | 参考 Stellar Vault overlay 与 native 加密；Core 管密钥 | 无 Vault overlay；Realm 不存密钥 |
| 自定义主题 | 上传图片 → 提取主色 / 次主色等 → `AppTheme` 全 app 应用 | 单一 `defaultTheme`；UI kit **尚未约定** |
| 导航 | React Navigation：根 stack + tabs + 每 tab 的 native-stack + OverlayHost | **F2 主壳已接上。** 根流程仍按 bootstrap 条件注册 `bootstrap` / `onboarding` / `main`；`locked` 已注册但未进入；modal / 其余 overlay 角色尚未占用 |
| i18n | 已改写表面没有硬编码文案 | 语言运行时已有；多数屏幕仍是英文直写 |

安全不变量仍要遵守（Account ≠ Signer、密钥不进 JS 持久化、会改账本的路径绑精确 XDR）。它们约束怎么实现，不证明当前屏幕已经写完。`docs/mobile-capability-status.md` 只记录脚手架做过什么，不当产品验收。

---

## 4. 产品壳

```text
Home | Activity | Actions | dApps | Settings
```

- `Home`、`Activity`、`dApps`、`Settings` 是真正的目的地。
- `Actions` 是中间触发器。它打开操作 overlay，不得变成被选中的 Tab。
- 根流程：`bootstrap` → `onboarding/setup` →（`locked`）→ `main`。
- 即使上游 System Auth challenge 仍缺失，`locked` 也留在树里。不要伪造解锁。

计划改名后的 feature 归属：

| Tab / 操作 | 目标 feature | 当前目录 |
| --- | --- | --- |
| Home | `features/home` | `features/home` |
| Activity | `features/activity` | `features/activity` |
| dApps | `features/dapps` | `features/dapps` |
| Settings | `features/settings` | `features/settings` |
| Send / Request / Exchange | `features/send`、`features/request`、`features/exchange` | Send 已有；Request / Exchange 没有 |

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

根流程（`bootstrap` / `onboarding` / `locked` / `main`）当前按鉴权状态**条件注册**其中一个主屏幕，同时始终注册 `locked` 占位。这不是产品 destination `switch`。不必在 F3 之前改成四屏始终挂齐；有真实 lock / onboarding 子栈时再改。

F2 已用稳定 React Navigation 7.x，并匹配 `react-native-screens`、`react-native-safe-area-context`。`react-native-gesture-handler` 尚未装；需要手势栈或 modal 手势时再补。不要在本指南里钉 pre-release。

导航参数只能带公开 ID。精确 XDR、助记词、口令和解密后的 signer 材料留在所属流程 / controller。

---

## 6. 底层顺序

按顺序做。后一阶段不得假设前一阶段已完成。不要把 F1–F3 和新的产品 Capability 混在同一批改动里。

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

F2 尾巴，不挡 F3，随对应表面补：

- 根流程仍按 bootstrap **条件注册** `bootstrap` / `onboarding` / `main`（见 §5 说明）。不必为了 F3 先改成始终挂齐四屏。
- `locked` 已在根栈注册，没有进入路径，也不要伪造解锁。
- `presentation: 'modal'` 以及锁 / 鉴权 / Alert / 切账户 overlay，等那些表面存在再占用角色。
- Activity `operation-details` 类型已留，栈上未挂，等详情屏。

### F3 — UI kit 契约（尚未约定）

组件清单和最终视觉**还没定**。F3 先锁语义契约，不要把当前 `defaultTheme` 或现有扁平组件当成 kit。

必须先成立：

- 语义 `AppTheme`：主色、次主色、背景、表面、文字、边框、状态色。屏幕只消费这些 token，不写裸颜色。
- 自定义主题是产品功能，不是以后再说：用户上传一张图片 → 程序提取主色、次主色等 → 生成一份 `AppTheme` → 全 app 应用并持久化。
- General 原语清单待约定后再补（Screen、Header、Button 等）。钱包专用控件留在 feature，直到出现第二个调用点。
- 向 Xaman 学打包（General 目录、token、lint），不抄色板、品牌、`StyleService`。

退出条件：

- [ ] `AppTheme` 语义字段已写出，并且能被「默认主题」和「从图片生成的主题」替换，而不改 feature 屏幕
- [ ] 约定中的壳组件消费 token；这些文件没有裸颜色
- [ ] 自定义主题的入口位置已记在 Settings（实现可在 F4 之后，契约必须在 F3 留下）

### F4 — 按产品表重建流程

按此顺序**重建**（不是把当前脚手架搬到栈上就算完）：

1. Onboarding / 待备份 / 硬件钱包添加入口
2. Home
3. Send（精确 XDR；硬件 / 软件 signer 都要能走审阅-签名）
4. Activity
5. Settings，含 **Developer Mode**、语言、网络、Security、自定义主题入口
6. Trustline / 管理资产
7. dApps：**照搬** Stellar 自研实现，不是空壳
8. Vault overlay（参考 Stellar，接 Fresnica 签名 / 揭示）

每个表面必须满足 §8 和对应的 §9，对照的是 Stellar 产品行为，不是当前 Mobile 占位。

退出条件：这些流程能通过 F2 导航到达；`npm run check` 通过；安全不变量没有被削弱。

实现可能卡在上游、但**设计必须包含**的：Path Payment / Swap 执行、应用锁、已有钱包添加受保护软件 signer、Realm 加密密钥生命周期、多签、**硬件签名器**、Mainnet（由 Developer Mode 门控可见性，不要在未开门时假装已是 Mainnet）。

---

## 7. 产品表

Adopt（采用）= 在 Fresnica 重写用户可见表面。Adapt（适配）= 保留角色，改安全 / 协议语义。Exclude（排除）= donor 残留。Exclude 的表面不要实现，除非当前产品 / Capability 需求明确把它提升上来。

### 7.1 Onboarding 与设置

| Stellar 表面 | 决定 | Fresnica 归属 | Capability |
| --- | --- | --- | --- |
| Onboarding | Adopt | `features/onboarding` | Account、Signer、Application Security |
| Setup / Passcode | Adapt 为应用口令 | `features/onboarding`、`features/security` | Application Security、Signing Coordination |
| Setup / Biometry | 有 System Auth 契约则 Adopt | `features/security` | Application Security |
| Setup / Push notification | 当前底层 Exclude | — | — |
| Setup / Finish | Adopt | `features/onboarding` | Account |

### 7.2 Tab 与主操作

| Stellar 表面 | 决定 | Fresnica 归属 | Capability |
| --- | --- | --- | --- |
| Home | Adopt | `features/home` | Account、Balance |
| Events id / Activity 名 | Adopt 为 Activity | `features/activity` | History |
| XApps id / dApps 名 | **照搬** Stellar 自研 dApp（目录、Recent、浏览器、权限、Freighter 桥、数据互通） | `features/dapps`（当前仍是预览壳） | 待建 dApp 授权 / 桥接；实现来源是 Stellar，不是空 capability 再发明 |
| Settings | Adopt | `features/settings` | — |
| Overlay / HomeActions | Adopt | app 壳 + feature 操作 | — |
| Send | Adopt | `features/send` | Payment、Transaction、Signing Coordination |
| Request | Adopt | `features/request` | Account（分享公开身份） |
| Exchange | Adopt UI 结构；执行卡在 Path Payment 契约 | `features/exchange` | Path Payment（缺失） |

### 7.3 账户

| Stellar 表面 | 决定 | Fresnica 归属 | Capability |
| --- | --- | --- | --- |
| Account Add / Import / Generate / List / Edit | Adopt | `features/accounts` | Account、Signer |
| 添加硬件钱包 | Adopt；设计阶段就纳入，不是 residual | `features/accounts`、Signing | Signer（`hardware`） |
| 查看助记词 / 密钥 | Adopt；可参考 Stellar Vault 揭示交互 | `features/security` | Signer、Application Security |
| 修改口令 | Core 验证 API 就绪后 Adopt | `features/security` | Application Security |
| Tangem（Xaman 卡） | Exclude，除非 Core 明确支持 | — | 不是通用硬件钱包需求 |
| Cipher 迁移 | Exclude | — | donor 残留 |

### 7.4 共享 modal / overlay 词汇

底层必须提供这些角色，即使部分调用方暂时为空：

| 角色 | Stellar 来源 | 决定 |
| --- | --- | --- |
| 审阅交易 | `Modal/ReviewTransaction` | Adopt；绑定精确 XDR |
| 提交 / 进度 / 结果 | `Modal/Submit`、`TransactionLoader` | Adopt |
| 扫码 | `Modal/Scan` | Adopt |
| 币种 / 收款方 / 账户 / 手续费选择器 | Modal + Overlay pickers | Adopt 角色；手续费策略仅在 Capability 支持时 |
| 全局选择器 | `Global/Picker` | Adopt 为共享选择器壳 |
| Alert / 确认 | `Overlay/Alert` | Adopt |
| 鉴权 / 口令 | Auth overlays | Adapt 到 Signing Coordination；可参考 Vault 方法 |
| 锁 | `Overlay/Lock` | Adopt 角色；实现可能卡上游 API，设计要留位 |
| Vault / 解密签名 | `Overlay/Vault`、`common/libs/vault.ts` | **参考**并纳入；接 Fresnica 签名 / 揭示，不要当第二套加密权威 |
| 切换账户 / 网络 | overlays | Adopt |
| 分享账户 | overlay | Adopt |
| 添加代币 / 代币设置 | overlays | Adopt through Trustline |
| 连接问题 | overlay | Adopt |
| 应用内 / dApp 浏览器 | Stellar `Modal/XAppBrowser` 等自研 | **照搬** |
| Destination tag / PurchaseProduct / NetworkRailsSync | overlays | Exclude |

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

Stellar 保留了 Xaman 的 Developer Mode，Fresnica **要做**。当前代码没有。

参考 `origin/Stellar`：`Settings/Advanced/AdvancedSettingsView`、`CoreRepository.isDeveloperModeEnabled`、`NetworkRepository.getVisibleNetworks`。

产品角色：

- Advanced 里开关；**开启需鉴权**，并警告。
- 开启后：显示测试网等非 Main 网络、Session logs、Developer settings、Android 可关截屏保护。
- 关闭时：若当前不在 Main 网络，先切回默认网络再关。
- Send / Token settings 等处的 Dev Mode 分支一并搬产品行为，语义仍走 Fresnica 网络 / 网关。

不要把「现在只连 Testnet」当成已经覆盖了 Dev Mode。Testnet 脚手架 ≠ Developer Mode。

### 7.7 硬件钱包

重写必须按一等能力设计，不要等「以后再加口」。

- 账户添加：软件 signer 之外有硬件入口（Ledger / Trezor 等 Core 支持的类型；Stellar `hardwareWallet.ts` 为产品参考）。
- 列表与详情能区分硬件账户。
- 审阅 → 授权 → 签名：硬件路径走 Signing Coordination，不要另写一套 XDR。
- Core / SDK 未接通时，UI 可禁用并说明原因，但信息架构和路由要留好。
- Tangem 是 Xaman 卡路径，默认 Exclude，与「支持硬件钱包」不是同一件事。

---

## 8. 重写完成标准

一个表面只有下列适用项全部成立，才算重写完成。对照 Stellar 产品行为，**不要对照当前 Mobile 占位是否“已经能点”。**

- 用户可见结构符合 §4 / §7（Activity / dApps 命名，Actions 为 overlay）。
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
- 已有钱包上添加受保护**软件** signer 保持关闭，直到 Core 提供只验证当前口令的能力。
- 待备份助记词是栈上的一等目的地，不能只靠 bootstrap 特例。
- 文案和错误已本地化。

### Home

- 信息顺序仍是：当前账户、切换器、主操作、资产列表。
- 加载 / 未激活 / 已激活 / 错误保持区分。LP 份额不当成普通代币。合约账户不继承 Classic 余额语义。
- Send / 管理资产 / 添加账户是 stack push，不是 destination switch。
- 余额读取仍走 Balance capability。

### Send

- 表单 → 当前账本准备 → 精确 XDR 审阅 → 授权 → 提交 → 结果。
- Payment / CreateAccount 选择、memo、手续费、trustline、只读 / 多签 / **硬件**失败仍在 Payment + Transaction + Signing Coordination。不要为了改样式换成另一套协议。
- 审阅和提交是 §5 的 modal / stack 角色。Vault 签名交互可参考 Stellar，密钥仍走 Core。
- 现有 Payment 测试不能改弱；它们也不等于 Send 产品已经写完。

### Activity

- 运行时 id 和目录是 `activity` / `features/activity`。用户文案是 Activity。Capability 仍是 `capabilities/history`。
- 列表、下拉刷新、加载更多、空态、错误、操作详情都在。
- 日期 / 金额 / 文案走 i18n 和格式化 helper，不要内联英文。
- 除非 History capability 拥有，否则不要做 donor 式的持久化缺口恢复缓存。

### Settings / Security / Language / Network / About / Developer Mode / 主题

- 分组符合 §7.5。**Developer Mode 是必要项**，不是推迟项。当前仓库没有，按 §7.6 补。
- 自定义主题入口在 General；实现依赖 F3 的 `AppTheme` 可替换契约。
- 不要在未开 Dev Mode 时提供假 Mainnet 开关。
- 语言通过 locale preference store 持久化。
- Security / Vault 不把密钥写入普通持久化。应用锁在上游 API 出现前保留占位角色。

### Trustline / 管理资产

- 添加 / 移除仍走 Trustline 精确 XDR 路径。资产代码大小写原样保留。
- Set Limit 若 Stellar 产品有、Fresnica 流程尚未拥有，先标缺口，不要用当前「没做」当最终决定。

### dApps

- Tab id 和目录是 `dapps` / `features/dapps`。用户文案是 dApps。
- **照搬** Stellar 自研：FChain 目录、Home / Recent、分类、自定义 URL、disclaimer、浏览器、Freighter 注入、权限与数据互通。参考 `origin/Stellar` 的 `screens/xApps`、`Modal/XAppBrowser`、`freighter/`。
- 迁入 Fresnica 分层，不要整棵 `services/` 搬进来。
- 当前 `features/dapps` 预览壳**不算**完成。

### 硬件钱包

- 见 §7.7。账户、签名、列表三条路径都要在设计里。当前「Not yet implemented」不是 Exclude。

### Request / Exchange

- Request 若只分享公开账户身份，可在 Home / Send 之后做。
- Exchange 盘点 UI 结构。Path Payment 执行仍可能卡契约，但不要从产品表删掉。

---

## 10. UI kit 与自定义主题

UI kit **尚未约定**组件清单和视觉。不要提前把当前扁平组件或 `defaultTheme` 当成 kit。

F3 只锁这些：

- 语义 token，屏幕不写裸颜色。
- 活跃主题可替换：默认一套，用户上传图片后提取主色、次主色等生成另一套，应用到整个 app。
- 提取与持久化放在 Settings / 主题 feature，经 `app/` 注入 `AppTheme`。不要每个屏幕自己读图片。

向 Xaman 学打包，不抄色板、`StyleService`、PIN / Secret Number、XRPL 控件。

---

## 11. 怎么重写一个表面

F2 存在之后，每个产品 PR 都按此做。F1–F3 只跟 §6。导航库是 React Navigation（§5–§6 F0）。

1. 在 PR 说明里写出 §7 行、feature 归属、Capability。若是 Exclude，停止。
2. 读 `docs/mobile-capability-status.md` 只当作「脚手架现状」，不当验收。Capability 被挡住时 UI 保持诚实（禁用 / 占位），但不要从产品表删掉（硬件钱包、Dev Mode、dApp 都是例子）。
3. 看 `origin/Stellar`：屏幕顺序、空态 / 加载 / 错误、overlay / modal。**dApp 把 Stellar 自研实现当照搬来源，迁入时可以对照那些文件。** 其余表面关掉 donor 文件后再写 Fresnica 代码。Vault / 加密可对照 Stellar 再接到 Core。
4. 实现进 `features/*` + `ui/*`。适配器在 `app/`。可复用钱包策略进 `capabilities/`。
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

---

## 12. PR 规则

- 一个分支一个产品目标。
- 编码前写出 §7 行、feature 归属、Capability。
- 实质性重写遗留 feature 目录时，同一 PR 扩展 `scripts/check-architecture.mjs`。
- 不要把底层（F1–F3）和新的产品 Capability 混在一起。
- 不要为了让屏幕看起来完整而削弱精确 XDR 或密钥处理。
- 不要拿当前仓库占位当产品已覆盖。
- 不要加 `src/services`。
- 不要加 Wix RNN 或全局 `NavigationService`。
- 不要大规模格式化无关文件。
- 不要把 `steps:null` 或其他执行前 CI 失败当成通过。

---

## 13. 文档地图

| 文档 | 角色 |
| --- | --- |
| 本文件 | 产品壳、命名、底层顺序、Adopt / Adapt / Exclude、完成标准 |
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
