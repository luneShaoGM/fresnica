# Product Donor Map

## Purpose

The existing `luneShaoGM/Stellar` / Xaman-derived application is a product-behavior and UX donor only. This map records which product ideas are worth retaining and where they belong in Fresnica without importing the donor architecture, XRPL assumptions, navigation library or security model.

## High-level mapping

| Donor product area | Fresnica target | Decision |
| --- | --- | --- |
| `Home` | Wallet / Portfolio | Retain the information order: active account identity/switching -> primary actions -> assets. Reimplement with Fresnica Account/Signer boundaries. |
| `Account/List` | Settings / Accounts and Wallet account switcher | Retain account selection/list behavior. Realm AccountRecord remains durable identity truth. |
| `Account/Add` | Add Account | Retain Create/Import/Add UX concepts. Current existing-wallet protected-signer paths remain blocked until safe current-passphrase verification exists. |
| `Account/Edit` | Account Details / future account lifecycle actions | Retain public metadata/lifecycle concepts only when corresponding Fresnica capability contracts exist. |
| `Send` + `Steps` | Send Form -> Review -> Result | Retain multi-step product flow. Fresnica Payment/Transaction/Ledger Authorization/Signing Coordination remain behavioral authority. |
| `Events` + `Details` | Activity / Operation Details | Retain list -> details information architecture. Use Horizon operation history, not donor repositories. |
| `Settings/General` | Settings Home / future preferences | Retain grouping concepts selectively. Do not create settings without a current Fresnica product need. |
| `Settings/Security` | Security Settings | Retain discoverability and user-facing security controls. Fresnica Application Security and Native SDK own semantics. |
| `Settings/Advanced` | Network / future developer/support settings | Only expose capabilities actually supported by the Fresnica milestone. No fake Mainnet toggle. |
| `Exchange` | Later Swap milestone | Do not create in v1 product shell yet. |
| `Request` | Later receive/share-account product work | Product concept may be revisited after current v1 wallet/send/history/trustline shell. |
| `xApps` / third-party apps | Later dApp/provider milestone | Explicitly outside current v1 shell. |

## Wallet home donor lessons

The donor Home surface combines three useful product concerns in this order:

```text
active account / account switch
        |
        v
primary wallet actions
        |
        v
asset list / balance state
```

Fresnica should preserve that product hierarchy, but not the donor implementation:

- selected account is identified by Fresnica `AccountRecord.id`;
- signer capability is derived from Account-Signer relationships and current ledger authorization, not an Account access-level flag;
- balances/trustlines are network read state, not fields on the durable Account record;
- Send enters the shared transaction pipeline;
- future Swap must reuse the same signing policy instead of owning its own biometric/password branch.

## Account donor lessons

The donor separates List / Add / Edit. Fresnica should keep that lifecycle clarity:

```text
Account switcher
Account management list
Account details
Add account
```

But Fresnica must preserve:

```text
Account != Signer != Recovery Source
```

A public account page must never imply that owning an AccountRecord means the app can sign for it.

## Send donor lessons

The donor treats Send as a flow with multiple steps rather than a single oversized page. Fresnica keeps this shape:

```text
Send Form
 -> build transaction
 -> immutable Review
 -> current ledger authorization
 -> shared signing coordination
 -> submission
 -> Result
```

The exact reviewed XDR stays in flow memory/application state and must not be copied into navigation parameters. Review UI is derived from the immutable review object, never rebuilt from mutable form fields.

## Activity donor lessons

The donor exposes Events as a list with a separate Details surface. Fresnica maps this to Stellar-native operation history:

```text
Activity / History
 -> Operation Details
```

History is replaceable network/cache state. It has no ownership over Account/Signer persistence.

## Settings donor lessons

The donor has many Settings subareas. Fresnica intentionally starts smaller:

```text
Settings
├─ Accounts
├─ Security
├─ Network
└─ About
```

Additional settings are added only when a real product capability needs them. This avoids recreating a large settings tree before the underlying features exist.

## Explicit non-migration list

Do not carry forward:

- `react-native-navigation` boot/navigation architecture;
- donor global service/repository/store structure;
- XRPL account/access/encryption semantics;
- donor Vault/private-key cryptography;
- Xaman backend assumptions;
- xApp-specific routing/product terminology;
- transaction-type-specific biometric/password branching;
- mutable account objects as a combined identity/network/security model.

## Current structural readiness

```text
Wallet Home            structure exists; Portfolio read path pending
Account Details        structure exists; derived signer presenter pending
Accounts               structure exists
Add Account            watch-only existing-wallet path implemented
Activity               structure exists; Horizon history pending
Operation Details      structure exists; Horizon presenter pending
Settings Home          structure exists
Security Settings      supported System Auth slice implemented
Network                structure exists; Testnet display only
About                  structure exists
Send Form              structure exists; capability wiring pending
Send Review            structure exists; immutable review capability ready
Send Result            structure exists; normalized submission capability ready
Manage Assets          structure exists; trustline transaction capability pending
Asset Details          destination reserved; asset identity read model unresolved
Locked App             upstream authorization API blocked
```

A structural screen is not equivalent to a completed feature. Screens must display honest empty/pending states until their application capability and network read paths are connected.
