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
2. The configured `https://dapp.fchain.io/v1` adapter independently checks
   **network-specific freshness and schema**, via validated HTTPS 200 or
   genuinely conditional 304 with same-network ETag/Last-Modified. This does
   **not** establish editorial approval, website ownership or permission.
   A second, **default-empty code-reviewed allowlist** must match the exact
   `(networkId, appId, normalized launch URL)` before a row can be considered
   trusted. The App currently supplies **no approved entries**, and the
   composition layer does not forward this optional trust port. Thus
   **automatic read-only connection is OFF in shipped product code**, even
   for a fresh API row. Enabling it requires separate operator/entry approval
   evidence and an audited code change. Public API, Realm, remote config and
   cached details must never populate the reviewed allowlist. For any future
   approved entry, the live evidence lasts at most five minutes and is
   retired by refresh, failure, close or offline cache restart.
3. The details sheet always labels and shows **the exact normalized
   `entry.websiteUrl` that Open will navigate to**, immediately before
   the action. The separately fetched detail API may cache another URL
   for up to 24 hours: that old URL is never presented as the Open target.
   When old details disagree, show an explicit warning. If details are
   missing, still loading, stale or URL-mismatched, the Open action may
   continue **without** implicit connection and a separate S17 connection
   approval is required. Only current, aligned details may pass the
   additional alignment gate (and the editorial allowlist remains required).
4. The explicit user action must still be active and focused on the current
   list version. Only an approved, live-verified row with **aligned detail
   URL** could produce a **30-second**, single-use, non-serialized launch
   proof. Proof binds the selection's immutable account ID, public address,
   network ID/passphrase, Horizon URL and monotonic selection revision.
   Browser navigation parameters contain **only the public URL**, no trust
   flag or sensitive data. Manual URL, Recent, stale detail callback,
   dismissed sheet and untrusted sample cannot mint proof.
5. App composition consumes that proof once when initializing the browser
   route. The target HTTPS origin must exactly match. Native WebView
   main-frame source checks, message nonce, per-document replay filtering
   and network guards remain mandatory. A trusted **first exact main
   document** may read the selected public address, Freighter connection
   status and public network details without another connection dialog.
   A subsequent document reload, redirect, changed launch path, cross-origin
   document **or navigation-state** change permanently retires this
   shortcut, even on returning to the original origin. SPA History API
   changes do not count as a new document.
6. This shortcut is **not Allow Always**: it creates no Realm permission
   grant and does not persist across browser closure, focus/session
   retirement, account/network revision or grant revocation. Other sites,
   accounts, networks and manual links still need S17 permission.
7. **No signing shortcut** exists. Freighter transaction requests still
   trigger inspected exact-XDR intent and explicit user review; D1/SDK/Core
   enforce active network, account/signer, System Auth/passphrase and the
   original reviewed transaction. The browser returns a signed envelope
   only on explicit approval; it does not broadcast. No WalletConnect,
   auto-submit, token signing, Soroban auth entries or hardware bypass.

## FChain editorial assumption

A validated API response is **not cryptographic evidence** of website
ownership or an independent malware/safety audit. Prompt-free disclosure
of a public address relies on the configured FChain directory operator
maintaining an approved editorial/trust policy. Its actual practice has
not been established. This PR therefore **ships no reviewed entries and
does not expose implicit read permission from the App composition layer**.
Only an explicit product-owner security review and a later reviewed code
change may enable listed network-specific URLs; until then the ordinary
embedded browser and per-origin S17 connection prompt remain available.
The implementation does not elevate public catalog entries into durable
permissions.

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
