# Native runtime smoke（FresnicaCore + Realm）

本地反复验证用：确认模拟器/真机上的 JS 能调到 `NativeModules.FresnicaCore`，Realm 能 open/write/read，并且 Native SDK 0.3.0 的 external-signing 与 SEP-53 高层桥接方法实际存在。

成功标记：

```text
FRESNICA_PARSE_ACCOUNT_SMOKE_OK
"realm":"ok"
```

结果文件：项目根目录 `native-runtime-smoke-result.json`（不要提交）。

## 一次命令

在项目根目录：

```bash
# App 已经装过、只想再跑一遍
npm run smoke:ios
npm run smoke:android

# 原生产物变了，需要重编再装
npm run smoke:ios -- --rebuild
npm run smoke:android -- --rebuild
```

等价于：

```bash
bash scripts/run-native-runtime-smoke.sh ios
bash scripts/run-native-runtime-smoke.sh android --rebuild
```

脚本会：

1. 把 `scripts/native-runtime-smoke-entry.js` 临时拷到 `index.js`（退出时还原成 git 里的正式入口，避免 Metro 在 8765 关闭后又热更新跑一遍冒烟）
2. 启动或复用 Metro `:8081`
3. 启动回报服务 `127.0.0.1:8765`
4. Android 做 `adb reverse` 8081/8765 后拉起 App；iOS 在已启动的模拟器里 launch
5. 等待回报，打印结果，退出码 0 为通过

不要用裸的 `npx react-native start`（会拉错 RN 版本）。Metro 必须走 `npm start`。

## 前置条件

- 已 `npm ci`
- 对应平台 App 至少成功编过一次并装到模拟器
- Android：`adb devices` 为 `device`；iOS：Simulator 已开或脚本能 boot 一台 iPhone
- vendor 里已有 Native SDK + 编好的 RN adapter（Android AAR / Apple xcframework）

第一次从零搭原生，仍按 CI / 既有步骤准备 vendor，再 `--rebuild`。


## Transaction recovery Testnet smoke

Stage 2.5 另有 Android 专用的真实 Testnet process-death 恢复门：

```bash
npm run smoke:transaction-recovery:android
```

该命令会 fresh build Android debug App，使用 Fresnica Native/Core 生成临时 Testnet signer，经 Friendbot 只给测试源账户注资，随后走生产 S07 `buildSendReview → submitSendReview → shared transaction pipeline`。测试 wrapper 只把一次真实 Horizon `accepted` 客户端结果投影为 `uncertain`，模拟响应丢失；pending public metadata 写入专用 `transaction-recovery-smoke.realm` 后，runner 强杀第一个 App PID，再启动新 PID，只按原 `network/account/source/transactionHash` 做 reconciliation。成功必须证明第二进程没有重新签名或广播。

测试不会把 mnemonic、App Passphrase、secret、signed XDR 或 signer material 写入 callback/Realm。专用 Realm 与测试进程在退出时清理，不代替正常钱包 Realm。

## 常见失败

| 屏幕/结果 | 含义 | 处理 |
| --- | --- | --- |
| `FresnicaCore native module is not linked` 且 `hasFresnicaCoreModule: true` | iOS 还在用旧 adapter 二进制 | `--rebuild`，必要时清 DerivedData 后重装 |
| `Network request failed` | 8765 回报没打到电脑 | 用本脚本（会起 server）；Android 不要自己漏 `adb reverse` |
| `command not found: react-native` | `node_modules` 不完整 | `npm ci` |
| 端口 8765 占用 | 上次回报服务还在 | 停掉后再跑 |
| iOS smoke 启动 server 后立刻误报失败 | 同一 Metro 下仍运行的 Android Fresnica 可能在 `index.js` reload 后先打到 8765 callback | 先 `adb shell am force-stop com.fresnica.mobile`，再 terminate iOS App 后重跑；不要把抢跑 callback 当 iOS native 失败 |

## 测什么、不测什么

测的是运行时链接：Realm 内存库 round-trip + `FresnicaCore.parseAccount`（合法 classic 地址 / 非法输入 `invalid-input`）+ `prepareEd25519Signing` / `applyEd25519Signature` + `signMessageWithSystemAuth` / `signMessageWithPasscode` 的桥接存在性。冒烟不会伪造 signer 或调用真实签名。

不测产品 UI，也不替代 `npm run check` 或 `npm run test:realm`。
