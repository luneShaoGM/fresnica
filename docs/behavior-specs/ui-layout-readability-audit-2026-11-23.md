# UI 布局与可读性审查 — 2026-11-23

## 1. 范围、基线与证据状态

本次是一个 PR 内的 UI 呈现修复切片：按当前源码与实际导航检查页面、内部流程、弹窗和关键状态，处理内容越界、控件拥挤、文字裁切、短屏不可达和前景/背景配色不匹配。页面清单不等于原生验收通过清单。

| 项目 | 本次记录 |
| --- | --- |
| 开发基线 | `f644b60ed46c10789138d9649d3fc2104f6584a3` |
| 分支 | `fix/ui-page-audit-2026-11-23` |
| 工作树 | `/Users/lune/Documents/work/2012/fresnica-ui-page-audit-2026-11-23` |
| PR / 最终 remote HEAD | 对应本分支的 GitHub PR；最终 40 位 remote HEAD 和 CI 记录写入 PR 描述。本文件记录源码覆盖与验证，不充当 Handoff 或 exact-HEAD 审批。 |
| 独立 Work Review | 尚未执行。开发内部交叉检查不授予 APPROVED；Work 必须独立读取当前 remote HEAD 的实际 diff。 |
| 规范定位 | 现有 Phase 2c/shared chrome 呈现工作，以及产品信息架构 §14 的主题、safe area、键盘避让、Modal/Sheet 等横切角色 |
| 来源决策 | Adopt 既有交互角色，Adapt 当前 Fresnica 本地实现；复用现有组件、主题 token 和 RN 原语；没有复制 donor 源码、测试或美术资源 |
| 成熟度 | 不提升任何 S ID 的产品、原生或可访问性成熟度；不把辅助布局检查写成产品流程验收 |

规范依据：

- [产品信息架构与 §14 横切角色](../stellar-product-information-architecture.md)。
- [Architecture Style Guide](../mobile-architecture-style-guide.md) 与 [开发流程](../mobile-development-workflow.md)。
- [Product Traceability Ledger](../product-traceability-ledger.md) 与 [Provenance Rules](../provenance/README.md)。
- 各页面继续遵守原有 Behavior Specs；本记录不替代账户生命周期、共享认证、exact-XDR、交易恢复、dApp origin/permission 或联系人契约。

对应既有产品 IDs：S01–S07、S09–S19、S22–S27、S30 的现有 UI 表面。S03/S12 等包含源码检查和共享组件影响，不表示本 PR 新增这些能力。冻结或暂停的功能边界继续保留，包括 M-address、未具备上游契约的能力以及 Automation V2.2。

## 2. 如何确定覆盖范围

### 2.1 清单来源

以 `git ls-files src/features src/app/navigation` 的已跟踪文件、`navigationTypes.ts`、实际 Navigator 中的 `Stack.Screen`/条件 JSX，以及 `SessionGate.tsx` 为清单依据，再逐页读取组件、相邻 styles、共享容器和呈现分支。历史 progress、路由状态说明和聊天摘要只作背景，不覆盖实际导航事实。

已逐项覆盖当前清单中的 **49/49 个 Screen/Sheet/Dialog 源文件**，另外检查 App 壳、辅助组件与状态表面。此数字包含无生产引用遗留项，不表示 49 个页面均已通过原生产品验收。

本次区分：

- **路由**：实际注册并由当前条件可达的 Navigator 页面。
- **内部流程/弹层**：由路由内部状态展示的步骤、Sheet、Dialog 或嵌入页；不是新增独立路由。
- **壳/会话表面**：启动、锁屏、主 Tab、Actions 等 app 层呈现。
- **无生产引用遗留**：源码存在，但当前导航与生产代码未引用；不能因为文件名包含 Screen 就当作现行页面。

MainTabs 当前注册的是 Home、Activity、dApps、Settings 四个 Tab；Actions 是 MainTabBar 展示的 overlay，保留现有 Home / Activity / Actions / dApps / Settings 交互壳。实际 `asset-details` 使用 `AssetDetailsSheet`，不是同目录的 `AssetDetailsScreen`。实际会话解锁由 `SessionGate` 展示 `SessionUnlockScreen`，不能与 RootStack 的 `LockedPlaceholderScreen` 混为一项。

### 2.2 检查口径

检查固定高度/宽度、flex 子项是否可收缩、按钮换行后的内边距、列表与固定区域争夺高度、滚动容器约束、键盘下方内容、完整身份信息、错误/空态和主题配色。正文继续响应系统字体；只对已有可读标签的固定尺寸装饰 glyph 使用 `allowFontScaling={false}`。

列表摘要中的既有短地址/省略展示与确认页完整身份分开处理。发送确认、结果和详情中用于核对的地址、issuer、Memo、hash 等不应只剩省略号；它们的完整值采用自然换行和滚动容器。

证据分为四层，互不替代：

| 类型 | 能说明什么 | 不能说明什么 |
| --- | --- | --- |
| 源码审查 | 已读取入口、样式与状态分支；指出布局成因和具体修改 | 不能证明设备上的像素、触控、键盘和读屏行为 |
| Jest / repository checks | 回调、状态分支、组件契约和构建约束未出现已测回归 | 不是 Android/iOS 原生页面验收 |
| 原生布局辅助场景 | 真实组件在指定原生运行时、公开固定数据下的布局/滚动观察 | 不证明真实账户、SDK、网络、授权、签名、提交或持久化链路 |
| 原生产品流程 / 真机验收 | 经真实产品入口与依赖执行的具体流程 | 本文不能用辅助场景或历史结果补足未执行项目 |

## 3. 已确认问题与修复

以下为当前 diff 已交叉核对的呈现改动。没有通过改变账户权限、隐藏错误或放宽安全条件来获得更短的页面。

| 编号 | 原因及可见问题 | 本次处理 | 主要源码 |
| --- | --- | --- | --- |
| UI-01 | 返回按钮、居中长标题和空白镜像侧栏争用窄屏宽度；原先两侧 flex 分配可把 Back 拆成很窄的多行。单纯给标题设百分比上限不足以解决。 | 公共标题栏保留返回按钮的自然宽度，标题占剩余空间并换行，移除无内容的右镜像栏；增加垂直留白。SettingsSubpage 复用公共标题栏；Accounts/About/NetworkSettings 同步该布局。Send/Request/Ingress/DeepLink/Swap 的同型返回区域也按自然宽度补修，保留实际存在的右侧动作。 | `ui/components/CenteredPageHeader/*`、`settings/SettingsSubpage*`、`accounts/styles.ts`、`AboutScreen*`、`NetworkSettingsScreen*` |
| UI-02 | 长 Dialog 的标题、说明、字段和操作一起超出短屏；原容器没有覆盖整段内容的滚动路径。 | AppModal 增加显式 opt-in `scrollable`，仅对 dialog 生效；标题/说明/正文共同滚动，并使用 iOS padding / Android height 键盘避让。PassphrasePrompt、账户改名/删除、隐私同意、安全截图警告、资产分类启用。已有内部 ScrollView 的其他弹窗保持原结构，避免双层滚动。另以默认 false 的 `avoidAndroidKeyboard` 为五处选定表面/弹层显式启用 Android height 避让，iOS 不增层；实测 API 36 Modal 的 adjustResize 声明不足以保证 JS 内容避让。 | `ui/components/AppModal/*`、`PassphrasePrompt/*`、`AccountDetailsScreen.tsx`、`PrivacySettingsScreen.tsx`、`SecuritySettingsScreen.tsx`、`AssetCategoryDialog.tsx` |
| UI-03 | quiet/secondary NativeButton 复用库的 primary token 作为文字颜色；明亮主色在浅色表面可读性不足。 | 通过 vendor 公开 theme override，仅给未填充按钮映射可读的 contentPrimary；主按钮仍使用原主色。另将本地 Button 的透明 ghost 文字改为 textPrimary，修复 AccountDetails 的 Edit label。保留反馈、回调、disabled/loading 与传入主题语义。 | `ui/components/NativeButton.tsx`、`ui/components/Button/styles.ts`、相关真实 vendor 测试、`jest.config.js` |
| UI-04 | 固定高度 Chip、滑动确认轨道、品牌头和缺少垂直 padding 的按钮，在大字体/多行标签下裁切或贴边。 | compact Chip 使用 minHeight 和 padding；SlideToConfirm 标签进入正常高度计算；品牌头允许自然增高；实际按钮/选择行补垂直留白与必要换行。未改变滑动手势阈值和确认回调。 | `SelectableChip/styles.ts`、`ui/SlideToConfirm.tsx`、`MainTabBar.styles.ts`、Onboarding/AddAccount/Send/Request/Trustline/dApps styles |
| UI-05 | 成功/失败/不确定状态背景却统一配 onActionPrimary；不同主题/自定义主色时前景与实际背景不匹配。另有 surfaceStrong 背景误配主色文字。 | 按实际 positive/negative/warning 底色计算 contrastText；surfaceStrong 配 onSurfaceStrong。TransactionResult 标题/正文使用可读正文色；AccountDetails 删除确认、Send/Trustline 结果 glyph、Onboarding/AddAccount、dApps、Request 等实际消费者分别修正；Accounts classic badge、AccountPicker current/error、Activity 支出金额也使用与背景匹配的可读前景。 | `TransactionResult/*`、`SendResultScreen.tsx`、`trustlines/styles.ts`、`AccountDetailsScreen.tsx`、`OnboardingScreen.tsx`、`AddAccountScreen.tsx`、dApps/Request styles |
| UI-06 | 确认/结果行的标签无占宽限制，值又被固定行数截断；长 Memo、issuer、地址和 hash 无法完整核对。 | 标签限制合理占宽并允许收缩，值使用剩余宽度、取消不必要的 numberOfLines、行间增加垂直留白。 | `SendReviewScreen.tsx`、`SendResultScreen.tsx`、`ManageAssetsScreen.tsx`、`OperationDetailsScreen.tsx`、Swap/Claimable styles |
| UI-07 | Send/ManageAssets/Swap 的部分 loading、不可用、错误表面为非滚动容器；长解释在短屏可让返回/后续动作不可达。Send review 错误在滚动区外挤占正文。 | 状态正文使用既有 ScrollView；Send review 错误移入正文滚动区。业务状态及动作保持原义。 | `SendEntryStatus.tsx`、`SendReviewScreen.tsx`、`ManageAssetsScreen.tsx`、`SwapPreviewScreen.tsx` |
| UI-08 | SettingsSubpage 连续段落/动作没有统一 gap；口令提示和字段标签贴近输入；助记词编号/单词及按钮缺少随内容增高的留白。 | 复用主题 spacing 补内容、字段和 Dialog 间距；助记词编号改 minWidth；继续使用原安全输入与校验逻辑。 | `SettingsSubpage.styles.ts`、`NewPassphraseGuidance/*`、`SessionUnlockScreen/*`、`onboarding/styles.ts` |
| UI-09 | PendingMnemonicBackup 的主操作在 ScrollView 外，短屏/大字体可能和解释争夺高度；表单键盘下内容可达性不足。 | 主操作并入原 ScrollView；相关 onboarding/add-account/settings 表单启用已有 RN 键盘 inset 能力。 | `PendingMnemonicBackupScreen.tsx`、`OnboardingScreen.tsx`、`AddAccountScreen.tsx`、`SettingsSubpage.tsx` |
| UI-10 | AddressBook 的提示、搜索和新增区域位于列表外，大字体时压缩列表；联系人扫码错误/权限控件在固定布局中可能超过短屏。 | SectionedList 薄透传 header 给 ListHeaderComponent；地址簿头部随列表滚动，空/错态保持原动作。两处扫码内容采用 ScrollView，预览保留可用最小高度，Retry/Settings/Cancel 可向下滚动访问。 | `AddressBookScreen.tsx`、`SectionedList.tsx`、`ContactEditor.tsx`、`RecipientScanSheet.tsx`、`contacts/styles.ts` |
| UI-11 | Home 网络标签、只读 badge、资产分类与多项操作在同一横排争宽；固定动作缺少多行留白。 | 网络/身份项限定占宽并可收缩；原生辅助进一步发现正常字号 Mainnet 也被品牌挤成省略号，因此 Home header 允许换行、NetworkStatus 取消单行截断、网络按钮放宽至整行。分类行允许换行，动作按钮补 padding；新增账户/分类链接/claimable hint 文字改 textPrimary。标准字体保留已有独立余额区与资产列表布局；大字体调整见 UI-16。 | `features/home/styles.ts`、`features/home/components/NetworkStatus.tsx` |
| UI-12 | dApp URL/详情 Sheet 整体不能滚动；连接 Sheet 只滚动中间 hero，网络/授权动作留在外侧；完整 origin 被单行截断；连接列表的断开按钮争宽。 | URL/详情/连接内容改为有界滚动，完整 origin/name/network 可换行；签名表面补键盘 inset，并仅在需要口令时启用 Android 外层避让；secondary 配对应前景；已连接列表允许操作换行。 | `DappDetailSheet.tsx`、`DAppsScreen/*`、`DappConnectSheet.tsx`、`DappSignSheet.tsx`、`ConnectedDappsScreen.tsx`、相关 styles |
| UI-13 | AddAsset Sheet 标题与操作、筛选、多来源状态拥挤；缓存提示复用 flex:1 状态块，可能挤占列表；Trustline/Request 多个动作没有换行余量；Claimable 大金额与标题争宽。 | 标题/操作/筛选与按钮补换行和留白；缓存 notice 从整页状态样式分离；明细金额/标签限制占宽。AddAsset 将头部/筛选/搜索/缓存或 manual URL 放入单一 FlatList 的 header、manual code/issuer 放入 footer，资产行通过 renderItem 渲染（原实现为 ScrollView.map），提交按钮保留同级固定 footer；不再让固定控制区挤掉列表。 | `AddAssetSheet.tsx`、`addAssetStyles.ts`、`ManageAssetsScreen.tsx`、Request styles、`ClaimableScreen.tsx`、Claimable styles |
| UI-14 | 使用 Text 绘制的固定尺寸返回箭头、信息标志、盾牌、关闭符号等会被系统字体放大到图标框外。 | 只关闭这些装饰 glyph 的字体缩放；可操作父控件保留可读 accessibilityLabel，正文和按钮标签继续缩放。 | Accounts/AddAccount/AccountDetails、Onboarding/PendingBackup、NetworkSettings、OperationDetails、dApp browser/connect 的具体 glyph |
| UI-15 | Activity 搜索与全部 active filter chips 位于 FlatList 外；大字体下多项筛选/完整 issuer 增高后挤占列表视口。 | 将原 controls 放入同一 FlatList 的 ListHeaderComponent，再接原 ActivityContent header；保留 list renderItem、refresh、分页/backfill 和虚拟化，chips 补垂直留白。 | `features/activity/ActivityScreen.tsx`、`features/activity/styles.ts` |
| UI-16 | 大字体时 PinnedNativeAssetRow 已变多行，Home 仍把它固定在两个滚动区之间；长 XLM 金额/reserve 占满剩余高度，issued token 列表无法访问。 | 沿用现有 >1.5 字体阈值：大字模式复用同一 nativeRow，与 tokens 进入原资产 ScrollView；freshness 提示置于该区域最顶部。≤1.5 维持原固定 XLM 四区布局，刷新/账户依赖/回调不变。 | `HomeScreen.tsx`、直接相关 Home tests |
| UI-17 | Android 账户摘要的 selectable Text 与单行 middle ellipsis 组合显示出半行地址残字；父容器并无固定文字高度。 | 仅 Android 单行摘要关闭原生文字选区，保留完整 Text/address、专用复制按钮和完整复制内容；iOS 和详情多行选择不变。 | `features/accounts/CopyAddressButton.tsx` |

NetworkNodeHealth 的 warning/healthy 13px 状态正文也从浅色 warning/positive 改为 textPrimary；状态圆点、内容、重试逻辑不变。原浅色白底对比度分别约 1.67:1 / 2.14:1。

配色调查使用当前主题 token 和实际消费者配对。例如 `negative=#FF5B5B` 上的白字对比度约 3.04:1，改为由该底色计算出的黑色约 6.90:1；dark `negative=#FF9999` 对应白字约 2.05:1、黑字约 10.27:1。这是这些配色的计算证据，不是对整套主题或所有状态的可访问性认证。配色计算复用 `ui/theme/appearanceTheme.ts`，没有引入第二套主题系统。

## 4. 页级源码覆盖矩阵

下表的“检查/处理”是源码审查及本次 diff 范围。**所有行的设备证据均以 §6 的具体场景为准；没有列为原生通过的行，不应推定已通过。**

### 4.1 App 壳、入口和账户

| 实际入口 / 类别 | 组件与源码归属 | 已纳入的呈现分支 | 检查 / 处理 |
| --- | --- | --- | --- |
| Root bootstrap / runtime fallback | `AppNavigator.BootstrapScreen` | loading、启动错误、runtime message | 读取现有布局；未改变启动失败与阻断语义；长错误的原生观察待补 |
| Root network-setup | `NetworkSettingsScreen` | 初始网络选择、无返回按钮 | UI-01；保留 showBack=false |
| Root onboarding | `OnboardingScreen` | 欢迎/选择、创建、导入口令/助记词/secret、watch-only、生成后备份 | UI-04/05/08/09/14 |
| Root onboarding 的 pending-backup 条件 | `PendingMnemonicBackupScreen` | 揭示前说明、口令、失败、揭示后确认 | UI-04/08/09/14；不改变备份完成门禁 |
| 内部备份步骤 | `MnemonicBackupVerification` | 单词列表、校验挑战、未匹配、继续/取消 | UI-04/08；无新路由 |
| SessionGate 会话表面 | `SessionUnlockScreen` | 口令、biometric 可用/不可用、失败与取消 | UI-08，共享 NativeButton；不改变锁定/解锁权限 |
| Root locked 占位注册 | `AppNavigator.LockedPlaceholderScreen` | 锁定标题/阻断说明 | 记录注册事实；不是实际 System Auth 验收 |
| 主 Tab + Actions overlay | `MainTabsNavigator`、`MainTabBar`、`ActionsScrollView`、`ActionsFeatured` | 导航标签、快捷动作、disabled 原因、Scan、Recent、featured | UI-03/04；disabled 原因避免整体 opacity 叠加弱化；动作资格、账户选择和路由不变 |
| Settings/accounts-settings | `AccountsScreen`、`CopyAddressButton` | 账户列表、排序入口、隐藏/可见摘要、新增、复制反馈 | UI-01/05/14，共享按钮；classic badge 改可读文字前景，列表摘要保留原显示规则 |
| Settings/account-details | `AccountDetailsScreen` | 公共身份、隐藏/恢复、改名 Dialog、删除 Dialog、错误 | UI-02/05/06/14；保留操作回调和生命周期约束 |
| Home 或 Settings/add-account | `AddAccountScreen` | 选择、create、watch-only、import mnemonic、import secret、HD source/derive、生成后备份 | UI-04/05/09/14；复用现有 flow，无账户写入逻辑变更 |

### 4.2 Home、资产、市场和 Claimable

| 实际入口 / 类别 | 组件与源码归属 | 已纳入的呈现分支 | 检查 / 处理 |
| --- | --- | --- | --- |
| Home/home | `HomeScreen` | ready、loading、error、stale/refreshing、inactive、unsupported/read-only、空资产 | UI-11；已检查 header/token 两段滚动与各状态的所在容器 |
| Home 内账户选择 Dialog | `AccountPickerModal` | 多账户、selected、选择中、选择失败 | 已检查现有内部 ScrollView(maxHeight360)、行 minHeight/padding、完整可访问性名称；不叠加 AppModal 外层滚动。current 改 textPrimary、限制 maxWidth45% 并可收缩；error 改 negativeStrong，identity 增加 minWidth0 |
| Home 子路由失效 fallback | `HomeStackNavigator.AssetAccountUnavailable` | 当前账户已变化/不可用、返回 | 复用默认可滚动 Screen 与 StateView；不改变账户资格检查 |
| Home 子面板 | `AccountSummary`、`NetworkStatus` | 长账户/网络名、只读/contract badge、disabled 网络选择 | UI-11；列表短地址保留，不冒充完整确认值 |
| Home 子面板 | `AssetList`、`PinnedNativeAssetRow` | native 固定行、issued list、无其他资产、隐藏 pool 提示、余额/法币/reserve | UI-16；大字时 native/tokens 同区滚动，正常字号保留固定行；不改余额/估值语义 |
| Home 子面板 | `BalanceFreshnessNotice`、`InactiveAccountPanel` | 缓存状态/失败重试、未激活、Friendbot funding/error | 现有 token ScrollView、gap、自然文本高度与按钮；无新增独立修改 |
| Home/asset-details（native form sheet） | `AssetDetailsSheet`、`assetDetailsSheetStyles` | native reserve breakdown、issued issuer/copy warning、send/remove、loading/error/inactive/missing/stale | 已有整体 ScrollView、sticky header、bottom safe area；issuer 无行数上限，值区 flex/minWidth。无新增独立修改；不等于已验收原生 sheet 拖动/键盘 |
| Home 分类 Dialog | `AssetCategoryDialog` | token/pools/claimable、可用分类、关闭 | UI-02/11 |
| Send/Swap 内资产选择 Sheet | `AssetPicker`、`assetPickerStyles` | 选择项、余额、完整 issuer、搜索、清除、无结果、disabled | 已有 KeyboardAvoidingView + FlatList、可变行高和完整身份；共享 NativeButton 修复。短屏键盘后的剩余空间仍需具体设备验证 |
| Home/orders 与 Home pools 内嵌页 | `MarketsScreen` | order/pool 列表、详情、编辑、review、result/uncertain | 完整读取呈现分支；未发现需要单独源码修改的确定问题，沿用共享组件修复 |
| Home claimable 内嵌页/详情 Sheet | `ClaimableScreen` | 列表、suspect/spam、details、technical、preparing/review/result | UI-06/13；完整金额、技术标题和属性行有界换行 |
| 图标/估值辅助 | `TokenAssetIcon`、`NativeFiatEstimate` | 图标回退、公开资产身份、估值/不可用 | 随实际消费页面纳入源码检查；不是独立路由；无新业务修改 |

### 4.3 Send、Request、Swap 和 Trustline

| 实际入口 / 类别 | 组件与源码归属 | 已纳入的呈现分支 | 检查 / 处理 |
| --- | --- | --- | --- |
| Home/send-form / deep-link continued | `SendFlowScreen` | entry、form、recipient、review、result 状态组合 | 检查组合边界；不改变授权与提交状态机 |
| Send 内部表单 | `SendFormScreen` / `SendEntryScreen` | Details、金额/余额、asset、Memo families、Recipient、错误 | UI-01/04/05；长标签/金额不与相邻控件争宽 |
| Send 阻断态 | `SendEntryStatus` | loading、账户/会话/网络等不可用原因 | UI-07；保持全部现有分支与提示 |
| Send 内部确认 | `SendReviewScreen` | 公共身份、Memo、授权前错误、授权中、口令弹窗 | UI-02/06/07；完整值与错误进入可滚动区域 |
| Send 内部结果 | `SendResultScreen` | 成功、失败、取消、uncertain/recovery 等既有结果分支 | UI-05/06；不将 uncertain 渲染为成功 |
| Home/request | `RequestFlowScreen` | 创建请求与导入/扫描内部步骤 | 检查步骤组合，复用现有表面 |
| Request 内部表单 | `RequestFormScreen` | account/asset、amount、memo、message、QR/URI、复制/分享、错误/成功反馈 | UI-01/04/05；secondary 前景与底色成对，动作可换行 |
| Request / Actions Scan / 导入内部表面 | `RequestIngressScreen` | camera 权限各态、扫描/相册/粘贴、accepted/rejected、继续/返回 | UI-01/04/05；控制行换行，状态内容可滚动；解析策略不变 |
| Root/request-deep-link | `RequestDeepLinkScreen` | ready、blocked、继续、关闭 | 源码核对与共享 ingress 样式；不改变网络/账户资格限制 |
| Home/swap / Actions Swap | `SwapPreviewScreen`、`ActionsSwapEntry` | Pay/Receive、quote/routes、settings、review、history/recovery、会话不可用 | UI-01/06/07；长标题和金额/标签让出必要空间；报价与交易逻辑不变 |
| Swap 内部结果 | `SwapResultScreen` | 所有既有提交/恢复结果 | 通过 TransactionResult 继承 UI-04/05；无新结果状态 |
| Swap 输入辅助 | `SwapAmountInput`、`SwapPassphraseInput` | 输入、错误/disabled、口令 | 随 Swap 分支检查；无新输入策略 |
| Home/manage-assets | `ManageAssetsScreen` | loading/inactive/error/list、limit editor、review、result | UI-04/05/06/07/13；issuer/确认值完整，动作和错误可达 |
| Home 或 ManageAssets/AddAsset Sheet | `AddAssetSheet` | manual/catalog、search/filter、cached/refreshFailed、空/错态、确认 footer | UI-13；已改为单一 FlatList header/rows/footer 与固定提交区域；实际原生回测结果见 §6 |

### 4.4 Activity 与 dApps

| 实际入口 / 类别 | 组件与源码归属 | 已纳入的呈现分支 | 检查 / 处理 |
| --- | --- | --- | --- |
| Activity/activity | `ActivityScreen` | loading/error/empty、列表、search、日期、分页、offline/cache/stale、已有 active filters | UI-05/15；搜索和 active filters 已移入原 FlatList header，行与原状态保持原有结构；amountNegative 改 negativeStrong |
| Activity filter Sheet | `ActivityFiltersSheet` | direction/type/asset/amount、hidden/dust/failed、refresh、apply | 已有内容 ScrollView、正文 flex/minWidth、固定 Apply；继承 Chip/NativeButton 修复，无新增独立页面逻辑 |
| Activity/operation-details | `OperationDetailsScreen` | payment/path/offer/pool/claimable/contract/account-control 等已实现类型，failed/missing data、explorer | UI-06/14；DetailRow 默认完整显示，不把未知金额解释成已知 |
| Activity 辅助 | `ActivityAvatar` | 联系人/资产头像与回退 | 随列表和详情源码检查；无独立路由 |
| dApps/dapps | `DAppsScreen` | catalog/recent/search/category、loading/error/cache/empty、custom URL/disclaimer | UI-04/05/12；segment/行高自然增高，URL Sheet 可滚动 |
| dApps 详情 Sheet | `DappDetailSheet` | loading/error/ready/stale、公开说明、website、关闭 | UI-12；标题与关闭按钮分配宽度，整段内容滚动 |
| dApps/dapp-browser（平台能力条件注册） | `DappBrowserScreen` | origin/toolbar、WebView loading/error、现有拒绝/返回/关闭路径 | UI-14；只调整固定 glyph，浏览器/来源隔离规则不变 |
| Browser 内连接 Sheet | `DappConnectSheet` | address/origin/network、allow once/always/reject | UI-04/05/12/14；完整 origin，所有内容/授权按钮同一滚动范围 |
| Browser 内签名 Sheet | `DappSignSheet` | transaction intent、message review、passphrase、failed/retry/reject | UI-05/12；键盘 inset 与配色；不改 exact-XDR/消息授权 |
| Settings/connected-dapps | `ConnectedDappsScreen` | 无 grant、长 origin/account、disconnect、failure | UI-03/12；断开动作可换行，保持网络/账户分区 |
| dApps 辅助 | `DappCatalogIcon`、`ActionsFeatured` | 图标回退、推荐卡、空/不可用 | 随目录/Actions 检查；无新增能力 |

### 4.5 Settings、Security 与 Contacts

| 实际入口 / 类别 | 组件与源码归属 | 已纳入的呈现分支 | 检查 / 处理 |
| --- | --- | --- | --- |
| Settings/settings-home | `SettingsHomeScreen` | 所有设置入口、account count、support/terms | 源码检查；继承共享按钮/文本配色，未新增独立修改 |
| Settings/general-settings | `GeneralSettingsScreen` | display/locale/theme/feedback、选项/保存失败 | UI-01/08 通过 SettingsSubpage；偏好含义不变 |
| Settings/advanced-settings | `AdvancedSettingsScreen` | Developer Mode 状态/授权、网络、logs、失败 | UI-01/02/08 通过共享容器与 PassphrasePrompt |
| Settings/theme-settings | `ThemeSettingsScreen` | system/light/dark、custom primary、image selection、unavailable/error | UI-01/03/08 通过共享组件；不改变主题持久化 |
| Settings/session-logs | `SessionLogsScreen` | 日志、空态、export/clear、permission/error | UI-01/08；连续说明/按钮有统一间距 |
| Settings/language-settings | `LanguageSettingsScreen` | 各语言、selected、返回 | 行垂直 padding；共享 header/按钮 |
| Settings/privacy-settings | `PrivacySettingsScreen` | 外部资源开关、consent Dialog、错误 | UI-02/08；内部 ScrollView 改普通内容，由 opt-in AppModal 统一滚动 |
| Settings/security-settings | `SecuritySettingsScreen` | biometric/timeout、recovery links、Android capture 警告/授权/错误 | UI-02/08；只调整布局，不改变 Dev Mode/System Auth 条件 |
| Settings/recovery-material（服务条件） | `RecoveryMaterialScreen` | 可用/不可用、授权、揭示、copy、失败/取消 | 源码检查并继承共享容器/PassphrasePrompt；敏感材料边界不动 |
| Settings/change-passphrase（服务条件） | `ChangePassphraseScreen` | 当前/新口令、确认、风险提示、失败/成功/取消 | 源码检查，UI-08 通过共享 NewPassphraseGuidance；不改密码策略 |
| Settings/network-settings | `NetworkSettingsScreen` | 内建网络、custom、Dev Mode gating、节点状态/错误 | UI-01/14；不改网络切换契约 |
| NetworkSettings 内部管理 | `NetworkManagement`、`NetworkNodeHealth` | 节点列表、添加/编辑/删除 Dialog、检测、失败 | 已有内部滚动，保持原容器；新增网络输入 prompt 显式启用 Android 键盘避让，未套用额外 ScrollView |
| Home/Settings 网络切换弹层 | `NetworkSwitchModal` | sheet/dialog、选项、长网络名、错误 | 标题 flex/minWidth 与 gap；既有内部 ScrollView 保留 |
| Settings/about | `AboutScreen` | app/project/version、网络说明、返回 | UI-01 |
| Settings/terms、support-unavailable | `TermsScreen` | 条款可用/不可用、supportError | 同一真实组件的不同入口；检查正文和失败提示，继承 SettingsSubpage |
| Settings/address-book | `AddressBookScreen` | 目录、search、empty、load failure、add/edit | UI-10；header 与错误/空态整合到同一列表 |
| Contacts 内部编辑 | `ContactEditor` | name/address/memo、验证失败、duplicate/delete、QR/scan 权限各态 | UI-10 扫码布局；保留 typed Memo/删除规则 |
| Send/Request 联系人选择 | `DestinationPicker` | 本地账户/联系人、search/empty、选择 | 源码检查，保留现有列表与选择语义 |
| Activity/Send 参与方卡 | `ParticipantCard`、`AccountAvatar` | 身份/菜单、编辑、复制、错误、头像回退 | 源码检查，复用 ContactEditor；无新远端身份信任 |
| Contacts 扫码 Sheet | `RecipientScanSheet` | permission/check/request/blocked、retry/settings、success/error/cancel | UI-10；短屏可滚动访问预览和操作 |

### 4.6 无生产引用的遗留 Screen

| 文件 | 当前引用核对 | 本次处理 |
| --- | --- | --- |
| `features/accounts/WalletReadyScreen.tsx` | `git grep` 只发现组件定义，无当前生产导航/消费引用 | 记录并阅读，不删除、不宣称是现行页面、不用它替代 Accounts/Home 验收 |
| `features/home/AssetDetailsScreen.tsx` 及其 styles | 当前 `asset-details` 注册的是 AssetDetailsSheet；另有测试中的历史 mock，不构成生产引用 | 记录并阅读，不删除、不把旧 screen 的表现算作当前 sheet 的证据 |

## 5. 自动验证记录

最终产品源码冻结后，在本分支工作树执行 `npm run check`，进程退出码为 0。下表不是原生产品验收声明。定向执行与全量执行存在重叠，测试数不可相加。

| 验证类型 | 实际结果 | 证明范围 / 边界 |
| --- | --- | --- |
| 完整 repository check | **308 Jest suites / 2916 tests 全部通过**；Node repository tests 3 项通过；TypeScript、product-flow smoke 脚本语法、配置格式、aliases、architecture/style、native patch checks 通过 | 全部为自动/仓库检查；smoke 脚本语法检查不等于执行真实交易流程 |
| ESLint / 格式 | **0 errors / 62 warnings**；配置格式与 `git diff --check` 通过 | warnings 为仓库既有项；没有以关闭规则掩盖错误 |
| 来源、资源与本地化 | donor collision gate：1124 files / 0 unapproved；artwork check 通过；3 dictionaries / 1371 keys 对齐 | 没有复制 donor 实现，没有新增翻译键 |
| 布局结构及原回调定向回归 | AddAsset 12 tests；Activity + silent refresh 39 tests；Home 阈值/刷新/原生资产相关 53 tests；CopyAddress + Accounts 11 tests；NodeHealth 14 tests 通过 | 覆盖本次重组的列表、状态和回调。Home 覆盖 1.0/1.5 保持既有分区、1.6/2.0 进入共同资产滚动区 |
| Modal / 键盘契约定向回归 | AppModal、BottomSheet、DappBrowser、DApps、assetSheets、ActivityFilters、NetworkManagement：**7 suites / 116 tests** 通过 | Android opt-in / 默认 false、iOS 不额外增层、原滚动/关闭回调；不由单测推定软键盘几何 |
| 颜色与实际按钮依赖 | 真实 NativeButton vendor、disabled/loading/pressed、反馈、主题不变异及 TransactionResult 对比色测试通过，纳入上述全量结果 | `jest.config.js` 允许转换 `@fresnica/ui-native` 以运行真实依赖；未修改 vendor 包 |
| 内部交叉检查 | 共享 UI、账户/设置、交易三个范围交叉核对，最后 Android opt-in 补修再次只读核对，未报告未解决的 P1/P2 | 开发内部检查，**不等于 Work exact-HEAD Review** |
| GitHub CI / Work | 提交后的 exact remote HEAD、CI 结果记录在 PR 描述；Work 尚未执行 | 只有 reviewed_head_sha 等于当前 remote HEAD 才有审批效力；本文件不授予 APPROVED |

本地原始日志：`/tmp/fresnica-ui-audit-check-complete-20261123.log`。这些日志是开发环境记录，不是必须依赖的永久审批凭据；当前 PR 的代码、CI 和独立 review 才是远端状态依据。

## 6. 原生布局辅助观察证据

### 6.1 环境与边界

本轮使用 **真实 React Native 组件 + Android 原生运行时 + 公开固定数据**。它是原生布局辅助检查，未执行真实账户建立、授权、签名、提交或持久化链路；辅助入口不随产品代码交付。

| 记录项 | 实际事实 |
| --- | --- |
| 原生环境 | 独立只读 AVD `Fresnica_Acceptance_20261123`，serial `emulator-5562`，Android 16 / API 36 |
| 运行壳 | 复用基线 `f644b60ed46c10789138d9649d3fc2104f6584a3` 的 debug APK；本次修改后的 JS 由独立 Metro 8096 加载；没有声称本轮重新构建原生二进制 |
| 入口 | 临时 `scripts/ui-layout-audit-*.js`；真实 Theme/Localization/SafeArea/UiNative providers，直接装配被测组件，公开账户/资产样本和 no-op/拒绝写端口；不是完整 Navigator/真实产品启动入口 |
| 尺寸 | 物理 840 × 1496 px、density 420；RN 实际报告 **320 × 569.9048 dp**；不是仅按物理像素推算逻辑宽度 |
| 字体与主题 | 系统 fontScale **1.0 / 2.0**；light + English，选定场景 dark + 中文；没有把自定义色或全部语言组合写成已执行 |
| 键盘 | 强制显示软件键盘；通过 `mWindowVisible=true` 与 InputMethod window insets 确认实际弹出，键盘顶边为 y=753 px；没有输入或提交敏感材料 |
| 截图安全边界 | 仅公开 helper Activity 通过已有 `setScreenCaptureProtection(false)` 临时启用截图，退出时恢复；没有修改生产安全策略或持久化用户设置。原生 Modal 的独立 Window 仍受 FLAG_SECURE 保护，黑色截图不能证明其配色，改用 XML 的文字/几何/滚动结果记录 |
| 独立性 | 使用单独 emulator、Metro 与 helper HTTP 端口；原工作树、其他 emulator 和已运行验收环境保持不动 |

### 6.2 已执行组合

以下三组覆盖 **44 个不同 helper case**，有重复 case 和补拍；不是 44 个完整产品流程，也不是所有页面状态组合均通过。49/49 的数字是 §4 的源码清单覆盖。

| 组合 | 实际 case |
| --- | --- |
| light / English / 1.0，29 cases | `settings`, `settings-general`, `settings-theme`, `settings-security`, `settings-privacy`, `settings-about`, `settings-network`, `settings-language`, `settings-logs`, `accounts`, `account-details`, `add-account`, `onboarding`, `contacts`, `contact-editor`, `session-unlock`, `home`, `home-inactive`, `home-error`, `activity`, `activity-offline`, `activity-detail`, `dapps`, `dapps-offline`, `connected-dapps`, `send-form`, `send-result`, `request-form`, `request-scan-controls` |
| light / English / 2.0，19 cases | `header`, `settings-long`, `settings-about`, `settings-network`, `accounts`, `add-asset`, `add-asset-cache`, `add-asset-manual`, `send-recipient`, `send-review`, `request-form`, `activity`, `home`, `dapp-connect`, `dapp-detail`, `dapp-sign`, `dialog`, `passphrase`, `contact-scan-blocked` |
| dark / 中文 / 2.0，5 cases | `components`, `result-unverified`, `home`, `accounts`, `settings-general` |
| 软键盘定向补测 | `dapp-sign` / 1.0、`add-asset-manual` / 1.0、独立启动的 `passphrase` / 2.0；仅检查字段与动作可达性，不实际签名 |

有效批次日志及全部原始 PNG/XML 在开发机 `/tmp/fresnica-ui-audit-20261123` 与相邻 `fresnica-ui-audit-*.log`。部分代表截图和定向几何摘要随本 PR 保存：

- [账户页正常字号](ui-layout-audit-evidence/accounts-light-en-font1.0.png)。
- [发送确认页 2× 的末尾操作](ui-layout-audit-evidence/send-review-light-en-font2.0-bottom.png)。
- [深色中文 2× 共享组件](ui-layout-audit-evidence/components-dark-zh-font2.0-bottom.png)。
- [Home 2× 资产区滚动末尾](ui-layout-audit-evidence/home-light-en-font2.0-bottom.png)。
- [原生环境与键盘几何摘要](ui-layout-audit-evidence/native-layout-summary.json)。

辅助入口曾发生两类无效捕获，均弃用：AddAccount fixture 将 createdAt 误传 number，修正为固定 Date 并补合法 updatedAt/identityKind 后重跑完整 29-case 批次；修改辅助模块后的 Fast Refresh 模块映射错误，经 force-stop/relaunch 后重新捕获受影响场景。不把未渲染白屏或失效捕获计作通过。另在 helper 串行 AddAsset 1.0 → Passphrase 2.0 并强制 remount 时观察到一次未避让；独立固定字体启动通过不能证明这个组合已修复。只读追踪真实 AddAsset/Send/Swap 调用链：旧输入在准备或 review 前卸载，当前没有确认到与 helper 相同的直接触发路径，因此该组合保留为验证缺口。

### 6.3 问题复现与补修结果

| 场景 | 观察与修复后结果 | 证据边界 |
| --- | --- | --- |
| 窄屏标题栏 | 原 Back 被压成异常窄列；共享与交易同型 header 采用自然宽度返回区后，正常/2× 标题可换行，返回可读 | 选定场景截图与 XML；不代表全部本地化字符串 |
| Home 大字体 | 原固定 XLM 区吞掉 issued-token 视口；大字模式共用资产滚动区后，light/English 和 dark/中文都滚动到 TOKEN11 | helper 的资产区滚动；标准字体保留原分区由定向测试覆盖；没有用直接装配截图证明真实 MainTabs 的全部 safe-area 行为 |
| AddAsset 2× | 原头部/筛选占满视口，0 个 scrollable 区且操作文字仅露 y1483–1496；改后列表区 y296–1203，操作文字 y1271–1355 完整，列表末项/手工 issuer 可达 | 受保护 Modal 的 XML/滚动结果；不声称其 PNG 配色通过 |
| Android 单行账户地址 | 原 selectable + middle ellipsis 出现第二行残字；修复后 1× light 与 2× dark 捕获中残字消失，摘要省略及 WHF 尾部正常 | 完整复制值由既有回归测试覆盖；不是所有 OEM 字体的保证 |
| Activity 控制区 | 2× 多筛选/搜索随原 FlatList header 滚动，可继续访问数据；原分页、refresh/backfill 与虚拟化保持 | 真实组件布局 + 39 tests；不代替远端 history 产品验收 |
| 长交易身份与操作 | Send review/result/detail 的长地址、Memo、issuer/hash 可换行；滑动确认文字可随高度增长，操作间有留白 | 公开样本截图/源码/测试；没有真实签名或广播 |
| 颜色 | 浅色账户/网络状态文字、dark 中文组件及 uncertain 结果的非保护截图已查看；真实 vendor button/结果背景前景组合纳入回归 | 保护 Modal 的颜色仍只有源码/对比度计算证据 |
| Android 签名软键盘 | 修复前 scroll y296–1382、Sign/Reject y1252–1302 被 y753 键盘遮挡；修复后 scroll y206–701，Sign/Reject y571–621，均在键盘上方 | 固定公开签名内容，只聚焦原生安全输入，无签名执行 |
| Android AddAsset 软键盘 | 修复后 scroll y206–522，Add and sign y607–657，位于 y753 键盘上方 | 手工输入样本；没有添加 trustline 或签名 |
| Android Passphrase 2× 软键盘 | 独立启动后 scroll y144–609，滚动到底 Cancel y312–564，位于 y753 键盘上方；向回滚动后 Confirm 完整文字 y177–513；长按钮不要求同时完整显示，以分别滚动可达为判定 | 原生安全输入只聚焦、不输入口令；串行字体变化的异常不并入此通过记录 |

## 7. 收尾核对与尚未完成的验证

| 项目 | 当前事实 |
| --- | --- |
| 已确认呈现问题 | §3 的 UI-01–17 及节点状态前景已修复；实际发现的标题栏、AddAsset、Home、账户残字、键盘遮挡已做相关补测 |
| 最终统一 gate | `npm run check` 退出码 0，308 suites / 2916 tests；CI 在提交后记录到 PR |
| 独立 Work Review | 尚未执行，内部交叉检查不授予 APPROVED；Work 必须读取最终 exact remote HEAD |
| 已显示 IME 时改变字体并强制 remount | helper 出现过未避让，具体事件时序未定位；当前产品链未确认同样触发路径，未将其宣称为已修复或完整验证 |
| iOS 大字体/键盘/Modal | 本轮未运行 iOS Simulator 或真机；Android helper 与组件测试不能替代 |
| Stage 9 iOS 真机 System Auth 取消/重试 | **继续延期，未完成**；此次呈现修复不改变该证据边界 |
| 完整导航、读屏与真实产品链路 | 未新完成 VoiceOver/TalkBack、所有真实 Navigator safe area、后台/断网/持久化/签名提交组合；保持原 Behavior Specs 和既有延期项 |
| 合并 | 本 PR 待独立 Work Review；是否进入可合并候选状态以当前 exact remote HEAD 的 Review 与 CI 为准，Merge 时间仍由用户决定 |

## 8. 可复现的手工检查矩阵

以下是复现条件，不是执行结果。先在安全的公开测试数据中检查 UI；需要真实产品验收时再通过既有产品入口与受控测试账户执行，不从 fixture 推断业务成功。

| 组合 | 操作与重点 | 判定 |
| --- | --- | --- |
| 320dp 宽、短竖屏、1×、light、英文 | 长标题 + Back；Settings 多按钮；Account/Network/About；Send/Request/Swap 标题 | Back 不拆成异常狭列；标题在剩余空间换行；正文顶部和操作间有间距 |
| 320dp 宽、短竖屏、2×、light/dark、中英文 | 打开所有主要列表/表单/空错态；滚动至末尾；返回 | 无水平越界、正文不被固定行高裁切；末尾动作可达；正常正文继续缩放 |
| 320dp、2×、长资产/账户/联系人名 | Home、Accounts、AddressBook、Activity、AddAsset、Connected dApps | 主信息和相邻金额/按钮各有空间；允许换行；摘要省略不影响详情完整核对 |
| 320dp、2×、长 Memo/issuer/hash/origin | Send Review/Result、OperationDetails、Trustline Review、dApp Connect/Sign | 完整关键值可见或可滚动阅读；不以 numberOfLines 隐藏核对内容 |
| 短屏 + 键盘打开 | AddAccount、Settings 口令、Rename、ContactEditor、Request、dApp URL/Sign | 当前字段、错误、取消/提交有滚动访问路径；不出现无法收起/操作的嵌套滚动 |
| 多控制项与长列表 | Activity 多 active filters、AddAsset 多筛选/缓存提示、AddressBook 搜索 | 控制项不能把列表和必要操作永久挤出视口；滚动路径连续 |
| light / dark / 自定义深主色 | quiet/secondary、selected chip、危险确认、成功/失败/uncertain、错误文本 | 前景取决于实际底色；所有必要文字可读，不靠弱化 opacity 表达唯一原因 |
| Modal / Sheet + 2× | Rename/Delete、Privacy/Security consent、Passphrase、AssetCategory、NetworkSwitch、dApp detail/connect/sign、扫描 blocked | 标题到最后动作可达；safe area 内留白；已有关闭/返回语义保留 |
| 标准尺寸、1× 回归 | 正常账户页、Home、Activity、Settings、常用交易表单 | 不因大字体修复出现不必要空白、布局塌陷或按钮回调变化 |

## 9. 安全与范围边界

本 PR 修改 UI 容器、样式、完整文字展示和相应测试；账户/Signer 生命周期、network/account partition、Capability 权威、SDK/Core 密码学与敏感操作、exact-XDR/intent identity、提交/uncertain/recovery、fail-closed 和既有授权管线保持不变。

不将敏感材料新增到普通导航参数、Realm 或辅助样本；不修改生产 FLAG_SECURE 策略；公开 fixture 的 Activity 临时截图设置与受保护 Modal 的证据边界见 §6；不引入 donor 实现；不重新开启暂停的 automation；不把代码修复、CI 成功或布局辅助截图升级为全产品原生验收。Merge 仍由用户决定。
