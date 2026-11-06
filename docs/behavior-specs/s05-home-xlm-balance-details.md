# S05 Home: fixed native XLM, verified available/reserved balance and details

2026-11-06, follow-up on PR #177 (base after S06 #174).

## Display behavior
- The XLM row is always separate and above issued Tokens for an active Classic account. It is not inside issued-asset search, reorder, hide or scroll. Header/account controls can scroll in their own bounded region on short screens; issued Tokens scroll in their own region below the pinned XLM row.
- Inactive/unsupported accounts must not fabricate a native balance or a reserve. Mainnet/Testnet use the same presentation but distinct account/network authority.
- The native row shows the raw account balance and only verified available and reserved values. While unknown, stale, refreshing, invalid or mismatched, show a placeholder, never an assumed available figure.
- Tapping native XLM opens the shared AppModal sheet presentation, with swipe-to-dismiss, native Back and backdrop close. The content scrolls and retains the existing balance freshness/retry affordance. The separate issued-asset action sheet remains functional.
- The native detail includes total, available, total reserved, base account reserve, subentry/sponsored reserve before offsets, sponsorship offset, locked sell-offer liabilities and counts. It lists the current network's credit trustlines and issuer identities, WITHOUT pretending a unique per-line reserve can be inferred from balances.
- This is reserve/sponsorship accounting, not network staking, staking yield, or XRPL reserve object enumeration. Only actual Horizon account-state trustlines are displayed. No XRPL account_objects, NFT page or other unsupported object is copied from the former Stellar UI.

## Ledger authority and failure boundaries
- Read-only display uses existing session-bound StellarSdkGateway.loadAccountState(account.address) and loadLedgerParameters. It does not alter the payment/Swap preflight, authorization, signers, exact-XDR review or submit/recovery decisions.
- Every read validates matching account address and network partition. If the network is retired, read fails or an account is inactive, no derived available amount is accepted.
- Amounts use exact integer stroops (seven decimal places). Base reserve uses current ledger reserve parameter; sponsored reserve formula follows existing transaction preflight: max(0, 2 + subentry_count + num_sponsoring - num_sponsored) times base_reserve. Available = max(0, native gross - required reserve - selling liabilities).
- Gross base and subentry reserve are presented alongside an explicit sponsor-funded offset. Trustlines appear as an identity/list only, not falsely attributed per-trustline costs.
- The read model only displays when its raw native total matches the independently refreshed Home/Sheet balance snapshot; an unavailable, older or mismatched projection does not silently carry to a different account/network. Account and reader identity are also checked for each hook render. Quiet refresh keeps the last matching display until a newly validated result arrives, while stale/error states display unknown.
- No derived reserve data is persisted to Realm or granted financial authority. Native device interaction/visual acceptance remains deferred with Stage 9 iOS System Auth retry/cancel.

## Acceptance
- XLM remains visible while the issued Token list scrolls, including reorder and zero/filtered credit assets; short-screen headers remain scrollable independently.
- Native row and detail are consistent with verified raw chain state. A changing total must hide old available until a matching ledger read arrives.
- Sponsorship, subentry counts, sell liabilities, valid zero available, decimal precision, negative/invalid ledger values, inactive account and cross-network mismatches are covered by automated tests.
- Image fallback on #177 uses only the separately user-authorized Token image family recorded in the provenance approval. No other images are included.
