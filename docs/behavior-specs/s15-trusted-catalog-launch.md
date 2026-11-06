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

## User journey and trust boundary

1. The S14 FChain directory remains a **public data source**, not a general
   security attestation. A user explicitly opens a listing's **read-only
   detail sheet**, then chooses **Open in App**. Metadata and optional
   public icons remain display-only; neither changes wallet permissions.
   If the native WebView is unavailable, selection returns to the existing
   untrusted URL confirmation and explicit system-browser handoff.
2. Only the configured `https://dapp.fchain.io/v1` adapter can indicate a
   **recently live and structurally valid** network-specific listing:
   a verified HTTPS 200 response, or 304 conditional on an already validated
   same-network cached response with ETag or Last-Modified. Redirected,
   malformed, unsupported-network, stale/offline, failed or detached
   responses never mint trust. The adapter retains only the exact
   `appId -> normalized launch URL` in memory for **at most 5 minutes**.
   Refresh starts by retiring the former proof, including failed refreshes.
   Cold Realm hydration does not mint trust.
3. The explicit user action must still be active and focused on the current
   list version. Only a matching current catalog row and the exact verified
   URL can produce a new **30-second**, single-use, non-serialized launch
   proof. Proof binds the selection's immutable account ID, public address,
   network ID/passphrase, Horizon URL and monotonic selection revision.
   Browser navigation parameters contain **only the public URL**, no trust
   flag or sensitive data. Manual URL, Recent, stale detail callback,
   dismissed sheet and untrusted sample cannot mint proof.
4. App composition consumes that proof once when initializing the browser
   route. The target HTTPS origin must exactly match. Native WebView
   main-frame source checks, message nonce, per-document replay filtering
   and network guards remain mandatory. A trusted **first exact main
   document** may read the selected public address, Freighter connection
   status and public network details without another connection dialog.
   A subsequent document reload, redirect, changed launch path, cross-origin
   document **or navigation-state** change permanently retires this
   shortcut, even on returning to the original origin. SPA History API
   changes do not count as a new document.
5. This shortcut is **not Allow Always**: it creates no Realm permission
   grant and does not persist across browser closure, focus/session
   retirement, account/network revision or grant revocation. Other sites,
   accounts, networks and manual links still need S17 permission.
6. **No signing shortcut** exists. Freighter transaction requests still
   trigger inspected exact-XDR intent and explicit user review; D1/SDK/Core
   enforce active network, account/signer, System Auth/passphrase and the
   original reviewed transaction. The browser returns a signed envelope
   only on explicit approval; it does not broadcast. No WalletConnect,
   auto-submit, token signing, Soroban auth entries or hardware bypass.

## FChain editorial assumption

A validated API response is **not cryptographic evidence** of website
ownership or an independent malware/safety audit. Prompt-free disclosure
of a public address relies on the configured FChain directory operator
maintaining an approved editorial/trust policy. The product owner must
review this operational assumption and actual provider curation before
shipping this option by default. If submissions are unmoderated or the
operator cannot attest listings, **disable the implicit read-only shortcut**
while retaining ordinary browser explicit-consent access. The implementation
does not elevate public catalog entries into durable permissions.

## Platforms and evidence

Android in-app WebView is already gated by the **merged** S16 native
public-address HTTPS proxy/POST/redirect protection. iOS uses the existing
embedded surface. A missing native Android guard keeps the existing
external-browser fallback; this PR does not install or weaken native
network enforcement.

Automated tests cover live200/conditional304 vs stale/invalid/unsupported
entries; time bounds, account/network/address/revision binding; single use,
manual/Recent and exact URL isolation; detail-sheet cancel/reopen and late
callbacks; first document Freighter reads, same-origin reload, cross-origin
navigation, revoke and independent transaction inspection.

**Not accepted:** provider editorial assurance, actual HTTP/WebView/Freighter
site integration, cross-platform device UI, device denial/redirect fixtures,
background/cancel/retry flows or Stage 9 real iOS System Auth cancel→retry.
Repository tests and Android native proxy mechanism tests cannot substitute
for native product-flow acceptance. This slice does not upgrade S15–S18
to L4.
