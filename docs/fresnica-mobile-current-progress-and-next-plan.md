# Fresnica Mobile｜当前基线与执行队列

> 基线核验：2026-10-27；执行收口：2026-10-28（Asia/Shanghai）。GitHub main、当前源码和 exact-HEAD Review 为事实源；本文件是执行索引。实现、审查、合并、自动化验证、原生验收分别记录，不能互相替代。

## 1. 集成基线

- 本轮基线：`main@a795e440fdc10ff7007a300d3c885d1c6a2c2435`，已包含 PR #122 节点健康与重试。
- #122 的独立 Work Review 核对 `f83195bd00453372c90d3ac0b2038a26dc1350b4`：APPROVED，P1/P2/P3 为零；CI check 为 155 suites / 1260 tests。只证明自动化范围，S24 原生验收仍未执行。
- 最近已合并：#111–116 生命周期/缓存/读取恢复，#117 资产弹层，#118 Swap 输入与结果，#119 双向金额与自动报价，#120 路由/滑点，#121 live spendable / Pay Max，#122 连接健康。每项合并不自动升级产品成熟度。
- 当前另有未合并的 S14 候选 PR #123（公共 FChain catalog 与 network-scoped Realm cache）。不包含受信浏览器、权限和签名；其独立审查与原生证据需分别核对。
- 开放旧 PR：#78 Automation V2.2 暂停；#14 / #25 历史分支，不作为新工作基线。

## 2. 本地工作与事实边界

| 工作 | 已核实状态 | 处理 |
| --- | --- | --- |
| 主目录 `fresnica` | `stage7/s15-untrusted-website-handoff-2026-10-22@dd5574a75ec5485a549448c4b4fa50ce35d744a3`；大量未提交 dApp、WebView、Realm、导航和文案改动 | 保留原样，不能当作 main 或已交付功能；不得 reset/clean/覆盖 |
| dApp 集成目录 | `feat/dapps-s14-catalog-cache-integration-2026-10-27@8ad16a8a840b8cff4e435721d4f11f1182c45728`；工作区干净，已关联远端分支，开工时未见功能 PR；收口复核已创建未合并 PR #123 | 作为待集成候选；目录/缓存与浏览器/权限/签名分别盘点，不按文件存在宣称完成 |
| Swap | #118–121 已合并；旧工作目录仍保留 | 后续按 main 校准，停止在旧分支继续叠加；聚合原生验收仍需单列 |
| Network | #122 已合并；只包含读取连接健康与 Retry | 本轮分支已实现自定义节点、网络切换、Developer Mode 候选；尚未合并/原生验收 |
| 本轮基础建设 | `feat/shared-auth-network-foundation-2026-10-27` 从上述 main 新建，初始工作区干净 | 顺序完成基线 → 鉴权设计 → 网络实现；不修改其他工作区 |

## 3. 产品覆盖与证据账本

| 范围 | 已实现/已有证据 | 未完成/阻塞 |
| --- | --- | --- |
| S01/S02 账户与 Signer 生命周期 | Create/Import/HD、备份验证、选择/排序/隐藏/删除；历史双端子流程证据 | 可重复聚合 gate、动态字体/读屏等；既有未受影响证据不重跑 |
| S04 共享安全 | System Auth 注册/修复/关闭；交易 routine 与 fresh-passphrase 策略；Native verification-only 口令验证 | 应用解锁缺 generic System Auth challenge；本轮分支已实现敏感设置鉴权候选；尚待独立审查和原生验收 |
| S05/S13 数据生命周期 | #111–116 的分区缓存、Effects、节点恢复和提交后读取收敛 | LC6 原生聚合、历史 iOS Activity 真正离线 Retry 证据仍需逐项核对，helper 证据不算产品验收 |
| S07/S30 Send/Trustline | exact-XDR、授权、提交/uncertain/原交易哈希恢复；历史子流程验收 | Stage 9 iOS 真机 System Auth 取消/重试延期；必要无障碍/可重复验收未封板 |
| S09 请求与系统入口 | 已有 QR/Share/Deep Link/Photo QR 和生命周期接线 | 相机/相册权限与真实输入、取消/重复交付/后台入口等聚合证据按当前验收记录核对；不以旧 L0 行判断当前源码 |
| S10 Swap | quote/review/submit/recovery 与 #118–121 的输入、路由、滑点、Pay Max 改进已集成 | 完整原生产品流、取消/账户网络变更/uncertain 恢复等聚合验收未封板 |
| S14–S21 dApp | main 只读 catalog/外部链接基础；本地另有集成候选和未提交浏览器实现 | 未合并内容不算交付；可信 origin、权限/撤销、各请求与标准签名管线需逐项闭合；Soroban 等独立上游缺口保留 |
| S24/S25 网络与开发者工具 | #122 健康与既有 Retry；诊断基础 | Developer Mode 鉴权、网络偏好、节点增删/测试/启用/删除回退、全网关一致切换；日志导出仍归后续任务 |
| S03/S06/S08/S11/S12/S22–S29 其他范围 | 以 ledger 与代码为准，部分只有机制或角色 | 不因当前三条功能线而删除；muxed/hardware/Soroban/发布身份等各自依赖继续保留 |

## 4. 依赖队列（本轮用户确认）

| 顺序 | 任务 | 退出条件 |
| --- | --- | --- |
| 1 | 校准基线与未提交工作 | 当前 main、PR、分支、工作树及事实边界明确；过期阻塞叙述纠正 |
| 2 | 共享鉴权基础设计 | 区分交易授权、应用会话解锁、敏感设置鉴权；SDK/Capability/UI 权威和 cancel/failure/retry/失效条件明确 |
| 3 | 网络会话与节点管理 | Developer Mode 门控；偏好持久化；节点增删/测试/启用/当前节点删除回退；切换使旧任务失效并重建全部网关；账户与恢复记录保留；关闭先恢复 Mainnet |
| 4 | Swap 聚合收口 | 仅补当前主线直接影响的报价→review→授权→提交→恢复与原生证据 |
| 5 | dApp 敏感操作闭环 | 权限/撤销/请求→标准签名管线；只读目录可作为独立并行线 |

阶段编号仍是产品覆盖/验收分类，不再把历史 PR 推荐清单当实时队列。本节是当前执行顺序；后续开工从第一个具备前置条件的任务开始。任何无法实现的依赖标明阻塞与安全边界，不能伪装完成。

## 5. 并行与遗漏控制

- 最多一条共享基础主线，加一条不依赖未完成基础的功能线。导航组合根、共享鉴权、网络会话和持久化边界由基础主线统一处理。
- 每个任务记录 S ID、依赖、交付物、自动化/原生验收、未测/阻塞、下一步。新发现缺口回填所属 S 行；只有当前阻塞或明确安全问题立即扩入当前切片。
- 文档职责：本文管当前顺序；execution plan 管完整覆盖；traceability ledger 管 S ID 与证据；behavior spec 管行为和验收。旧历史记录保留日期，不用历史结论覆盖当前实现。
- PR → 必要 CI → exact-HEAD 独立 Work Review → 修复 P1/P2 → 用户决定 Merge。不得自行 Merge。Automation V2.2 保持暂停。

## 6. 本轮前三项交付状态（候选分支，尚未合并）

1. 基线校准完成：核对 main、最近合并 PR、未提交 dApp 和独立目录；纠正旧口令验证阻塞叙述。
2. 共享鉴权设计完成：[行为契约](behavior-specs/shared-auth-network-session.md)，明确交易授权、应用解锁和敏感设置鉴权；原生通用 challenge 仍缺失。
3. 网络会话与节点管理已实现：fresh App Passphrase 开启模式、HTTPS 节点校验/增删/测试/选择、当前节点删除回退、关闭先返回内置 Mainnet、持久化和不可变服务会话。旧钱包进入显式网络选择门控，不静默切网；待确认交易和签名/广播保护保持有效。

本地验证：`npm run check` 162 suites / 1292 tests 通过，lint 0 errors / 31 既有 warnings；新增 Realm 重启/分区保留/写入回滚 2 tests 通过。Android/iOS JS bundle 使用临时 Metro watchFolders/nodeModulesPaths 配置解析共享依赖；此辅助打包不等于原生构建或产品验收。

待完成：远端 CI、独立 Work exact-HEAD review、Android/iOS 原生产品流和无障碍验收。S24 不升级 L4。通用应用生物解锁、Developer Session Logs、Stage 9 iOS 真机 System Auth 取消/重试仍未完成。合并前还需与 PR #123 的 `createAppServices`/文档变更对齐；本轮不修改其工作区或 wallet Realm v6→v7 migration。

## PR #124 审查修复

- 旧 HEAD `41ade33bdb5dbc96e59f50e491d11dfef727e822`：Work NEEDS_FIX，P2 1（已有 Testnet 只读/外部 signer 钱包被首次网络选择阻挡）。
- 修复：已有 Testnet 分区可显式选择内置节点并持久保留访问；不启用 Developer Mode，不开放自定义节点，不创建/导入无关 signer。新钱包默认和原有交易/恢复隔离保持不变。
- 新 HEAD 必须重新独立审查；原生验收仍未执行。
