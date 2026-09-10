# Fresnica Mobile Product Structure

> Historical. Product shell and rewrite rules live in `docs/stellar-product-information-architecture.md`. The three-tab diagram below (`Wallet | Activity | Settings`) is not the current target.

## Purpose

This document defines the product shell before individual screens are filled in. The goal is to build Fresnica as one coherent wallet product, not as a sequence of isolated feature pages.

The structure follows the approved Mobile v1 boundary:

- onboarding
- accounts
- security
- portfolio
- send
- history
- trustlines
- settings

Swap, liquidity, dApp browser/provider work, WalletConnect, Mainnet and other later capabilities are deliberately not added as empty product modules in this milestone.

## Product navigation model

```text
App
|
+-- Bootstrap
|    +-- Opening / startup error
|    +-- Onboarding Stack
|    |    +-- Welcome / choose method
|    |    +-- Create wallet
|    |    +-- Import recovery phrase
|    |    +-- Import Stellar secret
|    |    +-- Add watch-only identity
|    |    +-- Establish app passphrase
|    |    +-- Generated mnemonic backup
|    |    +-- Backup confirmation
|    |    +-- Interrupted-backup recovery
|    |
|    +-- Locked App                     [BLOCKED]
|    |
|    +-- Main Product
|         |
|         +-- Wallet
|         |    +-- Portfolio / wallet home
|         |    +-- Account details
|         |    +-- Add account
|         |    +-- Asset details
|         |    +-- Send
|         |    +-- Manage assets / trustlines
|         |
|         +-- Activity
|         |    +-- History
|         |    +-- Operation details
|         |
|         +-- Settings
|              +-- Settings home
|              +-- Account management
|              +-- Security
|              +-- Network
|              +-- About
```

The intended bottom-level product navigation is intentionally small:

```text
Wallet | Activity | Settings
```

Transaction flows such as Send are pushed from Wallet/Account context; they are not permanent tabs. Security belongs under Settings. Trustline management belongs to the account/asset area instead of becoming an unrelated top-level destination.

## Product surfaces

### Bootstrap

Responsibility:

- create application services;
- open durable wallet persistence;
- load the Fresnica native boundary;
- resolve first-run / pending-backup / ready state;
- later resolve locked/unlocked application state.

Bootstrap must not become a feature router with ad-hoc overlay flags. Its product decision is only which root flow owns the screen.

### Onboarding

Owns first wallet establishment and first durable Account/Signer creation.

Product pages:

- choose Create / Import Phrase / Import Secret / Watch-only;
- collect the minimum credentials for the selected method;
- establish the app passphrase for protected software wallets;
- show and confirm a newly generated recovery phrase exactly once;
- resume an interrupted generated-mnemonic backup through fresh-passphrase SDK reveal.

Plaintext recovery material and app passphrase stay in short-lived screen-local state only.

### Wallet

Wallet is the product home. It should become the user's main working surface rather than a completion page.

Primary content:

- selected account identity;
- total portfolio summary when portfolio data is available;
- account/asset balances;
- primary actions such as Send and asset management;
- account switch/add entry;
- network state appropriate to the Testnet milestone.

Durable account/signer truth remains in Realm. Network balances and history are replaceable network state and must not redefine the Account record.

### Account details

Owns account-specific public/product state:

- label and public address;
- identity kind;
- watch-only/local-signer status derived from repository relationships;
- account-specific balances and assets when available;
- entry to asset/trustline management;
- entry to Send;
- later lifecycle actions such as signer attachment/removal when their security contracts exist.

### Portfolio

Owns read-only balance presentation and refresh orchestration.

Expected product responsibilities:

- account snapshot loading;
- native XLM and trustline balance presentation;
- asset list sorting/display;
- refresh/error/empty states.

It does not own signing, signer identity, or durable wallet identity.

### Send

First complete transaction product flow.

```text
Form
 -> build exact transaction
 -> Review
 -> current ledger authorization
 -> shared Signing Coordination
 -> submit
 -> Result
 -> refresh Wallet + Activity
```

Send must use the existing Payment / Transaction / Ledger Authorization / Signing foundations rather than inventing a feature-local signing path.

### Activity

Owns account operation history presentation.

Expected pages:

- history list;
- operation detail.

History is network/cache data. Clearing or refreshing history must never affect Account/Signer persistence.

### Trustlines / Manage assets

This is an account/asset workflow, not a top-level tab.

Expected product flow:

```text
Manage assets
 -> asset search/select
 -> review trustline change
 -> shared transaction/signing pipeline
 -> result
 -> refresh portfolio
```

The exact transaction capability for trustline changes is not implemented yet, so the product structure can expose the destination but must not fake functional completion.

### Settings

Settings is the product control area, not a dumping ground for feature state.

Sections:

- Accounts
- Security
- Network
- About

The Testnet milestone may display network configuration but does not provide a fake Mainnet switch.

### Security

Security remains a product surface under Settings while capability policy stays centralized in Application Security / Signing Coordination.

Current supported slice:

- System Auth availability/status;
- initialize device protection domain;
- register/repair protected signers with the existing app passphrase;
- disable System Auth;
- routine signing prefers System Auth;
- high-assurance signing requires fresh app passphrase.

Screens must not implement their own biometric-vs-passphrase policy.

## Code ownership target

```text
src/
  app/
    App.tsx
    navigation/
      productRoutes.ts
      # React Navigation composition is added once dependencies are pinned
    config/
    createAppServices.ts

  features/
    onboarding/
    accounts/
    portfolio/
    send/
    history/
    trustlines/
    security/
    settings/

  capabilities/
    account/
    signer/
    payment/
    transaction/
    ledger-authorization/
    signing/
    application-security/

  platform/
    fresnica/
    stellar/
    persistence/

  ui/
    # reusable visual primitives only
```

Feature folders own product flows and screens. Capabilities own reusable application semantics. Platform owns implementation mechanisms. UI owns reusable visual primitives only.

## Build order after the shell

The next work should fill the product horizontally rather than finish one isolated feature before the rest of the app exists:

1. establish real root/main navigation and page destinations;
2. make Wallet / Activity / Settings all reachable with coherent empty/loading states;
3. place Onboarding and Security into that navigation model;
4. add Portfolio read path so Wallet becomes useful;
5. wire Send end-to-end over the already implemented transaction foundations;
6. add History read path;
7. add Trustline transaction path;
8. deepen Account and Settings lifecycle actions only where security contracts are available.

At each stage, product destinations may exist before their capability is complete, but they must state their real status and must not simulate security or transaction success.

## Known blockers / issues to surface, not work around

### 1. App lock / session authentication

Status: **blocked by upstream contract**.

The current React Native Fresnica boundary does not expose a generic existing-domain System Auth challenge suitable for unlocking the application session. Mobile must not emulate this with dummy transaction signing, Reveal/Export, or a second JavaScript credential scheme.

`LockedApp` therefore belongs in the product architecture but is not implemented as a fake security flow.

### 2. Existing-wallet protected signer provisioning

Status: **blocked by upstream contract**.

The current framework boundary has no verification-only operation that proves an entered app passphrase matches an existing protected signer without returning sensitive unlock material to JavaScript. Existing-wallet Add Account remains watch-only until this contract exists.

### 3. React Navigation dependency integration

Status: **environment/integration task, not a reason to invent a router**.

The approved navigation technology is React Navigation 7 native stack. The current repository does not yet contain its dependencies. Dependency changes must update `package.json` and `package-lock.json` together and then complete native installation. Until that can be done reproducibly, the current temporary overlay routing remains transitional only.

### 4. Historical v1 design baseline drift

The original v1 design document still contains the older Native SDK `0.2.0` and `app passcode` baseline. The current verified implementation baseline is Native SDK `0.2.1` and product terminology is **app passphrase**. Treat the historical document as architectural history where those values conflict with current capability/status documentation.

## Product-development rule

When a page reaches a missing capability, dependency or security contract:

1. identify the exact missing boundary;
2. classify it as Mobile implementation, dependency/toolchain, or Fresnica upstream issue;
3. record the user-visible/product impact;
4. stop at that boundary;
5. do not invent a permanent workaround simply to make the page appear complete.
