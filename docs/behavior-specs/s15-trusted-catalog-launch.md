# S15–S18 — Live FChain catalog launch and bounded read-only Freighter connection (2026-11-06)

**Delivery status:** product-flow candidate, pending independent Work exact-HEAD
review and user merge. Based on `main@46b222f72a9535a498e79875e5c265f5aca7af60`
(after S10 PR #175). Product owner: `features/dapps`, with
`capabilities/dapp-interaction` for one-use session semantics,
`platform/dapps` for live API read/validation, and
`app/navigation` for in-memory launch wiring. Traceability:
S14 catalog, S15 launch, S16 native browser, S17 read grants, S18 Freighter.
Donor decision: **Adapt** only the user-facing trusted directory launch
behavior from Stellar/Freighter. No donor source, SDK or bridge code copied.

## Current implementation candidate — 2026-11-26

Owner-approved product behavior: the pinned FChain API directory is the trust
source for a read-only first connection, on explicit in-app launch. This is
clean-room Adapt of Stellar `3dc7194` catalog-origin behavior, not a copy of
its broader cached-catalog policy or signer. Phase 0 is passed; Stage 7
S14–S18 retain their existing maturity. Scope: dApp catalog adapter and App
composition, DApps navigation/feature, and Freighter disclosure only. No new
OS permissions, native transports, schema, credentials or signing methods.

1. Catalog discovery remains public. The details sheet shows the actual
   network-specific launch URL and the existing address-only auto-connect
   notice when eligible. A user must deliberately choose Open in App
   while the current details are fresh and their URL matches the list.
2. Only the pinned `https://dapp.fchain.io/v1` adapter is opted in by App
   composition. It requires a fresh valid non-redirected HTTPS response on the
   active Mainnet/Testnet context and the exact directory ID and launch URL.
   Conditional HTTP 304 may only renew a response already validated from a
   live HTTP 200 in this network session, never a disk-only cache. Offline,
   failed or in-flight refresh, non-directory entries and stale or mismatched
   detail URLs do not qualify. HTTPS is not a guarantee about site content;
   the operator is a trust dependency for public-address disclosure.
3. Reuse the existing 30-second single-use App-memory launch proof. Keep it
   bound to the selected account and network revision and exact launch URL.
   It applies only after the native WebView confirms the first nonredirected
   top-level document committed at the exact launch URL. Reload, full
   navigation or redirect retires it. If native confirmation is unavailable,
   ordinary consent applies. Close, revocation and account/network changes
   retire permission. Public-address and public network reads require a site
   request. Their replies use the native channel of that request and are
   dropped when its document retires. Automatic read access does not send
   a user-configured Horizon endpoint or create a durable grant.
4. Manual URL, Recent, cache-only directory, external-browser fallback and
   unverified origin still need ordinary S17 consent. Existing Allow Always
   grants remain scoped to origin, account and network. A pending consent
   belongs to the requesting document. Cross-origin navigation retires it as
   soon as it is reported, even before the next document starts. A retired
   request cannot persist a grant.
5. No signature, submission, notification or asset write is authorized by
   the directory. For supported requests the wallet still displays the exact
   transaction or SEP-53 message for independent review, requires a fresh
   App Passphrase, and returns only an explicitly approved result; it does
   not broadcast. No new support for arbitrary Soroban XDR, auth-entry or
   token requests.

## Platforms and evidence

Android in-app WebView is already gated by the **merged** S16 native
public-address HTTPS proxy/POST/redirect protection. iOS uses the existing
embedded surface. A missing native Android guard keeps the existing
external-browser fallback; this PR does not install or weaken native
network enforcement.

Automated tests cover default-off even for a fresh live200/conditional304,
independently reviewed tuple matching, cross-network/wrong URL denial and
stale/invalid/unsupported entries; time bounds and public account/selection
binding; actual URL display vs 24-hour cached detail mismatch and no-media
fallback, detail-sheet cancel/reopen/late callbacks; conditional first
document Freighter reads in isolated test fixtures, navigation/reload,
revoke and independent transaction inspection. The test-only approved
fixture is **not** an approved real production dApp.

**Not accepted:** provider editorial assurance, actual HTTP/WebView/Freighter
site integration, cross-platform device UI, device denial/redirect fixtures,
background/cancel/retry flows or Stage 9 real iOS System Auth cancel→retry.
Repository tests and Android native proxy mechanism tests cannot substitute
for native product-flow acceptance. This slice does not upgrade S15–S18
to L4.
