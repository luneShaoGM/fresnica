# Settings — Questions & Support and Terms & Conditions

## User-visible contract

- Settings → Questions & Support opens the known official website `https://fchain.io/` in the system browser. If opening fails while the originating Settings route remains focused and has not blurred, a localized message is shown with a Back action. Late failures after leaving the route are ignored, including when the user later returns.
- Settings → Terms & Conditions displays the **reference** agreement version `20260713` and explains, in the selected supported locale, that an approved agreement is not yet available. It does not display or distribute the unverified donor legal text.
- The reference agreement's assertion that the app supports multi-signature sending is inaccurate: current transaction submission rejects unsupported multisig. No legal agreement can be published with that assertion. Legal/content owners must approve an accurate revised agreement and its final version before activating the full Terms reader.
- Reading Terms does not imply acceptance; it does not write wallet, profile, or signing state. Agreement acceptance and version migration are outside this slice.

## Source, licensing and release gate

- Behavior reference: `origin/Stellar/src/screens/Settings/SettingsView.tsx` and `origin/Stellar/src/screens/Settings/TermOfUse/TermOfUseView.tsx`.
- The superseded PR #153 originally bundled legal paragraphs from a reference repository with CUSTOM-license provenance. This clean branch was created directly from `main`; it contains neither those paragraphs nor the superseded commits in its ancestry. Selecting a document version is not evidence of redistribution rights.
- An authorized rights holder must provide verifiable, recorded rights for the agreement text **or** approve a replacement original document, including truthful current multisig wording. Until then, Terms must remain explicitly unavailable and this slice must not be described as a completed legal agreement feature.
- Presentation and navigation use Fresnica components; no donor program implementation is migrated.

## Verification and deferred work

- Focus tests: Settings actions/navigation, localized support failure, stale failure after blur/refocus or loss of focus, versioned pending state, no donor agreement content or acceptance behavior.
- Native product-flow checks for iOS/Android system-browser handoff, scrolling, and back navigation remain deferred.
- Legal document release is **blocked** by rights and content approval; automated provenance collision checks do not resolve it.

## Delivery scope

This slice delivers the working official support entry and a localized **pending-publication notice** under Terms & Conditions. It does **not** deliver a usable legal agreement, acceptance mechanism, or claim that legal terms are in force. Do not describe the Terms surface as an implemented agreement reader until independently approved content exists.

## Terms reader foundation (2026-11-04)

- `SettingsSubpage` owns the existing native safe-area, Back action and scroll view. `TermsScreen` now supports a validated, **read-only** plain-text agreement model (`version` in `YYYYMMDD`, `title`, ordered `heading` / `paragraph` sections); renderer uses theme typography/colors and accessible headings. Long documents scroll within the existing subpage rather than introducing a second WebView or HTML script surface.
- The production route intentionally passes **no** approved document. Missing content stays `unavailable`; malformed, empty or oversized content is `invalid`; neither case falls back to donor legal text. Both remain localized pending/error states. The readiness of a sample document in unit tests is **not** proof that it is legally approved or published.
- The reader never records acceptance, even when a structurally valid document is provided. No accept control is enabled, no signer/Realm/profile schema changes, and no remote legal-content download is added.
- To publish later, the authorized content owner must approve the final plain-text sections, a release version, and rights/provenance evidence; then a separate reviewed integration supplies the verified document to the production Terms route. Acceptance version storage and migration require their own approved product contract, if acceptance is actually required.
