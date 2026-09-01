# Fresnica Mobile Capability Status

This file records current Mobile implementation evidence against shared Fresnica Application Capability vocabulary. Upstream maturity describes the shared contract, not Mobile implementation quality.

## Compatibility baseline

```text
Fresnica Native SDK       0.2.1
Native Binding API        2
Universal SDK API         3
Core Client API           3
RN adapter source         0.2.1
Adapter source revision   47383bd94b1f88882dd0759f7275bd8b5452dcdb
React Native              0.87.0
Realm                     20.2.0
Network                   Stellar Testnet
```

## Capability matrix

| Application Capability | Upstream maturity | Mobile status | Current evidence / scope |
| --- | --- | --- | --- |
| Account | Normative | Onboarding + runtime account surfaces implemented | Account records, Account-Signer invariants, derived watch-only state, atomic provisioning, account selection/details and watch-only Add Account. |
| Signer | Normative | Protected software + Recovery Export implemented | Secret/mnemonic protection and reveal remain SDK/Core-owned. Mobile persists public signer identity + opaque envelope/metadata only. PR #24 adds explicit fresh-passphrase recovery export for one eligible protected-software signer. |
| Balance / Availability | Normative | Portfolio implemented | Classic native/credit balances normalized behind Balance; exact decimal strings retained; inactive/contract states explicit; LP shares not projected as ordinary tokens. |
| Payment | Normative | Current contract rebaseline implemented in PR #21 | Classic `G...` scope, Payment/CreateAccount selection, current fee/reserve/availability preflight, trustline authorization/capacity, SEP-29 memo-required and exact-XDR binding. |
| Transaction | Normative | Shared reviewed-transaction submission implemented | Payment and Trustline share freshness, ledger authorization, threshold resolution, Signing Coordination and exact signed-XDR submission. |
| Trustline | Normative | Add/Remove product flow implemented | Exact case-sensitive `CODE:GISSUER`, canonical limit, reserve/fee/issuer/liability/pool rules and exact-XDR review. |
| History / Activity | Defined | Read-only product slice implemented | Descending Horizon account operations normalized into stable entries with refresh/load-more and unsupported-operation preservation. |
| SDEX | Normative | Not implemented | Shared contract covers `ManageSellOffer` / `ManageBuyOffer`, books/offers/fills and is intentionally separate from Path Payment Swap. |
| Path Payment / Swap | Shared product contract missing | Product blocked on Fresnica/fresnica#134; platform mechanisms in PR #23 | PR #23 adds transport/XDR mechanisms only and does not choose routes, slippage, quote TTL/requote or trustline policy. |
| Ledger Authorization | Defined | Classic foundation active | Current signer/threshold state is reloaded before Payment/Trustline signing; full multisig/provider coordination remains future work. |
| Signing Coordination | Normative | Shared routine signing active | `routine` prefers System Auth and falls back to fresh app passphrase; high-assurance recovery export does not use routine/System Auth substitution. |
| Application Security | Defined | System Auth foundation + Recovery Export implemented | System Auth status/enable/repair/disable exists. Recovery Export requires fresh passphrase through Core reveal. App-session lock/current-passphrase verification/rotation remain upstream-blocked. |
| Network / Gateway | Defined | Platform mechanisms implemented | Horizon balance/auth/history/account/ledger/pool reads, Payment/ChangeTrust build/submit; PR #23 adds isolated Path Payment route/build mechanisms. |
| Persistence | Mobile mechanism | Realm v1 production-wired | Memory and Realm share AccountSignerRepository; secrets/passphrases/revealed recovery material are never persisted. |

## Onboarding evidence

- create mnemonic-backed protected signer through Fresnica SDK/Core;
- import mnemonic or Stellar `S...` only through SDK protection APIs;
- watch-only `G...` / `C...` accounts;
- first protected signer establishes the app passphrase;
- atomic Account + Signer + reference persistence;
- plaintext mnemonic/secret/passphrase never persisted;
- generated mnemonic backup persists metadata only and interrupted backup uses fresh-passphrase Core `reveal`;
- completed onboarding enters ProductRuntime.

Existing-wallet protected-signer creation/import remains disabled because Native Binding API 2 lacks framework-safe verification-only current-passphrase validation.

## Runtime / Portfolio evidence

- one typed Wallet / Activity / Settings runtime;
- navigation contains public account IDs/destinations only;
- account switching refreshes Balance and ignores stale async results;
- exact native/issued balance strings and case-sensitive issued identity;
- LP shares and contract-account semantics remain explicit rather than coerced into ordinary Classic balances.

## Send / Payment evidence

PR #21 implements current Payment semantics:

- Classic `G...` destination only under the current contract;
- exact positive seven-decimal amounts;
- exact 28-byte UTF-8 text memo preservation;
- current source/destination state + ledger fee/reserve loading;
- missing destination + XLM -> `CreateAccount`; issued -> reject;
- source native minimum-balance/liability/fee availability;
- issued source/destination authorization and capacity with issuer special cases;
- SEP-29 memo-required enforcement;
- exact Payment/CreateAccount review from XDR;
- source/destination/operation/amount/asset/memo/fee context binding;
- shared freshness -> authorization -> signer -> Signing Coordination -> exact-XDR submission;
- watch-only/multiple-local-signer fail closed;
- accepted/rejected/uncertain remain distinct.

Normal CI and Realm Integration passed on the pre-native-integration PR #21 implementation head. Current-head attempts are intermittently blocked before checkout by runner allocation.

## Trustline / Manage Assets evidence

- exact `CODE:GISSUER` identity and case preservation;
- canonical default limit `708269837873.6765`;
- existing-line, issuer existence, self-trust and issuer-state checks;
- current reserve/fee/native availability preflight;
- zero balance/buying/selling liabilities required for removal;
- LP relationship protection and orphan-issuer removal;
- exact ChangeTrust review and semantic re-derivation before submit;
- shared Payment/Trustline transaction submission and Signing Coordination;
- watch-only and unsupported multiple-local-signer configurations fail closed.

## Path Payment platform evidence — PR #23

This is deliberately **not** a Mobile Swap policy contract while upstream #134 remains open.

- isolated `StellarPathPaymentGateway` rather than prematurely expanding the existing gateway contract;
- Horizon strict-send/strict-receive route normalization;
- provider ordering preserved; no “best route” selection;
- exact source/destination amount strings preserved;
- exact case-sensitive native/issued path asset identity;
- malformed/unknown path assets fail closed;
- caller-provided path, `destMin`/`sendMax`, fee and positive timeout construct unsigned PathPayment XDR;
- no slippage, quote age/expiry, requote, trustline/capacity or product-review policy is defined here.

## Recovery Export evidence — PR #24

`src/capabilities/signer/revealRecoveryMaterial.ts` and `src/features/security/RecoveryExportScreen.tsx` implement the first explicit existing-wallet recovery export surface.

Eligibility:

- account must exist;
- exactly one attached signer is required;
- signer must be complete `protected-software` with envelope + recovery kind;
- watch-only, multiple-signers, hardware/external and incomplete records remain unavailable/fail closed.

High-assurance reveal:

- UI requests a fresh app passphrase;
- passphrase is removed from React state before awaiting Core;
- SDK `reveal` receives opaque envelope + fresh passphrase + expected signer public key;
- returned `secret` vs `mnemonic` kind must match persisted recovery kind;
- no System Auth/biometric shortcut is substituted for this operation.

Sensitive-state boundary:

- navigation carries only `accountId`;
- revealed secret/mnemonic is screen-local only;
- Hide/Done clears revealed material;
- mnemonic passphrase/language/index are shown when Core returns them so recovery context is not lost;
- no automatic clipboard copy, Realm write or logging of recovery material was introduced.

Regression tests cover eligibility, watch-only, multiple/hardware signer rejection, exact Core reveal binding, recovery-kind mismatch, and public-ID-only navigation.

## Native gate evidence

- Android checkout-only adapter compatibility tracks upstream #128/#129 while retaining canonical adapter build + manifest/AAR/app-link verification.
- Apple runtime smoke keeps the real Realm read/write and `NativeModules.FresnicaCore.parseAccount` assertions.
- PR #22 exact combined head passed normal CI, Realm Integration, Native Android and Native Apple before merge into `feat/trustline-flow`.
- later #19/#21/#23 attempts have sometimes failed at `runner_id=0` / no steps; those are external runner failures, not code results.

## Application Security boundaries

```text
routine
  -> prefer System Auth when signer is enrolled
  -> otherwise require fresh app passphrase fallback

high-assurance Recovery Export
  -> require fresh app passphrase through Core reveal
  -> do not substitute System Auth
```

Still blocked on explicit upstream primitives:

1. framework-safe verification-only current-passphrase validation;
2. generic existing-domain System Auth challenge for app-session unlock;
3. dependent existing-wallet protected-signer provisioning / complete rotation-recovery workflows.

Mobile must not emulate them with dummy signing/XDR, `reveal`, `reprotect` or a second JS verifier/KDF.

## Persistence evidence

Realm v1 provides strict mapping, atomic writes, network-scoped duplicate identity, shared-signer preservation, orphan cleanup, account-to-signer lookup, backup-state updates and reopen persistence. Persisted data excludes plaintext mnemonic, secret, app passphrase, WalletUnlockKey, biometric state and Recovery Export results.

## Current next work

- obtain real runner execution for PR #21/#23/#24 when GitHub allocates runners; do not weaken/rewrite checks around `runner_id=0` failures;
- keep Path Payment product policy blocked on upstream #134 while retaining PR #23 as platform-only preparation;
- continue Stage 6 only with independent work that does not require missing Core authorization primitives;
- keep SDEX Offer Management separate from Path Payment Swap;
- keep Mainnet disabled until product/release gates are complete.

## Not yet implemented

- Path Payment Swap product semantics/UI pending #134;
- SDEX offer-management product surface;
- Trustline Set Limit UI;
- Asset Discovery/catalog;
- specialized operation-details flow;
- persistent History cache/search/filter;
- app lock/session;
- existing-wallet protected-signer provisioning;
- complete passphrase rotation/recovery;
- Realm database encryption-key lifecycle;
- full multisig and hardware/external signer coordination;
- Agent/AI standing authorization;
- Mainnet enablement.

## Contribution rule

When Mobile exposes a Fresnica SDK/adapter/documentation inconsistency, contribute a concrete upstream reproduction/fix instead of hiding a permanent Mobile-only compatibility layer.
