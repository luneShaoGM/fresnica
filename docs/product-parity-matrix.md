# Fresnica Mobile Product Parity Matrix

> Product reference: `luneShaoGM/Stellar` branch `stellar-migration`.
>
> Engineering reference: `XRPL-Labs/Xaman-App` patterns, adapted rather than copied.
>
> Runtime/security authority: current Fresnica Mobile source plus upstream Fresnica Application Capability contracts.
>
> This matrix is a planning and migration map. A donor screen existing in Stellar/Xaman does not automatically mean Fresnica must ship the same implementation or protocol semantics.

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `REUSE` | Current Fresnica capability/runtime behavior is reusable with little or no semantic change. |
| `REBUILD_UI` | Capability/data behavior exists, but the product screen/layout/flow must be rebuilt to match Stellar. |
| `PARTIAL` | Some required product behavior exists, but missing product states or capability work remains. |
| `BLOCKED` | Product work is gated by a missing shared Fresnica capability/security contract. |
| `NEW` | No equivalent Fresnica product surface exists yet. |
| `DEFERRED` | Valid product idea, but not part of the current parity stage. |
| `DONOR_RESIDUE` | Donor-era/XRPL/vendor-specific surface that must not be copied unless a current Fresnica requirement justifies it. |

## Top-level product shell

| Stellar surface | Target Fresnica feature | Current Fresnica source | Capability/runtime dependency | Status | Stage |
| --- | --- | --- | --- | --- | --- |
| Home tab | `features/home` | `features/portfolio` + current wallet shell | Account, Balance, Trustline | `REBUILD_UI` | P1/P2 |
| Events tab | `features/events` | `features/history` | History | `REBUILD_UI` | P1/P5 |
| Actions center entry | app navigation + feature action surface | no equivalent five-entry shell | navigation only; actions route to feature capabilities | `NEW` | P1 |
| XApps tab | `features/xapps` | none | future dApp authorization/bridge boundaries | `NEW` | P1/P9 |
| Settings tab | `features/settings` | `features/settings`, `features/security` | Application Security, Account, network/config mechanisms | `REBUILD_UI` | P1/P10 |

Target top-level navigation:

```text
Home | Events | Actions | XApps | Settings
```

`Actions` is not a normal destination tab. It opens an action surface and leaves the selected product tab unchanged.

## Onboarding and setup

| Stellar surface | Target Fresnica feature | Capability/runtime dependency | Status | Notes |
| --- | --- | --- | --- | --- |
| Onboarding | `features/onboarding` | Account + Application Security | `REBUILD_UI` | Preserve Stellar screen rhythm; keep Fresnica account/security authority. |
| Passcode setup | `features/onboarding` / `features/security` | Application Security | `PARTIAL` | Use current app-passphrase/System Auth model; do not recreate donor verification/KDF logic. |
| Biometry setup | `features/onboarding` / `features/security` | Application Security + OS auth adapter | `PARTIAL` | Product UI can be rebuilt where the current security contract supports it. |
| Push notification setup | future notification feature | notification capability not yet established | `DEFERRED` | Do not pull Firebase/push architecture from donor automatically. |
| Finish setup | `features/onboarding` | onboarding state | `REBUILD_UI` | Presentation/state transition only. |

## Account lifecycle

| Stellar surface | Target Fresnica feature | Current Fresnica source | Capability dependency | Status |
| --- | --- | --- | --- | --- |
| Account Add | `features/accounts` | `features/accounts` | Account | `REBUILD_UI` |
| Account Import | `features/accounts` | onboarding/accounts flows | Account + Signer/Application Security | `REBUILD_UI` |
| Account Generate | `features/accounts` | onboarding/accounts flows | Account + Signer/Application Security | `REBUILD_UI` |
| Account List | `features/accounts` | `features/accounts` | Account + persistence repository | `REBUILD_UI` |
| Account Edit | `features/accounts` | partial account/settings surfaces | Account | `PARTIAL` |
| Change passphrase | `features/security` / account security action | current Application Security work | Application Security / Fresnica Core | `PARTIAL` |
| View mnemonic | `features/security` / account reveal | not complete product parity | Application Security + Signer | `PARTIAL` |
| View secret key | `features/security` / account reveal | not complete product parity | Application Security + Signer | `PARTIAL` |
| Tangem security | none by default | none | external signer provider | `DONOR_RESIDUE` |
| Cipher migration | migration-only surface if required | current Fresnica storage has different authority | persistence/Core migration | `DONOR_RESIDUE` |

External signer/vendor screens are not included merely because Xaman/Stellar once exposed them. They require an explicit current signer-provider product requirement.

## Home and asset presentation

| Stellar behavior | Target Fresnica component/feature | Current implementation | Capability dependency | Status |
| --- | --- | --- | --- | --- |
| Account switch header | `features/home/components/AccountSwitcher` | current account selection/navigation logic | Account | `REBUILD_UI` |
| Network indicator/switch entry | Home + network overlay | basic network settings route | network/config mechanism | `PARTIAL` |
| Send action | Home action -> Send | current Send flow exists | Payment | `REUSE` behavior / `REBUILD_UI` entry |
| Swap action | Home action -> Exchange | transport preparation only | shared Path Payment/Swap contract | `BLOCKED` semantics |
| Request action | Home action -> Request/share | none as Stellar-style flow | account/share/QR | `NEW` |
| Asset list | `features/home` + feature-local asset row | `features/portfolio` | Balance + Trustline | `REBUILD_UI` |
| Add token | `features/assets` | `features/trustlines` manage-assets flow | Trustline | `REBUILD_UI` |
| Token settings/details | `features/assets` | partial trustline presentation | Trustline | `PARTIAL` |
| No-account state | Home | onboarding/portfolio alternatives | Account | `REBUILD_UI` |
| Inactive-account state | Home | capability facts exist | Balance/account ledger state | `REBUILD_UI` |

## Send / transaction review / submission

| Stellar surface | Target Fresnica feature | Current Fresnica source | Capability dependency | Status |
| --- | --- | --- | --- | --- |
| Send | `features/send` | `features/send` | Payment | `REBUILD_UI` |
| ReviewTransaction modal | shared transaction review presentation owned by transaction feature/surface | Send review screen | Payment + Transaction | `REBUILD_UI` |
| Submit modal | shared submission presentation | Send flow/result | Transaction + Signing + Ledger Authorization | `REBUILD_UI` |
| TransactionLoader | shared modal/overlay primitive | local loading states | none beyond invoking feature state | `NEW` UI primitive |
| Select asset/currency | Send/Exchange feature picker | basic inline selection | Balance/Trustline | `REBUILD_UI` |
| Destination picker | Send feature picker/address source | none | future address/contact support | `NEW` |
| Fee selector | transaction option surface if supported | no current product surface | Transaction | `DEFERRED` until explicit fee policy/product requirement |

Payment semantics, exact amounts, exact-XDR review identity, authorization and submission remain owned by current Fresnica capabilities. The donor flow supplies presentation/interaction rhythm only.

## Events and transaction details

| Stellar surface | Target Fresnica feature | Current Fresnica source | Capability dependency | Status |
| --- | --- | --- | --- | --- |
| Events | `features/events` | `features/history` | History | `REBUILD_UI` |
| Transaction details | `features/events` | operation details route/history models | History | `REBUILD_UI` |
| Filter Events | `features/events` modal/filter state | not complete | History read model | `PARTIAL` |
| Connection issue presentation | shared UI/system status | generic error states | network/system adapter | `NEW` shared presentation |

The current History capability remains the data boundary; raw Horizon records/cursors do not enter product navigation.

## Exchange / Swap

| Stellar surface | Target Fresnica feature | Current Fresnica source | Capability dependency | Status |
| --- | --- | --- | --- | --- |
| Exchange | `features/exchange` | no final product flow | Path Payment/Swap | `BLOCKED` semantics / `NEW` UI |
| SelectCurrency | Exchange-local/shared asset picker | none in target form | Balance/Trustline | `NEW` UI |
| Quote/loading/error presentation | Exchange state | none in target form | future Path Payment/Swap quote contract | `NEW` UI |
| Exact review | Exchange review screen | no normative swap review yet | future Path Payment/Swap | `BLOCKED` |

UI structure can be built before the normative capability is complete, but quote identity, strict-send/strict-receive, freshness, slippage and signing policy must not be invented locally.

## Request / share / QR

| Stellar surface | Target Fresnica feature | Capability/runtime dependency | Status |
| --- | --- | --- | --- |
| Request | `features/request` | account public identifier + QR/share mechanism | `NEW` |
| ShareAccount | `features/request` overlay | account public identifier | `NEW` |
| Scan | shared system scanner surface | camera/QR adapter | `NEW` |
| SelectAccount | reusable picker with product-local data | Account | `NEW` UI primitive/feature component |

XRPL destination-tag flows are not Stellar semantics:

- `EnterDestinationTag` -> `DONOR_RESIDUE`
- `ConfirmDestinationTag` -> `DONOR_RESIDUE`
- destination-tag-specific warnings/actions -> `DONOR_RESIDUE`

They must not enter Fresnica Stellar flows unless an explicit future protocol/product requirement replaces them with Stellar-native semantics.

## Asset/trustline overlays and details

| Stellar surface | Target Fresnica feature | Capability dependency | Status |
| --- | --- | --- | --- |
| AddToken | `features/assets` | Trustline | `REBUILD_UI` |
| TokenSettings | `features/assets` | Trustline | `PARTIAL` |
| SwitchAssetCategory | asset presentation filter | Balance/Trustline read model | `DEFERRED` until reference behavior is required |
| LPDetails | future asset/liquidity-pool feature | liquidity pool capability not established | `DEFERRED` |
| ClaimableDetails | future claimable-balance feature | claimable balance capability not established | `DEFERRED` |

## Security, auth and lock surfaces

| Stellar surface | Target Fresnica feature/UI | Capability dependency | Status |
| --- | --- | --- | --- |
| Authenticate overlay | shared auth presentation | Application Security | `REBUILD_UI` |
| PassphraseAuthentication | shared auth presentation | Application Security | `REBUILD_UI` |
| Lock overlay | app lock presentation | Application Security/Core primitive | `PARTIAL` / some behavior blocked |
| Vault overlay | none | old donor Vault implementation | `DONOR_RESIDUE` |
| CriticalProcessing | shared blocking/progress presentation | feature state | `NEW` UI primitive as needed |
| FlaggedDestination | only if a current advisory policy exists | explicit advisory capability required | `DEFERRED` |

Do not recreate the donor Vault, dummy-signing authorization tricks or JavaScript cryptographic verifiers to mimic missing Fresnica Core security primitives.

## XApps / dApp

| Stellar surface | Target Fresnica feature | Capability/security dependency | Status |
| --- | --- | --- | --- |
| XApps tab | `features/xapps` | dApp connection/permission model | `NEW` |
| XAppBrowser | `features/xapps` | browser bridge + explicit authorization | `NEW` |
| InAppBrowser | shared browser surface if product needs it | system browser/webview adapter | `NEW` |
| XAppInfo | `features/xapps` | dApp metadata | `NEW` |
| DappPermission | `features/xapps` | explicit permission contract | `NEW` |
| DappDisclaimer | `features/xapps` | product policy | `NEW` |
| ConnectedDapps | Settings/Security | dApp connection registry | `NEW` |
| CustomXAppUrl | developer/advanced xapp surface | explicit developer policy | `DEFERRED` |
| ThirdPartyApps | Settings/XApps | explicit app connection model | `DEFERRED` until XApps core exists |

The donor Freighter-compatible bridge is implementation research, not authority to bypass current Fresnica signing/security boundaries.

## Settings

| Stellar surface | Target Fresnica feature | Current Fresnica source | Status |
| --- | --- | --- | --- |
| Settings home | `features/settings` | current settings | `REBUILD_UI` |
| General | `features/settings` | partial | `REBUILD_UI` |
| Security | `features/security` | current security settings | `REBUILD_UI` |
| Network list | `features/settings` | network settings route | `REBUILD_UI` |
| Add network | `features/settings` | no equivalent full product flow | `PARTIAL` |
| Advanced | `features/settings` | partial | `DEFERRED` until concrete entries are prioritized |
| Developer settings | `features/settings` | partial developer concepts | `DEFERRED` |
| Session log | diagnostics feature | none | `DEFERRED` |
| Realm viewer | developer-only persistence inspector | none | `DONOR_RESIDUE` unless explicitly useful for Fresnica development builds |
| Terms of Use | Settings/legal | none | `NEW` when legal copy is supplied |
| Credits | Settings/about | basic About route | `PARTIAL` |
| Address book | future contacts feature | none | `DEFERRED` |

## Generic modal/overlay vocabulary

These are presentation mechanisms, not application capabilities. Add them to `ui/components` only when they are domain-agnostic and have proven reuse.

| Donor surface | Target treatment |
| --- | --- |
| Alert | shared UI primitive |
| Picker | shared UI primitive or feature-local picker shell |
| CurrencyPicker | feature component first; promote if reuse is proven |
| DestinationPicker | Send/Request feature component first |
| TransactionLoader | shared transaction/progress primitive if multiple transaction flows reuse it |
| HomeActions | app/Home action surface |
| SwitchAccount | account/home feature overlay |
| SwitchNetwork | settings/home network overlay |
| ExplainBalance | Home/asset feature presentation if still useful |
| ParticipantMenu | `DEFERRED`; product semantics must be defined first |
| RequestDecline | `DONOR_RESIDUE` unless a current request protocol requires it |
| NetworkRailsSync | `DONOR_RESIDUE` unless a current Fresnica network-rail feature is defined |
| PurchaseProduct | `DONOR_RESIDUE` unless a current monetization requirement is defined |
| MigrationExplain | migration-only, create only for a real Fresnica migration |
| ChangeLog | optional About/release surface, not parity-critical |
| Help | optional product/help surface, content required before implementation |

## Target route inventory

The P1 navigation rewrite should replace the current `wallet / activity / settings` tab vocabulary with this product-safe inventory.

### Root flows

```text
bootstrap
onboarding
locked
main
```

### Main product tabs

```text
home
events
xapps
settings
```

`actions` is a center action trigger, not an ordinary tab state.

### Core screen routes

```text
home
account-add
account-import
account-generate
account-list
account-edit
send
request
exchange
events
transaction-details
settings
settings-general
settings-security
settings-network
about
```

Additional routes are added only when a migrated product surface needs them.

### Modal/overlay route families

```text
review-transaction
submit-transaction
scan
currency-picker
destination-picker
transaction-loader
switch-account
share-account
add-token
authenticate
lock
token-settings
alert
select-account
select-currency
home-actions
switch-network
dapp-permission
dapp-disclaimer
```

Do not place mnemonic, passphrase, decrypted signer material, raw secret or exact transaction XDR in navigation parameters. Feature/controller state retains sensitive or exact-identity transaction state inside the owning flow.

## Architecture migration notes discovered during P0

The target dependency model is stricter than some current validated Capability code. For example, current Payment preparation still imports the Stellar SDK and concrete platform gateway/types directly. This is migration debt, not a reason to destabilize Payment before its owning capability is deliberately refactored and revalidated.

Therefore:

1. New/rebuilt feature and UI surfaces obey the target boundary immediately.
2. Existing capability coupling does not grow.
3. A capability boundary is tightened when that capability is already being changed for a product/normative reason.
4. Security/exact-XDR invariants outrank cosmetic architectural cleanup.
5. `scripts/check-architecture.mjs` expands strict scopes as each legacy product feature is migrated.

## Immediate implementation order after P0

```text
P1A  semantic UI primitives actually required by shell
  -> P1B five-entry shell + Actions trigger
  -> P2A Home header/account/actions
  -> P2B Home asset/no-account/inactive states
  -> P3 onboarding/accounts
  -> P4 Send parity
  -> P5 Events parity
  -> P6 Assets/trustlines
  -> P7 Exchange UI while shared semantics remain gated
  -> P8 common request/modal/overlay vocabulary
  -> P9 XApps
  -> P10 Settings/Security/Network
  -> P11 parity/hardening pass
```

Each stage must name the Stellar reference surface, the Fresnica feature owner, the required Capability(s), and the strict architecture scope added in that PR before implementation begins.
