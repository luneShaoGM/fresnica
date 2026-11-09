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
| Home assets category dropdown (Tokens / LP / Claimable) | Home Tokens section has a localized Claimable link/count and a separate native-stack Claimable route | No Wix Navigator or legacy LP/category modal is imported; avoid touching unfinished SDEX/LP and preserve Home balance UX |
| Custom Class component, raw color styles, `ClaimableItem` | Functional `ClaimableScreen`, semantic `AppTheme`, shared `TokenAssetIcon`, `BottomSheet` | Reuse completed UI kit and avoid modifying parallel #177 icon logic |
| Claimable item safe/suspect/spam groups, spam load 20 | Same three groups and view-more chunk of 20 | Preserve visible product behavior |
| Dynamic quantity hint via `ListHeader` | Current-network/account fresh cached SAFE + claimable count beside the Home entry | Same user intent, adapted to current Home composition |
| Horizon page 50, max 3 / 150 entries, replacing cache | 50/page up to 20, cap 1,000; incomplete page/cursor/data refuses cache overwrite | Prevent silent loss of balances on pagination cutoff |
| Claimant lookup falls back to first claimant | Exactly one matching Claimant required | Fail closed for unrelated account; no speculative recipient |
| `last_modified_time` can stand in for creation time for relative predicate | Relative predicate with unproven creation epoch remains UNKNOWN; Claim disabled | Avoid incorrect eligibility decisions |
| Registry trustline/curated whitelist and network sponsor reputation heuristics | Native XLM SAFE; unknown credit SUSPECT, large/burst SPAM; user overrides only change display | No unapproved issuer or sponsor authority is fabricated; richer evidence deferred |
| 1 h snapshot + 30 s retry; cache by account/network | Same policy in Realm v13 with strict snapshot validators, session retirement and display-only overrides | Keep old Realm schemas and partition isolation, no global service singletons |
| Claim builds SDK transaction with fixed fee and unbounded timeout, calls legacy payload adapter | Current live fee, bounded 180 s XDR, independent exact operation inspector, SDK/Core signing/recovery; final approval explicitly shows credit issuer | Never bypass Fresnica authorization / exact-XDR intent / uncertain submit invariants; verify full asset identity at last confirmation |
| Activity claim/clawback history can infer visibility from S11 risk | Existing S13 history retained; S11 does not rewrite Activity filters | Avoid repeating validated Activity behavior; cross-feed linking requires separate audit |
| Unavailable/missing authoritative claim | Stale read-only cache, explicit refresh and disabled Claim; in-flight result retirement | No stale balance can be treated as spend authority |
| Generic permission and navigation closures | Account/network/active route checks and a captured focus epoch across live reads, ledger authorization and native signing, with a final cancellation check before pending/broadcast | No old-account broadcast after route/account retirement; preserve recovery if pending is already durable |

### Exact scope and evidence

This remains a **single S11 PR** (one transaction pipeline, one
product slice), with tests and documentation included. This register
does not claim native-device product acceptance or a direct migration
approval of every historical file. Any later improvement to SDEX
category switching, sponsor-reputation evidence or activity risk
filtering must be evaluated independently, not silently folded
into S11. Existing donor collision/provenance and repository guards
remain enforced.
