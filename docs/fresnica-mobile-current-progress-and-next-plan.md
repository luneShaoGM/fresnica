# Fresnica Mobile｜当前基线与执行队列

> 基线更新：2026-10-28（Asia/Shanghai），保留原章节与第 4 节五项依赖队列。GitHub main、当前源码和 exact-HEAD Review 为事实源；本文件是执行索引。实现、审查、合并、自动化验证、原生验收分别记录，不能互相替代。

## 1. 集成基线

- 当前核对基线：`main@651bf7b9eceff4f004bcebbba9de6e7e224c383e`，已包含 PR #122、#124 网络基础、#123 FChain 目录/分区缓存及 #126 Swap 入口/路由统一。
- #122 的独立 Work Review 核对 `f83195bd00453372c90d3ac0b2038a26dc1350b4`：APPROVED，P1/P2/P3 为零；CI check 为 155 suites / 1260 tests。只证明自动化范围，S24 原生验收仍未执行。
- 最近已合并：#111–116 生命周期/缓存/读取恢复，#117 资产弹层，#118 Swap 输入与结果，#119 双向金额与自动报价，#120 路由/滑点，#121 live spendable / Pay Max，#122 连接健康。每项合并不自动升级产品成熟度。
- PR #123 已合并为 `1c67467254d11e536b10113a8823d54ba2d632d2`，并包含在当前 main；合入前 HEAD `ba9fbf6b4c46b36834510da69d8ae5b7bd530aa6`。FChain catalog 与 network-scoped Realm cache 已交付代码；不代表受信浏览器、权限或签名完成。原生证据仍单列。
- 开放旧 PR：#78 Automation V2.2 暂停；#14 / #25 历史分支，不作为新工作基线。

## 2. 本地工作与事实边界

| 工作 | 已核实状态 | 处理 |
| --- | --- | --- |
| 主目录 `fresnica` | 2026-10-28 15:44（Asia/Shanghai）核对：`stage7/s15-inapp-browser-freighter-2026-10-28@4a7cb70c3e7128c6f622d58c24f0a319d6f1b1b9`，local HEAD、upstream 与 GitHub branch HEAD 一致；已推送、未合并，核对时没有对应开放 PR；另有在该提交之后继续产生的未提交修改 | 将已推送 S15 候选与后续工作树修改分开盘点；二者均不能算 main 或产品交付；不得 reset/clean/覆盖，开工时重新核对动态状态 |
| dApp 集成目录 | #123 已合并；本地与远端是否继续有新改动在每次开工核对 | 复用已合入目录/缓存；浏览器/权限/签名继续按原任务 5 推进，不重做 #123 |
| Swap | #118–121、#126 已合并；旧工作目录仍保留 | 继续原任务 4，在最新 main 接续；#126 的入口/路由改进不重做，聚合原生验收仍单列 |
| Network | #122/#124 已合并；模式鉴权、偏好、节点管理、会话切换及两项 P2 修复已进入 main | 原任务 3 仍需正式设置入口、直接相关双端原生流和无障碍证据，不以底层实现代表整项产品完成 |
| 本轮基础建设 | #124 已合并；最终 reviewed HEAD `6fcb2fae5a2a176c81c05548a5344454c8e45319` APPROVED | 原任务 1/2 交付、3 代码合入；产品入口/原生验收单列，其他工作区继续保留 |

状态边界：#125 独立审查时上述 S15 工作区为干净；本次 15:44 复核已观察到后续未提交的浏览器/权限/签名与 Realm 等改动，不能沿用“持续干净”，也不能把已提交的浏览器候选仍写成旧未提交原型。本索引未修改该工作区；旧 WIP 是否另有备份、是否已全部纳入候选尚未核实，不推断其已清理或全部交付。

## 3. 产品覆盖与证据账本

| 范围 | 已实现/已有证据 | 未完成/阻塞 |
| --- | --- | --- |
| S01/S02 账户与 Signer 生命周期 | Create/Import/HD、备份验证、选择/排序/隐藏/删除；历史双端子流程证据 | 可重复聚合 gate、动态字体/读屏等；既有未受影响证据不重跑 |
| S04 共享安全 | System Auth 注册/修复/关闭；交易 routine 与 fresh-passphrase 策略；Native verification-only 口令验证 | 应用解锁缺 generic System Auth challenge；#124 敏感设置鉴权已审查合并，原生验收与设置入口仍待闭合 |
| S05/S13 数据生命周期 | #111–116 的分区缓存、Effects、节点恢复和提交后读取收敛 | LC6 原生聚合、历史 iOS Activity 真正离线 Retry 证据仍需逐项核对，helper 证据不算产品验收 |
| S07/S30 Send/Trustline | exact-XDR、授权、提交/uncertain/原交易哈希恢复；历史子流程验收 | Stage 9 iOS 真机 System Auth 取消/重试延期；必要无障碍/可重复验收未封板 |
| S09 请求与系统入口 | 已有 QR/Share/Deep Link/Photo QR 和生命周期接线 | 相机/相册权限与真实输入、取消/重复交付/后台入口等聚合证据按当前验收记录核对；不以旧 L0 行判断当前源码 |
| S10 Swap | quote/review/submit/recovery 与 #118–121 的输入、路由、滑点、Pay Max 改进已集成 | 完整原生产品流、取消/账户网络变更/uncertain 恢复等聚合验收未封板 |
| S14–S21 dApp | main 已含 #123 FChain 目录/分区缓存及外部链接基础；S15 浏览器/Freighter 候选 `4a7cb70c3e7128c6f622d58c24f0a319d6f1b1b9` 已推送，另有后续未提交修改，详见第 2 节 | 候选未合并、没有对应开放 PR，后续修改也非交付；origin、权限/撤销、各请求与标准签名管线仍需独立审查和分项验收；Soroban 等独立上游缺口保留 |
| S24/S25 网络与开发者工具 | #122/#124 健康/Retry、模式鉴权、网络偏好、节点管理、统一会话已合并 | 按指南 §7.5 对齐 Advanced/General/Security 入口；模式/节点双端产品验收、日志和开发者工具仍分项未完 |
| S03/S06/S08/S11/S12/S22–S29 其他范围 | 以 ledger 与代码为准，部分只有机制或角色 | 不因当前三条功能线而删除；muxed/hardware/Soroban/发布身份等各自依赖继续保留 |

## 4. 依赖队列（本轮用户确认）

| 顺序 | 任务 | 退出条件 |
| --- | --- | --- |
| 1 | 校准基线与未提交工作 | 当前 main、PR、分支、工作树及事实边界明确；过期阻塞叙述纠正 |
| 2 | 共享鉴权基础设计 | 区分交易授权、应用会话解锁、敏感设置鉴权；SDK/Capability/UI 权威和 cancel/failure/retry/失效条件明确 |
| 3 | 网络会话与节点管理 | Developer Mode 门控；偏好持久化；节点增删/测试/启用/当前节点删除回退；切换使旧任务失效并重建全部网关；账户与恢复记录保留；关闭先恢复 Mainnet |
| 4 | Swap 聚合收口 | 仅补当前主线直接影响的报价→review→授权→提交→恢复与原生证据 |
| 5 | dApp 敏感操作闭环 | 权限/撤销/请求→标准签名管线；只读目录可作为独立并行线 |

**五项状态补充：** 1 已完成本轮基线校准、仍需随合并维护；2 鉴权设计已交付、应用锁上游缺口未消失；3 代码已合并、入口/原生验收未闭合；4 Swap 已在推进，接续现有切片；5 dApp 继续推进，#123 目录/缓存已合并，浏览器/权限/请求按实际依赖接续。保留上述任务编号与退出条件，不用另起一套工作包替代。

阶段编号仍是产品覆盖/验收分类，不再把历史 PR 推荐清单当实时队列。本节是当前执行顺序；后续开工从第一个具备前置条件的任务开始。任何无法实现的依赖标明阻塞与安全边界，不能伪装完成。

## 5. 并行与遗漏控制

- 最多一条共享基础主线，加一条不依赖未完成基础的功能线。导航组合根、共享鉴权、网络会话和持久化边界由基础主线统一处理。
- 每个任务记录 S ID、依赖、交付物、自动化/原生验收、未测/阻塞、下一步。新发现缺口回填所属 S 行；只有当前阻塞或明确安全问题立即扩入当前切片。
- 文档职责：本文管当前顺序；execution plan 管完整覆盖；traceability ledger 管 S ID 与证据；behavior spec 管行为和验收。旧历史记录保留日期，不用历史结论覆盖当前实现。
- PR → 必要 CI → exact-HEAD 独立 Work Review → 修复 P1/P2 → 用户决定 Merge。不得自行 Merge。Automation V2.2 保持暂停。

## 6. 本轮前三项交付状态（#124 已合并，产品验收单列）

1. 基线校准完成：核对 main、最近合并 PR、dApp 候选和独立目录；纠正旧口令验证阻塞叙述。工作区继续变化，当前提交/推送/未提交边界以第 2 节带时间的复核为准。
2. 共享鉴权设计完成：[行为契约](behavior-specs/shared-auth-network-session.md)，明确交易授权、应用解锁和敏感设置鉴权；原生通用 challenge 仍缺失。
3. 网络会话与节点管理代码已审查合并，正式入口/原生验收尚未闭合：fresh App Passphrase 开启模式、HTTPS 节点校验/增删/测试/选择、当前节点删除回退、关闭先返回内置 Mainnet、持久化和不可变服务会话。旧钱包进入显式网络选择门控，不静默切网；待确认交易和签名/广播保护保持有效。

最终 #124 reviewed HEAD 的 CI：`npm run check` 162 suites / 1305 tests，lint 0 errors / 31 既有 warnings。此前开发方 real-Realm 3 tests 和辅助双端 JS bundle 为各自范围的历史证据，不等于新 HEAD 的原生构建或产品验收。独立复审记录见 [PR #124 评论](https://github.com/luneShaoGM/fresnica/pull/124#issuecomment-6459038853)。

已完成：#124 当前合入 HEAD 的 CI 与独立审查；#123 已适配不可变 network session 并合并。待完成：正式设置分组/入口、Android/iOS 模式与节点产品流、无障碍、通用应用生物解锁、Developer Session Logs、Stage 9 iOS 真机 System Auth 取消/重试。S24 不升级 L4；不把“前三项代码交付”写成全部产品验收完成。

### 原任务 3：设置与网络收口候选（2026-10-28）

- 从上述 main 新建 `feat/settings-network-closure-2026-10-28`，独立工作目录开发；未修改主目录中的 dApp 工作。此候选尚未合并，不能以它更新 main 的交付状态。
- 按 Stellar 固定参考核对后，设置根页分别进入 General/Advanced/Security。General 接已有语言页；Advanced 放置风险提示→fresh App Passphrase 鉴权的 Developer Mode 开关和 Network 入口；Network 复用已合并的节点管理/健康/会话能力。初始网络选择保留必要的组合入口。
- [行为与逐项证据](behavior-specs/s23-s24-settings-network-closure.md)。自动化通过；Android 独立验收包的实际路径与限制在该规格单列。iOS、读屏、完整自定义节点原生矩阵仍待验收，不升级 S24 至 L4。
- General 完整偏好、版本/设备信息、Session Logs 和开发者工具依旧明确未实现。通用应用锁及 Stage 9 iOS 真机延期不变。原任务 4/5 的 Swap/dApp 在途工作继续保留，不重排五项队列。
- #129 后续修正（2026-10-29）：针对用户 Android 切测试网白屏，调整导航退出与 Realm 释放顺序；节点页按固定参考改为分组行和弹窗确认。六次连续切网通过，最终布局补验与限制见上述行为规格。
- 下一步：该候选更新 PR、CI 与新 exact-HEAD Work Review；由用户决定合并。以下 #124 记录是本候选之前的历史审查。

## PR #124 审查修复

- 旧 HEAD `41ade33bdb5dbc96e59f50e491d11dfef727e822`：Work NEEDS_FIX，P2 1（已有 Testnet 只读/外部 signer 钱包被首次网络选择阻挡）。
- 修复：已有 Testnet 分区可显式选择内置节点并持久保留访问；不启用 Developer Mode，不开放自定义节点，不创建/导入无关 signer。新钱包默认和原有交易/恢复隔离保持不变。
- 最终 HEAD `6fcb2fae5a2a176c81c05548a5344454c8e45319`：Work APPROVED，两项 P2 均已解决；#124 已合并。原生验收仍未执行。以后有新代码仍须新的 exact-HEAD review。

## 7. 同名文档差异与原任务保留（2026-10-28 核对）

主工作区同名文件含 10 月 15 日历史章节及 10 月 21 日覆盖更新；main 是后来的五项依赖队列；PR #125 初稿曾整体改成新工作包并调整文档权威。用户指出不一致后，本修订撤回该替代结构和权威变更，保留 main 原章节/五项编号，只更新事实并追加核对表。

上述同名文件差异和旧未提交原型是历史核对记录，不代表当前主工作区仍在旧分支；当前 S15 已推送候选及后续未提交修改见第 2 节。不覆盖未知修改，不把历史 FAIL/OPEN/阻塞直接当当前事实。以下明确保留原清单的具体未完成事项；先核对实际证据，再更新状态，不得因缩写成 S 范围而丢掉细项。

| 原清单事项 | 继承位置/下一步 | 证据边界 |
| --- | --- | --- |
| UI-01～UI-05 已迁移的原语/页面 | 保留 UI 编号，查 `ui-native-consumer-integration.md`；不重新迁移已合并控件 | 代码合并与原生 UI 验收分开 |
| Send Review、Memo/资产、Request Continue/分享/扫描等剩余 UI 边界 | 沿 UI-05 原任务，核对逐项消费者/行为；与所属 S07/S09 切片一起验收 | 不混入无关鉴权/交易重构，不按单按钮机械拆 PR |
| UI-06/UI-07 后续 dApp 页面及双端聚合 | 随原任务 5 接续，再完成 UI 聚合 | 字体/点击/主题/对比度/读屏/焦点与 Settings 滚动指示条继续保留 |
| S09-06 Android 分享取消/重试 | 保留原 ID，核对新构建实际 chooser/取消结果 | 不能由 OS handoff 推断已分享 |
| S09-07 Photo QR | 已有源码/代码交付不重做；核对双端相册权限、取消、重复选图与失败恢复 | 相册不是相机；未测不能 PASS |
| S09-21 真相机 | 保留设备/真实相机访问条件 | 离线 QR 解码不替代相机产品流 |
| S09-25/27 前台/后台 Deep Link | 保留各自历史成功/失败记录，按实际后续修改决定直接复测 | 不把旧 FAIL 当当前结论，也不自动抹掉未复测记录 |
| S09-42 失焦异步竞态 | 原 ID 保留，受控时序验证账户/路由/卸载后的旧回调 | helper/单测不等于产品路径 |
| S13 Hermes 修复与 iOS Activity 缺失证据 | 已合并兼容性修复不重做；保留真实 cached offline→Retry→page1→restart 验收 | 不再把 formatToParts 旧 blocker 当未修；Helper 不替代 Retry 按钮 |
| Stage 3 Dark/System/Image Theme | 继续原完整执行计划/主题合同 | Native UI 包不做图片取色，不代表 Mobile 可删该范围 |
| S10 A/B/C1/C2/D1/D2a/b/c 与 #118–121 | 原任务 4 继续在途工作，复用已合并交易/恢复和交互改进 | 原生/Testnet/物理设备证据分别列，不返回已解除的上游阻塞 |
| Stage 7 URL/origin→浏览器→权限/撤销→读取/签名 | 原任务 5 继续；#123 目录/缓存已合并；第 2 节 S15 浏览器/Freighter 已推送候选及后续修改分别接续 | 外部浏览器不是受信 WebView；已推送但未合并的候选和后续未提交修改均不代表产品验收通过 |
| Stage 8 剩余产品和 Stage 9 发布/真机 | 继续原 execution-plan、指南和 ledger；不被当前五项吞掉 | 通讯录、资产、设置、日志、硬件、通知/Backend、app identity/签名/旧数据边界均保留 |
| Automation V2.2/#78、iOS System Auth cancel/retry | 原暂停/延期规则不变 | 不因新计划恢复自动化或冒充真机通过 |

本地证据入口（未合入 GitHub，内容/日期需在实际验收前核对）：
- `docs/test/Fresnica_UI_Native_Acceptance_Checklist_20261019.md`
- `docs/test/Fresnica_S09_Test_Checklist_40be444b.md`
- `docs/test/Fresnica_S09_Test_Checklist_Prioritized_20261014.md`
- `docs/test/Fresnica_S13_Hermes_Activity_Acceptance_20261021.md`

## 8. 完整覆盖核对附表（不替代原队列）

全范围继续由原 `fresnica-mobile-rewrite-execution-plan.md`、产品指南 §7/§9/§14 和 traceability ledger 管理。下面用于查漏/定位，不另设执行编号、变更已确认的并行策略或抹掉已有证据。Swap/dApp 正在开发的切片保持推进；共享文件按当前依赖协调。

| 既有范围 | 必核对元素/操作/逻辑 | 承接 |
| --- | --- | --- |
| S01/S02/S03/S04/S28 账户/安全 | 创建/导入/HD/备份/列表选择/隐藏删除、揭示/改口令、System Auth/锁/硬件入口和设备拒绝 | 原账户/安全/硬件阶段；原任务 2 的设计不冒充应用锁已实现 |
| S05/S06/S30 Home/资产/Trustline | 余额/类别/可用额/资产详情风险、Add/Limit/Remove、issuer/reserve/liability、交易后权威重读 | 原 Stage 4/8；复用已验收证据 |
| S07/S08/S22 Send/目的地/通讯录 | 地址/muxed/联系人、金额/memo/fee/风险、精确审阅/授权/结果/恢复 | 原 Stage 4/8；缺失 Capability 只阻塞其消费者 |
| S09/S13 Request/Activity | 原生输入、分享/链接、缓存分页筛选详情/参与者/Explorer、离线 Retry | 保留上节具体子项 ID |
| S10 Swap | 双向金额/Max/资产/报价路由滑点/过期、review/sign/submit/uncertain/restart | 原任务 4，在途继续 |
| S14–S21 dApp | FChain/分类/Recent/custom URL/disclaimer、真实 origin/WebView、权限/撤销、Freighter/SEP-53/Soroban、device/share/data 命令 | 原任务 5；按 Native/Capability 契约逐类开放 |
| S23/S24/S25/S26 Settings | 根目录/General/Advanced/Security、主题语言法币触感、模式鉴权/节点、日志/帮助/About/Terms/Credits | 原任务 3 的网络收口 + 原 Stage 8；Developer Mode 不是独立补丁 |
| S11/S12 与既有 SDEX 范围 | Claimable/LP 列表详情/claim/withdraw、独立订单列表/创建/撤销 | 原 Stage 8/指南 §7.8；SDEX 不算 Swap，稳定 ID 缺口先登记而不擅自重编号 |
| S27/S29 与指南 §14 | AppState/权限/隐私/通知/Backend、safe-area/statusbar/键盘/locale/精确格式/共享modal、legacy识别/发布identity/签名 | 原横切/Stage 8B/9；不复制 donor 服务或秘密机制 |

[参考表面清单](stellar-surface-coverage.tsv) 记录固定 Stellar `bd0f4540b2496a57314e4e29bc6fcf8ff691b60f` 的全部 298 个非测试 screens TSX/JSX 文件（包括步骤/widget/overlay/模板），71 项登记为指南既定排除。路径/blob 覆盖不是逐元素对齐证明；screens 外组件、Freighter 和运行时还须核对指南 §14。不得把 298 个文件称为已完成页面，也不默认覆盖后续 Stellar 新版本。

每个表面沿原 S/UI/验收 ID 补：**参考路径 → 可见元素 → 用户操作 → 校验/状态迁移/Capability → 取消/失败/超时/重试/后台/重启/账户网络变化 → 自动化/双端/无障碍证据 → 缺口归属**。保持 Adopt/Adapt/Exclude 及理由。仅从清单查出缺口不能直接扩入在途 PR，先落到所属任务和安全边界。
