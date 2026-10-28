# Fresnica Mobile 完整重写执行清单

> 修订：2026-10-28；核对基线：GitHub main `b96d2e997ff83b41eaa31bbea941750f1186441b`。
> 本文件是唯一执行入口和当前任务队列。原 Stage 计划保留历史和范围理由，不另排实时顺序。
> 本次只调整计划，不修改功能、不停止或覆盖在途 Swap/dApp 工作，不升级原生验收状态。

## 1. 旧计划评估

旧计划有广泛产品范围，但**尚不能证明逐元素完整，也不是可靠的当前执行清单**：

- 本文件与 execution-plan 同时声称拥有施工顺序，历史证据和旧阻塞混入当前状态。
- S09/S10 等 ledger 行停留在 L0/机制阶段，代码已推进；#124 已合并，进度仍写候选/待审。
- Advanced 在规格中必达，实际仍为占位；网络门控实现被口头表述成 Developer Mode 整体完成。
- 缺少固定参考版本的页面/步骤/overlay 清单、逐控件差异与任务绑定。
- SDEX 已在范围内但无独立稳定产品 ID；不能算进 Path Payment Swap。

本修订给出全范围任务、依赖、并行安排、交付和验收要求。**没有声称本次已经人工核对所有 Stellar 控件。** 路径清单只防表面遗漏；逐元素/操作/逻辑审计属于 R00 的持续交付和每个产品包的开工/退出条件。

## 2. 文档权威与完成口径

| 文档 | 职责 |
| --- | --- |
| 本文件 | 全部任务、当前状态、执行顺序、并行依赖、下一步 |
| [产品指南](stellar-product-information-architecture.md) | 功能范围、Adopt/Adapt/Exclude、页面分组、§8/§9/§14 完成合同 |
| [参考表面清单](stellar-surface-coverage.tsv) | 固定参考 screens 全部非测试 TSX/JSX 路径/blob、S ID、R 任务、逐元素核对状态 |
| [产品追踪账本](product-traceability-ledger.md) | 稳定 S ID、成熟度和证据；为既有 SDEX 范围追加 S31 |
| [原执行计划](fresnica-mobile-rewrite-execution-plan.md) | 历史阶段、架构理由和历史证据，不是第二条当前队列 |
| behavior-specs / 验收记录 | 字段、状态机、Capability 边界、异常分支及对应测试/设备证据 |
| GitHub 与当前源码 | 实际合并、HEAD、CI、Review 和实现事实；与文档冲突时校准文档 |

状态分别记录：待调查、规格明确、实现中、PR/审查、已合并、原生验收待完成、产品验收通过。阻塞附在具体任务/依赖上，不用“完成百分比”掩盖它。

每项分别记录：**代码合并 / 入口实测 / 自动化 / Android 原生 / iOS 原生 / 无障碍**。未验证填未验证；helper、JS bundle、CI、skipped heavy job 不代替产品操作。沿用 L 成熟度定义。

## 3. 当前基线与在途工作

| 工作线 | 核对事实 | 接续任务 |
| --- | --- | --- |
| 共享网络/安全 | #122/#124 已合并；#124 reviewed HEAD `6fcb2fae5a2a176c81c05548a5344454c8e45319` APPROVED，两项 P2 已解决；CI 162 suites/1305 tests | R01/R02 正式设置入口和原生闭环；不重写已有门控 |
| Swap | #118–121 已合并，已有 quote/review/sign/submit/recovery、Max/滑点/路由等改进 | R03 接续在途改动；直接复验 #124 影响的网络/账户/报价身份，不能据旧 L1 重做 |
| dApp 目录 | #123 OPEN，核对 HEAD `5376c012f3678c50c37c269a6d9e45cc31fc75f6`，未合入 main | R04 接续，网络分区缓存/组合根与 #124 对齐；HEAD 改变后重审 |
| dApp 浏览器/权限 | 主工作区有未提交实验，不算已合并交付 | R05/R06 登记已有改动后继续安全闭合的用户流，不删除或覆盖 |
| 本地运行 | 主工作区核对时在 `dd5574a75ec5485a549448c4b4fa50ce35d744a3` 且有大量 dApp 修改 | R00/R01 记录构建来源/安装版本/入口；不直接 reset/pull 覆盖该目录 |
| 自动化/旧 PR | #78 暂停；#14/#25 不能自动算当前依赖 | 不恢复 Controller/worker/label 流；旧 PR 是否已被取代须另核对 |

以上是时间点快照。每次开工重读远端；本计划不冻结正在前进的 PR HEAD，不要求 Swap/dApp 返回历史阶段起点。

## 4. Stellar 同步范围与完整性门

参考固定为 `luneShaoGM/Stellar@bd0f4540b2496a57314e4e29bc6fcf8ff691b60f`，与 provenance 基线一致。本次读取完整 Git tree（未截断）。参考版本变化必须记录树差异与新任务映射，不能默认为已覆盖新版。

同步的是**页面结构、功能元素、操作、业务逻辑、共享交互、异常与恢复、生命周期、持久化、语言与可访问性**。保留 Fresnica 品牌、SDK/Capability 安全权威；不是复制源码/资源或逐像素复刻。XRPL/Tangem/IAP/Realm Viewer 等既定排除项不因目录存在自动进入范围。

每个 adopted/adapted 表面在实现前补齐以下元素与行为表，实际差异在所属包验收时关闭：

| 字段 | 必须记录 |
| --- | --- |
| 参考 | 固定版本路径、用户可见角色、共享组件/协议/生命周期依赖 |
| 元素 | 标题/提示/字段/列表/余额金额/按钮/开关/菜单/弹层/图标语义/读屏名称 |
| 操作 | 输入/选择/点击/长按/扫码/确认/取消/系统返回/关闭/重试/防重复 |
| 逻辑 | 校验、enabled 条件、鉴权/权限、精度、状态迁移、链上/服务端权威 |
| 边界 | loading/empty/error/offline/timeout/stale/busy，后台/重入/账户网络切换/重启；写路径含 uncertain/recovery |
| 落点 | Fresnica 页面入口、Capability、Platform/SDK；Adopt/Adapt/Exclude 和理由 |
| 证据/结论 | 代码/双端产品操作/无障碍，已对齐/缺失/适配/阻塞/排除；缺口绑定 R/S |

清单含步骤、widget、overlay、模板，**不能把文件数量当页面完成数量**。screens 之外的组件、Freighter、系统权限、locale、AppTheme 和服务角色由指南 §2.1/§14、R15 继续覆盖。尚未人工核对元素的行保持待核对，不批量宣称完成。

## 5. 全范围可执行工作包

R 是执行包；S 是稳定产品 ID。每包可按安全边界分多个完整切片，不强制一行一个 PR。Owner 是功能责任，不代表创建新的 Codex 会话。

| 包/Owner | S ID | 页面元素、操作及逻辑范围 | 前置和退出条件 |
| --- | --- | --- | --- |
| R00 计划/集成 | 全部 | 固定参考清单、逐元素差异表、当前源码/PR/分支/运行构建、缺口/责任映射 | 先交付清单和三条在途线登记；各包继续补元素证据，缺口不能只留聊天 |
| R01 设置/导航 | S23/S24/S25/S26 | Settings 分组；General/Advanced/Security/语言/账户/地址簿/支持/条款/About 入口与返回 | 复用现有实现；符合指南 §7.5；指定构建实际点击可达，未实现项诚实标记，不导向错误页面 |
| R02 Network/Application Security | S04/S24 | 模式警告/口令/取消/错误/重试；节点列表/当前节点/健康/添加/测试/选择/删除；关闭回 Mainnet；遗留分区和最后账户删除 | 依赖 #124/R01，补直接缺失证据；双端验证持久化/离线/后台取消/旧会话失效/原 hash 恢复；无 signer 不伪鉴权 |
| R03 Swap | S10 | 资产对/方向、Pay/Receive/Max/精度、strict send/receive、报价/路由/滑点/过期/重新报价、exact review/授权/提交/结果 | 接续 #118–121 和在途切片；账户/网络/输入/资产变更失效旧 quote/XDR；取消/失败/uncertain/restart 不重复交易，补缺失双端聚合证据 |
| R04 dApp 目录 | S14/S15 | FChain/分类/搜索/icon/Home/Recent/刷新/缓存/离线/custom URL/disclaimer/重复进入/取消 | 接续 #123；网络分区缓存对齐 #124；目录不等于可信 origin，OS 外部浏览器不等于内嵌桥 |
| R05 dApp 浏览器/权限 | S16/S17/S21 | WebView/origin/导航/重定向/返回/关闭、权限范围/撤销/Connected dApps、device/share/data 命令 | 依赖 R04 输入边界；原生依赖重建；iframe/origin变化/后台/重启/切网不能沿用失效授权；无许可不读账户不签名 |
| R06 dApp 请求/签名 | S18/S19/S20 | Freighter 账户/网络/交易请求及逐操作审阅、SEP-53 消息、Soroban auth entry、拒绝/取消/并发/重复 | 依赖 R05；每类核对 SDK/Capability，复用标准交易与恢复；S20 安全交付缺口只阻塞 S20，不伪造能力 |
| R07 账户/备份 | S01/S02/S28 | onboarding/setup/create/import/watch-only/HD/hardware 入口，备份说明/验证/继续，选择/默认/排序/标签/隐藏/删除/空分区 | 复用账户生命周期；原网络 pending backup、pending 删除保护、无 visible account、restart、共享 signer 不变量成立；硬件执行归 R17 |
| R08 安全维护/应用锁 | S03/S04/S27 | 助记词/secret 揭示、修改 App Passphrase、System Auth 注册/修复/关闭确认、自动锁定/解锁、截屏/隐私 | fresh auth/失败/取消/重试；秘密不进入普通 JS State/Realm/导航；generic System Auth challenge 独立上游阻塞，enrollment/dummy sign 不当解锁 |
| R09 Home/资产/Trustline | S05/S06/S30 | 账户/主操作/资产类别/余额/可用额/解释、inactive/Friendbot、资产发现/详情/风险/TOML/icon、Add/Limit/Remove | 复用 Balance/Trustline；metadata 非账本权威；reserve/liability/issuer/LP检查、提交后重读、offline/stale 区分；LP/claimable 不当普通代币 |
| R10 Send/目的地/通讯录 | S07/S08/S22 | 地址/扫码/粘贴/联系人、Classic/CreateAccount/muxed、金额/memo/fee/风险提示、review/授权/结果、联系人增删改选 | 核对 destination/muxed 契约；S08 缺能力只阻塞该分支；精度/身份/只读/多签/硬件失败、uncertain/restart/返回路径通过 |
| R11 Request/系统输入 | S09/S27 | 公开身份/金额/资产/memo/QR/分享、相机/相册单QR、Deep Link/SEP-7/Decline、权限/取消/重复交付 | 复用已有 parser/router；冷/热启动/后台/账户网络不匹配/分享失败无误操作；核对 HomeActions 扫描，不能据旧 L0 重做 |
| R12 Activity | S13 | 下拉/分页/搜索/当前加载集过滤、empty/error/cache/offline/Retry、operation families/金额/参与者菜单/Explorer/detail | 复用证据；只补缺失 iOS 真实 Retry→page1→cold restart 与新增 operation family；cache 非完整历史，helper 不代按钮 |
| R13 Claimable/LP/SDEX | S11/S12/S31 | claimable 列表/风险/详情/claim、LP列表/详情/withdraw、独立SDEX订单列表/详情/创建/撤销 | 三类独立语义切片；先核对 Capability；reads/writes分别过门，写路径复用 exact review/sign/submit/recovery，SDEX不算Swap |
| R14 设置/内容/诊断 | S23/S25/S26 | General语言/法币/触感/系统外观/主题/图片色板、About/ChangeLog/Help/Terms/Credits/支持、Session Logs/开发者工具 | 依赖 R01；重启持久化/全App重绘、日志脱敏/导出失败取消；内容缺失标待提供；Realm Viewer/IAP保持排除 |
| R15 横切运行时/数据 | S04/S23/S24/S27 | modal/picker/alert/help/Vault角色、键盘/手势/返回、safe-area/statusbar/locale/精确数字/日期时区、AppState/剪贴板/权限/cache/前台读/错误 | 指南 §2.1/§14；核对 LC1–LC6 与旧证据，只补受影响缺口；禁止第二套服务/签名管线；随各包推进，不等最后才做 |
| R16 通知/Backend | S14/S17/S24/S27 | 前台事件/本地通知、权限/系统设置/点击路由；目录/权限/节点 Backend、远端推送/可信发送者/token生命周期 | Backend非当前主线；先端口与诚实 unavailable/degraded；无可信协议不开远端载荷或自动签名，不能阻塞独立本地钱包/Swap |
| R17 Hardware/外部 signer | S28 | 添加/发现/连接/超时/取消/设备拒绝、账户标识、review→设备签名→SDK验证应用→提交 | 指南 §7.7 Ledger BLE 候选矩阵，按 provider/device/transport/OS/固件真机证明；未测不称支持；不搬Tangem/PIN/secret-number |
| R18 发布/聚合 | 全部，重点S04/S24/S27/S29 | app identity/legacy检测、无静默导入旧数据、release签名/安装升级、隐私/法律/SBOM/provenance、关键用户流/无障碍 | adopted表面与横切均有结论；Stage9 iOS真机SystemAuth取消/重试单列；未关发布阻塞不称完整重写/可发布 |

## 6. 设置作为完整产品包

R01/R02/R08/R14 共同闭合设置，不再用一个 Developer Mode 按钮的交付代表整个设置完成。

| 分组 | 必须覆盖的元素与行为 | 责任 |
| --- | --- | --- |
| Settings 根 | Accounts/Address Book/General/Security/Advanced/支持/Terms/About，副标题/可用状态/返回 | R01；实际点击去向，General 不能替代 Network |
| General | 语言/法币/主题/系统外观/触感/图片色板 | R14；缺能力诚实状态，持久化和全App更新 |
| Security | App Passphrase/System Auth/自动锁定/隐私截屏/Connected dApps | R08/R05；每项独立鉴权/确认/失败政策，不以页面位置代替权限 |
| Advanced | Developer Mode/网络节点/Session Logs/开发者工具 | R01/R02/R14；模式fresh口令；节点原子提交，后台取消不生效；工具逐项限定 |
| 特殊入口 | 首次遗留网络确认/待备份/无signer/最后Testnet账户删除/pending恢复 | R02/R07/R08；不死锁、不扩大保留例外、不默许跨网新钱包 |
| 全组 | i18n/字体/读屏/busy/错误取消重试/重启 | 对应包分别记录双端证据，配置单测或单张截图不代表全组 |

## 7. 顺序、并行与在途工作接入

不要求所有基础设施“封板”后再继续 Swap/dApp。三条在途线保留，可并行开发，共享文件和集成顺序串行协调。

| 波次 | 基础/集成线 | Swap线 | dApp线 | 出口 |
| --- | --- | --- | --- | --- |
| W0 立即 | R00固定基线、登记构建/变更/覆盖、清理文档权威冲突 | 继续既定S10切片，登记branch/HEAD/范围/证据 | 继续#123/既定browser切片，同样登记 | 在途工作均有R/S归属，不丢弃未知修改 |
| W1 当前 | R01→R02正式设置/模式节点闭环；R15仅修直接阻塞 | R03当前闭环和#124直接影响验证 | R04对齐最新会话/缓存；R05可并行规格与安全闭合实现 | 按实际依赖选合并顺序，不强迫等待全部设置完成 |
| W2 接续 | R07–R12复用证据补差；R08上游缺口单列 | 关闭剩余S10聚合差异，不扩成SDEX | R05→R06按请求类型开放 | 钱包核心流和具体dApp请求子集可复查，未实现请求拒绝 |
| W3 剩余产品 | R13/R14/R17，R15持续核对 | 直接回归 | 已有安全子流/内容完善 | adopted表面逐元素有结论，阻塞保持显式 |
| W4 发布 | R16远端部分具备条件再接，R18聚合 | 必要集成验收 | 同左 | 未关闭发布阻塞不宣称可发布 |

- feature/spec/test 由各线继续；共享组合根、导航、鉴权、network/account偏好、Realm schema 变更先登记并协调。同一共享文件不叠加互不知情的设计。
- 先合入的共享变更成为其他线基线；后合入者处理冲突，只复验直接受影响范围，不反复重跑全部历史验收。
- 仅实际缺失的安全依赖阻塞其消费者；“计划还有待办”不是停工理由。
- 新缺口先映射R/S，新增产品行为才追加S编号；不能随手补一按钮而不更新用户流。
- 本次不向其他任务发送消息，也不创建/暂停任务。正在开发的工作区没有被修改。

## 8. 每次任务的执行卡与退出条件

开工先填写，由 Chat 推进到可审查结果：

1. R/S ID、用户闭环/owner、当前main/branch/local和remote HEAD/working tree/PR/base。
2. 参考表面、元素行为表、具体差异、Adopt/Adapt/Exclude理由。
3. 依赖、允许修改范围、共享文件冲突与集成顺序。
4. 正常/取消/失败/超时/重试/后台/重启/账户网络变化；写路径附exact-XDR/uncertain/recovery/防重复。
5. 定向自动化、可复用旧证据、需执行的双端/无障碍、未执行/阻塞。
6. commit/push/PR→exact-HEAD独立Work review→修P1/P2→新HEAD复审；用户决定merge。
7. 合并回写当前状态和ledger证据；入口与设备验收单列。

R00 的本次计划交付：全S范围可排程、参考screens无未分配行、三条在途线有接续安排、权威冲突消除。**逐控件人工对齐和设备验收是后续各包的硬退出条件，不能冒充本次文档已完成它们。**
