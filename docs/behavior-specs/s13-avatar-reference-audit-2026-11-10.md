# Stellar Activity 头像与粉尘行为调查

调查日期：2026-11-10。固定参考目录：/Users/lune/Documents/work/2012/fresnica/origin/Stellar。亲验 HEAD：bd0f4540b2496a57314e4e29bc6fcf8ff691b60f；调查开始及结束均无工作区变化。

这是基于固定参考的用户可见行为调查，不是 Fresnica 实现方案、代码复用授权或原生验收。未复制参考代码、表达式、测试、图片、字体或其他资源；未修改 Fresnica。未启动参考应用或请求任何真实钱包的头像。

## 主要结论

实际 Activity 的账户主题行采用“地址头像”，即使联系人或发行方品牌图存在，也不会因此替换为该图。资产主题则显示资产图；报价、兑换和流动性池显示双资产图；合约显示通用文档符号。不能把所有行统一为账户 identicon，也不能把所有已知账户统一替换为品牌标志。

参考客户端向 StellarCN 的地址头像服务请求图片，没有在本地生成账户 identicon。固定快照不能证明该外部服务使用何种哈希、图形、配色或公开 identicon 算法。使用任意本地 identicon，不能据此声称与参考图形一致。

固定快照的实际筛选页没有独立粉尘开关；粉尘默认隐藏，通过统一“显示隐藏记录”恢复。独立粉尘控件是此次用户要求新增的产品行为，需要在 Fresnica 自己的规格中明确。

## Activity 行主题与头像

| 可见记录类型 | 领先头像主题 | 边界 |
| --- | --- | --- |
| 普通付款、发往其他账户的路径付款、创建账户 | 对方账户的地址头像 | 收入看发送方，支出看接收方；没有可用对方时依次使用可用目标/来源账户。不是所付资产标志。 |
| 返回自己的换汇记录 | 换出/换入资产双图 | 参考会将返回同一账户的路径付款识别为兑换；外部收款方的路径付款仍按付款显示。参考部分判定依赖资产代码，不能据此证明同代码不同发行方的严格语义。 |
| 创建/修改/取消报价 | 卖出/买入资产双图 | 取消也保留资产对；不以交易对手头像替代。 |
| 流动性池存入/提取 | 两种储备资产双图 | 缺少资产对时没有凭空生成资产身份；回到现有可用主题。 |
| 信任线建立/移除、授权/标志变更 | 涉及的资产标志 | 有明确资产身份时成立；没有资产信息时使用可用账户或通用主题。 |
| 创建/领取可领取余额、clawback 家族 | 涉及的资产标志 | 资产信息完整时优先资产；缺失资产时不会仅凭余额 ID 生成标志，而使用可用账户/通用主题。 |
| 合约操作 | 通用文档符号 | 即使有合约 ID、显示名称或转账金额，领先图仍是文档符号，不是合约地址 identicon、应用 logo 或转入资产 logo。TTL/restore 在参考中也被归入此类主题。 |
| 账户维护及其他记录 | 可用账户的地址头像，或通用 Activity 符号 | 没有足够账户/资产身份时用通用符号。不能由类型名称推断品牌。 |
| 失败记录 | 延续可识别的原记录主题 | 失败标题用失败颜色；没有独立“失败头像”一律覆盖上述主题的规则。 |

列表右侧金额旁的小资产图，与左侧领先头像是不同语义：付款可以同时出现“左侧对方账户头像 + 右侧小资产标志”。小图在当前列表中名义尺寸为 10。

## 账户地址头像及优先级

Activity 账户主题的实际可见顺序：

1. 使用行所指账户的完整地址，去首尾空白，向 StellarCN avatar/v2 服务请求地址头像；请求的图片尺寸参数为 256，显示尺寸另行缩放。
2. 图片不可用时显示通用账户/profile 占位图。

地址头像请求不加入联系人名称、联系人 UUID、Memo、钱包标签、网络名称、主题或时间。当前调用未将 M 地址转换为基础 G 地址；服务内部如何处理 M 地址，没有本地证据。名称或 Memo 改变不构成 Activity 地址头像身份变化。空地址有未知身份的服务请求兜底，但正常行先选择已有账户身份。

联系人会影响列表名称解析；精确地址与已确认 Memo 的联系人、通用同地址联系人、本地钱包标签、网络名称依次提供名称。这不等于头像优先级。

通用账户展示在其他场景可以优先联系人绑定资产图，再匹配资产/发行方图，再地址头像，最后通用 profile 图；但 Activity 账户主题明确选用地址头像，绕过资产感知替换。参考账户和联系人记录以及 Activity 路径中没有发现用户上传相片参与此优先级的证据。可由其他页面传入的显示图片，也不能证明 Activity 支持持久化自定义照片。

所有这里使用的远程地址头像及品牌图片沿参考既有图片代理路径加载；本地图片不经过远程代理。这是媒体展示，不是账户验证、资产安全评级或联系人真实性证明。

## identicon 算法证据边界

客户端只给出了 StellarCN 地址图片服务以及地址、尺寸的输入语义；未找到本地 identicon 生成器或服务端实现。因此无法从此固定快照确定：

- 哈希算法、编码前后的公钥字节、图形网格/对称规则；
- 具体调色板、背景生成、是否按网络变化；
- StellarCN 是否与 LOBSTR 标准图完全相同；
- 服务未来更新后同地址是否保持像素一致。

快照 TODO 提到 LOBSTR Stellar identicon 项目。其官方说明确认：LOBSTR 的工具根据钱包公钥生成头像，JS 与 Python 默认设置产生相同图形；其独立 Web 服务使用 Python 生成。该说明不证明 StellarCN 使用它。此次没有读取、转述或提供该生成器的实现。

官方背景来源：[LOBSTR Stellar Identicon README](https://github.com/Lobstrco/stellar-identicon-js)。这里只用于区分已公开算法产品与当前参考使用的外部服务，不作为 StellarCN 像素规范。

## native、资产与双图的展示和回退

- Native XLM 使用参考随应用提供的 Stellar/XLM 方形标志；不使用同名发行资产的标志，不依赖远程 native 品牌图片。
- 发行资产以精确代码和发行方组合查找图片。候选顺序是本地登记覆盖、LOBSTR 列表、Soroswap 列表、StellarExpert 列表、已保存的资产专属图片、发行方图片；重复候选去重，按可用候选回退。列表来源可来自已有同步缓存；这里没有证明每个列表都实时可用。
- 单资产缺图或远程失败最终显示通用未知资产图。普通资产缺图不会转为该发行账户 identicon。仅有代码也不能证明正确发行方品牌。
- 双图的第一资产位于左上，第二资产位于右下并压在前方；画布名义 40，每个子图约 25。顺序来自记录自己的资产对顺序，不按图标是否存在重新排序。
- 双图每一侧首先使用该侧选中的资产图，加载失败回未知资产图；不能假定双图与单图具有完全相同的多候选失败恢复过程。图片不全时仍保留两侧位置，不把另一侧放大为单资产。
- 没有完整资产对但已识别为池资产时，可显示通用未知池图；不凭池 ID 推导品牌。
- 合约主题没有品牌图片回退链；其通用文档符号直接保留。

## 颜色、背景、尺寸与加载

列表领先头像名义尺寸为 40 个布局单位，会随应用的屏幕缩放调整。账户/单资产图片为圆角方形、覆盖裁剪，角半径名义 11，不是默认圆形，也不是首字母色块。图片本身没有因为收入/支出、联系人名称、网络或失败状态重新着色。

双资产子图呈圆形感的圆角裁剪，带细边，与页面背景协调。通用合约/Activity 符号放在名义 40 的圆角容器里，符号名义 20；背景和边线随主题，符号采用主题主文字色。浅色主题为浅色背景/深色符号，深色及彩色深主题采用深色背景/浅色符号。头像图片自身色彩来自图片，客户端没有统一重配其 identicon 配色。

通用头像能力可显示灰色脉冲加载占位与淡入，但未证实 Activity 每次远程图片读取都显示该动画；不能把这项通用能力写成始终可见的列表行为。账户远程失败有明确 profile 回退；资产远程失败有未知资产/池回退。未通过运行时观察保证加载时序、离线持久图片命中或代理服务可用性。

## 粉尘控件与含义

当前实际筛选页只有统一“显示隐藏记录”和独立“显示失败交易”，没有实际呈现的独立“显示粉尘付款”选项。历史粉尘字段、迁移兼容以及本地化文案仍存在；旧字段会迁移到统一显示隐藏记录，不能用其存在推断当前 UI 有独立开关。

参考粉尘显示规则是：普通付款或两种路径付款，目标为当前查看账户，实际目标资产为 native XLM，目标金额小于或等于 0.1 XLM。判断是链上目标金额，不是 source 金额、报价限制、兑换率或法币估值。

- 正好 0.1 包含在内；更大的 native 入账不属于这个粉尘规则。
- 发往外部账户的小额支出不属于该规则。
- 发行资产即使名为 XLM 也不是 native，不能因此隐藏。
- 没有排除自己发给自己，因此小额 native 自转及返回自己的兑换目标腿也可能被隐藏。
- 这是本地可逆的列表低相关性启发式，不能据此标注诈骗、垃圾资产或风险账户；无签名/转账/余额权限含义。
- 默认隐藏，统一显示隐藏记录可以恢复；“显示失败交易”单独控制失败记录是否进入列表，不能自动越过隐藏规则。
- 参考粉尘判断本身未建立严格正数和成功证明；这不是允许 Fresnica 从失败或非法数据推断实际到账的依据。

用户要求的独立粉尘过滤，需要 Fresnica 自行规定其与统一显示隐藏记录、失败包含、其他筛选和取消/应用的关系。参考可证明阈值与金额腿语义，无法提供一个当前不存在的独立控件行为。

## 固定快照审计路径

以下均相对于上述固定参考目录，全部属于同一 SHA bd0f4540b2496a57314e4e29bc6fcf8ff691b60f。路径只为审计定位，不提供实现内容：

| 证据 | 路径 |
| --- | --- |
| 当前列表实际入口，排除未接入的旧行 | src/components/Modules/EventsList/EventsList.tsx:136；docs/stellar-migration/CONTACT_IDENTITY_DISPLAY.md |
| 当前行账户地址主题、非账户主题及尺寸 | src/components/Modules/EventsList/EventListItems/History.tsx:197、:337 |
| 行主题选择及缺失身份边界 | src/screens/Events/helpers/operationEventPresentation.ts；src/screens/Events/semantic/stellar/resolveOperationSemantic.ts |
| 付款对方、记录家族、兑换分类 | src/screens/Events/helpers/stellarOperations.ts:411、:772、:1126；src/screens/Events/helpers/stellarSwapDetection.ts |
| 资产对身份 | src/screens/Events/helpers/operationTokenPairIdentity.ts |
| 地址主题绕过通用联系人/资产头像顺序 | src/components/Modules/AccountIdentityCard/AccountIdentityCard.tsx:74 |
| 地址服务输入与默认请求尺寸 | src/common/utils/addressAvatar.ts |
| 联系人资产感知及账户 fallback | src/common/utils/resolveContactAvatar.ts；src/components/Modules/ContactAvatar/ContactAvatar.tsx |
| 名称与联系人身份优先级 | src/services/ResolverService.ts:200；src/common/utils/accountIdentityDisplay.ts；docs/stellar-migration/CONTACT_IDENTITY_DISPLAY.md |
| 本地账户/联系人字段边界 | src/store/models/objects/account.ts；src/store/models/objects/contact.ts |
| native 标志选择 | src/services/NetworkService.ts:539 |
| 资产身份与图片顺序 | src/screens/Events/helpers/assetDisplay.ts；src/common/utils/tokenIconCandidates.ts；src/common/utils/stellarTokenRegistryMerge.ts:112 |
| 资产图/双图、尺寸、失败占位 | src/components/Modules/TokenElement/OperationAssetAvatar.tsx；src/components/Modules/TokenElement/TokenAvatar/TokenAvatar.tsx；src/components/Modules/TokenElement/TokenAvatar/styles.ts |
| 通用头像圆角、裁剪、加载/失败；主题 | src/components/General/Avatar/Avatar.tsx；src/components/General/Avatar/styles.ts；src/components/Modules/EventsList/EventListItems/styles.tsx:86；src/theme/colors.ts |
| 图片候选与代理 | src/components/General/ImageWithFallbackCandidates/ImageWithFallbackCandidates.tsx；src/common/utils/imageProxy.ts |
| 实际隐藏/失败筛选及旧字段迁移 | src/screens/Modal/FilterEvents/EventsFilterModal.tsx:44、:334、:343 |
| 粉尘阈值、隐藏与恢复 | src/screens/Events/helpers/stellarOperations.ts:387；src/screens/Events/helpers/eventsOperationVisibility.ts:130、:161 |
| 未接入算法的背景线索 | TODO.md:2；不能当作采用该算法的证据 |

## 未执行与下一步

未运行参考应用、模拟器、真机、原生产品流；没有视觉截图对比或像素一致性结论。没有测试/代码迁移，没有验证外部 StellarCN 图片生成算法和服务当前内容。

本次用户要求重新调查头像规则，不构成将钱包地址发送给新图片服务的授权；既有 token 图片隐私选择也不能自动扩展到账户地址头像。此次不建议为了近似参考而悄悄引入 StellarCN、LOBSTR 或其他地址图片请求。

下一步由 Developer 将独立粉尘控件按用户要求写入 Fresnica 自有规格；账户头像先保留现有本地实现，并如实说明它与参考外部图片不是同一个已验证算法。任何实现须重新接受 exact-HEAD 独立审查及相称验证。若以后要求账户图形与参考逐像素一致，当前缺失的是 StellarCN 服务端算法/已授权规范或合规的视觉对照证据；不能以 TODO 或另一个 identicon 库填补证据。

家族补充：创建与撤销信任线都以明确资产为领先主题，不因金额为零而改成账户头像。取消报价依旧是卖出/买入双图。池图第一/第二来自记录储备数组的原有顺序，第一左上、第二右下；没有发现按代码、余额、价格、native 优先或图片可用性重新排序。可领取余额的 credit 资产在身份齐全时使用该 code+issuer 图片；native 使用 XLM 标志；未知资产不是由 balance ID 生成 identicon。创建合约、从资产创建合约、调用以及归入合约的 TTL/restore 维护记录都使用文档主题，不能把 origin asset 当作其领先资产标志。


## Fresnica 当前差异（Developer 核对 main72f7648）

本 PR 仅按本次请求增加独立粉尘过滤，并交付头像调查；没有把本地头像
改称 Stellar 同算法，也没有引入外部账户头像提供方。

| 项目 | 当前 Fresnica | 固定 Stellar 参考 |
| --- | --- | --- |
| Activity 账户头像 | 本地地址生成的5×5对称绿色像素图；圆形40 | 外部地址头像；圆角方形；失败为通用账户图 |
| 双资产主题 | 同一40画布内两个16小图横向并列 | 两个约25小图左上/右下重叠 |
| 合约及TTL/restore | 合约/部署者/资产身份图，或来源账户图 | 通用文档符号 |
| 缺资产的claimable引用 | 余额ID生成的本地图形 | 可用账户或通用主题，不凭余额ID造资产图 |
| 右侧资产小图 | 16 | 名义10 |
| 失败记录 | 安全DTO保留来源账户，不保留已执行金额/资产 | 尽量延续原操作主题 |

安全边界：不得为了头像一致而给失败DTO补造已执行资产/金额；不得将当前
Token媒体设置自动变成钱包/联系人完整地址的外发授权。头像图片不是地址
真实性证明。上述未实施的呈现差异可作为后续对齐规格输入，不应再标记
为已经完成的 Stellar 头像规则。

## Subsequent implementation candidate

The audit above records the state at #182. The later
[s13-avatar-alignment.md](s13-avatar-alignment.md) defines the user-requested
Activity implementation and independent default-OFF address-media permission.
It does not authorize live development requests using wallet/contact addresses,
remote identity verification or changes to other S22 avatar consumers.
