# S17 dApp account-read authorization (candidate behavior)

Status: **unmerged stacked candidate** on PR #130, which is based on PR #128. Traceability ID S17; clean-room adaptation of Stellar's user-facing connection/management behavior, without copying Xaman/Stellar derivative source. See AGENTS.md and docs/provenance/README.md.

## Authorization identity and capability boundary

- A durable read-only grant is the exact tuple **canonical public HTTPS origin + immutable account ID + network ID**. Public catalog membership, browsing a website, and recent history are **never** automatic authorization.
- Initial request_access / set_allowed_status displays the actual origin, selected account and network. **Allow once** lasts only within a live browser session for that origin, never persisted. **Always allow** writes the tuple atomically in the wallet Realm before acknowledging success. **Reject** never stores consent.
- Grants permit the Freighter bridge to disclose the public address and associated network metadata; they do **not** permit signing, transaction submission, SEP-53 signing or Soroban auth-entry signing. Existing exact-XDR review, source-account/network binding, user authorization and SDK/Core signing remain mandatory.
- The saved record includes only the tuple and a created-at timestamp; no complete URL query, app passphrase, private key, XDR, signer, encrypted wallet data or signature.
- Any failed permission storage write must produce a non-success error response to the requesting page, synchronously retire the session and present a failure state; never downgrade 'always' to 'once'. Invalid or closed Realm reads deny authorization.

## Revocation and lifecycle

- Settings → Connected dApps lists persistent grants **only for the selected network**, with the account label (or stable account ID if missing). Each row exposes a disconnect action for that exact tuple.
- An authorized disconnect is a Realm write first; only after success may the row disappear. On write failure, the UI keeps the row and reports an error. On an unavailable read, the UI reports inability to load rather than claiming no grants.
- Every revoke event immediately retires any matching browser's pending permission, transaction review and future message responses; even an 'allow once' session for that identity cannot survive an explicit revoke. Browser unmount/focus loss/account or network switch/service close also retires the existing session.
- Another origin, account or network's grant is untouched. Revoked grants do not reappear across a force-stop/restart. A new browser session can request consent again.
- Deleted accounts have stable IDs; stale records cannot transfer consent to a different/new account. Pruning orphaned grant records after account deletion is deferred to account-lifecycle integration (does not authorize new accounts).

## Persistence and scope

- Realm v8 adds a separate DappPermissionGrantEntity. Migration from v7 is additive and preserves account, signer and catalog records; the public catalog remains a different table.
- No network/account identifiers or sensitive signing material are stored in general React State or navigation params for permission convenience.
- Current Android embedded WebView remains disabled by PR #128 (POST safety); Android can view/revoke existing persisted grants but cannot create new in-app dApp consent until native request policy is independently proven.
- Catalog trust policy, persistent grant lists, session revocation and failure recovery require unit + Realm integration tests; CI success alone is **not** iOS/Android native product-flow acceptance.

## Acceptance evidence boundaries

- Focused JS/unit: grant scopes, rejected origins, duplicate grant, write/read failure, closed store, event-driven revocation and stale browser callbacks, Settings network scoping.
- Realm integration: actual wallet v7→v8 migration, persistence across reopen, precise revoke, unaffected account and other network rows.
- Deferred native acceptance: Settings list/scroll/a11y, consent prompt, network/account switching, app relaunch and real in-WebView authorization on iOS. Android native browser activation requires a separate POST/redirect-safe ingress solution and real network capture. No claim of completed S17 L4 acceptance.
