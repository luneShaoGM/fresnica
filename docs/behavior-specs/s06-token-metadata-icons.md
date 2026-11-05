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

- Successful normalized token metadata: **7 days**; negative failure
  cooldown: **24 hours**. Key: JSON exact `(networkId,code,issuer)`. Show
  curated fallback if issuer metadata fails, never infer trust from name/icon.
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

- Implemented native modules: Android Kotlin
  `SecureAssetFetchModule` with `HttpsURLConnection` and
  `instanceFollowRedirects=false`; iOS Swift `SecureAssetFetch` with
  `URLSessionDataDelegate` and `willPerformHTTPRedirection` refusing
  redirects **before following**. Both use HTTPS, strict public DNS name
  syntax, no IP literal/localhost/private hostname/credentials/fragments/
  alternate port; deny non-200 responses and no nonstreaming JS fallback.
- Both receive data in bounded chunks with maximum **64 KiB image** or
  **512 KiB text**, deadlines and cancellation. Image signature must be
  PNG/JPEG and decoded width/height in **1..512**. Bytes stay in native
  bounded buffers before base64 delivery to JS. Native data-URI is used
  to render; no direct React Native remote image fetch/redirect.
- A successful Android `:app:compileDebugKotlin` and iOS Swift SDK
  *typecheck* verify compilation aspects only. Swift typechecking with a
  temporary React type stub does not replace a full Xcode/Pods build.
  Security claims about redirect requests, DNS resolution, cancellation and
  actual byte limits require independent **native-network fixture tests**,
  including a target server proving zero redirected requests, missing/lying
  Content-Length, malformed/oversized images and device revoke/retry.
  Do **not** call this product-flow accepted until actual native evidence
  is captured. Native iOS app compilation is not established by a Swift
  typecheck alone.

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
