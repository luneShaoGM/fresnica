# S06 Token metadata, safe public icons and ephemeral icon cache — Phase 2

Status: **implementation candidate**, pending remote exact-HEAD Work Review,
required CI, and native iOS/Android product-flow/security acceptance. No
maturity promotion. Owner: S06 shared asset metadata/icon capability; Activity
(S13), Home, Send and Trustline/Add Asset are display-only consumers. Trace:
LC5 remaining asset metadata consumer; design decision **Adapt**, clean-room
behavior reference `origin/Stellar@stellar-migration`. Never copy donor
sources, artwork, icon bytes or unapproved code.

## Asset identity and data provenance

- Mainnet classic credit assets use a **case-sensitive exact code + full
  issuer** identity with `networkId`. The native XLM mark remains local.
  Different codes, issuers and networks must never share cached metadata.
  Metadata is **display-only** and cannot attest legitimacy, issuer
  reputation, reserve, account permissions, trustline eligibility or balances.
- Keep existing fixed Mainnet curated source priority:
  Lobstr → Soroswap → StellarExpert, through phase-1 `readCachedSource`
  snapshots (12-hour source cache). Prefer cached curated icon candidates for
  icon rendering; eliminate duplicates and reject unsafe URL forms.
- Optional issuer TOML enrichment requires all of: a configured public
  **HTTPS Horizon** endpoint returning the **expected network passphrase**;
  the exact issuer account record with matching `account_id`; a bounded
  syntactically valid public `home_domain` from that record; and a TOML
  `[[CURRENCIES]]` entry with exact code + issuer. Only then use its
  metadata and optional image URL as an additional fallback candidate.
  Existing lightweight CURRENCIES reader recognizes simple named fields;
  more expressive TOML syntax remains outside this candidate until a
  separately verified parser is available. An issuer-provided image is
  still untrusted display media.
- Reuse existing normalized S06 asset structs. Never store account
  addresses, seed/signer references, raw image bytes, XDR, private tokens or
  transaction details with metadata. Mainnet display-only data lives in an
  additive **Realm v11** top-level cache; v10 wallets preserve Accounts,
  PendingSubmission/uncertain recovery, Balance, History, dApp and curated
  source snapshots unchanged.

## Cache behavior

- Verified issuer metadata refresh: **7 days**; issuer Horizon/TOML
  failure or missing matching issuer currency: **24-hour retry cooldown**,
  even when a curated directory provides a valid display fallback. Preserve
  last-good metadata, record `retryAfterUnixMs` separately, and retry
  issuer enrichment once the cooldown expires; only a successful issuer
  response clears the retry flag and starts a new 7-day TTL. Key: JSON exact
  `(networkId,code,issuer)`. Never infer trust from name/icon.
  Old or cancelled refresh must not publish to newer network/session.
- Consent: new remote icons are **OFF by default**, **Mainnet only**, and
  only available if the installed native `SecureAssetFetch` bridge advertises
  both download and cancellation methods. The user-visible toggle explicitly
  warns of requests to external image providers. Consent is session-only,
  resets on AppServices retirement/network change and disables/cancels all
  in-flight requests immediately. Any missing bridge, bad source, invalid
  bytes, decode failure or offline condition displays a local deterministic
  fallback. No remote URL is ever handed to RN `Image`.
- Icon cache stores only valid local `data:image/png|jpeg;base64,...` URIs
  in **memory** (max **24 images**, **10-minute TTL**); candidate failure
  cooldown is **one hour** (max **120 candidates**), with at most **two**
  native concurrent requests and a **16-item JS pending queue**. Opt-out and
  session retirement clear this cache. Realm stores only bounded display
  candidate URLs and metadata, never image bytes or account-derived keys.
- A source/issuer icon is not proof of asset validity. All transaction and
  signing gates continue to use fresh trusted ledger state, exact asset
  identity and the existing authorization/capability pipeline.

## Native bounded transport — separate security proof required

- **Socket-address security (PR #171 P2 fix):** hostname syntax alone
  cannot prevent DNS rebinding or a public-looking domain resolving to a
  private address. The Android Kotlin module now uses an isolated
  `OkHttpClient` whose `PublicAssetDns` reuses the existing dApp tunnel's
  public-address validator; **all** resolved A/AAAA addresses must pass,
  and OkHttp connects to that vetted numeric address list directly.
  Connection proxies, redirects, TLS downgrade and pooling reuse are
  disabled; standard hostname-verified TLS remains required. iOS Swift
  resolves DNS on a separate utility queue, rejects mixed/private/reserved
  replies and passes an already validated **numeric** IPv4/IPv6 endpoint
  directly to `NWConnection`. TLS SNI and certificate trust evaluation use
  the **original hostname**, TLS 1.2+, and HTTP/1.1; the numeric IP is
  never resolved again. Its bounded HTTP parser refuses any non-200
  response before new requests, and accepts only bounded fixed-length,
  close-delimited, or simple chunked responses. No raw RN fetch/XHR/Image
  fallback exists.
- Strict public-IP policies deliberately fail closed on reserved network
  ranges (including loopback, link-local, private, transition and
  documentation prefixes). Some private-RPC/captive/IPv6 translation
  networks may not provide an allowed public display endpoint; a local
  icon fallback is required instead. Public display access never changes
  configured wallet RPC/signing/network authority.
- Both receive data in bounded chunks with maximum **64 KiB image** or
  **512 KiB text**, deadlines and cancellation. Image signature must be
  PNG/JPEG and decoded width/height in **1..512**. Bytes stay in native
  bounded buffers before base64 delivery to JS. Native data-URI is used
  to render; no direct React Native remote image fetch/redirect.
- Native compile and address-boundary evidence: Android
  `:app:compileDebugKotlin` plus `PublicAssetDnsTest` (fake DNS answers,
  actual OkHttp connection-start counter stays zero on private-only DNS),
  iOS `scripts/native/PublicAssetAddressFixture.swift` (synthetic
  private/mixed numeric DNS results produce no `NWConnection` endpoint),
  full iOS Simulator Xcode build, and a separate macOS
  `https://example.com/` TLS/HTTP 200 smoke through the same Swift
  source. These are **native source/connection-policy tests, not device
  acceptance**. Complete security acceptance still requires independent
  device fixture evidence for forbidden redirect target request count,
  rebind behavior, malformed/lying Content-Length, chunk framing,
  oversized/invalid images and cancellation/retry.
  Do **not** call this product-flow accepted until actual native evidence
  is captured.

## Consumer integration and test boundaries

- One `TokenAssetIcon` plus optional Mainnet `PublicIconToggle` is used
  across Home asset rows/details, Add/Manage Asset, Send and Activity single
  asset/money legs. Native XLM and unsupported/unknown identities continue
  to use local decor and existing accessible row semantics. No new image
  information is persisted in History; Activity manual hide/show and
  Claimable quantity evidence remain unchanged.
- Validate JS identity/TTL/candidate fallback, default opt-out/no request,
  no native capability, explicit opt-out/cancel, redirect parameter/source
  allowlisting, bounded queue, invalid native result, corrupt Realm row,
  native app compile/toolchain checks, actual v10→v11 migration and all
  affected product tests. Native full flows and Stage 9 iOS real-device
  System Auth cancel/retry remain separately deferred as planned.
- The next planned **Phase 3** remains a separate one-PR effort for LC5
  dApp detail/icon, Claimable current snapshot and Resolver consumers once
  this PR is independently reviewed and the user elects to merge.

## 2026-11-06 S06 follow-up: Mainnet and Testnet public token icon parity

This is one follow-up PR to the already merged #170/#171/#172; the preceding
Phase 2 Mainnet-only restriction is historical, not the final product policy.

- Mainnet and Testnet both support external token images with explicit,
  session-scoped consent, default OFF. The same toggle is exposed on Home,
  Add Asset, and Activity. No automatic icon/background catalog fetch occurs
  before consent; explicit Add Asset directory browsing is independent. Opt-out or network/AppServices retirement
  cancels pending requests and discards image bytes.
- Mainnet loads the three already-approved curated catalogs on first eligible
  icon use after consent, once per opt-in session. Source snapshots retain
  the existing 12-hour TTL/failure cooldown/offline recovery. Fresh curated
  candidates take precedence over retained issuer metadata, without
  overwriting wallet or trustline authority.
- Testnet has NO approved curated directory. It cannot use Mainnet source
  snapshots or Mainnet token art, even if the same code and issuer happen
  to appear there. Testnet images come exclusively from a verified Testnet
  Horizon root/passphrase, exact issuer account/home_domain, and matching
  issuer TOML currency. An optional issuer DOCUMENTATION.ORG_LOGO from the
  same verified TOML is the last candidate. Unsupported sources display the
  deterministic local fallback. Testnet Add Asset remains manual when no
  curated source is configured.
- Realm v12 already stores networkId as a string; the v11 public metadata
  payload is now validated for either canonical network with exact
  (networkId, case-sensitive code, full issuer) keys. The existing 7-day
  positive/24-hour retry policy remains. No new migration or persisted
  image bytes are introduced.
- Native XLM uses a newly drawn local vector mark, not donor artwork.
  Existing bounded native SecureAssetFetch, no redirect, public IP/TLS,
  image dimensions, limits, and fail-closed requirements are unchanged.
  A decoded Image onError retires that candidate and tries the next.
- No changes to authorization, signer state, exact transaction identity,
  pending/uncertain recovery, claimable balances, or account/network
  selection. JS/Realm tests are not native product-flow acceptance; native
  media privacy/network-failure/focus and Stage 9 System Auth device
  acceptance remain deferred.

### PR #174 follow-up: bursty Testnet icon concurrency

TokenIconPort now gates complete metadata-to-image loads to **two active
assets**, with abortable FIFO waiting for other mounted rows. This reuses
the existing two-active/16-pending native transport limits rather than
enlarging them: local queue pressure must not become a 24-hour negative
issuer result. Opt-out and service retirement cancel waiting operations
before they enter the native pipeline. The issuer's genuine 24-hour
failure cooldown, network partition and default-off consent are unchanged.
A 25-asset deterministic burst test exercises the real metadata resolver
and native JS transport adapter, checks all assets recover as capacity
drains and asserts no retryAfterUnixMs was persisted. Native device
media/security acceptance remains deferred.

## 2026-11-06 follow-up: unknown Token artwork

Stellar uses a fixed unknown-asset image after all Token icon candidates fail.
Fresnica uses the user-approved, individually audited unknown-asset PNGs
from the user's own Stellar project in a locally resized bundle. This is
an explicit one-image-family exception to the prior vector fallback; no
other project asset receives general copy authorization. See
'docs/provenance/user-owned-token-artwork-approval.md'.
Every credit asset without a currently accepted public icon uses the same
neutral mark, including before explicit public-media consent, while awaiting
its verified icon, while offline, or after candidates are exhausted.
Never derive unknown Token artwork from the code, issuer or network.
Successful safe icon candidates still replace the fallback without flicker
or changing network isolation. Native XLM retains its local XLM mark.
This presentation-only change adds no remote requests or persistence.
