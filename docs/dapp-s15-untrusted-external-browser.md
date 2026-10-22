# Stage 7 / S15 — Untrusted custom website handoff (External Browser)

Status: implementation candidate for independent exact-HEAD Work review. Base main@dd5574a75ec5485a549448c4b4fa50ce35d744a3 (S10 PR #109 merged, reviewed P1/P2/P3 = 0).

## S15 product and security boundary

The dApps Home screen retains the existing S14 **unconfigured, read-only** Catalog and its public search/category states. A new separate S15 input allows a user to type a public HTTPS website, check its canonical host/origin/full URL, see an explicit _unverified website_ warning, **cancel without opening**, or deliberately open it with the existing OS ExternalUrlOpener using React Native Linking.openURL.

This work does **not** render untrusted HTML inside the Fresnica process, provide a wallet bridge, inject Freighter, request account/network permissions, or expose any signing/transaction interface. All custom sites are **unreviewed**; no allowlist/catalog trust is inferred from the hostname or from a previously visited site. The browser is a separate OS application: Fresnica cannot guarantee or audit its contents, TLS resolution, redirects or page-loaded success.

### Input policy

The Dapp URL capability implements canonical public-hostname HTTPS validation, with optional HTTPS promotion for bare hostnames. It rejects explicit HTTP and other schemes, credentials, fragments, localhost/local/internal/test/invalid/onion names, literal IPv4/IPv6, confusing slash/backslash/control/bidi/whitespace, malformed DNS labels, and very long inputs. It returns a canonical URL, origin, hostname; origin matching is exact, not suffix-based. This is an input UX and wallet-boundary policy, **not** DNS resolution, CAA/PKI validation, real-time phishing detection or an assertion that DNS cannot resolve to a private address. Only the selected canonical URL is passed to the OS opener.

A warning is displayed even if a site was opened earlier; Recently requested sites store only **public origin strings in current React session state**, without query strings, wallet identifiers, persisted permissions or long-term history. Selecting Recent requires fresh preview/approval again. Cancel, invalid addresses, failed OS opener, field changes and stale async callbacks do not make a website trusted.

### Existing code reuse

- Existing AppServices.externalUrl.open platform port used by Activity Explorer; no new native OS plugin, no react-native-webview, no random-values or Freighter injection dependency.
- Existing dApps feature screen, semantic AppTheme, localization dictionaries and Native Field/Button/StateView are reused.
- No changes to existing Account/Signer, selected network, Realm schema, S07/S10/S30 transaction and recovery paths.
- Catalog Capability unchanged and unconfiguredDappCatalog remains explicit.

### Product quality and limitations

Focused tests require typing, review, warning, explicit confirmation, OS handoff; Cancel and unsafe scheme never call opener; Recent is in-session only. Unit policy includes URL credentials, lookalike domains, IP literals and non-web schemes. TypeScript, 3-locale parity, provenance/architecture, Jest, Realm, Android/iOS release JS bundle to be independently verified at exact final HEAD.

**Deferred**: S16 embedded WebView lifecycle and origin changes, S17 persistent permissions/revocation, S18 Freighter public account requests/XDR, S19 signing, any claim of verified Catalog or safe external website content. The experimental embedded Browser/Freighter changes are retained **uncommitted on the original local worktree**, deliberately excluded from this safety-bounded PR while new native dependencies and origin/iframe access need separate build and security validation. Do not use these experiments as merge evidence.

Native Android/iOS device interaction and final accessibility/real Testnet acceptance remain deferred per user policy. This S15 slice cannot raise S14 Catalog or S16/S18 browser maturity to L3/L4. Merge requires Work independent exact-HEAD review and user decision.
