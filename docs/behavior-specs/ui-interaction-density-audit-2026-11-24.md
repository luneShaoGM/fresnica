# UI 信息与选择交互清单 — 2026-11-24

## 范围与基线

用户要求再次检查项目 UI 的合理性，先列清单，再集中修改为一个 PR，完成后等待用户同意进入独立 Work Review。本轮目标是减少重复解释、将表单单选改为按需展开，并修正与当前功能不符的提示。

- GitHub / Mac 主工作树基线：`main@4b473360f103d47b67d5d17d84f017db09505fd3`，已包含 #231–#234 的相关 UI 修复。
- 复用现有 UI PR #235，开发起点：`ec749305ac93e708a9a296ef73a5213b366f6333`。其中 Send Step、卡片边距和重复 Available 已实现，不重复开发。
- 本轮在隔离工作区修改；不覆盖其他功能分支。最终 remote HEAD、实际验证和 CI 写入 PR。
- 规范：现有 Phase 2c / §14 呈现角色，以及 S01/S02/S04/S05/S07/S09/S10/S13/S14/S17/S22–S25 的已有页面。仅 Adapt Fresnica 当前实现，不复制 Stellar/Xaman 源码，不新增产品能力，不提升原生验收成熟度。
- 主要依据：`AGENTS.md`、产品信息架构、Architecture Style Guide、Product Traceability Ledger、现行 Behavior Specs 和 Provenance Rules。源码覆盖与原生验收分别记录。

## 开发前清单

下表在修改实现前建立。统一规则：表单有多个单选值时，默认显示当前值，点击展开，选后收起；选择页、管理列表和主要浏览分类继续直接展示。使用纯 UI `SelectField`，在父页面或现有 Sheet 内展开，避免嵌套原生 Modal。

| ID | 页面 / 已确认问题 | 修改计划 | 状态 |
| --- | --- | --- | --- |
| UI-01 | Send Step 说明、资产卡片边距、重复 Available | 保留 #235 原有修复 | 起点已实现 |
| UI-02 | Send / Request / 联系人编辑重复铺开五种 Memo 类型 | 复用同一单选控件；保留全部类型、同值不清输入、换类型原回调 | 已实现 |
| UI-03 | Request 将全部资产横向铺开 | 当前资产入口、展开搜索 code/完整 issuer；不伪造余额，不修改生成请求的数据源 | 已实现 |
| UI-04 | Activity 筛选将类型、资产、金额全部铺开，手动隐藏资产再次列满 | 三组单选按需展开；管理隐藏资产单独折叠；保留草稿/取消/Apply、全部/清除与 XLM 不可隐藏 | 已实现 |
| UI-05 | General 直接铺开三种显示货币 | 当前值 + 展开单选，原偏好保存和报价反馈不变 | 已实现 |
| UI-06 | Security 直接铺开四档后台锁定时间 | 当前值 + 展开单选；仍只修改待保存 patch，保留口令与 Save | 已实现 |
| UI-07 | Add Account 的 HD 恢复来源全部占据表单 | 复用展开单选，当前来源完整 public key / 派生 path 仍可核对 | 已实现 |
| UI-08 | Request 重复长 URI、非固定金额仍显示精度说明、入口解释实现流程 | 保留一份可选择请求链接；精度说明按模式显示；精简入口说明 | 已实现 |
| UI-09 | Swap 重复讲 unsigned Path Payment / exact-XDR / 自动报价实现 | 删除无操作帮助的工程解释、使用产品动作名称；保留到期/费用/滑点/完整审核事实 | 已实现 |
| UI-10 | Send 表单与结果页夹杂硬编码英语和内部签名/路线图术语 | 本地化正在修改的标签与结果文案；保持 submitted/uncertain/rejected 和完整交易身份 | 已实现 |
| UI-11 | Accounts 重复标题说明、AccountDetails 常驻 Account-Signer/Capability 教程 | 删除冗余与内部架构段落，保留账户身份及隐藏/删除限制 | 已实现 |
| UI-12 | About 展示硬编码 Runtime 和 Native SDK/Compatibility 实现说明 | 精简为品牌及真实产品信息，并本地化保留标签 | 已实现 |
| UI-13 | Onboarding 口令教程重复、入口副标题使用 Core/signer 术语 | 保留已有口令指导、强度/匹配反馈和必要风险，精简重复段落与操作副标题 | 已实现 |
| UI-14 | Pending Backup 重复解释 Core 恢复步骤 | 一次说明输入口令继续备份；保留短语顺序与离线保管提示 | 已实现 |
| UI-15 | Change Passphrase、Security、Recovery 的五个安全输入只有读屏标签，缺少可见标签 | 补齐当前/新/确认口令可见标签；不改变敏感输入和清理机制 | 已实现 |
| UI-16 | Language 无条件提示当前语言回落英语 | 仅当前语言实际回落时提示；完整语言选择列表保留 | 已实现 |
| UI-17 | Advanced 重复 Network 标题、无功能 Change log、普通模式暴露 Session ID | 去重复/无操作占位；Session ID 与日志归入现有 Developer Mode 区域 | 已实现 |
| UI-18 | dApps 列表仍声称无法打开/连接；URL 输入标签重复 | 删除过时说明和重复标签；签名口令说明改为适用于交易/消息的当前政策；保留 origin、外部网站/权限/签名风险 | 已实现 |
| UI-19 | Home 未激活说明多段编号、资产详情重复解释标题、池仓位说明暴露内部术语 | 简化行动提示与池仓位数量；消除资产详情双刷新入口；AccountPicker 网络语境确认有用而保留；激活失败、缓存、只读与可用性原因保留 | 已实现 |

### 选择交互细节

- 重新选择当前值只收起，不触发变更或清空关联输入。Activity 的类型通过“全部”、资产通过“全部资产”、数量通过“不限数量”显式清除；方向和比较方式仍可再次点击取消。
- 资产搜索匹配代码与完整发行方；同代码不同发行方继续是不同值。既有筛选资产暂时不在加载列表时，保留其当前身份，避免显示为无筛选。
- 关闭、禁用、卸载、选项删除后的旧选择回调不会生效；状态是局部呈现状态，不保存或传播敏感材料。

## 已检查并保留

| 范围 | 检查表面 | 保留原因 |
| --- | --- | --- |
| 主壳 / Home | MainTabs、Actions、Home、AccountSummary、InactiveAccountPanel、AssetDetailsSheet、AccountPicker、AssetCategoryDialog | 账户和资产是主内容；固定 XLM、余额拆分、Actions 快捷入口与已合并布局继续保留 |
| Activity | Activity、Filters、OperationDetails、参与方卡片 | 完整 issuer/address/Memo/hash 和失败/uncertain 事实属于核对信息；详情已有按需展开 |
| 交易 / 收款 | Send Form/Review/Result、Request Form/Ingress/DeepLink、Swap Preview/Result、Claimable、Markets | 审核事实、订单风险、不可逆行为、报价到期、恢复提示不因减少文字而隐去；两项模式切换继续并排 |
| 资产 / 联系人 | AssetPicker、ManageAssets、AddAssetSheet、AddressBook、ContactEditor、DestinationPicker、Scanner | 主列表/多选来源继续直列；联系人名称不代表认证身份、权限失败/重试说明保留 |
| dApps | Catalog、Details、Browser、Connected、Connect/Sign sheets、ActionsFeatured | 分类是浏览导航；保留隐私同意、准确 origin、权限期限、签名和网络核对 |
| 账户 / 安全 | Accounts、Add/Details、Onboarding、Pending/Mnemonic Backup、Unlock、Security、Recovery/ChangePassphrase | 备份/弱口令/揭示密钥/截图/删除等必要风险保留；恢复 signer 列表的清理与授权流程不改 |
| 设置 | Home/General/Language/Theme/Privacy/Advanced/Network/About/Terms/Logs 及 NetworkManagement | 语言/主题是独立选择页，节点是管理对象；Terms 未提供正文的事实提示保留 |
| 无生产引用遗留 | WalletReadyScreen、旧 AssetDetailsScreen | 阅读并记录，不当作现行 UI 修改或验收 |

暂不扩展恢复材料的账户导航、Markets 的风险文案结构或交易结果状态机。本轮不改变 Capability/SDK/Realm、网络/账户隔离、exact-XDR、授权、uncertain/recovery 或后台清理语义。WalletConnect、M 地址与 Automation V2.2 的冻结决策保持。

## 验证计划与交付边界

- 共享选择控件：展开/收起、取消不改值、选择一次、同值保留、禁用、搜索空态、完整身份与主题/大字布局。
- 页面定向回归：Memo 三处、Request 资产与 URI、Activity 草稿取消/Apply/隐藏资产、General 保存、Security patch/口令取消、HD 来源身份。
- 执行 TypeScript、相称的 Jest、ESLint、architecture、locale、provenance 与 `git diff --check`；按仓库 CI 必需门执行完整检查。
- 如使用公开固定数据的 Android 布局辅助场景，明确单列为 helper 观察，不称为原生产品流程或真机验收。
- 正式独立 Work Review 等用户同意。不得自行 Merge；Stage 9 iOS 真机 System Auth 取消/重试继续延期。

## 实际结果

本轮清单 UI-01–UI-19 均已落实；UI-19 调查确认 AccountPicker 的当前网络说明有必要，因此保留。代码改动限定在呈现、三语言和直接测试，没有修改 Capability/Platform/SDK/Realm 或原生配置。

| 验证 | 实际结果 / 边界 |
| --- | --- |
| `npm run check` | 完整退出码 0；314 Jest suites、3202 tests 通过，10 项既有跳过；Node repository tests 3 项通过 |
| TypeScript / ESLint / architecture / aliases / 格式 / native patch / artwork | 通过；ESLint 0 errors、79 warnings；smoke 脚本检查不是执行产品流程 |
| locale / provenance / diff | 三语言 1437 keys 对齐、0 未批准 donor collision、`git diff --check` 通过 |
| 交互定向 | SelectField + Activity 草稿/取消/Apply/数量筛选测试通过；Memo / Request / Settings / HD / 安全输入生命周期的既有回归通过，已包含在全量数字中 |
| Android 布局辅助观察 | 尚在准备，未记作通过；最终实际覆盖与证据另列 |
| iOS / 真机 / 原生产品流程 / TalkBack / VoiceOver | 本轮未执行；既有验收缺口继续保留 |
| 独立 Work Review / Merge | 尚未进行，按用户要求等待同意后再 Review；无开发方 APPROVED 声明 |

这份清单不是独立审查证据。GitHub 当前 exact remote HEAD、CI 实际 steps 和 Work 的后续结论才决定该 PR 的审查状态。
