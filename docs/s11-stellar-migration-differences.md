# S11 Claimable — source-to-target implementation difference register

Source inventory: `origin/Stellar@bd0f4540`,
`TokensList`, `ClaimableItem`, `ClaimableDetailsOverlay`,
`ClaimableBalanceService`, `claimablePredicate`, LedgerService,
Claimable repository, category switch, transaction/payload adapter.
User's source-rights declaration: S11 custom feature is self-developed
and approved for migration (2026-11-09). Current project
`docs/provenance/README.md` requires *file-level rights evidence
plus an explicit record* for direct copy. We used behavior-level
adaptation into Fresnica and did not transfer entire source blobs,
third-party styles/assets, old Xaman inheritance or signing code.

| Stellar original | Fresnica S11 difference | Why |
| --- | --- | --- |
| Home assets category dropdown (Tokens / LP / Claimable) | **Updated in UI parity PR:** Home `Assets ▼` category dialog and in-place Claimable content; no separate navigation route; LP remains hidden | Align Stellar's Home behavior without importing Wix Navigator or exposing unfinished SDEX/LP |
| Custom Class component, raw color styles, `ClaimableItem` | Functional `ClaimableScreen`, semantic `AppTheme`, shared `TokenAssetIcon`, **centered bounded `AppModal`** | Reuse completed UI kit and avoid modifying parallel #177 icon logic |
| Claimable item safe/suspect/spam groups, spam load 20 | Same three groups and view-more chunk of 20 | Preserve visible product behavior |
| Dynamic quantity hint via `ListHeader` | In-Home clock icon/count badge next to the category header from a current-network/account fresh SAFE + claimable snapshot | Reinstates source hierarchy without copying source icons |
| Horizon page 50, max 3 / 150 entries, replacing cache | 50/page up to 20, cap 1,000; incomplete page/cursor/data refuses cache overwrite | Prevent silent loss of balances on pagination cutoff |
| Claimant lookup falls back to first claimant | Exactly one matching Claimant required | Fail closed for unrelated account; no speculative recipient |
| `last_modified_time` can stand in for creation time for relative predicate | Relative predicate with unproven creation epoch remains UNKNOWN; Claim disabled | Avoid incorrect eligibility decisions |
| Registry trustline/curated whitelist and network sponsor reputation heuristics | Native XLM SAFE; unknown credit SUSPECT, large/burst SPAM; user overrides only change display | No unapproved issuer or sponsor authority is fabricated; richer evidence deferred |
| 1 h snapshot + 30 s retry; cache by account/network | Same policy in Realm v13 with strict snapshot validators, session retirement and display-only overrides | Keep old Realm schemas and partition isolation, no global service singletons |
| Claim builds SDK transaction with fixed fee and unbounded timeout, calls legacy payload adapter | Current live fee, bounded 180 s XDR, independent exact operation inspector, SDK/Core signing/recovery; final approval explicitly shows credit issuer | Never bypass Fresnica authorization / exact-XDR intent / uncertain submit invariants; verify full asset identity at last confirmation |
| Activity claim/clawback history can infer visibility from S11 risk | Existing S13 history retained; S11 does not rewrite Activity filters | Avoid repeating validated Activity behavior; cross-feed linking requires separate audit |
| Unavailable/missing authoritative claim | Stale read-only cache, explicit refresh and disabled Claim; in-flight result retirement | No stale balance can be treated as spend authority |
| Generic permission and navigation closures | Account/network/Home focus checks and a **non-revivable category selection epoch** across live reads, ledger authorization and native signing, with a final check before pending/broadcast | Prevent fast Claimable → Assets → Claimable reactivation; preserve recovery once pending is durable |

### 2026-11-09 UI parity follow-up

The original S11 PR #178 was merged. Its first UI layout was not Stellar
parity: it navigated to an independent Claimable page and used an
independent BottomSheet. The subsequent dedicated UI PR preserves
the S11 Capability/SDK/Core transaction contract and replaces only
presentation and immediate category session gates. See
[Claimable UI parity before/after matrix](s11-claimable-ui-parity-delta.md)
for every changed element and intentional difference.

### Exact scope and evidence

S11 logic was delivered as PR #178; UI parity is a **single dedicated
follow-up PR** with tests and documentation, not a new signing pipeline.
This register
does not claim native-device product acceptance or a direct migration
approval of every historical file. Any later improvement to SDEX
category switching, sponsor-reputation evidence or activity risk
filtering must be evaluated independently, not silently folded
into S11. Existing donor collision/provenance and repository guards
remain enforced.
