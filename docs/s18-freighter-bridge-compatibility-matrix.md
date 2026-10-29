# S18 Freighter bridge compatibility matrix (candidate)

**Scope:** Stage 7 S16/S17/S18, based on Fresnica PR #128 at `9e0cb6c55e9ee00b322dda3d0ad25509ab856771`. The current S18 follow-up branch is stacked on #128; it is **not merged**. The PR #128 Android in-app dApp browser remains disabled until POST-safe native validation is proven.

**Donor behavior audit:** local `origin/Stellar@bd0f4540b2496a57314e4e29bc6fcf8ff691b60f` — Freighter external service request contract, XAppBrowser consent handling and native main-frame bridge. This matrix records **observable behavior and required contracts**, not permission to reuse donor source. Per `docs/provenance/README.md`, implementation remains Fresnica clean-room and must not copy Stellar/Xaman derivative code.

## Transport and identity contract

- Request envelope: `source = FREIGHTER_EXTERNAL_MSG_REQUEST`, supported `type`, `messageId` (positive finite number or bounded string), bounded type-specific fields. Optional legacy page token is accepted only when it matches the session token; it is not a substitute for native origin proof.
- Response envelope: `source = FREIGHTER_EXTERNAL_MSG_RESPONSE`, `messagedId` (legacy spelling, echoes the request ID), type-dependent data or error.
- A native-reported **main-frame HTTPS origin** is mandatory; iframe, unverified origin, wrong document origin, malformed request, unknown fields, excessive payload or replayed ID are dropped before business handling. The same-document ID registry resets on new document loads, not only URL changes.
- Session identity is locked to `origin + accountId + networkId`, along with account address, passphrase, endpoint and a monotonic selection revision. Navigation, focus loss, account/network changes and close must retire pending consent/signing.
- The browser message protocol carries no secret keys, app passphrase, or unreviewed signing authority. Account access consent is distinct from each transaction review. SDK/Core remains signing authority.
- The donor's Android RN HTTP client host allowlist **does not** protect native WebView requests. Android embedded transport remains disabled pending pre-request POST/redirect/private-network enforcement and native network verification.

## Method-by-method behavior and gap status

| Freighter request type | Stellar reference behavior | Fresnica on #128 | S18 compatibility outcome / pending |
| --- | --- | --- | --- |
| REQUEST_CONNECTION_STATUS | Return whether an account exists | Returns `isConnected` for a live, selected account session | Aligned response field; verify absent-account behavior in native flows |
| REQUEST_ALLOWED_STATUS | Report per-origin allow status through browser layer | Returns `isAllowed`; does not create a grant | Aligned intent; persistence not wired |
| REQUEST_ACCESS | Request or reuse origin consent, then return `publicKey` | Origin/account/network-scoped consent, returns `publicKey` | Aligned core response; persisted and curated consent still pending |
| SET_ALLOWED_STATUS | Request or reuse origin consent, return `isAllowed` | Same flow; returns `isAllowed` | Same safety intent; persisted grants and revoke UI pending S17 |
| REQUEST_PUBLIC_KEY | Return selected `publicKey` after the browser gate | Requires explicit consent; returns `publicKey` | Aligned with stricter disclosure rule |
| REQUEST_USER_INFO | Return `userInfo.publicKey` | Requires consent; same response shape | Aligned with stricter disclosure rule |
| REQUEST_NETWORK | Return `network` | Requires consent; returns network label | **Different permission timing**; keep fail-closed pending capability/privacy decision |
| REQUEST_NETWORK_DETAILS | Return `networkDetails` with network URL and passphrase | Requires consent; returns network details | **Different permission timing**; do not expose configured endpoints before explicit approval without review |
| SUBMIT_TRANSACTION | Show full review, sign requested XDR; dApp broadcasts | Supported for allowlisted fully reviewable classic payments, exact-XDR binding, no broadcast | Safe subset; Soroban/other operations deferred until reliable intent rendering |
| SUBMIT_TOKEN | Asset/contract confirmation; response contains `contractId` | Previously dropped recognized envelopes containing type fields | **This slice:** structurally valid request receives explicit `error: unsupported`; no trustline/token change |
| SUBMIT_BLOB | Reviewed blob signing | Previously dropped requests with `blob`/`apiVersion` | **This slice:** valid fields receive `error: unsupported`; no blob signing |
| SUBMIT_AUTH_ENTRY | Reviewed Soroban authorization-entry signing | Previously dropped requests with `entryXdr`/`apiVersion` | **This slice:** valid fields receive `error: unsupported`; no auth-entry signing |

### Schemas covered by this slice

- `SUBMIT_TOKEN`: required bounded `contractId`; optional `issuer`, `assetCode`, `symbol`, `name`, `iconUrl`, `assetType` (classic/soroban), `decimals` (integer 0–18); common bounded account/network fields.
- `SUBMIT_BLOB`: required bounded `apiVersion` and `blob`; common bounded account/network fields.
- `SUBMIT_AUTH_ENTRY`: required bounded `apiVersion` and `entryXdr`; common bounded account/network fields.
- Unknown type/field, missing required field, invalid numeric/enum fields, oversized request, mismatched origin/session or duplicate ID **remains a drop**. A **valid recognized but unsupported** request from a live, verified session resolves to an explicit unsupported response, with neither permission upgrade nor sign initiation. An invalidated session still fails closed.

## Other compatibility work deliberately deferred

- Source `FRESNICA_DAPP_MSG_REQUEST` (notifications), historical xApp commands, device APIs, screenshot/share/camera, account-switch events: separate S21 capability/permission plan; no implicit bridge rights.
- Structured Freighter `apiError` code parity (declined/internal/no account) and browser-side Promise resolution/rejection timing require a contract test using a real dApp, not a guessed error mapping.
- Network-info-before-consent differs from Stellar. Assess privacy and explicit product capability contract before changing; avoid exposing custom node or account context just to match a legacy adapter.
- Durable `allow_always`, revocation, grant listing, and removal of any catalog-bypass behavior belong to S17. Current grant memory is process-local, despite the UI label.
- Android embedded WebView reopening requires separate native POST/redirect security work and Android device evidence. The repository tests in this slice are **not** native product-flow acceptance.

## Verification boundary and exit

This slice's success is **protocol-level fail-closed completion**, not a claim that all Freighter APIs are implemented: supported methods keep prior authorization/intent behavior; recognized unsupported methods produce a response rather than hanging; malformed or untrusted input remains blocked. Verify focused repository tests, full `npm run check`, exact remote HEAD, then request independent Work review before merge.
