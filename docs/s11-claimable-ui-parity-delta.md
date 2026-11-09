# S11 Claimable UI Parity — Stellar source-to-Fresnica follow-up

**Baseline:** merged `main@f898e8f04e9096dfdd553d00400e5dbc73f20978` (PR #178).
**Visual behavior reference:** team-owned `origin/Stellar@bd0f4540b2496a57314e4e29bc6fcf8ff691b60f`.
**Decision:** Adopt Claimable product interaction and adapt presentation to
Fresnica native components; do not copy legacy RNN or signing paths.
**Scope:** Home category presentation and Claimable UI only, plus a small
network/account-partitioned public snapshot `everSeen` flag for category
visibility. No new signing, key, network, Horizon paging, or Realm schema.

| UI element | #178 baseline | Stellar / this UI parity | Reason or remaining difference |
| --- | --- | --- | --- |
| Home asset category | Separate `Claimable` text link navigates to a native-stack page | `Assets ▼` opens an in-place category chooser; Claimable appears inside Home asset area | Restores source Home information architecture without importing Wix Navigator |
| Asset category choices | Claimable link always shown for Classic account | Assets and Claimable only when current/previous claimables exist, or Developer Mode is on | LP remains hidden until SDEX/LP capability and UI are implemented |
| Claimable discovery | Only fresh cache counts, historical empty list loses access | `everSeen` persists with already-public current account/network snapshot; empty follow-up list retains category; no cross-partition leakage | Never add a global discovery flag or infer another network |
| Claimable hint | Inline `Claimable (N)` link | Compact clock icon and fresh SAFE/claimable count adjacent to Assets title; one-tap switch | Reuse RN SVG for original-style icons without copying assets |
| Claimable list | Separate full-screen cards, status under left asset identity | Inline Home list; compact avatar + asset/code/issuer left, amount/state right; SAFE first | Reuses `TokenAssetIcon`, keeps full precise amount without floating-point formatting |
| Issuer identity | Long issuer string in row | Short masked address in list, **full issuer in details and final Review** | Stellar prefers issuer domain if verified metadata is present; no trusted domain data source has been approved for this UI slice |
| Risk sections | Plain titles and unicode up/down markers | Orange warning and muted SPAM bounded toggle rows, SVG chevrons; spam collapsed, View More adds 20 | Preserve the existing risk heuristics, not upgrade a token to trusted due to presentation |
| Claimable detail presentation | BottomSheet with technical fields ahead of claim action | Centered scrollable `AppModal` dialog with identity/amount, explicit availability status card, Claim action, caution and expandable technical details | Current `AppModal` bounds dialog height; long IDs remain accessible while action stays reachable on small screens |
| Locked / unknown | Simple status text | Visible status card, localized next time and precise unknown-predicate reason; disabled Claim when unavailable | Cannot invent creation epoch for relative predicates; eligibility remains fail-closed |
| Review | In-scroll slider in independent Claimable route | Full-screen native `Modal` review over Home with a **fixed bottom** `SlideToConfirm`; exact account, credit issuer, ID, amount and fee retained | Do not import old Stellar ReviewTransaction/SwipeButton signing logic |
| Return/navigation | Browser-like back through Claimable route | Category switch stays on Home; close details returns to list; transaction review is a separate visual step only | Legacy `claimable` route removed from route declarations/status to prevent stale navigation |
| Asynchronous session retirement | Focus/account-only guard tied to Claimable route | Current account/network + Home navigation focus + **non-revivable category selection epoch** guard through existing S11 signer path | A rapid Claimable → Assets → Claimable sequence cannot reauthorize an old request; pending transactions retain original-hash recovery |
| Unavailable/error states | Independent-page refresh button and long introduction | Home pull-to-refresh drives Claimable listing; empty/error/stale states stay in current category | Read-only display on stale data; no stale signing permission |

### Product acceptance and evidence boundaries

Home navigation (Assets ⇄ Claimable) and Claimable detail are UI
interactions, not ledger events. They must not mutate signer,
transaction XDR or pending state. Existing Claimant/predicate, native
signer authorization, exact-XDR inspection, uncertainty and recovery
remain protected by the existing SDK/Core pipeline. Any proposed
native-product-flow acceptance requires separate emulator/real-device
evidence. Stage 9 iOS System Auth cancel→retry is still deferred.

Automated coverage in this PR: category chooser and unsupported LP
hiding, in-Home Claimable list/centered dialog, current vs historical
Claimable discovery, non-revivable session epoch, existing Claimable
authorization and original pending recovery regression. Independent
Work exact-HEAD review remains required before the user decides
whether to merge this UI PR.
