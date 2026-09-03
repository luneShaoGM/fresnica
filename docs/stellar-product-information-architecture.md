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

不要从 Xaman / Stellar 源码开工。打开它们只为回忆流程或角色，然后在 Fresnica 分层里实现。

F0 已定：React Navigation。F1 完成前不要开始 F2。不要接入 Wix RNN。

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
| `origin/Stellar` 分支 `stellar-migration` | 产品壳、屏幕层级、交互角色 |
| `origin/Xaman-App` | 打包方式、token、lint / 别名 |
| `origin/fresnica` | Application Capability / Core / SDK 契约 |

| 可借鉴 | 禁止照抄 |
| --- | --- |
| 信息架构 | 屏幕、helper、启动代码 |
| 导航*角色*（tab / stack / modal / overlay） | `Navigator`、`NavigationService`、RNN 启动辅助 |
| 交互节奏（空态 / 加载 / 错误 / 审阅 / 提交） | `services/`、`store/`、单例 `StyleService` |
| UI kit *打包方式*（General 目录、token、lint） | 配色、品牌、PIN / Secret Number、XRPL 控件 |
| | Vault / 加密、Account 与 Signer 耦合、XRPL 账本类型 |

Stellar 里有某个屏幕，并不等于可以粘贴它的实现。

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

本文描述的是**目标**。Git 是**当前实现**。新代码用目标名。不要加 Events / XApps 兼容别名。

| 事项 | 目标 | 当前 Mobile 代码 |
| --- | --- | --- |
| 产品壳 | Home / Activity / Actions / dApps / Settings | 已是五项壳；Actions 已是中间触发 |
| Tab id | `home`、`activity`、`dapps`、`settings` | `src/app/navigation/productNavigationState.ts` 里仍是 `home`、`events`、`xapps`、`settings` |
| Activity 功能 | `features/activity` | `features/history` |
| dApps 功能 | `features/dapps` | `features/xapps` |
| 导航 | React Navigation：native stack + tabs + modal + `app/` OverlayHost | `ProductRuntime` 的 destination `switch` + 一个 RN `Modal` |
| i18n | 已改写表面没有硬编码文案 | 语言运行时已有；多数屏幕仍是英文直写 |
| UI kit | 语义 token + General 打包 | 薄的 `AppTheme` + 混杂的扁平组件 |
| Lint / 别名 | ESLint、Prettier、路径别名、严格架构范围 | 仅增量 `architecture:check`；Send / Trustline / Onboarding 并未全部纳入严格范围 |

改壳时不得削弱的内核：Account ≠ Signer、Native SDK 0.2.1、Realm 不存密钥、Payment / Trustline 精确 XDR。证据见 `docs/mobile-capability-status.md`。

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
| Activity | `features/activity` | `features/history` |
| dApps | `features/dapps` | `features/xapps` |
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

F2 时：React Navigation 8 若已稳定就用 8；否则用稳定 7.x，并匹配 `react-native-screens`、`react-native-safe-area-context`、`react-native-gesture-handler`。不要在本指南里钉 pre-release。

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

依赖 F0（React Navigation）和 F1。

- 按 §5 用 React Navigation 替换 `ProductRuntime` 的 destination `switch`。
- OverlayHost 放在 `app/`。Actions 是 overlay，不是 Tab。
- 运行时 id 和 feature 目录改成 Activity / dApps。不要 Events / XApps 别名。不要同时留下 `features/history` 和 `features/activity`。
- `capabilities/history` 仍叫 History。
- 导航参数仍只带公开 ID。

退出条件：

- [ ] Onboarding、locked（占位）、主壳是 stack / tabs / overlay，不是 destination `switch`
- [ ] Tab id 为 `home | activity | dapps | settings`
- [ ] Actions 是 overlay，不是被选中的 Tab

### F3 — UI kit 骨架

- 只用语义 `AppTheme`。占位 token 即可。
- 壳需要的 General 原语：Screen、Header、Button、Input、金额展示、ListRow、Sheet / ActionPanel、Loading、TouchableDebounce。
- 样式放在同目录 `styles.ts`。主题外不要写裸颜色。
- 钱包专用控件留在 feature，直到出现第二个调用点。

退出条件：

- [ ] 产品壳和下一张迁入的屏幕消费 kit 的 token / 组件
- [ ] 这些文件里没有新的裸颜色字面量

### F4 — 把现有流程放到栈上

按此顺序迁移，不增加新的产品语义：

1. Onboarding / 待备份
2. Home
3. Send（精确 XDR 路径不变）
4. Activity（History capability 不变）
5. Settings / Security / Language / Network / About
6. Trustline / 管理资产
7. dApps 壳（在有 dApp capability 之前只做结构）

每个迁入的表面必须满足 §8 和对应的 §9。

退出条件：这些流程能通过 F2 导航到达；`npm run check` 通过；Payment / Trustline / History 的 Capability 测试没有被削弱。

卡在上游、不卡这条顺序的：Path Payment / Swap 执行、应用锁、已有钱包上添加受保护 signer、Realm 加密密钥生命周期、多签、硬件签名器、Mainnet。

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
| Events id / Activity 名 | Adopt 为 Activity | `features/activity`（当前 `features/history`） | History |
| XApps id / dApps 名 | Adopt 为 dApps；浏览器 / 权限稍后 | `features/dapps`（当前 `features/xapps`） | 尚无 |
| Settings | Adopt | `features/settings` | — |
| Overlay / HomeActions | Adopt | app 壳 + feature 操作 | — |
| Send | Adopt | `features/send` | Payment、Transaction、Signing Coordination |
| Request | Adopt | `features/request` | Account（分享公开身份） |
| Exchange | Adopt UI 结构；执行卡在 Path Payment 契约 | `features/exchange` | Path Payment（缺失） |

### 7.3 账户

| Stellar 表面 | 决定 | Fresnica 归属 | Capability |
| --- | --- | --- | --- |
| Account Add / Import / Generate / List / Edit | Adopt | `features/accounts` | Account、Signer |
| 查看助记词 / 密钥 | 经 Fresnica reveal Adopt | `features/security` | Signer、Application Security |
| 修改口令 | Core 验证 API 就绪后 Adopt | `features/security` | Application Security |
| Tangem 安全 | Exclude | — | donor 残留 |
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
| 鉴权 / 口令 | Auth overlays | Adapt 到 Signing Coordination |
| 锁 | `Overlay/Lock` | Adopt 角色；实现卡在上游 API |
| 切换账户 / 网络 | overlays | Adopt |
| 分享账户 | overlay | Adopt |
| 添加代币 / 代币设置 | overlays | 经 Trustline Adopt |
| 连接问题 | overlay | Adopt |
| 应用内 / dApp 浏览器 | modals | 稍后，需有明确权限契约 |
| Destination tag / Vault / PurchaseProduct / NetworkRailsSync | overlays | Exclude |

### 7.5 Settings

```text
Settings
  General
  Security
    Connected dApps          （稍后）
    修改口令                 （Core 允许时）
  Advanced
    网络列表 / 添加          （现在只展示 Testnet；不要假 Mainnet）
    Developer / logs         （推迟）
  地址簿                     （稍后）
  Terms / Credits / About
```

除非明确要求开发专用工具，否则 Exclude Realm Viewer。

---

## 8. 重写完成标准

一个表面只有下列适用项全部成立，才算重写完成：

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
- 已有钱包上添加受保护 signer 保持关闭，直到 Core 提供只验证、不改写的当前口令能力。
- 待备份助记词是栈上的一等目的地，不能只靠 `ProductRuntime` 特例。
- 文案和错误已本地化。

### Home

- 信息顺序仍是：当前账户、切换器、主操作、资产列表。
- 加载 / 未激活 / 已激活 / 错误保持区分。LP 份额不当成普通代币。合约账户不继承 Classic 余额语义。
- Send / 管理资产 / 添加账户是 stack push，不是 destination switch。
- 余额读取仍走 Balance capability。

### Send

- 表单 → 当前账本准备 → 精确 XDR 审阅 → 授权 → 提交 → 结果。
- Payment / CreateAccount 选择、memo、手续费、trustline、只读 / 多签失败仍在 `capabilities/payment` + Transaction。不要为了改样式换成另一套协议。
- 审阅和提交是 §5 的 modal / stack 角色，不是再开一套复制 XDR 的 `ProductRuntime` 路由。
- Payment 测试保持绿色，不要改成更弱的断言。

### Activity

- 运行时 id 和目录是 `activity` / `features/activity`。用户文案是 Activity。Capability 仍是 `capabilities/history`。
- 列表、下拉刷新、加载更多、空态、错误、操作详情都在。
- 日期 / 金额 / 文案走 i18n 和格式化 helper，不要内联英文。
- 除非 History capability 拥有，否则不要做 donor 式的持久化缺口恢复缓存。

### Settings / Security / Language / Network / About

- 分组符合 §7.5。不要假 Mainnet 开关。
- 语言通过现有 locale preference store 持久化。
- Security 屏幕不持久化密钥。应用锁在上游 API 出现前只保留占位角色。
- About / terms / credits 只做文案。

### Trustline / 管理资产

- 添加 / 移除仍走 Trustline 精确 XDR 路径。资产代码大小写原样保留。
- 产品流程尚未拥有 Set Limit 时，不要发明该 UI。
- Trustline 测试保持绿色。

### dApps 壳

- Tab id 和目录是 `dapps` / `features/dapps`。用户文案是 dApps。
- 在有明确的 dApp 授权 capability 之前，不实现目录 / 浏览器 / 权限。
- F4 有结构 Tab（空态 / 即将推出，文案走 i18n）即可。

### Request / Exchange

- Request 若只分享公开账户身份，可在 F4 的 Home / Send 之后再做。
- Exchange 可以盘点 UI 结构。Path Payment 执行被挡住（见 `docs/mobile-capability-status.md`）。

---

## 10. 先做 UI kit，视觉后做

现在做结构和行为。最终视觉设计稍后。

向 Xaman 学：General 打包、token、lint、别名。

不要抄：色板、品牌、`StyleService`、PIN / Secret Number、XRPL 控件。

占位 token 即可。以后换 token 不应迫使重写 feature 屏幕。新改 / 重写的 UI 依赖语义 `AppTheme` 值，不写裸颜色。

---

## 11. 怎么重写一个表面

F2 存在之后，每个产品 PR 都按此做。F1–F3 只跟 §6。导航库是 React Navigation（§5–§6 F0）。

1. 在 PR 说明里写出 §7 行、feature 归属、Capability。若是 Exclude，停止。
2. 读 `docs/mobile-capability-status.md` 里对应证据。Capability 被挡住或缺失时，UI 保持诚实（禁用 / 占位），不要假装能用。
3. 看 `origin/Stellar` 只看：屏幕顺序、空态 / 加载 / 错误、打开的是哪种 overlay / modal。关掉 donor 文件后再写 Fresnica 代码。
4. 在 `features/*` + `ui/*` 实现。适配器在 `app/` 接线。只有可复用的钱包策略才放进 `capabilities/`。
5. 文案走 i18n。用目标名（`activity`、`dapps`）。
6. 为流程状态和该屏幕能到达的 Capability 失败补测试。
7. 若这是该 feature 目录第一次实质性重写，同一 PR 扩展 `scripts/check-architecture.mjs`。
8. 跑 `npm run check`，以及该表面会影响的 Capability 测试。

遇到这些情况先停下来问，不要自行绕过：

- 把 Stellar / Xaman 文件抄进 `src/`
- 加 `src/services` 或全局 `NavigationService`
- 在 F0 已选 React Navigation 之后再加 Wix RNN
- 发明 Path Payment、应用锁、Mainnet 或 dApp 权限语义
- 为「兼容」留下 Events / XApps 别名
- 把底层 PR 和新的产品 Capability 混在一起

---

## 12. PR 规则

- 一个分支一个产品目标。
- 编码前写出 §7 行、feature 归属、Capability。
- 实质性重写遗留 feature 目录时，同一 PR 扩展 `scripts/check-architecture.mjs`。
- 不要把底层（F1–F3）和新的产品 Capability 混在一起。
- 不要为了让屏幕看起来完整而削弱精确 XDR 或密钥处理。
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
