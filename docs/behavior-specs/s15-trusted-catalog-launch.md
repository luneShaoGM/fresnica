# S15 trusted live-catalog launch (candidate)

Status: unmerged S15/S16 follow-up. Clean-room behavior adaptation from local
Stellar XAppBrowserModal catalog trust handling and Freighter extension connection
semantics; see AGENTS.md and docs/provenance/README.md.

## Goal

When the user intentionally opens a dApp from Fresnica's **fresh, validated
FChain API directory**, the current live main document may connect to the
selected wallet read-only without an additional connection dialog. This is
**not** an Allow Always permission and **not** authorization to sign.

The FChain directory operator's editorial/API integrity is the trust
assumption: **listing is not cryptographic proof of site ownership or safety**.
If the API can accept arbitrary unreviewed submissions, automatic
connection must remain disabled until backend review/attestation is established.
This limited session policy intentionally treats successful, schema-checked
HTTPS API responses as the configured operator's trust assertion, with
no third-party malicious-site scan or independent audit asserted.

## Trust and authorization contract

- Only a user action on a displayed API directory row can start the
  preapproved session. Manual URL entry, Recent, interface samples, or external
  browser handoff never auto-connect. The destination URL must be the exact
  network-specific, normalized HTTPS URL selected from the live catalog.
- The API client pins https://dapp.fchain.io/v1, rejects redirects, checks
  payload schema and active network, and records a short-lived in-memory
  id -> full URL mapping after a successful validated 200, or a genuine live
  304 revalidation of the already validated same-network cache.
  This in-memory attestation expires after five minutes without successful
  revalidation (never treated as perpetual curated status).
- Offline, stale/error fallback, cold cache hydration, missing/altered entries,
  detached services and an unsupported network do not mint trust.
  Starting a revalidation drops existing attestation until it succeeds.
- The trusted launch is held in a single-use in-memory capability with the
  current account ID, public address, network ID, passphrase, endpoint and
  monotonic selection revision. It is never serialized or put into route
  parameters (which carry only the public launch URL).
- The browser consumes the proof once on first route initialization. The
  verified initial HTTPS origin must match that exact proof. The WebView's
  native main-frame origin, document nonce/replay guards, and session liveness
  checks remain mandatory for every Freighter request.
- Only matching-origin account address and read-only network/API status may
  bypass a *connection* prompt. Navigating to another origin, changing
  account/network, losing focus, revoking the identity, or closing the
  browser invalidates the previous session/trust.
- No Realm persistent grant is created by a catalog launch. User
  Always Allow remains a separate action handled by the existing
  exact-origin/account/network grant store.
- Every transaction/signer action still requires its own original exact-XDR
  intent review, current account and network checks, app/system
  authorization and SDK/Core signing. Catalog status never bypasses it.

## Platform and evidence boundaries

- iOS in-app browser can consume this read-only auto-connection flow.
  **Android embedded WebView remains disabled** by PR #128 due to unresolved
  POST network request coverage. Android directory taps route through the
  existing URL confirmation and OS browser with **no wallet bridge**.
- Repository unit tests cover live vs stale catalog, 304 revalidation, selected
  network, invalid and mismatched origins, duplicate launches, account/network
  changes, same-origin read, cross-origin navigation, and revoke.
- Browser device/native acceptance, real production API directory editorial
  review, site-content changes, signature review on iOS and POST safety on
  Android are **not** proven by Jest/CI. Do not call this L4/native acceptance.

## Later slices

- Separate Android WebView POST/redirect/private-network pre-request controls
  and on-device network-capture acceptance are required before enabling
  Android embedded dApps.
- A future signed/explicit editorial curation signal would provide stronger
  trust provenance than the currently configured API-directory assumption.
- This slice is based on main after PR #129 was merged. Keep its network
  selection behavior and verify account/network partitioning in Work review.
