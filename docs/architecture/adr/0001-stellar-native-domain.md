# ADR 0001：Domain 以 Stellar 为中心

- 状态：Accepted
- 日期：2026-08-25

## 背景

现有 Stellar 项目从 Xaman 深度改造而来，仍存在 XRPL/Xaman 的产品与技术遗产。新 Fresnica 需要彻底重写，同时保留已经验证过的产品能力。

## 决策

Fresnica 不建立通用多链 Wallet Engine。Domain 直接使用 Stellar 概念：Account、Signer、Asset、Trustline、Operation、Transaction、Contract、DApp Session、Permission。

## 原因

通用链抽象会把 Stellar 特有能力压扁成 balance/send/transaction 等低级接口，最终重新产生适配层和旧架构复杂度。Fresnica 当前目标是 Stellar-native 钱包，而不是多链钱包框架。

## 结果

- UI 不直接调用 Stellar SDK。
- Application 层协调业务 Flow。
- Domain 表达 Stellar 规则。
- Infrastructure 封装 SDK、Horizon、Soroban RPC、Secure Storage、Hardware。
- 如果未来支持其他链，应作为独立产品架构评审，而不是预先污染当前 Domain。
